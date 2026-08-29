\set ON_ERROR_STOP on

-- SERP-300: executable adversarial isolation matrix.
-- Synthetic identifiers only. The entire probe is transactional and rolls back.

begin;

create temporary table serp300_results (
  attack text primary key,
  expected text not null,
  actual text not null,
  passed boolean not null
) on commit drop;

-- Exact fixtures: Tenant A has two books, but the attacker is assigned only Book A1.
insert into public.organisations (id, slug, legal_name, registry_code)
values
  ('30000000-0000-4000-8000-000000000001', 'serp300-tenant-a', 'SERP-300 Tenant A', 'SERP300-A'),
  ('30000000-0000-4000-8000-000000000002', 'serp300-tenant-b', 'SERP-300 Tenant B', 'SERP300-B');

insert into public.business_names (id, organisation_id, name)
values
  ('30000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000001', 'SERP-300 A Trading'),
  ('30000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000002', 'SERP-300 B Trading');

insert into public.persons (id, person_key, external_subject, verified_email, display_label)
values
  ('30000000-0000-4000-8000-000000000101', 'serp300-attacker', 'synthetic:serp300-attacker', 'attacker@example.invalid', 'SERP-300 Attacker'),
  ('30000000-0000-4000-8000-000000000102', 'serp300-invitee', 'synthetic:serp300-invitee', 'invitee-a@example.invalid', 'SERP-300 Invitee'),
  ('30000000-0000-4000-8000-000000000103', 'serp300-mismatch', 'synthetic:serp300-mismatch', 'other@example.invalid', 'SERP-300 Mismatched Identity');

select app_private.seed_default_organisation_roles('30000000-0000-4000-8000-000000000001');
select app_private.seed_default_organisation_roles('30000000-0000-4000-8000-000000000002');

insert into public.memberships (id, organisation_id, person_id, status, role_id)
select '30000000-0000-4000-8000-000000000201',
       '30000000-0000-4000-8000-000000000001',
       '30000000-0000-4000-8000-000000000101',
       'active', r.id
  from public.roles r
 where r.organisation_id = '30000000-0000-4000-8000-000000000001'
   and r.code = 'admin';

insert into public.membership_seats (membership_id, seat_code)
values ('30000000-0000-4000-8000-000000000201', 'counter');

