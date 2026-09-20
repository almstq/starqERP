/**
 * STARQ ERP — SERP-090 Retry & Negative-Authorization Resilience Proof Gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * SERP-090 delivers the final resilience and negative-authorization guardrails
 * for the Counter POS epic (SERP-085, 086, 087, 088, 089, 438, 090):
 *
 *   1. Strictly Online Server-Authoritative Architecture:
 *      Counter operations require an active, authenticated connection. Speculative
 *      offline transactional selling and offline ledger creation are strictly prohibited.
 *
 *   2. Idempotent Command Replay & Conflict Rejection:
 *      Replaying a command with identical idempotency key and identical payload
 *      returns the stored outcome with idempotent_replay: true and ZERO duplicate
 *      side effects. Reusing a key with a conflicting payload fails closed with
 *      idempotency_key_conflict (HTTP 409).
 *
 *   3. Network Timeout & Retry Preservation:
 *      In-flight network errors or 5xx gateway timeouts can be retried safely by
 *      re-submitting the SAME idempotency key without risking double charges or
 *      duplicate inventory moves.
 *
 *   4. Negative Authorization Fail-Closed:
 *      - Unauthorized seat fails closed with seat_not_authorized (HTTP 403).
 *      - Cross-tenant requests fail closed with sale_not_found / location_not_found.
 *      - Unapproved segregated returns fail closed with reversal_approval_required.
 *      - Closing when no session is open fails closed with no_open_session (HTTP 409).
 *
 *   5. Oversell / Negative-Stock Invariant:
 *      Overselling beyond live derived on-hand strictly rejects and rolls back
 *      with stock_insufficient (HTTP 400). Negative stock balances are never invented.
 *
 *   6. Currency Architecture:
 *      Currency dynamically resolves from organisations.base_currency (commit 0c46cde).
 *
 * RUN:
 *   deno test --allow-read tests/contract/serp_090_retry_resilience_test.ts
 */

import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';

