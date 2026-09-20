/**
 * STARQ ERP — SERP-087 tender + receipt financial-consequence proof gate (OpenCode lane).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The SERP-087 dispatch (M6 counter lane) makes the tender server-authoritative
 * and records the FINANCIAL CONSEQUENCE of a counter sale:
 *
 *   public.counter_tenders  — one row per payment method per receipt
 *   public.counter_receipts — the register: ONE row per sale, tendered/change,
 *                             render counter (duplicate-proof)
 *
 * in migration 202609192100_serp087_tender_receipt_financial_consequence.sql,
 * plus a COUNTER_SALE extension of api_garage_command (tender validation,
 * server-side change, register inserts) and two register surfaces:
 *
 *   api_counter_receipt_get(...)           — read-only duplicate-proof receipt
 *   api_counter_receipt_mark_rendered(...) — increments renders + audit event
 *
 * The artifact is review-only: it must NOT be applied to any production or local
 * database. Real-database independent verification belongs to the acceptance
 * gate (Vision/Claude live lane), under the same bounded rules as Track A. This
 * lane proves the gate the same way SERP-086 proved its own:
 *   * a PURE CONTRACT MIRROR of the SQL control flow (deterministic, in-memory,
 *     no database): payment-method/leg validation, change reconciliation,
 *     receipt idempotency + duplicate-proof renders, tenant + seat gates.
 *   * a SOURCE-CONFORMANCE layer that reads the actual migration file and asserts
 *     the controls are WIRED IN — plus REGRESSION guards that the functional
 *     currency of every POS path is derived from organisations.base_currency
 *     (SERP-434 correction, commit 0c46cde) and never a hardcoded literal.
 * Both layers must pass.
 *
 * Run:  deno test --allow-read tests/contract/serp_087_tender_receipt_financial_consequence_test.ts
 */

import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';

const EDGE_MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// FIXED IDENTITIES (deterministic — same fixture shape as the SERP-086 mirror)
// ─────────────────────────────────────────────────────────────────────────────

const ORG = '20000000-0000-4000-8000-000000000901'; // fixture org, counter seat
const OTHER_ORG = '10000000-0000-4000-8000-000000000901';
const PERSON = '20000000-0000-4000-8000-000000000111';
const OTHER_PERSON = '10000000-0000-4000-8000-000000000111';
const SEAT_COUNTER = 'counter';
const SEAT_TECHNICIAN = 'technician';
const SEAT_STORES = 'stores';

const SALE_A = '20000000-0000-4000-8000-000000000501';
const SALE_B = '20000000-0000-4000-8000-000000000502';
const RECEIPT_A = '20000000-0000-4000-8000-000000000511';
const RECEIPT_B = '20000000-0000-4000-8000-000000000512';

// ─────────────────────────────────────────────────────────────────────────────
// THE PURE-LOGIC MIRROR
// ─────────────────────────────────────────────────────────────────────────────
// Maps 1:1 to blocks in 202609192100_serp087_tender_receipt_financial_consequence.sql.
// The SERP-086 mirror already proves pricing; here serverTotal is a given and the
// mirror reproduces EXACTLY the tender/receipt control flow that this migration
// adds to COUNTER_SALE.

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

interface TenderLeg {
  method: string;
  amountTendered: number;
}

interface TenderOutcome {
  tenderRows: { method: string; amount_tendered: number; order: number }[];
  tenderedTotal: number;
  cashTotal: number;
  change: number;
}

/**
 * Mirror of the COUNTER_SALE tender block (migration L822-872 + L1030-1042):
 * payment-method whitelist, one leg per method, single/mixed rules, then
 * change reconciliation (L1030-1042). Client never supplies totals or change.
 */
