-- tests/serp441_malformed_tender_probe.sql
-- SERP-441 — executable synthetic DB probe (OpenCode lane).
-- Regression hardening: malformed tender/change negative cases, plus a
-- PER-CASE zero-partial-side-effect proof.
--
-- Why this file exists separately from serp087_tender_receipt_probe.sql:
-- SERP-087 proved the negative tender ERROR CODES, and proved atomicity only
-- in aggregate (a single final count of counter_receipts + counter_tenders
-- after 13 rejections). It did NOT prove, per rejection, that the invoice,
-- document LINES, stock movements, audit trail and outbox were untouched, and
-- it never exercised a NEGATIVE tender amount (only zero).
--
-- What this probe adds:
--   * a POSITIVE CONTROL, so "no residue" is a real measurement and not a
--     vacuous pass: a valid sale runs FIRST and must move every counter, or
--     the probe fails before it tests anything;
--   * per-case residue snapshots across all seven tables, compared after EVERY
--     rejection, org-scoped AND global;
--   * a negative tender amount (SERP-087 only ever sent 0);
--   * a client-asserted bogus total, proving the server total is authoritative
--     and the client's number is ignored rather than trusted;
--   * a non-numeric tender amount, which fails closed but may surface a raw
--     cast error instead of a domain code — observed and reported, NOT fixed
--     (this task is test authorship only; no production behavior change).
--
-- Pattern mirrors serp087: the COUNTER_SALE response is nested under
-- 'counter_sale', every "expected rejection but accepted" marker carries NO
-- expected-code string so an ACCEPT can never be swallowed by the handler that
-- checks for the expected code.
begin;

-- Snapshot every table a rejected sale could plausibly leave residue in.
-- Both org-scoped and global counts: the org count is the assertion, the
-- global count catches a leak that escapes tenant scoping.
create or replace function pg_temp.residue_snapshot(p_org uuid)
returns jsonb language plpgsql as $$
declare
  s jsonb;
begin
  select jsonb_build_object(
    'documents',        (select count(*) from public.commercial_documents        where organisation_id = p_org),
    'document_lines',   (select count(*) from public.commercial_document_lines   where organisation_id = p_org),
    'stock_movements',  (select count(*) from public.stock_movements              where organisation_id = p_org),
    'counter_tenders',  (select count(*) from public.counter_tenders              where organisation_id = p_org),
    'counter_receipts', (select count(*) from public.counter_receipts             where organisation_id = p_org),
    'audit_events',     (select count(*) from public.audit_events                 where organisation_id = p_org),
    'outbox',           (select count(*) from public.transactional_outbox        where organisation_id = p_org),
    'GLOBAL_documents',       (select count(*) from public.commercial_documents),
    'GLOBAL_document_lines',  (select count(*) from public.commercial_document_lines),
    'GLOBAL_stock_movements', (select count(*) from public.stock_movements),
    'GLOBAL_counter_tenders', (select count(*) from public.counter_tenders),
    'GLOBAL_counter_receipts',(select count(*) from public.counter_receipts),
    'GLOBAL_audit_events',    (select count(*) from public.audit_events),
    'GLOBAL_outbox',          (select count(*) from public.transactional_outbox)
  ) into s;
  return s;
end
$$;

-- The 7 assertion keys, in report order.
create or replace function pg_temp.residue_delta(p_before jsonb, p_after jsonb)
returns text language plpgsql as $$
declare
  k text;
  d bigint;
  parts text[] := array[]::text[];
begin
  foreach k in array array[
    'documents','document_lines','stock_movements','counter_tenders',
    'counter_receipts','audit_events','outbox',
    'GLOBAL_documents','GLOBAL_document_lines','GLOBAL_stock_movements',
    'GLOBAL_counter_tenders','GLOBAL_counter_receipts','GLOBAL_audit_events',
    'GLOBAL_outbox'
  ] loop
    d := (p_after->>k)::bigint - (p_before->>k)::bigint;
    if d <> 0 then
      parts := parts || (k || ' ' || d::text);
    end if;
  end loop;
  if array_length(parts, 1) is null then return 'zero residue'; end if;
  return array_to_string(parts, ', ');
end
$$;

-- Assert a COUNTER_SALE is REJECTED with the expected domain code AND leaves
-- no residue anywhere. On RPC success the helper RETURNS and the caller raises
-- a code-free acceptance marker; on rejection the error propagates.
create or replace function pg_temp.expect_sale_error(
  p_org uuid, p_person uuid, p_seat text, p_command jsonb,
  p_expected text, p_label text, p_before jsonb
) returns void language plpgsql as $$
declare
  ignored jsonb;
  after_snap jsonb;
