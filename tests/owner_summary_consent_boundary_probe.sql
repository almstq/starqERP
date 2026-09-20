\set ON_ERROR_STOP on

-- =============================================================================
-- SERP-437 / SERP-124 — owner_summary_consents public-read boundary probe
--
-- owner_summary_consents carries two policies:
--   owner_summary_consents_current  -- ordinary own-tenant read (has_organisation_access)
--   owner_summary_consents_public   -- state = 'consented', NO organisation claim check
--
-- The second policy is a deliberate, evidenced cross-tenant exception (same
-- shape as product_publications_published) and is why this table is excluded
-- from the generic strict tenant-isolation loop in rls_isolation_probe.sql.
-- This probe proves, on a real database and the real read path, that the
-- exception is exactly as narrow as intended:
--
--   AC1  a 'consented' row for ANY tenant is readable under ANY OTHER tenant's
--        claim (that is the intentional public boundary, proved with a
--        positive control so "nothing visible" can never pass as "nothing leaked")
--   AC2  a 'revoked'/non-consented row for another tenant is NOT visible
--        under a different tenant's claim (the boundary is a state gate, not
--        a blanket cross-tenant grant)
--   AC3  own-tenant read still works regardless of consent state
--   AC4  no client-writable path exists at all (insert/update/delete are
--        service_role only) - the public policy cannot be used to plant or
--        alter a row, only to read one already committed by the RPC layer
--   AC5  the public policy does not broaden access to this tenant's OTHER
--        data - reading via owner_summary_consents_public grants no
--        visibility into that tenant's commercial_documents
--
-- Runs entirely inside a transaction and rolls back. Nothing persists.
-- Requires tests/rls_isolation_fixture.sql to have been applied first (for
-- the synthetic tenant A/B organisations and the probe person).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Section 0 — seed one 'consented' row (tenant A) and one 'revoked' row (tenant B)
-- -----------------------------------------------------------------------------

insert into public.owner_summary_consents (organisation_id, channel, state, consented_at)
values ('00000000-0000-4000-8000-000000000001', 'hoadha_owner_view', 'consented', now());

insert into public.owner_summary_consents (organisation_id, channel, state)
values ('00000000-0000-4000-8000-000000000002', 'hoadha_owner_view', 'revoked');

-- -----------------------------------------------------------------------------
-- Section 1 — AC4: no client-writable path (structural, no session claim needed)
-- -----------------------------------------------------------------------------

do $$
declare
  v_write_policies integer;
begin
  select count(*) into v_write_policies
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
   where c.relname = 'owner_summary_consents'
     and p.polcmd in ('a', 'w', 'd');  -- insert, update, delete
  if v_write_policies <> 0 then
    raise exception 'SERP-437 AC4: owner_summary_consents has a client-facing write policy - expected zero';
  end if;
  raise notice '  OK  AC4a (structural): zero client-writable policies on owner_summary_consents';
end
$$;

-- -----------------------------------------------------------------------------
-- Section 2 — role setup, matching rls_isolation_probe.sql's pattern
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'serp437_boundary_probe') then
    execute 'create role serp437_boundary_probe noinherit nologin nosuperuser nobypassrls';
  end if;
end
$$;
grant serp437_boundary_probe to current_user;
grant usage on schema public, app_private to serp437_boundary_probe;
grant select on all tables in schema public to serp437_boundary_probe;
-- Deliberately NOT granting insert/update/delete on owner_summary_consents -
-- AC4b below proves this table-level denial is actually enforced at runtime,
-- not merely absent from pg_policy (per Codex's review, Room seq 6431: a
-- structural policy-count check alone is not runtime-proven).

set local role serp437_boundary_probe;

-- AC4b: a real INSERT attempt as the non-bypass role must be DENIED, not
-- silently succeed. Uses the same sentinel/nested-trap pattern Antigravity
-- established this session (Room seq 6385) so an unexpected SUCCESS is
-- never mistaken for the expected permission-denied error.
do $$
declare
  v_err text;
begin
  begin
    insert into public.owner_summary_consents (organisation_id, channel, state)
    values ('00000000-0000-4000-8000-000000000001', 'hoadha_owner_view', 'consented');
    v_err := null;
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null then
    raise exception 'SERP-437 AC4b: INSERT into owner_summary_consents UNEXPECTEDLY SUCCEEDED as the non-bypass role - the client-writable-denial claim is false';
  end if;
  if v_err not ilike '%permission denied%' then
    raise exception 'SERP-437 AC4b: INSERT failed for the WRONG reason (expected permission denied, got: %)', v_err;
  end if;
  raise notice '  OK  AC4b (runtime): INSERT genuinely denied - %', v_err;
end
$$;

-- -----------------------------------------------------------------------------
-- Section 3 — AC1/AC2/AC3 under tenant B's claim (person is a member of both A and B)
-- -----------------------------------------------------------------------------

select set_config('app.person_id', '00000000-0000-4000-8000-000000000101', true);
select set_config('app.organisation_id', '00000000-0000-4000-8000-000000000002', true);

do $$
declare
  v_visible_a boolean;
  v_visible_b boolean;
begin
  -- AC1: tenant A's CONSENTED row is visible under tenant B's claim.
  select exists (
    select 1 from public.owner_summary_consents
     where organisation_id = '00000000-0000-4000-8000-000000000001'
       and channel = 'hoadha_owner_view'
  ) into v_visible_a;
  if not v_visible_a then
    raise exception 'SERP-437 AC1: tenant A consented row NOT visible under tenant B claim - the intended public boundary is missing';
  end if;

  -- AC3: tenant B's OWN row (revoked) is still visible to itself via the
  -- ordinary own-tenant policy, regardless of consent state.
  select exists (
    select 1 from public.owner_summary_consents
     where organisation_id = '00000000-0000-4000-8000-000000000002'
       and channel = 'hoadha_owner_view'
  ) into v_visible_b;
  if not v_visible_b then
    raise exception 'SERP-437 AC3: tenant B cannot read its own owner_summary_consents row';
  end if;

  raise notice '  OK  AC1/AC3: consented row cross-tenant visible, own row always visible';
end
$$;

-- AC2: tenant A's claim must NOT see tenant B's REVOKED row - the public
-- policy is a state gate, not a blanket cross-tenant grant.
select set_config('app.organisation_id', '00000000-0000-4000-8000-000000000001', true);

do $$
declare
  v_leaked boolean;
begin
  select exists (
    select 1 from public.owner_summary_consents
     where organisation_id = '00000000-0000-4000-8000-000000000002'
       and channel = 'hoadha_owner_view'
  ) into v_leaked;
  if v_leaked then
    raise exception 'SERP-437 AC2: tenant B''s revoked row leaked to tenant A - the public policy is not state-gated';
  end if;
  raise notice '  OK  AC2: revoked row correctly invisible cross-tenant';
end
$$;

-- -----------------------------------------------------------------------------
-- Section 4 — AC5: the public exception does not broaden access to this
-- tenant's OTHER private data (still under tenant A's claim from above)
-- -----------------------------------------------------------------------------

do $$
declare
  v_org_b_docs_visible boolean;
begin
  select exists (
    select 1 from public.commercial_documents where organisation_id = '00000000-0000-4000-8000-000000000002'
  ) into v_org_b_docs_visible;
  if v_org_b_docs_visible then
    raise exception 'SERP-437 AC5: tenant B commercial_documents visible under tenant A claim - unrelated data boundary broadened';
  end if;
  raise notice '  OK  AC5: no broadened visibility into tenant B''s other private data';
end
$$;

reset role;
rollback;