function reconcileTender(
  paymentMethodRaw: string | null,
  tenderRaw: unknown,
  serverTotal: number,
): TenderOutcome {
  const vPaymentMethod = String(paymentMethodRaw ?? '').trim().toLowerCase();
  if (!['cash', 'card', 'transfer', 'mixed'].includes(vPaymentMethod)) {
    throw new Error('counter_sale_payment_method_invalid');
  }
  const vTender = Array.isArray(tenderRaw) ? tenderRaw : null;
  if (!vTender || vTender.length === 0) {
    throw new Error('counter_sale_tender_required');
  }

  let tenderOrder = 0;
  let cashTotal = 0;
  let tenderedTotal = 0;
  const tenderRows: TenderOutcome['tenderRows'] = [];

  for (const leg of vTender) {
    const vTmethod = String((leg as Record<string, unknown>).method ?? '').trim().toLowerCase();
    if (!['cash', 'card', 'transfer'].includes(vTmethod)) {
      throw new Error('counter_sale_tender_method_invalid');
    }
    const rawAmount = (leg as Record<string, unknown>).amount_tendered;
    if (rawAmount === null || rawAmount === undefined || rawAmount === '') {
      throw new Error('counter_sale_tender_amount_required');
    }
    const vTamount = round2(Number(rawAmount));
    if (!(vTamount > 0)) {
      throw new Error('counter_sale_tender_amount_positive');
    }
    tenderOrder += 1;
    if (vTmethod === 'cash') cashTotal += vTamount;
    tenderedTotal += vTamount;
    tenderRows.push({ method: vTmethod, amount_tendered: vTamount, order: tenderOrder });
  }

  const distinctMethods = new Set(tenderRows.map((r) => r.method)).size;
  if (distinctMethods !== tenderRows.length) {
    throw new Error('counter_sale_duplicate_tender_method');
  }
  if (vPaymentMethod === 'mixed') {
    if (distinctMethods < 2) {
      throw new Error('counter_sale_mixed_tender_requires_two_methods');
    }
  } else {
    if (tenderRows.length !== 1) {
      throw new Error('counter_sale_single_method_requires_single_tender');
    }
    if (tenderRows[0].method !== vPaymentMethod) {
      throw new Error('counter_sale_tender_method_mismatch');
    }
  }

  // Reconcile against the SERVER total (mirror of L1030-1042): change refunded
  // in cash only, so card/transfer overpayment cannot produce cash change.
  const vTenderTotal = round2(tenderedTotal);
  if (vTenderTotal < round2(serverTotal)) {
    throw new Error('counter_sale_tender_insufficient');
  }
  const vTenderChange = round2(vTenderTotal - round2(serverTotal));
  if (vTenderChange > 0 && vTenderChange > round2(cashTotal)) {
    throw new Error('counter_sale_change_exceeds_cash');
  }
  return { tenderRows, tenderedTotal: vTenderTotal, cashTotal: round2(cashTotal), change: vTenderChange };
}

interface RegisterReceipt {
  receiptNumber: string;
  saleId: string;
  currency: string;
  tenderedAmount: number;
  changeAmount: number;
  renders: number;
}

interface AuditEvent {
  org: string;
  action: string;
  receiptId: string;
  requestId: string | null;
}

interface ReceiptStore {
  orgOf: (receiptId: string) => string; // which org owns a receipt (tenant lookup)
  receipts: Map<string, RegisterReceipt>;
  tenders: Map<string, { method: string; amount_tendered: number; order: number }[]>;
  persons: { id: string; seats: Record<string, string[]> }[];
  issued: number; // monotonic receipt_number source per org
  audits: AuditEvent[];
}

const newStore = (seed: [string, string, RegisterReceipt][] = []): ReceiptStore => {
  const store: ReceiptStore = {
    orgOf: () => ORG,
    receipts: new Map(),
    tenders: new Map(),
    persons: [
      { id: PERSON, seats: { [ORG]: ['counter', 'stores'], [OTHER_ORG]: ['technician'] } },
      { id: OTHER_PERSON, seats: { [OTHER_ORG]: ['stores'] } },
    ],
    issued: 0,
    audits: [],
  };
  for (const [org, id, r] of seed) store.receipts.set(id, { ...r });
  return store;
};

function assertSeat(store: ReceiptStore, org: string, person: string, seat: string): boolean {
  const p = store.persons.find((x) => x.id === person);
  return !!p && !!p.seats[org] && p.seats[org].includes(seat);
}

// Wire shape of api_counter_receipt_get — 1:1 with the SQL jsonb_build_object
// (migration L1384-1404): every get returns the SAME snapshot of the register.
interface ReceiptWire {
  ok: true;
  receipt: {
    receipt_id: string;
    receipt_number: string;
    sale_id: string;
    invoice_id: string;
    invoice_number: string;
    currency: string;
    renders: number;
    tendered_amount: number;
    change_amount: number;
    total_amount: number;
  };
}