const EDGE_MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);
const STARQ_API_PATH = new URL('../../supabase/functions/starq-api/index.ts', import.meta.url);
const GATEWAY_PATH = new URL('../../web/src/services/apiGateway.ts', import.meta.url);
const COUNTER_DOMAIN_PATH = new URL('../../web/src/domain/counter.ts', import.meta.url);
const COUNTER_VIEW_PATH = new URL('../../web/src/components/counter/CounterView.tsx', import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC IDENTITIES & SIMULATION HARNESS
// ─────────────────────────────────────────────────────────────────────────────

const ORG_ALPHA = '30000000-0000-4000-8000-000000000001';
const ORG_BETA = '30000000-0000-4000-8000-000000000002';
const PERSON_CASHIER = '30000000-0000-4000-8000-000000000010';
const PERSON_MANAGER = '30000000-0000-4000-8000-000000000020';
const PERSON_TECH = '30000000-0000-4000-8000-000000000030';
const OUTLET_MALE = '30000000-0000-4000-8000-000000000100';
const OUTLET_HULHUMALE = '30000000-0000-4000-8000-000000000200';
const PRODUCT_BRAKE_PAD = '30000000-0000-4000-8000-000000000501';

interface StoredCommand {
  key: string;
  commandType: 'COUNTER_SALE' | 'reversal' | 'session_open' | 'session_close';
  payloadHash: string;
  response: Record<string, unknown>;
}

class ResilienceSimulationEngine {
  private commands = new Map<string, StoredCommand>();
  public inventoryOnHand = new Map<string, number>();
  public activeSessions = new Map<string, { id: string; locationId: string; status: 'open' | 'closed' }>();

  constructor() {
    this.inventoryOnHand.set(`${ORG_ALPHA}:${OUTLET_MALE}:${PRODUCT_BRAKE_PAD}`, 10);
  }

  executeSale(params: {
    orgId: string;
    personId: string;
    seat: string;
    locationId: string;
    productId: string;
    qty: number;
    commandKey: string;
    isOnline: boolean;
  }): { ok: boolean; idempotent_replay: boolean; invoiceId?: string; error?: string } {
    // 1. Online-only requirement
    if (!params.isOnline) {
      return { ok: false, idempotent_replay: false, error: 'network_offline' };
    }

    // 2. Seat check
    const allowedSeats = ['counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner'];
    if (!allowedSeats.includes(params.seat)) {
      return { ok: false, idempotent_replay: false, error: 'seat_not_authorized' };
    }

    // 3. Idempotency replay check
    const payloadHash = JSON.stringify({
      org: params.orgId,
      loc: params.locationId,
      prod: params.productId,
      qty: params.qty,
    });

    const existing = this.commands.get(params.commandKey);
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        return { ok: false, idempotent_replay: false, error: 'idempotency_key_conflict' };
      }
      return {
        ok: true,
        idempotent_replay: true,
        invoiceId: existing.response.invoiceId as string,
      };
    }

    // 4. Inventory check: fail-closed against overselling
    const invKey = `${params.orgId}:${params.locationId}:${params.productId}`;
    const onHand = this.inventoryOnHand.get(invKey) ?? 0;
    if (params.qty > onHand) {
      // Rejects without mutating stock
      return { ok: false, idempotent_replay: false, error: 'stock_insufficient' };
    }

    // Mutate state
    this.inventoryOnHand.set(invKey, onHand - params.qty);
    const invoiceId = crypto.randomUUID();
    const response = { invoiceId };

    this.commands.set(params.commandKey, {
      key: params.commandKey,
      commandType: 'COUNTER_SALE',
      payloadHash,
      response,
    });

    return { ok: true, idempotent_replay: false, invoiceId };
  }

  executeReversal(params: {
    orgId: string;
    personId: string;
    seat: string;
    saleOrgId: string;
    saleId: string;
    reversalType: 'return' | 'void';
    items: { productId: string; quantity: number }[];
    commandKey: string;
    operatingCapacity?: 'segregated' | 'solo';
    isSupervisorApproved?: boolean;
    isOnline: boolean;
  }): { ok: boolean; idempotent_replay: boolean; returnId?: string; error?: string } {
    if (!params.isOnline) {
      return { ok: false, idempotent_replay: false, error: 'network_offline' };
    }

    const allowedSeats = ['counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner'];
    if (!allowedSeats.includes(params.seat)) {
      return { ok: false, idempotent_replay: false, error: 'seat_not_authorized' };
    }

    // Cross tenant guard
    if (params.saleOrgId !== params.orgId) {
      return { ok: false, idempotent_replay: false, error: 'sale_not_found' };
    }

    // Segregated approval check
    const isManager = ['director', 'managing_director', 'owner'].includes(params.seat);
    if (!isManager && params.operatingCapacity === 'segregated' && !params.isSupervisorApproved) {
      return { ok: false, idempotent_replay: false, error: 'reversal_approval_required' };
    }

    const payloadHash = JSON.stringify({
      saleId: params.saleId,
      reversalType: params.reversalType,
      items: params.items,
    });

    const existing = this.commands.get(params.commandKey);
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        return { ok: false, idempotent_replay: false, error: 'idempotency_key_conflict' };
      }
      return {
        ok: true,
        idempotent_replay: true,
        returnId: existing.response.returnId as string,
      };
    }

    const returnId = crypto.randomUUID();
    this.commands.set(params.commandKey, {
      key: params.commandKey,
      commandType: 'reversal',
      payloadHash,
      response: { returnId },
    });

    return { ok: true, idempotent_replay: false, returnId };
  }

  openSession(params: {
    orgId: string;
    locationId: string;
    commandKey: string;
  }): { ok: boolean; idempotent_replay: boolean; sessionId?: string; error?: string } {
    const payloadHash = JSON.stringify({ loc: params.locationId });
    const existingCmd = this.commands.get(params.commandKey);

    if (existingCmd) {
      if (existingCmd.payloadHash !== payloadHash) {
        return { ok: false, idempotent_replay: false, error: 'idempotency_key_conflict' };
      }
      return {
        ok: true,
        idempotent_replay: true,
        sessionId: existingCmd.response.sessionId as string,
      };
    }

    const active = this.activeSessions.get(params.locationId);
    if (active && active.status === 'open') {
      return { ok: false, idempotent_replay: false, error: 'counter_session_already_open' };
    }

    const sessionId = crypto.randomUUID();
    this.activeSessions.set(params.locationId, { id: sessionId, locationId: params.locationId, status: 'open' });
    this.commands.set(params.commandKey, {
      key: params.commandKey,
      commandType: 'session_open',
      payloadHash,
      response: { sessionId },
    });

    return { ok: true, idempotent_replay: false, sessionId };
  }

  closeSession(params: {
    orgId: string;
    locationId: string;
    countedCash: number;
    commandKey: string;
  }): { ok: boolean; idempotent_replay: boolean; error?: string } {
    const payloadHash = JSON.stringify({ loc: params.locationId });
    const existingCmd = this.commands.get(params.commandKey);

    if (existingCmd) {
      if (existingCmd.payloadHash !== payloadHash) {
        return { ok: false, idempotent_replay: false, error: 'idempotency_key_conflict' };
      }
      return { ok: true, idempotent_replay: true };
    }

    const active = this.activeSessions.get(params.locationId);
    if (!active || active.status !== 'open') {
      return { ok: false, idempotent_replay: false, error: 'no_open_session' };
    }

    active.status = 'closed';
    this.commands.set(params.commandKey, {
      key: params.commandKey,
      commandType: 'session_close',
      payloadHash,
      response: { status: 'closed' },
    });

    return { ok: true, idempotent_replay: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIORAL CONTRACT TESTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-090 behavior: offline transactional selling is strictly rejected', () => {
  const engine = new ResilienceSimulationEngine();
  const res = engine.executeSale({
    orgId: ORG_ALPHA,
    personId: PERSON_CASHIER,
    seat: 'counter',
    locationId: OUTLET_MALE,
    productId: PRODUCT_BRAKE_PAD,
    qty: 1,
    commandKey: crypto.randomUUID(),
    isOnline: false,
  });

  assertEquals(res.ok, false);
  assertEquals(res.error, 'network_offline');
  // Live on-hand remains untouched
  assertEquals(engine.inventoryOnHand.get(`${ORG_ALPHA}:${OUTLET_MALE}:${PRODUCT_BRAKE_PAD}`), 10);
});

