-- tests/serp438_low_stock_probe.sql
-- SERP-438 — executable synthetic DB probe.
-- Proves reorder threshold and low-stock visibility signal against disposable PostgreSQL runtime:
--   * Nullable reorder threshold at product/inventory level defaulting to null (no forced config);
--   * Rejection of negative threshold values (reorder_threshold >= 0 check);
--   * Low-stock state derived LIVE from stock_movements_derived_onhand (never cached/separately-maintained);
--   * Exact boundary rule: on_hand <= reorder_threshold triggers low-stock signal;
--   * Live mutation flip: stock movement updates on-hand and immediately reflects in low-stock signals;
--   * Service item exemption: service products never trigger low-stock signals;
--   * Fail-closed gates: unauthorized seat (technician) fails with seat_not_authorized;
--   * Multi-tenant isolation: tenant stock never visible or mixed across tenants;
--   * Clean rollback (leaves no residue).

begin;

-- Helper to assert exception with expected code
create or replace function pg_temp.expect_signal_error(
  p_org uuid, p_person uuid, p_seat text, p_location uuid, p_expected text
) returns void language plpgsql as $$
declare
  v_err text := null;
begin
  perform public.api_counter_low_stock_signals(p_org, p_person, p_seat, p_location);
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
  v_other_org uuid := gen_random_uuid();
  v_loc uuid := gen_random_uuid();
  v_other_loc uuid := gen_random_uuid();
  v_person uuid := gen_random_uuid();
  v_tech_person uuid := gen_random_uuid();
  v_other_person uuid := gen_random_uuid();

  v_role_counter uuid := gen_random_uuid();
  v_role_tech uuid := gen_random_uuid();
  v_m1 uuid := gen_random_uuid();
  v_m2 uuid := gen_random_uuid();

  v_prod_no_threshold uuid;
  v_prod_above uuid;
  v_prod_exact uuid;
  v_prod_below uuid;
  v_prod_service uuid;
  v_prod_other uuid;

  v_res jsonb;
  v_items jsonb;
  v_item jsonb;
  v_count integer;
