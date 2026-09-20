# SERP-087 — Tender, receipt and financial consequence (QA evidence)

Date: 2026-09-19
Author: OpenCode / Antigravity (switched to Antigravity per Founder authorization, Room seq 6182), under SERP-434/commit 0c46cde authority — this
migration is the direct continuation of the accepted feed chain (SERP-085/086/434).
Scope: `api_garage_command` COUNTER_SALE branch, `counter_tenders`, `counter_receipts`,
`api_counter_receipt_get`, `api_counter_receipt_mark_rendered`
Files:
- `supabase/migrations/202609192100_serp087_tender_receipt_financial_consequence.sql`
- `tests/contract/serp_087_tender_receipt_financial_consequence_test.ts`
- `tests/serp087_tender_receipt_probe.sql`
- `tests/run_serp087_tender_receipt_probe.ps1`

## Trigger

SERP-087 adds the tender and receipt surface for COUNTER_SALE: the sale must record exactly what
was handed over (server-authoritative tender legs), compute change on the server, and mint a
duplicate-proof receipt register. The stale migration (202609192100) was the continuation of the
SERP-085/086 feed and carried over the code prior to the SERP-434 currency correction — so it
still had the `pp.currency = 'MVR'` literal filters and `'MVR'`-pinned document/register inserts.
No new MVR-dependency was introduced by this lane; the currency discipline was applied to the
whole POS path exactly as committed for SERP-086 (commit 0c46cde, Room seq 6167).

## Finding

1. The stale migration pre-dated SERP-434: price lookup filtered `product_prices` on a literal
   `'MVR'` and the invoice/payment/settlement/register inserts pinned currency via the column
   default. Any future non-MVR org's counter sale would silently record MVR financial facts.
2. The migration's own new surface (`counter_tenders`, `counter_receipts`,
   `api_counter_receipt_get`, `api_counter_receipt_mark_rendered`) had no MVR assumptions —
   `currency character(3) not null` with values passed at insert time. The defect was only in the
   COUNTER_SALE branch that feeds them.

## Fix (applied to 202609192100, byte-identical reasoning as commit 0c46cde)

- Added `v_org_currency` declaration, derived once via
  `select base_currency into v_org_currency from public.organisations where id = target_org;`
  and `organisation_not_found` raised when null.
- `pp.currency = v_org_currency` replaces the literal in the price lookup.
- Invoice and payment `commercial_documents` inserts now set `currency = v_org_currency`
  explicitly (previously the `'MVR'` column default applied silently).
- Settlement allocation, tender legs, and the register insert all carry `v_org_currency`.
- The outbox/event payload and the response both report `currency`/the tender totals derived
  server-side.
- Non-COUNTER_SALE branches are byte-identical to the committed 202609190059 file. The only two
  remaining `'MVR'` literals are the pre-existing INVOICE_PAYMENT/PAY_SUPPLIER settlement rows
  (out of scope, unchanged from the committed reference).

Disciplines that were already correct and are preserved:
- Tender is client-declared, server-validated; client totals/change never survive.
- Change is refunded in cash only — any overpayment above cash legs is rejected
  (`counter_sale_change_exceeds_cash`).
- Register is one row per sale; reprints increment `renders` on the SAME row/number.
- Seat apertures: COUNTER_SALE = counter/director/managing_director/owner; receipt read/render =
  counter/quartermaster/stores/plus those.

## Automated evidence

### Contract suite (Deno, no DB)

`tests/contract/serp_087_tender_receipt_financial_consequence_test.ts` — 33 tests, pass.
Pure-logic mirrors (tender reconciliation, receipt store/mark-rendered mirrors) + a
source-conformance layer over the migration text:
- DDL: uniques `(org, receipt_id)`, `(org, receipt_number)`, `(org, receipt_id, payment_method)`,
  append-only register/legs, FK wiring to `commercial_documents`.
- Validation gates: invalid method, missing/zero/duplicate tender, single-vs-mixed rules,
  method mismatch, insufficient tender, change-exceeds-cash, tax mode, seat gate.