Deno.test('SERP-090 behavior: identical sale replay returns stored result with zero duplicate mutations', () => {
  const engine = new ResilienceSimulationEngine();
  const key = crypto.randomUUID();

  const first = engine.executeSale({
    orgId: ORG_ALPHA,
    personId: PERSON_CASHIER,
    seat: 'counter',
    locationId: OUTLET_MALE,
    productId: PRODUCT_BRAKE_PAD,
    qty: 2,
    commandKey: key,
    isOnline: true,
  });

  assertEquals(first.ok, true);
  assertEquals(first.idempotent_replay, false);
  assertEquals(engine.inventoryOnHand.get(`${ORG_ALPHA}:${OUTLET_MALE}:${PRODUCT_BRAKE_PAD}`), 8);

  // Network retry with exact same key and payload
  const retry = engine.executeSale({
    orgId: ORG_ALPHA,
    personId: PERSON_CASHIER,
    seat: 'counter',
    locationId: OUTLET_MALE,
    productId: PRODUCT_BRAKE_PAD,
    qty: 2,
    commandKey: key,
    isOnline: true,
  });

  assertEquals(retry.ok, true);
  assertEquals(retry.idempotent_replay, true);
  assertEquals(retry.invoiceId, first.invoiceId);
  // MUST NOT double-deduct inventory
  assertEquals(engine.inventoryOnHand.get(`${ORG_ALPHA}:${OUTLET_MALE}:${PRODUCT_BRAKE_PAD}`), 8);
});

