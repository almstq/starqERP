# SERP-438 — Reorder threshold and low-stock visibility signal (QA evidence)

Date: 2026-09-19  
Author: Antigravity, under SERP-085 + SERP-086 accepted authority (Room seq 6161, 6164) and Founder instructions.  
Scope: Nullable reorder threshold at product/inventory level, live low-stock signal derived from `stock_movements_derived_onhand`, POS catalogue & counter UI low-stock visibility.  
Files:
- `supabase/migrations/202609192300_serp438_low_stock_visibility_signal.sql`
- `supabase/functions/starq-api/index.ts`
- `web/src/domain/counter.ts`
- `web/src/domain/counter.test.ts`
- `web/src/components/counter/CounterView.tsx`
- `tests/contract/serp_438_low_stock_visibility_test.ts`
- `tests/serp438_low_stock_probe.sql`
- `tests/run_serp438_low_stock_probe.ps1`

## Trigger & Scope Boundary

SERP-438 introduces low-stock visibility signals into the counter / POS workflow:
- **Product & Inventory Schema:** Adds nullable `reorder_threshold numeric(20, 6) default null check (reorder_threshold is null or reorder_threshold >= 0)` to `public.products` and `public.inventory_items`. Default is `null` (no forced configuration).
- **Single Source of Truth (SSOT):** Low-stock state is computed **LIVE** from `public.stock_movements_derived_onhand(p_organisation_id, p_location_id, p_product_id)`. It is NEVER a cached or separately-maintained column or table flag that could drift from the ledger.
- **Exact Boundary Rule:** An active stock product is low stock when `reorder_threshold is not null` and `coalesce(derived_quantity, 0) <= reorder_threshold`. Products with `reorder_threshold is null` or `kind = 'service'` are never low stock.
- **POS / Catalogue Surfacing:** Surfaced visually on counter catalogue cards and cart item alerts in the web UI, with a quick filter toggle for low-stock items.
- **Strict Non-Goals (Exclusions):**
  - NO automatic purchase order generation.
  - NO RFQ or procurement automation.
  - NO demand forecasting, safety stock algorithms, or planning pipelines.
  - Currency N/A (no monetary quantities involved).

## Architecture & Implementation

### 1. Database Schema (`supabase/migrations/202609192300_serp438_low_stock_visibility_signal.sql`)
- Altered `public.products`: added `reorder_threshold numeric(20, 6) default null check (reorder_threshold is null or reorder_threshold >= 0)`.
- Altered `public.inventory_items`: added `reorder_threshold numeric(20, 6) default null check (reorder_threshold is null or reorder_threshold >= 0)`.
- Updated `public.api_product_command`:
  - `create`: parses and validates non-negative `reorder_threshold`, stores it, and returns it in the `product` payload.
  - `update`: updates `reorder_threshold` if provided in command payload with validation.
  - `read`: includes `reorder_threshold` and location-derived `is_low_stock` live against `stock_movements_derived_onhand`.
- Updated `public.api_counter_price_resolution`: includes `reorder_threshold` on the resolved product object.
- Created `public.api_counter_low_stock_signals(target_org, target_person, target_seat, p_location_id)`:
  - `security definer`, explicit `search_path = public, pg_temp`.
  - Authorizes seats: `counter`, `quartermaster`, `stores`, `director`, `managing_director`, `owner`.
  - Queries active stock products with `reorder_threshold is not null` where `coalesce(derived_quantity, 0) <= reorder_threshold`.
  - Returns `product_id`, `sku`, `name`, `on_hand`, `reorder_threshold`, `variance` (`on_hand - reorder_threshold`).
  - Revoked from `public, anon, authenticated`; granted to `service_role`.

### 2. Edge API (`supabase/functions/starq-api/index.ts`)
- Updated `GET /api/ops/counter/catalogue`: includes `reorder_threshold` in `products` query projection (`id, sku, barcode, kind, name, sale_allowed, active, reorder_threshold`).
- Added `GET /api/ops/counter/low-stock`:
  - Accepts optional `location_id` query parameter.
  - Invokes `api_counter_low_stock_signals`.
  - Maps `seat_not_authorized` $\rightarrow$ 403, `location_not_found` $\rightarrow$ 404.
  - Verified with `deno check` $\rightarrow$ **0 errors**.

