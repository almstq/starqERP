# Task Execution Report: SERP-176
## Server-Side Concurrency-Safe Document Numbering Real SQL Probe & Acceptance (Amendment A5)

- **Phase:** Phase 2 — Close the security/domain gates
- **Epic:** SERP-E10
- **Priority:** P1
- **Execution state:** Complete; ready for independent review
- **Implementation commit:** `f8dbcbf`
- **Date:** 2026-08-25
- **Accountable owner:** Antigravity (`antigravity`)
- **Authority / Decisions:** DEC-051 (Single Financial Truth), DEC-068 (Amendment A5), DEC-069 (Gate G6), DEC-072 (Evidence Verification)

---

## Scope & Implementation

Resolved the reopen defect from the second audit (DEC-072) where document numbering had only been verified against in-memory mocks. Implemented a full, real-path PostgreSQL probe harness exercising high-concurrency allocations and same-key idempotency retries directly against the database runtime.

### 1. Real SQL Test Probe ([`tests/document_numbering_probe.sql`](file:///d:/StarqTech/starqERP/tests/document_numbering_probe.sql))
- **Suite 1:** Single allocation formatting with configurable prefix and padding (`CI-JOB-0001`).
- **Suite 2:** Sequential advancement across successive allocations (`0002`, `0003`).
- **Suite 3:** Multi-tenant isolation: Tenant A at `0003` does not advance or collide with Tenant B at `0001`.
- **Suite 4:** Sequence type isolation: Independent counters for `garage_job` vs `sales_invoice`.
- **Suite 5:** Rejection of unknown sequence types with explicit exception (`unknown document sequence`).
- **Suite 6:** Rejection of unknown organisations.
- **Suite 7:** Check constraint enforcement on padding bounds (`padding between 1 and 12`).
- **Suite 8:** Database-level uniqueness on `commercial_documents(organisation_id, document_type, document_no)`.

### 2. Multi-Threaded Concurrency & Idempotency Runner ([`tests/test_document_numbering_real_concurrency.py`](file:///d:/StarqTech/starqERP/tests/test_document_numbering_real_concurrency.py))
- **Test 1 (50 Concurrent Threads):** 50 parallel worker threads executing `app_private.allocate_document_no` concurrently. Verified:
  - Exactly 50 results returned.
  - Zero duplicate numbers.
  - Exactly contiguous range `CI-JOB-0001` .. `CI-JOB-0050`.
  - Database `next_value` advanced to 51.
- **Test 2 (Same-Key Idempotent Retry):** 2 concurrent worker threads submitting the exact same idempotency key for `CALL` command:
  - Both callers receive HTTP 200 / matching JSON response containing identical `job_no` (`CI-JOB-0100`).
  - Exactly 1 `garage_jobs` row created.
  - Sequence consumed strictly once (`next_value` 100 -> 101).
- **Test 3 (Idempotency Key Conflict):** Calling with same key but altered payload:
  - `idempotency_key_conflict` raised.
  - Sequence counter untouched (zero numbers burned).

### 3. Red-First Simulation Harness ([`tests/run_document_numbering_probe.ps1`](file:///d:/StarqTech/starqERP/tests/run_document_numbering_probe.ps1))
- Supported `-SimulateNaiveSequence` switch which strips row locking and introduces race conditions in `allocate_document_no`.
- Proved that without row-level serialization, 48 duplicate numbers are produced out of 50 allocations (reproducing the real-world race).
- Clean run proves 100% green execution with zero duplicates under production locking.

---

## Verification & Conformance Evidence

- `pwsh -NoProfile -File tests/run_document_numbering_probe.ps1 -SimulateNaiveSequence`: **PASS (RED PROOF: 48 duplicates reproduced)**
- `pwsh -NoProfile -File tests/run_document_numbering_probe.ps1`: **PASS (GREEN: 50 unique allocations, matching same-key replay)**
- `deno test --allow-read tests/contract/commands_test.ts`: **51/51 passed**
- `python tests/test_seat_matrix.py`: **10/10 passed**
- `python tests/test_document_numbering.py`: **6/6 passed**
- `pwsh -NoProfile -File tests/run_settlement_allocation_probe.ps1`: **16/16 suites + concurrency PASS**
- `pwsh -NoProfile -File tests/run_rls_isolation_probe.ps1`: **31 tables, 27 RLS policies PASS**
