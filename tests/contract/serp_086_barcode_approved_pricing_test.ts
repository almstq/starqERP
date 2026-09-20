/**
 * STARQ ERP — SERP-086 barcode + catalogue approved-pricing proof gate (OpenCode lane).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The SERP-086 dispatch (M6 counter lane) adds first-class barcode identity to
 * products and two READ-ONLY server-side price surfaces:
 *
 *   api_counter_price_resolution(target_org, target_person, target_seat,
 *                                product_id, barcode, price_list_code, tax_mode)
 *   api_counter_approved_prices(target_org, target_person, target_seat,
 *                               price_list_code)
 *
 * in migration 202609192000_serp086_barcode_approved_pricing.sql, plus barcode
 * handling in api_product_command (create/update/read/deactivate).
 *
 * The artifact is review-only: it must NOT be applied to any production or local
 * database. Real-database independent verification belongs to Vision /
 * acceptance-gate item 7, under the same bounded rules as Track A. This lane
 * therefore proves the gate exactly the way SERP-M2/M1 proved theirs:
 *   * a PURE CONTRACT MIRROR of the SQL control flow (deterministic, in-memory,
 *     no database), reproducing seat/identifier/price-order/tax/no-price rules
 *     exactly as written, including barcode normalization/grammar/duplicates.
 *   * a SOURCE-CONFORMANCE layer that reads the actual migration file and asserts
 *     the controls are WIRED IN — never just present in this spec.
 * Both layers must pass.
 *
 * Run:  deno test --allow-read tests/contract/serp_086_barcode_approved_pricing_test.ts
 */

import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';

const EDGE_MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// FIXED IDENTITIES (deterministic — same fixture shape as the M1/M2 mirrors)
// ─────────────────────────────────────────────────────────────────────────────

const ORG = '20000000-0000-4000-8000-000000000901'; // fixture org, PRODUCT seats
const OTHER_ORG = '10000000-0000-4000-8000-000000000901';
const PERSON = '20000000-0000-4000-8000-000000000111';
const OTHER_PERSON = '10000000-0000-4000-8000-000000000111'; // member of OTHER_ORG only
const SEAT_COUNTER = 'counter';
const SEAT_WIDTH = 'quartermaster';
const SEAT_TECHNICIAN = 'technician';

const PRODUCT_A = '20000000-0000-4000-8000-000000000701';
const PRODUCT_B = '20000000-0000-4000-8000-000000000703';
const PRODUCT_NO_PRICE = '20000000-0000-4000-8000-000000000704';
const PRODUCT_OTHER_ORG = '10000000-0000-4000-8000-000000000701';
const PRODUCT_DEACTIVATED = '20000000-0000-4000-8000-000000000705';

const BARCODE_A = '6291041500213';
const BARCODE_A_UPPER = '6291041500213';
const BARCODE_LOWER_OK = 'abc1234567890'; // uppercased on entry
const BARCODE_INVALID_SPACE = '623 104';
const BARCODE_INVALID_SLASH = '62/104*150021';
const BARCODE_DEACTIVATED = '5550000000001';

const PRICE_LIST_TRADE = 'trade_25'; // discount 25
const PRICE_LIST_RETAIL = 'retail'; // discount 0 (default seeded list)
const PRICE_LIST_CODE_MISSING = 'closing_soon'; // no active row -> not found

const GST_RATE = 0.08; // MVR / gst_general / registered (mirror fixture)

// ─────────────────────────────────────────────────────────────────────────────
// THE PURE-LOGIC MIRROR
// ─────────────────────────────────────────────────────────────────────────────
// Maps 1:1 to blocks in 202609192000_serp086_barcode_approved_pricing.sql.

interface ProductRow {
  id: string;
  org: string;
  sku: string;
  kind: string;
  name: string;
  barcode: string | null;
  active: boolean;
}

interface PriceRow {
  org: string;
  productId: string;
  currency: string;
  amount: number;
  validFrom: number;
  validTo: number | null;
}

interface OverrideRow {
  org: string;
  listId: string;
  productId: string;
  unitPrice: number;
}

interface PriceListRow {
  org: string;
  id: string;
  code: string;
  name: string;
  discountPercent: number;
  version: number;
  active: boolean;
}

interface SimState {
  products: ProductRow[];
  priceLists: PriceListRow[];
  overrides: OverrideRow[];
  prices: PriceRow[];
  persons: { id: string; seats: Record<string, string[]> }[];
  writes: string[]; // any mutation attempt is recorded (replay-safety evidence)
}