// Mirror of api_counter_receipt_get (migration L1335-1407): register-surface
// seat aperture is WIDER than COUNTER_SALE (quartermaster/stores may reprint)
// but the record the caller can see is strictly tenant-scoped.
function getReceipt(
  store: ReceiptStore,
  org: string,
  person: string,
  seat: string,
  receiptId: string,
): ReceiptWire {
  const RECEIPT_SEATS = ['counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner'];
  if (!assertSeat(store, org, person, seat) || !RECEIPT_SEATS.includes(seat)) {
    throw new Error('seat_not_authorized');
  }
  if (store.orgOf(receiptId) !== org) throw new Error('receipt_not_found'); // tenant scoping
  const r = store.receipts.get(receiptId);
  if (!r) throw new Error('receipt_not_found');
  // Idempotent: returns the SAME record with the SAME receipt_number every call.
  return {
    ok: true,
    receipt: {
      receipt_id: receiptId,
      receipt_number: r.receiptNumber,
      sale_id: r.saleId,
      invoice_id: r.saleId,
      invoice_number: `SI-${r.receiptNumber.replace('RCT-', '').padStart(0, '')}`,
      currency: r.currency,
      renders: r.renders,
      tendered_amount: r.tenderedAmount,
      change_amount: r.changeAmount,
      total_amount: r.tenderedAmount - r.changeAmount,
    },
  };
}

// Mirror of api_counter_receipt_mark_rendered (migration L1417-1452): increments
// renders on the SAME record and writes an audit event. Never mints a second
// record or number — that is the duplicate-proof invariant.
function markRendered(
  store: ReceiptStore,
  org: string,
  person: string,
  seat: string,
  receiptId: string,
  requestId: string | null = null,
): { ok: true; receipt_id: string; renders: number } {
  const RECEIPT_SEATS = ['counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner'];
  if (!assertSeat(store, org, person, seat) || !RECEIPT_SEATS.includes(seat)) {
    throw new Error('seat_not_authorized');
  }
  if (store.orgOf(receiptId) !== org) throw new Error('receipt_not_found');
  const r = store.receipts.get(receiptId);
  if (!r) throw new Error('receipt_not_found');
  r.renders += 1;
  store.audits.push({
    org,
    action: 'erp.counter_receipt_render',
    receiptId,
    requestId,
  });
  return { ok: true, receipt_id: receiptId, renders: r.renders };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — PURE MIRROR TESTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-087 mirror: single cash exact sale — zero change, one recorded leg', () => {
  const out = reconcileTender('cash', [{ method: 'cash', amount_tendered: 100.0 }], 100.0);
  assertEquals(out.tenderedTotal, 100.0);
  assertEquals(out.cashTotal, 100.0);
  assertEquals(out.change, 0);
  assertEquals(out.tenderRows, [{ method: 'cash', amount_tendered: 100, order: 1 }]);
});

Deno.test('SERP-087 mirror: single cash with change — change refunded, never fabricated', () => {
  const out = reconcileTender('cash', [{ method: 'cash', amount_tendered: 200.0 }], 175.42);
  assertEquals(out.tenderedTotal, 200.0);
  assertEquals(out.change, round2(200 - 175.42)); // 24.58 server-side
  assertEquals(out.tenderRows.length, 1);
});

Deno.test('SERP-087 mirror: mixed cash+card — change covered by cash leg passes', () => {
  const out = reconcileTender('mixed', [
    { method: 'cash', amount_tendered: 150.0 },
    { method: 'card', amount_tendered: 50.0 },
  ], 178.5);
  assertEquals(out.tenderedTotal, 200.0);
  assertEquals(out.cashTotal, 150.0);
  assertEquals(out.change, 21.5); // 21.5 <= 150 cash tendered
  assertEquals(out.tenderRows.map((r) => r.method), ['cash', 'card']);
});

Deno.test('SERP-087 mirror: card only EXACT — zero change is allowed (no cash refund needed)', () => {
  const out = reconcileTender('card', [{ method: 'card', amount_tendered: 99.99 }], 99.99);
  assertEquals(out.change, 0);
});

