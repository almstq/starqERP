# ERP-464 / B5 — Supplier Bill & Three-Way Matching Execution Package (PROPOSAL — Founder approval required)

**Status:** Founder approved the SCOPE (Room this cycle). **Implementation dispatch requires separate Founder authorization.** Cloudroom coordinates; Herdr implements (Codex assigns one accountable builder); independent Vision verification before Founder merge. No auto-merge.
**Task:** ERP-464 — "A matched supplier invoice creates a payable" (P2P-07, L3 acceptance unit; split from SERP-465). **Baseline:** `main @ a72406900068c1b8de0a3ee8c5ff2073dbd1cd9d` (post B2/B2a/B3/B4).
**Mandate:** `docs/roadmap/FOUNDER_APPROVED_BUSINESS_LIFECYCLE_BOARD_RECONSTRUCTION_2026-11-06.md` @ `b37e56d4`.

## Primary objective (INTEGRATE + ACCEPT — do NOT rebuild)
A three-way-matched supplier invoice creates an **Accounts Payable** entry with the correct accounting event. Consolidate existing capability rather than re-implementing:
- **SERP-311** three-way matching (merged `549892a`, never accepted; board task **ERP-299**, in_review) — CONSOLIDATE.
- `web/src/domain/threeWayMatch.ts` (+ test) — existing match computation to reuse via a real server caller (not a parallel client source of truth).

## Reconciliation (Command, 2026-11-08)
- **Gap:** no proven **authoritative production caller** that (a) three-way matches a supplier invoice against the PO + goods receipt, and (b) on a successful match creates the **payable on AP control `2110`** with the GL effect through the accounting-event boundary. SERP-311 unaccepted; no AP task existed on the 437-row board.
- **Accounting effect:** on a matched invoice, **clear the GRNI accrual `2160`** (from B2a) and recognise the payable: **Dr `2160` GRNI / Cr `2110` AP** for the matched value (tax handled per existing rules), balanced, immutable, via `propose_journal_from_accounting_event` (never direct journals).
- **Dependency:** satisfied — receipt (B2), GRNI (B2a), landed cost (B3), server valuation (B4) all Done on `a7240690`; invoice matching precedes payable.

## Scope (bounded)
1. Real production caller (apiGateway → `/api/ops/event` → `authorizeCommand` → `api_garage_command`) performing the **three-way match** (PO ↔ receipt ↔ invoice; quantity/price tolerance) reusing `threeWayMatch.ts` logic server-side.
2. On a passing match, create the **payable** (AP subledger / `2110`) and emit the balanced immutable accounting event **Dr `2160` / Cr `2110`** via the accounting-event boundary; GRNI `2160` cleared.
3. Expose read-through for the acceptance suite to prove the match result, the payable, and `2110`/`2160` balances.

## Out of scope (hard boundaries)
Supplier payment (B6, ERP-465), purchase reversal (B7, ERP-542), SoD (B8, ERP-543). No change to merged B1/B2/B2a/B3/B4 behavior beyond the match→payable hook. No rebuild of SERP-311.

## Acceptance (mandate §3 — all required; zero skips; no assertion-free tests)
- [ ] Actor, permissions, preconditions.
- [ ] Authoritative production execution path named, with the **real caller** (not a bare module).
- [ ] **GL effect through the accounting-event boundary**: matched invoice → Dr `2160` / Cr `2110`, balanced; GRNI cleared; payable recorded.
- [ ] Negative (match failure — qty/price out of tolerance refused), partial, reversal, retry, **idempotency (no duplicate payable)** and concurrency scenarios proven.
- [ ] Cross-tenant refusal proven.
- [ ] Audit evidence recorded.
- [ ] Fresh-database repeatable test (from zero; lint-clean; zero skipped/assertion-free).
- [ ] Independent reviewer ≠ builder (DEC-072) — Vision at the immutable PR head.
- **False-pass guard:** a module with no production caller, or a skipped/assertion-free test, does NOT satisfy; the probe must assert the actual match outcome + `2110`/`2160` balance movements (not a stub or mere row existence).

## Proposed process (on separate Founder authorization)
- Builder: Codex-assigned Herdr engineer; isolated worktree + branch (suggest `<builder>/erp464-supplier-bill-3way-20261108`) from `a7240690`; Standard A identity.
- First ACK in Room (capacity/baseline/branch/worktree) → draft PR with tests + immutable candidate SHA → Command → Vision → Founder merge (no auto-merge; mirror auto-syncs).
- One accountable builder; no duplicate task; no parallel implementation. Preserve B6–B8.