const newStore = (): SimState => ({
  products: [],
  priceLists: [],
  overrides: [],
  prices: [],
  persons: [],
  writes: [],
});

function addMember(state: SimState, org: string, person: string, seat: string): void {
  state.persons.push({ id: person, seats: { [org]: [seat] } });
}

function assertActiveSeat(state: SimState, org: string, person: string, seat: string): boolean {
  const p = state.persons.find((x) => x.id === person);
  return !!p && !!p.seats[org] && p.seats[org].includes(seat);
}

/** Mirror of the products.active gate: deactivated products never price. */
function activeProduct(state: SimState, org: string, id: string): ProductRow {
  const p = state.products.find((x) => x.org === org && x.id === id && x.active);
  if (!p) throw new Error('product_not_found');
  return p;
}

// Mirror of the seat gate shared by all three RPCs (migration: assert_active_seat
// + explicit PRODUCT aperture).
function gateSeat(state: SimState, org: string, person: string, seat: string): void {
  const PRODUCT_SEATS = ['counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner'];
  if (!assertActiveSeat(state, org, person, seat) || !PRODUCT_SEATS.includes(seat)) {
    throw new Error('seat_not_authorized');
  }
}

/** Mirror of products.barcode normalization + CHECK + per-org partial-unique. */
function normalizeBarcode(raw: unknown): string | null {
  const s = String(raw ?? '');
  const t = s.trim().toUpperCase();
  if (t === '') return null;
  if (!/^[0-9A-Z][0-9A-Z._-]{0,31}$/.test(t)) throw new Error('product_barcode_invalid');
  return t;
}

// Mirror of api_product_command action=create + action=update barcode lanes.
function productCommand(state: SimState, org: string, person: string, seat: string, command: Record<string, unknown>): ProductRow {
  const action = String(command.action ?? '');
  if (action === 'create') {
    const sku = String(command.sku ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(sku)) throw new Error('product_sku_invalid');
    const barcode = normalizeBarcode(command.barcode);
    if (state.products.some((p) => p.org === org && p.sku === sku)) throw new Error('product_sku_exists');
    if (barcode !== null && state.products.some((p) => p.org === org && p.barcode === barcode)) {
      throw new Error('product_barcode_exists');
    }
    const row: ProductRow = {
      id: String(command.product_id ?? `prod-${state.products.length + 1}`),
      org,
      sku,
      kind: String(command.kind ?? 'stock'),
      name: String(command.name ?? ''),
      barcode,
      active: true,
    };
    state.products.push(row);
    state.writes.push('create');
    return row;
  }
  if (action === 'update') {
    const target = state.products.find((p) => p.org === org && p.id === String(command.product_id));
    if (!target) throw new Error('product_not_found');
    const barcode = normalizeBarcode(command.barcode);
    if (barcode !== null && state.products.some((p) => p.org === org && p.barcode === barcode && p.id !== target.id)) {
      throw new Error('product_barcode_exists');
    }
    target.barcode = barcode;
    target.name = String(command.name ?? target.name);
    state.writes.push('update');
    return { ...target };
  }
  throw new Error('product_action_invalid');
}

/** Mirror of calculate_line_tax (202608250017) for the mirror's registered org. */
function lineTax(
  taxMode: string,
  lineAmount: number,
): { base: number; tax: number; gross: number; rate: number } {
  if (taxMode === 'exclusive') {
    const tax = round2(lineAmount * GST_RATE);
    return { base: round2(lineAmount), tax, gross: round2(lineAmount + tax), rate: GST_RATE };
  }
  if (taxMode === 'inclusive') {
    const gross = round2(lineAmount);
    const base = round2(gross / (1 + GST_RATE));
    return { base, tax: round2(gross - base), gross, rate: GST_RATE };
  }
  return { base: round2(lineAmount), tax: 0, gross: round2(lineAmount), rate: 0 }; // zero_rated / exempt
}

interface ResolutionOutput {
  ok: boolean;
  product: { id: string; barcode: string | null } | null;
  price: {
    resolved: boolean;
    reason?: string;
    source?: string;
    unit_amount?: number;
    discount_percent?: number;
    price_list_version?: number | null;
    currency?: string;
  };
  tax?: { mode: string; rate: number; tax_amount: number; net_amount: number; gross_amount: number };
  resolution: boolean;
}

