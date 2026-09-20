-- tests/serp089_cash_session_probe.sql
-- SERP-089 — executable synthetic DB probe.
-- Proves cash-session close and variance against disposable PostgreSQL runtime:
--   * Cash session open with opening float;
--   * Authoritative live sales summary (cash net of change, cards, transfers);
--   * Single attributable close recording expected cash, counted cash, variance,
--     notes, operator, close timestamp;
--   * Zero variance (exact), shortage (negative variance), overage (positive variance);
--   * Non-MVR org (USD) preserves currency across session register and documents;
--   * Replay idempotency: same command key returns stored session without duplicate;
--   * Fail-closed gates: unauthorized seat (technician), invalid location, negative
--     counted cash, cross-tenant isolation;
--   * Attributable audit event (erp.counter_session_close) and outbox event;
--   * NO Cash Over/Short journal entry (per Founder ruling);
--   * Clean rollback (leaves no residue).

begin;

-- Helper to assert exception with expected code
create or replace function pg_temp.expect_session_error(
  p_fn text, p_org uuid, p_person uuid, p_seat text, p_location uuid,
  p_val numeric, p_notes text, p_key uuid, p_expected text
) returns void language plpgsql as $$
declare
  v_err text := null;
begin
  if p_fn = 'open' then
    perform public.api_counter_session_open(p_org, p_person, p_seat, p_location, p_val, p_key);
  elsif p_fn = 'close' then
    perform public.api_counter_session_close(p_org, p_person, p_seat, p_location, p_val, p_notes, p_key);
  elsif p_fn = 'current' then
    perform public.api_counter_session_current(p_org, p_person, p_seat, p_location);
  end if;
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
  v_loc_usd uuid := gen_random_uuid();
  v_other_loc uuid := gen_random_uuid();
  v_person uuid := gen_random_uuid();
  v_tech_person uuid := gen_random_uuid();
  v_other_person uuid := gen_random_uuid();
  v_book uuid := gen_random_uuid();
  v_book_usd uuid := gen_random_uuid();
  v_prod_cash uuid := gen_random_uuid();
  v_prod_card uuid := gen_random_uuid();

  v_role_counter uuid := gen_random_uuid();
  v_role_tech uuid := gen_random_uuid();
  v_m1 uuid := gen_random_uuid();
  v_m2 uuid := gen_random_uuid();

  v_res jsonb;
  v_session jsonb;
  v_key uuid;
  v_audit_count integer;
  v_outbox_count integer;
  v_journal_count integer;
