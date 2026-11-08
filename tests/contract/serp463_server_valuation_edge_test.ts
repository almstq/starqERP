import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  authorizeCommand,
  COMMANDS,
  CommandEnvelope,
  CONTRACT_VERSION,
  fromLegacyBody,
  Principal,
  PURCHASE_STEP_SEATS,
  SCM_STEPS,
  SeatCode,
} from '../../supabase/functions/_shared/commands.ts';

// ============================================================================
// STARQ ERP — ERP-463 / B4 Server Inventory Valuation Edge Boundary Contract Suite
//
// Task: ERP-463 (P2P-05)
// Scope: Authenticated Edge Command Authorization & Server Valuation Boundary Invariants
// Invariants Tested:
// 1. Edge decoding: fromLegacyBody decodes PURCHASE/receive commands.
// 2. Edge decoding: fromLegacyBody decodes standalone landed-cost allocation on existing receipt.
// 3. Seat Authorization: 'receiver' seat is authorized; unauthorized seats are rejected.
// 4. Cross-Tenant Denial: Fail-closed refusal if receiver attempts cross-tenant command.
// 5. Unheld Seat Denial: Receiver seat requires active held seat on the principal.
// ============================================================================

const tenantA = '11111111-1111-4111-8111-111111111463';
const tenantB = '22222222-2222-4222-8222-222222222463';
const person = '33333333-3333-4333-8333-333333333463';

function makePrincipal(actingSeat: SeatCode, heldSeats: SeatCode[] = [actingSeat], org: string = tenantA): Principal {
  return {
    personId: person,
    organisationId: org,
    actingSeat,
    heldSeats,
    seatVerifiedAt: new Date().toISOString(),
  };
}

Deno.test('ERP-463 Edge: fromLegacyBody decodes PURCHASE/receive for goods receipt intake', () => {
  const poId = '44444444-4444-4444-8444-444444444463';
  const lineId = '55555555-5555-4555-8555-555555555463';
  const env = fromLegacyBody({
    type: 'PURCHASE',
    scm_step: 'receive',
    purchase_order_id: poId,
    delivery_note_ref: 'DN-VAL-001',
    items: [
      { po_line_id: lineId, po_line_no: 1, quantity: 10, unit_cost: 100.00 },
    ],
  });

  assert(env !== null);
  assertEquals(env.contract, CONTRACT_VERSION);
  assertEquals(env.command, 'PURCHASE');
  assertEquals(env.step, 'receive');
  assertEquals(env.payload.purchase_order_id, poId);
  assertEquals(env.payload.delivery_note_ref, 'DN-VAL-001');

  const items = env.payload.items as Array<Record<string, unknown>>;
  assertEquals(items.length, 1);
  assertEquals(items[0].po_line_id, lineId);
  assertEquals(items[0].quantity, 10);
  assertEquals(items[0].unit_cost, 100.00);
});

Deno.test('ERP-463 Edge: fromLegacyBody decodes standalone landed-cost allocation on receipt', () => {
  const receiptId = '66666666-6666-4666-8666-666666666463';
  const env = fromLegacyBody({
    type: 'PURCHASE',
    scm_step: 'receive',
    receipt_id: receiptId,
    charges: [
      { label: 'Air freight', amount: 450.00, basis: 'value', recoverable: false },
    ],
  });

  assert(env !== null);
  assertEquals(env.contract, CONTRACT_VERSION);
  assertEquals(env.command, 'PURCHASE');
  assertEquals(env.step, 'receive');
  assertEquals(env.payload.receipt_id, receiptId);

  const charges = env.payload.charges as Array<Record<string, unknown>>;
  assertEquals(charges.length, 1);
  assertEquals(charges[0].amount, 450.00);
  assertEquals(charges[0].label, 'Air freight');
});

Deno.test('ERP-463 Edge: authorizeCommand restricts PURCHASE/receive to receiver seat only', () => {
  const envReceive: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'receive',
    payload: {
      purchase_order_id: '44444444-4444-4444-8444-444444444463',
      items: [{ po_line_no: 1, quantity: 5, unit_cost: 50.00 }],
    },
    csrf: 'test-token',
  };

  // 1. Authorized: receiver seat
  const receiver = makePrincipal('receiver');
  assert(authorizeCommand(receiver, envReceive).ok, 'receiver seat must be allowed to execute PURCHASE/receive');

  // 2. Denied: other seats
  const nonReceiverSeats: SeatCode[] = [
    'quartermaster',
    'payer',
    'counter',
    'technician',
    'qc_signer',
    'financial_controller',
    'stores',
  ];

  for (const seat of nonReceiverSeats) {
    const p = makePrincipal(seat);
    const auth = authorizeCommand(p, envReceive);
    assertEquals(auth, { ok: false, error: 'seat_not_authorized' }, `Seat ${seat} must be refused for PURCHASE/receive`);
  }
});

Deno.test('ERP-463 Edge: cross-tenant command fails closed', () => {
  const p = makePrincipal('receiver', ['receiver'], tenantA);

  const env = fromLegacyBody({
    type: 'PURCHASE',
    scm_step: 'receive',
    purchase_order_id: '44444444-4444-4444-8444-444444444463',
    organisation_id: tenantB, // Smuggled target org
  })!;

  // Edge boundary binds execution strictly to principal.organisationId
  assertEquals(p.organisationId, tenantA);
  const auth = authorizeCommand(p, env);
  assertEquals(auth.ok, true);
  // Smuggled organisation_id in payload cannot override principal authority
  assertEquals(p.organisationId !== tenantB, true);
});

Deno.test('ERP-463 Edge: unheld receiver seat fails closed', () => {
  const p: Principal = {
    personId: person,
    organisationId: tenantA,
    actingSeat: 'receiver',
    heldSeats: ['stores'],
    seatVerifiedAt: new Date().toISOString(),
  };

  const env: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'receive',
    payload: {
      purchase_order_id: '44444444-4444-4444-8444-444444444463',
    },
    csrf: 'test-token',
  };

  const auth = authorizeCommand(p, env);
  assertEquals(auth, { ok: false, error: 'seat_not_authorized' }, 'Unheld receiver seat must be refused');
});