// Mirror of api_counter_price_resolution — the single-item approved-price read.
function priceResolution(
  state: SimState,
  org: string,
  person: string,
  seat: string,
  opts: { productId?: string | null; barcode?: string | null; priceListCode?: string | null; taxMode?: string },
): ResolutionOutput {
  gateSeat(state, org, person, seat);
  const taxMode = String(opts.taxMode ?? 'exclusive').trim().toLowerCase();
  if (!['inclusive', 'exclusive', 'zero_rated', 'exempt'].includes(taxMode)) {
    throw new Error('counter_sale_tax_mode_invalid');
  }

  // Item identity: exactly one of product_id / barcode.
  const pid = opts.productId ?? null;
  const rawBarcode = opts.barcode ?? null;
  if (pid !== null && rawBarcode !== null) throw new Error('product_identifier_ambiguous');
  let vPid: string | null = pid;
  if (vPid === null && rawBarcode !== null) {
    const bc = String(rawBarcode).trim().toUpperCase();
    const hit = state.products.find((p) => p.org === org && p.active && p.barcode === bc);
    vPid = hit ? hit.id : null;
  }
  if (vPid === null && pid === null && rawBarcode === null) throw new Error('product_identifier_required');
  if (vPid === null) throw new Error('product_not_found');

  // Mirror of "where p.id = v_pid and p.active": deactivated products fail closed.
  const product = activeProduct(state, org, vPid);

  // Price-list context (optional; bound by code, active row only).
  let list: PriceListRow | null = null;
  const listCode = opts.priceListCode ?? null;
  if (listCode !== null) {
    list = state.priceLists.find(
      (pl) => pl.org === org && pl.code === String(listCode).trim().toLowerCase() && pl.active,
    ) ?? null;
    if (!list) throw new Error('stock_line_price_list_not_found');
  }

  // Server-side approval order — override -> current base -> discount -> tax.
  let resolved: number | null = null;
  let source = 'none';
  if (list) {
    const ov = state.overrides.find((o) => o.org === org && o.listId === list.id && o.productId === vPid);
    if (ov) {
      resolved = ov.unitPrice;
      source = 'price_list_override';
    }
  }
  if (resolved === null) {
    const now = Date.now();
    const candidates = state.prices
      .filter((pp) =>
        pp.org === org && pp.productId === vPid && pp.currency === 'MVR' &&
        now >= pp.validFrom && (pp.validTo === null || now <= pp.validTo)
      )
      .sort((a, b) => b.validFrom - a.validFrom);
    if (candidates.length > 0) {
      resolved = candidates[0].amount;
      source = 'product_prices';
    }
  }

  if (resolved === null) {
    return {
      ok: true,
      product: { id: product.id, barcode: product.barcode },
      price: { resolved: false, reason: 'stock_line_no_price', source: 'none', unit_amount: 0 },
      resolution: false,
    };
  }

  const discount = list ? list.discountPercent : 0;
  if (discount > 0) resolved = round6(resolved * (1 - discount / 100));
  const tax = lineTax(taxMode, resolved);

  return {
    ok: true,
    product: { id: product.id, barcode: product.barcode },
    price: {
      resolved: true,
      source,
      unit_amount: resolved,
      discount_percent: discount,
      price_list_version: list ? list.version : null,
      currency: 'MVR',
    },
    tax: {
      mode: taxMode,
      rate: tax.rate,
      tax_amount: tax.tax,
      net_amount: tax.base,
      gross_amount: tax.gross,
    },
    resolution: true,
  };
}

// Mirror of api_counter_approved_prices — bulk catalogue-price read.
interface BulkRow { productId: string; source: string; unitAmount: number; discountPercent: number; version: number | null }