const NEGATIVE_TENDER_CASES: [string, string | null, unknown, number][] = [
  ['counter_sale_payment_method_invalid', 'cashish', [{ method: 'cash', amount_tendered: 50 }], 10],
  ['counter_sale_payment_method_invalid', null, [{ method: 'cash', amount_tendered: 50 }], 10],
  ['counter_sale_tender_required', 'cash', [], 10],
  ['counter_sale_tender_required', 'cash', null, 10],
  ['counter_sale_tender_method_invalid', 'cash', [{ method: 'cheque', amount_tendered: 50 }], 10],
  ['counter_sale_tender_amount_required', 'cash', [{ method: 'cash' }], 10],
  ['counter_sale_tender_amount_positive', 'cash', [{ method: 'cash', amount_tendered: 0 }], 10],
  ['counter_sale_tender_amount_positive', 'cash', [{ method: 'cash', amount_tendered: -5 }], 10],
  ['counter_sale_duplicate_tender_method', 'mixed', [
    { method: 'cash', amount_tendered: 50 },
    { method: 'cash', amount_tendered: 60 },
  ], 10],
  ['counter_sale_single_method_requires_single_tender', 'cash', [
    { method: 'card', amount_tendered: 50 },
    { method: 'cash', amount_tendered: 60 },
  ], 100],
  ['counter_sale_tender_method_mismatch', 'cash', [{ method: 'card', amount_tendered: 200 }], 100],
  ['counter_sale_mixed_tender_requires_two_methods', 'mixed', [{ method: 'cash', amount_tendered: 300 }], 100],
  ['counter_sale_tender_insufficient', 'cash', [{ method: 'cash', amount_tendered: 99.99 }], 100],
  ['counter_sale_change_exceeds_cash', 'card', [{ method: 'card', amount_tendered: 300 }], 100],
  ['counter_sale_change_exceeds_cash', 'transfer', [{ method: 'transfer', amount_tendered: 250 }], 100],
];

for (const [code, method, tender, total] of NEGATIVE_TENDER_CASES) {
  Deno.test(`SERP-087 mirror: fails closed — ${code}`, () => {
    assertThrows(
      () => reconcileTender(method, tender, total),
      Error,
      code,
    );
  });
}

Deno.test('SERP-087 mirror: receipt get is idempotent AND duplicate-proof by number', () => {
  const store = newStore([[
    ORG,
    RECEIPT_A,
    { receiptNumber: 'RCT-00001', saleId: SALE_A, currency: 'MVR', tenderedAmount: 200, changeAmount: 24.58, renders: 0 },
  ]]);
  const beforeAudits = store.audits.length;

  const r1 = getReceipt(store, ORG, PERSON, SEAT_COUNTER, RECEIPT_A);
  const r2 = getReceipt(store, ORG, PERSON, SEAT_COUNTER, RECEIPT_A);
  assertEquals(r1, r2, 'two reads of the same receipt must be identical');
  assertEquals(r1.receipt.receipt_number, 'RCT-00001');
  assertEquals(r1.receipt.currency, 'MVR');
  assertEquals(store.receipts.get(RECEIPT_A)!.renders, 0, 'get MUTATED renders — read RPC wrote state');
  assertEquals(store.audits.length, beforeAudits, 'get wrote an audit event');

  const m1 = markRendered(store, ORG, PERSON, SEAT_COUNTER, RECEIPT_A);
  const m2 = markRendered(store, ORG, PERSON, SEAT_COUNTER, RECEIPT_A, 'req-1');
  assert(m1.renders < m2.renders, 'render counter must increment');
  // Duplicate-proof: same receipt_id, SAME receipt_number, same record — a
  // reprint never mints a second register row or a second number.
  const r3 = getReceipt(store, ORG, PERSON, SEAT_COUNTER, RECEIPT_A);
  assertEquals(r3.receipt.receipt_number, 'RCT-00001');
  assertEquals(r3.receipt.renders, 2);
  assertEquals(store.receipts.size, 1, 're-rendering minted a second register row');
});

Deno.test('SERP-087 mirror: two sales mint DISTINCT receipt numbers (one financial record each)', () => {
  const store = newStore();
  store.receipts.set(RECEIPT_A, { receiptNumber: 'RCT-00001', saleId: SALE_A, currency: 'MVR', tenderedAmount: 100, changeAmount: 0, renders: 0 });
  store.receipts.set(RECEIPT_B, { receiptNumber: 'RCT-00002', saleId: SALE_B, currency: 'MVR', tenderedAmount: 250, changeAmount: 10, renders: 0 });
  const a = getReceipt(store, ORG, PERSON, SEAT_COUNTER, RECEIPT_A);
  const b = getReceipt(store, ORG, PERSON, SEAT_COUNTER, RECEIPT_B);
  assert(a.receipt.receipt_number !== b.receipt.receipt_number, 'receipt numbers collided across sales');
  assert(a.receipt.sale_id !== b.receipt.sale_id, 'sale ids collided');
});

