# Task Completion Report: SERP-161
## Generalise Security Boundary — Eliminate CLUB_IGNITION_ID Constant

* **Phase**: Phase 2 — Authorization & Identity Hardening
* **Priority**: P0
* **Status**: **DONE**
* **Completion Date**: 2026-08-24
* **Completion Commit**: `4631dc8`
* **Governing Decisions**: DEC-072, DEC-082, DEC-089

---

### 1. Summary
Removed hardcoded CLUB_IGNITION_ID UUID constant from Edge Function API and established dynamic multi-tenant session authority.

---

### 2. Problem Statement
`supabase/functions/starq-api/index.ts` contained a hardcoded constant `CLUB_IGNITION_ID` and checked `session.organisation_id !== CLUB_IGNITION_ID`, hardcoding the entire Edge gateway to a single tenant and preventing multi-tenant operation.

---

### 3. Implementation Details
1. Removed `const CLUB_IGNITION_ID` from `starq-api/index.ts`.
2. Updated `readSession` to validate `session.organisation_id` as a valid UUID.
3. Updated `establishPerson` to dynamically resolve the organization from allowlist entity codes (`CI`, `SM`, etc.) and set `organisation_id` dynamically.
4. Updated `GET /health` and `/api/meta` to check active organization count rather than a hardcoded single ID.
5. Added adversarial unit test in `tests/contract/commands_test.ts` proving cross-tenant payload injection is blocked before reaching policies.

---

### 4. Verification & Proof
* `deno test --allow-read tests/contract/`: 49 passed, 0 failed.
* Adversarial cross-tenant test verified.