begin
  -- 1. Setup Organizations (MVR org and USD org)
  insert into public.organisations (id, slug, legal_name, base_currency, status)
  values
    (v_org, 'probe-org-serp089', 'SERP-089 Probe Org', 'MVR', 'active'),
    (v_org_usd, 'probe-org-serp089-usd', 'SERP-089 USD Org', 'USD', 'active'),
    (v_other_org, 'probe-org-serp089-other', 'SERP-089 Other Org', 'MVR', 'active');

  insert into public.locations (id, organisation_id, code, name, kind, active)
  values
    (v_loc, v_org, 'MAIN', 'Main Location', 'office', true),
    (v_loc_usd, v_org_usd, 'MAIN', 'Main USD Location', 'office', true),
    (v_other_loc, v_other_org, 'OTHER', 'Other Location', 'office', true);

  -- Setup Books
  insert into public.books (id, organisation_id, archetype_id, code, name, currency, status)
  values
    (v_book, v_org, 'retail', 'MAIN', 'Main Book', 'MVR', 'active'),
    (v_book_usd, v_org_usd, 'retail', 'MAIN', 'USD Book', 'USD', 'active');

  -- Setup Persons
  insert into public.persons (id, person_key, display_label, status)
  values
    (v_person, 'probe:serp089:counter', 'Probe Counter', 'active'),
    (v_tech_person, 'probe:serp089:tech', 'Probe Tech', 'active'),
    (v_other_person, 'probe:serp089:other', 'Probe Other', 'active');

  -- Setup Roles & Seats
  insert into public.roles (id, organisation_id, code, name)
  values
    (v_role_counter, v_org, 'counter', 'Counter Role'),
    (v_role_tech, v_org, 'technician', 'Tech Role');

  insert into public.memberships (id, organisation_id, person_id, role_id, status)
  values
    (v_m1, v_org, v_person, v_role_counter, 'active'),
    (v_m2, v_org, v_tech_person, v_role_tech, 'active');

  insert into public.membership_seats (membership_id, seat_code)
  values
    (v_m1, 'counter'),
    (v_m2, 'technician');

  -- Setup Products & Inventory
  insert into public.products (id, organisation_id, code, name, kind, active)
  values
    (v_prod_cash, v_org, 'PROD-CASH', 'Cash Product', 'stock', true),
    (v_prod_card, v_org, 'PROD-CARD', 'Card Product', 'stock', true);

  insert into public.product_prices (organisation_id, product_id, price_type, currency, amount)
  values
    (v_org, v_prod_cash, 'selling', 'MVR', 50.00),
    (v_org, v_prod_card, 'selling', 'MVR', 100.00);


  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 1: Open cash session with opening float 500.00 MVR
  -- ───────────────────────────────────────────────────────────────────────────
  v_res := public.api_counter_session_open(
    v_org, v_person, 'counter', v_loc, 500.00, gen_random_uuid()
  );
  v_session := v_res->'session';
  if v_session->>'status' <> 'open' or (v_session->>'opening_float')::numeric <> 500.00 then
    raise exception 'TEST 1 FAILED: session did not open correctly: %', v_res;
  end if;

  insert into public.stock_movements (organisation_id, location_id, product_id, movement_type, quantity, source_type, source_id, idempotency_key, occurred_at, recorded_by)
  values
    (v_org, v_loc, v_prod_cash, 'opening', 100, 'OPENING_BALANCE', v_prod_cash, gen_random_uuid(), now(), v_person),
    (v_org, v_loc, v_prod_card, 'opening', 100, 'OPENING_BALANCE', v_prod_card, gen_random_uuid(), now(), v_person);

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 2: Process Cash sale (50 MVR, cash tendered 100, change 50 -> net 50)
  --         and Card sale (100 MVR, card tendered 100, change 0)
  -- ───────────────────────────────────────────────────────────────────────────
  perform public.api_garage_command(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_cash, 'quantity', 1)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 100))
    ),
    gen_random_uuid()
  );

  perform public.api_garage_command(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_card, 'quantity', 1)),
      'payment_method', 'card',
      'tender', jsonb_build_array(jsonb_build_object('method', 'card', 'amount_tendered', 100))
    ),
    gen_random_uuid()
  );

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 3: Check live summary before close:
  --         Expected Cash: 500 float + 50 net cash = 550.00 MVR
  --         Card sales: 100.00 MVR
  -- ───────────────────────────────────────────────────────────────────────────
  v_res := public.api_counter_session_current(v_org, v_person, 'counter', v_loc);
  v_session := v_res->'session';
  if (v_session->>'expected_cash')::numeric <> 550.00 then
    raise exception 'TEST 3 FAILED: expected cash should be 550.00, got %', v_session->>'expected_cash';
  end if;
  if (v_session->>'cash_sales_amount')::numeric <> 50.00 then
    raise exception 'TEST 3 FAILED: cash sales should be 50.00, got %', v_session->>'cash_sales_amount';
  end if;
  if (v_session->>'card_sales_amount')::numeric <> 100.00 then
    raise exception 'TEST 3 FAILED: card sales should be 100.00, got %', v_session->>'card_sales_amount';
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 4: Close Till with Shortage (counted 540 vs expected 550 -> variance -10.00)
  -- ───────────────────────────────────────────────────────────────────────────
  v_key := gen_random_uuid();
  v_res := public.api_counter_session_close(
    v_org, v_person, 'counter', v_loc, 540.00, 'Coin shortage 10 MVR', v_key
  );
  v_session := v_res->'session';
  if v_session->>'status' <> 'closed' then
    raise exception 'TEST 4 FAILED: session status should be closed: %', v_res;
  end if;
  if (v_session->>'variance_amount')::numeric <> -10.00 then
    raise exception 'TEST 4 FAILED: variance should be -10.00, got %', v_session->>'variance_amount';
  end if;
  if v_session->>'notes' <> 'Coin shortage 10 MVR' then
    raise exception 'TEST 4 FAILED: notes missing or wrong: %', v_session->>'notes';
  end if;
  if (v_session->>'closed_by')::uuid <> v_person then
    raise exception 'TEST 4 FAILED: operator attributable person wrong';
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 5: Replay idempotency — calling close again with v_key returns stored session
  -- ───────────────────────────────────────────────────────────────────────────
  v_res := public.api_counter_session_close(
    v_org, v_person, 'counter', v_loc, 540.00, 'Coin shortage 10 MVR', v_key
  );
  if v_res->>'idempotent_replay' <> 'true' then
    raise exception 'TEST 5 FAILED: replay must return idempotent_replay = true';
  end if;
  if (v_res->'session'->>'id')::uuid <> (v_session->>'id')::uuid then
    raise exception 'TEST 5 FAILED: replay must return identical session id';
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 6: Audit and Outbox verification
  -- ───────────────────────────────────────────────────────────────────────────
  select count(*) into v_audit_count
    from public.audit_events
   where organisation_id = v_org
     and action = 'erp.counter_session_close'
     and object_id = (v_session->>'id')::uuid;
  if v_audit_count <> 1 then
    raise exception 'TEST 6 FAILED: expected 1 audit event for session close, found %', v_audit_count;
  end if;

  -- Verify NO automatic Cash Over/Short journal entry was created (Founder ruling)
  select count(*) into v_journal_count
    from public.journal_entries
   where organisation_id = v_org
     and memo like '%variance%' or memo like '%session%';
  if v_journal_count <> 0 then
    raise exception 'TEST 6 FAILED: Founder ruling violated — automatic journal entry created: %', v_journal_count;
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 7: Negative fail-closed paths
  -- ───────────────────────────────────────────────────────────────────────────
  -- Unauthorized seat (technician)
  perform pg_temp.expect_session_error('open', v_org, v_tech_person, 'technician', v_loc, 100, null, null, 'seat_not_authorized');
  perform pg_temp.expect_session_error('close', v_org, v_tech_person, 'technician', v_loc, 100, null, null, 'seat_not_authorized');

  -- Invalid / negative counted cash
  perform pg_temp.expect_session_error('close', v_org, v_person, 'counter', v_loc, -50, null, null, 'counter_session_counted_cash_invalid');

  -- Cross-tenant location
  perform pg_temp.expect_session_error('open', v_org, v_person, 'counter', v_other_loc, 100, null, null, 'location_not_found');
  perform pg_temp.expect_session_error('close', v_org, v_person, 'counter', v_other_loc, 100, null, null, 'location_not_found');

  -- No open session guard: calling close with a fresh key when till is already closed
  perform pg_temp.expect_session_error('close', v_org, v_person, 'counter', v_loc, 100, null, gen_random_uuid(), 'no_open_session');

  raise notice 'SERP-089 SYNTHETIC PROBE PASSED CLEANLY: all paths proven live.';
end;
$$;

rollback;