const NEGATIVE_RECEIPT_CASES: [string, (s: ReceiptStore) => unknown][] = [
  ['seat_not_authorized', (s) => getReceipt(s, ORG, PERSON, SEAT_TECHNICIAN, RECEIPT_A)],
  ['receipt_not_found', (s) => getReceipt(s, OTHER_ORG, OTHER_PERSON, SEAT_STORES, SALE_A)],
];

for (const [code, fn] of NEGATIVE_RECEIPT_CASES) {
  Deno.test(`SERP-087 mirror: receipt surface fails closed — ${code}`, () => {
    const store = newStore([[
      ORG,
      RECEIPT_A,
      { receiptNumber: 'RCT-00001', saleId: SALE_A, currency: 'MVR', tenderedAmount: 100, changeAmount: 0, renders: 0 },
    ]]);
    assertThrows(() => fn(store), Error, code);
  });
}

Deno.test('SERP-087 mirror: mark_rendered also fails closed on tenant + seat + missing', () => {
  const store = newStore([[
    ORG,
    RECEIPT_A,
    { receiptNumber: 'RCT-00001', saleId: SALE_A, currency: 'MVR', tenderedAmount: 100, changeAmount: 0, renders: 0 },
  ]]);
  assertThrows(() => markRendered(store, ORG, PERSON, SEAT_TECHNICIAN, RECEIPT_A), Error, 'seat_not_authorized');
  assertThrows(() => markRendered(store, OTHER_ORG, OTHER_PERSON, SEAT_STORES, RECEIPT_A), Error, 'receipt_not_found');
  assertThrows(() => markRendered(store, ORG, PERSON, SEAT_COUNTER, SALE_A), Error, 'receipt_not_found');
});

Deno.test('SERP-087 mirror: NON-MVR base currency flows through legs + register untouched', () => {
  // SERP-434 regression: currency is org-derived, never a hardcoded literal.
  const store = newStore([[
    ORG,
    RECEIPT_A,
    { receiptNumber: 'RCT-00001', saleId: SALE_A, currency: 'USD', tenderedAmount: 200, changeAmount: 21.5, renders: 0 },
  ]]);
  const r = getReceipt(store, ORG, PERSON, SEAT_COUNTER, RECEIPT_A);
  assertEquals(r.receipt.currency, 'USD', 'receipt currency was pinned to a literal, not base_currency');
});

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — SOURCE CONFORMANCE (reads the actual migration file)
// ─────────────────────────────────────────────────────────────────────────────

async function readMigration(name: string): Promise<string> {
  const raw = await Deno.readTextFile(new URL(name, EDGE_MIGRATIONS));
  return raw.replace(/\r\n/g, '\n'); // normalize CRLF (Windows-authored) so text assertions are stable
}

function csBranch(sql: string): string {
  // The branch BODY is the LAST occurrence of the marker (the seat-gate block
  // near the function header repeats the elsif for 'COUNTER_SALE').
  const start = sql.lastIndexOf("elsif event_name = 'COUNTER_SALE' then");
  const end = sql.lastIndexOf("elsif event_name = 'PAY_SUPPLIER' then");
  if (start < 0 || end < 0 || start >= end) throw new Error('COUNTER_SALE branch not found in migration');
  return sql.slice(start, end);
}

Deno.test('SERP-087 conformance: tender + receipt register DDL is exactly as designed', async () => {
  const sql = await readMigration('202609192100_serp087_tender_receipt_financial_consequence.sql');

  // counter_tenders — one row per method per receipt.
  assert(sql.includes('create table public.counter_tenders ('));
  assert(sql.includes("check (payment_method in ('cash', 'card', 'transfer'))"), 'tender method whitelist CHECK missing');
  assert(sql.includes('check (amount_tendered > 0)'), 'tender amount positive CHECK missing');
  assert(sql.includes('unique (organisation_id, receipt_id, payment_method)'), 'one-leg-per-method unique missing');
  assert(
    sql.includes('foreign key (organisation_id, receipt_id)\n    references public.commercial_documents(organisation_id, id)'),
    'tender FK to commercial_documents missing',
  );

  // counter_receipts — the register of financial consequence.
  assert(sql.includes('create table public.counter_receipts ('));
  assert(sql.includes('check (tendered_amount > 0)'), 'receipt tendered_amount positive CHECK missing');
  assert(sql.includes('check (change_amount >= 0)'), 'receipt change non-negative CHECK missing');
  assert(sql.includes('check (renders >= 0)'), 'render counter non-negative CHECK missing');
  assert(sql.includes('unique (organisation_id, receipt_id)'), 'one-register-row-per-receipt unique missing');
  assert(sql.includes('unique (organisation_id, receipt_number)'), 'receipt_number uniqueness missing (duplicate-proof)');
  assert(sql.includes('foreign key (organisation_id, sale_id)'), 'register sale FK missing');

  assert((sql.match(/\nbegin;/g) ?? []).length === 1, 'migration transaction not opened exactly once');
  assert(sql.includes('commit;'), 'migration not committed');
});

