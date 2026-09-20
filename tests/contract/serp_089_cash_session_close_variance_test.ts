/**
 * STARQ ERP — SERP-089 cash-session close and variance proof gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The SERP-089 dispatch (M6 counter lane) records the till-close / cash-session
 * consequence of counter operations:
 *
 *   public.counter_cash_sessions — the register of cash sessions:
 *                                  expected_cash, counted_cash, variance_amount,
 *                                  notes, operator, close timestamp (auditable)
 *
 * in migration 202609192200_serp089_cash_session_close_variance.sql,
 * plus four session surfaces:
 *
 *   api_counter_session_open(...)    — opens a session with opening float
 *   api_counter_session_current(...) — reads active session / live sales summary
 *   api_counter_session_close(...)   — server-authoritative till close & variance
 *   api_counter_session_get(...)     — read-only session retrieval
 *
 * FOUNDER RULING (Room seq 6186):
 *   NO automatic Cash Over/Short journal unless an already-proven accounting path
 *   safely supports it. Do not broaden scope. Self-contained register write.
 *
 * RUN:
 *   deno test --allow-read tests/contract/serp_089_cash_session_close_variance_test.ts
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
const OTHER_PERSON = '10000000-0000-4000-8000-000000000111';
const LOCATION = '20000000-0000-4000-8000-000000000301';
const OTHER_LOCATION = '10000000-0000-4000-8000-000000000301';
const SEAT_COUNTER = 'counter';
const SEAT_TECHNICIAN = 'technician';
const SEAT_STORES = 'stores';
const SEAT_DIRECTOR = 'director';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE CONTRACT MIRROR OF THE TILL CLOSE CONTROL FLOW
// ─────────────────────────────────────────────────────────────────────────────

interface SaleReceipt {
  receiptId: string;
  saleId: string;
  locationId: string;
  issuedAt: number;
  cashTendered: number;
  changeRefunded: number;
  cardTendered: number;
  transferTendered: number;
}

interface CashSessionRecord {
  id: string;
  orgId: string;
  locationId: string;
  sessionNumber: string;
  currency: string;
  status: 'open' | 'closed';
  openedAt: number;
  openedBy: string;
  openedSeat: string;
  closedAt?: number;
  closedBy?: string;
  closedSeat?: string;
  openingFloat: number;
  cashSalesAmount: number;
  cardSalesAmount: number;
  transferSalesAmount: number;
  totalSalesAmount: number;
  expectedCash: number;
  countedCash?: number;
  varianceAmount?: number;
  notes?: string;
  transactionCount: number;
  idempotencyKey?: string;
}

class TillSessionStore {
  private sessions: CashSessionRecord[] = [];
  private sales: SaleReceipt[] = [];
  private sequence = 1;

  addSale(sale: SaleReceipt): void {
    this.sales.push(sale);
  }

  openSession(
    orgId: string,
    personId: string,
    seat: string,
    locationId: string,
    openingFloat: number,
    idempotencyKey?: string,
    currency = 'MVR',
  ): CashSessionRecord {
    if (!['counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner'].includes(seat)) {
      throw new Error('seat_not_authorized');
    }
    if (locationId === OTHER_LOCATION) {
      throw new Error('location_not_found');
    }
    if (openingFloat < 0) {
      throw new Error('counter_session_float_negative');
    }
    if (idempotencyKey) {
      const existing = this.sessions.find((s) => s.orgId === orgId && s.idempotencyKey === idempotencyKey);
      if (existing) return existing;
    }
    const alreadyOpen = this.sessions.find(
      (s) => s.orgId === orgId && s.locationId === locationId && s.status === 'open',
    );
    if (alreadyOpen) {
      throw new Error('counter_session_already_open');
    }

    const session: CashSessionRecord = {
      id: crypto.randomUUID(),
      orgId,
      locationId,
      sessionNumber: `CS-${String(this.sequence++).padStart(5, '0')}`,
      currency,
      status: 'open',
      openedAt: Date.now(),
      openedBy: personId,
      openedSeat: seat,
      openingFloat: round2(openingFloat),
      cashSalesAmount: 0,
      cardSalesAmount: 0,
      transferSalesAmount: 0,
      totalSalesAmount: 0,
      expectedCash: round2(openingFloat),
      transactionCount: 0,
      idempotencyKey,
    };
    this.sessions.push(session);
    return session;
  }

  getCurrentSummary(orgId: string, seat: string, locationId: string): {
    hasOpenSession: boolean;
    expectedCash: number;
    cashSales: number;
    cardSales: number;
    transferSales: number;
    totalSales: number;
    txCount: number;
  } {
    if (!['counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner'].includes(seat)) {
      throw new Error('seat_not_authorized');
    }
    if (locationId === OTHER_LOCATION) {
      throw new Error('location_not_found');
    }

    const open = this.sessions.find((s) => s.orgId === orgId && s.locationId === locationId && s.status === 'open');
    const windowStart = open ? open.openedAt : 0;
    const openingFloat = open ? open.openingFloat : 0;

    const relevantSales = this.sales.filter((s) => s.locationId === locationId && s.issuedAt >= windowStart);

    let cashSales = 0;
    let cardSales = 0;
    let transferSales = 0;
    let totalSales = 0;

    for (const s of relevantSales) {
      const netCash = s.cashTendered - s.changeRefunded;
      cashSales += netCash;
      cardSales += s.cardTendered;
      transferSales += s.transferTendered;
      totalSales += netCash + s.cardTendered + s.transferTendered;
    }

    cashSales = round2(cashSales);
    cardSales = round2(cardSales);
    transferSales = round2(transferSales);
    totalSales = round2(totalSales);
    const expectedCash = round2(openingFloat + cashSales);

    return {
      hasOpenSession: !!open,
      expectedCash,
      cashSales,
      cardSales,
      transferSales,
      totalSales,
      txCount: relevantSales.length,
    };
  }

  closeSession(
    orgId: string,
    personId: string,
    seat: string,
    locationId: string,
    countedCash: number,
    notes?: string,
    idempotencyKey?: string,
    currency = 'MVR',
    fallbackFloat = 0,
  ): CashSessionRecord {
    if (!['counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner'].includes(seat)) {
      throw new Error('seat_not_authorized');
    }
    if (locationId === OTHER_LOCATION) {
      throw new Error('location_not_found');
    }
    if (countedCash === null || countedCash === undefined || countedCash < 0 || isNaN(countedCash)) {
      throw new Error('counter_session_counted_cash_invalid');
    }

    // Replay guard
    if (idempotencyKey) {
      const existing = this.sessions.find((s) => s.orgId === orgId && s.idempotencyKey === idempotencyKey);
      if (existing && existing.status === 'closed') return existing;
    }

    const session = this.sessions.find((s) => s.orgId === orgId && s.locationId === locationId && s.status === 'open');
    if (!session) {
      throw new Error('no_open_session');
    }
    const windowStart = session.openedAt;
    const openingFloat = session.openingFloat;

    const relevantSales = this.sales.filter((s) => s.locationId === locationId && s.issuedAt >= windowStart);

    let cashSales = 0;
    let cardSales = 0;
    let transferSales = 0;
    let totalSales = 0;

    for (const s of relevantSales) {
      const netCash = s.cashTendered - s.changeRefunded;
      cashSales += netCash;
      cardSales += s.cardTendered;
      transferSales += s.transferTendered;
      totalSales += netCash + s.cardTendered + s.transferTendered;
    }

    cashSales = round2(cashSales);
    cardSales = round2(cardSales);
    transferSales = round2(transferSales);
    totalSales = round2(totalSales);

    const expectedCash = round2(openingFloat + cashSales);
    const counted = round2(countedCash);
    const variance = round2(counted - expectedCash);

    session.status = 'closed';
    session.closedAt = Date.now();
    session.closedBy = personId;
    session.closedSeat = seat;
    session.cashSalesAmount = cashSales;
    session.cardSalesAmount = cardSales;
    session.transferSalesAmount = transferSales;
    session.totalSalesAmount = totalSales;
    session.expectedCash = expectedCash;
    session.countedCash = counted;
    session.varianceAmount = variance;
    session.notes = notes?.trim() || undefined;
    session.transactionCount = relevantSales.length;
    session.idempotencyKey = idempotencyKey;

    return session;
  }

  getSession(orgId: string, seat: string, sessionId: string): CashSessionRecord {
    if (!['counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner'].includes(seat)) {
      throw new Error('seat_not_authorized');
    }
    const s = this.sessions.find((x) => x.orgId === orgId && x.id === sessionId);
    if (!s) throw new Error('counter_session_not_found');
    return s;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PURE LOGIC MIRROR TESTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-089 mirror: exact balanced till close (zero variance)', () => {
  const store = new TillSessionStore();
  const opened = store.openSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 500);
  assertEquals(opened.status, 'open');
  assertEquals(opened.openingFloat, 500);

  // Add a cash sale: 100 tendered, 0 change -> net cash +100
  store.addSale({
    receiptId: crypto.randomUUID(),
    saleId: crypto.randomUUID(),
    locationId: LOCATION,
    issuedAt: Date.now(),
    cashTendered: 100,
    changeRefunded: 0,
    cardTendered: 0,
    transferTendered: 0,
  });

  const closed = store.closeSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 600, 'Shift 1 balanced close');
  assertEquals(closed.status, 'closed');
  assertEquals(closed.openingFloat, 500);
  assertEquals(closed.cashSalesAmount, 100);
  assertEquals(closed.expectedCash, 600);
  assertEquals(closed.countedCash, 600);
  assertEquals(closed.varianceAmount, 0);
  assertEquals(closed.transactionCount, 1);
  assertEquals(closed.notes, 'Shift 1 balanced close');
});

Deno.test('SERP-089 mirror: shortage close produces negative variance', () => {
  const store = new TillSessionStore();
  store.openSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 500);

  // Add cash sale with change: 100 cash tendered, 75 change refunded -> net cash +25
  store.addSale({
    receiptId: crypto.randomUUID(),
    saleId: crypto.randomUUID(),
    locationId: LOCATION,
    issuedAt: Date.now(),
    cashTendered: 100,
    changeRefunded: 75,
    cardTendered: 0,
    transferTendered: 0,
  });

  // Expected cash: 500 + 25 = 525. Counted cash: 520 -> variance -5.00
  const closed = store.closeSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 520, 'Small shortage');
  assertEquals(closed.expectedCash, 525);
  assertEquals(closed.countedCash, 520);
  assertEquals(closed.varianceAmount, -5);
  assertEquals(closed.notes, 'Small shortage');
});

Deno.test('SERP-089 mirror: overage close produces positive variance', () => {
  const store = new TillSessionStore();
  store.openSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 300);

  // Expected: 300. Counted: 310 -> variance +10.00
  const closed = store.closeSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 310, 'Overage discovered');
  assertEquals(closed.expectedCash, 300);
  assertEquals(closed.countedCash, 310);
  assertEquals(closed.varianceAmount, 10);
});

Deno.test('SERP-089 mirror: card and transfer sales do NOT inflate expected cash', () => {
  const store = new TillSessionStore();
  store.openSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 200);

  // Card sale: 150 card, 0 cash
  store.addSale({
    receiptId: crypto.randomUUID(),
    saleId: crypto.randomUUID(),
    locationId: LOCATION,
    issuedAt: Date.now(),
    cashTendered: 0,
    changeRefunded: 0,
    cardTendered: 150,
    transferTendered: 0,
  });

  // Transfer sale: 75 transfer, 0 cash
  store.addSale({
    receiptId: crypto.randomUUID(),
    saleId: crypto.randomUUID(),
    locationId: LOCATION,
    issuedAt: Date.now(),
    cashTendered: 0,
    changeRefunded: 0,
    cardTendered: 0,
    transferTendered: 75,
  });

  // Expected cash must remain 200 (cards/transfers go to bank, not cash drawer)
  const summary = store.getCurrentSummary(ORG, SEAT_COUNTER, LOCATION);
  assertEquals(summary.cashSales, 0);
  assertEquals(summary.cardSales, 150);
  assertEquals(summary.transferSales, 75);
  assertEquals(summary.totalSales, 225);
  assertEquals(summary.expectedCash, 200);

  const closed = store.closeSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 200);
  assertEquals(closed.expectedCash, 200);
  assertEquals(closed.cardSalesAmount, 150);
  assertEquals(closed.transferSalesAmount, 75);
  assertEquals(closed.totalSalesAmount, 225);
  assertEquals(closed.varianceAmount, 0);
});

Deno.test('SERP-089 mirror: close replay returns stored record idempotently without duplicate', () => {
  const store = new TillSessionStore();
  const key = crypto.randomUUID();
  store.openSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 400);

  const first = store.closeSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 400, 'Exact', key);
  const second = store.closeSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 400, 'Exact', key);

  assertEquals(first.id, second.id);
  assertEquals(first.sessionNumber, second.sessionNumber);
  assertEquals(first.closedAt, second.closedAt);
});

Deno.test('SERP-089 mirror: non-MVR base currency flows into session register', () => {
  const store = new TillSessionStore();
  const opened = store.openSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 100, undefined, 'USD');
  assertEquals(opened.currency, 'USD');

  const closed = store.closeSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 100, undefined, undefined, 'USD');
  assertEquals(closed.currency, 'USD');
});

Deno.test('SERP-089 mirror: fails closed on unauthorized seat (technician)', () => {
  const store = new TillSessionStore();
  assertThrows(
    () => store.openSession(ORG, PERSON, SEAT_TECHNICIAN, LOCATION, 100),
    Error,
    'seat_not_authorized',
  );
  assertThrows(
    () => store.closeSession(ORG, PERSON, SEAT_TECHNICIAN, LOCATION, 100),
    Error,
    'seat_not_authorized',
  );
  assertThrows(
    () => store.getCurrentSummary(ORG, SEAT_TECHNICIAN, LOCATION),
    Error,
    'seat_not_authorized',
  );
});

Deno.test('SERP-089 mirror: fails closed on negative counted cash', () => {
  const store = new TillSessionStore();
  store.openSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 100);
  assertThrows(
    () => store.closeSession(ORG, PERSON, SEAT_COUNTER, LOCATION, -50),
    Error,
    'counter_session_counted_cash_invalid',
  );
});

Deno.test('SERP-089 mirror: fails closed on negative opening float', () => {
  const store = new TillSessionStore();
  assertThrows(
    () => store.openSession(ORG, PERSON, SEAT_COUNTER, LOCATION, -100),
    Error,
    'counter_session_float_negative',
  );
});

Deno.test('SERP-089 mirror: fails closed on cross-tenant location read', () => {
  const store = new TillSessionStore();
  assertThrows(
    () => store.openSession(ORG, PERSON, SEAT_COUNTER, OTHER_LOCATION, 100),
    Error,
    'location_not_found',
  );
  assertThrows(
    () => store.closeSession(ORG, PERSON, SEAT_COUNTER, OTHER_LOCATION, 100),
    Error,
    'location_not_found',
  );
});

Deno.test('SERP-089 mirror: rejects double-open when session already active at location', () => {
  const store = new TillSessionStore();
  store.openSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 100);
  assertThrows(
    () => store.openSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 200),
    Error,
    'counter_session_already_open',
  );
});

Deno.test('SERP-089 mirror: fails closed with no_open_session when closing without an active open session', () => {
  const store = new TillSessionStore();
  assertThrows(
    () => store.closeSession(ORG, PERSON, SEAT_COUNTER, LOCATION, 100),
    Error,
    'no_open_session',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SOURCE CONFORMANCE TESTS (Migration & API text analysis)
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-089 conformance: migration 202609192200 defines counter_cash_sessions table with constraints', async () => {
  const sql = await Deno.readTextFile(new URL('202609192200_serp089_cash_session_close_variance.sql', EDGE_MIGRATIONS));

  assert(sql.includes('create table if not exists public.counter_cash_sessions'), 'Must create counter_cash_sessions table');
  assert(sql.includes('organisation_id uuid not null references public.organisations(id)'), 'Org FK missing');
  assert(sql.includes('session_number text not null'), 'session_number missing');
  assert(sql.includes('currency character(3) not null'), 'currency character(3) missing');
  assert(sql.includes('status in (\'open\', \'closed\')'), 'status constraint missing');
  assert(sql.includes('opening_float numeric(20, 6)'), 'opening_float missing');
  assert(sql.includes('cash_sales_amount numeric(20, 6)'), 'cash_sales_amount missing');
  assert(sql.includes('card_sales_amount numeric(20, 6)'), 'card_sales_amount missing');
  assert(sql.includes('transfer_sales_amount numeric(20, 6)'), 'transfer_sales_amount missing');
  assert(sql.includes('total_sales_amount numeric(20, 6)'), 'total_sales_amount missing');
  assert(sql.includes('expected_cash numeric(20, 6)'), 'expected_cash missing');
  assert(sql.includes('counted_cash numeric(20, 6)'), 'counted_cash missing');
  assert(sql.includes('variance_amount numeric(20, 6)'), 'variance_amount missing');
  assert(sql.includes('unique (organisation_id, id)'), 'Compound tenant unique missing');
  assert(sql.includes('unique (organisation_id, session_number)'), 'Unique session_number per org missing');
});

Deno.test('SERP-089 conformance: migration defines RPCs with seat gate and service_role permissions', async () => {
  const sql = await Deno.readTextFile(new URL('202609192200_serp089_cash_session_close_variance.sql', EDGE_MIGRATIONS));

  assert(sql.includes('create or replace function public.api_counter_session_open'), 'api_counter_session_open missing');
  assert(sql.includes('create or replace function public.api_counter_session_current'), 'api_counter_session_current missing');
  assert(sql.includes('create or replace function public.api_counter_session_close'), 'api_counter_session_close missing');
  assert(sql.includes('create or replace function public.api_counter_session_get'), 'api_counter_session_get missing');

  // Permissions
  assert(sql.includes('grant execute on function public.api_counter_session_close'), 'api_counter_session_close not granted to service_role');
  assert(sql.includes('revoke all on function public.api_counter_session_close'), 'api_counter_session_close not revoked from public');

  // Seat aperture
  assert(sql.includes('\'counter\', \'quartermaster\', \'stores\', \'director\', \'managing_director\', \'owner\''), 'Seat aperture missing or incomplete');
});

Deno.test('SERP-089 conformance: audit event and outbox event emitted on till close', async () => {
  const sql = await Deno.readTextFile(new URL('202609192200_serp089_cash_session_close_variance.sql', EDGE_MIGRATIONS));

  assert(sql.includes('\'erp.counter_session_close\''), 'audit action erp.counter_session_close missing');
  assert(sql.includes('COUNTER_SESSION_CLOSE'), 'outbox event COUNTER_SESSION_CLOSE missing');
});

Deno.test('SERP-089 conformance: REGRESSION — currency is org-derived from organisations.base_currency', async () => {
  const sql = await Deno.readTextFile(new URL('202609192200_serp089_cash_session_close_variance.sql', EDGE_MIGRATIONS));

  assert(sql.includes('select base_currency into v_org_currency'), 'Must derive functional currency from organisations.base_currency');
  assert(sql.includes('v_org_currency character(3);'), 'v_org_currency declaration missing');
  // No hardcoded 'MVR' in logic (only document sequence prefix 'CS-' or default parameters)
  assert(!sql.includes("= 'MVR'"), 'No hardcoded MVR equality check in session logic');
});

Deno.test('SERP-089 conformance: starq-api wires session current, open, close, and get routes', async () => {
  const apiCode = await Deno.readTextFile(STARQ_API_PATH);

  assert(apiCode.includes('/api/ops/counter/session/current'), 'Endpoint GET /api/ops/counter/session/current missing in starq-api');
  assert(apiCode.includes('/api/ops/counter/session/open'), 'Endpoint POST /api/ops/counter/session/open missing in starq-api');
  assert(apiCode.includes('/api/ops/counter/session/close'), 'Endpoint POST /api/ops/counter/session/close missing in starq-api');
  assert(apiCode.includes('/api/ops/counter/session'), 'Endpoint GET /api/ops/counter/session missing in starq-api');
  assert(apiCode.includes('api_counter_session_close'), 'RPC api_counter_session_close not called in starq-api');
});

Deno.test('SERP-089 conformance: stock_movements columns use source_type and source_id, not commercial_document_id', async () => {
  const sql = await Deno.readTextFile(new URL('202609192200_serp089_cash_session_close_variance.sql', EDGE_MIGRATIONS));

  assert(!sql.includes('commercial_document_id'), 'stock_movements has no commercial_document_id column');
  assert(sql.includes("sm.source_type = 'COUNTER_SALE'"), 'Must filter stock_movements by source_type = COUNTER_SALE');
  assert(sql.includes("sm.source_id = cr.sale_id"), 'Must filter stock_movements by source_id = cr.sale_id');
});

Deno.test('SERP-089 conformance: api_counter_session_close raises no_open_session guard and has no implicit open insert', async () => {
  const sql = await Deno.readTextFile(new URL('202609192200_serp089_cash_session_close_variance.sql', EDGE_MIGRATIONS));

  assert(sql.includes("raise exception 'no_open_session'"), 'Must guard against closing when no open session exists');
  const closeRpcBody = sql.split('create or replace function public.api_counter_session_close')[1]?.split('create or replace function public.api_counter_session_get')[0] ?? '';
  assert(!closeRpcBody.includes('insert into public.counter_cash_sessions'), 'api_counter_session_close must not fabricate sessions via insert');
});