- Server-computed change; register insert carries server totals; `renders` starts at 0.
- Receipt RPCs exist, granted to `service_role`, un-granted to anon/authenticated, and carry the
  seat aperture and tenant scoping (`seat_not_authorized` / `receipt_not_found`).
- Currency regression: no `= 'MVR'` equality anywhere in the POS path; `v_org_currency` flows
  through lookup, documents, settlement, legs, register, payload and response; exactly the two
  pre-existing settlement `'MVR'` literals remain.
- Outbox keys (`COUNTER_SALE`, receipt/render) and scope discipline.

Full suite: `deno test --no-check --allow-read tests/contract/` → **332 passed, 0 failed**.
`--no-check` is required only because `tenant_import_pack_test.ts` carries 11 pre-existing type
errors (committed baseline, unrelated — the SERP-087 test alone type-checks clean).

### Pre-existing assertion alignment (committed debt, disclosed)

`serp_086_barcode_approved_pricing_test.ts` (~line 697) asserted `pp.currency = 'MVR'` against
migration 202609192000 after commit 0c46cde changed that migration to `pp.currency = v_org_currency`.
The stale assertion was aligned to the committed reality (asserts `v_org_currency` + absence of the
literal). Pre-existing debt from commit 0c46cde, not introduced by this lane.

### Web surface (was complete from the frozen session; re-verified)

- `web npm test`: **780 passed, 1 skipped** (129 files) — includes counter tender/change tests.
- `web npm run lint` (`tsc --noEmit`): clean.

## Disposable-DB probe (delivered for live verification)

`tests/serp087_tender_receipt_probe.sql` (single explicit transaction; a disposable
Postgres 17.6.1.155 + the full migration set, run by `tests/run_serp087_tender_receipt_probe.ps1`):

1. Money reconciliation: single cash sale (zero-rated, exact server total 100) — tendered 200 →
   change 100 on the response, register row and receipt read; one MVR tender leg.
2. Duplicate-proof: `receipt_get` idempotent (byte-identical twice), `renders` 0 on read, 2 after
   two `mark_rendered`, same `receipt_number` on every reprint, still one register row; a second
   sale mints a distinct number.
3. Idempotent replay: same `command_key` returns the stored response, same receipt number, no
   double register row (counter stays at 3).
4. Non-MVR tenant: org_two `base_currency = 'USD'` — USD resolves through price lookup, legs and
   register; mixed cash(50)+card(20) tenders reconcile to change 20; legs have `currency='USD'`.
5. Fail-closed negatives (13 cases, zero residue after all): invalid method, missing tender,
   invalid tender method, missing/zero amount, duplicate method, single-vs-mixed violations,
   method mismatch, insufficient tender, change-exceeds-cash, seat gate (`acting_seat_...`),
   cross-tenant (`seat_not_authorized`). Atomicity asserted by final counts: 4 receipts / 5 legs —
   exactly the four accepted sales, nothing else.
6. Receipt gates: read/render reject non-aperture seat and cross-tenant/unknown receipt.
7. Schema duplicate-proof: direct register re-mint rejected on both `(org, receipt_id)` and
   `(org, receipt_number)` identity; duplicate tender leg rejected by unique violation.
8. Clean rollback: no SERP-087 fixtures, register rows, legs or settlements survive; org_two
   base_currency restored.

> Docker was unavailable in this lane, so the probe is delivered unexecuted to the floor for a
> live run (`tests/run_serp087_tender_receipt_probe.ps1`), mirroring the accepted SERP-086
> probe pattern.

## Explicit non-goals

No FX conversion, no mixed-currency carts, no exchange-rate handling, no foreign settlement. No
refund/return lane (change handling is in-scope; later refunds go through the accounting lane).
No POS/ERP feature work beyond the tender/receipt surface. Hoadha projection remains an outbox
seam, not implemented here (matching the accepted counter-sale migration).