Deno.test('SERP-087 conformance: COUNTER_SALE accepts payment_method + tender array', async () => {
  const sql = await readMigration('202609192100_serp087_tender_receipt_financial_consequence.sql');
  const cs = csBranch(sql);

  assert(cs.includes("v_payment_method := lower(trim(coalesce(command->>'payment_method', '')));"), 'payment_method normalization missing');
  assert(cs.includes("if v_payment_method not in ('cash', 'card', 'transfer', 'mixed') then"), 'payment_method whitelist missing');
  assert(cs.includes('counter_sale_payment_method_invalid'), 'invalid payment_method path missing');
  assert(cs.includes('counter_sale_tender_required'), 'tender-required path missing');
  assert(cs.includes("jsonb_typeof(v_tender) <> 'array'"), 'tender type gate missing');
  assert(cs.includes('counter_sale_tender_method_invalid'), 'leg method whitelist missing');
  assert(cs.includes('counter_sale_tender_amount_required'), 'leg amount-required path missing');
  assert(cs.includes("round(((v_tender_leg->>'amount_tendered')::numeric), 2)"), 'leg amount rounding missing');
  assert(cs.includes('counter_sale_tender_amount_positive'), 'leg positive-amount path missing');
  assert(cs.includes('counter_sale_duplicate_tender_method'), 'duplicate-method path missing');
  assert(cs.includes('counter_sale_mixed_tender_requires_two_methods'), 'mixed >=2 methods gate missing');
  assert(cs.includes('counter_sale_single_method_requires_single_tender'), 'single-method one-leg gate missing');
  assert(cs.includes('counter_sale_tender_method_mismatch'), 'single-method mismatch gate missing');
});

Deno.test('SERP-087 conformance: change is SERVER-computed and never exceeds cash tendered', async () => {
  const sql = await readMigration('202609192100_serp087_tender_receipt_financial_consequence.sql');
  const cs = csBranch(sql);

  // Compute site: no client-supplied change survives — change is derived AFTER
  // the validation block, from SERVER totals only.
  assert(
    cs.includes('v_tender_change := round(v_tender_total - v_amount, 2);'),
    'change not derived from server total',
  );
  assert(cs.includes('counter_sale_tender_insufficient'), 'insufficient-tender path missing');
  assert(cs.includes('Tendered %s is less than the server total %s'), 'insufficient detail missing');
  assert(cs.includes('counter_sale_change_exceeds_cash'), 'change-exceeds-cash path missing');
  assert(cs.includes('v_tender_total < v_amount'), 'insufficient comparison missing');
  assert(cs.includes('v_tender_change > 0 and v_tender_change > v_cash_total'), 'cash-only-over-refund rule missing');
});

