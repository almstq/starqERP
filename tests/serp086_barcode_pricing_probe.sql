-- tests/serp086_barcode_pricing_probe.sql
-- SERP-086 — executable synthetic DB probe (OpenCode lane).
-- Proves barcode identity + approved-price resolution against a disposable
-- PostgreSQL runtime:
--   * barcode is first-class (create/update/read round-trips, per-org unique,
--     grammar checks, cross-tenant duplicate allowed);
--   * single-item resolution matches COUNTER_SALE order: override -> base
--     product_prices within its valid window (stale rows excluded, newest
--     valid_from wins) -> list discount -> GST;
--   * no-price and unknown-bound-list paths fail closed (distinguishable);
--   * tenant isolation, seat authorization and identifier rules fail closed;
--   * read RPCs are replay-safe (identical repeats, no writes);
--   * bulk approved-prices aperture is tenant-scoped and seat-scoped.
begin;

create or replace function pg_temp.expect_resolve_error(
  p_org uuid, p_person uuid, p_seat text, p_barcode text, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_counter_price_resolution(p_org, p_person, p_seat, null, p_barcode, null, 'exclusive');
  raise exception 'expected % but resolution succeeded: %', p_expected, ignored;
exception
  when others then
    if sqlerrm <> p_expected then
      raise exception 'expected %, got %', p_expected, sqlerrm;
    end if;
end
$$;

create or replace function pg_temp.expect_resolve_error_pid(
  p_org uuid, p_person uuid, p_seat text, p_product_id uuid, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_counter_price_resolution(p_org, p_person, p_seat, p_product_id, null, null, 'exclusive');
  raise exception 'expected % but resolution succeeded: %', p_expected, ignored;
exception
  when others then
    if sqlerrm <> p_expected then
      raise exception 'expected %, got %', p_expected, sqlerrm;
    end if;
end
$$;

create or replace function pg_temp.expect_product_error(
  p_org uuid, p_person uuid, p_seat text, p_command jsonb, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_product_command(
    p_org, p_person, p_seat, gen_random_uuid(), p_command, gen_random_uuid()
  );
  raise exception 'expected % but product command succeeded: %', p_expected, ignored;
exception
  when others then
    if sqlerrm <> p_expected then
      raise exception 'expected %, got %', p_expected, sqlerrm;
    end if;
end
$$;

create or replace function pg_temp.expect_prices_error(
  p_org uuid, p_person uuid, p_seat text, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_counter_approved_prices(p_org, p_person, p_seat, null);
  raise exception 'expected % but approved-prices read succeeded: %', p_expected, ignored;
exception
  when others then
    if sqlerrm <> p_expected then
      raise exception 'expected %, got %', p_expected, sqlerrm;
    end if;
end
$$;

create or replace function pg_temp.expect_price_list_error(
  p_org uuid, p_person uuid, p_seat text, p_command jsonb, p_expected text
) returns void language plpgsql as $$
declare
  ignored jsonb;
begin
  ignored := public.api_price_list_command(
    p_org, p_person, p_seat, gen_random_uuid(), p_command, gen_random_uuid()
  );
  raise exception 'expected % but price-list command succeeded: %', p_expected, ignored;
exception
  when others then
    if sqlerrm <> p_expected then
      raise exception 'expected %, got %', p_expected, sqlerrm;
    end if;
end
$$;

-- ───────────────────────── 1. Barcode identity + base resolution ──────────────
do $$
declare
  org_one uuid := '20000000-0000-4000-8000-000000000001';
  org_two uuid := '10000000-0000-4000-8000-000000000001';
  admin_person uuid := '00000000-0000-4000-8000-000000000901';
  counter_person uuid := '00000000-0000-4000-8000-000000000902';
  other_admin uuid := '00000000-0000-4000-8000-000000000903';
  admin_member uuid := '00000000-0000-4000-8000-000000000911';
  counter_member uuid := '00000000-0000-4000-8000-000000000912';
  other_member uuid := '00000000-0000-4000-8000-000000000913';
  product_a uuid;
  product_b uuid;
  barcode_dup uuid;
  list_id uuid;
  row jsonb;
begin
  if has_function_privilege('anon', 'app_private.seed_default_organisation_price_lists(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'app_private.seed_default_organisation_price_lists(uuid)', 'EXECUTE') then
    raise exception 'provisioning seed helper remains client-callable';
  end if;

  insert into public.persons (id, person_key, external_subject, display_label, status)
  values
    (admin_person, '__serp086_admin__', '__serp086_admin__', 'SERP-086 admin', 'active'),
    (counter_person, '__serp086_counter__', '__serp086_counter__', 'SERP-086 counter', 'active'),
    (other_admin, '__serp086_other_admin__', '__serp086_other_admin__', 'SERP-086 other tenant admin', 'active');

  insert into public.memberships (id, organisation_id, person_id, status)
  values
    (admin_member, org_one, admin_person, 'active'),
    (counter_member, org_one, counter_person, 'active'),
    (other_member, org_two, other_admin, 'active');

  insert into public.membership_seats (membership_id, seat_code)
  values
    (admin_member, 'owner'),
    (counter_member, 'counter'),
    (other_member, 'owner');

  -- Create two products WITH barcodes; the round-trip must persist them.
  row := (public.api_product_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'PRODUCT', 'action', 'create',
      'sku', 'SERP086-A', 'name', 'Serp086 Stock A', 'kind', 'stock',
      'inventory_account', '1300', 'barcode', '6291041500213'
    ), gen_random_uuid()
  ))->'product';
  product_a := (row->>'id')::uuid;
  if row->>'barcode' <> '6291041500213' then
    raise exception 'barcode not persisted on create: %', row;
  end if;

  row := (public.api_product_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'PRODUCT', 'action', 'create',
      'sku', 'SERP086-B', 'name', 'Serp086 Stock B', 'kind', 'stock',
      'inventory_account', '1300', 'barcode', '5060138492201'
    ), gen_random_uuid()
  ))->'product';
  product_b := (row->>'id')::uuid;

  -- Read round-trip returns the barcode too.
  row := (public.api_product_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object('type', 'PRODUCT', 'action', 'read', 'product_id', product_a)
  ))->'product';
  if row->>'barcode' <> '6291041500213' then
    raise exception 'barcode missing on read: %', row;
  end if;

  -- Per-org uniqueness: identical barcode in the SAME org is refused...
  perform pg_temp.expect_product_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRODUCT', 'action', 'create',
      'sku', 'SERP086-DUP', 'name', 'Duplicate Barcode', 'kind', 'stock',
      'inventory_account', '1300', 'barcode', '6291041500213'),
    'product_barcode_exists'
  );
  -- ...but the same barcode in ANOTHER tenant is fine (tenant-scoped identity).
  row := (public.api_product_command(
    org_two, other_admin, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'PRODUCT', 'action', 'create',
      'sku', 'SERP086-OTHER', 'name', 'Other Tenant Same Barcode', 'kind', 'stock',
      'inventory_account', '1300', 'barcode', '6291041500213'
    ), gen_random_uuid()
  ))->'product';
  barcode_dup := (row->>'id')::uuid;
  if barcode_dup is null then raise exception 'cross-tenant barcode create failed'; end if;
  update public.products set active = false where id = barcode_dup;

  -- Grammar: lowercase/slash barcodes are refused; update respects it.
  perform pg_temp.expect_product_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRODUCT', 'action', 'create',
      'sku', 'SERP086-BAD1', 'name', 'Bad Lower', 'kind', 'stock',
      'inventory_account', '1300', 'barcode', 'abc123'),
    'product_barcode_invalid'
  );
  perform pg_temp.expect_product_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRODUCT', 'action', 'create',
      'sku', 'SERP086-BAD2', 'name', 'Bad Symbol', 'kind', 'stock',
      'inventory_account', '1300', 'barcode', '62/104*150021'),
    'product_barcode_invalid'
  );
  perform pg_temp.expect_product_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRODUCT', 'action', 'update', 'product_id', product_a,
      'name', 'Serp086 Stock A', 'barcode', 'bad barcode'),
    'product_barcode_invalid'
  );
  -- Update can also CLEAR a barcode (empty -> NULL).
  perform public.api_product_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object('type', 'PRODUCT', 'action', 'update',
      'product_id', product_b, 'name', 'Serp086 Stock B', 'barcode', ''),
    gen_random_uuid()
  );
  if exists (select 1 from public.products where id = product_b and barcode is not null) then
    raise exception 'barcode was not cleared on update';
  end if;

  -- ───────── Base price resolution: stale excluded, newest current wins ─────────
  -- A 120 that expired yesterday must NOT win; a 200 starting tomorrow must NOT
  -- resolve yet; current window MVR 100 (no expiry) is the active version.
  insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from, valid_to)
  values
    (org_one, product_a, 'MVR', 120, now() - interval '30 days', now() - interval '1 day'),
    (org_one, product_a, 'MVR', 100, now() - interval '20 days', null),
    (org_one, product_a, 'MVR', 200, now() + interval '1 day', null);

  -- No price list context -> base product_prices, current window, newest wins.
  row := public.api_counter_price_resolution(
    org_one, counter_person, 'counter', null, '6291041500213', null, 'exclusive'
  );
  if (row->'price'->>'resolved')::boolean is not true
     or (row->'price'->>'unit_amount')::numeric <> 100.0
     or row->'price'->>'source' <> 'product_prices' then
    raise exception 'base price resolution wrong: %', row;
  end if;
  -- GST at the statutory rate on an exclusive unit amount of 100.
  if (row->'tax'->>'tax_amount')::numeric <> round(100 * (row->'tax'->>'rate')::numeric, 2)
     or (row->'tax'->>'gross_amount')::numeric <> 100 + round(100 * (row->'tax'->>'rate')::numeric, 2) then
    raise exception 'exclusive tax resolution wrong: %', row;
  end if;

  -- Bound list with a 25% discount and a per-item override of 42 -> 42, not 100.
  row := (public.api_price_list_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'PRICE_LIST', 'action', 'create',
      'code', 'trade_25', 'name', 'Trade 25', 'discount_percent', 25,
      'overrides', jsonb_build_array(
        jsonb_build_object('product_id', product_a, 'unit_price', 42))
    ), gen_random_uuid()
  ))->'price_list';
  list_id := (row->>'registry_id')::uuid;
  if list_id is null then raise exception 'trade_25 list creation failed: %', row; end if;

  row := public.api_counter_price_resolution(
    org_one, counter_person, 'counter', product_a, null, 'trade_25', 'exclusive'
  );
  if (row->'price'->>'source') <> 'price_list_override'
     or (row->'price'->>'unit_amount')::numeric <> round(42 * (1 - 0.25), 6)
     or (row->'price'->>'discount_percent')::numeric <> 25 then
    raise exception 'override/discount resolution wrong: %', row;
  end if;
  -- Collision evidence: the bound list's active version is reported.
  if (row->'price'->>'price_list_version')::integer <> 1 then
    raise exception 'bound list version not reported: %', row;
  end if;

  -- Collision: a stale administrator write to the bound list must fail closed
  -- rather than silently overwriting the newer version (same as serp314).
  perform pg_temp.expect_price_list_error(
    org_one, admin_person, 'owner',
    jsonb_build_object('type', 'PRICE_LIST', 'action', 'update',
      'price_list_id', list_id, 'expected_version', 999,
      'name', 'Stale Write', 'discount_percent', 1),
    'price_list_version_conflict'
  );

  -- Without an override, product_b falls to its base MVR 100 with the 25%
  -- discount applied (75.0) — the same ordering a pending COUNTER_SALE uses.
  insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from)
    values (org_one, product_b, 'MVR', 100, now() - interval '10 days');
  row := public.api_counter_price_resolution(
    org_one, counter_person, 'counter', product_b, null, 'trade_25', 'exclusive'
  );
  if (row->'price'->>'source') <> 'product_prices'
     or (row->'price'->>'unit_amount')::numeric <> round(100 * (1 - 0.25), 6) then
    raise exception 'base+discount resolution wrong: %', row;
  end if;

  raise notice 'SERP-086 probe stage 1 PASS: barcode identity + versioned base/override resolution';
  raise exception using errcode = 'ZX704', message = 'rollback_serp086_probe_stage1';
