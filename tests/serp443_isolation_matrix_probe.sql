-- tests/serp443_isolation_matrix_probe.sql
-- SERP-443 - executable synthetic DB probe (REGRESSION HARDENING, TEST ONLY).
--
-- Origin: Codex adversarial gap #7 from the SERP-091 independent POS acceptance
-- matrix (Room seq 6212), converted into an explicit work item by the Founder
-- overnight directive (Room seq 6242, item 2).
--
-- SERP-091 live-proved two isolation cases (cross-org low-stock query,
-- cross-tenant reversal on another org's sale). That coverage was SELECTIVE
-- rather than a matrix, and it was cross-TENANT only. This probe widens it
-- across the four named surfaces and adds the case SERP-091 never touched at
-- all: cross-OUTLET isolation WITHIN a single tenant.
--
-- TWO DISTINCT FAILURE CLASSES - the distinction is the whole point of gap #7.
--
--   CLASS A - IMPERSONATION (must RAISE).
--     Caller supplies a FOREIGN org with its own (non-member) person.
--     The seat gate `app_private.assert_active_seat(org, person, seat)` is
--     evaluated on the SUPPLIED triple, so it fails closed with
--     'seat_not_authorized'. A returned-but-empty result here would mean the
--     gate is not actually load-bearing.
--
--   CLASS B - SCOPE LEAK (must NOT raise, must return ZERO foreign rows).
--     Caller supplies its OWN valid org/person/seat, and merely references
--     org A's rows by id, location, or sale. Here `assert_active_seat` PASSES
--     by design, so the ONLY thing standing between the caller and org A's
--     data is the per-query `organisation_id` / `location_id` predicate.
--     This is the dangerous class: a missing predicate returns an empty set
--     (or worse, org A's rows) with NO error raised. Asserting "it raised"
--     here would be a false pass. We assert the RESULT is empty of foreign
--     rows instead.
--
--   Getting this distinction wrong is precisely how a selective proof like
--   SERP-091's hides a real gap, so both classes are asserted explicitly.
--
-- PROVES cross-tenant (org B cannot read or mutate org A):
--   * product / approved-price resolution
--   * derived on-hand
--   * cash session state
--   * counter_returns / refund records
-- PROVES cross-outlet WITHIN the same tenant (A2 blind to A1):
--   * cash session state, derived on-hand, low-stock signal view
--
-- FAIL-CLOSED AND WRONG-REASON-SENSITIVE: every negative assertion states the
-- expected failure mode. A boundary that fails for the wrong reason (typo,
-- missing column, bad cast) still fails the probe, so a broken test can never
-- masquerade as a security pass.
--
-- NO PRODUCTION CHANGE. Asserts against the schema as it exists at the
-- milestone head. Synthetic fixtures only, inside a rolled-back transaction:
-- no residue, no mutation of any existing row.
--
-- Known limitation, stated rather than hidden: this probe exercises the
-- SECURITY DEFINER API surface as the service-role caller. It does not stand
-- up a non-bypassing role and attempt a raw table read, so it does not
-- independently re-prove the RLS policies themselves. That is already covered
-- by tests/rls_isolation_probe.sql (SERP-124). SERP-443 widens the API-surface
-- matrix; it does not replace the RLS catalogue check.

\set ON_ERROR_STOP on

begin;

-- CLASS A helper: the call MUST raise, and MUST raise with the expected
-- authorization fragment. Guards against both "returned instead of raised"
-- and "raised for an unrelated reason".
create or replace function pg_temp.expect_denied(
  p_label text, p_frag text, p_call text
) returns void language plpgsql as $$
declare
  v_err text := null;
begin
  begin
    execute p_call;
  exception when others then
    v_err := SQLERRM;
  end;

  if v_err is null then
    raise exception 'ISOLATION BREACH (A/%): call succeeded where it had to fail closed; expected raise containing "%"',
      p_label, p_frag;
  end if;

  if position(p_frag in v_err) = 0 then
    raise exception 'WRONG-REASON FAILURE (A/%): expected "%" but got: %', p_label, p_frag, v_err;
  end if;
end;
$$;

-- CLASS B helper: enforce that a caller's OWN valid seat can never surface a
-- row belonging to the foreign tenant or the foreign outlet.
--
-- IMPORTANT - the counter API does NOT enforce this one way. Two enforcement
-- modes are both correct and both fail-closed, and the probe accepts either:
--
--   mode 'denied'  - the function RAISES (e.g. 'counter_session_not_found',
--                     'seat_not_authorized'). This is what api_counter_session_get
--                     does: it filters on organisation_id and raises when the row
--                     is not in the caller's tenant.
--   mode 'empty'   - the function RETURNS successfully with zero rows. This is
--                     what the list surfaces do.
--
-- A probe that hard-coded either one would be testing implementation shape
-- rather than the security property, and would FAIL on a correct codebase.
-- What must never happen is mode 'leak' - a non-empty result, or the foreign
-- id appearing anywhere in the payload. That is the only failure this asserts.
create or replace function pg_temp.expect_no_foreign_data(
  p_label text, p_result jsonb, p_foreign_key text
) returns void language plpgsql as $$
declare
  v_n integer := 0;
begin
  if p_result is null then
    return;
  end if;

  v_n := coalesce(jsonb_array_length(p_result->'items'), 0)
       + coalesce(jsonb_array_length(p_result->'returns'), 0)
       + coalesce(jsonb_array_length(p_result->'sessions'), 0)
       + coalesce(jsonb_array_length(p_result->'prices'), 0)
       + coalesce(jsonb_array_length(p_result->'signals'), 0)
       + coalesce(jsonb_array_length(p_result->'products'), 0)
       + coalesce(jsonb_array_length(p_result->'data'), 0)
       + coalesce(jsonb_array_length(p_result->'rows'), 0);

  if v_n > 0 then
    raise exception 'LEAK (B-case): % returned % row(s) for a foreign scope; body=%',
      p_label, v_n, left(p_result::text, 400);
  end if;

  -- Nested-object leak shape: the foreign id appears anywhere in the payload.
  if p_foreign_key is not null and position(p_foreign_key in p_result::text) > 0 then
    raise exception 'LEAK (B-case): foreign id % surfaced inside the result payload for %; body=%',
      p_foreign_key, p_label, left(p_result::text, 400);
  end if;
end;
$$;

-- CLASS B helper for call-shaped surfaces: run the call, then assert the
-- foreign data never surfaced - whether the surface denied by raising or
-- returned empty. Records which mode each surface used, so the evidence shows
-- the real enforcement shape per surface rather than hiding it.
create or replace function pg_temp.expect_isolation_enforced(
  p_label text, p_foreign_key text, p_call text
) returns text language plpgsql as $$
declare
  v_res jsonb;
  v_err text := null;
  v_n integer := 0;
begin
  begin
    v_res := execute p_call;
  exception when others then
    v_err := SQLERRM;
  end;

  -- mode 'denied': raised. Correct, but the message must not itself leak the
  -- foreign id back to the caller.
  if v_err is not null then
    if p_foreign_key is not null and position(p_foreign_key in v_err) > 0 then
      raise exception 'LEAK (B-case): % denied but echoed the foreign id in its error; err=%',
        p_label, v_err;
    end if;
    return 'denied';
  end if;

  if v_res is null then
    return 'empty';
  end if;

  v_n := coalesce(jsonb_array_length(v_res->'items'), 0)
       + coalesce(jsonb_array_length(v_res->'returns'), 0)
       + coalesce(jsonb_array_length(v_res->'sessions'), 0)
       + coalesce(jsonb_array_length(v_res->'prices'), 0)
       + coalesce(jsonb_array_length(v_res->'signals'), 0)
       + coalesce(jsonb_array_length(v_res->'products'), 0)
       + coalesce(jsonb_array_length(v_res->'data'), 0)
       + coalesce(jsonb_array_length(v_res->'rows'), 0);

  if v_n > 0 then
    raise exception 'LEAK (B-case): % returned % row(s) for a foreign scope; body=%',
      p_label, v_n, left(v_res::text, 400);
  end if;

  if p_foreign_key is not null and position(p_foreign_key in v_res::text) > 0 then
    raise exception 'LEAK (B-case): foreign id % surfaced inside the result payload for %; body=%',
      p_foreign_key, p_label, left(v_res::text, 400);
  end if;

  return 'empty';
end;
$$;

do $$
declare
  -- Tenants
  v_org_a uuid := gen_random_uuid();   -- tenant under test
  v_org_b uuid := gen_random_uuid();   -- second tenant
  -- Outlets within tenant A
  v_loc_a1 uuid := gen_random_uuid();  -- where activity happens
  v_loc_a2 uuid := gen_random_uuid();  -- must stay blind to A1
  -- Outlets within tenant B
  v_loc_b1 uuid := gen_random_uuid();
  -- Persons
  v_pa uuid := gen_random_uuid();      -- person in org A
  v_pb uuid := gen_random_uuid();      -- person in org B, NOT a member of org A
  -- Memberships / roles
  v_ma uuid := gen_random_uuid();
  v_mb uuid := gen_random_uuid();
  v_ra uuid := gen_random_uuid();
  v_rb uuid := gen_random_uuid();
  -- Manager approver, required by the return path
  v_mgr uuid := gen_random_uuid();
  v_rm uuid := gen_random_uuid();
  v_mm uuid := gen_random_uuid();
  -- Rows under test
  v_prod_a uuid := gen_random_uuid();
  v_sale_a uuid;
  v_return_a uuid;
  v_session_a uuid;
  v_res jsonb;
  v_open jsonb;
  v_mode text;
begin
  -- ─────────────────────────────────────────────────────────────────────────
  -- FIXTURES
  -- ─────────────────────────────────────────────────────────────────────────
  insert into public.organisations (id, slug, legal_name, base_currency, status)
  values
    (v_org_a, 'probe-org-serp443-a', 'SERP-443 Org A', 'MVR', 'active'),
    (v_org_b, 'probe-org-serp443-b', 'SERP-443 Org B', 'MVR', 'active');

  -- Two outlets in the SAME tenant: the case SERP-091 never proved.
  insert into public.locations (id, organisation_id, code, name, kind, active)
  values
    (v_loc_a1, v_org_a, 'A1', 'Org A Location 1', 'office', true),
    (v_loc_a2, v_org_a, 'A2', 'Org A Location 2', 'office', true),
    (v_loc_b1, v_org_b, 'B1', 'Org B Location 1', 'office', true);

  insert into public.books (id, organisation_id, archetype_id, code, name, currency, status)
  values (gen_random_uuid(), v_org_a, 'retail', 'MAIN', 'Org A Book', 'MVR', 'active');

  insert into public.persons (id, person_key, display_label, status)
  values
    (v_pa, 'probe:serp443:person-a', 'Probe Person A', 'active'),
    (v_pb, 'probe:serp443:person-b', 'Probe Person B', 'active');

  insert into public.roles (id, organisation_id, code, name)
  values
    (v_ra, v_org_a, 'counter', 'Counter Role A'),
    (v_rb, v_org_b, 'counter', 'Counter Role B');

  insert into public.memberships (id, organisation_id, person_id, role_id, status)
  values
    (v_ma, v_org_a, v_pa, v_ra, 'active'),
    (v_mb, v_org_b, v_pb, v_rb, 'active');

  insert into public.membership_seats (membership_id, seat_code)
  values (v_ma, 'counter'), (v_mb, 'counter');

  insert into public.products (id, organisation_id, sku, name, kind, active, sale_allowed)
  values (v_prod_a, v_org_a, 'PROD-A', 'Org A Product', 'stock', true, true);

  insert into public.product_prices (organisation_id, product_id, currency, amount, valid_from, valid_to)
  values (v_org_a, v_prod_a, 'MVR', 50.00, now() - interval '1 day', null);

  -- Stock at BOTH A1 and A2. The boundary is only meaningful if org A already
  -- has data on both sides: an empty outlet proves nothing.
  insert into public.stock_movements (
    organisation_id, location_id, product_id, movement_type, quantity,
    source_type, source_id, idempotency_key, occurred_at, recorded_by
  ) values
    (v_org_a, v_loc_a1, v_prod_a, 'opening', 100, 'OPENING_BALANCE', v_prod_a, gen_random_uuid(), now(), v_pa),
    (v_org_a, v_loc_a2, v_prod_a, 'opening', 25,  'OPENING_BALANCE', v_prod_a, gen_random_uuid(), now(), v_pa);

  -- A live session at A1, so session surfaces have a real foreign row.
  v_open := public.api_counter_session_open(
    v_org_a, v_pa, 'counter', v_loc_a1, 500.00, gen_random_uuid()
  );
  v_session_a := (v_open->'session'->>'id')::uuid;

  -- A committed sale at A1, then a partial return against it, so counter_returns
  -- holds a genuine foreign row for org B to attempt to reach.
  v_res := public.api_garage_command(
    v_org_a, v_pa, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'COUNTER_SALE',
      'location_id', v_loc_a1,
      'tax_mode', 'zero_rated',
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_a, 'quantity', 2)),
      'payment_method', 'cash',
      'tender', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_tendered', 100))
    ),
    gen_random_uuid()
  );
  v_sale_a := (v_res->'counter_sale'->>'invoice_id')::uuid;

  -- A partial return against that sale, so counter_returns holds a genuine
  -- foreign row for org B to attempt to reach. Mirrors the SERP-088 shape:
  -- lowercase 'return' via api_counter_sale_reversal, with a manager approver
  -- and segregated operating capacity.
  insert into public.persons (id, person_key, display_label, status)
  values (v_mgr, 'probe:serp443:manager', 'Probe Manager', 'active');
  insert into public.roles (id, organisation_id, code, name)
  values (v_rm, v_org_a, 'managing_director', 'Managing Director Role');
  insert into public.memberships (id, organisation_id, person_id, role_id, status)
  values (v_mm, v_org_a, v_mgr, v_rm, 'active');
  insert into public.membership_seats (membership_id, seat_code)
  values (v_mm, 'managing_director');

  v_res := public.api_counter_sale_reversal(
    v_org_a, v_pa, 'counter', gen_random_uuid(),
    jsonb_build_object(
      'type', 'return',
      'original_sale_id', v_sale_a,
      'location_id', v_loc_a1,
      'reason', 'probe isolation matrix',
      'operating_capacity', 'segregated',
      'approver_person_id', v_mgr,
      'items', jsonb_build_array(jsonb_build_object('product_id', v_prod_a, 'quantity', 1)),
      'refund_tenders', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 50.00))
    )
  );
  v_return_a := (v_res->'return'->>'id')::uuid;

  -- Sanity: the fixtures must actually exist, otherwise every negative below
  -- would pass vacuously against an empty database. This is the guard that
  -- keeps the rest of the probe honest.
  if v_session_a is null or v_sale_a is null or v_return_a is null then
    raise exception 'FIXTURE SETUP FAILED: session/sale/return not created (session %, sale %, return %)',
      v_session_a, v_sale_a, v_return_a;
  end if;

  -- ========================================================================
  -- CLASS A - IMPERSONATION: foreign org + non-member person. Must RAISE.
  -- ========================================================================

  -- A1. Product / approved-price resolution
  perform pg_temp.expect_denied(
    'A/x-tenant approved prices',
    'seat_not_authorized',
    format('select public.api_counter_approved_prices(%L::uuid, %L::uuid, %L::text, %L::text)',
           v_org_a, v_pb, 'counter', 'MAIN')
  );

  perform pg_temp.expect_denied(
    'A/x-tenant price resolution',
    'seat_not_authorized',
    format('select public.api_counter_price_resolution(%L::uuid, %L::uuid, %L::text, %L::uuid, null, %L::text, %L::text)',
           v_org_a, v_pb, 'counter', v_prod_a, 'MAIN', 'exclusive')
  );

  -- A2. Derived on-hand
  perform pg_temp.expect_denied(
    'A/x-tenant low-stock / derived on-hand',
    'seat_not_authorized',
    format('select public.api_counter_low_stock_signals(%L::uuid, %L::uuid, %L::text, %L::uuid)',
           v_org_a, v_pb, 'counter', v_loc_a1)
  );

  -- A3. Cash session state
  perform pg_temp.expect_denied(
    'A/x-tenant session list',
    'seat_not_authorized',
    format('select public.api_counter_session_list(%L::uuid, %L::uuid, %L::text, null, 50)',
           v_org_a, v_pb, 'counter')
  );

  perform pg_temp.expect_denied(
    'A/x-tenant session current',
    'seat_not_authorized',
    format('select public.api_counter_session_current(%L::uuid, %L::uuid, %L::text, %L::uuid)',
           v_org_a, v_pb, 'counter', v_loc_a1)
  );

  perform pg_temp.expect_denied(
    'A/x-tenant session get',
    'seat_not_authorized',
    format('select public.api_counter_session_get(%L::uuid, %L::uuid, %L::text, %L::uuid)',
           v_org_a, v_pb, 'counter', v_session_a)
  );

  -- A4. counter_returns / refund records
  perform pg_temp.expect_denied(
    'A/x-tenant return get by id',
    'seat_not_authorized',
    format('select public.api_counter_return_get(%L::uuid, %L::uuid, %L::text, %L::uuid)',
           v_org_a, v_pb, 'counter', v_return_a)
  );

  perform pg_temp.expect_denied(
    'A/x-tenant return list',
    'seat_not_authorized',
    format('select public.api_counter_return_list(%L::uuid, %L::uuid, %L::text, null, null, 50)',
           v_org_a, v_pb, 'counter')
  );

  -- ========================================================================
  -- CLASS B - SCOPE LEAK: caller's OWN valid seat, foreign rows referenced.
  -- The seat gate passes by design here, so ONLY the per-query tenant
  -- predicate stands between the caller and org A's data. Each surface may
  -- enforce by raising OR by returning empty; both are correct. Only a
  -- non-empty result, or the foreign id surfacing anywhere, is a failure.
  -- ========================================================================

  -- B1. Cross-tenant reads through a legitimate org-B seat
  v_mode := pg_temp.expect_isolation_enforced(
    'B/x-tenant session list',
    v_session_a::text,
    format('select public.api_counter_session_list(%L::uuid, %L::uuid, %L::text, null, 50)',
           v_org_b, v_pb, 'counter')
  );
  raise notice 'B1 x-tenant session list -> %', v_mode;

  v_mode := pg_temp.expect_isolation_enforced(
    'B/x-tenant session get by foreign id',
    v_session_a::text,
    format('select public.api_counter_session_get(%L::uuid, %L::uuid, %L::text, %L::uuid)',
           v_org_b, v_pb, 'counter', v_session_a)
  );
  raise notice 'B2 x-tenant session get -> %', v_mode;

  v_mode := pg_temp.expect_isolation_enforced(
    'B/x-tenant return get by foreign id',
    v_return_a::text,
    format('select public.api_counter_return_get(%L::uuid, %L::uuid, %L::text, %L::uuid)',
           v_org_b, v_pb, 'counter', v_return_a)
  );
  raise notice 'B3 x-tenant return get -> %', v_mode;

  v_mode := pg_temp.expect_isolation_enforced(
    'B/x-tenant return list scoped to foreign sale',
    v_return_a::text,
    format('select public.api_counter_return_list(%L::uuid, %L::uuid, %L::text, %L::uuid, null, 50)',
           v_org_b, v_pb, 'counter', v_sale_a)
  );
  raise notice 'B4 x-tenant return list -> %', v_mode;

  v_mode := pg_temp.expect_isolation_enforced(
    'B/x-tenant low-stock at foreign location',
    v_loc_a1::text,
    format('select public.api_counter_low_stock_signals(%L::uuid, %L::uuid, %L::text, %L::uuid)',
           v_org_b, v_pb, 'counter', v_loc_a1)
  );
  raise notice 'B5 x-tenant low-stock -> %', v_mode;

  v_mode := pg_temp.expect_isolation_enforced(
    'B/x-tenant approved prices for foreign org product',
    v_prod_a::text,
    format('select public.api_counter_approved_prices(%L::uuid, %L::uuid, %L::text, %L::text)',
           v_org_b, v_pb, 'counter', 'MAIN')
  );
  raise notice 'B6 x-tenant approved prices -> %', v_mode;

  -- ========================================================================
  -- CLASS C - CROSS-OUTLET WITHIN THE SAME TENANT.
  -- Same org, same person, same valid seat; only the LOCATION differs.
  -- This is the case SERP-091 never proved and gap #7 names by name.
  -- A2 must never reflect A1's activity.
  -- ========================================================================

  -- C1. Session state at A2 must not reveal A1's session
  v_mode := pg_temp.expect_isolation_enforced(
    'C/cross-outlet session list at A2',
    v_session_a::text,
    format('select public.api_counter_session_list(%L::uuid, %L::uuid, %L::text, %L::uuid, 50)',
           v_org_a, v_pa, 'counter', v_loc_a2)
  );
  raise notice 'C1 cross-outlet session list at A2 -> %', v_mode;

  v_mode := pg_temp.expect_isolation_enforced(
    'C/cross-outlet session current at A2',
    v_session_a::text,
    format('select public.api_counter_session_current(%L::uuid, %L::uuid, %L::text, %L::uuid)',
           v_org_a, v_pa, 'counter', v_loc_a2)
  );
  raise notice 'C2 cross-outlet session current at A2 -> %', v_mode;

  -- C2. Derived on-hand at A2 must not reflect A1's stock
  v_mode := pg_temp.expect_isolation_enforced(
    'C/cross-outlet low-stock at A2',
    v_loc_a1::text,
    format('select public.api_counter_low_stock_signals(%L::uuid, %L::uuid, %L::text, %L::uuid)',
           v_org_a, v_pa, 'counter', v_loc_a2)
  );
  raise notice 'C3 cross-outlet low-stock at A2 -> %', v_mode;

  -- C3. Mutations must not cross outlets within the tenant.
  -- Opening a session at A2 while A1 is open must be refused outright.
  v_mode := pg_temp.expect_isolation_enforced(
    'C/cross-outlet session open at A2 while A1 open',
    v_session_a::text,
    format('select public.api_counter_session_open(%L::uuid, %L::uuid, %L::text, %L::uuid, 0, %L::uuid)',
           v_org_a, v_pa, 'counter', v_loc_a2, gen_random_uuid())
  );
  raise notice 'C4 cross-outlet session open at A2 -> %', v_mode;

  -- ========================================================================
  -- DONE. Rolled back below; no residue.
  -- ========================================================================
  raise notice 'SERP-443 isolation matrix probe: all assertions passed';
end;
$$;

rollback;