Deno.test('SERP-090 behavior: reusing command key with conflicting payload fails closed', () => {
  const engine = new ResilienceSimulationEngine();
  const key = crypto.randomUUID();

  const first = engine.executeSale({
    orgId: ORG_ALPHA,
    personId: PERSON_CASHIER,
    seat: 'counter',
    locationId: OUTLET_MALE,
    productId: PRODUCT_BRAKE_PAD,
    qty: 2,
    commandKey: key,
    isOnline: true,
  });
  assertEquals(first.ok, true);

  // Conflicting attempt: same key but qty 5 instead of 2
  const conflict = engine.executeSale({
    orgId: ORG_ALPHA,
    personId: PERSON_CASHIER,
    seat: 'counter',
    locationId: OUTLET_MALE,
    productId: PRODUCT_BRAKE_PAD,
    qty: 5,
    commandKey: key,
    isOnline: true,
  });

  assertEquals(conflict.ok, false);
  assertEquals(conflict.error, 'idempotency_key_conflict');
  // Stock only deducted once for the original 2
  assertEquals(engine.inventoryOnHand.get(`${ORG_ALPHA}:${OUTLET_MALE}:${PRODUCT_BRAKE_PAD}`), 8);
});

Deno.test('SERP-090 behavior: negative stock invention strictly rejected on oversell', () => {
  const engine = new ResilienceSimulationEngine();
  const key = crypto.randomUUID();

  // Attempting to sell 15 when only 10 on hand
  const result = engine.executeSale({
    orgId: ORG_ALPHA,
    personId: PERSON_CASHIER,
    seat: 'counter',
    locationId: OUTLET_MALE,
    productId: PRODUCT_BRAKE_PAD,
    qty: 15,
    commandKey: key,
    isOnline: true,
  });

  assertEquals(result.ok, false);
  assertEquals(result.error, 'stock_insufficient');
  // On-hand remains intact at 10, never negative (-5)
  assertEquals(engine.inventoryOnHand.get(`${ORG_ALPHA}:${OUTLET_MALE}:${PRODUCT_BRAKE_PAD}`), 10);
});

Deno.test('SERP-090 behavior: unauthorized seat fails closed for sales and reversals', () => {
  const engine = new ResilienceSimulationEngine();

  const saleRes = engine.executeSale({
    orgId: ORG_ALPHA,
    personId: PERSON_TECH,
    seat: 'technician',
    locationId: OUTLET_MALE,
    productId: PRODUCT_BRAKE_PAD,
    qty: 1,
    commandKey: crypto.randomUUID(),
    isOnline: true,
  });
  assertEquals(saleRes.ok, false);
  assertEquals(saleRes.error, 'seat_not_authorized');

  const revRes = engine.executeReversal({
    orgId: ORG_ALPHA,
    personId: PERSON_TECH,
    seat: 'technician',
    saleOrgId: ORG_ALPHA,
    saleId: crypto.randomUUID(),
    reversalType: 'return',
    items: [{ productId: PRODUCT_BRAKE_PAD, quantity: 1 }],
    commandKey: crypto.randomUUID(),
    isOnline: true,
  });
  assertEquals(revRes.ok, false);
  assertEquals(revRes.error, 'seat_not_authorized');
});

Deno.test('SERP-090 behavior: cross-tenant reversal fails closed with sale_not_found', () => {
  const engine = new ResilienceSimulationEngine();

  const res = engine.executeReversal({
    orgId: ORG_ALPHA,
    personId: PERSON_CASHIER,
    seat: 'counter',
    saleOrgId: ORG_BETA, // Target sale belongs to Org Beta
    saleId: crypto.randomUUID(),
    reversalType: 'void',
    items: [],
    commandKey: crypto.randomUUID(),
    isOnline: true,
  });

  assertEquals(res.ok, false);
  assertEquals(res.error, 'sale_not_found');
});

