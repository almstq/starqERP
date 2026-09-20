/**
 * STARQ ERP — SERP-088 Controlled return, refund and void proof gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The SERP-088 dispatch (M6 counter lane) proves the server-authoritative
 * reversal engine for counter sales:
 *
 *   1. Server-authoritative reversal linked to original counter sale
 *      (cross-tenant fails closed with sale_not_found).
 *   2. Reversal modes: itemized return, full void, and tender refund.
 *   3. Separation of Duties (SoD) & approval gate per SERP-030:
 *      - Managerial seats (owner/managing_director/director) execute directly;
 *      - Counter seat requires supervisor approval in segregated capacity;
 *      - Counter seat in solo capacity compensates honestly with audit trail;
 *      - Unauthorized seats fail closed (seat_not_authorized).
 *   4. Inventory restoration: positive stock_movements ('return') into canonical
 *      ledger, immediately reflected in live on-hand.
 *   5. Commercial & financial consequence: settled credit_note in commercial_documents
 *      and itemized refund legs in counter_refund_tenders.
 *   6. Strict limits: cannot void already-voided or partially-returned sales;
 *      return quantity cannot exceed original sold quantity; refund tenders
 *      must match refund gross.
 *   7. Replay idempotency: duplicate command key returns stored return record.
 *   8. Currency architecture: org-derived from organisations.base_currency (commit 0c46cde).
 *   9. Cash session integration: cash refunds subtract from net cash at till close.
 *
 * RUN:
 *   deno test --allow-read tests/contract/serp_088_counter_return_void_test.ts
 */

import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';

