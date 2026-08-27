# Tenant Isolation & Row-Level Security (RLS)

Multi-tenant data isolation in starqERP is enforced natively at the database engine layer using PostgreSQL Row-Level Security (RLS).

---

## 1. Row-Level Security (RLS) Policies

Every tenant-scoped table enforces RLS policies checking `organisation_id = auth.current_org()`:

```sql
-- Example RLS Policy on Commercial Invoices
create policy commercial_documents_tenant_isolation on public.commercial_documents
  for all
  using (organisation_id = (select current_setting('app.current_organisation_id', true)::uuid))
  with check (organisation_id = (select current_setting('app.current_organisation_id', true)::uuid));
```

---

## 2. Composite Foreign Keys

To prevent foreign key hijacking across tenants, all relational child tables enforce composite foreign keys referencing `(organisation_id, parent_id)`:

```sql
-- Enforce composite tenant integrity
alter table public.garage_jobs
  add constraint garage_jobs_book_fk
  foreign key (organisation_id, book_id)
  references public.books(organisation_id, id);
```

---

## 3. Append-Only Ledger Triggers

To prevent tampering with audit logs or accounting journals, PostgreSQL database triggers reject `UPDATE` and `DELETE` queries:

```sql
create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function app_private.reject_mutation();

create trigger journal_entries_append_only
  before update or delete on public.journal_entries
  for each row execute function app_private.reject_mutation();
```
