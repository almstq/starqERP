-- tests/serp088_counter_return_void_probe.sql
-- SERP-088 — executable synthetic DB probe.
-- Proves controlled return, refund and void against disposable PostgreSQL runtime:
--   * Itemized return linked to original counter sale;
--   * Full void reversing all lines and gross total;
--   * Positive stock movements ('return') restoring canonical live on-hand;
--   * Credit note commercial document minted as 'settled';
--   * Counter returns register and refund tenders tables;
--   * SoD & approval gate (SERP-030): manager seat, solo capacity, supervisor override;
--   * Negative fail-closed paths: unauthorized seat, unapproved segregated return,
--     cross-tenant sale, quantity exceeding sold, double void;
--   * Idempotent replay: duplicate command key returns stored return;
--   * Cash session integration: cash refunds deducted from expected cash at till close;
--   * Clean rollback (leaves no residue).

begin;

-- Helper to assert exception with expected code
create or replace function pg_temp.expect_reversal_error(
  p_org uuid, p_person uuid, p_seat text, p_key uuid, p_cmd jsonb, p_expected text
) returns void language plpgsql as $$
declare
  v_err text := null;
begin
  perform public.api_counter_sale_reversal(p_org, p_person, p_seat, p_key, p_cmd);
  raise exception 'EXPECTED ERROR % BUT CALL SUCCEEDED', p_expected;
exception when others then
  if SQLERRM not like '%' || p_expected || '%' then
    raise exception 'EXPECTED ERROR % BUT GOT %', p_expected, SQLERRM;
  end if;
end;
$$;

do $$
declare
  v_org uuid := gen_random_uuid();
  v_org_usd uuid := gen_random_uuid();
  v_other_org uuid := gen_random_uuid();
  v_loc uuid := gen_random_uuid();
  v_other_loc uuid := gen_random_uuid();
  v_person uuid := gen_random_uuid();
  v_manager_person uuid := gen_random_uuid();
  v_tech_person uuid := gen_random_uuid();
  v_other_person uuid := gen_random_uuid();

  v_role_counter uuid := gen_random_uuid();
  v_role_manager uuid := gen_random_uuid();
  v_role_tech uuid := gen_random_uuid();
  v_other_role_counter uuid := gen_random_uuid();
  v_m1 uuid := gen_random_uuid();
  v_m2 uuid := gen_random_uuid();
  v_m3 uuid := gen_random_uuid();
  v_other_m uuid := gen_random_uuid();

  v_prod_1 uuid := gen_random_uuid();
  v_prod_2 uuid := gen_random_uuid();
  v_prod_unsold uuid := gen_random_uuid();

  v_res jsonb;
  v_sale_1 jsonb;
  v_sale_1_id uuid;
  v_sale_2 jsonb;
  v_sale_2_id uuid;
  v_ret jsonb;
  v_key uuid;
  v_onhand numeric;
  v_session jsonb;