const EDGE_MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);
const STARQ_API_PATH = new URL('../../supabase/functions/starq-api/index.ts', import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC IDENTITIES
// ─────────────────────────────────────────────────────────────────────────────

const ORG_A = '20000000-0000-4000-8000-000000000901';
const ORG_B = '10000000-0000-4000-8000-000000000901';
const PERSON_COUNTER = '20000000-0000-4000-8000-000000000111';
const PERSON_MANAGER = '20000000-0000-4000-8000-000000000222';
const PERSON_TECH = '20000000-0000-4000-8000-000000000333';
const LOCATION = '20000000-0000-4000-8000-000000000401';
const PRODUCT_1 = '20000000-0000-4000-8000-000000000501';
const PRODUCT_2 = '20000000-0000-4000-8000-000000000502';
const PRODUCT_UNSOLD = '20000000-0000-4000-8000-000000000503';

// ─────────────────────────────────────────────────────────────────────────────
// PURE CONTRACT REVERSAL MIRROR
// ─────────────────────────────────────────────────────────────────────────────

interface OriginalSaleLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

interface OriginalSale {
  id: string;
  orgId: string;
  locationId: string;
  documentNo: string;
  currency: string;
  grossTotal: number;
  taxTotal: number;
  lines: OriginalSaleLine[];
  isCounterSale: boolean;
}

interface ReturnItemCmd {
  productId: string;
  quantity: number;
}

interface RefundTenderCmd {
  method: 'cash' | 'card' | 'transfer' | 'store_credit';
  amount: number;
}

interface PriorReturn {
  reversalType: 'return' | 'void';
  items: { productId: string; quantity: number }[];
  refundAmount: number;
}

interface MirrorReturnResult {
  reversal_type: 'return' | 'void';
  total_refund_amount: number;
  approval_mode: 'manager_seat' | 'supervisor_override' | 'solo_capacity';
  items: { productId: string; quantity: number; grossAmount: number }[];
  stock_movements: { movement_type: string; quantity: number }[];
}

function mirrorExecuteReversal(params: {
  orgId: string;
  actorPersonId: string;
  actorSeat: string;
  operatingCapacity?: 'segregated' | 'solo';
  approverPersonId?: string;
  managerPersons: Set<string>;
  sale: OriginalSale;
  reversalType: 'return' | 'void';
  reason: string;
  items?: ReturnItemCmd[];
  refundTenders?: RefundTenderCmd[];
  priorReturns?: PriorReturn[];
  commandKey: string;
  seenCommandKeys: Map<string, any>;
}): { ok: boolean; idempotent_replay: boolean; return: any } {
  // 1. Seat authorization
  const allowedSeats = ['counter', 'quartermaster', 'stores', 'director', 'managing_director', 'owner'];
  if (!allowedSeats.includes(params.actorSeat)) {
    throw new Error('seat_not_authorized');
  }

  // 2. Replay check
  if (params.seenCommandKeys.has(params.commandKey)) {
    return { ok: true, idempotent_replay: true, return: params.seenCommandKeys.get(params.commandKey) };
  }

  // 3. Reason check
  if (!params.reason || params.reason.trim().length < 3) {
    throw new Error('reversal_reason_required');
  }

  // 4. SoD & Approval check (SERP-030)
  let approvalMode: 'manager_seat' | 'supervisor_override' | 'solo_capacity';
  const isManager = ['owner', 'managing_director', 'director'].includes(params.actorSeat);
  if (isManager) {
    approvalMode = 'manager_seat';
  } else {
    if (params.approverPersonId) {
      if (!params.managerPersons.has(params.approverPersonId)) {
        throw new Error('reversal_approver_unauthorized');
      }
      approvalMode = 'supervisor_override';
    } else if (params.operatingCapacity === 'solo') {
      approvalMode = 'solo_capacity';
    } else {
      throw new Error('reversal_approval_required');
    }
  }

  // 5. Tenant check & Counter sale check
  if (params.sale.orgId !== params.orgId) {
    throw new Error('sale_not_found');
  }
  if (!params.sale.isCounterSale) {
    throw new Error('sale_not_counter_sale');
  }

  const prior = params.priorReturns ?? [];

  // 6. Void checks
  if (params.reversalType === 'void') {
    if (prior.some((p) => p.reversalType === 'void')) {
      throw new Error('sale_already_voided');
    }
    if (prior.length > 0) {
      throw new Error('cannot_void_partially_returned_sale');
    }

    // Full void mirrors 100% of lines and gross
    const returnLines = params.sale.lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      grossAmount: l.grossAmount,
    }));
    const totalRefund = params.sale.grossTotal;

    const result = {
      reversal_type: 'void',
      total_refund_amount: totalRefund,
      approval_mode: approvalMode,
      items: returnLines,
      stock_movements: returnLines.map((l) => ({
        movement_type: 'return',
        quantity: l.quantity, // positive restores stock
      })),
    };
    params.seenCommandKeys.set(params.commandKey, result);
    return { ok: true, idempotent_replay: false, return: result };
  }

  // 7. Itemized Return
  if (!params.items || params.items.length === 0) {
    throw new Error('reversal_items_required');
  }

  let calculatedRefundTotal = 0;
  const returnLines: { productId: string; quantity: number; grossAmount: number }[] = [];

  for (const item of params.items) {
    if (item.quantity <= 0) throw new Error('stock_line_quantity_positive');
    const origLine = params.sale.lines.find((l) => l.productId === item.productId);
    if (!origLine) {
      throw new Error('product_not_on_sale');
    }

    // Cumulative returned quantity
    const priorQty = prior.reduce((sum, p) => {
      const it = p.items.find((i) => i.productId === item.productId);
      return sum + (it ? it.quantity : 0);
    }, 0);

    if (priorQty + item.quantity > origLine.quantity) {
      throw new Error('return_quantity_exceeds_sale');
    }

    const lineGross = Math.round(((origLine.grossAmount * (item.quantity / origLine.quantity)) + Number.EPSILON) * 100) / 100;
    calculatedRefundTotal += lineGross;
    returnLines.push({
      productId: item.productId,
      quantity: item.quantity,
      grossAmount: lineGross,
    });
  }

  calculatedRefundTotal = Math.round((calculatedRefundTotal + Number.EPSILON) * 100) / 100;

  // Check refund tenders sum
  if (!params.refundTenders || params.refundTenders.length === 0) {
    throw new Error('reversal_refund_tenders_required');
  }
  const tenderSum = Math.round((params.refundTenders.reduce((s, t) => s + t.amount, 0) + Number.EPSILON) * 100) / 100;
  if (tenderSum !== calculatedRefundTotal) {
    throw new Error('reversal_refund_mismatch');
  }

  const result = {
    reversal_type: 'return',
    total_refund_amount: calculatedRefundTotal,
    approval_mode: approvalMode,
    items: returnLines,
    stock_movements: returnLines.map((l) => ({
      movement_type: 'return',
      quantity: l.quantity, // positive
    })),
  };
  params.seenCommandKeys.set(params.commandKey, result);
  return { ok: true, idempotent_replay: false, return: result };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST DATA FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_SALE: OriginalSale = {
  id: '30000000-0000-4000-8000-000000000001',
  orgId: ORG_A,
  locationId: LOCATION,
  documentNo: 'SI-00001',
  currency: 'MVR',
  grossTotal: 150.00,
  taxTotal: 0.00,
  isCounterSale: true,
  lines: [
    {
      productId: PRODUCT_1,
      quantity: 2,
      unitPrice: 50.00,
      taxRate: 0,
      netAmount: 100.00,
      taxAmount: 0.00,
      grossAmount: 100.00,
    },
    {
      productId: PRODUCT_2,
      quantity: 1,
      unitPrice: 50.00,
      taxRate: 0,
      netAmount: 50.00,
      taxAmount: 0.00,
      grossAmount: 50.00,
    },
  ],
};