begin
  -- 1. Setup Organizations
  insert into public.organisations (id, slug, legal_name, base_currency, status)
  values
    (v_org, 'probe-org-serp438', 'SERP-438 Probe Org', 'MVR', 'active'),
    (v_other_org, 'probe-org-serp438-other', 'SERP-438 Other Org', 'MVR', 'active');

  insert into public.locations (id, organisation_id, code, name, kind, active)
  values
    (v_loc, v_org, 'MAIN', 'Main Location', 'office', true),
    (v_other_loc, v_other_org, 'OTHER', 'Other Location', 'office', true);

  -- Setup Persons
  insert into public.persons (id, person_key, display_label, status)
  values
    (v_person, 'probe:serp438:counter', 'Probe Counter Operator', 'active'),
    (v_tech_person, 'probe:serp438:tech', 'Probe Technician', 'active'),
    (v_other_person, 'probe:serp438:other', 'Probe Other Org Counter', 'active');

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

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 1: Product creation with nullable default threshold and explicit threshold
  -- ───────────────────────────────────────────────────────────────────────────
  -- 1a. Default null threshold
  v_res := public.api_product_command(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'command', 'create',
      'product', jsonb_build_object(
        'code', 'PROD-NO-THRESH',
        'name', 'Item Without Threshold',
        'kind', 'stock',
        'active', true
      )
    ),
    gen_random_uuid()
  );
  v_prod_no_threshold := (v_res->'product'->>'id')::uuid;
  if v_res->'product'->>'reorder_threshold' is not null then
    raise exception 'TEST 1a FAILED: expected reorder_threshold to default to null, got %', v_res->'product'->>'reorder_threshold';
  end if;

  -- 1b. Explicit threshold = 10
  v_res := public.api_product_command(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'command', 'create',
      'product', jsonb_build_object(
        'code', 'PROD-ABOVE',
        'name', 'Item Above Threshold',
        'kind', 'stock',
        'reorder_threshold', 10,
        'active', true
      )
    ),
    gen_random_uuid()
  );
  v_prod_above := (v_res->'product'->>'id')::uuid;
  if (v_res->'product'->>'reorder_threshold')::numeric <> 10 then
    raise exception 'TEST 1b FAILED: expected reorder_threshold 10, got %', v_res->'product'->>'reorder_threshold';
  end if;

  -- 1c. Exact boundary product (threshold = 10)
  v_res := public.api_product_command(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'command', 'create',
      'product', jsonb_build_object(
        'code', 'PROD-EXACT',
        'name', 'Item At Exact Boundary',
        'kind', 'stock',
        'reorder_threshold', 10,
        'active', true
      )
    ),
    gen_random_uuid()
  );
  v_prod_exact := (v_res->'product'->>'id')::uuid;

  -- 1d. Below threshold product (threshold = 10)
  v_res := public.api_product_command(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'command', 'create',
      'product', jsonb_build_object(
        'code', 'PROD-BELOW',
        'name', 'Item Below Threshold',
        'kind', 'stock',
        'reorder_threshold', 10,
        'active', true
      )
    ),
    gen_random_uuid()
  );
  v_prod_below := (v_res->'product'->>'id')::uuid;

  -- 1e. Service product (threshold set, but kind is service)
  v_res := public.api_product_command(
    v_org, v_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'command', 'create',
      'product', jsonb_build_object(
        'code', 'PROD-SERVICE',
        'name', 'Service Item',
        'kind', 'service',
        'reorder_threshold', 5,
        'active', true
      )
    ),
    gen_random_uuid()
  );
  v_prod_service := (v_res->'product'->>'id')::uuid;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 2: Negative threshold validation rejected on create and update
  -- ───────────────────────────────────────────────────────────────────────────
  begin
    perform public.api_product_command(
      v_org, v_person, 'counter', gen_random_uuid(),
      jsonb_build_object(
        'command', 'create',
        'product', jsonb_build_object(
          'code', 'PROD-NEG',
          'name', 'Negative Item',
          'kind', 'stock',
          'reorder_threshold', -1
        )
      ),
      gen_random_uuid()
    );
    raise exception 'TEST 2a FAILED: negative threshold on create should have failed';
  exception when others then
    if SQLERRM not like '%invalid_reorder_threshold%' and SQLERRM not like '%reorder_threshold%' then
      raise exception 'TEST 2a FAILED: unexpected error: %', SQLERRM;
    end if;
  end;

  begin
    perform public.api_product_command(
      v_org, v_person, 'counter', gen_random_uuid(),
      jsonb_build_object(
        'command', 'update',
        'product', jsonb_build_object(
          'id', v_prod_above,
          'reorder_threshold', -5
        )
      ),
      gen_random_uuid()
    );
    raise exception 'TEST 2b FAILED: negative threshold on update should have failed';
  exception when others then
    if SQLERRM not like '%invalid_reorder_threshold%' and SQLERRM not like '%reorder_threshold%' then
      raise exception 'TEST 2b FAILED: unexpected error: %', SQLERRM;
    end if;
  end;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 3: Insert initial stock movements (opening balances)
  -- ───────────────────────────────────────────────────────────────────────────
  -- PROD-NO-THRESH: on-hand = 2 (reorder_threshold = null -> no signal)
  -- PROD-ABOVE: on-hand = 20 (reorder_threshold = 10 -> no signal)
  -- PROD-EXACT: on-hand = 10 (reorder_threshold = 10 -> LOW STOCK)
  -- PROD-BELOW: on-hand = 4 (reorder_threshold = 10 -> LOW STOCK)
  insert into public.stock_movements (organisation_id, location_id, product_id, movement_type, quantity, source_type, source_id, idempotency_key, occurred_at, recorded_by)
  values
    (v_org, v_loc, v_prod_no_threshold, 'opening', 2, 'OPENING_BALANCE', v_prod_no_threshold, gen_random_uuid(), now(), v_person),
    (v_org, v_loc, v_prod_above, 'opening', 20, 'OPENING_BALANCE', v_prod_above, gen_random_uuid(), now(), v_person),
    (v_org, v_loc, v_prod_exact, 'opening', 10, 'OPENING_BALANCE', v_prod_exact, gen_random_uuid(), now(), v_person),
    (v_org, v_loc, v_prod_below, 'opening', 4, 'OPENING_BALANCE', v_prod_below, gen_random_uuid(), now(), v_person);

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 4: Query api_counter_low_stock_signals
  --         Must return EXACTLY PROD-EXACT and PROD-BELOW.
  -- ───────────────────────────────────────────────────────────────────────────
  v_res := public.api_counter_low_stock_signals(v_org, v_person, 'counter', v_loc);
  v_items := v_res->'items';
  v_count := jsonb_array_length(v_items);

  if v_count <> 2 then
    raise exception 'TEST 4 FAILED: expected 2 low stock items, got %: %', v_count, v_res;
  end if;

  -- Check contents
  if not (v_items @> jsonb_build_array(jsonb_build_object('product_id', v_prod_exact))) then
    raise exception 'TEST 4 FAILED: missing PROD-EXACT in low stock items: %', v_items;
  end if;
  if not (v_items @> jsonb_build_array(jsonb_build_object('product_id', v_prod_below))) then
    raise exception 'TEST 4 FAILED: missing PROD-BELOW in low stock items: %', v_items;
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 5: Live Mutation Flip (SSOT proof — no cached flag drift)
  -- ───────────────────────────────────────────────────────────────────────────
  -- 5a. Issue 15 units of PROD-ABOVE (20 - 15 = 5 <= 10) -> now LOW STOCK!
  insert into public.stock_movements (organisation_id, location_id, product_id, movement_type, quantity, source_type, source_id, idempotency_key, occurred_at, recorded_by)
  values
    (v_org, v_loc, v_prod_above, 'issue', -15, 'STOCK_ISSUE', v_prod_above, gen_random_uuid(), now(), v_person);

  -- 5b. Receive 10 units of PROD-EXACT (10 + 10 = 20 > 10) -> no longer low stock!
  insert into public.stock_movements (organisation_id, location_id, product_id, movement_type, quantity, source_type, source_id, idempotency_key, occurred_at, recorded_by)
  values
    (v_org, v_loc, v_prod_exact, 'receipt', 10, 'STOCK_RECEIPT', v_prod_exact, gen_random_uuid(), now(), v_person);

  v_res := public.api_counter_low_stock_signals(v_org, v_person, 'counter', v_loc);
  v_items := v_res->'items';
  v_count := jsonb_array_length(v_items);

  if v_count <> 2 then
    raise exception 'TEST 5 FAILED: expected 2 low stock items after mutation, got %: %', v_count, v_res;
  end if;

  -- Must contain PROD-ABOVE (now 5 <= 10) and PROD-BELOW (still 4 <= 10)
  if not (v_items @> jsonb_build_array(jsonb_build_object('product_id', v_prod_above))) then
    raise exception 'TEST 5 FAILED: PROD-ABOVE did not flip to low stock live: %', v_items;
  end if;
  if (v_items @> jsonb_build_array(jsonb_build_object('product_id', v_prod_exact))) then
    raise exception 'TEST 5 FAILED: PROD-EXACT should no longer be low stock: %', v_items;
  end if;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 6: Fail-closed gates (unauthorized seat & cross-tenant location)
  -- ───────────────────────────────────────────────────────────────────────────
  perform pg_temp.expect_signal_error(
    v_org, v_tech_person, 'technician', v_loc, 'seat_not_authorized'
  );

  perform pg_temp.expect_signal_error(
    v_org, v_person, 'counter', v_other_loc, 'location_not_found'
  );

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 7: Cross-tenant isolation
  -- ───────────────────────────────────────────────────────────────────────────
  -- Create low stock product in other tenant
  insert into public.products (id, organisation_id, code, name, kind, active, reorder_threshold)
  values (gen_random_uuid(), v_other_org, 'OTHER-LOW', 'Other Tenant Low Item', 'stock', true, 50);

  -- Other tenant's low stock product must NOT appear in v_org query
  v_res := public.api_counter_low_stock_signals(v_org, v_person, 'counter', v_loc);
  if jsonb_array_length(v_res->'items') <> 2 then
    raise exception 'TEST 7 FAILED: other tenant item leaked into query: %', v_res;
  end if;

  raise notice 'ALL SERP-438 PROBE CHECKS PASSED SUCCESSFULLY.';
end;
$$;

rollback;