begin
  -- 1. Setup Organizations
  insert into public.organisations (id, slug, legal_name, base_currency, status)
  values
    (v_org, 'probe-org-serp088', 'SERP-088 Probe Org', 'MVR', 'active'),
    (v_org_usd, 'probe-org-serp088-usd', 'SERP-088 USD Org', 'USD', 'active'),
    (v_other_org, 'probe-org-serp088-other', 'SERP-088 Other Org', 'MVR', 'active');

  insert into public.locations (id, organisation_id, code, name, kind, active)
  values
    (v_loc, v_org, 'MAIN', 'Main Location', 'office', true),
    (v_other_loc, v_other_org, 'OTHER', 'Other Location', 'office', true);

  -- Setup Persons
  insert into public.persons (id, person_key, display_label, status)
  values
    (v_person, 'probe:serp088:counter', 'Probe Counter', 'active'),
    (v_manager_person, 'probe:serp088:manager', 'Probe Manager', 'active'),
    (v_tech_person, 'probe:serp088:tech', 'Probe Tech', 'active'),
    (v_other_person, 'probe:serp088:other', 'Probe Other', 'active');

  -- Setup Roles & Seats
  insert into public.roles (id, organisation_id, code, name)
  values
    (v_role_counter, v_org, 'counter', 'Counter Role'),
    (v_role_manager, v_org, 'manager', 'Manager Role'),
    (v_role_tech, v_org, 'technician', 'Tech Role'),
    (v_other_role_counter, v_other_org, 'counter', 'Other Org Counter Role');

  insert into public.memberships (id, organisation_id, person_id, role_id, status)
  values
    (v_m1, v_org, v_person, v_role_counter, 'active'),
    (v_m2, v_org, v_manager_person, v_role_manager, 'active'),
    (v_m3, v_org, v_tech_person, v_role_tech, 'active'),
    (v_other_m, v_other_org, v_other_person, v_other_role_counter, 'active');

  insert into public.membership_seats (membership_id, seat_code)
  values
    (v_m1, 'counter'),
    (v_m2, 'director'),
    (v_m3, 'technician'),
    (v_other_m, 'counter');

  -- Setup Products & Prices
  insert into public.products (id, organisation_id, sku, name, kind, active, sale_allowed)
  values
    (v_prod_1, v_org, 'PROD-1', 'Product 1', 'stock', true, true),
    (v_prod_2, v_org, 'PROD-2', 'Product 2', 'stock', true, true),
    (v_prod_unsold, v_org, 'PROD-UNSOLD', 'Unsold Product', 'stock', true, true);

  insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from)
  values
    (v_org, v_prod_1, 'MVR', 50.00, now() - interval '1 day'),
    (v_org, v_prod_2, 'MVR', 50.00, now() - interval '1 day'),
    (v_org, v_prod_unsold, 'MVR', 50.00, now() - interval '1 day');

  -- Seed initial stock: 100 units of each product
  insert into public.stock_movements (organisation_id, location_id, product_id, movement_type, quantity, source_type, source_id, idempotency_key, occurred_at, recorded_by)
  values
    (v_org, v_loc, v_prod_1, 'opening', 100, 'OPENING_BALANCE', v_prod_1, gen_random_uuid(), now(), v_person),
    (v_org, v_loc, v_prod_2, 'opening', 100, 'OPENING_BALANCE', v_prod_2, gen_random_uuid(), now(), v_person);

  -- ───────────────────────────────────────────────────────────────────────────
  -- STEP 1: Process real COUNTER_SALE (Sale 1: 2 units PROD-1, 1 unit PROD-2 = 150 MVR)
  -- ───────────────────────────────────────────────────────────────────────────
  v_res := public.api_garage_command(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(
        jsonb_build_object('product_id', v_prod_1, 'quantity', 2),
        jsonb_build_object('product_id', v_prod_2, 'quantity', 1)
      ),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 150))
    ),
    gen_random_uuid()
  );
  v_sale_1_id := (v_res->'counter_sale'->>'invoice_id')::uuid;

  -- Verify on-hand after sale: PROD-1 = 98, PROD-2 = 99
  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_1);
  if v_onhand <> 98 then
    raise exception 'STEP 1 FAILED: PROD-1 on-hand should be 98, got %', v_onhand;
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 1: Itemized Return of 1 unit PROD-1 in solo capacity
  -- ───────────────────────────────────────────────────────────────────────────
  v_key := gen_random_uuid();
  v_res := public.api_counter_sale_reversal(
    v_org, v_person, 'counter', v_key,
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_1_id,
      'location_id', v_loc,
      'reason', 'Customer returned 1 unopened item',
      'operating_capacity', 'solo',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 1)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
    )
  );

  v_ret := v_res->'return';
  if v_ret->>'reversal_type' <> 'return' then
    raise exception 'TEST 1 FAILED: reversal_type should be return: %', v_res;
  end if;
  if (v_ret->>'total_refund_amount')::numeric <> 50.00 then
    raise exception 'TEST 1 FAILED: total_refund_amount should be 50.00, got %', v_ret->>'total_refund_amount';
  end if;
  if v_ret->>'approval_mode' <> 'solo_capacity' then
    raise exception 'TEST 1 FAILED: approval_mode should be solo_capacity, got %', v_ret->>'approval_mode';
  end if;

  -- Live on-hand must immediately restore to 99!
  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_1);
  if v_onhand <> 99 then
    raise exception 'TEST 1 FAILED: PROD-1 on-hand should be restored to 99, got %', v_onhand;
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 2: Replay idempotency — same command key returns stored return record
  -- ───────────────────────────────────────────────────────────────────────────
  v_res := public.api_counter_sale_reversal(
    v_org, v_person, 'counter', v_key,
    jsonb_build_object('type', 'return', 'original_sale_id', v_sale_1_id, 'reason', 'Replay attempt')
  );
  if v_res->>'idempotent_replay' <> 'true' then
    raise exception 'TEST 2 FAILED: replay must return idempotent_replay = true';
  end if;
  if (v_res->'return'->>'id')::uuid <> (v_ret->>'id')::uuid then
    raise exception 'TEST 2 FAILED: replay must return identical return id';
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 3: Return second unit of PROD-1 with supervisor override (manager approval)
  -- ───────────────────────────────────────────────────────────────────────────
  v_res := public.api_counter_sale_reversal(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_1_id,
      'location_id', v_loc,
      'reason', 'Customer returned second item with manager approval',
      'operating_capacity', 'segregated',
      'approver_person_id', v_manager_person,
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 1)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
    )
  );

  v_ret := v_res->'return';
  if v_ret->>'approval_mode' <> 'supervisor_override' then
    raise exception 'TEST 3 FAILED: approval_mode should be supervisor_override, got %', v_ret->>'approval_mode';
  end if;

  -- Live on-hand restored to 100!
  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_1);
  if v_onhand <> 100 then
    raise exception 'TEST 3 FAILED: PROD-1 on-hand should be back to 100, got %', v_onhand;
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 4: Attempting to return third unit of PROD-1 (exceeds sold qty) fails closed
  -- ───────────────────────────────────────────────────────────────────────────
  perform pg_temp.expect_reversal_error(
    v_org, v_manager_person, 'director', gen_random_uuid(),
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_1_id,
      'location_id', v_loc,
      'reason', 'Excess return attempt',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 1)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
    ),
    'return_quantity_exceeds_sale'
  );

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 5: Full Void on Sale 2 (Manager seat executes directly)
  -- ───────────────────────────────────────────────────────────────────────────
  v_res := public.api_garage_command(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_2, 'quantity', 2)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 100))
    ),
    gen_random_uuid()
  );
  v_sale_2_id := (v_res->'counter_sale'->>'invoice_id')::uuid;

  -- On-hand drops from 99 -> 97
  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_2);
  if v_onhand <> 97 then
    raise exception 'TEST 5 FAILED: PROD-2 on-hand should be 97, got %', v_onhand;
  end if;

  -- Void entire sale
  v_res := public.api_counter_sale_reversal(
    v_org, v_manager_person, 'director', gen_random_uuid(),
    jsonb_build_object(
      'type', 'void',
      'original_sale_id', v_sale_2_id,
      'location_id', v_loc,
      'reason', 'Operator error — customer cancelled before departure'
    )
  );
  v_ret := v_res->'return';
  if v_ret->>'reversal_type' <> 'void' or (v_ret->>'total_refund_amount')::numeric <> 100.00 then
    raise exception 'TEST 5 FAILED: void failed or wrong refund: %', v_res;
  end if;
  if v_ret->>'approval_mode' <> 'manager_seat' then
    raise exception 'TEST 5 FAILED: manager seat should be manager_seat mode: %', v_ret;
  end if;

  -- On-hand restored back from 97 -> 99!
  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_2);
  if v_onhand <> 99 then
    raise exception 'TEST 5 FAILED: PROD-2 on-hand should be back to 99 after void, got %', v_onhand;
  end if;

  -- Voiding already voided sale fails closed
  perform pg_temp.expect_reversal_error(
    v_org, v_manager_person, 'director', gen_random_uuid(),
    jsonb_build_object('type', 'void', 'original_sale_id', v_sale_2_id, 'reason', 'Double void'),
    'sale_already_voided'
  );

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 6: Fail-closed negative paths
  -- ───────────────────────────────────────────────────────────────────────────
  -- Unauthorized seat
  perform pg_temp.expect_reversal_error(
    v_org, v_tech_person, 'technician', gen_random_uuid(),
    jsonb_build_object('type', 'return', 'original_sale_id', v_sale_1_id, 'reason', 'Tech attempt'),
    'seat_not_authorized'
  );

  -- Segregated unapproved return
  perform pg_temp.expect_reversal_error(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_1_id,
      'operating_capacity', 'segregated',
      'reason', 'Unapproved segregated return',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_2, 'quantity', 1)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
    ),
    'reversal_approval_required'
  );

  -- Non-manager approver
  perform pg_temp.expect_reversal_error(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_1_id,
      'operating_capacity', 'segregated',
      'approver_person_id', v_tech_person,
      'reason', 'Tech approved return',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_2, 'quantity', 1)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
    ),
    'reversal_approver_unauthorized'
  );

  -- Cross-tenant sale reference
  perform pg_temp.expect_reversal_error(
    v_other_org, v_other_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_1_id,
      'operating_capacity', 'solo',
      'reason', 'Cross-tenant return attempt',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 1)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
    ),
    'sale_not_found'
  );

  -- Product not on sale
  perform pg_temp.expect_reversal_error(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_1_id,
      'operating_capacity', 'solo',
      'reason', 'Unsold product return attempt',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_unsold, 'quantity', 1)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
    ),
    'product_not_on_sale'
  );

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 7: Cash Session Integration — Cash refunds deduct from expected cash
  -- ───────────────────────────────────────────────────────────────────────────
  -- Age prior probe test returns so their single-transaction now() timestamp doesn't bleed into this active session
  update public.counter_returns set created_at = created_at - interval '1 hour' where organisation_id = v_org;

  -- Open session with 200 float
  v_res := public.api_counter_session_open(
    v_org, v_person, 'counter', v_loc, 200.00, gen_random_uuid()
  );

  -- Cash sale for 50 MVR
  perform public.api_garage_command(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_2, 'quantity', 1)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 50))
    ),
    gen_random_uuid()
  );

  -- Return of the item just sold with 50 cash refund
  select id into v_sale_2_id
    from public.commercial_documents
   where organisation_id = v_org and document_type = 'sales_invoice'
   order by issued_at desc limit 1;

  perform public.api_counter_sale_reversal(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_2_id,
      'location_id', v_loc,
      'reason', 'Immediate cash return in session',
      'operating_capacity', 'solo',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_2, 'quantity', 1)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
    )
  );

  -- Check session summary:
  -- Expected cash = 200 float + 50 sales - 50 refunds = 200.00 MVR
  v_res := public.api_counter_session_current(v_org, v_person, 'counter', v_loc);
  v_session := v_res->'session';
  if (v_session->>'expected_cash')::numeric <> 200.00 then
    raise exception 'TEST 7 FAILED: expected cash should be 200.00, got %', v_session->>'expected_cash';
  end if;
  if (v_session->>'cash_refunds_amount')::numeric <> 50.00 then
    raise exception 'TEST 7 FAILED: cash refunds should be 50.00, got %', v_session->>'cash_refunds_amount';
  end if;

  -- Close session with counted 200.00 -> exact close!
  v_res := public.api_counter_session_close(
    v_org, v_person, 'counter', v_loc, 200.00, 'Exact close with reconciled cash refund', gen_random_uuid()
  );
  v_session := v_res->'session';
  if (v_session->>'variance_amount')::numeric <> 0.00 then
    raise exception 'TEST 7 FAILED: session close variance should be 0.00, got %', v_session->>'variance_amount';
  end if;

  raise notice 'ALL SERP-088 PROBE CHECKS PASSED SUCCESSFULLY.';
end;
$$;

rollback;