const MANAGERS = new Set<string>([PERSON_MANAGER]);

// ─────────────────────────────────────────────────────────────────────────────
// MIRROR TESTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-088 mirror: itemized return calculates pro-rata refund and positive stock movement', () => {
  const seenKeys = new Map<string, unknown>();
  const res = mirrorExecuteReversal({
    orgId: ORG_A,
    actorPersonId: PERSON_COUNTER,
    actorSeat: 'counter',
    operatingCapacity: 'solo',
    managerPersons: MANAGERS,
    sale: SAMPLE_SALE,
    reversalType: 'return',
    reason: 'Customer return — unopened part',
    items: [{ productId: PRODUCT_1, quantity: 1 }],
    refundTenders: [{ method: 'cash', amount: 50.00 }],
    commandKey: crypto.randomUUID(),
    seenCommandKeys: seenKeys,
  });

  assertEquals(res.ok, true);
  assertEquals(res.return.total_refund_amount, 50.00);
  assertEquals(res.return.approval_mode, 'solo_capacity');
  assertEquals(res.return.items.length, 1);
  assertEquals(res.return.items[0].quantity, 1);
  assertEquals(res.return.stock_movements[0].movement_type, 'return');
  assertEquals(res.return.stock_movements[0].quantity, 1); // positive restores stock
});

Deno.test('SERP-088 mirror: full void reverses 100% of lines and gross total', () => {
  const seenKeys = new Map<string, unknown>();
  const res = mirrorExecuteReversal({
    orgId: ORG_A,
    actorPersonId: PERSON_MANAGER,
    actorSeat: 'director',
    managerPersons: MANAGERS,
    sale: SAMPLE_SALE,
    reversalType: 'void',
    reason: 'Operator entry error on till',
    commandKey: crypto.randomUUID(),
    seenCommandKeys: seenKeys,
  });

  assertEquals(res.ok, true);
  assertEquals(res.return.total_refund_amount, 150.00);
  assertEquals(res.return.approval_mode, 'manager_seat');
  assertEquals(res.return.items.length, 2);
  assertEquals(res.return.stock_movements[0].quantity, 2);
  assertEquals(res.return.stock_movements[1].quantity, 1);
});

Deno.test('SERP-088 mirror: partial return allows subsequent return of remaining quantity', () => {
  const seenKeys = new Map<string, unknown>();
  const prior: PriorReturn[] = [
    {
      reversalType: 'return',
      items: [{ productId: PRODUCT_1, quantity: 1 }],
      refundAmount: 50.00,
    },
  ];

  // Return remaining 1 unit of PRODUCT_1
  const res = mirrorExecuteReversal({
    orgId: ORG_A,
    actorPersonId: PERSON_COUNTER,
    actorSeat: 'counter',
    operatingCapacity: 'solo',
    managerPersons: MANAGERS,
    sale: SAMPLE_SALE,
    reversalType: 'return',
    reason: 'Returning second item later',
    items: [{ productId: PRODUCT_1, quantity: 1 }],
    refundTenders: [{ method: 'cash', amount: 50.00 }],
    priorReturns: prior,
    commandKey: crypto.randomUUID(),
    seenCommandKeys: seenKeys,
  });

  assertEquals(res.ok, true);
  assertEquals(res.return.total_refund_amount, 50.00);
});