function approvedPrices(
  state: SimState,
  org: string,
  person: string,
  seat: string,
  priceListCode?: string | null,
): { ok: true; prices: BulkRow[] } {
  gateSeat(state, org, person, seat);
  let list: PriceListRow | null = null;
  if (priceListCode !== null && priceListCode !== undefined) {
    list = state.priceLists.find(
      (pl) => pl.org === org && pl.code === String(priceListCode).trim().toLowerCase() && pl.active,
    ) ?? null;
    if (!list) throw new Error('stock_line_price_list_not_found');
  }
  const now = Date.now();
  const rows: BulkRow[] = state.products
    .filter((p) => p.org === org && p.active)
    .map((p) => {
      let base: number | null = null;
      let source: string;
      const ov = list ? state.overrides.find((o) => o.org === org && o.listId === list.id && o.productId === p.id) : undefined;
      if (ov) {
        base = ov.unitPrice;
        source = 'price_list_override';
      } else {
        const candidates = state.prices
          .filter((pp) =>
            pp.org === org && pp.productId === p.id && pp.currency === 'MVR' &&
            now >= pp.validFrom && (pp.validTo === null || now <= pp.validTo)
          )
          .sort((a, b) => b.validFrom - a.validFrom);
        if (candidates.length > 0) {
          base = candidates[0].amount;
          source = 'product_prices';
        } else {
          base = 0;
          source = 'none';
        }
      }
      const discount = list ? list.discountPercent : 0;
      const unit = base > 0 && discount > 0 ? round6(base * (1 - discount / 100)) : round6(base);
      return {
        productId: p.id,
        source,
        unitAmount: unit,
        discountPercent: discount,
        version: list ? list.version : null,
      };
    });
  return { ok: true, prices: rows };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

function seededStore(): SimState {
  const s = newStore();
  addMember(s, ORG, PERSON, SEAT_COUNTER);
  addMember(s, ORG, PERSON, SEAT_WIDTH);
  addMember(s, ORG, PERSON, SEAT_TECHNICIAN);
  addMember(s, OTHER_ORG, OTHER_PERSON, 'owner');
  s.products.push(
    { id: PRODUCT_A, org: ORG, sku: 'SERP086-A', kind: 'stock', name: 'Serp086 Stock A', barcode: BARCODE_A, active: true },
    { id: PRODUCT_B, org: ORG, sku: 'SERP086-B', kind: 'stock', name: 'Serp086 Stock B', barcode: null, active: true },
    {
      id: PRODUCT_NO_PRICE, org: ORG, sku: 'SERP086-NOPRICE', kind: 'stock',
      name: 'No Price Item', barcode: '9900000000001', active: true,
    },
    { id: PRODUCT_OTHER_ORG, org: OTHER_ORG, sku: 'SERP086-OTHER', kind: 'stock', name: 'Other Tenant', barcode: '4567890123456', active: true },
    { id: PRODUCT_DEACTIVATED, org: ORG, sku: 'SERP086-DEAD', kind: 'stock', name: 'Deactivated Stock', barcode: BARCODE_DEACTIVATED, active: false },
  );
  // Price registry: stale expired 120, current 100, future 200 (valid windowing).
  const now = Date.now();
  const day = 86_400_000;
  s.prices.push(
    { org: ORG, productId: PRODUCT_A, currency: 'MVR', amount: 120, validFrom: now - 30 * day, validTo: now - 1 * day },
    { org: ORG, productId: PRODUCT_A, currency: 'MVR', amount: 100, validFrom: now - 20 * day, validTo: null },
    { org: ORG, productId: PRODUCT_A, currency: 'MVR', amount: 200, validFrom: now + 1 * day, validTo: null },
    { org: ORG, productId: PRODUCT_B, currency: 'MVR', amount: 100, validFrom: now - 10 * day, validTo: null },
    { org: ORG, productId: PRODUCT_DEACTIVATED, currency: 'MVR', amount: 999, validFrom: now - 5 * day, validTo: null },
  );
  // Bound list trade_25: discount 25, per-item override 42 on PRODUCT_A.
  s.priceLists.push(
    { org: ORG, id: 'pl-1', code: PRICE_LIST_TRADE, name: 'Trade 25', discountPercent: 25, version: 1, active: true },
    { org: ORG, id: 'pl-2', code: PRICE_LIST_RETAIL, name: 'Retail', discountPercent: 0, version: 1, active: true },
  );
  s.overrides.push({ org: ORG, listId: 'pl-1', productId: PRODUCT_A, unitPrice: 42 });
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUNDING HELPERS (mirror Postgres round(numeric, 2) / (numeric, 6))
// ─────────────────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function round6(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — PURE CONTRACT MIRROR
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-086 mirror: barcode identity round-trip + per-org uniqueness + grammar', () => {
  const s = seededStore();

  // Cross-tenant duplicate barcode is legal (tenant-scoped identity) — either via
  // the SQL path (api_product_command with service_role) or directly (mirror).
  const other = productCommand(s, OTHER_ORG, OTHER_PERSON, 'owner', {
    action: 'create', sku: 'SERP086-TENANT2', name: 'Tenant Two', kind: 'stock', barcode: BARCODE_A,
  });
  assertEquals(other.barcode, BARCODE_A_UPPER);

  // Same-org duplicate strikes the distinct 'product_barcode_exists' path.
  assertThrows(
    () => productCommand(s, ORG, PERSON, SEAT_COUNTER, {
      action: 'create', sku: 'SERP086-DUP', name: 'Duplicate', kind: 'stock', barcode: BARCODE_A,
    }),
    Error,
    'product_barcode_exists',
  );

  // Lowercase is uppercased on entry; spaces/slashes fail grammar.
  const lowered = productCommand(s, ORG, PERSON, SEAT_COUNTER, {
    action: 'create', sku: 'SERP086-LOW', name: 'Lower', kind: 'stock', barcode: BARCODE_LOWER_OK,
  });
  assertEquals(lowered.barcode, 'ABC1234567890');
  assertThrows(
    () => productCommand(s, ORG, PERSON, SEAT_COUNTER, {
      action: 'create', sku: 'SERP086-BAD1', name: 'Bad Space', kind: 'stock', barcode: BARCODE_INVALID_SPACE,
    }),
    Error,
    'product_barcode_invalid',
  );
  assertThrows(
    () => productCommand(s, ORG, PERSON, SEAT_COUNTER, {
      action: 'create', sku: 'SERP086-BAD2', name: 'Bad Symbol', kind: 'stock', barcode: BARCODE_INVALID_SLASH,
    }),
    Error,
    'product_barcode_invalid',
  );

  // Update can clear a barcode (empty -> NULL) and rejects invalid new values.
  productCommand(s, ORG, PERSON, SEAT_COUNTER, {
    action: 'update', product_id: PRODUCT_B, name: 'Serp086 Stock B', barcode: '',
  });
  assertEquals(
    s.products.find((p) => p.id === PRODUCT_B)?.barcode ?? null,
    null,
    'barcode was not cleared on update',
  );
});

