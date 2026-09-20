# Currency architecture correction — live-verification evidence

Date: 2026-09-19
Author: Elder (Claude Code), under explicit Founder authorization (Room seq 6167, committed per seq 6169)
Scope: `api_garage_command` COUNTER_SALE branch, `api_counter_price_resolution`, `api_counter_approved_prices`
Files: `supabase/migrations/202609190059_counter_sale_stock_issue.sql`, `supabase/migrations/202609192000_serp086_barcode_approved_pricing.sql`

## Trigger

Founder architecture check (Room seq 6165): confirm SERP-086 and the POS/pricing path have not
baked in MVR as a hardcoded or sole-currency assumption. Architecture invariant: currency
identifiers follow ISO 4217; MVR is the Maldivian default, not a platform constant.

## Finding (Room seq 6166)

Schema layer was already correct — `products`/`product_prices`/`books`/`organisations` all type
`currency`/`base_currency` as `character(3)`, defaulting to `'MVR'` (a default, not a constraint).

Resolution layer had a real, dormant defect: three call sites filtered `product_prices` with a
literal `and pp.currency = 'MVR'` instead of deriving the functional currency from
`organisations.base_currency`, and the JSON responses literal-tagged `'currency': 'MVR'`. Dormant
because every org in use today is MVR-only, but it would silently block resolution for any future
non-MVR org (fail-closed `stock_line_no_price`, not corruption — but still a defect).

## Fix (Founder-authorized, Room seq 6167)

Each of the three functions now resolves `v_org_currency` once from `organisations.base_currency`
and uses it everywhere the literal `'MVR'` previously appeared, in both the price-lookup `WHERE`
clause and the response JSON's `currency` field.

One additional site was found only by testing a real non-MVR org end to end: the COUNTER_SALE
invoice and payment `commercial_documents` inserts never set `currency` explicitly, silently
defaulting to `'MVR'` via the column default regardless of the org's actual currency. Both inserts
now set `currency = v_org_currency`. This surfaced via `assert_settlement_allocation_valid()`
correctly rejecting the resulting inconsistency (payment/invoice tagged MVR, settlement allocation
tagged USD) before the fix, and accepting cleanly after — a real trigger catching a real defect,
not a false positive.

Scope was kept surgical per Founder instruction: no FX conversion, no mixed-currency carts, no
exchange-rate handling, no foreign settlement, no multi-currency feature work. Unrelated literal
`'MVR'` occurrences in the same file (INVOICE_PAYMENT and PAY_SUPPLIER branches) were left
untouched — out of scope.

## Live-verification evidence (disposable Postgres, all five Founder acceptance items)

1. **MVR path unchanged** — existing org (`a0000000-...-001`), COUNTER_SALE still accepts
   identically; the response now additionally reports `"currency": "MVR"` (previously absent).
2. **Non-MVR org resolves correctly** — seeded a disposable USD org/location/product/
   `product_prices` row (9.99 USD). Single-item resolution, bulk resolution, and a full
   COUNTER_SALE all resolved/settled correctly: on-hand 50 → 48, invoice + payment +
   `settlement_allocations` consistently tagged `USD`.
3. **Fail-closed preserved** — a USD-org product with no `product_prices` row still returns
   `resolved:false, reason:'stock_line_no_price'`, and now correctly reports `currency:'USD'` even
   in the failure payload (proves the fix reaches the fail-closed branch too, not just the happy
   path).
4. **Response reports the actually resolved currency** — confirmed in every path exercised above
   (MVR success, USD success, USD fail-closed, USD bulk).
5. **No regression to SERP-085/086/434** — MVR org COUNTER_SALE still accepts; oversell (qty
   999999) still correctly rejects with `stock_line_insufficient_on_hand`.

## Explicit non-goals

No FX conversion or exchange-rate handling. No mixed-currency cart support. No foreign-currency
settlement. No international tax/compliance work. No change to SERP-087 (tender/receipt), which
ran independently and was not interrupted by this correction.
