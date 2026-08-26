begin;

-- =============================================================================
-- Migration: 202608260021_synthetic_tenant_uuid_transition.sql
-- SERP-275: Forward-only migration transitioning legacy tenant UUIDs (which
-- embedded company registration numbers 29552026 and 30222026) to deterministic
-- non-identifying synthetic UUIDs across all referencing tables.
-- =============================================================================

do $$
declare
  old_st uuid := '29552026-0000-4000-8000-000000000001';
  new_st uuid := '10000000-0000-4000-8000-000000000001';

  old_ci uuid := '30222026-0000-4000-8000-000000000001';
  new_ci uuid := '20000000-0000-4000-8000-000000000001';

  old_st_wf uuid := '29552026-0000-4000-8000-000000000802';
  new_st_wf uuid := '10000000-0000-4000-8000-000000000802';

  old_ci_wf uuid := '30222026-0000-4000-8000-000000000801';
  new_ci_wf uuid := '20000000-0000-4000-8000-000000000801';
begin
  -- 1. Insert target synthetic organisation rows if not already present
  insert into public.organisations (id, slug, legal_name, registry_code, status)
  select new_st, slug, legal_name, registry_code, status
    from public.organisations where id = old_st
  on conflict (id) do update set
    slug = excluded.slug,
    legal_name = excluded.legal_name,
    status = excluded.status;

  insert into public.organisations (id, slug, legal_name, registry_code, status)
  select new_ci, slug, legal_name, registry_code, status
    from public.organisations where id = old_ci
  on conflict (id) do update set
    slug = excluded.slug,
    legal_name = excluded.legal_name,
    status = excluded.status;

  -- 2. Update child tables (handling all referencing FK tables conditionally if table exists)
  -- Business Names
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'business_names') then
    update public.business_names set organisation_id = new_st where organisation_id = old_st;
    update public.business_names set organisation_id = new_ci where organisation_id = old_ci;
  end if;

  -- Memberships
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'memberships') then
    update public.memberships set organisation_id = new_st where organisation_id = old_st;
    update public.memberships set organisation_id = new_ci where organisation_id = old_ci;
  end if;

  -- Document Sequences
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'document_sequences') then
    insert into public.document_sequences (organisation_id, sequence_type, next_value, prefix, padding)
    select new_ci, sequence_type, next_value, prefix, padding
      from public.document_sequences where organisation_id = old_ci
    on conflict (organisation_id, sequence_type) do nothing;
    delete from public.document_sequences where organisation_id = old_ci;

    insert into public.document_sequences (organisation_id, sequence_type, next_value, prefix, padding)
    select new_st, sequence_type, next_value, prefix, padding
      from public.document_sequences where organisation_id = old_st
    on conflict (organisation_id, sequence_type) do nothing;
    delete from public.document_sequences where organisation_id = old_st;
  end if;

  -- Security Events
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'security_events') then
    if exists (select 1 from pg_trigger where tgname = 'security_events_append_only') then
      alter table public.security_events disable trigger security_events_append_only;
      update public.security_events set organisation_id = new_st where organisation_id = old_st;
      update public.security_events set organisation_id = new_ci where organisation_id = old_ci;
      alter table public.security_events enable trigger security_events_append_only;
    else
      update public.security_events set organisation_id = new_st where organisation_id = old_st;
      update public.security_events set organisation_id = new_ci where organisation_id = old_ci;
    end if;
  end if;

  -- Automation Principals & Capability Grants
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'automation_principals') then
    update public.automation_principals set organisation_id = new_st where organisation_id = old_st;
    update public.automation_principals set organisation_id = new_ci where organisation_id = old_ci;
  end if;

  -- Command Approvals
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'command_approvals') then
    update public.command_approvals set organisation_id = new_st where organisation_id = old_st;
    update public.command_approvals set organisation_id = new_ci where organisation_id = old_ci;
  end if;

  -- Customers & Vehicles
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'customers') then
    update public.customers set organisation_id = new_st where organisation_id = old_st;
    update public.customers set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'vehicles') then
    update public.vehicles set organisation_id = new_st where organisation_id = old_st;
    update public.vehicles set organisation_id = new_ci where organisation_id = old_ci;
  end if;

  -- Garage Jobs & Events
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'garage_jobs') then
    update public.garage_jobs set organisation_id = new_st where organisation_id = old_st;
    update public.garage_jobs set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'job_events') then
    update public.job_events set organisation_id = new_st where organisation_id = old_st;
    update public.job_events set organisation_id = new_ci where organisation_id = old_ci;
  end if;

  -- Stock & SCM Tables
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'product_categories') then
    update public.product_categories set organisation_id = new_st where organisation_id = old_st;
    update public.product_categories set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'stock_items') then
    update public.stock_items set organisation_id = new_st where organisation_id = old_st;
    update public.stock_items set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'stock_batches') then
    update public.stock_batches set organisation_id = new_st where organisation_id = old_st;
    update public.stock_batches set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'stock_movements') then
    update public.stock_movements set organisation_id = new_st where organisation_id = old_st;
    update public.stock_movements set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'suppliers') then
    update public.suppliers set organisation_id = new_st where organisation_id = old_st;
    update public.suppliers set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'purchase_orders') then
    update public.purchase_orders set organisation_id = new_st where organisation_id = old_st;
    update public.purchase_orders set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'purchase_order_lines') then
    update public.purchase_order_lines set organisation_id = new_st where organisation_id = old_st;
    update public.purchase_order_lines set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'job_card_parts') then
    update public.job_card_parts set organisation_id = new_st where organisation_id = old_st;
    update public.job_card_parts set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'job_card_labour') then
    update public.job_card_labour set organisation_id = new_st where organisation_id = old_st;
    update public.job_card_labour set organisation_id = new_ci where organisation_id = old_ci;
  end if;

  -- Accounting Tables
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'chart_of_accounts') then
    update public.chart_of_accounts set organisation_id = new_st where organisation_id = old_st;
    update public.chart_of_accounts set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'journal_entries') then
    update public.journal_entries set organisation_id = new_st where organisation_id = old_st;
    update public.journal_entries set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'journal_lines') then
    update public.journal_lines set organisation_id = new_st where organisation_id = old_st;
    update public.journal_lines set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'commercial_invoices') then
    update public.commercial_invoices set organisation_id = new_st where organisation_id = old_st;
    update public.commercial_invoices set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'commercial_invoice_lines') then
    update public.commercial_invoice_lines set organisation_id = new_st where organisation_id = old_st;
    update public.commercial_invoice_lines set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'commercial_payments') then
    update public.commercial_payments set organisation_id = new_st where organisation_id = old_st;
    update public.commercial_payments set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'commercial_expenses') then
    update public.commercial_expenses set organisation_id = new_st where organisation_id = old_st;
    update public.commercial_expenses set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'settlement_allocations') then
    update public.settlement_allocations set organisation_id = new_st where organisation_id = old_st;
    update public.settlement_allocations set organisation_id = new_ci where organisation_id = old_ci;
  end if;

  -- Workflow Templates & Stages
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'workflow_templates') then
    update public.workflow_templates set organisation_id = new_st, id = new_st_wf where organisation_id = old_st;
    update public.workflow_templates set organisation_id = new_ci, id = new_ci_wf where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'workflow_stages') then
    update public.workflow_stages set organisation_id = new_st where organisation_id = old_st;
    update public.workflow_stages set organisation_id = new_ci where organisation_id = old_ci;
  end if;

  -- Roles & Permissions
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'roles') then
    update public.roles set organisation_id = new_st where organisation_id = old_st;
    update public.roles set organisation_id = new_ci where organisation_id = old_ci;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'role_permissions') then
    update public.role_permissions set organisation_id = new_st where organisation_id = old_st;
    update public.role_permissions set organisation_id = new_ci where organisation_id = old_ci;
  end if;

  -- SoD Exceptions
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'sod_exceptions') then
    if exists (select 1 from pg_trigger where tgname = 'sod_exceptions_append_only') then
      alter table public.sod_exceptions disable trigger sod_exceptions_append_only;
      update public.sod_exceptions set organisation_id = new_st where organisation_id = old_st;
      update public.sod_exceptions set organisation_id = new_ci where organisation_id = old_ci;
      alter table public.sod_exceptions enable trigger sod_exceptions_append_only;
    else
      update public.sod_exceptions set organisation_id = new_st where organisation_id = old_st;
      update public.sod_exceptions set organisation_id = new_ci where organisation_id = old_ci;
    end if;
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'sod_exception_dispositions') then
    if exists (select 1 from pg_trigger where tgname = 'sod_exception_dispositions_append_only') then
      alter table public.sod_exception_dispositions disable trigger sod_exception_dispositions_append_only;
      update public.sod_exception_dispositions set organisation_id = new_st where organisation_id = old_st;
      update public.sod_exception_dispositions set organisation_id = new_ci where organisation_id = old_ci;
      alter table public.sod_exception_dispositions enable trigger sod_exception_dispositions_append_only;
    else
      update public.sod_exception_dispositions set organisation_id = new_st where organisation_id = old_st;
      update public.sod_exception_dispositions set organisation_id = new_ci where organisation_id = old_ci;
    end if;
  end if;

  -- Tax Registrations
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tax_registrations') then
    update public.tax_registrations set organisation_id = new_st where organisation_id = old_st;
    update public.tax_registrations set organisation_id = new_ci where organisation_id = old_ci;
  end if;

  -- Bank Accounts
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'bank_accounts') then
    update public.bank_accounts set organisation_id = new_st where organisation_id = old_st;
    update public.bank_accounts set organisation_id = new_ci where organisation_id = old_ci;
  end if;

  -- 3. Delete old legacy organisation rows now that all child references are migrated
  delete from public.organisations where id in (old_st, old_ci);
end $$;

commit;