Deno.test('SERP-090 behavior: unapproved segregated reversal fails closed', () => {
  const engine = new ResilienceSimulationEngine();

  const res = engine.executeReversal({
    orgId: ORG_ALPHA,
    personId: PERSON_CASHIER,
    seat: 'counter',
    saleOrgId: ORG_ALPHA,
    saleId: crypto.randomUUID(),
    reversalType: 'return',
    items: [{ productId: PRODUCT_BRAKE_PAD, quantity: 1 }],
    commandKey: crypto.randomUUID(),
    operatingCapacity: 'segregated',
    isSupervisorApproved: false,
    isOnline: true,
  });

  assertEquals(res.ok, false);
  assertEquals(res.error, 'reversal_approval_required');
});

Deno.test('SERP-090 behavior: till session open/close replay and conflict detection', () => {
  const engine = new ResilienceSimulationEngine();
  const openKey = crypto.randomUUID();

  // 1. Initial open
  const open1 = engine.openSession({
    orgId: ORG_ALPHA,
    locationId: OUTLET_MALE,
    commandKey: openKey,
  });
  assertEquals(open1.ok, true);
  assertEquals(open1.idempotent_replay, false);

  // 2. Replay open with same location
  const openReplay = engine.openSession({
    orgId: ORG_ALPHA,
    locationId: OUTLET_MALE,
    commandKey: openKey,
  });
  assertEquals(openReplay.ok, true);
  assertEquals(openReplay.idempotent_replay, true);
  assertEquals(openReplay.sessionId, open1.sessionId);

  // 3. Conflict open with different location
  const openConflict = engine.openSession({
    orgId: ORG_ALPHA,
    locationId: OUTLET_HULHUMALE,
    commandKey: openKey,
  });
  assertEquals(openConflict.ok, false);
  assertEquals(openConflict.error, 'idempotency_key_conflict');

  // 4. Close session replay
  const closeKey = crypto.randomUUID();
  const close1 = engine.closeSession({
    orgId: ORG_ALPHA,
    locationId: OUTLET_MALE,
    countedCash: 100,
    commandKey: closeKey,
  });
  assertEquals(close1.ok, true);
  assertEquals(close1.idempotent_replay, false);

  const closeReplay = engine.closeSession({
    orgId: ORG_ALPHA,
    locationId: OUTLET_MALE,
    countedCash: 100,
    commandKey: closeKey,
  });
  assertEquals(closeReplay.ok, true);
  assertEquals(closeReplay.idempotent_replay, true);

  // 5. Subsequent close attempt without open session
  const closeNoSession = engine.closeSession({
    orgId: ORG_ALPHA,
    locationId: OUTLET_MALE,
    countedCash: 100,
    commandKey: crypto.randomUUID(),
  });
  assertEquals(closeNoSession.ok, false);
  assertEquals(closeNoSession.error, 'no_open_session');
});

// ─────────────────────────────────────────────────────────────────────────────
// CONFORMANCE & STATIC ANALYSIS TESTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-090 conformance: migration defines idempotency conflict guards on reversals and sessions', () => {
  const migrationUrl = new URL('202609200029_serp090_counter_retry_resilience.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  assert(sql.includes("raise exception 'idempotency_key_conflict'"), 'must raise idempotency_key_conflict');
  assert(sql.includes('command_key is null'), 'must check command key existence');
  assert(sql.includes('create or replace function public.api_counter_sale_reversal'), 'updates api_counter_sale_reversal');
  assert(sql.includes('create or replace function public.api_counter_session_open'), 'updates api_counter_session_open');
  assert(sql.includes('create or replace function public.api_counter_session_close'), 'updates api_counter_session_close');
  assert(sql.includes('create or replace function public.api_counter_resilience_status'), 'defines api_counter_resilience_status');
});

