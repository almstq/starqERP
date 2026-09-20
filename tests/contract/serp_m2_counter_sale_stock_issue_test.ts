/**
 * STARQ ERP — SERP-M2-ATOMIC-CHECKOUT counter-sale stock issue proof gate (OpenCode lane).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The M2 dispatch (Room seq 5993, SERP-M2-ATOMIC-CHECKOUT) extends the COUNTER_SALE
 * branch of public.api_garage_command (migration 202609090050) so that a counter
 * sale is an ATOMIC sale: real commercial_document_lines rows, one stock_movements
 * 'issue' row per line, server-side pricing/tax resolved from the price registry
 * (client totals are never trusted), an oversell guard against live derived
 * on-hand inside the SAME transaction, and an outbox/event seam for a future
 * Hoadha projection. The implementation is a single new migration:
 *
 *   202609190059_counter_sale_stock_issue.sql
 *
 * Like M1, the artifact is review-only: it must NOT be applied to any production
 * or local database. Real-database independent verification belongs to Vision /
 * acceptance-gate item 7, under the same bounded rules as Track A. The OpenCode
 * lane therefore proves items 1-6 and 8-10 exactly the way M1 proved its gate:
 * a pure contract mirror of the SQL control flow (deterministic, in-memory, no
 * database) plus a source-conformance layer that reads the actual migration file
 * and asserts the controls are WIRED IN — never just present in this spec.
 * Both layers must pass.
 *
 * Run:  deno test --allow-read tests/contract/serp_m2_counter_sale_stock_issue_test.ts
 */

import { assert, assertEquals, assertNotEquals, assertThrows } from 'jsr:@std/assert@1';

const EDGE_MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// FIXED IDENTITIES (deterministic — same shape as the M1 mirror fixtures)
// ─────────────────────────────────────────────────────────────────────────────

const ORG = '20000000-0000-4000-8000-000000000001';
const OTHER_ORG = '10000000-0000-4000-8000-000000000001';
const PERSON = '20000000-0000-4000-8000-000000000099';
const SEAT_COUNTER = 'counter';
const SEAT_TECHNICIAN = 'technician';
const LOCATION_MAIN = '20000000-0000-4000-8000-000000000601';
const LOCATION_WAREHOUSE = '20000000-0000-4000-8000-000000000602';
const LOCATION_OTHER = '10000000-0000-4000-8000-000000000601';
const PRODUCT_A = '20000000-0000-4000-8000-000000000701';
const PRODUCT_B = '20000000-0000-4000-8000-000000000703';
const PRODUCT_SERVICE = '20000000-0000-4000-8000-000000000702';
const PRODUCT_OTHER_ORG = '10000000-0000-4000-8000-000000000701';
const PRODUCT_NO_PRICE = '20000000-0000-4000-8000-000000000704';

// Price registry fixtures. contacts.metadata->>'price_list_id' stores the CODE.
const PRICE_LIST_RETAIL = 'retail';
const PRICE_LIST_WHOLESALE = 'wholesale';
const PRICE_LIST_CODE_MISSING = 'closing_soon'; // no active price_list row -> not found
const DISCOUNT_RETAIL = 0;
const DISCOUNT_WHOLESALE = 10; // percent

// Base catalog price (MVR), used when there is no price-list override.
const BASE_PRICE_A = 100;
const BASE_PRICE_B = 25;

// GST statutory rate (MVR / gst_general / registered).
const GST_RATE = 0.08;

// ─────────────────────────────────────────────────────────────────────────────
// THE PURE-LOGIC MIRROR OF THE SQL RPC BODY
// ─────────────────────────────────────────────────────────────────────────────
// Each block maps 1:1 to a block in 202609190059_counter_sale_stock_issue.sql.
// The mirror is intentionally dumb and literal: it does NOT invent rules the SQL
// does not have, and it does NOT omit rules the SQL has. Seat gate, location
// validation, tax-mode validation, price resolution order, discount, line tax,
// oversell guard, one-issue-per-line, document + settlement + outbox writes and
// the authoritative post-sale on-hand map all come straight from the migration.

interface Movement {
  organisationId: string;
  locationId: string;
  productId: string;
  movementType: 'issue';
  quantity: number; // negative for issue
  sourceType: 'COUNTER_SALE';
  sourceId: string; // the invoice document id
  idempotencyKey: string;
}

interface IdempotencyClaim {
  organisationId: string;
  key: string;
  commandType: string;
  requestHash: string;
  state: 'processing' | 'accepted';
  responseBody: CounterSaleResponse | null;
}

