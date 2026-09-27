-- SERP-453 fix verification probe (Vision-authored, fixtures only, rolled back).
-- Proves at runtime: never-stocked products are rejected before any mutation,
-- no negative stock is possible, multi-line failures leave zero partial residue,
-- and the stocked single-line path is unchanged.

\echo '=== A. EMPTY-SET MECHANISM (the defect shape) ==='
select count(*) as movement_rows_for_never_stocked
  from public.stock_movements
 where organisation_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
   and product_id = '33333333-3333-4333-8333-333333333333';

\echo 'A1. set-returning form: how many ROWS does the aggregate return?'
select count(*) as rows_returned
  from public.stock_movements_derived_onhand(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '33333333-3333-4333-8333-333333333333');

\echo 'A2. scalar subquery form: what VALUE does the same read produce?'
select coalesce((select d.derived_quantity
                   from public.stock_movements_derived_onhand(
                     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                     'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                     '33333333-3333-4333-8333-333333333333') d), 0) as scalar_onhand;

\echo '=== B. GUARD PREDICATE ARITHMETIC (old form vs new form) ==='
do $$
declare
  v_qty numeric := 1;
  v_old numeric;
  v_new numeric;
begin
  select coalesce(d.derived_quantity, 0) into v_old
    from public.stock_movements_derived_onhand(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '33333333-3333-4333-8333-333333333333') d;
  select coalesce((select d.derived_quantity
                     from public.stock_movements_derived_onhand(
                       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                       '33333333-3333-4333-8333-333333333333') d), 0) into v_new;
  raise notice 'OLD set-returning SELECT INTO -> %   (NULL = guard skipped)', v_old;
  raise notice 'NEW scalar subquery + coalesce -> %   (real 0 = guard fires)', v_new;
  raise notice 'OLD predicate NULL < 1        -> %   (not-true, guard SKIPPED)', (v_old < v_qty);
  raise notice 'NEW predicate 0 < 1           -> %   (true, guard FIRES)', (v_new < v_qty);
  raise notice 'NEW fail-closed IS NULL check -> %   (false, not degenerate)', (v_new is null);
end $$;

\echo '=== C. FULL COUNTER-SALE CASES VIA api_garage_command ==='
do $$
declare
  v_org  uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_loc  uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_pers uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  v_role uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  v_mem  uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  v_stk  uuid := '22222222-2222-4222-8222-222222222222';
  v_empty uuid := '33333333-3333-4333-8333-333333333333';
  v_sale jsonb;
  v_before_doc bigint;
  v_before_mv  bigint;
  v_before_audit bigint;
  v_after_doc bigint;
  v_after_mv  bigint;
  v_after_audit bigint;
  v_onhand_empty numeric;
  v_onhand_stk numeric;
  v_pass int := 0;
  v_fail int := 0;
begin
  insert into public.organisations (id, slug, legal_name, base_currency, status)
  values (v_org, 'probe-org-serp453', 'SERP-453 Probe Org', 'MVR', 'active');
  insert into public.locations (id, organisation_id, code, name, kind, active)
  values (v_loc, v_org, 'MAIN', 'Main Location', 'office', true);
  insert into public.persons (id, person_key, display_label, status)
  values (v_pers, 'probe:serp453:counter', 'Probe Counter', 'active');
  insert into public.roles (id, organisation_id, code, name)
  values (v_role, v_org, 'counter', 'Counter Role');
  insert into public.memberships (id, organisation_id, person_id, role_id, status)
  values (v_mem, v_org, v_pers, v_role, 'active');
  insert into public.membership_seats (membership_id, seat_code) values (v_mem, 'counter');

  insert into public.products (id, organisation_id, sku, name, kind, active, sale_allowed)
  values
    (v_stk,   v_org, 'SERP453-STOCKED', 'Stocked Product', 'stock', true, true),
    (v_empty, v_org, 'SERP453-EMPTY',   'Never Stocked Product', 'stock', true, true);
  insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from)
  values
    (v_org, v_stk,   'MVR', 100, now() - interval '5 days'),
    (v_org, v_empty, 'MVR', 100, now() - interval '5 days');

  insert into public.stock_movements
    (organisation_id, location_id, product_id, movement_type, quantity,
     source_type, source_id, idempotency_key, occurred_at, recorded_by)
  values (v_org, v_loc, v_stk, 'opening', 500, 'OPENING_BALANCE', v_stk,
          '20000000-0000-4000-8000-000000000453', now(), v_pers);

  select count(*) into v_before_doc   from public.commercial_documents where organisation_id = v_org;
  select count(*) into v_before_mv    from public.stock_movements        where organisation_id = v_org;
  select count(*) into v_before_audit from public.audit_events           where organisation_id = v_org;

  -- M1 [stocked, never-stocked] -- the canonical Deadpool shape
  begin
    v_sale := public.api_garage_command(v_org, v_pers, 'counter', gen_random_uuid(),
      jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',v_loc,
        'items', jsonb_build_array(
          jsonb_build_object('product_id', v_stk,   'quantity', 1),
          jsonb_build_object('product_id', v_empty, 'quantity', 1)),
        'payment_method','cash',
        'tender', jsonb_build_array(jsonb_build_object('method','cash','amount_tendered', 200))),
      gen_random_uuid());
    raise notice 'M1 FAIL: expected rejection, got %', coalesce(v_sale->>'state', v_sale::text);
    v_fail := v_fail + 1;
  exception when others then
    if sqlerrm = 'stock_line_insufficient_on_hand' then
      raise notice 'M1 PASS: rejected with stock_line_insufficient_on_hand';
      v_pass := v_pass + 1;
    else
      raise notice 'M1 FAIL: wrong error %', sqlerrm; v_fail := v_fail + 1;
    end if;
  end;

  -- M2 [never-stocked, stocked] -- order independence
  begin
    v_sale := public.api_garage_command(v_org, v_pers, 'counter', gen_random_uuid(),
      jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',v_loc,
        'items', jsonb_build_array(
          jsonb_build_object('product_id', v_empty, 'quantity', 1),
          jsonb_build_object('product_id', v_stk,   'quantity', 1)),
        'payment_method','cash',
        'tender', jsonb_build_array(jsonb_build_object('method','cash','amount_tendered', 200))),
      gen_random_uuid());
    raise notice 'M2 FAIL: expected rejection, got %', coalesce(v_sale->>'state', v_sale::text);
    v_fail := v_fail + 1;
  exception when others then
    if sqlerrm = 'stock_line_insufficient_on_hand' then
      raise notice 'M2 PASS: rejected, order independent';
      v_pass := v_pass + 1;
    else
      raise notice 'M2 FAIL: wrong error %', sqlerrm; v_fail := v_fail + 1;
    end if;
  end;

  -- M3 [ok, ok, never-stocked] -- two fulfillable writes precede the raise
  begin
    v_sale := public.api_garage_command(v_org, v_pers, 'counter', gen_random_uuid(),
      jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',v_loc,
        'items', jsonb_build_array(
          jsonb_build_object('product_id', v_stk, 'quantity', 1),
          jsonb_build_object('product_id', v_stk, 'quantity', 1),
          jsonb_build_object('product_id', v_empty, 'quantity', 1)),
        'payment_method','cash',
        'tender', jsonb_build_array(jsonb_build_object('method','cash','amount_tendered', 400))),
      gen_random_uuid());
    raise notice 'M3 FAIL: expected rejection, got %', coalesce(v_sale->>'state', v_sale::text);
    v_fail := v_fail + 1;
  exception when others then
    if sqlerrm = 'stock_line_insufficient_on_hand' then
      raise notice 'M3 PASS: rejected after two fulfillable lines';
      v_pass := v_pass + 1;
    else
      raise notice 'M3 FAIL: wrong error %', sqlerrm; v_fail := v_fail + 1;
    end if;
  end;

  -- M4 [400, 400 vs 500 on-hand] -- same product twice, proves the read sees line 1
  begin
    v_sale := public.api_garage_command(v_org, v_pers, 'counter', gen_random_uuid(),
      jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',v_loc,
        'items', jsonb_build_array(
          jsonb_build_object('product_id', v_stk, 'quantity', 400),
          jsonb_build_object('product_id', v_stk, 'quantity', 400)),
        'payment_method','cash',
        'tender', jsonb_build_array(jsonb_build_object('method','cash','amount_tendered', 80000))),
      gen_random_uuid());
    raise notice 'M4 FAIL: expected rejection (500 on-hand, 800 requested), got %',
      coalesce(v_sale->>'state', v_sale::text);
    v_fail := v_fail + 1;
  exception when others then
    if sqlerrm = 'stock_line_insufficient_on_hand' then
      raise notice 'M4 PASS: rejected, second 400 line saw on-hand 100';
      v_pass := v_pass + 1;
    else
      raise notice 'M4 FAIL: wrong error %', sqlerrm; v_fail := v_fail + 1;
    end if;
  end;

  -- control: valid single-line sale must still succeed, or the guard over-rejects
  begin
    v_sale := public.api_garage_command(v_org, v_pers, 'counter', gen_random_uuid(),
      jsonb_build_object('type','COUNTER_SALE','tax_mode','zero_rated','location_id',v_loc,
        'items', jsonb_build_array(jsonb_build_object('product_id', v_stk, 'quantity', 1)),
        'payment_method','cash',
        'tender', jsonb_build_array(jsonb_build_object('method','cash','amount_tendered', 200))),
      gen_random_uuid());
    if (v_sale->'counter_sale'->>'total_amount')::numeric <> 100 then
      raise notice 'CONTROL FAIL: total wrong %', v_sale; v_fail := v_fail + 1;
    else
      raise notice 'CONTROL PASS: valid single-line sale still accepted, total 100';
      v_pass := v_pass + 1;
    end if;
  exception when others then
    raise notice 'CONTROL FAIL: valid sale rejected with %', sqlerrm; v_fail := v_fail + 1;
  end;

  select count(*) into v_after_doc   from public.commercial_documents where organisation_id = v_org;
  select count(*) into v_after_mv    from public.stock_movements        where organisation_id = v_org;
  select count(*) into v_after_audit from public.audit_events           where organisation_id = v_org;

  select coalesce((select sum(sm.quantity) from public.stock_movements sm
                    where sm.organisation_id = v_org and sm.product_id = v_empty), 0)
    into v_onhand_empty;
  select coalesce((select sum(sm.quantity) from public.stock_movements sm
                    where sm.organisation_id = v_org and sm.product_id = v_stk), 0)
    into v_onhand_stk;

  raise notice 'RESIDUE documents:   before=% after=%', v_before_doc, v_after_doc;
  raise notice 'RESIDUE movements:   before=% after=%', v_before_mv, v_after_mv;
  raise notice 'RESIDUE audit events: before=% after=%', v_before_audit, v_after_audit;
  raise notice 'ONHAND never-stocked: %   (must be 0, never negative)', v_onhand_empty;
  raise notice 'ONHAND stocked:       %   (500 less the one control sale = 499)', v_onhand_stk;

  if v_onhand_empty = 0 and v_after_doc = v_before_doc + 2
     and v_after_mv = v_before_mv + 1
     and v_after_audit = v_before_audit + 1
     and v_onhand_stk = 499 then
    raise notice 'RESIDUE PASS: only the control sale survived (2 docs = invoice + receipt, 1 issue movement, 1 audit event); all four rejects left nothing';
    v_pass := v_pass + 1;
  else
    raise notice 'RESIDUE FAIL: unexpected residue';
    v_fail := v_fail + 1;
  end if;

  raise notice '==== SERP-453 PROBE: % passed, % failed ====', v_pass, v_fail;
  if v_fail > 0 then raise exception 'serp453_probe_failed'; end if;
end $$;

rollback;
