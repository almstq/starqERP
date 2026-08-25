\set ON_ERROR_STOP on

-- SERP-124: prove the checked-in tenant policies as a role that cannot bypass RLS.
-- The database used by this probe is disposable and contains synthetic fixtures only.

begin;

create temporary table expected_public_tables (table_name text primary key) on commit drop;
insert into expected_public_tables (table_name) values
  ('organisations'), ('business_names'), ('persons'), ('memberships'), ('seats'),
  ('membership_seats'), ('idempotency_keys'), ('attachments'), ('audit_events'),
  ('contacts'), ('vehicles'), ('products'), ('product_prices'), ('locations'),
  ('inventory_items'), ('stock_movements'), ('garage_jobs'), ('job_events'),
  ('accounting_periods'), ('commercial_documents'), ('commercial_document_lines'),
  ('journal_proposals'), ('journal_proposal_lines'), ('journal_entries'),
  ('journal_lines'), ('document_sequences'), ('security_events'),
  ('automation_principals'), ('automation_capability_grants'), ('command_approvals'),
  ('settlement_allocations');

create temporary table expected_policies (
  table_name text not null,
  policy_name text not null,
  primary key (table_name, policy_name)
) on commit drop;
insert into expected_policies (table_name, policy_name) values
  ('organisations', 'organisations_current'),
  ('business_names', 'business_names_current'),
  ('memberships', 'memberships_current'),
  ('idempotency_keys', 'idempotency_current'),
  ('attachments', 'attachments_current'),
  ('audit_events', 'audit_current'),
  ('contacts', 'contacts_current'),
  ('vehicles', 'vehicles_current'),
  ('products', 'products_current'),
  ('product_prices', 'product_prices_current'),
  ('locations', 'locations_current'),
  ('inventory_items', 'inventory_items_current'),
  ('stock_movements', 'stock_movements_current'),
  ('garage_jobs', 'garage_jobs_current'),
  ('job_events', 'job_events_current'),
  ('accounting_periods', 'accounting_periods_current'),
  ('commercial_documents', 'commercial_documents_current'),
  ('commercial_document_lines', 'commercial_document_lines_current'),
  ('journal_proposals', 'journal_proposals_current'),
  ('journal_proposal_lines', 'journal_proposal_lines_current'),
  ('journal_entries', 'journal_entries_current'),
  ('journal_lines', 'journal_lines_current'),
  ('document_sequences', 'document_sequences_current'),
  ('security_events', 'security_events_current'),
  ('automation_principals', 'automation_principals_current'),
  ('command_approvals', 'command_approvals_current'),
  ('settlement_allocations', 'settlement_allocations_current');