insert into public.books (id, organisation_id, business_name_id, code, name, is_default)
values
  ('30000000-0000-4000-8000-000000000301', '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000011', 'A1', 'Tenant A Book 1', true),
  ('30000000-0000-4000-8000-000000000302', '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000011', 'A2', 'Tenant A Book 2', false),
  ('30000000-0000-4000-8000-000000000303', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000012', 'B1', 'Tenant B Book 1', true);

insert into public.book_memberships (organisation_id, membership_id, book_id)
values (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000201',
  '30000000-0000-4000-8000-000000000301'
);

insert into public.contacts (id, organisation_id, kind, display_name)
values
  ('30000000-0000-4000-8000-000000000401', '30000000-0000-4000-8000-000000000001', 'customer', 'Tenant A Contact'),
  ('30000000-0000-4000-8000-000000000402', '30000000-0000-4000-8000-000000000002', 'customer', 'Tenant B Contact');

insert into public.commercial_documents
  (id, organisation_id, book_id, document_type, document_no, status, contact_id)
values
  ('30000000-0000-4000-8000-000000000501', '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000301', 'estimate', 'A1-EST-1', 'draft', '30000000-0000-4000-8000-000000000401'),
  ('30000000-0000-4000-8000-000000000502', '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000302', 'estimate', 'A2-EST-1', 'draft', '30000000-0000-4000-8000-000000000401'),
  ('30000000-0000-4000-8000-000000000503', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000303', 'estimate', 'B1-EST-1', 'draft', '30000000-0000-4000-8000-000000000402');

insert into public.invitations
  (id, organisation_id, email, name, role_id, book_ids, status, invited_by)
select
  '30000000-0000-4000-8000-000000000601',
  '30000000-0000-4000-8000-000000000001',
  'invitee-a@example.invalid',
  'Tenant A Invitee',
  r.id::text,
  array['30000000-0000-4000-8000-000000000301'::uuid],
  'pending',
  '30000000-0000-4000-8000-000000000101'
from public.roles r
where r.organisation_id = '30000000-0000-4000-8000-000000000001'
  and r.code = 'counter_operator';

insert into public.invitations
  (id, organisation_id, email, name, role_id, book_ids, status, invited_by)
select
  '30000000-0000-4000-8000-000000000602',
  '30000000-0000-4000-8000-000000000001',
  'target@example.invalid',
  'Tenant A Identity-Mismatch Target',
  r.id::text,
  array['30000000-0000-4000-8000-000000000301'::uuid],
  'pending',
  '30000000-0000-4000-8000-000000000101'
from public.roles r
where r.organisation_id = '30000000-0000-4000-8000-000000000001'
  and r.code = 'counter_operator';

insert into platform.tenant_applications (
  id,
  applicant_person_id,
  applicant_email,
  applicant_name,
  name,
  legal_name,
  archetype_id,
  primary_book_name,
  primary_book_code,
  island,
  atoll
) values (
  '30000000-0000-4000-8000-000000000701',
  '30000000-0000-4000-8000-000000000102',
  'invitee-a@example.invalid',
  'SERP-300 Invitee',
  'SERP-300 Provisioned Tenant',
  'SERP-300 Provisioned Tenant Ltd',
  'general_business',
  'SERP-300 General Book',
  'S300',
  'Synthetic Island',
  'Synthetic Atoll'
);

insert into platform.operator_principals (person_id, operator_role, active, mfa_required)
values ('30000000-0000-4000-8000-000000000101', 'platform_admin', true, true);

insert into serp300_results
select
  'accept_rpc_security_definer',
  'SECURITY DEFINER',
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end,
  p.prosecdef
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'accept_staff_invitation'
  and p.pronargs = 2;

insert into serp300_results
select
  'provision_rpc_security_boundary',
  'SECURITY DEFINER; service_role only',
  format(
    '%s; anon=%s authenticated=%s service_role=%s',
    case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end,
    has_function_privilege('anon', p.oid, 'EXECUTE'),
    has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  p.prosecdef
    and not has_function_privilege('anon', p.oid, 'EXECUTE')
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and has_function_privilege('service_role', p.oid, 'EXECUTE')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'platform'
  and p.proname = 'provision_approved_application';

with required(table_name, column_name) as (
  values
    ('persons', 'verified_email'),
    ('memberships', 'role_id'),
    ('book_memberships', 'granted_at'),
    ('audit_events', 'actor_person_id'),
    ('audit_events', 'action'),
    ('audit_events', 'metadata')
), missing as (
  select r.table_name, r.column_name
  from required r
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = r.table_name
   and c.column_name = r.column_name
  where c.column_name is null
)
insert into serp300_results
select
  'invitation_rpc_schema_contract',
  '0 missing canonical columns',
  case when count(*) = 0 then '0 missing canonical columns'
       else count(*) || ' missing: ' || string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
  end,
  count(*) = 0
from missing;

with required(table_name, column_name) as (
  values
    ('organisations', 'legal_name'),
    ('business_names', 'status'),
    ('locations', 'code'),
    ('locations', 'kind'),
    ('locations', 'active'),
    ('memberships', 'role_id'),
    ('workflow_templates', 'workflow_code'),
    ('workflow_templates', 'active'),
    ('workflow_stages', 'workflow_template_id'),
    ('workflow_stages', 'stage_name'),
    ('workflow_stages', 'required_seat'),
    ('workflow_stages', 'active')
), missing as (
  select r.table_name, r.column_name
  from required r
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = r.table_name
   and c.column_name = r.column_name
  where c.column_name is null
)
insert into serp300_results
select
  'provision_rpc_schema_contract',
  '0 missing canonical columns',
  case when count(*) = 0 then '0 missing canonical columns'
       else count(*) || ' missing: ' || string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
  end,
  count(*) = 0
from missing;

drop role if exists serp300_probe;
create role serp300_probe noinherit nologin nosuperuser nobypassrls;
grant serp300_probe to current_user;
grant usage on schema public, app_private to serp300_probe;
grant select, insert, update, delete on all tables in schema public to serp300_probe;
grant select, insert, update, delete on serp300_results to serp300_probe;
grant select, insert, update, delete on serp300_results to authenticated, service_role;

set local role serp300_probe;
set local row_security = on;
select set_config('app.person_id', '30000000-0000-4000-8000-000000000101', true);
select set_config('app.organisation_id', '30000000-0000-4000-8000-000000000001', true);
select set_config('app.book_id', '30000000-0000-4000-8000-000000000301', true);

do $$
declare
  n bigint;
  affected bigint;
begin
  select count(*) into n from public.organisations
   where id = '30000000-0000-4000-8000-000000000002';
  insert into serp300_results values ('cross_tenant_select', '0 tenant B rows', n || ' tenant B rows', n = 0);

  update public.contacts set display_name = 'FORGED' where id = '30000000-0000-4000-8000-000000000402';
  get diagnostics affected = row_count;
  insert into serp300_results values ('cross_tenant_update', '0 rows affected', affected || ' rows affected', affected = 0);

  delete from public.contacts where id = '30000000-0000-4000-8000-000000000402';
  get diagnostics affected = row_count;
  insert into serp300_results values ('cross_tenant_delete', '0 rows affected', affected || ' rows affected', affected = 0);

  begin
    insert into public.contacts (organisation_id, kind, display_name)
    values ('30000000-0000-4000-8000-000000000002', 'customer', 'FORGED');
    insert into serp300_results values ('cross_tenant_insert', 'RLS rejection', 'insert succeeded', false);
  exception when insufficient_privilege then
    insert into serp300_results values ('cross_tenant_insert', 'RLS rejection', 'RLS rejection', true);
  end;

  select count(*) into n from public.commercial_documents
   where book_id = '30000000-0000-4000-8000-000000000302';
  insert into serp300_results values ('unauthorised_book_select', '0 Book A2 rows', n || ' Book A2 rows', n = 0);

  update public.commercial_documents set metadata = '{"forged":true}'::jsonb
   where id = '30000000-0000-4000-8000-000000000502';
  get diagnostics affected = row_count;
  insert into serp300_results values ('unauthorised_book_update', '0 rows affected', affected || ' rows affected', affected = 0);

  delete from public.commercial_documents
   where id = '30000000-0000-4000-8000-000000000502';
  get diagnostics affected = row_count;
  insert into serp300_results values ('unauthorised_book_delete', '0 rows affected', affected || ' rows affected', affected = 0);

end
$$;

reset role;

set local role authenticated;
do $$
begin
  begin
    perform public.accept_staff_invitation(
      '30000000-0000-4000-8000-000000000601',
      '30000000-0000-4000-8000-000000000102'
    );
    insert into serp300_results values (
      'direct_invitation_rpc_execution',
      'authenticated EXECUTE denied',
      'authenticated entered and completed SECURITY DEFINER body',
      false
    );
  exception
    when insufficient_privilege then
      insert into serp300_results values (
        'direct_invitation_rpc_execution',
        'authenticated EXECUTE denied',
        'authenticated EXECUTE denied',
        true
      );
    when others then
      insert into serp300_results values (
        'direct_invitation_rpc_execution',
        'authenticated EXECUTE denied',
        'authenticated entered SECURITY DEFINER body: ' || sqlstate || ': ' || sqlerrm,
        false
      );
  end;

  begin
    perform platform.provision_approved_application(
      '30000000-0000-4000-8000-000000000701',
      '30000000-0000-4000-8000-000000000101'
    );
    insert into serp300_results values (
      'direct_provision_rpc_execution',
      'authenticated EXECUTE denied',
      'authenticated entered and completed SECURITY DEFINER body',
      false
    );
  exception
    when insufficient_privilege then
      insert into serp300_results values (
        'direct_provision_rpc_execution',
        'authenticated EXECUTE denied',
        'authenticated EXECUTE denied',
        true
      );
    when others then
      insert into serp300_results values (
        'direct_provision_rpc_execution',
        'authenticated EXECUTE denied',
        'authenticated entered SECURITY DEFINER body: ' || sqlstate || ': ' || sqlerrm,
        false
      );
  end;
end
$$;
reset role;

set local role service_role;
do $$
declare
  rpc_error text := null;
  rpc_result jsonb := null;
  verified boolean;
begin
  begin
    select public.accept_staff_invitation(
      '30000000-0000-4000-8000-000000000601',
      '30000000-0000-4000-8000-000000000102'
    ) into rpc_result;
  exception when others then
    rpc_error := sqlstate || ': ' || sqlerrm;
  end;

  verified := rpc_error is null and rpc_result->>'ok' = 'true';
  insert into serp300_results values (
    'invitation_rpc_runtime',
    'service path accepts bound identity and writes canonical membership/book/audit rows',
    coalesce(rpc_error, rpc_result::text),
    verified
  );

  rpc_result := public.accept_staff_invitation(
    '30000000-0000-4000-8000-000000000602',
    '30000000-0000-4000-8000-000000000103'
  );
  insert into serp300_results values (
    'invitation_identity_mismatch',
    'mismatched verified identity rejected without mutation',
    rpc_result::text,
    rpc_result->>'error' = 'invitation_identity_mismatch'
  );

  rpc_error := null;
  rpc_result := null;
  begin
    select platform.provision_approved_application(
      '30000000-0000-4000-8000-000000000701',
      '30000000-0000-4000-8000-000000000101'
    ) into rpc_result;
  exception when others then
    rpc_error := sqlstate || ': ' || sqlerrm;
  end;

  verified := rpc_error is null and rpc_result->>'ok' = 'true';
  insert into serp300_results values (
    'provision_rpc_runtime',
    'service path provisions canonical organisation spine',
    coalesce(rpc_error, rpc_result::text),
    verified
  );
end
$$;
reset role;

-- Verify durable effects as the fixture owner, not by broadening service_role.
update serp300_results
   set passed = passed
     and exists (
       select 1
       from public.memberships m
       join public.book_memberships bm on bm.membership_id = m.id
       where m.person_id = '30000000-0000-4000-8000-000000000102'
         and m.organisation_id = '30000000-0000-4000-8000-000000000001'
         and m.role_id is not null
         and bm.book_id = '30000000-0000-4000-8000-000000000301'
     )
     and exists (
       select 1 from public.audit_events
       where object_id = '30000000-0000-4000-8000-000000000601'
         and action = 'invitation.accepted'
         and actor_person_id = '30000000-0000-4000-8000-000000000102'
     ),
       actual = actual || '; canonical membership/book/audit rows verified'
 where attack = 'invitation_rpc_runtime';

update serp300_results
   set passed = passed
     and exists (
       select 1 from public.invitations
       where id = '30000000-0000-4000-8000-000000000602'
         and status = 'pending'
         and accepted_by is null
     )
     and not exists (
       select 1 from public.memberships
       where person_id = '30000000-0000-4000-8000-000000000103'
         and organisation_id = '30000000-0000-4000-8000-000000000001'
     ),
       actual = actual || '; invitation remained pending and membership absent'
 where attack = 'invitation_identity_mismatch';

update serp300_results
   set passed = passed
     and exists (
       select 1
       from public.organisations o
       join public.memberships m on m.organisation_id = o.id
       join public.book_memberships bm on bm.membership_id = m.id
       join public.workflow_templates wt on wt.organisation_id = o.id
       join platform.tenant_registry tr on tr.organisation_id = o.id
       join platform.tenant_applications ta on ta.provisioned_organisation_id = o.id
       join public.books b on b.id = bm.book_id and b.organisation_id = o.id
       where ta.id = '30000000-0000-4000-8000-000000000701'
         and m.person_id = '30000000-0000-4000-8000-000000000102'
         and m.role_id is not null
         and b.is_default = true
         and wt.workflow_code = 'general_business_default'
         and tr.provisioning_status = 'ready'
     ),
       actual = actual || '; canonical organisation spine verified'
 where attack = 'provision_rpc_runtime';

table serp300_results;

do $$
declare failures text;
begin
  select string_agg(attack || ' => ' || actual, E'\n' order by attack)
    into failures
    from serp300_results
   where not passed;
  if failures is not null then
    raise exception E'SERP-300 SECURITY FAILURES:\n%', failures;
  end if;
end
$$;

rollback;
