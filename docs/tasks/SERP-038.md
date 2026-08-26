# Task Execution Report: SERP-038
## Ordered Migration, Rollback and Compatibility Discipline

- **Phase:** Phase 2 — Close the security/domain gates
- **Priority:** P0
- **Execution state:** Complete
- **Date:** 2026-08-27
- **Accountable owners:** Codex / Antigravity
- **Requirements:** CORE-001, CORE-002, MIG-001, COMPAT-001

---

## 1. Authoritative Migration Lineage & Classification

Lineage contains 22 migrations in strict monotonic timestamp order (`YYYYMMDDNNNN_<name>.sql`):

| # | Version | Filename | Status | Notes / Discipline |
|---|---|---|---|---|
| 1 | `202608200001` | `202608200001_core_foundation.sql` | `APPLIED` | Core foundation (orgs, seats, memberships, idempotency, audit) |
| 2 | `202608200002` | `202608200002_garage_inventory.sql` | `APPLIED` | Garage and inventory operational tables |
| 3 | `202608200003` | `202608200003_commercial_accounting.sql` | `APPLIED` | Commercial documents and journal entries |
| 4 | `202608200004` | `202608200004_pilot_security.sql` | `APPLIED` | Pilot security and RLS tenant isolation policies |
| 5 | `202608200005` | `202608200005_garage_api.sql` | `APPLIED` | Garage API commands |
| 6 | `202608200006` | `202608200006_garage_api_search_path.sql` | `APPLIED` | Search path hardening for garage API |
| 7 | `202608200007` | `202608200007_garage_api_self_test.sql` | `APPLIED` | Garage API self test functions |
| 8 | `202608200008` | `202608200008_session_authority.sql` | `APPLIED` | Session authority and token functions |
| 9 | `202608210009` | `202608210009_seat_vocabulary.sql` | `APPLIED` | 12-seat vocabulary expansion |
| 10 | `202608210010` | `202608210010_purchase_seat_matrix.sql` | `APPLIED` | Purchase seat matrix seeds |
| 11 | `202608220011` | `202608220011_wire_purchase_seat_matrix.sql` | `REVIEWER_GATED` | **GATED** per Audit Critical #2 (3rd-person reviewer required) |
| 12 | `202608250012` | `202608250012_settlement_allocations.sql` | `APPLIED` | Settlement allocations and payment links |
| 13 | `202608250013` | `202608250013_workflow_stages.sql` | `APPLIED` | Workflow stages and transitions |
| 14 | `202608250014` | `202608250014_idempotency_replay.sql` | `APPLIED` | Idempotency replay persistence table |
| 15 | `202608250015` | `202608250015_roles_as_data.sql` | `APPLIED` | Roles as data matrix and seat bindings |
| 16 | `202608250016` | `202608250016_sod_exceptions.sql` | `APPLIED` | SoD tracked exceptions and capacity derivation |
| 17 | `202608250017` | `202608250017_tax_regimes_and_periods.sql` | `APPLIED` | Tax regimes and statutory GST periods |
| 18 | `202608250018` | `202608250018_bank_accounts_entities.sql` | `APPLIED` | Bank accounts and entity mapping |
| 19 | `202608250019` | `202608250019_job_customer_vehicle_phone.sql` | `APPLIED` | Job customer vehicle phone linkages |
| 20 | `202608250020` | `202608250020_revision_missing_endpoints.sql` | `APPLIED` | Command handler endpoints for statutory mutations |
| 21 | `202608260021` | `202608260021_synthetic_tenant_uuid_transition.sql` | `UNAPPLIED_FORWARD_ONLY` | Forward synthetic tenant UUID transition (SERP-275) |
| 22 | `202608260022` | `202608260022_transactional_outbox_and_audit.sql` | `UNAPPLIED_FORWARD_ONLY` | Transactional outbox and immutable audit foundation (SERP-034) |

---

## 2. Tooling Added & Rollback Discipline

* **Migration Linter Tooling ([`scripts/lint-migrations.mjs`](file:///d:/StarqTech/starqERP/scripts/lint-migrations.mjs)):**
  * Enforces monotonic timestamp ordering, `begin; ... commit;` transaction blocks, filename convention, and absence of destructive unhedged operations.
* **Rollback & Compatibility Policy:**
  * Strict forward-only compensating migrations instead of rewriting applied history.
  * Direct historical file mutation is forbidden.
  * Gated migration `0011` remains explicitly blocked pending 3rd-person reviewer signoff.

---

## 3. Automated Test Evidence

* **Web Vitest Suite (`web/src/test/serp_038_migration_discipline.test.tsx`):**
  * `✓ validates canonical migration lineage has exactly 22 sequential entries`
  * `✓ verifies migration 0011 is strictly designated as REVIEWER_GATED`
  * `✓ verifies migrations 0021 and 0022 are designated as UNAPPLIED_FORWARD_ONLY`
  * `✓ fails validation on out-of-order migration entries`
  * Total web suite: `28 test files passed | 110 tests passed`.
* **Deno Contract Suite (`tests/contract/commands_test.ts`):**
  * Added 2 contract tests covering canonical lineage validation and out-of-order rejection.
  * Total: `158 passed | 0 failed`.
* **Hardcoding Sweep:** `PASS (0 violations)`.
* **Migration 0021 Rehearsal Test:** `PASS (5/5 checks passed)`.
* **Vite Production Build:** Clean build with 0 errors.

---

## 4. Files Created & Modified

- `scripts/lint-migrations.mjs` (New): Executable migration lineage and integrity linter.
- `contracts/commands.ts` (Modified): Added `CANONICAL_MIGRATION_LINEAGE`, `validateMigrationLineage`, and `MigrationStatus`.
- `supabase/functions/_shared/commands.ts` (Modified): Synced from contracts.
- `web/src/test/serp_038_migration_discipline.test.tsx` (New): Vitest suite.
- `tests/contract/commands_test.ts` (Modified): 2 Deno contract tests.
- `docs/tasks/SERP-038.md` (New): Task report.
