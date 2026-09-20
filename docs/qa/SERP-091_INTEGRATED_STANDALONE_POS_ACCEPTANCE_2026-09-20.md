# SERP-091 — Integrated Standalone POS Acceptance

**Date:** 2026-09-20 (overnight, Founder Priority 4 directive, Room seq 6218-6232)
**Reviewer:** Claude (Elder), independent live Postgres run
**Status:** ACCEPTED — standalone POS milestone closed

## Scope

Final POS acceptance/pilot campaign gate (per Room seq 5997/5998 PMO-traceability directive).
Successor to Hoadha's DHIV-POSX-GATE and DHIV-POS-S11-T10 on the ERP side.

Dependencies, all done at time of acceptance: SERP-085, SERP-086, SERP-087, SERP-088,
SERP-089, SERP-090, SERP-435.

## Method

One continuous transaction (`begin; ... rollback;`) against the disposable Postgres
instance at `127.0.0.1:55432`, exercising the full DB-backed journey end to end with a
fresh org, two products, two locations (including a second org for isolation checks).
Rolled back cleanly at the end — no residue.

Deliberately out of scope: hold/resume cart persistence, which is client-side only
(`web/src/domain/counter.ts`, browser `localStorage`, no DB round-trip) — confirmed by
reading the source. Per the Founder's runtime doctrine, only DB-backed transactional
acceptance criteria require live Postgres evidence; hold/resume is already covered by
the 800 passing unit tests in the web suite.

## Steps and results (all PASS)

1. **Session open** — float 100.00 opened; duplicate open at the same location correctly
   rejected (`counter_session_already_open`).
2. **Catalogue / approved-pricing resolution** — `api_counter_approved_prices` returns
   the full catalogue; an unknown price-list code correctly rejected
   (`stock_line_price_list_not_found`).
3. **Multi-line cart, authoritative pricing/tax, CASH tender + change** — client
   submitted a bogus `unit_price: 1.00` on both lines; server correctly ignored it and
   computed the true total 130.00 (2×50.00 + 1×30.00) with tax_mode `zero_rated`; a
   200.00 cash tender produced correct change 70.00; a receipt number was issued.
4. **Canonical stock issue** — `stock_movements_derived_onhand` correctly decremented on
   both products post-sale.
5. **Insufficient stock** — a 100-unit request against 4 on-hand correctly rejected
   (`stock_line_insufficient_on_hand`); on-hand unchanged (no partial/negative mutation).
6. **Low-stock signal, tenant-isolated** — setting `reorder_threshold = 4` against
   on-hand 4 correctly triggers the signal; a counter seat in a different organisation
   cannot query it (`seat_not_authorized`).
7. **Partial return** — 1 of 2 units returned; correct refund amount (50.00); correct
   partial inventory restoration (18 → 19).
8. **Idempotent replay** — replaying the same reversal command key returns the identical
   return record (`idempotent_replay: true`), zero duplicate stock mutation (on-hand
   unchanged on replay).
9. **Idempotency conflict** — same command key, different reversal type/payload,
   correctly rejected (`idempotency_key_conflict`).
10. **Negative authorization** — an unauthorized `technician` seat rejected
    (`seat_not_authorized`); a cross-tenant reversal attempt against another
    organisation's sale rejected (`sale_not_found`).
11. **Full void** — a card sale voided in full: 100% refund (30.00) and 100% stock
    restoration verified.
12. **Till close** — `expected_cash` correctly computed as opening float (100.00) + net
    cash sales (130.00) − cash refunds (50.00) = 180.00; variance correct against a
    counted value of 0.00 (−180.00); a second close attempt on the same session
    correctly rejected (`no_open_session`).

## Conclusion

All 12 steps passed in a single continuous live-Postgres run with no manual patching
mid-run. This closes SERP-091 and, with it, the entire standalone POS chain:
SERP-434 / 085 / 086 / 087 / 089 / 438 / 088 / 090 / 435 / 091.

Per the Founder's overnight directive, the milestone is now **frozen** at this accepted
state pending his morning review — no post-POS work has been started.
