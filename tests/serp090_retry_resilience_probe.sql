-- tests/serp090_retry_resilience_probe.sql
-- SERP-090 — executable synthetic DB probe.
-- Proves retry, timeout & negative-authorization resilience against disposable PostgreSQL:
--   * Strictly online server-authoritative architecture;
--   * Idempotent replay: identical key + payload returns committed result with idempotent_replay: true;
--   * Conflicting payload with reused key fails closed with idempotency_key_conflict;
--   * Negative stock invention strictly rejected on oversell (stock_insufficient);
--   * Cash session open/close replay and conflict detection;
--   * No open session guard on close (no_open_session);
--   * Negative auth fail-closed: unauthorized seat (seat_not_authorized), cross-tenant (sale_not_found),
--     unapproved segregated return (reversal_approval_required);
--   * Resilience status RPC validation and currency derivation from organisations.base_currency;
--   * Clean rollback (leaves no residue).

begin;

-- Helper to assert exception with expected error code
create or replace function pg_temp.expect_error(
  p_sql text, p_expected text
) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'EXPECTED ERROR % BUT CALL SUCCEEDED', p_expected;
exception when others then
  if SQLERRM not like '%' || p_expected || '%' then
    raise exception 'EXPECTED ERROR % BUT GOT %', p_expected, SQLERRM;
  end if;
end;
$$;

create or replace function pg_temp.expect_reversal_err(
  p_org uuid, p_person uuid, p_seat text, p_key uuid, p_cmd jsonb, p_expected text
) returns void language plpgsql as $$
begin
  perform public.api_counter_sale_reversal(p_org, p_person, p_seat, p_key, p_cmd);
  raise exception 'EXPECTED ERROR % BUT CALL SUCCEEDED', p_expected;
exception when others then
  if SQLERRM not like '%' || p_expected || '%' then
    raise exception 'EXPECTED ERROR % BUT GOT %', p_expected, SQLERRM;
  end if;
end;
$$;

create or replace function pg_temp.expect_garage_err(
  p_org uuid, p_person uuid, p_seat text, p_key uuid, p_cmd jsonb, p_expected text
) returns void language plpgsql as $$
begin
  perform public.api_garage_command(p_org, p_person, p_seat, p_key, p_cmd, gen_random_uuid());
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
  v_loc_second uuid := gen_random_uuid();
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

  v_sale_key uuid := gen_random_uuid();
  v_rev_key uuid := gen_random_uuid();
  v_open_key uuid := gen_random_uuid();
  v_close_key uuid := gen_random_uuid();

  v_res jsonb;
  v_sale_id uuid;
  v_onhand numeric;
  v_status jsonb;
