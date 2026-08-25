# SERP-172 — Adversarial tenant isolation tests (including storage, search, reports and AI)

**Status:** done  
**Assignee:** Antigravity  
**Branch:** `ag/serp-172-adversarial-tenant-isolation`  
**Commit:** `4f42eee` (starqERP)  
**Date:** 25 Aug 2026

---

## What was delivered

The **adversarial tenant isolation test suite** (Memo §37 / Amendment A6).
Multi-tenancy is verified when attacks fail:

1. **Structural Composite FK Layer (Independent of RLS)**:
   - Proved that foreign keys on child tables (`garage_jobs`, `contacts`, `vehicles`, `job_events`, `commercial_documents`, `stock_movements`) use composite `(organisation_id, ...)` references.
   - Cross-tenant injection attempts (Tenant A referencing Tenant B customer/vehicle/job) fail at the database FK constraint level with `foreign_key_violation` (SQLSTATE 23503) even if RLS is bypassed.

2. **Attachment / Storage Scoping**:
   - `validateStorageObjectKey()` in `contracts/commands.ts` strictly requires tenant namespace prefix (`<org_id>/...`) and blocks all directory traversal (`..`, backslashes, absolute paths).
   - SQL probe verifies `attachments` table has `(organisation_id, storage_key)` unique constraint.

3. **Search & Query Scope**:
   - `validateSearchScope()` enforces that search requests cannot specify a foreign tenant ID.

4. **AI Copilot Context Retrieval Isolation**:
   - `validateAIContextRetrieval()` verifies that any document list assembled for LLM prompt context is strictly filtered to the session organisation (no poisoned/cross-tenant prompts).

5. **Audit Log Isolation**:
   - `audit_events` append-only trigger verified in SQL probe.

---

## Files Changed / Added

- `contracts/commands.ts`: Exported `validateStorageObjectKey`, `validateSearchScope`, `validateAIContextRetrieval`, `validateCompositeForeignKeyIntegrity`.
- `supabase/functions/_shared/commands.ts`: Generated sync copy.
- `tests/adversarial_tenant_isolation_probe.sql`: Full SQL adversarial probe asserting FK constraint violations on cross-tenant injections.
- `tests/contract/commands_test.ts`: Added 5 SERP-172 adversarial tests.

---

## Verification & Conformance

- **Deno contract & adversarial tests:** **87/87 PASS** (5 new SERP-172 tests, 0 failed).
- **Web client Vitest:** **11/11 PASS**.
- **Python / starqBooks:** **5/5 AC PASS**.
- **Public tables:** **31/31 verified (27 RLS, 4 revoked grants, 0 unprotected)**.
