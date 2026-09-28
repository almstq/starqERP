<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document REMAINS VALID and is extended, not superseded, by the 28 Sep 2026 course correction.**
>
> Migration discipline stands. Extended with the three-part change rule (schema + consumer + fixture) and the canonical fresh-database compatibility gate. Follow the extension below where it touches StarqERP completion doctrine.
>
> **Current development SSOT:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](../governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
> **Current roadmap:** [`ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`](../roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md)
> **Supersession index:** [`SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md`](../governance/SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md)
>
> **What changed on 28 Sep 2026:** StarqERP development was stopped and the completion model
> was corrected from *complete the remaining modules* to *close the remaining business
> processes*. The five canonical ERP process chains are Order-to-Cash, Procure-to-Pay,
> Inventory-to-GL, Cash-to-Bank and Record-to-Report. This is **convergence, not rewrite** —
> all existing architecture, migrations, tests, evidence and completed tasks remain valid.
> **StarqERP implementation is ON HOLD** pending explicit Founder restart authorization.
>
> **Original content is preserved verbatim below.** Nothing was removed or rewritten.
>
---

# Database Migrations Workflow

All database changes in starqERP must be versioned, immutable, and applied through sequential SQL migration scripts located in `supabase/migrations/`.

---

## 1. Migration File Naming Standard

Migration files adhere to a strict UTC timestamp convention:

```
YYYYMMDDNNNN_<descriptive_name>.sql
```

Example: `202608270025_books_and_operating_activities.sql`

---

## 2. Creating & Applying Migrations

### Create a New Migration File
```bash
supabase migration new <migration_name>
```

### Apply Migrations Locally
```bash
# Apply pending migrations to local Docker container
supabase db push

# Re-apply all migrations from clean slate with seed data
supabase db reset
```

### Apply Migrations to Remote / Staging
```bash
# Push pending migrations to linked Supabase project
supabase db push --linked

# Verify migration list status
supabase migration list --linked
```

---

## 3. Migration Invariants & Rules

1. **Transactional Execution**: Migrations must execute inside atomic transaction blocks (`begin; ... commit;`).
2. **Append-Only Trigger Safety**: When updating tables with append-only triggers (`audit_events`, `journal_entries`), use `set local session_replication_role = 'replica';` during the backfill block and restore to `'origin'` before committing.
3. **Composite Foreign Keys**: All child execution tables must reference `(organisation_id, id)` to prevent cross-tenant key hijacking.