exception when sqlstate 'ZX704' then
  null;
end
$$;

-- ─────────────────── 2. Fail-closed negatives + replay + bulk ────────────────
do $$
declare
  org_one uuid := '20000000-0000-4000-8000-000000000001';
  org_two uuid := '10000000-0000-4000-8000-000000000001';
  admin_person uuid := '00000000-0000-4000-8000-000000000901';
  counter_person uuid := '00000000-0000-4000-8000-000000000902';
  tech_person uuid := '00000000-0000-4000-8000-000000000904';
  tech_member uuid := '00000000-0000-4000-8000-000000000914';
  other_admin uuid := '00000000-0000-4000-8000-000000000903';
  product_a uuid;
  no_price_prod uuid;
  row jsonb;
  first_res jsonb;
  second_res jsonb;
  prices jsonb;
  price_item jsonb;
begin
  -- A technician seat cannot resolve prices at all.
  insert into public.persons (id, person_key, external_subject, display_label, status)
  values (tech_person, '__serp086_tech__', '__serp086_tech__', 'SERP-086 technician', 'active')
  on conflict (id) do nothing;
  insert into public.memberships (id, organisation_id, person_id, status)
  values (tech_member, org_one, tech_person, 'active');
  insert into public.membership_seats (membership_id, seat_code)
  values (tech_member, 'technician');
  perform pg_temp.expect_resolve_error(org_one, tech_person, 'technician', '6291041500213', 'seat_not_authorized');

  select id into product_a from public.products
   where organisation_id = org_one and sku = 'SERP086-A';

  -- Unknown bound list code.
  row := public.api_counter_price_resolution(
    org_one, counter_person, 'counter', null, '6291041500213', 'ghost_list', 'exclusive'
  );
  raise exception 'expected price list not found to fail: %', row;