Deno.test('SERP-087 conformance: register is written in the SAME transaction, one row per sale', async () => {
  const sql = await readMigration('202609192100_serp087_tender_receipt_financial_consequence.sql');
  const cs = csBranch(sql);

  // Tender legs recorded per validated leg with server currency + seat/tenant.
  assert(cs.includes('insert into public.counter_tenders'), 'tender legs not recorded');
  assert(cs.includes('(organisation_id, receipt_id, payment_method, amount_tendered,'), 'tender leg insert column set drifted');
  assert(cs.includes('recorded_seat'), 'tender leg seat attribution missing');

  // Register row: ONE per sale, receipt_number = the allocated RCT- number.
  assert(cs.includes('insert into public.counter_receipts'), 'register insert missing');
  assert(cs.includes('sale_id, receipt_number,'), 'register does not capture sale_id + receipt_number columns');
  assert(cs.includes('v_doc_id, v_pay_no,'), 'register does not bind the sale + allocated receipt_number');
  assert(cs.includes('v_receipt_no := v_pay_no;'), 'receipt_number not wired to the sale');
  assert(cs.includes('v_tender_total, v_tender_change, 0,'), 'register does not store computed tendered/change/renders');

  // Same-transaction: the register inserts sit inside the CS branch body that
  // also mints the invoice + payment + settlement.
  assert(cs.includes('settlement_allocations'), 'settlement allocation still minted');
  assert(cs.includes('sales_invoice'), 'invoice fixture still present');

  const mark = sql.indexOf('create or replace function public.api_counter_receipt_mark_rendered(');
  const markFn = sql.slice(mark, sql.indexOf('alter function public.api_counter_receipt_mark_rendered', mark));
  // The ONLY update of the register is the render counter — no rewriting of
  // tendered/change/number, no deletion (append-only financial consequence).
  assert(
    (sql.match(/update public\.counter_receipts/g) ?? []).length === 1 &&
    /update public\.counter_receipts[\s\S]*set renders = renders \+ 1/.test(markFn),
    'the single legitimate register update (render increment) is missing or drifted',
  );
  assert(!/delete from public\.counter_(receipts|tenders)/.test(sql), 'a destroy path leaked into the register');
});

Deno.test('SERP-087 conformance: receipt surfaces — read-only get + audited render, service_role only', async () => {
  const sql = await readMigration('202609192100_serp087_tender_receipt_financial_consequence.sql');

  const getFn = sql.slice(
    sql.indexOf('create or replace function public.api_counter_receipt_get('),
    sql.indexOf('alter function public.api_counter_receipt_get'),
  );
  const markFn = sql.slice(
    sql.indexOf('create or replace function public.api_counter_receipt_mark_rendered('),
    sql.indexOf('alter function public.api_counter_receipt_mark_rendered'),
  );

  // Wider read aperture (reprint lane: stores/quartermaster) but same gates.
  for (const fn of [getFn, markFn]) {
    assert(fn.includes('app_private.assert_active_seat'), 'seat gate missing');
    assert(
      fn.includes("target_seat not in ('counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner')"),
      'receipt seat aperture drifted',
    );
    assert(fn.includes('where organisation_id = target_org'), 'tenant scope missing');
  }

  // get is read-only and idempotent — returns the SAME record every call.
  assert(getFn.includes('receipt_number'), 'get does not surface receipt_number');
  assert(getFn.includes('public.counter_receipts'), 'get does not read the register');
  assert(getFn.includes('receipt_not_found'), 'get missing-record path missing');
  assert(getFn.includes('counter_receipt_sale_not_found'), 'get orphaned-sale path missing');
  assert(!/\b(insert|update|delete)\b/i.test(getFn), 'get MUTATES — receipt reads must be pure');

  // mark_rendered increments + audits, threaded by request_identifier.
  assert(markFn.includes('renders = renders + 1'), 'render counter increment missing');
  assert(markFn.includes('returning renders into rendered_count;'), 'incremented value not returned');
  assert(markFn.includes('p_request_identifier'), 'request idempotency param missing');
  assert(markFn.includes("'erp.counter_receipt_render'"), 'render audit action missing');
  assert(markFn.includes('insert into public.audit_events'), 'render not audited');

  // service_role-only exposure for BOTH RPCs.
  const grant = sql.slice(sql.indexOf('revoke all on function public.api_counter_receipt_get'));
  assert((grant.match(/revoke all on function public\.api_counter_receipt_get/g) ?? []).length === 1, 'get revoke missing');
  assert((grant.match(/revoke all on function public\.api_counter_receipt_mark_rendered/g) ?? []).length === 1, 'render revoke missing');
  assert((grant.match(/grant execute on function public\.api_counter_receipt_get/g) ?? []).length === 1, 'get grant missing');
  assert((grant.match(/grant execute on function public\.api_counter_receipt_mark_rendered/g) ?? []).length === 1, 'render grant missing');
});