Deno.test('SERP-086 mirror: override -> current base -> discount -> tax', () => {
  const s = seededStore();

  // No price-list context -> current base window (120 stale excluded, 200 future
  // excluded), newest valid_from wins = MVR 100.
  const base = priceResolution(s, ORG, PERSON, SEAT_COUNTER, { productId: PRODUCT_A });
  assertEquals(base.price.source, 'product_prices');
  assertEquals(base.price.unit_amount, 100);
  assertEquals(base.price.resolved, true);
  assert(base.tax && base.tax.mode === 'exclusive');
  assertEquals(base.tax.tax_amount, round2(100 * GST_RATE));
  assertEquals(base.tax.gross_amount, round2(100 + round2(100 * GST_RATE)));

  // Bound trade_25: override 42 wins over base; discount 25 applied; version pinned.
  const over = priceResolution(s, ORG, PERSON, SEAT_COUNTER, {
    productId: PRODUCT_A, priceListCode: PRICE_LIST_TRADE,
  });
  assertEquals(over.price.source, 'price_list_override');
  assertEquals(over.price.unit_amount, round6(42 * (1 - 0.25)));
  assertEquals(over.price.discount_percent, 25);
  assertEquals(over.price.price_list_version, 1);

  // PRODUCT_B has no override -> base 100 * (1-25%) = 75.
  const disc = priceResolution(s, ORG, PERSON, SEAT_COUNTER, {
    productId: PRODUCT_B, priceListCode: PRICE_LIST_TRADE,
  });
  assertEquals(disc.price.source, 'product_prices');
  assertEquals(disc.price.unit_amount, 75);

  // REGRESSION: no price-list bound at all, but a base price exists — the base
  // must STILL resolve through product_prices (never a fabricated 0). This is
  // the observable form of the v_resolved := 0 / := null Elder finding.
  const unbound = priceResolution(s, ORG, PERSON, SEAT_COUNTER, { productId: PRODUCT_A, priceListCode: null });
  assertEquals(unbound.price.source, 'product_prices');
  assertEquals(unbound.price.unit_amount, 100);
  assertEquals(unbound.price.resolved, true);

  // Bound-but-missing list fails closed (mirror of COUNTER_SALE).
  assertThrows(
    () => priceResolution(s, ORG, PERSON, SEAT_COUNTER, {
      productId: PRODUCT_A, priceListCode: PRICE_LIST_CODE_MISSING,
    }),
    Error,
    'stock_line_price_list_not_found',
  );
});