Deno.test('SERP-088 mirror: returning more than sold quantity fails closed with return_quantity_exceeds_sale', () => {
  const seenKeys = new Map<string, unknown>();
  assertThrows(
    () => mirrorExecuteReversal({
      orgId: ORG_A,
      actorPersonId: PERSON_COUNTER,
      actorSeat: 'counter',
      operatingCapacity: 'solo',
      managerPersons: MANAGERS,
      sale: SAMPLE_SALE,
      reversalType: 'return',
      reason: 'Attempting excessive return',
      items: [{ productId: PRODUCT_1, quantity: 3 }], // only 2 sold
      refundTenders: [{ method: 'cash', amount: 150.00 }],
      commandKey: crypto.randomUUID(),
      seenCommandKeys: seenKeys,
    }),
    Error,
    'return_quantity_exceeds_sale'
  );
});

Deno.test('SERP-088 mirror: returning product not on original sale fails closed with product_not_on_sale', () => {
  const seenKeys = new Map<string, unknown>();
  assertThrows(
    () => mirrorExecuteReversal({
      orgId: ORG_A,
      actorPersonId: PERSON_COUNTER,
      actorSeat: 'counter',
      operatingCapacity: 'solo',
      managerPersons: MANAGERS,
      sale: SAMPLE_SALE,
      reversalType: 'return',
      reason: 'Foreign product return',
      items: [{ productId: PRODUCT_UNSOLD, quantity: 1 }],
      refundTenders: [{ method: 'cash', amount: 50.00 }],
      commandKey: crypto.randomUUID(),
      seenCommandKeys: seenKeys,
    }),
    Error,
    'product_not_on_sale'
  );
});

Deno.test('SERP-088 mirror: attempting to void an already-voided sale fails closed with sale_already_voided', () => {
  const seenKeys = new Map<string, unknown>();
  const prior: PriorReturn[] = [
    {
      reversalType: 'void',
      items: [{ productId: PRODUCT_1, quantity: 2 }, { productId: PRODUCT_2, quantity: 1 }],
      refundAmount: 150.00,
    },
  ];

  assertThrows(
    () => mirrorExecuteReversal({
      orgId: ORG_A,
      actorPersonId: PERSON_MANAGER,
      actorSeat: 'director',
      managerPersons: MANAGERS,
      sale: SAMPLE_SALE,
      reversalType: 'void',
      reason: 'Double void attempt',
      priorReturns: prior,
      commandKey: crypto.randomUUID(),
      seenCommandKeys: seenKeys,
    }),
    Error,
    'sale_already_voided'
  );
});

Deno.test('SERP-088 mirror: attempting to void a partially returned sale fails closed with cannot_void_partially_returned_sale', () => {
  const seenKeys = new Map<string, unknown>();
  const prior: PriorReturn[] = [
    {
      reversalType: 'return',
      items: [{ productId: PRODUCT_1, quantity: 1 }],
      refundAmount: 50.00,
    },
  ];

  assertThrows(
    () => mirrorExecuteReversal({
      orgId: ORG_A,
      actorPersonId: PERSON_MANAGER,
      actorSeat: 'director',
      managerPersons: MANAGERS,
      sale: SAMPLE_SALE,
      reversalType: 'void',
      reason: 'Voiding partially returned sale',
      priorReturns: prior,
      commandKey: crypto.randomUUID(),
      seenCommandKeys: seenKeys,
    }),
    Error,
    'cannot_void_partially_returned_sale'
  );
});

