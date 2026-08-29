# Cloud deployment record

Status: foundation schema and cloud API deployed; not pilot-ready  
Date: 2026-08-20  
Environment: Starq Books Supabase project, Northeast Asia (Seoul)  
Project reference: `wthabguvueewgtabjsdo`

## Authorization and scope

The founder created the empty project and supplied its dashboard reference for
the the foundation engine cloud-data wiring. This record contains no password, access token,
service-role key or database connection string.

## Applied migrations

1. `202608200001_core_foundation.sql`
2. `202608200002_garage_inventory.sql`
3. `202608200003_commercial_accounting.sql`
4. `202608200004_pilot_security.sql`
5. `202608200005_garage_api.sql`
6. `202608200006_garage_api_search_path.sql`
7. `202608200007_garage_api_self_test.sql`

`supabase db push --dry-run` identified exactly these three pending migrations.
The subsequent controlled push executed all three successfully. The existing
`pgcrypto` extension was detected and retained.

## Verification evidence

- Remote PostgreSQL migration execution through migration 005: PASS.
- Linked remote schema lint at warning level: PASS; no schema errors found.
- Repository structural check: PASS; 3 migrations, 25 tables, 24 RLS-enabled
  table statements and 22 policies.
- Synthetic seed applied: NO.
- Live business data imported: NO.
- `starq-api` Edge Function deployed with platform JWT verification disabled so
  the product can verify Google identity and issue its own signed `sb_ops`
  session. Database service credentials remain function-side only.
- Public health, unauthenticated rejection, origin rejection and security-header
  checks are automated in `scripts/check-cloud-api.ps1`.
- Migration 007 executes one synthetic CALL command and its idempotent replay in
  a PostgreSQL subtransaction, asserts the same event result, and deliberately
  rolls back all synthetic identity, sequence, job, event, audit and key writes.

## Open acceptance gates

- Exercise RLS policies using the intended backend database roles.
- Prove a clean disposable reset from migrations.
- Define and test rollback/forward-fix procedure.
- Complete backup restore rehearsal.
- Reconcile and approve live-data import evidence.
- Obtain founder authorization for pilot cutover.

The deployment is an ISO-aligned controlled foundation. It is not an ISO
certification claim and is not evidence that the production cutover gates have
passed.
