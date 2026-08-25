# Task Execution Report: SERP-174
## Single Source of Financial Truth Invariant (Amendment A2 / DEC-051)

- **Phase:** Phase 2 — Close the security/domain gates
- **Epic:** SERP-E10
- **Priority:** P0
- **Execution state:** Complete; ready for independent review
- **Implementation commit:** `5e897aa`
- **Date:** 2026-08-25
- **Accountable owner:** Antigravity (`antigravity`)
- **Authority / Decisions:** DEC-051 (Single Source of Financial Truth), DEC-068 (Amendment A2), DEC-072 (Evidence Verification)

---

## Scope & Implementation

Formalized Amendment A2 into the canonical contract `contracts/commands.ts` to prevent financial drift between StarqERP presentation and the authoritative accounting engine (`starqBooks` double-entry ledger).

### 1. Verbatim Founder Invariant
Enshrined the exact founder directive as `FINANCIAL_TRUTH_INVARIANT`:
> *"Any statutory or accounting figure shown by StarqERP must originate from, or reconcile to, the authoritative accounting engine."*

### 2. Explicit Domain Boundary Partitioning
- **Statutory Boundary (`STATUTORY_FIGURE_DOMAINS`)**:
  - `profit_and_loss`
  - `balance_sheet`
  - `ledger_balances`
  - `posted_receivables`
  - `posted_payables`
  - `gst_position`
  - `statutory_financial_reporting`
  *Requirement:* Must be backed by an authoritative accounting engine (`'starq_books_engine' | 'reconciled_journal_outbox'`) and carry an explicit, non-empty `reconciliationReference`.

- **Operational Boundary (`OPERATIONAL_ANALYTICS_DOMAINS`)**:
  - `job_margin`
  - `turnaround`
  - `utilisation`
  - `stock_cover`
  *Requirement:* May be calculated independently as management information without statutory ledger reconciliation.

### 3. Contract Enforcement & Error Codes
- Added `statutory_reconciliation_required` to `ERROR_CODES`.
- Implemented pure decision function `validateFinancialFigureSource()`.
- Exported interfaces `StatutoryFigureSource`, `OperationalAnalyticsSource`, and `FinancialFigureSource`.
- Synced canonical contract to Edge bundle via `scripts/sync-contract.mjs`.

---

## Verification & Conformance Evidence

### Deno Conformance Test Suite (`tests/contract/commands_test.ts`)
Added 4 comprehensive negative and partition tests (50/50 total pass):
1. **Verbatim Invariant Assertion**: Proves `FINANCIAL_TRUTH_INVARIANT` strictly matches the founder's directive.
2. **Domain Partition Disjointness**: Proves statutory and operational domain arrays are exhaustive and disjoint.
3. **Negative Statutory Reconciliation Refusal**:
   - Refuses unclassified figures (`statutory_reconciliation_required`).
   - Refuses statutory figures smuggled as operational (`statutory_reconciliation_required`).
   - Refuses statutory figures lacking authoritative engine (`statutory_reconciliation_required`).
   - Refuses statutory figures citing ad-hoc/fabricated sources (`statutory_reconciliation_required`).
   - Refuses statutory figures with empty/whitespace reconciliation reference (`statutory_reconciliation_required`).
   - Accepts statutory figures with valid engine and reconciliation reference.
4. **Operational Analytics Calculation**: Proves operational figures pass independently without statutory engine constraints.

### Full Regression Results
- `deno test --allow-read tests/contract/commands_test.ts`: **50/50 passed (0 failed)**
- `python tests/test_seat_matrix.py`: **10/10 passed**
- `python tests/test_document_numbering.py`: **6/6 passed**
- `pwsh -NoProfile -File tests/run_settlement_allocation_probe.ps1`: **16/16 passed + concurrency PASS**
- `pwsh -NoProfile -File tests/run_rls_isolation_probe.ps1`: **31 tables, 27 RLS policies PASS**