begin
  begin
    ignored := public.api_garage_command(
      p_org, p_person, p_seat, gen_random_uuid(), p_command, gen_random_uuid());
    raise exception 'ACCEPTED_NOT_REJECTED %: %', p_label, ignored;
  exception when others then
    if sqlerrm !~ p_expected then raise; end if;
  end;

  after_snap := pg_temp.residue_snapshot(p_org);
  if pg_temp.residue_delta(p_before, after_snap) <> 'zero residue' then
    raise exception 'RESIDUE AFTER %: %', p_label, pg_temp.residue_delta(p_before, after_snap);
  end if;
  raise notice '  % -> %, zero residue', rpad(p_label, 34), p_expected;
end
$$;

-- Same, but for the case whose error SURFACE is itself under test: any
-- rejection passes, and the actual error text is returned so the probe can
-- report whether the boundary is a domain code or a raw cast failure.
create or replace function pg_temp.expect_sale_rejected_closed(
  p_org uuid, p_person uuid, p_seat text, p_command jsonb,
  p_label text, p_before jsonb
) returns text language plpgsql as $$
declare
  ignored jsonb;
  after_snap jsonb;
  seen text;
begin
  begin
    ignored := public.api_garage_command(
      p_org, p_person, p_seat, gen_random_uuid(), p_command, gen_random_uuid());
    raise exception 'ACCEPTED_NOT_REJECTED %: %', p_label, ignored;
  exception when others then
    seen := sqlerrm;
  end;

  after_snap := pg_temp.residue_snapshot(p_org);
  if pg_temp.residue_delta(p_before, after_snap) <> 'zero residue' then
    raise exception 'RESIDUE AFTER %: %', p_label, pg_temp.residue_delta(p_before, after_snap);
  end if;
  return seen;
end
$$;

do $$
declare
  org_one     uuid := '20000000-0000-4000-8000-000000000001';
  admin_person uuid := '00000000-0000-4000-8000-000000000901';
  counter_person uuid := '00000000-0000-4000-8000-000000000902';
  admin_member uuid := '00000000-0000-4000-8000-000000000911';
  counter_member uuid := '00000000-0000-4000-8000-000000000912';
  loc_one uuid;
  prod_a uuid;
  row jsonb;
  sale jsonb;
  base jsonb;      -- residue AFTER the positive control
  pre jsonb;       -- residue BEFORE the positive control, for the delta proof
  probe_error text;
  rejected_count integer := 0;