### 3. Web Domain & UI (`web/`)
- `web/src/domain/counter.ts`:
  - Extended `CounterProduct` with `reorder_threshold?: number | null`.
  - Added pure domain predicates:
    - `isLowStock(product, onHand)`: returns `true` iff `kind === 'stock'`, `reorder_threshold != null`, and `onHand <= reorder_threshold`.
    - `lowStockState(product, onHand)`: returns `'none' | 'low' | 'out_of_stock'`.
    - `formatLowStockLabel(product, onHand)`: human-readable badge copy (`"Out of stock"`, `"Low (≤ {threshold})"`, or `null`).
- `web/src/domain/counter.test.ts`:
  - Added 6 unit tests covering default null, service exemptions, above threshold, exact boundary, below threshold, and out-of-stock badge copy.
  - Test suite passes: **39/39 PASS**.
- `web/src/components/counter/CounterView.tsx`:
  - Added "Low Stock Only" filter toggle in product search header.
  - Added visual badge on product catalogue cards:
    - Warning badge (`Low (≤ {threshold})`) when `isLow && onHand > 0`.
    - Destructive badge (`Out of stock`) when `onHand <= 0`.
  - Added cart line item alert when item in cart is low on stock.
  - Verified with `npm run lint` (`tsc --noEmit`) $\rightarrow$ **0 errors**.

## Automated Evidence

### 1. SERP-438 Contract Suite (Deno)
`tests/contract/serp_438_low_stock_visibility_test.ts` — **16/16 PASS** (16ms):
- Default null threshold (no forced configuration).
- Live derived on-hand strictly above threshold is NOT low stock.
- Exact boundary (`onHand === reorder_threshold`) triggers low stock signal.
- On-hand below threshold triggers low stock signal with negative variance.
- Stock issue updates derived on-hand live and flips signal immediately without cache drift.
- Service items never generate low-stock signals.
- Negative threshold values rejected on create and update.
- Cross-tenant isolation (Tenant A stock never visible in Tenant B).
- Unauthorized seat rejected with `seat_not_authorized`.
- Conformance: migration `202609192300` adds nullable `reorder_threshold numeric(20, 6) check (reorder_threshold is null or reorder_threshold >= 0)`.
- Conformance: `api_product_command` handles `reorder_threshold` across create, update, and read.
- Conformance: `api_counter_low_stock_signals` RPC defined with seat gate and live query against `stock_movements_derived_onhand`.
- Conformance: `starq-api` wires low-stock route and catalogue includes `reorder_threshold`.
- Strict exclusions: proof of zero PO generation, zero RFQ/procurement automation, zero demand forecasting.

### 2. Full Contract Suite
`deno test --no-check --allow-read tests/contract/` — **367 passed | 0 failed** (1s).

### 3. Web Unit Tests & Typecheck
- `web/src/domain/counter.test.ts` — **39 passed | 0 failed** (1.74s).
- `web npm run lint` (`tsc --noEmit`) — **0 errors** (clean).

## Synthetic Disposable-DB Probe
Delivered for independent live verification on disposable PostgreSQL 17.6.1.155 runtime:
- `tests/serp438_low_stock_probe.sql`:
  - Exercises product creation with null threshold and explicit threshold;
  - Negative threshold rejection (`invalid_reorder_threshold`);
  - Initial stock movement on-hand generation (above, exact boundary, below);
  - Direct live query of `api_counter_low_stock_signals`;
  - Mutation flip proof: issuing stock dynamically makes an above-threshold item low stock, receiving stock removes it;
  - Negative fail-closed paths (`seat_not_authorized`, `location_not_found`);
  - Cross-tenant isolation check;
  - Explicit transaction with clean rollback.
- `tests/run_serp438_low_stock_probe.ps1`: automated PowerShell runner across all repo migrations and synthetic probe.