exception
  when others then
    if sqlerrm <> 'stock_line_price_list_not_found' then
      raise exception 'expected stock_line_price_list_not_found, got %', sqlerrm;
    end if;
end
$$;

do $$
declare
  org_one uuid := '20000000-0000-4000-8000-000000000001';
  counter_person uuid := '00000000-0000-4000-8000-000000000902';
  row jsonb;
  product_a uuid;
begin
  select id into product_a from public.products
   where organisation_id = org_one and sku = 'SERP086-A';

  -- No identifier at all -> required.
  row := public.api_counter_price_resolution(
    org_one, counter_person, 'counter', null, null, null, 'exclusive'
  );
  raise exception 'expected no-identifier to fail: %', row;
exception
  when others then
    if sqlerrm <> 'product_identifier_required' then
      raise exception 'expected product_identifier_required, got %', sqlerrm;
    end if;
end
$$;

do $$
declare
  org_one uuid := '20000000-0000-4000-8000-000000000001';
  counter_person uuid := '00000000-0000-4000-8000-000000000902';
  product_a uuid;
  row jsonb;
begin
  select id into product_a from public.products
   where organisation_id = org_one and sku = 'SERP086-A';

  -- Ambiguous (both identifiers) -> fails closed.
  row := public.api_counter_price_resolution(
    org_one, counter_person, 'counter', product_a, '6291041500213', null, 'exclusive'
  );
  raise exception 'expected ambiguous identifiers to fail: %', row;
