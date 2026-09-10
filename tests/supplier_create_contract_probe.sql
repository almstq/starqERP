-- SERP-339 Supplier CREATE contract probe.
-- Run against a disposable migrated database; this probe is read-only.
begin;

do $$
declare
  fn text;
begin
  select pg_get_functiondef(p.oid) into fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'api_supplier_command'
     and p.pronargs = 6;
  if fn is null then raise exception 'supplier_command_missing'; end if;
  if fn not like '%assert_active_seat%' then raise exception 'supplier_rbac_guard_missing'; end if;
  if fn not like '%target_org%' then raise exception 'supplier_target_org_guard_missing'; end if;
  if fn not like '%idempotency_key_conflict%' then raise exception 'supplier_idempotency_conflict_missing'; end if;
  if fn not like '%public.audit_events%' then raise exception 'supplier_audit_write_missing'; end if;
  if fn not like '%kind, display_name%' or fn not like '%supplier%' then raise exception 'supplier_contact_insert_missing'; end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='contacts' and column_name='organisation_id'
  ) then raise exception 'contacts_tenant_key_missing'; end if;
  if not exists (
    select 1 from information_schema.check_constraints
     where constraint_schema='public' and check_clause like '%supplier%'
  ) then raise exception 'supplier_kind_constraint_missing'; end if;
end $$;

rollback;
