\set ON_ERROR_STOP on

-- =============================================================================
-- SERP-361: Starq Account schema & RLS isolation probe
-- Authority: docs/architecture/adr/010-starq-account.md
--
-- Proves acceptance criteria:
--   1. Schema objects exist and are correctly shaped (accounts, identities, profiles, consents, persons.account_id).
--   2. RLS enabled on all 4 new tables.
--   3. Deny-by-default policy proven by querying as a non-service role and getting zero rows.
--   4. Down path proven: dropping the new tables leaves the core system intact and functional.
-- =============================================================================

begin;

-- STEP 1: Verify table existence and RLS flags
do $$
declare
  t text;
  v_rls boolean;
begin
  for t in select unnest(array['starq_accounts', 'account_identities', 'account_profiles', 'account_consents'])
  loop
    select c.relrowsecurity into v_rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = t;

    if v_rls is null then
      raise exception 'SERP-361 table public.% does not exist', t;
    end if;

    if not v_rls then
      raise exception 'SERP-361 table public.% does NOT have RLS enabled', t;
    end if;
  end loop;

  -- Verify persons.account_id column exists and is nullable
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'persons'
       and column_name = 'account_id'
       and is_nullable = 'YES'
  ) then
    raise exception 'SERP-361 persons.account_id column missing or not nullable';
  end if;

  -- Verify external_subject is untouched
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'persons'
       and column_name = 'external_subject'
  ) then
    raise exception 'SERP-361 persons.external_subject column was modified or missing';
  end if;
end
$$;

-- STEP 2: Seed synthetic test rows under privileged role
insert into public.organisations (id, slug, legal_name)
values ('10000000-0000-4000-8000-000000000001', 'serp361-org', 'SERP-361 Test Org')
on conflict (id) do nothing;

insert into public.persons (id, person_key, external_subject, display_label)
values ('10000000-0000-4000-8000-000000000002', 'serp361-person', 'serp361:test:subject', 'SERP-361 Test Person')
on conflict (id) do nothing;

insert into public.starq_accounts (id, status)
values ('10000000-0000-4000-8000-000000000003', 'active');

insert into public.account_identities (id, account_id, provider, subject, email, email_verified)
values ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'google', 'google-uid-12345', 'user@starq.mv', true);

insert into public.account_profiles (id, account_id, display_name, legal_name, primary_email)
values ('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 'Ali Musthaq', 'Ali Musthaq', 'user@starq.mv');

insert into public.account_consents (id, account_id, consent_type, version, granted)
values ('10000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', 'terms_of_service', '2026-08-30', true);

update public.persons
   set account_id = '10000000-0000-4000-8000-000000000003'
 where id = '10000000-0000-4000-8000-000000000002';

-- Privileged check: confirm rows were inserted
do $$
begin
  if (select count(*) from public.starq_accounts where id = '10000000-0000-4000-8000-000000000003') <> 1 then
    raise exception 'Privileged insert check failed for starq_accounts';
  end if;
  if (select count(*) from public.account_identities where id = '10000000-0000-4000-8000-000000000004') <> 1 then
    raise exception 'Privileged insert check failed for account_identities';
  end if;
  if (select count(*) from public.account_profiles where id = '10000000-0000-4000-8000-000000000005') <> 1 then
    raise exception 'Privileged insert check failed for account_profiles';
  end if;
  if (select count(*) from public.account_consents where id = '10000000-0000-4000-8000-000000000006') <> 1 then
    raise exception 'Privileged insert check failed for account_consents';
  end if;
end
$$;

-- STEP 3: Query as a non-service role to prove deny-by-default policy
-- Create a non-service probe role with nosuperuser and nobypassrls
drop role if exists serp361_unprivileged_probe_role;
create role serp361_unprivileged_probe_role noinherit nologin nosuperuser nobypassrls;
grant serp361_unprivileged_probe_role to current_user;
grant usage on schema public to serp361_unprivileged_probe_role;
-- Deliberately grant SELECT so that permission errors do NOT masquerade as an RLS pass
grant select on public.starq_accounts to serp361_unprivileged_probe_role;
grant select on public.account_identities to serp361_unprivileged_probe_role;
grant select on public.account_profiles to serp361_unprivileged_probe_role;
grant select on public.account_consents to serp361_unprivileged_probe_role;

set local role serp361_unprivileged_probe_role;
set local row_security = on;

do $$
declare
  v_cnt bigint;
  t text;
begin
  for t in select unnest(array['starq_accounts', 'account_identities', 'account_profiles', 'account_consents'])
  loop
    execute format('select count(*) from public.%I', t) into v_cnt;
    if v_cnt <> 0 then
      raise exception 'SERP-361 deny-by-default FAILED for %: non-service role saw % rows', t, v_cnt;
    end if;
  end loop;
end
$$;

reset role;

-- STEP 4: Prove down-path (dropping new tables leaves existing system working)
do $$
begin
  -- Simulate down migration
  alter table public.persons drop column if exists account_id;
  drop table if exists public.account_consents;
  drop table if exists public.account_profiles;
  drop table if exists public.account_identities;
  drop table if exists public.starq_accounts;

  -- Verify all new tables are gone
  if exists (
    select 1 from pg_tables
     where schemaname = 'public'
       and tablename in ('starq_accounts', 'account_identities', 'account_profiles', 'account_consents')
  ) then
    raise exception 'Down-path failed: new tables still exist after drop';
  end if;

  -- Verify persons still works normally
  if not exists (
    select 1 from public.persons where id = '10000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Down-path failed: persons row missing';
  end if;
end
$$;

rollback;

select 'SERP-361 Starq Account probe: ALL INVARIANTS PASS' as status;