exception
  when others then
    if sqlerrm <> 'product_identifier_ambiguous' then
      raise exception 'expected product_identifier_ambiguous, got %', sqlerrm;
    end if;
end
$$;

do $$
declare
  org_one uuid := '20000000-0000-4000-8000-000000000001';
  org_two uuid := '10000000-0000-4000-8000-000000000001';
  other_admin uuid := '00000000-0000-4000-8000-000000000903';
  product_a uuid;
  row jsonb;
begin
  select id into product_a from public.products
   where organisation_id = org_one and sku = 'SERP086-A';

  -- Cross-tenant product_id resolution fails closed.
  row := public.api_counter_price_resolution(
    org_two, other_admin, 'owner', product_a, null, null, 'exclusive'
  );
  raise exception 'expected cross-tenant product lookup to fail: %', row;
exception
  when others then
    if sqlerrm <> 'product_not_found' then
      raise exception 'expected product_not_found, got %', sqlerrm;
    end if;
end
$$;

do $$
declare
  org_one uuid := '20000000-0000-4000-8000-000000000001';
  counter_person uuid := '00000000-0000-4000-8000-000000000902';
  admin_person uuid := '00000000-0000-4000-8000-000000000901';
  no_price_prod uuid;
  row jsonb;
  first_res jsonb;
  second_res jsonb;
  prices jsonb;
  price_item jsonb;
  bulk_count integer;
