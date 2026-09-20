/**
 * STARQ ERP — SERP-438 Reorder threshold and low-stock visibility signal proof gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The SERP-438 dispatch (M6 counter lane) proves the reorder threshold and
 * live low-stock visibility signal:
 *
 *   1. Nullable reorder_threshold at the product level (defaulting to null,
 *      no forced configuration).
 *   2. Low-stock state is derived LIVE from public.stock_movements_derived_onhand
 *      (never a cached or separately-maintained flag that can drift from the ledger).
 *   3. Low-stock state visibly surfaced in POS/catalogue UI.
 *   4. Explicitly excludes: automatic PO creation, RFQ/procurement automation,
 *      demand forecasting.
 *
 * RUN:
 *   deno test --allow-read tests/contract/serp_438_low_stock_visibility_test.ts
 */

import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';

const EDGE_MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);
const STARQ_API_PATH = new URL('../../supabase/functions/starq-api/index.ts', import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// FIXED IDENTITIES (deterministic)
// ─────────────────────────────────────────────────────────────────────────────

const ORG = '20000000-0000-4000-8000-000000000901';
const OTHER_ORG = '10000000-0000-4000-8000-000000000901';
const PERSON = '20000000-0000-4000-8000-000000000111';
const LOCATION_1 = '20000000-0000-4000-8000-000000000301';
const LOCATION_2 = '20000000-0000-4000-8000-000000000302';
const OTHER_LOCATION = '10000000-0000-4000-8000-000000000303';
const SEAT_COUNTER = 'counter';
const SEAT_TECHNICIAN = 'technician';
const SEAT_STORES = 'stores';
const SEAT_OWNER = 'owner';

// ─────────────────────────────────────────────────────────────────────────────
// PURE CONTRACT MIRROR OF LOW-STOCK DETERMINATION
// ─────────────────────────────────────────────────────────────────────────────

interface ProductRecord {
  id: string;
  orgId: string;
  sku: string;
  kind: 'stock' | 'service' | 'consumable';
  name: string;
  barcode: string | null;
  reorderThreshold: number | null;
  active: boolean;
  saleAllowed: boolean;
}

interface StockMovement {
  orgId: string;
  locationId: string;
  productId: string;
  quantity: number;
}

class InventoryStore {
  products: ProductRecord[] = [];
  movements: StockMovement[] = [];

  createProduct(
    orgId: string,
    sku: string,
    name: string,
    kind: 'stock' | 'service' | 'consumable',
    reorderThreshold: number | null = null,
    barcode: string | null = null,
  ): ProductRecord {
    if (reorderThreshold !== null && reorderThreshold < 0) {
      throw new Error('product_reorder_threshold_invalid');
    }
    const product: ProductRecord = {
      id: crypto.randomUUID(),
      orgId,
      sku,
      name,
      kind,
      barcode,
      reorderThreshold,
      active: true,
      saleAllowed: true,
    };
    this.products.push(product);
    return product;
  }

  updateThreshold(orgId: string, productId: string, reorderThreshold: number | null): ProductRecord {
    if (reorderThreshold !== null && reorderThreshold < 0) {
      throw new Error('product_reorder_threshold_invalid');
    }
    const p = this.products.find((x) => x.orgId === orgId && x.id === productId);
    if (!p) throw new Error('product_not_found');
    p.reorderThreshold = reorderThreshold;
    return p;
  }

  addStockMovement(orgId: string, locationId: string, productId: string, qty: number): void {
    this.movements.push({ orgId, locationId, productId, quantity: qty });
  }

  // Canonical derived on-hand: sum(quantity) from ledger movements
  getDerivedOnHand(orgId: string, locationId: string, productId: string): number {
    return this.movements
      .filter((m) => m.orgId === orgId && m.locationId === locationId && m.productId === productId)
      .reduce((sum, m) => sum + m.quantity, 0);
  }

  // Live low-stock determination (mirror of api_counter_low_stock_signals)
  getLowStockSignals(orgId: string, seat: string, locationId?: string) {
    if (!['counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner'].includes(seat)) {
      throw new Error('seat_not_authorized');
    }
    if (locationId === OTHER_LOCATION) {
      throw new Error('location_not_found');
    }

    const matchingProducts = this.products.filter(
      (p) => p.orgId === orgId && p.active && p.kind === 'stock' && p.reorderThreshold !== null,
    );

    const signals = [];
    for (const p of matchingProducts) {
      const targetLocs = locationId ? [locationId] : [LOCATION_1, LOCATION_2];
      for (const loc of targetLocs) {
        const onHand = this.getDerivedOnHand(orgId, loc, p.id);
        const threshold = p.reorderThreshold!;
        if (onHand <= threshold) {
          signals.push({
            productId: p.id,
            sku: p.sku,
            name: p.name,
            barcode: p.barcode,
            locationId: loc,
            onHand,
            reorderThreshold: threshold,
            varianceToThreshold: onHand - threshold,
            isLowStock: true,
          });
        }
      }
    }

    return {
      ok: true,
      locationId: locationId ?? null,
      count: signals.length,
      lowStockItems: signals,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. BEHAVIORAL MIRROR TESTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-438 mirror: reorder threshold defaults to null (no forced configuration)', () => {
  const store = new InventoryStore();
  const prod = store.createProduct(ORG, 'SKU-01', 'Widget A', 'stock');
  assertEquals(prod.reorderThreshold, null);

  // When threshold is null, item is never flagged as low stock even with 0 on-hand
  const signals = store.getLowStockSignals(ORG, SEAT_COUNTER, LOCATION_1);
  assertEquals(signals.count, 0);
  assertEquals(signals.lowStockItems.length, 0);
});

Deno.test('SERP-438 mirror: live derived on-hand strictly above threshold is NOT low stock', () => {
  const store = new InventoryStore();
  const prod = store.createProduct(ORG, 'SKU-02', 'Widget B', 'stock', 10);
  store.addStockMovement(ORG, LOCATION_1, prod.id, 15);

  const signals = store.getLowStockSignals(ORG, SEAT_COUNTER, LOCATION_1);
  assertEquals(signals.count, 0);
});

Deno.test('SERP-438 mirror: exact boundary (on-hand == threshold) triggers low stock signal', () => {
  const store = new InventoryStore();
  const prod = store.createProduct(ORG, 'SKU-03', 'Widget C', 'stock', 5);
  store.addStockMovement(ORG, LOCATION_1, prod.id, 5);

  const signals = store.getLowStockSignals(ORG, SEAT_COUNTER, LOCATION_1);
  assertEquals(signals.count, 1);
  assertEquals(signals.lowStockItems[0].productId, prod.id);
  assertEquals(signals.lowStockItems[0].onHand, 5);
  assertEquals(signals.lowStockItems[0].reorderThreshold, 5);
  assertEquals(signals.lowStockItems[0].varianceToThreshold, 0);
  assertEquals(signals.lowStockItems[0].isLowStock, true);
});

Deno.test('SERP-438 mirror: on-hand below threshold triggers low stock signal with negative variance', () => {
  const store = new InventoryStore();
  const prod = store.createProduct(ORG, 'SKU-04', 'Widget D', 'stock', 20);
  store.addStockMovement(ORG, LOCATION_1, prod.id, 8);

  const signals = store.getLowStockSignals(ORG, SEAT_COUNTER, LOCATION_1);
  assertEquals(signals.count, 1);
  assertEquals(signals.lowStockItems[0].onHand, 8);
  assertEquals(signals.lowStockItems[0].varianceToThreshold, -12);
});

Deno.test('SERP-438 mirror: stock issue updates derived on-hand live and flips signal', () => {
  const store = new InventoryStore();
  const prod = store.createProduct(ORG, 'SKU-05', 'Widget E', 'stock', 5);
  store.addStockMovement(ORG, LOCATION_1, prod.id, 10);

  // Before sale: 10 on hand > 5 -> healthy
  let signals = store.getLowStockSignals(ORG, SEAT_COUNTER, LOCATION_1);
  assertEquals(signals.count, 0);

  // Sale takes 6 units (ledger movement -6) -> on-hand is now 4
  store.addStockMovement(ORG, LOCATION_1, prod.id, -6);
  assertEquals(store.getDerivedOnHand(ORG, LOCATION_1, prod.id), 4);

  // Live query immediately reflects low-stock (no caching drift)
  signals = store.getLowStockSignals(ORG, SEAT_COUNTER, LOCATION_1);
  assertEquals(signals.count, 1);
  assertEquals(signals.lowStockItems[0].onHand, 4);
  assertEquals(signals.lowStockItems[0].varianceToThreshold, -1);
});

Deno.test('SERP-438 mirror: service items never generate low-stock signals', () => {
  const store = new InventoryStore();
  store.createProduct(ORG, 'SRV-01', 'Standard Labour', 'service', 10);

  const signals = store.getLowStockSignals(ORG, SEAT_COUNTER, LOCATION_1);
  assertEquals(signals.count, 0);
});

Deno.test('SERP-438 mirror: negative threshold rejected on create and update', () => {
  const store = new InventoryStore();
  assertThrows(
    () => store.createProduct(ORG, 'SKU-ERR', 'Invalid', 'stock', -1),
    Error,
    'product_reorder_threshold_invalid',
  );

  const prod = store.createProduct(ORG, 'SKU-OK', 'Valid', 'stock', 5);
  assertThrows(
    () => store.updateThreshold(ORG, prod.id, -10),
    Error,
    'product_reorder_threshold_invalid',
  );
});

Deno.test('SERP-438 mirror: cross-tenant isolation — tenant A stock never visible in tenant B', () => {
  const store = new InventoryStore();
  const prodA = store.createProduct(ORG, 'SKU-T1', 'Tenant 1 Item', 'stock', 10);
  store.addStockMovement(ORG, LOCATION_1, prodA.id, 2); // Low stock in Org 1

  const prodB = store.createProduct(OTHER_ORG, 'SKU-T2', 'Tenant 2 Item', 'stock', 10);
  store.addStockMovement(OTHER_ORG, LOCATION_1, prodB.id, 20); // Healthy in Org 2

  const signalsA = store.getLowStockSignals(ORG, SEAT_COUNTER, LOCATION_1);
  assertEquals(signalsA.count, 1);
  assertEquals(signalsA.lowStockItems[0].productId, prodA.id);

  const signalsB = store.getLowStockSignals(OTHER_ORG, SEAT_COUNTER, LOCATION_1);
  assertEquals(signalsB.count, 0);
});

Deno.test('SERP-438 mirror: unauthorized seat rejected with seat_not_authorized', () => {
  const store = new InventoryStore();
  assertThrows(
    () => store.getLowStockSignals(ORG, SEAT_TECHNICIAN, LOCATION_1),
    Error,
    'seat_not_authorized',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SCHEMA & MIGRATION CONFORMANCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-438 conformance: migration 202609192300 adds nullable reorder_threshold with check constraint', async () => {
  const sql = await Deno.readTextFile(new URL('202609192300_serp438_low_stock_visibility_signal.sql', EDGE_MIGRATIONS));

  assert(sql.includes('alter table public.products'), 'Must alter public.products');
  assert(sql.includes('add column if not exists reorder_threshold numeric(20, 6) default null'), 'Must add nullable reorder_threshold column');
  assert(sql.includes('check (reorder_threshold is null or reorder_threshold >= 0)'), 'Must check non-negative or null');
});

Deno.test('SERP-438 conformance: api_product_command handles reorder_threshold in create, update and read', async () => {
  const sql = await Deno.readTextFile(new URL('202609192300_serp438_low_stock_visibility_signal.sql', EDGE_MIGRATIONS));

  assert(sql.includes('v_reorder_threshold numeric;'), 'v_reorder_threshold variable declared');
  assert(sql.includes('product_reorder_threshold_invalid'), 'Must validate reorder threshold >= 0');
  assert(sql.includes('\'reorder_threshold\', p.reorder_threshold'), 'Must return reorder_threshold in product JSON');
  assert(sql.includes('reorder_threshold = case when v_update_threshold then v_reorder_threshold else reorder_threshold end'), 'Must support updating reorder_threshold');
});

Deno.test('SERP-438 conformance: api_counter_low_stock_signals RPC defined with seat gate and live query', async () => {
  const sql = await Deno.readTextFile(new URL('202609192300_serp438_low_stock_visibility_signal.sql', EDGE_MIGRATIONS));

  assert(sql.includes('create or replace function public.api_counter_low_stock_signals'), 'RPC function missing');
  assert(sql.includes('security definer'), 'Must be security definer');
  assert(sql.includes('set search_path = public, app_private, extensions, pg_temp'), 'Explicit search path required');
  assert(sql.includes('stock_movements_derived_onhand(target_org'), 'Must derive on-hand live from stock_movements_derived_onhand');
  assert(sql.includes('coalesce(d.derived_quantity, 0) <= p.reorder_threshold'), 'Must compare live derived quantity to reorder threshold');
  assert(sql.includes('grant execute on function public.api_counter_low_stock_signals'), 'Must grant to service_role');
  assert(sql.includes('revoke all on function public.api_counter_low_stock_signals'), 'Must revoke from public');
});

Deno.test('SERP-438 conformance: starq-api wires low-stock route and includes reorder_threshold in catalogue', async () => {
  const apiCode = await Deno.readTextFile(STARQ_API_PATH);

  assert(apiCode.includes('/api/ops/counter/low-stock'), 'Endpoint GET /api/ops/counter/low-stock missing');
  assert(apiCode.includes('api_counter_low_stock_signals'), 'RPC api_counter_low_stock_signals not invoked');
  assert(apiCode.includes('reorder_threshold'), 'reorder_threshold missing from catalogue query in starq-api');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. EXCLUSION PROOFS (Founder Directives)
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-438 conformance: EXCLUSION — no automatic purchase order generation', async () => {
  const sql = await Deno.readTextFile(new URL('202609192300_serp438_low_stock_visibility_signal.sql', EDGE_MIGRATIONS));

  assert(!sql.includes('insert into public.purchase_orders'), 'Must NOT insert into purchase_orders');
  assert(!sql.includes('create_purchase_order'), 'Must NOT create purchase order RPC');
  assert(!sql.includes('auto_reorder'), 'Must NOT include automated reordering trigger');
});

Deno.test('SERP-438 conformance: EXCLUSION — no RFQ or procurement automation', async () => {
  const sql = await Deno.readTextFile(new URL('202609192300_serp438_low_stock_visibility_signal.sql', EDGE_MIGRATIONS));

  assert(!sql.includes('rfq'), 'Must NOT include RFQ logic');
  assert(!sql.includes('supplier_quotes'), 'Must NOT include supplier quote automation');
});

Deno.test('SERP-438 conformance: EXCLUSION — no demand forecasting or planning algorithms', async () => {
  const rawSql = await Deno.readTextFile(new URL('202609192300_serp438_low_stock_visibility_signal.sql', EDGE_MIGRATIONS));
  const sqlWithoutComments = rawSql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  assert(!sqlWithoutComments.includes('forecast'), 'Must NOT include forecasting routines');
  assert(!sqlWithoutComments.includes('safety_stock_algorithm'), 'Must NOT include safety stock algorithmic models');
});
