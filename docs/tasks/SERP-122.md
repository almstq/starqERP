# Task Execution Report: SERP-122
## Date-Effective Tax Rates — Time of Supply Validity Resolution (DEC-060 / DEC-073)

- **Phase:** Phase 4 — Adversarial security & accounting truth
- **Epic:** SERP-E00
- **Priority:** P0
- **Execution state:** Complete; ready for independent review
- **Implementation commit:** `697e748` (starqBooks) / `6652613` (starqERP / migration 0017)
- **Date:** 2026-08-25
- **Accountable owner:** Antigravity (`antigravity`)
- **Authority / Decisions:** DEC-060, DEC-073 §10

---

## Scope & Implementation

Closed the critical TGST rate change defect (Maldives Tourism GST changing from 16% to 17% on 1 July 2025 under the Seventh Amendment to the GST Act) by enforcing that tax rates are never hardcoded constants, but date-effective validity periods resolved strictly by time of supply.

### 1. Python Accounting Engine Alignment ([`starqBooks/`](file:///d:/StarqTech/starqBooks/))
- **`ops/masters/tax.json`:**
  - Structured all tax rate codes with explicit `valid_from` and `valid_to` timestamps.
  - Added historical TGST schedules (16% through 2025-06-30; 17% from 2025-07-01) and GGST (8%).
- **`journal_outbox.py`:**
  - Implemented `rate_on(supply_date, code)` and `rate_for_supply(supply_date, code)` to resolve date-effective rates based on the transaction's time of supply (the earlier of invoice issuance or payment receipt).
  - Generalised fraction-to-percent normalisation (`amt > 0 and amt < 1 -> amt * 100`) to eliminate special-casing for 0.08 and prevent 100x tax understatement on fractional rates.
  - Removed all hardcoded tax-rate literals from application source code.

### 2. SQL & Contract Foundation ([`starqERP/`](file:///d:/StarqTech/starqERP/))
- Schema migration `202608250017_tax_regimes_and_periods.sql` establishes `tax_rate_schedules` and `tax_registrations`.
- PostgreSQL function `app_private.calculate_line_tax()` and TypeScript contract `calculateLineTax()` in `contracts/commands.ts` resolve date-effective schedules at time of supply.

---

## Verification & Conformance Evidence

- **Specification-by-Test Suite ([`starqBooks/test_tax_period.py`](file:///d:/StarqTech/starqBooks/test_tax_period.py)):**
  - AC1 (every rate carries `valid_from`): **PASS**
  - AC2 (resolver accepts a date): **PASS**
  - AC3 (16% on 2025-06-30, 17% on 2025-07-01): **PASS**
  - AC4 (credit note uses original rate): **PASS**
  - AC5 (no tax-rate literals in application code): **PASS**
  - **Result: 5/5 Acceptance Criteria Passed (100% PASS)**.
- **Python Unittest Suite:** **40/40 tests passed in 8.97s**.
- **Deno Contract Conformance:** **71/71 tests passed in 164ms**.
- **Web Vitest Suite:** **11/11 tests passed in 1.3s**.