begin
  -- A product with barcode but NO price row resolves to a distinguishable
  -- fail-closed state — never a fabricated price.
  row := (public.api_product_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'PRODUCT', 'action', 'create',
      'sku', 'SERP086-NOPRICE', 'name', 'No Price Item', 'kind', 'stock',
      'inventory_account', '1300', 'barcode', '9900000000001'
    ), gen_random_uuid()
  ))->'product';
  no_price_prod := (row->>'id')::uuid;
  row := public.api_counter_price_resolution(
    org_one, counter_person, 'counter', no_price_prod, null, null, 'exclusive'
  );
  if (row->'price'->>'resolved')::boolean is not false
     or row->'price'->>'reason' <> 'stock_line_no_price'
     or row->'resolution'::text <> 'false' then
    raise exception 'no-price path did not fail closed: %', row;
  end if;

  -- Replay-safety: a read RPC is pure — repeat calls return identical
  -- resolutions and no idempotency / audit rows are produced.
  first_res := public.api_counter_price_resolution(
    org_one, counter_person, 'counter', no_price_prod, null, null, 'exclusive'
  );
  second_res := public.api_counter_price_resolution(
    org_one, counter_person, 'counter', no_price_prod, null, null, 'exclusive'
  );
  if first_res::text <> second_res::text then
    raise exception 'read replay returned differing resolutions: % vs %', first_res, second_res;
  end if;
  if exists (select 1 from public.idempotency_keys
              where organisation_id = org_one and command_type = 'PRICE_LIST') then
    raise exception 'read RPC unexpectedly wrote idempotency state';
  end if;

  -- Bulk approved-prices aperture: tenant-scoped, includes override rows, and
  -- only counter-capable seats may read.
  prices := public.api_counter_approved_prices(org_one, counter_person, 'counter', 'trade_25');
  if (prices->>'ok')::boolean is not true then raise exception 'bulk approved prices failed: %', prices; end if;
  price_item := null;
  select value into price_item from jsonb_array_elements(prices->'prices') it
   where (it->>'product_id')::uuid = no_price_prod;
  if price_item is null or (price_item->>'source') <> 'none'
     or (price_item->>'unit_amount')::numeric <> 0 then
    raise exception 'bulk no-price row wrong: %', price_item;
  end if;
  price_item := null;
  select value into price_item from jsonb_array_elements(prices->'prices') it
   where (it->>'product_id')::uuid = (select id from public.products
                                        where organisation_id = org_one and sku = 'SERP086-A');
  if price_item is null or (price_item->>'source') <> 'price_list_override'
     or (price_item->>'unit_amount')::numeric <> round(42 * (1 - 0.25), 6) then
    raise exception 'bulk override row wrong: %', price_item;
  end if;

  -- A technician cannot read the bulk aperture; another tenant cannot read ours.
  perform pg_temp.expect_prices_error(org_one, tech_person, 'technician', 'seat_not_authorized');
  perform pg_temp.expect_prices_error('10000000-0000-4000-8000-000000000001', counter_person, 'counter', 'seat_not_authorized');

  raise notice 'SERP-086 probe stage 2 PASS: fail-closed negatives, replay-safety and bulk aperture verified';
  raise exception using errcode = 'ZX705', message = 'rollback_serp086_probe_stage2';
exception when sqlstate 'ZX705' then
  null;
end
$$;

-- ─────────────── 3. Active-gate regression (Elder finding 2) ────────────────
-- A deactivated product must NOT resolve by id or barcode, and must NOT appear
-- in the bulk approved-prices aperture — even with a live price row under it.
do $$
declare
  org_one uuid := '20000000-0000-4000-8000-000000000001';
  counter_person uuid := '00000000-0000-4000-8000-000000000902';
  admin_person uuid := '00000000-0000-4000-8000-000000000901';
  dead_prod uuid;
  row jsonb;
  prices jsonb;
  dead_in_bulk boolean;
begin
  row := (public.api_product_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'PRODUCT', 'action', 'create',
      'sku', 'SERP086-DEAD', 'name', 'Deactivated Stock', 'kind', 'stock',
      'inventory_account', '1300', 'barcode', '5550000000001'
    ), gen_random_uuid()
  ))->'product';
  dead_prod := (row->>'id')::uuid;
  insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from)
    values (org_one, dead_prod, 'MVR', 999, now() - interval '5 days');
  update public.products set active = false where id = dead_prod;

  -- id and barcode both fail closed for the deactivated product.
  perform pg_temp.expect_resolve_error_pid(
    org_one, counter_person, 'counter', dead_prod, 'product_not_found');
  perform pg_temp.expect_resolve_error(org_one, counter_person, 'counter', '5550000000001', 'product_not_found');

  -- The bulk aperture must exclude it entirely.
  prices := public.api_counter_approved_prices(org_one, counter_person, 'counter', null);
  select exists (
    select 1 from jsonb_array_elements(prices->'prices') it where (it->>'product_id')::uuid = dead_prod
  ) into dead_in_bulk;
  if dead_in_bulk then
    raise exception 'deactivated product leaked into the bulk aperture: %', prices;
  end if;

  raise notice 'SERP-086 probe stage 3 PASS: active-gate regression verified';
  raise exception using errcode = 'ZX706', message = 'rollback_serp086_probe_stage3';
exception when sqlstate 'ZX706' then
  null;
end
$$;

do $$
begin
  if exists (select 1 from public.persons where person_key like '__serp086_%')
     or exists (select 1 from public.products where sku like 'SERP086-%')
     or exists (select 1 from public.price_lists where code = 'trade_25') then
    raise exception 'SERP-086 probe did not roll back cleanly';
  end if;
  raise notice 'SERP-086 probe: clean rollback confirmed';
end
$$;

commit;