Deno.test('SERP-090 conformance: api_counter_resilience_status enforces server-authoritative online invariant', () => {
  const migrationUrl = new URL('202609200029_serp090_counter_retry_resilience.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  assert(sql.includes("'server_authoritative', true"), 'resilience status declares server_authoritative true');
  assert(sql.includes("'offline_trading_prohibited', true"), 'resilience status declares offline_trading_prohibited true');
  assert(sql.includes("'compensating_negative_stock_prohibited', true"), 'resilience status declares compensating_negative_stock_prohibited true');
  assert(sql.includes('select base_currency into v_org_currency'), 'currency resolves from organisations');
  assert(sql.includes('revoke all on function public.api_counter_resilience_status'), 'revokes public execution');
  assert(sql.includes('grant execute on function public.api_counter_resilience_status(uuid, uuid, text, uuid) to service_role;'), 'grants to service_role');
});

Deno.test('SERP-090 conformance: starq-api wires resilience route and error mappings', () => {
  const apiTs = Deno.readTextFileSync(STARQ_API_PATH);

  assert(apiTs.includes('path === "/api/ops/counter/resilience"'), 'wires /api/ops/counter/resilience');
  assert(apiTs.includes('api_counter_resilience_status'), 'invokes api_counter_resilience_status');
  assert(apiTs.includes('idempotency_key_conflict'), 'handles idempotency_key_conflict');
  assert(apiTs.includes('json(409, { ok: false, error: "idempotency_key_conflict" }'), 'maps conflict to 409');
  assert(apiTs.includes('stock_insufficient'), 'handles stock_insufficient');
  assert(apiTs.includes('no_open_session'), 'handles no_open_session');
});

Deno.test('SERP-090 conformance: apiGateway propagates idempotencyKey header in web requests', () => {
  const gatewayTs = Deno.readTextFileSync(GATEWAY_PATH);

  assert(gatewayTs.includes('idempotencyKey?: string'), 'ApiCommandParams accepts idempotencyKey');
  assert(gatewayTs.includes("'x-idempotency-key': idempotencyKey"), 'forwards x-idempotency-key header in dispatchCommand');
  assert(gatewayTs.includes("'x-idempotency-key': idempotencyKey || generateIdempotencyKey()"), 'forwards x-idempotency-key header in apiPost');
});

Deno.test('SERP-090 conformance: CounterView enforces online banner, disables transactions offline, and preserves retry keys', () => {
  const viewTs = Deno.readTextFileSync(COUNTER_VIEW_PATH);

  assert(viewTs.includes('navigator.onLine'), 'tracks navigator.onLine');
  assert(viewTs.includes("addEventListener('online'"), 'registers online listener');
  assert(viewTs.includes("addEventListener('offline'"), 'registers offline listener');
  assert(viewTs.includes('canTransact(isOnline)'), 'gates transactions with canTransact');
  assert(viewTs.includes('activeSaleKey'), 'preserves sale idempotency key on retry');
  assert(viewTs.includes('activeReversalKey'), 'preserves reversal idempotency key on retry');
  assert(viewTs.includes('Counter POS is Online-Only'), 'displays online-only enforcement banner');
});

Deno.test('SERP-090 conformance: counter domain pure resilience functions declared', () => {
  const domainTs = Deno.readTextFileSync(COUNTER_DOMAIN_PATH);

  assert(domainTs.includes('export function canTransact'), 'exports canTransact');
  assert(domainTs.includes('export function isRetryableError'), 'exports isRetryableError');
  assert(domainTs.includes('export function formatResilienceErrorMessage'), 'exports formatResilienceErrorMessage');
  assert(domainTs.includes('export function createRetryContext'), 'exports createRetryContext');
  assert(domainTs.includes('export function incrementRetry'), 'exports incrementRetry');
});

// ─────────────────────────────────────────────────────────────────────────────
// PERMANENT REGRESSION TESTS FOR SERP-088 / SERP-090 DEFECTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-090 regression (1): itemized-return refund formula under tax_mode=exclusive with non-zero rate pro-rates original stored line', () => {
  // Lock in the exact worked example:
  // Original sale: 4 units @ 100 unit_price, 8% GST exclusive.
  // Stored sale line:
  const origQuantity = 4;
  const origUnitPrice = 100.00;
  const taxRate = 0.08;
  const origNet = origQuantity * origUnitPrice; // 400.00
  const origTax = origNet * taxRate; // 32.00
  const origGross = origNet + origTax; // 432.00

  // Customer returns 1 unit:
  const returnQty = 1;

  // Correct pro-rata formula: pro-rates the ORIGINAL stored line's net/tax/gross
  const proratedNet = Math.round(origNet * (returnQty / origQuantity) * 100) / 100;
  const proratedTax = Math.round(origTax * (returnQty / origQuantity) * 100) / 100;
  const proratedGross = Math.round((proratedNet + proratedTax) * 100) / 100;

  assertEquals(proratedNet, 100.00, 'prorated net must be exactly 100.00');
  assertEquals(proratedTax, 8.00, 'prorated tax must be exactly 8.00');
  assertEquals(proratedGross, 108.00, 'prorated gross must be exactly 108.00');

  // Buggy tax-inclusive formula that must FAIL:
  // unit_price / (1 + tax_rate) = 100 / 1.08 = 92.59 net + 7.41 tax = 100.00 gross
  const buggyNet = Math.round((returnQty * origUnitPrice / (1 + taxRate)) * 100) / 100;
  assert(buggyNet !== proratedNet, 'buggy formula 92.59 must NOT equal pro-rated 100.00');
  assertEquals(buggyNet, 92.59, 'confirms buggy formula produces 92.59');

  // Static migration check: assert migration contains the pro-rata formula and NOT the buggy formula
  const migrationUrl = new URL('202609200029_serp090_counter_retry_resilience.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  assert(
    sql.includes('v_orig_line.net_amount * (v_return_qty / v_orig_line.quantity)'),
    'migration must pro-rate v_orig_line.net_amount'
  );
  assert(
    sql.includes('v_orig_line.tax_amount * (v_return_qty / v_orig_line.quantity)'),
    'migration must pro-rate v_orig_line.tax_amount'
  );
  assert(
    !sql.includes('v_return_qty * v_orig_line.unit_price) / (1 +'),
    'migration must NOT use buggy tax-inclusive division formula'
  );
});

