# Task Execution Report: SERP-181
## Settlement Allocations Gate & Domain Architecture

- **Phase:** Phase 2 — Close the security/domain gates
- **Epic:** SERP-E10
- **Priority:** P0
- **Execution state:** Complete; ready for independent review
- **Implementation commits:** `29083b6` (initial domain migration), `f6b0739` (concurrency row-locking & refund model)
- **Date:** 2026-08-25
- **Accountable owner:** Antigravity (`antigravity`)
- **Authority / Decisions:** DEC-068 (Amendment A3), DEC-069 (Gate G6)

---

## Scope & Implementation

Implemented and hardened the `settlement_allocations` domain architecture to eliminate the naive one-to-one document settlement assumption, prevent concurrent over-allocation under `READ COMMITTED`, support outbound customer refunds and credit notes, enforce permission boundaries on helper functions, and close audit gate **G6**.

Key changes:
1. **PostgreSQL Migration (`supabase/migrations/202608250012_settlement_allocations.sql`)**:
   - Expanded `commercial_documents.document_type` to natively support `'direct_expense'`, `'petty_cash_voucher'`, `'bank_charge'`, and `'refund'` without creating fictitious supplier bills.
   - Created `public.settlement_allocations` table with composite organisation-scoped foreign keys to both documents:
     - `(organisation_id, payment_document_id) -> commercial_documents(organisation_id, id)`
     - `(organisation_id, settled_document_id) -> commercial_documents(organisation_id, id)`
     - `(organisation_id, reversal_of) -> settlement_allocations(organisation_id, id)`
   - Positive allocation constraint (`allocated_amount > 0`).
   - Append-only immutability trigger (`settlement_allocations_append_only`) rejecting direct `UPDATE` and `DELETE`.
   - **Deterministic Locking & Validation Trigger (`assert_settlement_allocation_valid`)**:
     - Locks both parent commercial documents `FOR UPDATE` in deterministic UUID order (`new.payment_document_id < new.settled_document_id`) to serialize concurrent allocation attempts and prevent deadlocks under `READ COMMITTED`.
     - Forbids self-allocation (`payment_document_id <> settled_document_id`).
     - Enforces strict same-currency matching across payment, settled document, and allocation.
     - Enforces valid status (`issued` or `settled`).
     - Enforces document type roles:
       - `refund` instruments settle `credit_note` documents.
       - `credit_note` instruments settle `sales_invoice` documents.
       - `payment` / `receipt` instruments settle `sales_invoice`, `supplier_bill`, `direct_expense`, `petty_cash_voucher`, `bank_charge`.
     - Enforces allocation ceilings universally on net active allocations across both payment and settled sides.
     - Enforces valid reversal references and limits total reversals to the original allocation amount (locked `FOR UPDATE`).
   - **Derived Summary Function (`app_private.get_document_settlement_summary`)**:
     - Derives `gross_total`, `allocated_total`, `unallocated_balance`, and `settlement_status` ('unallocated', 'partially_allocated', 'fully_settled').
     - Enforces tenant membership check (`app_private.has_organisation_access(target_org)`).
   - **Permission Boundaries**:
     - RLS enabled with `settlement_allocations_current` policy and public access revoked.
     - Explicitly revoked function execution privileges from `PUBLIC`, `anon`, and `authenticated`.

2. **Test Probe Suite (`tests/settlement_allocation_probe.sql` & `tests/run_settlement_allocation_probe.ps1`)**:
   - Repeatable synthetic PostgreSQL test harness.
   - Exercises 6 positive scenarios:
     1. 1 payment allocating across 2 invoices (many-to-many).
     2. 2nd payment settling remainder of invoice (many-to-many).
     3. Unapplied payment sitting on account (derived unallocated balance).
     4. Settlement of direct expense, petty cash voucher, and bank charge.
     5. Immutable reversal record with full unallocated balance restoration.
     6. Credit note applied to sales invoice and remaining credit settled via outbound refund instrument.
   - Exercises 10 negative constraint & security checks:
     1. Direct `UPDATE` rejection (append-only trigger).
     2. Direct `DELETE` rejection (append-only trigger).
     3. Currency mismatch rejection (USD payment against MVR invoice).
     4. Self-allocation rejection.
     5. Allocation against draft document rejection.
     6. Over-allocation on payment balance rejection.
     7. Zero / negative allocation amount rejection.
     8. Cross-tenant reference rejection (Tenant A payment allocating Tenant B invoice via composite FK).
     9. Document role mismatch rejection (refund instrument attempting to settle an invoice).
     10. Helper function permission rejection (unauthenticated / non-member execution denied).