interface LineRow {
  lineNo: number;
  productId: string;
  quantity: number;
  unitPrice: number;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

interface CounterSaleResponse {
  ok: boolean;
  state: string;
  invoice_id: string;
  invoice_number: string;
  payment_id: string;
  location_id: string;
  subtotal: number;
  tax_total: number;
  total_amount: number;
  lines: LineRow[];
  movements: { product_id: string; quantity: number }[];
  on_hand: Record<string, number>;
}

interface SimState {
  movements: Movement[];
  idempotency: IdempotencyClaim[];
}

/** Stable deterministic pseudo-hash — equality semantics only (mirrors canonical_jsonb_sha256). */
function requestHash(command: Record<string, unknown>): string {
  let h = 2166136261;
  const s = JSON.stringify(command);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Deterministic per-line key — mirrors md5(command_key::text || ':' || v_line_no)::uuid. */
function lineKey(commandKey: string, lineNo: number): string {
  return `${commandKey}:${lineNo}`;
}

const newStore = (): SimState => ({ movements: [], idempotency: [] });

/** Mirrors public.stock_movements_derived_onhand(...) — a SUM over the ledger. */
function derivedOnHand(
  state: SimState,
  org: string,
  locationId: string,
  productId: string,
): number {
  return state.movements
    .filter((m) =>
      m.organisationId === org &&
      m.locationId === locationId &&
      m.productId === productId
    )
    .reduce((acc, m) => acc + m.quantity, 0);
}

/** Rounding helper mirroring Postgres round(numeric, 2) / round(numeric, 6). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function round6(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

/** Mirrors app_private.calculate_line_tax(org, 'gst_general', date, mode, line_amount). */
function calculateLineTax(
  org: string,
  taxMode: string,
  lineAmount: number,
): { taxRate: number; net: number; tax: number; gross: number } {
  const registered = org === ORG; // ORG is GST-registered, OTHER_ORG is not
  if (!registered) {
    return { taxRate: 0, net: round2(lineAmount), tax: 0, gross: round2(lineAmount) };
  }
  if (taxMode === 'zero_rated' || taxMode === 'exempt') {
    return { taxRate: 0, net: round2(lineAmount), tax: 0, gross: round2(lineAmount) };
  }
  if (taxMode === 'exclusive') {
    const net = round2(lineAmount);
    const tax = round2(net * GST_RATE);
    return { taxRate: GST_RATE, net, tax, gross: round2(net + tax) };
  }
  // inclusive: gross is the payment; net = gross/(1+rate), tax = gross - net
  const gross = round2(lineAmount);
  const net = round2(gross / (1 + GST_RATE));
  const tax = round2(gross - net);
  return { taxRate: GST_RATE, net, tax, gross };
}

interface SimCallOpts {
  targetOrg: string;
  targetPerson: string;
  targetSeat: string;
  commandKey: string;
  requestIdentifier: string;
  command: Record<string, unknown>;
}

interface SimResult {
  ok: boolean;
  response: CounterSaleResponse;
  movements: Movement[];
}

/** Mirrors one call into public.api_garage_command for event_name = 'COUNTER_SALE'. */
function executeCounterSale(state: SimState, opts: SimCallOpts): SimResult {
  const { targetOrg, targetPerson, targetSeat, commandKey, command } = opts;

  // Mirror the SQL claim-first idempotency spine (shared outer spine, unchanged).
  const digest = requestHash(command);
  const claim = state.idempotency.find((c) =>
    c.organisationId === targetOrg && c.key === commandKey
  );
  if (claim) {
    if (claim.requestHash !== digest) {
      throw new Error('idempotency_key_conflict');
    }
    if (!claim.responseBody) {
      throw new Error('idempotency_key_conflict'); // prior call rolled back
    }
    return {
      ok: true,
      response: claim.responseBody,
      movements: [],
    };
  }
  const claimRec: IdempotencyClaim = {
    organisationId: targetOrg,
    key: commandKey,
    commandType: 'COUNTER_SALE',
    requestHash: digest,
    state: 'processing',
    responseBody: null,
  };
  state.idempotency.push(claimRec);

  // Working buffer — nothing hits the ledger until the command fully passes,
  // mirroring the single plpgsql transaction (an exception rolls everything back).
  const pending: Movement[] = [];

  try {
    // 1. Seat gate mirrors the SQL gate (202609090050:120-123), unchanged.
    if (!['counter', 'director', 'managing_director', 'owner'].includes(targetSeat)) {
      throw new Error('acting_seat_not_legal_for_command');
    }

    // 2. Location is mandatory and must belong to targetOrg and be active.
    const locationId = String(command.location_id ?? '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(locationId)) {
      throw new Error('stock_location_required');
    }
    if (locationId === LOCATION_WAREHOUSE && targetOrg !== ORG) throw new Error('location_not_found');
    if (locationId === LOCATION_MAIN && targetOrg === OTHER_ORG) throw new Error('location_not_found');
    if (locationId === LOCATION_OTHER && targetOrg !== OTHER_ORG) throw new Error('location_not_found');

    // 3. Tax mode validated to the closed set.
    const taxMode = String(command.tax_mode ?? 'exclusive').trim().toLowerCase();
    if (!['inclusive', 'exclusive', 'zero_rated', 'exempt'].includes(taxMode)) {
      throw new Error('counter_sale_tax_mode_invalid');
    }

    // 4. items must be a non-empty array.
    const items = command.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('stock_lines_required');
    }

    // 5. Resolve the customer's bound price list (optional). The code is read
    //    from the command verbatim — 'retail'/'wholesale' name an active registry
    //    row, a known-but-inactive code closes with price_list_not_found.
    let priceListId: string | null = null;
    let listDiscount = 0;
    const customerId = String(command.customer_id ?? '');
    if (customerId && customerId !== OTHER_ORG) {
      const code = String(command.customer_price_list_code ?? '');
      if (code === PRICE_LIST_CODE_MISSING) {
        throw new Error('stock_line_price_list_not_found');
      }
      if (code === PRICE_LIST_RETAIL || code === PRICE_LIST_WHOLESALE) {
        priceListId = `pl-${code}`;
        listDiscount = code === PRICE_LIST_WHOLESALE ? DISCOUNT_WHOLESALE : DISCOUNT_RETAIL;
      }
    }

    // 6. Per-line pricing + tax + oversell guard + one issue per line.
    const vDocId = `invoice-${commandKey}`;
    const vPaymentId = `payment-${commandKey}`;
    let vSubtotal = 0;
    let vGst = 0;
    let vAmount = 0;
    const lineRows: LineRow[] = [];

    items.forEach((raw, idx) => {
      const line = raw as Record<string, unknown>;
      const lineNo = idx + 1;
      const key = lineKey(commandKey, lineNo);
      const productId = String(line.product_id ?? '');
      if (!productId) throw new Error('stock_line_product_not_found');
      if (productId === PRODUCT_OTHER_ORG && targetOrg === ORG) throw new Error('stock_line_product_not_found');
      if (productId === PRODUCT_A && targetOrg === OTHER_ORG) throw new Error('stock_line_product_not_found');
      if (productId === PRODUCT_SERVICE) throw new Error('stock_line_product_not_inventoried');

      if (line.quantity === undefined || line.quantity === null) throw new Error('stock_line_quantity_required');
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('stock_line_quantity_positive');

      // Price resolution order mirrors the SQL: price-list override, else current
      // MVR base price, then list discount. No price anywhere -> stock_line_no_price.
      let unitPrice: number | null = null;
      if (priceListId === 'pl-retail' && productId === PRODUCT_A) unitPrice = 95; // override
      if (unitPrice === null) {
        if (productId === PRODUCT_NO_PRICE && priceListId === null) throw new Error('stock_line_no_price');
        const baseMap: Record<string, number> = {
          [PRODUCT_A]: BASE_PRICE_A,
          [PRODUCT_B]: BASE_PRICE_B,
        };
        const base = baseMap[productId];
        if (base === undefined) throw new Error('stock_line_no_price');
        unitPrice = base;
      }
      if (listDiscount > 0) unitPrice = round6(unitPrice * (1 - listDiscount / 100));

      const lineAmount = round2(unitPrice * qty);
      const taxRow = calculateLineTax(targetOrg, taxMode, lineAmount);
      const lineNet = taxRow.net;
      const lineTax = taxRow.tax;
      const lineGross = taxRow.gross;

      vSubtotal = round2(vSubtotal + lineNet);
      vGst = round2(vGst + lineTax);
      vAmount = round2(vAmount + lineGross);
      lineRows.push({
        lineNo,
        productId,
        quantity: qty,
        unitPrice: round6(unitPrice),
        netAmount: lineNet,
        taxAmount: lineTax,
        grossAmount: lineGross,
      });

      // Oversell guard: live derived on-hand inside this transaction — earlier
      // lines' issues are already in `pending`, so the running sum reflects them.
      const onHand =
        derivedOnHand(state, targetOrg, locationId, productId) +
        pending.filter((m) => m.productId === productId).reduce((a, m) => a + m.quantity, 0);
      if (onHand < qty) throw new Error('stock_line_insufficient_on_hand');

      // One issue movement per line; negative quantity reduces on-hand.
      pending.push({
        organisationId: targetOrg,
        locationId,
        productId,
        movementType: 'issue',
        quantity: -qty,
        sourceType: 'COUNTER_SALE',
        sourceId: vDocId,
        idempotencyKey: key,
      });
    });

    // 7. Authoritative on-hand AFTER this sale, per product.
    const onHandMap: Record<string, number> = {};
    for (const pid of lineRows.map((l) => l.productId)) {
      if (onHandMap[pid] === undefined) {
        onHandMap[pid] =
          derivedOnHand(state, targetOrg, locationId, pid) +
          pending.filter((m) => m.productId === pid).reduce((a, m) => a + m.quantity, 0);
      }
    }

    // 8. Commit everything together — movement rows, invoice, document lines,
    //    payment + settlement, and the idempotency/accepted record.
    claimRec.state = 'accepted';
    claimRec.responseBody = {
      ok: true,
      state: 'accepted',
      invoice_id: vDocId,
      invoice_number: `SI-00001-${commandKey.slice(0, 4)}`,
      payment_id: vPaymentId,
      location_id: locationId,
      subtotal: vSubtotal,
      tax_total: vGst,
      total_amount: vAmount,
      lines: lineRows,
      movements: pending.map((m) => ({
        product_id: m.productId,
        quantity: m.quantity,
      })),
      on_hand: onHandMap,
    };
    for (const m of pending) state.movements.push(Object.freeze({ ...m }));

    return {
      ok: true,
      response: claimRec.responseBody!,
      movements: pending,
    };
  } catch (err) {
    // Mirror the rollback: the claim and every staged movement are discarded.
    state.idempotency = state.idempotency.filter((c) => c !== claimRec);
    for (const m of pending) {
      state.movements = state.movements.filter((x) => x !== m);
    }
    throw err;
  }
}

// Read a migration file — kept async for parity with the migrator packaging;
// this test never touches a database.
async function readMigration(name: string): Promise<string> {
  const url = new URL(name, EDGE_MIGRATIONS);
  return await Deno.readTextFile(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE M2 PROOF GATE — through the mirror, mapping to the seq-5993 gate items
// ─────────────────────────────────────────────────────────────────────────────

function counterSaleCommand(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'COUNTER_SALE',
    location_id: LOCATION_MAIN,
    tax_mode: 'exclusive',
    items: [
      { product_id: PRODUCT_A, quantity: 2 },
    ],
    ...patch,
  };
}

Deno.test('M2 gate: a counter sale writes one issue movement per line, server-priced, with client totals ignored', () => {
  const store = newStore();
  // Seed 100 units of A at LOCATION_MAIN so oversell cannot fire by accident.
  store.movements.push({
    organisationId: ORG,
    locationId: LOCATION_MAIN,
    productId: PRODUCT_A,
    movementType: 'issue',
    quantity: 100,
    sourceType: 'COUNTER_SALE',
    sourceId: 'seed',
    idempotencyKey: 'seed-1',
  });

  const res = executeCounterSale(store, {
    targetOrg: ORG,
    targetPerson: PERSON,
    targetSeat: SEAT_COUNTER,
    commandKey: '11111111-0000-4000-8000-000000000001',
    requestIdentifier: 'req-1',
    command: counterSaleCommand({
      // Client-submitted totals are present but MUST be ignored — the server
      // prices from the catalog, not from these.
      total_amount: 1,
      gst_amount: 0,
    }),
  });

  // Acceptance item 2 — server-side pricing: 2 x 100 MVR base price, GST 8% exclusive.
  assertEquals(res.response.lines.length, 1);
  assertEquals(res.response.lines[0].unitPrice, 100);
  assertEquals(res.response.lines[0].netAmount, 200);
  assertEquals(res.response.lines[0].taxAmount, 16);
  assertEquals(res.response.lines[0].grossAmount, 216);
  assertNotEquals(res.response.total_amount, 1, 'client-submitted total was trusted');
  assertEquals(res.response.subtotal, 200);
  assertEquals(res.response.tax_total, 16);
  assertEquals(res.response.total_amount, 216);

  // Acceptance items 1+3 — one issue movement per line, quantity negative.
  assertEquals(res.movements.length, 1);
  assertEquals(res.movements[0].movementType, 'issue');
  assertEquals(res.movements[0].quantity, -2);
  assertEquals(res.movements[0].sourceType, 'COUNTER_SALE');
  assertEquals(res.movements[0].sourceId, res.response.invoice_id);

  // Acceptance item 4 — per-line deterministic key (mirror of md5 command_key:line_no).
  assertEquals(res.movements[0].idempotencyKey, lineKey('11111111-0000-4000-8000-000000000001', 1));

  // Acceptance item 3 — on-hand reduced within the same transaction.
  assertEquals(res.response.on_hand[PRODUCT_A], 98);
  assertEquals(derivedOnHand(store, ORG, LOCATION_MAIN, PRODUCT_A), 98);
});

Deno.test('M2 gate: price-list override + wholesale discount are applied server-side', () => {
  const store = newStore();
  store.movements.push({
    organisationId: ORG,
    locationId: LOCATION_MAIN,
    productId: PRODUCT_A,
    movementType: 'issue',
    quantity: 100,
    sourceType: 'COUNTER_SALE',
    sourceId: 'seed',
    idempotencyKey: 'seed-2',
  });
  store.movements.push({
    organisationId: ORG,
    locationId: LOCATION_MAIN,
    productId: PRODUCT_B,
    movementType: 'issue',
    quantity: 100,
    sourceType: 'COUNTER_SALE',
    sourceId: 'seed',
    idempotencyKey: 'seed-2b',
  });

  // Retail price list carries an override of 95 for PRODUCT_A.
  const retail = executeCounterSale(store, {
    targetOrg: ORG,
    targetPerson: PERSON,
    targetSeat: SEAT_COUNTER,
    commandKey: '11111111-0000-4000-8000-000000000002',
    requestIdentifier: 'req-2',
    command: counterSaleCommand({ customer_id: PERSON, customer_price_list_code: PRICE_LIST_RETAIL }),
  });
  assertEquals(retail.response.lines[0].unitPrice, 95, 'price-list override not applied');

  // Wholesale adds a 10% discount on the base price for PRODUCT_B (no override).
  const wholesale = executeCounterSale(store, {
    targetOrg: ORG,
    targetPerson: PERSON,
    targetSeat: SEAT_COUNTER,
    commandKey: '11111111-0000-4000-8000-000000000003',
    requestIdentifier: 'req-3',
    command: counterSaleCommand({
      customer_id: PERSON,
      customer_price_list_code: PRICE_LIST_WHOLESALE,
      items: [{ product_id: PRODUCT_B, quantity: 4 }],
    }),
  });
  assertEquals(wholesale.response.lines[0].unitPrice, 22.5, 'wholesale discount not applied');
  assertEquals(wholesale.response.lines[0].netAmount, 90);
  assertEquals(wholesale.response.lines[0].taxAmount, 7.2);
  assertEquals(wholesale.response.lines[0].grossAmount, 97.2);
});

Deno.test('M2 gate: inclusive tax mode treats unit_price as gross and derives net + tax', () => {
  const store = newStore();
  store.movements.push({
    organisationId: ORG,
    locationId: LOCATION_MAIN,
    productId: PRODUCT_A,
    movementType: 'issue',
    quantity: 100,
    sourceType: 'COUNTER_SALE',
    sourceId: 'seed',
    idempotencyKey: 'seed-3',
  });

  const res = executeCounterSale(store, {
    targetOrg: ORG,
    targetPerson: PERSON,
    targetSeat: SEAT_COUNTER,
    commandKey: '11111111-0000-4000-8000-000000000004',
    requestIdentifier: 'req-4',
    command: counterSaleCommand({ tax_mode: 'inclusive' }),
  });
  // Line amount = 200 gross; net = 200/1.08 = 185.19, tax = 14.81.
  assertEquals(res.response.lines[0].unitPrice, 100);
  assertEquals(res.response.lines[0].netAmount, 185.19);
  assertEquals(res.response.lines[0].taxAmount, 14.81);
  assertEquals(res.response.lines[0].grossAmount, 200);
  assertEquals(res.response.total_amount, 200);

  // Series sum is exact: net + tax must equal gross for every line (the DB
  // check commercial_document_lines.gross_amount = net_amount + tax_amount).
  for (const line of res.response.lines) {
    assertEquals(line.grossAmount, round2(line.netAmount + line.taxAmount));
  }
});

Deno.test('M2 gate: oversell is rejected with the M1 error shape and rolls back entirely', () => {
  const store = newStore();
  store.movements.push({
    organisationId: ORG,
    locationId: LOCATION_MAIN,
    productId: PRODUCT_A,
    movementType: 'issue',
    quantity: 5, // only 5 on hand
    sourceType: 'COUNTER_SALE',
    sourceId: 'seed',
    idempotencyKey: 'seed-4',
  });

  assertThrows(() =>
    executeCounterSale(store, {
      targetOrg: ORG,
      targetPerson: PERSON,
      targetSeat: SEAT_COUNTER,
      commandKey: '11111111-0000-4000-8000-000000000005',
      requestIdentifier: 'req-5',
      command: counterSaleCommand({ items: [{ product_id: PRODUCT_A, quantity: 6 }] }),
    }),
    Error,
    'stock_line_insufficient_on_hand',
  );

  // Atomicity (item 1): nothing was written — no movement, no idempotency record.
  assertEquals(store.movements.length, 1, 'a movement survived a failed oversell guard');
  assertEquals(store.idempotency.length, 0, 'a claim survived a failed oversell guard');
});

Deno.test('M2 gate: N-line orders guard each line against the running total in one transaction', () => {
  const store = newStore();
  store.movements.push({
    organisationId: ORG,
    locationId: LOCATION_MAIN,
    productId: PRODUCT_A,
    movementType: 'issue',
    quantity: 10,
    sourceType: 'COUNTER_SALE',
    sourceId: 'seed',
    idempotencyKey: 'seed-5',
  });
  store.movements.push({
    organisationId: ORG,
    locationId: LOCATION_MAIN,
    productId: PRODUCT_B,
    movementType: 'issue',
    quantity: 10,
    sourceType: 'COUNTER_SALE',
    sourceId: 'seed',
    idempotencyKey: 'seed-6',
  });

  // Line 1 takes 8 of A (ok), line 2 takes 3 of A (fails: only 2 left).
  assertThrows(() =>
    executeCounterSale(store, {
      targetOrg: ORG,
      targetPerson: PERSON,
      targetSeat: SEAT_COUNTER,
      commandKey: '11111111-0000-4000-8000-000000000006',
      requestIdentifier: 'req-6',
      command: counterSaleCommand({
        items: [
          { product_id: PRODUCT_A, quantity: 8 },
          { product_id: PRODUCT_A, quantity: 3 },
        ],
      }),
    }),
    Error,
    'stock_line_insufficient_on_hand',
  );

  // Atomicity (item 1): the first line that passed must NOT have been committed.
  assertEquals(derivedOnHand(store, ORG, LOCATION_MAIN, PRODUCT_A), 10, 'partial N-line commit (line 1 persisted)');
  assertEquals(store.idempotency.length, 0);
});

Deno.test('M2 gate: inner-line insufficiency is caught even when the base on-hand would cover each line alone', () => {
  const store = newStore();
  store.movements.push({
    organisationId: ORG,
    locationId: LOCATION_MAIN,
    productId: PRODUCT_A,
    movementType: 'issue',
    quantity: 5,
    sourceType: 'COUNTER_SALE',
    sourceId: 'seed',
    idempotencyKey: 'seed-7',
  });

  // Two lines of 4 each: individually both are covered, together they oversell.
  assertThrows(() =>
    executeCounterSale(store, {
      targetOrg: ORG,
      targetPerson: PERSON,
      targetSeat: SEAT_COUNTER,
      commandKey: '11111111-0000-4000-8000-000000000007',
      requestIdentifier: 'req-7',
      command: counterSaleCommand({
        items: [
          { product_id: PRODUCT_A, quantity: 4 },
          { product_id: PRODUCT_A, quantity: 4 },
        ],
      }),
    }),
    Error,
    'stock_line_insufficient_on_hand',
  );
  assertEquals(store.idempotency.length, 0);
});

Deno.test('M2 gate: replay with the same idempotency key returns the cached result, never a second movement', () => {
  const store = newStore();
  store.movements.push({
    organisationId: ORG,
    locationId: LOCATION_MAIN,
    productId: PRODUCT_A,
    movementType: 'issue',
    quantity: 100,
    sourceType: 'COUNTER_SALE',
    sourceId: 'seed',
    idempotencyKey: 'seed-8',
  });

  const key = '11111111-0000-4000-8000-000000000008';
  const first = executeCounterSale(store, {
    targetOrg: ORG,
    targetPerson: PERSON,
    targetSeat: SEAT_COUNTER,
    commandKey: key,
    requestIdentifier: 'req-8a',
    command: counterSaleCommand({ items: [{ product_id: PRODUCT_A, quantity: 2 }] }),
  });
  const second = executeCounterSale(store, {
    targetOrg: ORG,
    targetPerson: PERSON,
    targetSeat: SEAT_COUNTER,
    commandKey: key,
    requestIdentifier: 'req-8b',
    command: counterSaleCommand({ items: [{ product_id: PRODUCT_A, quantity: 2 }] }),
  });

  assertEquals(second.movements.length, 0, 'replay issued a second movement');
  assertEquals(second.response.invoice_id, first.response.invoice_id, 'replay returned a different cached result');
  assertEquals(derivedOnHand(store, ORG, LOCATION_MAIN, PRODUCT_A), 98, 'ledger moved on replay');

  // A key reused with a different payload is a conflict, never a replay (M1 spine).
  assertThrows(() =>
    executeCounterSale(store, {
      targetOrg: ORG,
      targetPerson: PERSON,
      targetSeat: SEAT_COUNTER,
      commandKey: key,
      requestIdentifier: 'req-8c',
      command: counterSaleCommand({ items: [{ product_id: PRODUCT_A, quantity: 9 }] }),
    }),
    Error,
    'idempotency_key_conflict',
  );
});

Deno.test('M2 gate: wrong tenant, service product, unauthorized seat, missing price and bad tax mode all fail closed', () => {
  const store = newStore();
  store.movements.push({
    organisationId: ORG,
    locationId: LOCATION_MAIN,
    productId: PRODUCT_A,
    movementType: 'issue',
    quantity: 100,
    sourceType: 'COUNTER_SALE',
    sourceId: 'seed',
    idempotencyKey: 'seed-9',
  });

  // Unauthorized seat (item 5 — seat enforcement preserved).
  assertThrows(() =>
    executeCounterSale(store, {
      targetOrg: ORG,
      targetPerson: PERSON,
      targetSeat: SEAT_TECHNICIAN,
      commandKey: '11111111-0000-4000-8000-000000000009',
      requestIdentifier: 'req-9a',
      command: counterSaleCommand(),
    }),
    Error,
    'acting_seat_not_legal_for_command',
  );

  // Wrong tenant product (tenant scoping preserved).
  assertThrows(() =>
    executeCounterSale(store, {
      targetOrg: ORG,
      targetPerson: PERSON,
      targetSeat: SEAT_COUNTER,
      commandKey: '11111111-0000-4000-8000-00000000000a',
      requestIdentifier: 'req-9b',
      command: counterSaleCommand({ items: [{ product_id: PRODUCT_OTHER_ORG, quantity: 1 }] }),
    }),
    Error,
    'stock_line_product_not_found',
  );

  // Service-kind product is rejected so "one movement per line" holds strictly.
  assertThrows(() =>
    executeCounterSale(store, {
      targetOrg: ORG,
      targetPerson: PERSON,
      targetSeat: SEAT_COUNTER,
      commandKey: '11111111-0000-4000-8000-00000000000b',
      requestIdentifier: 'req-9c',
      command: counterSaleCommand({ items: [{ product_id: PRODUCT_SERVICE, quantity: 1 }] }),
    }),
    Error,
    'stock_line_product_not_inventoried',
  );

  // No resolvable price anywhere closes with stock_line_no_price.
  assertThrows(() =>
    executeCounterSale(store, {
      targetOrg: ORG,
      targetPerson: PERSON,
      targetSeat: SEAT_COUNTER,
      commandKey: '11111111-0000-4000-8000-00000000000c',
      requestIdentifier: 'req-9d',
      command: counterSaleCommand({ items: [{ product_id: PRODUCT_NO_PRICE, quantity: 1 }] }),
    }),
    Error,
    'stock_line_no_price',
  );

  // A bound price list that has no ACTIVE registry row fails with its own code.
  assertThrows(() =>
    executeCounterSale(store, {
      targetOrg: ORG,
      targetPerson: PERSON,
      targetSeat: SEAT_COUNTER,
      commandKey: '11111111-0000-4000-8000-00000000000d',
      requestIdentifier: 'req-9e',
      command: counterSaleCommand({ customer_id: PERSON, customer_price_list_code: PRICE_LIST_CODE_MISSING }),
    }),
    Error,
    'stock_line_price_list_not_found',
  );

  // Bad tax mode.
  assertThrows(() =>
    executeCounterSale(store, {
      targetOrg: ORG,
      targetPerson: PERSON,
      targetSeat: SEAT_COUNTER,
      commandKey: '11111111-0000-4000-8000-00000000000e',
      requestIdentifier: 'req-9f',
      command: counterSaleCommand({ tax_mode: 'untaxed_yes_please' }),
    }),
    Error,
    'counter_sale_tax_mode_invalid',
  );

  // Every failure above rolled back fully.
  assertEquals(store.movements.length, 1, 'a movement survived a rejected command');
  assertEquals(store.idempotency.length, 0, 'a claim survived a rejected command');
});

Deno.test('M2 gate: non-registered tenant charges zero GST', () => {
  const store = newStore();
  store.movements.push({
    organisationId: OTHER_ORG,
    locationId: LOCATION_OTHER,
    productId: PRODUCT_B,
    movementType: 'issue',
    quantity: 100,
    sourceType: 'COUNTER_SALE',
    sourceId: 'seed',
    idempotencyKey: 'seed-10',
  });

  const res = executeCounterSale(store, {
    targetOrg: OTHER_ORG,
    targetPerson: PERSON,
    targetSeat: SEAT_COUNTER,
    commandKey: '11111111-0000-4000-8000-00000000000f',
    requestIdentifier: 'req-10',
    command: {
      type: 'COUNTER_SALE',
      location_id: LOCATION_OTHER,
      tax_mode: 'exclusive',
      items: [{ product_id: PRODUCT_B, quantity: 2 }],
    },
  });
  assertEquals(res.response.lines[0].netAmount, 50);
  assertEquals(res.response.lines[0].taxAmount, 0);
  assertEquals(res.response.total_amount, 50);
});

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE CONFORMANCE — the controls must be WIRED IN, not merely specified
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('M2 conformance: 202609190059 re-defines api_garage_command and wires every M2 control', async () => {
  const sql = await readMigration('202609190059_counter_sale_stock_issue.sql');
  const src = await readMigration('202609090050_serp314_customer_price_list_persistence.sql');

  // The new migration re-defines the whole function (repo convention), and does
  // not duplicate the SERP-314 DDL that 202609090050 already applies.
  assert(sql.includes('create or replace function public.api_garage_command('), 'function body missing');
  assert(!sql.includes('alter table public.contacts'), 'stale SERP-314 DDL duplicated into new migration');

  // Item 5 — seat/tenant enforcement preserved exactly as it exists today.
  assert(!/target_seat not in \('counter', 'director', 'managing_director', 'owner'\)/.test(src) ||
    /target_seat not in \('counter', 'director', 'managing_director', 'owner'\)/.test(sql),
  'COUNTER_SALE seat gate drifted from the 202609090050 wording');
  assert(sql.includes('app_private.assert_active_seat('), 'active-seat call missing');

  // Item 1 — atomic boundary. Claim-first key precedes any business write, and
  // the ledger is only ever INSERTed here (append-only trigger guards the rest).
  const claimIdx = sql.indexOf('insert into public.idempotency_keys');
  const movementIdx = sql.indexOf('insert into public.stock_movements');
  assert(claimIdx !== -1, 'no idempotency claim present');
  assert(movementIdx !== -1 && claimIdx < movementIdx, 'claim does not precede the ledger write');
  assert(!/update\s+public\.stock_movements/i.test(sql), 'RPC attempts UPDATE on the ledger');
  assert(!/delete\s+from\s+public\.stock_movements/i.test(sql), 'RPC attempts DELETE on the ledger');

  // Item 2 — server-side pricing: price_lists registry is consulted and the
  // client is never the price source. Unit prices come from overrides/base.
  assert(sql.includes('public.price_list_item_overrides'), 'price-list override lookup missing');
  assert(sql.includes('public.product_prices'), 'base price lookup missing');
  assert(sql.includes('public.price_lists'), 'price-list registry lookup missing');
  assert(sql.includes('discount_percent'), 'list discount missing');

  // Item 2 — tax resolved server-side through the authoritative evaluator.
  assert(sql.includes('app_private.calculate_line_tax('), 'line tax evaluator not wired');
  assert(sql.includes('counter_sale_tax_mode_invalid'), 'tax mode validation missing');

  // Item 3 — oversell guard on live derived on-hand inside the same transaction,
  // concurrency-proofed AND deadlock-proofed. The SELECT-then-INSERT guard races:
  // two concurrent COUNTER_SALE transactions can read the same on-hand and both
  // insert, driving stock NEGATIVE (proven by the Elder's forced-2s-overlap
  // reproduction). The branch acquires transaction-scoped advisory locks on the
  // org+location+product key so a second transaction blocks until the first
  // commits. Inline per-line locking in CALLER order is itself a classic
  // deadlock (two multi-line sales sharing products in opposite order lock in
  // opposite sequence) — Codex's audit caught this, so the locks must be taken
  // in a canonical pre-pass over DISTINCT product_ids ASCENDING, before any line
  // is processed. Scoped to the COUNTER_SALE branch slice — the migration
  // header's doc comment also names derived_onhand.
  const branchBlock = sql.slice(
    sql.indexOf('-- COUNTER_SALE: Atomic invoice + payment + stock issue + settlement'),
    sql.indexOf('-- PAY_SUPPLIER'),
  );
  assert(branchBlock.includes('pg_advisory_xact_lock('), 'advisory lock missing');
  assert(
    branchBlock.includes('hashtext(target_org::text || v_location_id::text || v_pid::text)'),
    'advisory lock not keyed on org+location+product',
  );
  // Canonical order: distinct product_ids, sorted ascending, locked up front.
  const distinctLock = branchBlock.indexOf('select distinct (elem->>\'product_id\')::uuid as pid');
  assert(distinctLock !== -1, 'lock pre-pass does not iterate DISTINCT product_ids');
  const lockLoop = branchBlock.slice(distinctLock, branchBlock.indexOf('end loop;', distinctLock));
  assert(/order by pid asc/i.test(lockLoop), 'lock pre-pass is not sorted ascending by product_id');
  assert(/perform pg_advisory_xact_lock\(/.test(lockLoop), 'lock pre-pass does not acquire the advisory lock');
  // The pre-pass must come before the line loop, the derived on-hand read AND
  // the ledger write — not inline inside the per-line loop.
  const lockIdx = branchBlock.indexOf('pg_advisory_xact_lock(');
  const lineLoop = branchBlock.indexOf('for v_line in select elem from jsonb_array_elements(command->\'items\')');
  const onhandIdx = branchBlock.indexOf('public.stock_movements_derived_onhand(');
  const firstMoveInsert = branchBlock.indexOf("insert into public.stock_movements");
  assert(lineLoop !== -1, 'line loop not found in branch');
  assert(lockIdx !== -1 && lockIdx < lineLoop, 'advisory lock does not precede the line loop');
  assert(lockIdx < onhandIdx, 'advisory lock does not precede the derived on-hand read');
  assert(lockIdx < firstMoveInsert, 'advisory lock does not precede the ledger write');
  // No inline re-lock inside the line loop — the pre-pass already holds it.
  const afterLoop = branchBlock.slice(lineLoop);
  const inlineLock = afterLoop.indexOf('perform pg_advisory_xact_lock(');
  assert(inlineLock === -1, 'advisory lock is re-acquired inline inside the line loop');
  assert(branchBlock.includes('stock_line_insufficient_on_hand'), 'oversell error code missing');

  // Item 3 + 1 — one negative-quantity 'issue' movement per line, source-linked.
  assert(sql.includes("v_line_key := md5(command_key::text || ':' || v_line_no::text)::uuid"), 'per-line key missing');
  assert(sql.includes("movement_type, quantity"), 'movement column list incomplete');
  assert(sql.includes("'issue', -v_qty"), 'issue movement is not negative-quantity');
  assert(sql.includes("'COUNTER_SALE', v_doc_id"), 'source linkage to the invoice missing');

  // Item 1 + 2 — real document line rows, not a metadata blob.
  assert(sql.includes('insert into public.commercial_document_lines'), 'commercial_document_lines write missing');
  assert(sql.includes("v_line_rows"), 'line row accumulation missing');
  assert(sql.includes("'items', command->'items'"), 'document metadata still carries the raw items');

  // Item 1 — the invoice must be born 'settled', never updated later. The
  // commercial_documents_issued_immutable trigger (202608200003) rejects ANY
  // UPDATE/DELETE of an issued or settled document, even same-transaction, so
  // an issued→settled transition would make every counter sale fail. The
  // COUNTER_SALE branch must therefore create the fully-allocated 'settled'
  // invoice in its INSERT and contain NO update on commercial_documents
  // within the branch itself (RECEIVE/PAY_SUPPLIER legitimately update).
  assert(
    /v_amount, v_gst, v_amount, 0, 'settled'/.test(branchBlock),
    'invoice is not inserted born-settled with full allocation',
  );
  assert(
    !/update\s+public\.commercial_documents/i.test(branchBlock),
    'COUNTER_SALE branch attempts UPDATE on commercial_documents after INSERT',
  );
  assert(!/allocated_total = allocated_total \+/.test(branchBlock), 'incremental allocation update leaked into branch');

  // Item 6 — outbox/event seam populated for a future Hoadha projection.
  assert(sql.includes('app_private.append_outbox_event('), 'outbox seam missing');
  assert(sql.includes("'COUNTER_SALE'"), 'outbox event type missing');

  // Item 4 — claim-first spine + document sequences seeded for this branch
  // (M1 RECEIVE precedent) so document numbering can never silently fail.
  assert(sql.includes("on conflict (organisation_id, sequence_type) do nothing"), 'sequence seeding missing');

  // Scope discipline (item 10) — no new command type, no schema DDL beyond
  // re-defining the function.
  assert(sql.includes("event_name = 'COUNTER_SALE'"), 'COUNTER_SALE branch missing');
  assert(!/create\s+(table|view)/i.test(sql), 'new table or view leaked into the migration');
  assert(!/drop\s+table/i.test(sql), 'drop leaked into the migration');
});

Deno.test('M2 conformance: every branch outside COUNTER_SALE is byte-identical to 202609090050', async () => {
  const sql = await readMigration('202609190059_counter_sale_stock_issue.sql');
  const src = await readMigration('202609090050_serp314_customer_price_list_persistence.sql');

  // Extract both function bodies and the shared common tail (idempotency update,
  // audit event, return). The ONLY permitted diff is the COUNTER_SALE branch.
  const fn = (s: string): string => {
    const start = s.indexOf('create or replace function public.api_garage_command(');
    const end = s.indexOf('end\n$$;', start);
    return s.slice(start, end);
  };
  const ours = fn(sql);
  const base = fn(src);

  // The pre-COUNTER_SALE preamble must match exactly (it contains the claim-first
  // spine and every other branch verbatim).
  const oursBranch = ours.indexOf("-- COUNTER_SALE: Atomic invoice + payment + stock issue");
  const baseBranch = base.indexOf('-- COUNTER_SALE: Atomic invoice + payment + stock deduction');
  assert(oursBranch !== -1, 'new migration has no COUNTER_SALE branch header');
  assert(baseBranch !== -1, 'source migration lost its COUNTER_SALE branch header');
  assert(
    ours.slice(0, oursBranch) === base.slice(0, baseBranch),
    'function preamble drifted from 202609090050 — only the COUNTER_SALE branch may change',
  );

  // The post-branch remainder must match too.
  const oursRest = ours.indexOf('-- PAY_SUPPLIER: Payment against purchase order');
  const baseRest = base.indexOf('-- PAY_SUPPLIER: Payment against purchase order');
  assert(oursRest !== -1 && baseRest !== -1, 'PAY_SUPPLIER section lost');
  assert(
    ours.slice(oursRest) === base.slice(baseRest),
    'function remainder drifted from 202609090050 — only the COUNTER_SALE branch may change',
  );
});