Deno.test('SERP-088 mirror: refund tenders amount mismatch fails closed with reversal_refund_mismatch', () => {
  const seenKeys = new Map<string, unknown>();
  assertThrows(
    () => mirrorExecuteReversal({
      orgId: ORG_A,
      actorPersonId: PERSON_COUNTER,
      actorSeat: 'counter',
      operatingCapacity: 'solo',
      managerPersons: MANAGERS,
      sale: SAMPLE_SALE,
      reversalType: 'return',
      reason: 'Customer return',
      items: [{ productId: PRODUCT_1, quantity: 1 }], // worth 50.00
      refundTenders: [{ method: 'cash', amount: 40.00 }], // mismatch
      commandKey: crypto.randomUUID(),
      seenCommandKeys: seenKeys,
    }),
    Error,
    'reversal_refund_mismatch'
  );
});

Deno.test('SERP-088 mirror: cross-tenant original sale reference fails closed with sale_not_found', () => {
  const seenKeys = new Map<string, unknown>();
  assertThrows(
    () => mirrorExecuteReversal({
      orgId: ORG_B, // Calling from Tenant B
      actorPersonId: PERSON_COUNTER,
      actorSeat: 'counter',
      operatingCapacity: 'solo',
      managerPersons: MANAGERS,
      sale: SAMPLE_SALE, // Belongs to Tenant A
      reversalType: 'return',
      reason: 'Cross-tenant attempt',
      items: [{ productId: PRODUCT_1, quantity: 1 }],
      refundTenders: [{ method: 'cash', amount: 50.00 }],
      commandKey: crypto.randomUUID(),
      seenCommandKeys: seenKeys,
    }),
    Error,
    'sale_not_found'
  );
});

Deno.test('SERP-088 mirror: counter seat in segregated capacity requires manager supervisor approval', () => {
  const seenKeys = new Map<string, unknown>();

  // 1. Unapproved fails closed
  assertThrows(
    () => mirrorExecuteReversal({
      orgId: ORG_A,
      actorPersonId: PERSON_COUNTER,
      actorSeat: 'counter',
      operatingCapacity: 'segregated',
      managerPersons: MANAGERS,
      sale: SAMPLE_SALE,
      reversalType: 'return',
      reason: 'Unapproved return attempt',
      items: [{ productId: PRODUCT_1, quantity: 1 }],
      refundTenders: [{ method: 'cash', amount: 50.00 }],
      commandKey: crypto.randomUUID(),
      seenCommandKeys: seenKeys,
    }),
    Error,
    'reversal_approval_required'
  );

  // 2. Non-manager approver fails closed
  assertThrows(
    () => mirrorExecuteReversal({
      orgId: ORG_A,
      actorPersonId: PERSON_COUNTER,
      actorSeat: 'counter',
      operatingCapacity: 'segregated',
      approverPersonId: PERSON_TECH, // Tech is not a manager
      managerPersons: MANAGERS,
      sale: SAMPLE_SALE,
      reversalType: 'return',
      reason: 'Tech approved return',
      items: [{ productId: PRODUCT_1, quantity: 1 }],
      refundTenders: [{ method: 'cash', amount: 50.00 }],
      commandKey: crypto.randomUUID(),
      seenCommandKeys: seenKeys,
    }),
    Error,
    'reversal_approver_unauthorized'
  );

  // 3. Valid manager approval succeeds with supervisor_override mode
  const res = mirrorExecuteReversal({
    orgId: ORG_A,
    actorPersonId: PERSON_COUNTER,
    actorSeat: 'counter',
    operatingCapacity: 'segregated',
    approverPersonId: PERSON_MANAGER,
    managerPersons: MANAGERS,
    sale: SAMPLE_SALE,
    reversalType: 'return',
    reason: 'Supervisor approved return',
    items: [{ productId: PRODUCT_1, quantity: 1 }],
    refundTenders: [{ method: 'cash', amount: 50.00 }],
    commandKey: crypto.randomUUID(),
    seenCommandKeys: seenKeys,
  });

  assertEquals(res.ok, true);
  assertEquals(res.return.approval_mode, 'supervisor_override');
});

Deno.test('SERP-088 mirror: unauthorized seat rejected with seat_not_authorized', () => {
  const seenKeys = new Map<string, unknown>();
  assertThrows(
    () => mirrorExecuteReversal({
      orgId: ORG_A,
      actorPersonId: PERSON_TECH,
      actorSeat: 'technician',
      managerPersons: MANAGERS,
      sale: SAMPLE_SALE,
      reversalType: 'return',
      reason: 'Tech attempting reversal',
      items: [{ productId: PRODUCT_1, quantity: 1 }],
      refundTenders: [{ method: 'cash', amount: 50.00 }],
      commandKey: crypto.randomUUID(),
      seenCommandKeys: seenKeys,
    }),
    Error,
    'seat_not_authorized'
  );
});