do $$
begin
  if exists (
    (select table_name from expected_public_tables
     except
     select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r')
    union all
    (select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
     except
     select table_name from expected_public_tables)
  ) then
    raise exception 'SERP-124 public table catalogue drifted';
  end if;

  if exists (
    (select table_name, policy_name from expected_policies
     except
     select c.relname, p.polname
       from pg_policy p
       join pg_class c on c.oid = p.polrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public')
    union all
    (select c.relname, p.polname
       from pg_policy p
       join pg_class c on c.oid = p.polrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
     except
     select table_name, policy_name from expected_policies)
  ) then
    raise exception 'SERP-124 RLS policy catalogue drifted';
  end if;
end
$$;

-- Classification required by SERP-124. A table with a policy is reported as RLS-protected;
-- a table with no policy is acceptable only when the normal authenticated role lacks SELECT.
create temporary table protection_report on commit drop as
select e.table_name,
       c.relrowsecurity as rls_enabled,
       count(p.oid)::integer as policy_count,
       has_table_privilege('authenticated', format('public.%I', e.table_name), 'SELECT')
         as authenticated_can_select,
       case
         when c.relrowsecurity and count(p.oid) > 0 then 'protected-by-RLS'
         when not has_table_privilege(
           'authenticated', format('public.%I', e.table_name), 'SELECT'
         ) then 'protected-by-revoked-grant'
         else 'NOT PROTECTED'
       end as protection
  from expected_public_tables e
  join pg_class c on c.relname = e.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  left join pg_policy p on p.polrelid = c.oid
 group by e.table_name, c.relrowsecurity;

do $$
begin
  if (select count(*) from protection_report) <> 31 then
    raise exception 'SERP-124 expected 31 classified public tables';
  end if;
  if (select count(*) from protection_report where protection = 'protected-by-RLS') <> 27 then
    raise exception 'SERP-124 expected 27 RLS-protected tables';
  end if;
  if (select count(*) from protection_report where protection = 'protected-by-revoked-grant') <> 4 then
    raise exception 'SERP-124 expected 4 revoked-grant-protected tables';
  end if;
  if exists (select 1 from protection_report where protection = 'NOT PROTECTED') then
    raise exception 'SERP-124 found an unprotected public table';
  end if;
end
$$;

select table_name, rls_enabled, policy_count, authenticated_can_select, protection
  from protection_report
 order by table_name;

-- The probe gets SELECT deliberately so revoked grants cannot masquerade as an RLS pass.
create role serp124_rls_probe noinherit nologin nosuperuser nobypassrls;
grant serp124_rls_probe to current_user;
grant usage on schema public, app_private to serp124_rls_probe;
grant select on all tables in schema public to serp124_rls_probe;
grant select on expected_policies to serp124_rls_probe;

set local role serp124_rls_probe;
set local row_security = on;

do $$
declare
  attrs record;
  table_record record;
  visible boolean;
begin
  select rolsuper, rolbypassrls into attrs
    from pg_roles where rolname = current_user;

  if current_user <> 'serp124_rls_probe'
     or attrs.rolsuper
     or attrs.rolbypassrls
     or current_setting('row_security') <> 'on' then
    raise exception 'SERP-124 probe role can bypass RLS';
  end if;

  if exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_roles owner_role on owner_role.oid = c.relowner
     where n.nspname = 'public'
       and c.relkind = 'r'
       and owner_role.rolname = current_user
  ) then
    raise exception 'SERP-124 probe role owns a tested table';
  end if;

  -- No tenant/person claim: every RLS-enabled table must expose zero rows.
  perform set_config('app.organisation_id', '', true);
  perform set_config('app.person_id', '', true);
  for table_record in
    select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     order by c.relname
  loop
    execute format('select exists (select 1 from public.%I limit 1)', table_record.table_name)
       into visible;
    if visible then
      raise exception 'SERP-124 no-claim probe exposed rows from %', table_record.table_name;
    end if;
  end loop;
end
$$;

-- Synthetic tenant A claim. The same synthetic person has memberships in A and B, so the
-- target=current-organisation check is what prevents tenant B visibility.
select set_config('app.person_id', '00000000-0000-4000-8000-000000000101', true);
select set_config('app.organisation_id', '00000000-0000-4000-8000-000000000001', true);

do $$
declare
  policy_table record;
  tenant_a_count bigint;
  tenant_b_count bigint;
  tenant_column text;
begin
  for policy_table in select distinct table_name from expected_policies order by table_name loop
    tenant_column := case when policy_table.table_name = 'organisations' then 'id' else 'organisation_id' end;
    execute format('select count(*) from public.%I where %I = $1', policy_table.table_name, tenant_column)
      into tenant_a_count using '00000000-0000-4000-8000-000000000001'::uuid;
    execute format('select count(*) from public.%I where %I = $1', policy_table.table_name, tenant_column)
      into tenant_b_count using '00000000-0000-4000-8000-000000000002'::uuid;

    if tenant_a_count = 0 then
      raise exception 'SERP-124 tenant A positive control missing for %', policy_table.table_name;
    end if;
    if tenant_b_count <> 0 then
      raise exception 'SERP-124 tenant B rows crossed the boundary in %', policy_table.table_name;
    end if;
  end loop;
end
$$;

select current_user as asserted_probe_role,
       current_setting('row_security') as row_security,
       (select rolsuper from pg_roles where rolname = current_user) as superuser,
       (select rolbypassrls from pg_roles where rolname = current_user) as bypass_rls,
       (select count(distinct table_name) from expected_policies) as policies_behaviorally_exercised,
       (select count(*) from public.organisations) as visible_organisations,
       (select count(*) from public.memberships) as visible_memberships;

reset role;
rollback;