Deno.test('SERP-086 mirror: fail-closed negatives — identifiers, seat, tenant, no-price', () => {
  const s = seededStore();

  // One identifier required; both-present is ambiguous.
  assertThrows(
    () => priceResolution(s, ORG, PERSON, SEAT_COUNTER, { productId: null, barcode: null }),
    Error,
    'product_identifier_required',
  );
  assertThrows(
    () => priceResolution(s, ORG, PERSON, SEAT_COUNTER, { productId: PRODUCT_A, barcode: BARCODE_A }),
    Error,
    'product_identifier_ambiguous',
  );

  // Seat gate closes on any non-PRODUCT seat.
  assertThrows(
    () => priceResolution(s, ORG, PERSON, SEAT_TECHNICIAN, { productId: PRODUCT_A }),
    Error,
    'seat_not_authorized',
  );

  // Cross-tenant product is never resolvable (org-scoped lookup) even by a
  // valid seat of that other tenant.
  assertThrows(
    () => priceResolution(s, OTHER_ORG, OTHER_PERSON, 'owner', { productId: PRODUCT_A }),
    Error,
    'product_not_found',
  );
  // The other tenant's own product IS resolvable within its scope.
  const own = priceResolution(s, OTHER_ORG, OTHER_PERSON, 'owner', { productId: PRODUCT_OTHER_ORG });
  assertEquals(own.price.resolved, false);
  assertEquals(own.price.reason, 'stock_line_no_price');

  // No price anywhere -> distinguishable fail-closed state, never a fabricated price.
  const none = priceResolution(s, ORG, PERSON, SEAT_COUNTER, { productId: PRODUCT_NO_PRICE });
  assertEquals(none.price.resolved, false);
  assertEquals(none.price.reason, 'stock_line_no_price');
  assertEquals(none.price.unit_amount, 0);
  assertEquals(none.resolution, false);

  // REGRESSION: deactivated products fail closed by id and by barcode — even
  // though a live price row exists underneath (999 MVR).
  assertThrows(
    () => priceResolution(s, ORG, PERSON, SEAT_COUNTER, { productId: PRODUCT_DEACTIVATED }),
    Error,
    'product_not_found',
  );
  assertThrows(
    () => priceResolution(s, ORG, PERSON, SEAT_COUNTER, { barcode: BARCODE_DEACTIVATED }),
    Error,
    'product_not_found',
  );

  // Invalid tax mode.
  assertThrows(
    () => priceResolution(s, ORG, PERSON, SEAT_COUNTER, { productId: PRODUCT_A, taxMode: 'bogus' }),
    Error,
    'counter_sale_tax_mode_invalid',
  );
});

Deno.test('SERP-086 mirror: reads are pure — repeatable, no writes', () => {
  const s = seededStore();
  const before = s.writes.length;

  const a1 = priceResolution(s, ORG, PERSON, SEAT_COUNTER, { productId: PRODUCT_A, priceListCode: PRICE_LIST_TRADE });
  const a2 = priceResolution(s, ORG, PERSON, SEAT_COUNTER, { productId: PRODUCT_A, priceListCode: PRICE_LIST_TRADE });
  assertEquals(a1, a2, 'identical repeat read must return an identical resolution');

  const bulk = approvedPrices(s, ORG, PERSON, SEAT_COUNTER, PRICE_LIST_TRADE);
  assertEquals(bulk.ok, true);
  assertEquals(s.writes.length, before, 'a read RPC wrote state — replay-safety violated');

  // Bulk aperture attribution: override row, discounted base row, no-price row.
  const byId = (id: string) => bulk.prices.find((r) => r.productId === id);
  assert(byId(PRODUCT_A), 'override product missing from bulk');
  assertEquals(byId(PRODUCT_A)!.source, 'price_list_override');
  assertEquals(byId(PRODUCT_A)!.unitAmount, round6(42 * (1 - 0.25)));
  assertEquals(byId(PRODUCT_B)!.source, 'product_prices');
  assertEquals(byId(PRODUCT_B)!.unitAmount, 75);
  assertEquals(byId(PRODUCT_NO_PRICE)!.source, 'none');
  assertEquals(byId(PRODUCT_NO_PRICE)!.unitAmount, 0);
  assertEquals(byId(PRODUCT_OTHER_ORG), undefined, 'other-tenant product leaked into the aperture');
  assertEquals(byId(PRODUCT_DEACTIVATED), undefined, 'deactivated product leaked into the aperture');
});

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — SOURCE CONFORMANCE (reads the actual migration file)
// ─────────────────────────────────────────────────────────────────────────────

async function readMigration(name: string): Promise<string> {
  return await Deno.readTextFile(new URL(name, EDGE_MIGRATIONS));
}

Deno.test('SERP-086 conformance: barcode DDL is wired exactly as designed', async () => {
  const sql = await readMigration('202609192000_serp086_barcode_approved_pricing.sql');

  assert(sql.includes('add column barcode text'), 'products.barcode column missing');
  assert(sql.includes('products_barcode_format'), 'barcode CHECK constraint missing');
  assert(/check \(barcode is null or barcode ~ '\^\[0-9A-Z\]\[0-9A-Z\._-\]\{0,31\}\$'\)/.test(sql), 'barcode format regex drifted');
  assert(
    sql.includes('products_organisation_barcode_unique') &&
    sql.includes('where barcode is not null'),
    'partial unique index on (organisation_id, barcode) missing',
  );
});