Deno.test('SERP-090 regression (2): counter_refund_tenders insert always populates recorded_by and recorded_seat', () => {
  const migrationUrl = new URL('202609200029_serp090_counter_retry_resilience.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  // Search for the insert statement into counter_refund_tenders
  const insertIndex = sql.indexOf('insert into public.counter_refund_tenders');
  assert(insertIndex !== -1, 'must have counter_refund_tenders insert statement');

  const insertBlock = sql.slice(insertIndex, insertIndex + 500);
  assert(insertBlock.includes('recorded_by'), 'insert columns must include recorded_by');
  assert(insertBlock.includes('recorded_seat'), 'insert columns must include recorded_seat');
  assert(insertBlock.includes('target_person'), 'insert values must provide target_person for recorded_by');
  assert(insertBlock.includes('target_seat'), 'insert values must provide target_seat for recorded_seat');
});

Deno.test('SERP-090 regression (3): idempotency-key-conflict on reversal command with conflicting sale or type', () => {
  const engine = new ResilienceSimulationEngine();
  const revKey = crypto.randomUUID();
  const sale1 = crypto.randomUUID();
  const sale2 = crypto.randomUUID();

  // 1. First reversal executes successfully
  const first = engine.executeReversal({
    orgId: ORG_ALPHA,
    personId: PERSON_CASHIER,
    seat: 'counter',
    saleOrgId: ORG_ALPHA,
    saleId: sale1,
    reversalType: 'return',
    items: [{ productId: PRODUCT_BRAKE_PAD, quantity: 1 }],
    commandKey: revKey,
    isOnline: true,
  });
  assertEquals(first.ok, true);
  assertEquals(first.idempotent_replay, false);

  // 2. Replaying with identical key and identical payload returns stored result
  const replay = engine.executeReversal({
    orgId: ORG_ALPHA,
    personId: PERSON_CASHIER,
    seat: 'counter',
    saleOrgId: ORG_ALPHA,
    saleId: sale1,
    reversalType: 'return',
    items: [{ productId: PRODUCT_BRAKE_PAD, quantity: 1 }],
    commandKey: revKey,
    isOnline: true,
  });
  assertEquals(replay.ok, true);
  assertEquals(replay.idempotent_replay, true);
  assertEquals(replay.returnId, first.returnId);

  // 3. Reusing key with conflicting sale ID fails closed with idempotency_key_conflict
  const conflictSale = engine.executeReversal({
    orgId: ORG_ALPHA,
    personId: PERSON_CASHIER,
    seat: 'counter',
    saleOrgId: ORG_ALPHA,
    saleId: sale2, // Different sale ID!
    reversalType: 'return',
    items: [{ productId: PRODUCT_BRAKE_PAD, quantity: 1 }],
    commandKey: revKey,
    isOnline: true,
  });
  assertEquals(conflictSale.ok, false);
  assertEquals(conflictSale.error, 'idempotency_key_conflict');

  // 4. Reusing key with conflicting reversal type (void vs return) fails closed with idempotency_key_conflict
  const conflictType = engine.executeReversal({
    orgId: ORG_ALPHA,
    personId: PERSON_CASHIER,
    seat: 'counter',
    saleOrgId: ORG_ALPHA,
    saleId: sale1,
    reversalType: 'void', // Different reversal type!
    items: [],
    commandKey: revKey,
    isOnline: true,
  });
  assertEquals(conflictType.ok, false);
  assertEquals(conflictType.error, 'idempotency_key_conflict');
});

Deno.test('SERP-090 regression (4): ensure_return_sequences is called in api_counter_sale_reversal before document allocation', () => {
  const migrationUrl = new URL('202609200029_serp090_counter_retry_resilience.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  const ensureIndex = sql.indexOf('perform app_private.ensure_return_sequences(target_org);');
  assert(ensureIndex !== -1, 'api_counter_sale_reversal must call app_private.ensure_return_sequences(target_org)');

  const allocCrnIndex = sql.indexOf("app_private.allocate_document_no(target_org, 'credit_note');");
  assert(allocCrnIndex !== -1, "must allocate 'credit_note'");

  const allocRetIndex = sql.indexOf("app_private.allocate_document_no(target_org, 'counter_return');");
  assert(allocRetIndex !== -1, "must allocate 'counter_return'");

  assert(
    ensureIndex < allocCrnIndex,
    'ensure_return_sequences must be called BEFORE credit_note allocation'
  );
  assert(
    ensureIndex < allocRetIndex,
    'ensure_return_sequences must be called BEFORE counter_return allocation'
  );
});

Deno.test('SERP-090 regression (5): cash_session document_sequences row is self-seeded before allocation, fresh-org safe', () => {
  const migrationUrl = new URL('202609200029_serp090_counter_retry_resilience.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  const seedIndex = sql.indexOf(
    "insert into public.document_sequences (organisation_id, sequence_type, prefix, padding)\n  values (target_org, 'cash_session', 'CS-', 5)\n  on conflict (organisation_id, sequence_type) do nothing;"
  );
  assert(seedIndex !== -1, "must self-seed a 'cash_session' document_sequences row with on-conflict-do-nothing (idempotent, fresh-org safe)");

  const allocIndex = sql.indexOf("app_private.allocate_document_no(target_org, 'cash_session');");
  assert(allocIndex !== -1, "must allocate 'cash_session' document number");

  assert(
    seedIndex < allocIndex,
    'cash_session sequence must be seeded BEFORE allocate_document_no is called, or a fresh org crashes on first session open'
  );
});

Deno.test('SERP-090 regression (6): audit_events inserts never supply an id column (bigint identity, auto-generated)', () => {
  const migrationUrl = new URL('202609200029_serp090_counter_retry_resilience.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  const columnListRegex = /insert into public\.audit_events\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  let inserts = 0;
  while ((match = columnListRegex.exec(sql)) !== null) {
    inserts += 1;
    const columns = match[1].split(',').map((c) => c.trim());
    assert(
      !columns.includes('id'),
      `audit_events insert must not supply the bigint identity column 'id' explicitly (found in column list: ${match[1]})`
    );
  }
  assert(inserts >= 3, `expected at least 3 audit_events inserts in this migration (session open/close, reversal), found ${inserts}`);
});