Deno.test('SERP-088 mirror: replay idempotency returns stored return record', () => {
  const seenKeys = new Map<string, unknown>();
  const key = crypto.randomUUID();

  const first = mirrorExecuteReversal({
    orgId: ORG_A,
    actorPersonId: PERSON_COUNTER,
    actorSeat: 'counter',
    operatingCapacity: 'solo',
    managerPersons: MANAGERS,
    sale: SAMPLE_SALE,
    reversalType: 'return',
    reason: 'First attempt',
    items: [{ productId: PRODUCT_1, quantity: 1 }],
    refundTenders: [{ method: 'cash', amount: 50.00 }],
    commandKey: key,
    seenCommandKeys: seenKeys,
  });
  assertEquals(first.idempotent_replay, false);

  const replay = mirrorExecuteReversal({
    orgId: ORG_A,
    actorPersonId: PERSON_COUNTER,
    actorSeat: 'counter',
    operatingCapacity: 'solo',
    managerPersons: MANAGERS,
    sale: SAMPLE_SALE,
    reversalType: 'return',
    reason: 'Replay attempt',
    items: [{ productId: PRODUCT_1, quantity: 1 }],
    refundTenders: [{ method: 'cash', amount: 50.00 }],
    commandKey: key,
    seenCommandKeys: seenKeys,
  });
  assertEquals(replay.idempotent_replay, true);
  assertEquals(replay.return, first.return);
});

// ─────────────────────────────────────────────────────────────────────────────
// CONFORMANCE & STATIC ANALYSIS TESTS
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-088 conformance: migration 202609192400 defines counter_returns and refund tables', () => {
  const migrationUrl = new URL('202609192400_serp088_counter_return_refund_void.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  assert(sql.includes('create table if not exists public.counter_returns'), 'must create public.counter_returns');
  assert(sql.includes('create table if not exists public.counter_refund_tenders'), 'must create public.counter_refund_tenders');
  assert(sql.includes("check (reversal_type in ('return', 'void', 'refund'))"), 'must constrain reversal_type');
  assert(sql.includes("check (approval_mode in ('manager_seat', 'solo_capacity', 'supervisor_override'))"), 'must constrain approval_mode');
  assert(sql.includes('references public.commercial_documents(organisation_id, id)'), 'must reference commercial_documents');
  assert(sql.includes('revoke all on table public.counter_returns from public, anon, authenticated;'), 'must revoke public access');
  assert(sql.includes('grant select, insert on table public.counter_returns to service_role;'), 'must grant to service_role');
});