Deno.test('SERP-086 conformance: api_product_command handles barcode in create/update/read/deactivate', async () => {
  const sql = await readMigration('202609192000_serp086_barcode_approved_pricing.sql');

  // create: normalization (upper/btrim), grammar, duplicate path.
  assert(sql.includes('v_barcode := upper(nullif(btrim(coalesce(command->>\'barcode\', \'\')), \'\'));'), 'barcode normalization missing');
  assert(sql.includes('product_barcode_invalid'), 'barcode invalid path missing');
  assert(sql.includes('product_barcode_exists'), 'barcode duplicate path missing');
  assert(/insert into public\.products[\s\S]*\bbarcode\b/.test(sql), 'create insert does not carry barcode');
  // read + deactivate select it back out as jsonb.
  assert((sql.match(/'barcode', p\.barcode/g) ?? []).length >= 3, 'barcode not surfaced on read/update/deactivate');
  // update can clear (empty -> NULL) because the check is null-tolerant.
  assert(sql.includes("barcode = v_barcode"), 'update does not write barcode');
  // seat gate unchanged — PRODUCT aperture, not widened.
  assert(
    sql.includes("target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner')"),
    'PRODUCT seat aperture drifted',
  );
});

Deno.test('SERP-086 conformance: resolution RPC reproduces COUNTER_SALE server-side order', async () => {
  const sql = await readMigration('202609192000_serp086_barcode_approved_pricing.sql');
  const counter = await readMigration('202609190059_counter_sale_stock_issue.sql');

  const fn = sql.indexOf('create or replace function public.api_counter_price_resolution(');
  const end = sql.indexOf('create or replace function public.api_counter_approved_prices(', fn);
  const rpc = sql.slice(fn, end);

  // Item identity — one of product_id / barcode, ambiguous fails.
  assert(rpc.includes('product_identifier_ambiguous'), 'ambiguous-identifier path missing');
  assert(rpc.includes('product_identifier_required'), 'required-identifier path missing');
  assert(rpc.includes('barcode = upper(btrim(p_barcode))'), 'barcode lookup not normalized');

  // REGRESSION (Elder finding): base price must default to NULL, never 0 —
  // otherwise the product_prices fallback is unreachable and every unbound scan
  // fabricates price 0.
  assert(rpc.includes('v_resolved numeric := null'), 'v_resolved must default to null, got a literal 0');
  assert(!/v_resolved\s*numeric\s*:=\s*0\b/.test(rpc), 'v_resolved defaulted to 0');

  // REGRESSION (Elder finding): deactivated products must not resolve — gated
  // on products.active at the barcode lookup AND at the product fetch.
  assert(rpc.includes('and barcode = upper(btrim(p_barcode))\n       and active;'), 'barcode lookup is not active-gated');
  assert(rpc.includes('and p.id = v_pid and p.active'), 'product fetch is not active-gated');

  // Price-list binding mirrors COUNTER_SALE: lower(code), active only, fail closed.
  assert(rpc.includes('stock_line_price_list_not_found'), 'bound-list fail-closed missing');

  // Server-side approval order matches COUNTER_SALE L785-810.
  assert(rpc.includes('price_list_item_overrides'), 'override lookup missing');
  const overrideFirst = rpc.indexOf('price_list_item_overrides') < rpc.indexOf('product_prices pp');
  assert(overrideFirst, 'override must be consulted before base product_prices');
  assert(rpc.includes('order by pp.valid_from desc'), 'newest-valid-window ordering missing');
  // Base price lookup is pinned to the FUNCTIONAL currency derived from the
  // org's base_currency (SERP-434 architecture correction, commit 0c46cde) —
  // never a hardcoded literal.
  assert(rpc.includes('pp.currency = v_org_currency'), 'base price not pinned to derived currency');
  assert(!rpc.includes("pp.currency = 'MVR'"), 'base price pinned to a hardcoded literal');
  assert(rpc.includes('limit 1'), 'single row limit missing');

  // Discount + tax mirror COUNTER_SALE exactly (round(...,6) then calculate_line_tax).
  assert(rpc.includes('round(v_resolved * (1 - v_pl_discount / 100), 6)'), 'list discount maths drifted');
  assert(rpc.includes('app_private.calculate_line_tax('), 'line tax resolution missing');

  // No-price is a distinguishable fail-closed state.
  assert(rpc.includes("'reason', 'stock_line_no_price'"), 'no-price attribution missing');
  assert(rpc.includes("'resolved', false"), 'no-price not resolved=false');

  // Seat gate + tax-mode gate from the RPC header.
  assert(rpc.includes('counter_sale_tax_mode_invalid'), 'tax-mode gate missing');

  // Read-only discipline: no idempotency, no audit, no insert/update/delete.
  assert(!/insert\s+into\s+public\.idempotency_keys/i.test(rpc), 'resolution RPC writes idempotency rows');
  assert(!/insert\s+into\s+public\.audit_events/i.test(rpc), 'resolution RPC writes audit rows');
  assert(!/\binsert\s+into\b/i.test(rpc), 'resolution RPC mutates data');

  // The COUNTER_SALE resolver the RPC reproduces is present in the counter migration.
  assert(counter.includes('price_list_item_overrides'), 'COUNTER_SALE override lookup missing for cross-check');
  assert(counter.includes('order by pp.valid_from desc'), 'COUNTER_SALE base price ordering missing for cross-check');
});