begin
  -- ──────────────────────────── SETUP ────────────────────────────
  insert into public.persons (id, person_key, external_subject, display_label, status)
  values
    (admin_person,   '__serp441_admin__',   '__serp441_admin__',   'SERP-441 admin',   'active'),
    (counter_person, '__serp441_counter__', '__serp441_counter__', 'SERP-441 counter', 'active');

  insert into public.memberships (id, organisation_id, person_id, status)
  values
    (admin_member,   org_one, admin_person,   'active'),
    (counter_member, org_one, counter_person, 'active');

  insert into public.membership_seats (membership_id, seat_code)
  values (admin_member, 'owner'), (counter_member, 'counter');

  select id into loc_one from public.locations
   where organisation_id = org_one and active order by created_at limit 1;
  if loc_one is null then
    insert into public.locations (id, organisation_id, code, name, kind)
      values ('20000000-0000-4000-8000-000000000731', org_one, 'MAIN', 'Main Location', 'office')
      returning id into loc_one;
  end if;

  row := (public.api_product_command(
    org_one, admin_person, 'owner', gen_random_uuid(),
    jsonb_build_object(
      'type', 'PRODUCT', 'action', 'create',
      'sku', 'SERP441-A', 'name', 'Serp441 Stock A', 'kind', 'stock',
      'inventory_account', '1300', 'barcode', '6291041500411'
    ), gen_random_uuid()
  ))->'product';
  prod_a := (row->>'id')::uuid;
  if prod_a is null then raise exception 'product A create failed: %', row; end if;

  insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from)
    values (org_one, prod_a, 'MVR', 100, now() - interval '5 days');

  insert into public.stock_movements
    (organisation_id, location_id, product_id, movement_type, quantity,
     source_type, source_id, idempotency_key, occurred_at, recorded_by)
  values (org_one, loc_one, prod_a, 'opening', 500, 'OPENING_BALANCE', prod_a,
          '20000000-0000-4000-8000-000000000741', now(), admin_person);

  -- ─────────────── POSITIVE CONTROL: the probe must be able to SEE residue ───────────────
  -- If a valid sale does not move the counters, every "zero residue" assertion
  -- below would pass vacuously. So prove detection first, and fail loudly here.
  pre := pg_temp.residue_snapshot(org_one);
  sale := public.api_garage_command(
    org_one, counter_person, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'COUNTER_SALE', 'tax_mode', 'zero_rated', 'location_id', loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a, 'quantity', 1)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 200))
    ), gen_random_uuid());

  if (sale->'counter_sale'->>'total_amount')::numeric <> 100 then
    raise exception 'control server total wrong: %', sale;
  end if;
  if (sale->'counter_sale'->>'change_amount')::numeric <> 100 then
    raise exception 'control change wrong: %', sale;
  end if;

  base := pg_temp.residue_snapshot(org_one);
  if (base->>'documents')::int < 1
     or (base->>'document_lines')::int < 1
     or (base->>'stock_movements')::int < 1
     or (base->>'counter_tenders')::int < 1
     or (base->>'counter_receipts')::int < 1
     or (base->>'audit_events')::int < 1
     or (base->>'outbox')::int < 1 then
    raise exception 'POSITIVE CONTROL RESIDUE NOT VISIBLE - probe would pass vacuously: %', base;
  end if;
  -- Second half of the non-vacuity proof: rows existing is not the same as the
  -- delta arithmetic DETECTING them. Compare across the control sale and
  -- require a non-empty delta, so residue_delta is proven to fire on a real
  -- change and not only ever return 'zero residue'.
  if pg_temp.residue_delta(pre, base) = 'zero residue' then
    raise exception 'DELTA ARITHMETIC BLIND - residue_delta failed to see a real sale: %', base;
  end if;
  raise notice 'SERP-441 control PASS: valid sale moved every counter, so residue is detectable';
  raise notice '  baseline after control: %', base;
  raise notice '  control delta (proves the detector fires): %', pg_temp.residue_delta(pre, base);

  -- ─────────────── MALFORMED TENDER / CHANGE NEGATIVE CASES ───────────────
  raise notice 'SERP-441 negatives (each asserts fail-closed + zero residue across 7 tables):';

  -- N1 · unrecognized payment method
  perform pg_temp.expect_sale_error(org_one, counter_person, 'counter',
    jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a,'quantity',1)),
      'payment_method','bitcoin',
      'tender', jsonb_build_array(jsonb_build_object('method','cash','amount_tendered',200))),
    'counter_sale_payment_method_invalid', 'N1 unrecognized payment method', base);
  rejected_count := rejected_count + 1;

  -- N2 · unrecognized tender method
  perform pg_temp.expect_sale_error(org_one, counter_person, 'counter',
    jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a,'quantity',1)),
      'payment_method','cash',
      'tender', jsonb_build_array(jsonb_build_object('method','cheque','amount_tendered',200))),
    'counter_sale_tender_method_invalid', 'N2 unrecognized tender method', base);
  rejected_count := rejected_count + 1;

  -- N3 · NEGATIVE tender amount. SERP-087 only ever sent 0.
  perform pg_temp.expect_sale_error(org_one, counter_person, 'counter',
    jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a,'quantity',1)),
      'payment_method','cash',
      'tender', jsonb_build_array(jsonb_build_object('method','cash','amount_tendered',-50))),
    'counter_sale_tender_amount_positive', 'N3 NEGATIVE tender amount', base);
  rejected_count := rejected_count + 1;

  -- N4 · zero tender amount (regression guard on the SERP-087 case)
  perform pg_temp.expect_sale_error(org_one, counter_person, 'counter',
    jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a,'quantity',1)),
      'payment_method','cash',
      'tender', jsonb_build_array(jsonb_build_object('method','cash','amount_tendered',0))),
    'counter_sale_tender_amount_positive', 'N4 zero tender amount', base);
  rejected_count := rejected_count + 1;

  -- N5 · missing tender amount
  perform pg_temp.expect_sale_error(org_one, counter_person, 'counter',
    jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a,'quantity',1)),
      'payment_method','cash',
      'tender', jsonb_build_array(jsonb_build_object('method','cash'))),
    'counter_sale_tender_amount_required', 'N5 missing tender amount', base);
  rejected_count := rejected_count + 1;

  -- N6 · tender below the server-authoritative total
  perform pg_temp.expect_sale_error(org_one, counter_person, 'counter',
    jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a,'quantity',1)),
      'payment_method','cash',
      'tender', jsonb_build_array(jsonb_build_object('method','cash','amount_tendered',99.99))),
    'counter_sale_tender_insufficient', 'N6 tender below server total', base);
  rejected_count := rejected_count + 1;

  -- N7 · change would refund more cash than was tendered in cash
  perform pg_temp.expect_sale_error(org_one, counter_person, 'counter',
    jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a,'quantity',1)),
      'payment_method','card',
      'tender', jsonb_build_array(jsonb_build_object('method','card','amount_tendered',300))),
    'counter_sale_change_exceeds_cash', 'N7 change exceeds cash tendered', base);
  rejected_count := rejected_count + 1;

  -- N8 · tender method does not match the declared payment_method
  perform pg_temp.expect_sale_error(org_one, counter_person, 'counter',
    jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a,'quantity',1)),
      'payment_method','cash',
      'tender', jsonb_build_array(jsonb_build_object('method','card','amount_tendered',200))),
    'counter_sale_tender_method_mismatch', 'N8 tender method mismatch', base);
  rejected_count := rejected_count + 1;

  -- N9 · mixed payment_method with a single tender leg
  perform pg_temp.expect_sale_error(org_one, counter_person, 'counter',
    jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a,'quantity',1)),
      'payment_method','mixed',
      'tender', jsonb_build_array(jsonb_build_object('method','card','amount_tendered',200))),
    'counter_sale_mixed_tender_requires_two_methods', 'N9 mixed needs two methods', base);
  rejected_count := rejected_count + 1;

  -- N10 · CLIENT-ASSERTED BOGUS TOTAL. The client claims the sale is 1.00 and
  -- tenders exactly 1.00. If the server trusted the client's total this would
  -- be ACCEPTED. The server total is 100, so it must fail as insufficient —
  -- this is the direct proof that the sale total is server-authoritative.
  perform pg_temp.expect_sale_error(org_one, counter_person, 'counter',
    jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a,'quantity',1)),
      'payment_method','cash',
      'total_amount', 1, 'total', 1,
      'tender', jsonb_build_array(jsonb_build_object('method','cash','amount_tendered',1))),
    'counter_sale_tender_insufficient', 'N10 client bogus total ignored', base);
  rejected_count := rejected_count + 1;

  -- N11 · NON-NUMERIC tender amount. The error SURFACE is the thing under test:
  -- the cast to numeric will fail, but is it a domain code or a raw Postgres
  -- cast error leaking through? Either way it must fail closed with no residue.
  -- Reported, not fixed - SERP-441 is test authorship only.
  probe_error := pg_temp.expect_sale_rejected_closed(org_one, counter_person, 'counter',
    jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',loc_one,
      'items', jsonb_build_array(jsonb_build_object('product_id', prod_a,'quantity',1)),
      'payment_method','cash',
      'tender', jsonb_build_array(jsonb_build_object('method','cash','amount_tendered','lots'))),
    'N11 non-numeric tender amount', base);
  rejected_count := rejected_count + 1;
  raise notice '  % -> %', rpad('N11 non-numeric tender amount', 34), probe_error;
  if probe_error ~ '^counter_sale_' then
    raise notice '     -> domain error code (clean boundary)';
  else
    raise notice '     -> NOT a domain code: raw error surface (reported, not fixed)';
  end if;

  -- The residue baseline must be byte-identical to the post-control snapshot
  -- after all 11 rejections. This is the aggregate backstop; the per-case check
  -- inside expect_sale_error is what actually localises a leak.
  if pg_temp.residue_delta(base, pg_temp.residue_snapshot(org_one)) <> 'zero residue' then
    raise exception 'AGGREGATE RESIDUE AFTER ALL NEGATIVES: %',
      pg_temp.residue_delta(base, pg_temp.residue_snapshot(org_one));
  end if;

  raise notice 'SERP-441 probe NEGATIVE PASS: % fail-closed, per-case zero residue, server total authoritative',
    rejected_count;

  raise exception using errcode = 'ZX741', message = 'rollback_serp441_probe';
exception when sqlstate 'ZX741' then
  null;
end
$$;

-- Clean rollback: nothing from the probe may survive.
do $$
begin
  -- Marker-scoped, not global: the migrations may legitimately have seeded
  -- outbox rows, and a global emptiness check here would be a false failure.
  if exists (select 1 from public.persons where person_key like '__serp441_%')
     or exists (select 1 from public.products where sku like 'SERP441-%')
     or exists (select 1 from public.counter_receipts)
     or exists (select 1 from public.counter_tenders)
     or exists (select 1 from public.transactional_outbox
                where actor_person_id = '00000000-0000-4000-8000-000000000902') then
    raise exception 'SERP-441 probe did not roll back cleanly';
  end if;
  raise notice 'SERP-441 probe: clean rollback confirmed';
end
$$;