Deno.test('SERP-088 conformance: api_counter_sale_reversal defined with seat gate and service_role permissions', () => {
  const migrationUrl = new URL('202609192400_serp088_counter_return_refund_void.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  assert(sql.includes('create or replace function public.api_counter_sale_reversal'), 'must define api_counter_sale_reversal');
  assert(sql.includes('security definer'), 'must be security definer');
  assert(sql.includes('set search_path = public, app_private, extensions, pg_temp'), 'must set explicit search_path');
  assert(sql.includes('assert_active_seat'), 'must assert active seat');
  assert(sql.includes('pg_advisory_xact_lock'), 'must use advisory xact lock for concurrency');
  assert(sql.includes('grant execute on function public.api_counter_sale_reversal'), 'must grant execute to service_role');
});

Deno.test('SERP-088 conformance: stock movements insert type is return with positive quantity', () => {
  const migrationUrl = new URL('202609192400_serp088_counter_return_refund_void.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  assert(sql.includes("'return', v_return_qty"), 'must insert return movement with positive quantity');
  assert(sql.includes("'COUNTER_RETURN'"), 'must specify COUNTER_RETURN source_type');
  assert(sql.includes("'COUNTER_VOID'"), 'must specify COUNTER_VOID source_type');
});

Deno.test('SERP-088 conformance: audit event and outbox event emitted on reversal', () => {
  const migrationUrl = new URL('202609192400_serp088_counter_return_refund_void.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  assert(sql.includes('insert into public.audit_events'), 'must insert attributable audit event');
  assert(sql.includes('append_outbox_event'), 'must append transactional outbox event');
  assert(sql.includes('erp.counter_return'), 'must record erp.counter_return action');
  assert(sql.includes('erp.counter_void'), 'must record erp.counter_void action');
});

Deno.test('SERP-088 conformance: cash session close reconciles cash refunds', () => {
  const migrationUrl = new URL('202609192400_serp088_counter_return_refund_void.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  assert(sql.includes('v_cash_refunds'), 'must query cash refunds in session current/close');
  assert(sql.includes('v_expected_cash := round(v_opening_float + v_cash_sales - v_cash_refunds, 2)'), 'must subtract cash refunds from expected cash');
});

Deno.test('SERP-088 conformance: currency derived from organisations.base_currency (commit 0c46cde)', () => {
  const migrationUrl = new URL('202609192400_serp088_counter_return_refund_void.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  assert(sql.includes('select base_currency into v_org_currency'), 'must select base_currency from organisations');
  assert(!sql.includes("default 'MVR'"), 'no hardcoded MVR default in reversal RPC');
});

Deno.test('SERP-088 conformance: starq-api wires return, void, and returns query routes', () => {
  const apiTs = Deno.readTextFileSync(STARQ_API_PATH);

  assert(apiTs.includes('path === "/api/ops/counter/return"'), 'must wire POST /api/ops/counter/return');
  assert(apiTs.includes('path === "/api/ops/counter/void"'), 'must wire POST /api/ops/counter/void');
  assert(apiTs.includes('path === "/api/ops/counter/returns"'), 'must wire GET /api/ops/counter/returns');
  assert(apiTs.includes('api_counter_sale_reversal'), 'must invoke api_counter_sale_reversal RPC');
});

Deno.test('SERP-088 conformance: full-void auto-tender-mirror builds jsonb_build_object to prevent scalar-cast crash', () => {
  const migrationUrl = new URL('202609192400_serp088_counter_return_refund_void.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  assert(
    sql.includes("select jsonb_build_object('payment_method', ct.payment_method, 'amount_tendered', ct.amount_tendered)"),
    'auto tender mirror must select jsonb_build_object, not raw scalar columns'
  );
});

Deno.test('SERP-088 regression: managerial-seat approval gate only references seat codes that exist in the canonical vocabulary (DEC-008/202608210009)', () => {
  const migrationUrl = new URL('202609192400_serp088_counter_return_refund_void.sql', EDGE_MIGRATIONS);
  const sql = Deno.readTextFileSync(migrationUrl);

  // Canonical seat vocabulary per 202608210009_seat_vocabulary.sql (DEC-008).
  const CANONICAL_SEAT_CODES = new Set([
    'owner', 'managing_director', 'director', 'financial_controller',
    'quartermaster', 'receiver', 'payer', 'counter',
    'technician', 'qc_signer', 'stores', 'ledger_poster',
  ]);

  const gateMatch = sql.match(/ms\.seat_code in \(([^)]*)\)/);
  assert(gateMatch, 'must find the managerial-seat approval gate seat_code in (...) predicate');

  const referencedCodes = gateMatch[1]
    .split(',')
    .map((c) => c.trim().replace(/^'|'$/g, ''));

  assert(referencedCodes.length > 0, 'approval gate must reference at least one seat code');
  for (const code of referencedCodes) {
    assert(
      CANONICAL_SEAT_CODES.has(code),
      `approval gate references seat code '${code}', which does not exist in the canonical seat vocabulary — this is exactly the class of bug (workshop_manager/general_manager) that crashed SERP-088 on a fresh org`
    );
  }

  // Explicitly guard against the two nonexistent codes that caused the original crash.
  assert(!sql.includes("'workshop_manager'"), "must not reference nonexistent seat code 'workshop_manager'");
  assert(!sql.includes("'general_manager'"), "must not reference nonexistent seat code 'general_manager'");
});