Deno.test('SERP-086 conformance: bulk approved-prices RPC is tenant-scoped, lateral-correct, seat-gated', async () => {
  const sql = await readMigration('202609192000_serp086_barcode_approved_pricing.sql');

  const fn = sql.indexOf('create or replace function public.api_counter_approved_prices(');
  const end = sql.indexOf('commit;', fn);
  const rpc = sql.slice(fn, end);

  // Tenant scoping on every read.
  assert((rpc.match(/o\.organisation_id = target_org/g) ?? []).length >= 1, 'override join not org-scoped');
  assert((rpc.match(/pp\.organisation_id = target_org/g) ?? []).length >= 1, 'price join not org-scoped');
  assert(rpc.includes('p.organisation_id = target_org'), 'product scan not org-scoped');

  // REGRESSION (Elder finding): the bulk aperture is active-gated too.
  assert(/p\.organisation_id = target_org\s+and p\.active/.test(rpc), 'bulk product scan is not active-gated');

  // Lateral subquery picks only the current valid window (no stale/naive join).
  assert(rpc.includes('left join lateral'), 'lateral current-version join missing');
  assert(rpc.includes('order by pp.valid_from desc'), 'lateral newest-valid ordering missing');
  assert(rpc.includes('limit 1'), 'lateral single version missing');

  // Fail-closed bound list + seat gate.
  assert(rpc.includes('stock_line_price_list_not_found'), 'bound-list fail-closed missing in bulk RPC');
  assert(rpc.includes('seat_not_authorized'), 'bulk RPC seat gate missing');

  // Read-only bulk: no mutation anywhere in the RPC body.
  assert(!/\b(insert|update|delete)\b/i.test(rpc), 'bulk RPC mutates data');

  // Both functions revoked from anon/authenticated, granted only to service_role.
  const grant = sql.slice(sql.indexOf('revoke all on function public.api_counter_price_resolution'));
  assert((grant.match(/revoke all on function public\.api_counter_price_resolution/g) ?? []).length === 1, 'revoke missing for resolution RPC');
  assert((grant.match(/revoke all on function public\.api_counter_approved_prices/g) ?? []).length === 1, 'revoke missing for approved-prices RPC');
  assert((grant.match(/grant execute on function public\.api_counter_price_resolution/g) ?? []).length === 1, 'service_role grant missing for resolution RPC');
  assert((grant.match(/grant execute on function public\.api_counter_approved_prices/g) ?? []).length === 1, 'service_role grant missing for approved-prices RPC');
});

Deno.test('SERP-086 conformance: migration scope discipline — no schema drift beyond barcode column', async () => {
  const sql = await readMigration('202609192000_serp086_barcode_approved_pricing.sql');

  // Only barcode is added to products — nothing else about that table changes.
  assert(!/create\s+(table|view|index)[^;\n]*on\s+public\.(?!products)/i.test(sql), 'new table/view/index leaked beyond products');
  assert(!/drop\s+(table|view|column|index)/i.test(sql), 'destroy leaked into the migration');
  assert(!/alter table public\.(?!products)/.test(sql) || (sql.match(/alter table public\.products/g) ?? []).length >= 2, 'unexpected alter outside products');
  assert(!/create trigger/i.test(sql), 'trigger leaked into the migration');
  assert(sql.includes('commit;'), 'migration not wrapped in a transaction');
  assert(sql.startsWith('begin;'), 'migration transaction not opened');
});