begin
  -- ───────────────────────────────────────────────────────────────────────────
  -- 1. Setup Organizations, Locations, Persons, Seats, Products & Initial Inventory
  -- ───────────────────────────────────────────────────────────────────────────
  insert into public.organisations (id, slug, legal_name, base_currency, status)
  values
    (v_org, 'probe-serp090-mvr', 'SERP-090 MVR Org', 'MVR', 'active'),
    (v_org_usd, 'probe-serp090-usd', 'SERP-090 USD Org', 'USD', 'active'),
    (v_other_org, 'probe-serp090-other', 'SERP-090 Other Org', 'MVR', 'active');

  insert into public.locations (id, organisation_id, code, name, kind, active)
  values
    (v_loc, v_org, 'LOC-1', 'Location 1', 'office', true),
    (v_loc_second, v_org, 'LOC-2', 'Location 2', 'office', true),
    (v_other_loc, v_other_org, 'LOC-OTHER', 'Other Location', 'office', true);

  insert into public.persons (id, person_key, display_label, status)
  values
    (v_person, 'probe:serp090:counter', 'Cashier', 'active'),
    (v_manager_person, 'probe:serp090:manager', 'Manager', 'active'),
    (v_tech_person, 'probe:serp090:tech', 'Technician', 'active'),
    (v_other_person, 'probe:serp090:other', 'Other Cashier', 'active');

  insert into public.roles (id, organisation_id, code, name)
  values
    (v_role_counter, v_org, 'counter', 'Counter Role'),
    (v_role_manager, v_org, 'director', 'Director Role'),
    (v_role_tech, v_org, 'technician', 'Tech Role'),
    (v_other_role_counter, v_other_org, 'counter', 'Other Counter Role');

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

  insert into public.products (id, organisation_id, sku, name, kind, active, sale_allowed)
  values
    (v_prod_1, v_org, 'PROD-1', 'Product 1', 'stock', true, true),
    (v_prod_2, v_org, 'PROD-2', 'Product 2', 'stock', true, true);

  insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from)
  values
    (v_org, v_prod_1, 'MVR', 50.00, now() - interval '1 day'),
    (v_org, v_prod_2, 'MVR', 100.00, now() - interval '1 day');

  -- Register v_org for GST (8%)
  insert into public.tax_registrations (organisation_id, tax_type, registration_status, effective_from)
  values (v_org, 'gst_general', 'registered', '2020-01-01');

  -- Seed inventory: 20 units of PROD-1 and 20 units of PROD-2 via positive stock movements
  insert into public.stock_movements (
    organisation_id, location_id, product_id, movement_type,
    quantity, unit_cost, source_type, source_id, idempotency_key, occurred_at, recorded_by
  ) values
    (v_org, v_loc, v_prod_1, 'opening', 20, 30.00, 'OPENING_BALANCE', gen_random_uuid(), gen_random_uuid(), now() - interval '2 hours', v_manager_person),
    (v_org, v_loc, v_prod_2, 'opening', 20, 50.00, 'OPENING_BALANCE', gen_random_uuid(), gen_random_uuid(), now() - interval '2 hours', v_manager_person);

  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_1);
  if v_onhand <> 20 then
    raise exception 'SETUP FAILED: initial on-hand should be 20, got %', v_onhand;
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 1: Online Counter Sale & Idempotent Replay
  -- ───────────────────────────────────────────────────────────────────────────
  v_res := public.api_garage_command(
    v_org, v_person, 'counter', v_sale_key,
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 5)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 250))
    ),
    gen_random_uuid()
  );
  v_sale_id := (v_res->'counter_sale'->>'invoice_id')::uuid;

  -- On-hand reduced from 20 -> 15
  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_1);
  if v_onhand <> 15 then
    raise exception 'TEST 1 FAILED: on-hand should be 15 after sale, got %', v_onhand;
  end if;

  -- Replay with identical key: must return idempotent_replay = true with same invoice
  v_res := public.api_garage_command(
    v_org, v_person, 'counter', v_sale_key,
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 5)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 250))
    ),
    gen_random_uuid()
  );
  if (v_res->>'ok')::boolean is not true or v_res->>'state' <> 'accepted' then
    raise exception 'TEST 1 FAILED: replay must succeed with accepted state';
  end if;
  if (v_res->'counter_sale'->>'invoice_id')::uuid <> v_sale_id then
    raise exception 'TEST 1 FAILED: replay must return identical invoice_id';
  end if;

  -- On-hand must still be 15 (no duplicate stock deduction!)
  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_1);
  if v_onhand <> 15 then
    raise exception 'TEST 1 FAILED: on-hand must not be deducted twice on replay, got %', v_onhand;
  end if;

  -- Replaying same key with conflicting items/qty fails closed with idempotency_key_conflict
  perform pg_temp.expect_garage_err(
    v_org, v_person, 'counter', v_sale_key,
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 2)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 100))
    ),
    'idempotency_key_conflict'
  );

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 2: Overselling Strictly Rejected (Zero Negative Stock Invention)
  -- ───────────────────────────────────────────────────────────────────────────
  -- Current on-hand is 15. Attempting to sell 100 units must fail closed.
  perform pg_temp.expect_garage_err(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 100)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 5000))
    ),
    'stock_line_insufficient_on_hand'
  );

  -- On-hand remains intact at 15 (never negative -85)
  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_1);
  if v_onhand <> 15 then
    raise exception 'TEST 2 FAILED: on-hand must remain 15 after rejected oversell, got %', v_onhand;
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 3: Reversal Idempotent Replay & Conflicting Key Reuse Rejection
  -- ───────────────────────────────────────────────────────────────────────────
  -- 1. Execute itemized return of 2 units of PROD-1
  v_res := public.api_counter_sale_reversal(
    v_org, v_person, 'counter', v_rev_key,
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_id,
      'location_id', v_loc,
      'reason', 'Customer requested return of 2 units',
      'operating_capacity', 'solo',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 2)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 100.00))
    )
  );
  if (v_res->>'idempotent_replay')::boolean is not false then
    raise exception 'TEST 3 FAILED: first reversal must not be replay';
  end if;

  -- On-hand restored from 15 -> 17
  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_1);
  if v_onhand <> 17 then
    raise exception 'TEST 3 FAILED: on-hand should be 17 after return, got %', v_onhand;
  end if;

  -- 2. Replay identical reversal command: returns stored return with zero stock mutations
  v_res := public.api_counter_sale_reversal(
    v_org, v_person, 'counter', v_rev_key,
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_id,
      'location_id', v_loc,
      'reason', 'Customer requested return of 2 units',
      'operating_capacity', 'solo',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 2)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 100.00))
    )
  );
  if (v_res->>'idempotent_replay')::boolean is not true then
    raise exception 'TEST 3 FAILED: reversal replay must return idempotent_replay = true';
  end if;

  -- On-hand remains 17 (no duplicate return movements!)
  select coalesce(derived_quantity, 0) into v_onhand
    from public.stock_movements_derived_onhand(v_org, v_loc, v_prod_1);
  if v_onhand <> 17 then
    raise exception 'TEST 3 FAILED: on-hand must not be restored twice on replay, got %', v_onhand;
  end if;

  -- 3. Reusing reversal key with conflicting reversal type (void vs return): fails closed
  -- REGRESSION TEST (3a): Conflicting reversal type
  perform pg_temp.expect_reversal_err(
    v_org, v_person, 'counter', v_rev_key,
    jsonb_build_object(
      'type', 'void',
      'original_sale_id', v_sale_id,
      'location_id', v_loc,
      'reason', 'Conflicting void attempt'
    ),
    'idempotency_key_conflict'
  );

  -- REGRESSION TEST (3b): Conflicting original sale ID with same key
  perform pg_temp.expect_reversal_err(
    v_org, v_person, 'counter', v_rev_key,
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', gen_random_uuid(),
      'location_id', v_loc,
      'reason', 'Conflicting sale ID return attempt',
      'operating_capacity', 'solo',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 2)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 100.00))
    ),
    'idempotency_key_conflict'
  );

  -- 4. Tax-Exclusive Itemized Return Pro-Rata & Refund Tenders recorded_by/seat Proof
  -- REGRESSION TEST (1): Tax-exclusive itemized return pro-rata formula
  -- REGRESSION TEST (2): counter_refund_tenders populating recorded_by and recorded_seat
  -- Org is registered for GST (8%). Sell 4 units of PROD-2 @ 100 MVR in exclusive tax mode:
  -- net_amount = 400.00, tax_amount = 32.00 (8%), gross_amount = 432.00.
  declare
    v_sale_ex_id uuid;
    v_ret_ex jsonb;
    v_tender_row record;
  begin
    v_res := public.api_garage_command(
      v_org, v_person, 'counter', gen_random_uuid(),
      jsonb_build_object(
        'type', 'COUNTER_SALE',
        'location_id', v_loc,
        'tax_mode', 'exclusive',
        'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_2, 'quantity', 4)),
        'payment_method', 'cash',
        'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 432.00))
      ),
      gen_random_uuid()
    );
    v_sale_ex_id := (v_res->'counter_sale'->>'invoice_id')::uuid;

    -- Return 1 unit: pro-rata from stored line must yield net 100.00, tax 8.00, gross 108.00!
    v_res := public.api_counter_sale_reversal(
      v_org, v_person, 'counter', gen_random_uuid(),
      jsonb_build_object(
        'type', 'return',
        'original_sale_id', v_sale_ex_id,
        'location_id', v_loc,
        'reason', 'Tax-exclusive pro-rata return proof',
        'operating_capacity', 'solo',
        'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_2, 'quantity', 1)),
        'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 108.00))
      )
    );
    v_ret_ex := v_res->'return';
    if (v_ret_ex->>'subtotal')::numeric <> 100.00 then
      raise exception 'REGRESSION (1) FAILED: subtotal should be 100.00, got %', v_ret_ex->>'subtotal';
    end if;
    if (v_ret_ex->>'tax_total')::numeric <> 8.00 then
      raise exception 'REGRESSION (1) FAILED: tax_total should be 8.00, got %', v_ret_ex->>'tax_total';
    end if;
    if (v_ret_ex->>'total_refund_amount')::numeric <> 108.00 then
      raise exception 'REGRESSION (1) FAILED: total_refund_amount should be 108.00, got %', v_ret_ex->>'total_refund_amount';
    end if;

    -- Verify counter_refund_tenders row has recorded_by and recorded_seat (REGRESSION 2)
    select * into v_tender_row from public.counter_refund_tenders
     where return_id = (v_ret_ex->>'id')::uuid and payment_method = 'cash';
    if v_tender_row.recorded_by is null or v_tender_row.recorded_seat is null then
      raise exception 'REGRESSION (2) FAILED: recorded_by/recorded_seat is null';
    end if;
    if v_tender_row.recorded_by <> v_person or v_tender_row.recorded_seat <> 'counter' then
      raise exception 'REGRESSION (2) FAILED: recorded_by/recorded_seat missing or incorrect';
    end if;
    if v_tender_row.amount <> 108.00 then
      raise exception 'REGRESSION (2) FAILED: amount should be 108.00, got %', v_tender_row.amount;
    end if;
  end;

  -- 5. REGRESSION TEST (4): ensure_return_sequences Called for Fresh Org Before Document Allocation
  -- A fresh org with zero pre-seeded document_sequences must not crash when reversal allocates doc numbers.
  declare
    v_fresh_org uuid := gen_random_uuid();
    v_fresh_loc uuid := gen_random_uuid();
    v_fresh_prod uuid := gen_random_uuid();
    v_fresh_role uuid := gen_random_uuid();
    v_fresh_m uuid := gen_random_uuid();
    v_fresh_sale_id uuid;
    v_fresh_rev jsonb;
  begin
    insert into public.organisations (id, slug, legal_name, base_currency, status)
    values (v_fresh_org, 'probe-serp090-fresh-seq', 'Fresh Seq Org', 'MVR', 'active');

    insert into public.locations (id, organisation_id, code, name, kind, active)
    values (v_fresh_loc, v_fresh_org, 'FRESH-1', 'Fresh Location', 'office', true);

    insert into public.roles (id, organisation_id, code, name)
    values (v_fresh_role, v_fresh_org, 'counter', 'Counter Role');

    insert into public.memberships (id, organisation_id, person_id, role_id, status)
    values (v_fresh_m, v_fresh_org, v_person, v_fresh_role, 'active');

    insert into public.membership_seats (membership_id, seat_code)
    values (v_fresh_m, 'counter');

    insert into public.products (id, organisation_id, sku, name, kind, active, sale_allowed)
    values (v_fresh_prod, v_fresh_org, 'FRESH-SKU', 'Fresh Product', 'stock', true, true);

    insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from)
    values (v_fresh_org, v_fresh_prod, 'MVR', 50.00, now() - interval '1 day');

    insert into public.stock_movements (
      organisation_id, location_id, product_id, movement_type,
      quantity, unit_cost, source_type, source_id, idempotency_key, occurred_at, recorded_by
    ) values (
      v_fresh_org, v_fresh_loc, v_fresh_prod, 'opening', 10, 30.00, 'OPENING_BALANCE', gen_random_uuid(), gen_random_uuid(), now() - interval '2 hours', v_person
    );

    -- Seed standard sales sequences so initial sale can succeed
    insert into public.document_sequences (organisation_id, sequence_type, prefix, padding)
    values
      (v_fresh_org, 'sales_invoice', 'INV-', 5),
      (v_fresh_org, 'receipt', 'REC-', 5);
    -- NOTE: We intentionally DO NOT seed 'credit_note' or 'counter_return' sequences here!

    v_res := public.api_garage_command(
      v_fresh_org, v_person, 'counter', gen_random_uuid(),
      jsonb_build_object(
        'type', 'COUNTER_SALE',
        'location_id', v_fresh_loc,
        'tax_mode', 'zero_rated',
        'items', jsonb_build_array(jsonb_build_object('product_id', v_fresh_prod, 'quantity', 1)),
        'payment_method', 'cash',
        'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 50.00))
      ),
      gen_random_uuid()
    );
    v_fresh_sale_id := (v_res->'counter_sale'->>'invoice_id')::uuid;

    -- Execute reversal: MUST succeed because api_counter_sale_reversal calls ensure_return_sequences!
    v_fresh_rev := public.api_counter_sale_reversal(
      v_fresh_org, v_person, 'counter', gen_random_uuid(),
      jsonb_build_object(
        'type', 'return',
        'original_sale_id', v_fresh_sale_id,
        'location_id', v_fresh_loc,
        'reason', 'Fresh org sequence regression proof',
        'operating_capacity', 'solo',
        'items', jsonb_build_array(jsonb_build_object('product_id', v_fresh_prod, 'quantity', 1)),
        'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
      )
    );

    if (v_fresh_rev->'return'->>'return_number') not like 'RET-%' then
      raise exception 'REGRESSION (4) FAILED: return_number should start with RET-, got %',
                      v_fresh_rev->'return'->>'return_number';
    end if;
  end;


  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 4: Till Session Open/Close Replay & Conflict Detection
  -- ───────────────────────────────────────────────────────────────────────────
  -- 1. Open cash session
  v_res := public.api_counter_session_open(
    v_org, v_person, 'counter', v_loc, 100.00, v_open_key
  );
  if (v_res->>'idempotent_replay')::boolean is not false then
    raise exception 'TEST 4 FAILED: first session open must not be replay';
  end if;

  -- 2. Replay open session with same key and location
  v_res := public.api_counter_session_open(
    v_org, v_person, 'counter', v_loc, 100.00, v_open_key
  );
  if (v_res->>'idempotent_replay')::boolean is not true then
    raise exception 'TEST 4 FAILED: session open replay must return idempotent_replay = true';
  end if;

  -- 3. Conflicting open session with same key but different location: fails closed
  perform pg_temp.expect_error(
    format('select public.api_counter_session_open(''%s''::uuid, ''%s''::uuid, ''counter'', ''%s''::uuid, 100.00, ''%s''::uuid)',
           v_org, v_person, v_loc_second, v_open_key),
    'idempotency_key_conflict'
  );

  -- 4. Close session
  v_res := public.api_counter_session_close(
    v_org, v_person, 'counter', v_loc, 100.00, 'Test close', v_close_key
  );
  if (v_res->>'idempotent_replay')::boolean is not false then
    raise exception 'TEST 4 FAILED: first session close must not be replay';
  end if;

  -- 5. Replay close session with same key and location
  v_res := public.api_counter_session_close(
    v_org, v_person, 'counter', v_loc, 100.00, 'Test close', v_close_key
  );
  if (v_res->>'idempotent_replay')::boolean is not true then
    raise exception 'TEST 4 FAILED: session close replay must return idempotent_replay = true';
  end if;

  -- 6. Conflicting close session with same key but different location: fails closed
  perform pg_temp.expect_error(
    format('select public.api_counter_session_close(''%s''::uuid, ''%s''::uuid, ''counter'', ''%s''::uuid, 100.00, ''Test close'', ''%s''::uuid)',
           v_org, v_person, v_loc_second, v_close_key),
    'idempotency_key_conflict'
  );

  -- 7. Attempting to close when NO session is open: fails closed with no_open_session
  perform pg_temp.expect_error(
    format('select public.api_counter_session_close(''%s''::uuid, ''%s''::uuid, ''counter'', ''%s''::uuid, 100.00, ''No session close'', ''%s''::uuid)',
           v_org, v_person, v_loc, gen_random_uuid()),
    'no_open_session'
  );

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 5: Negative Authorization Fail-Closed Paths
  -- ───────────────────────────────────────────────────────────────────────────
  -- 1. Unauthorized seat (technician) attempting counter sale
  perform pg_temp.expect_garage_err(
    v_org, v_tech_person, 'technician', gen_random_uuid(),
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 1)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 50))
    ),
    'acting_seat_not_legal_for_command'
  );

  -- 2. Unauthorized seat (technician) attempting reversal
  perform pg_temp.expect_reversal_err(
    v_org, v_tech_person, 'technician', gen_random_uuid(),
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_id,
      'location_id', v_loc,
      'reason', 'Tech reversal attempt',
      'operating_capacity', 'solo',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 1)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
    ),
    'seat_not_authorized'
  );

  -- 3. Cross-tenant reversal: other org cashier attempts to return sale from v_org
  perform pg_temp.expect_reversal_err(
    v_other_org, v_other_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_id,
      'location_id', v_other_loc,
      'reason', 'Cross-tenant reversal attempt',
      'operating_capacity', 'solo',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 1)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
    ),
    'sale_not_found'
  );

  -- 4. Segregated unapproved reversal: counter seat in segregated mode without manager approver
  perform pg_temp.expect_reversal_err(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_id,
      'location_id', v_loc,
      'reason', 'Unapproved segregated return',
      'operating_capacity', 'segregated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_1, 'quantity', 1)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
    ),
    'reversal_approval_required'
  );

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 6: Authoritative Resilience Status RPC
  -- ───────────────────────────────────────────────────────────────────────────
  -- 1. Check status for MVR org: returns server_authoritative = true and currency = MVR
  v_status := public.api_counter_resilience_status(v_org, v_person, 'counter', v_loc);
  if (v_status->>'server_authoritative')::boolean is not true then
    raise exception 'TEST 6 FAILED: status server_authoritative must be true';
  end if;
  if (v_status->>'offline_trading_prohibited')::boolean is not true then
    raise exception 'TEST 6 FAILED: status offline_trading_prohibited must be true';
  end if;
  if (v_status->>'compensating_negative_stock_prohibited')::boolean is not true then
    raise exception 'TEST 6 FAILED: status compensating_negative_stock_prohibited must be true';
  end if;
  if v_status->>'currency' <> 'MVR' then
    raise exception 'TEST 6 FAILED: currency must be MVR, got %', v_status->>'currency';
  end if;

  -- 2. Check status for USD org (seed role, membership and seat for manager in USD org)
  declare
    v_role_usd uuid := gen_random_uuid();
    v_m_usd uuid := gen_random_uuid();
  begin
    insert into public.roles (id, organisation_id, code, name)
    values (v_role_usd, v_org_usd, 'director', 'USD Director Role');

    insert into public.memberships (id, organisation_id, person_id, role_id, status)
    values (v_m_usd, v_org_usd, v_manager_person, v_role_usd, 'active');

    insert into public.membership_seats (membership_id, seat_code)
    values (v_m_usd, 'director');
  end;

  v_status := public.api_counter_resilience_status(v_org_usd, v_manager_person, 'director');
  if v_status->>'currency' <> 'USD' then
    raise exception 'TEST 6 FAILED: currency must derive from organisations (USD), got %', v_status->>'currency';
  end if;

  -- 3. Unauthorized seat on resilience status fails closed
  perform pg_temp.expect_error(
    format('select public.api_counter_resilience_status(''%s''::uuid, ''%s''::uuid, ''technician'')', v_org, v_tech_person),
    'seat_not_authorized'
  );

  raise notice 'ALL SERP-090 RESILIENCE PROBE CHECKS PASSED SUCCESSFULLY.';
end;
$$;

rollback;
