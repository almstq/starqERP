# ERP-544 / B2a — GRNI Accrual Execution Package (PROPOSAL)

**Status:** DRAFT proposal for Founder approval. **No Herdr dispatch until approved.**
**Prepared by:** Elder (@claude, Cloudroom thr_qa5pk9d8bu), 2026-11-07.
**Task:** ERP-544 (L4, P2P, activity P2P-04). **Umbrella:** ERP-454 (L3). **Wave:** W0.
**Mandate:** `docs/roadmap/FOUNDER_APPROVED_BUSINESS_LIFECYCLE_BOARD_RECONSTRUCTION_2026-11-06.md` (on `main`, PR #190, authority `b37e56d4`).
**Parent package:** `docs/roadmap/ERP-454_P2P_EXECUTION_PACKAGE_2026-11-06.md` @ `cfecca8`.
**Founder decision carried:** D2 (2026-11-06) — add `2160 Goods Received Not Invoiced`.

## Dependency gate — SATISFIED
B2 (ERP-541, goods-receipt persistence + stock-ledger integration) merged to `main` at **`26e73793`** (PR #193, Vision PASS #18503, post-merge 6/6 green). B2a may proceed. **Baseline for this package = `main @ 26e73793`.**

## Outcome (unchanged from card)
Accepting goods creates a balanced GL accrual **before** any supplier invoice exists: inventory debited, a GRNI control account credited. The accrual clears when the supplier bill is matched (B5, later wave).

## Verified starting state (to re-confirm at dispatch, not assume)
- Seeded CoA has `1310` inventory (control, moving average), `2110` AP (control), `1320` goods in transit, `5110` COGS, `5210` import duties (`supabase/migrations/202608300035_chart_of_accounts_as_data.sql:81-112`). **No GRNI account exists yet.**
- `accounting_events` / `accounting_event_lines` are immutable, tenant-scoped; `propose_journal_from_accounting_event` enforces balanced postable lines (`supabase/migrations/202610260400_serp460_accounting_event_subledger.sql`).
- **Integration seam (new, post-B2):** B2 added the `PURCHASE/receive` persistence path (`goods_receipts` + `goods_receipt_lines` + one `stock_movements` row/line, server-authoritative unit cost). B2a attaches the GL accrual emission **at the same accepted-receipt boundary**, reusing B2's validated receipt value — it does NOT re-implement receipt persistence or valuation.

## Bounded build requirements
1. Add `2160 Goods Received Not Invoiced` to the seeded CoA, tenant-scoped, via an **idempotent** seed migration (re-running must not duplicate).
2. On an **accepted** receipt (the B2 success path), emit one `accounting_events` row proposing balanced lines **Dr `1310` / Cr `2160`** for the received value.
3. Value at the receipt unit cost already established by B2 (PO line cost pre-B3; landed cost deferred to B3). Reuse B2's server-authoritative value — do not recompute independently.
4. Keep the event immutable and balanced; go through `propose_journal_from_accounting_event`; **never write journals directly**.
5. Expose enough read-through for the acceptance suite to confirm the `2160` balance equals received-not-invoiced value.

## Out of scope (hard boundaries)
Landed-cost allocation (B3), server valuation RPC (B4), supplier bill + match/clearing of `2160` (B5), payment (B6), reversal (B7). No changes to B1/B2 merged behaviour beyond the accepted-receipt emission hook.

## Acceptance criteria (L4, mandate §2 — zero skips)
- [ ] `2160` exists on a fresh DB after `applyAllMigrations`.
- [ ] Re-running the seed does not duplicate the account.
- [ ] A receipt produces **one** `accounting_events` row and balanced lines Dr `1310` / Cr `2160`.
- [ ] `2160` balance equals received-not-invoiced value across **multiple** receipts.
- [ ] A receipt with zero value or unknown item is refused **before** an event is written.
- [ ] Cross-tenant receipt cannot post into another tenant's `2160`.
- [ ] `propose_journal_from_accounting_event` accepts the event; an unbalanced variant is rejected.
- [ ] Independent reviewer is not the builder (DEC-072).

**False-pass guard (mandate):** a "GL effect" test that only checks an `accounting_events` row exists is insufficient — it must assert **both lines, their accounts, and that `1310` and `2160` balances move by the same amount.**

## Proposed execution shape (for Founder approval)
- **Builder:** one accountable engineering agent (Codex to staff per the ERP-541 precedent, or Founder names the seat). Standard A identity (`a.musthaq@gmail.com`).
- **Branch / worktree:** fresh isolated worktree from `main @ 26e73793`, branch `<builder>/erp544-grni-accrual-20261107`.
- **Deliverable:** idempotent CoA-seed migration + accepted-receipt accrual-emission migration + acceptance probe (SQL) covering all 8 criteria with the balance-equality assertion + any edge/contract test. Migration applies from zero, lint-clean, authorized path only.
- **Verification:** independent Vision pass (not the builder, DEC-072) at the immutable PR head, then Founder merge. No auto-merge.
- **No duplicate task** (uses existing ERP-544), no repeat of B1/B2 engineering.

## Open items genuinely needing a Founder call
1. **Staffing:** confirm Codex staffs ERP-544, or name the builder seat. (Recommend: same route as ERP-541.)
2. **Dispatch go/no-go:** approve this package to hand to the Herdr floor, or request changes first.

No decisions beyond these are blocked; all technical scope is specified by the card + mandate.
