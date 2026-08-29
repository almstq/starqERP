# M0-BACK-001 — PostgreSQL RLS policies and Edge API handlers against the frozen contract

**Status:** done  
**Assignee:** Antigravity  
**Branch:** `ag/m0-back-001-backend-rls-verification`  
**Date:** 25 Aug 2026

---

## What was delivered & verified

Milestone 0 backend contract and Row Level Security verification:

1. **PostgreSQL RLS Table Protection (31/31 public tables verified)**:
   - 27 tables protected with explicit tenant-scoped RLS policies (`organisation_id = current_setting('app.current_organisation_id')`).
   - 4 internal catalog tables have public grants strictly revoked (`service_role` only).
   - 0 unprotected tables.
   - Proven via `tests/rls_isolation_probe.sql` and `tests/adversarial_tenant_isolation_probe.sql`.

2. **Server-Enforced Authorization Matrix**:
   - Edge API (`/api/ops/event`) calls `authorizeCommand(principal, intent)` before any database invocation.
   - Authority is derived strictly from verified session tokens (`session.organisation_id`, `session.person_uuid`, `session.acting_as`, `session.seats`).
   - Zero caller-supplied seat targeting, forged tenant IDs, or client-side roles accepted.
   - Multi-seat matrix (`COMMAND_SEATS` and `SQL_PERMITTED_SEATS`) and segregation of duties pairs (`PURCHASE_SOD_PAIRS`) enforced at boundary.

3. **Composite Foreign Key Structural Isolation**:
   - Child tables (`garage_jobs`, `contacts`, `vehicles`, `job_events`, `commercial_documents`, `stock_movements`) use composite `(organisation_id, ...)` references, guaranteeing cross-tenant isolation at the database schema layer even if RLS is bypassed.

---

## Acceptance Criteria Assessment

| Acceptance Criterion | Status | Evidence |
|---|---|---|
| Handlers pass contract suites | ✓ MET | 94/94 Deno contract & endpoint tests PASS, 11/11 Vitest tests PASS |
| No client-supplied authorization accepted | ✓ MET | Verified in Edge boundary (`index.ts`), contract tests (SERP-161, SERP-178, SERP-172), and database RPC (`api_garage_command`) |

---

## Conformance Evidence

- **Deno Contract Suite:** 94/94 PASS
- **Web Client Vitest Suite:** 11/11 PASS
- **Python / the foundation engine Suite:** 5/5 AC PASS
- **RLS & Security Probes:** 31/31 tables verified