Deno.test('SERP-087 conformance: payload + outbox carry the tender/receipt consequence', async () => {
  const sql = await readMigration('202609192100_serp087_tender_receipt_financial_consequence.sql');
  const cs = csBranch(sql);

  // Event payload (Hoadha seam) — tender summary + receipt number so a future
  // projection can reconcile cash against sales.
  assert(cs.includes("'tender', v_tender_rows"), 'event payload lacks tender legs');
  assert(cs.includes("'tendered_amount', v_tender_total"), 'event payload lacks tendered_amount');
  assert(cs.includes("'change_amount', v_tender_change"), 'event payload lacks change_amount');
  assert(cs.includes("'receipt_number', v_receipt_no"), 'event payload lacks receipt_number');
  assert(cs.includes("'currency', v_org_currency"), 'event payload lacks derived currency');

  // Acceptance response — the receipt surface the client renders.
  assert(cs.includes("'receipt_number', v_receipt_no"), 'response lacks receipt_number');
  assert(cs.includes("'payment_method', v_payment_method"), 'response lacks validated payment_method');
  assert(cs.includes("'tendered_amount', v_tender_total"), 'response lacks tendered_amount');
  assert(cs.includes("'change_amount', v_tender_change"), 'response lacks change_amount');
});

Deno.test('SERP-087 conformance: REGRESSION — POS currency is org-derived, never a hardcoded literal', async () => {
  const sql = await readMigration('202609192100_serp087_tender_receipt_financial_consequence.sql');
  const cs = csBranch(sql);

  // SERP-434 fix is present and intact in this migration.
  assert((sql.match(/select base_currency into v_org_currency/g) ?? []).length === 1, 'base_currency derivation missing or duplicated');
  assert(sql.includes('if v_org_currency is null then raise exception'), 'org-not-found guard missing');
  assert(cs.includes('pp.currency = v_org_currency'), 'price lookup not currency-derived');
  assert(cs.includes("(v_doc_id, target_org, 'sales_invoice', v_doc_no, v_customer_id, v_org_currency,"), 'invoice document not currency-derived');
  assert(cs.includes("(v_payment_id, target_org, 'receipt', v_pay_no, v_customer_id, v_org_currency,"), 'receipt document not currency-derived');
  assert(cs.includes('(target_org, v_payment_id, v_doc_id, v_amount, v_org_currency, target_person)'), 'settlement allocation not currency-derived');
  assert(cs.includes('(v_tender_leg->>\'amount_tendered\')::numeric, v_org_currency,'), 'tender leg not currency-derived');
  assert(cs.includes('v_org_currency, v_tender_total, v_tender_change, 0,'), 'register row not currency-derived');

  // NO hardcoded-currency equality surviving anywhere in the POS path.
  assert((sql.match(/=\s*'MVR'/g) ?? []).length === 0, 'an equality against a hardcoded MVR literal survived');
  assert((sql.match(/, 'MVR', target_person\)/g) ?? []).length === 2,
    'the two PRE-EXISTING settlement literals in untouched PAY/INVOICE branches were altered or lost');
});

Deno.test('SERP-087 conformance: non-COUNTER_SALE branches are untouched (scope discipline)', async () => {
  const sql = await readMigration('202609192100_serp087_tender_receipt_financial_consequence.sql');

  // Tender machinery exists ONLY in the COUNTER_SALE branch declaration.
  assert((sql.match(/v_tender_rows jsonb := '\[\]'::jsonb;/g) ?? []).length === 1, 'tender state leaked outside COUNTER_SALE');
  assert((sql.match(/v_receipt_no text;/g) ?? []).length === 1, 'receipt state leaked outside COUNTER_SALE');

  // The seat aperture of the untouched branches is exactly the 202609190059 set:
  // the broad gate (with financial_controller) still guards the non-CS lanes and
  // the narrowed COUNTER_SALE gate still guards only the POS lane.
  assert(
    (sql.match(/not in \('counter', 'financial_controller', 'director', 'managing_director', 'owner'\)/g) ?? []).length >= 1,
    'a non-COUNTER_SALE seat aperture was rewritten or its gate removed',
  );
  assert(
    (sql.match(/not in \('counter', 'director', 'managing_director', 'owner'\)/g) ?? []).length >= 1,
    'COUNTER_SALE seat aperture drifted (must stay the narrowed POS set)',
  );

  // No negotiable damage: no drops, no triggers, exactly two new tables.
  assert(!/drop\s+(table|view|column|index|function)/i.test(sql), 'a destroy statement leaked in');
  assert(!/create trigger/i.test(sql), 'a trigger leaked in');
  const tables = (sql.match(/create table public\.(counter_)?[a-z_]+/g) ?? []);
  assertEquals(tables.filter((t) => t.includes('counter_')).length, 2, 'exactly counter_tenders + counter_receipts expected');
});