3. **Concurrency Serialization Test (`tests/test_settlement_concurrency.py`)**:
   - Spawns concurrent transactions attempting simultaneous MVR 80 allocations against a single MVR 100 payment and MVR 100 invoice.
   - Under row-level locking, exactly 1 transaction commits (MVR 80) and 1 transaction fails with over-allocation error. Final sum in database is strictly MVR 80.

4. **RLS Isolation Integration (`tests/rls_isolation_fixture.sql` & `tests/rls_isolation_probe.sql`)**:
   - 31 public tables classified (27 RLS-protected, 4 revoked-grant, 0 unprotected).
   - 27 policies behaviorally exercised with zero cross-tenant leakage.

---

## Red-First Proofs

1. **Simulated Currency Check Failure (`-SimulateBrokenCurrencyCheck`)**:
   - Bypassing assertion trigger caused Negative Test 3 to fail:  
     `ERROR: NEGATIVE TEST 3 FAILED: Currency mismatch was not rejected` (Exit code 1).
2. **Simulated Append-Only Failure (`-SimulatePermissiveAllocation`)**:
   - Dropping append-only trigger caused Negative Test 1 to fail:  
     `ERROR: NEGATIVE TEST 1 FAILED: UPDATE on settlement_allocations was not rejected` (Exit code 1).
3. **Simulated Unlocked Concurrency (`-SimulateUnlockedConcurrency`)**:
   - Without `FOR UPDATE` row locking, concurrent transactions both commit MVR 80 allocations totaling MVR 160:  
     `RED SIMULATION SUCCESS: Over-allocation defect reproduced (both workers committed MVR 80 totaling MVR 160)` (Exit code 1).
4. **Green Production Concurrency & Baseline Probe Run (`pwsh -File tests/run_settlement_allocation_probe.ps1`)**:
   - `SETTLEMENT ALLOCATION BEHAVIORAL PROBE: ALL 16 SUITES PASSED (6 POSITIVE, 10 NEGATIVE)`
   - `Results: worker_1=FAILED, worker_2=COMMITTED`
   - `Database state: row_count=1, total_allocated=80.000000`
   - `CONCURRENCY TEST PASS: Deterministic row locking serialized allocations. Total allocated is strictly MVR 80.`
   - `SERP-181 Settlement allocation & concurrency probe: PASS` (Exit code 0).

---

## Full Regression Verification

1. `tests/run_settlement_allocation_probe.ps1`: PASS (16/16 SQL probe suites + Python concurrency serialization).
2. `tests/run_rls_isolation_probe.ps1`: PASS (31 public tables classified, 27 RLS policies behaviorally exercised).
3. `tests/test_seat_matrix.py`: PASS (10/10 tests passed).
4. `tests/test_document_numbering.py`: PASS (6/6 tests passed).

---

## Acceptance Criteria Checklist

- [x] `settlement_allocations` exists with composite FKs to both documents.
- [x] One payment allocatable across many invoices, and one invoice settled by many payments.
- [x] A payment can remain unallocated on account.
- [x] Refunds and reversals are records, never edits to an issued document.
- [x] Cash, petty cash, and bank charges have a home that is not a fictional supplier bill.
- [x] Outstanding balance derived from allocations, never from a document field.
- [x] Concurrent over-allocation prevented by deterministic row locking.
- [x] No gate self-closure (submitted for independent review by Codex / Elder).
