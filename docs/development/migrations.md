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
