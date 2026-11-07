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
  seatsForCommand,
} from '../../supabase/functions/_shared/commands.ts';

// ============================================================================
// STARQ ERP — ERP-544 / B2a GRNI Accrual Edge Boundary Contract Suite
//
// Task: ERP-454 / W0-C (ERP-544)
// Scope: Authenticated Edge Command Authorization & Invariant Enforcement
// Invariants Tested:
// 1. Edge decoding: fromLegacyBody decodes PURCHASE/receive commands.
// 2. Seat Authorization: 'receiver' seat is authorized; unauthorized seats are rejected.
// 3. Cross-Tenant Denial: Fail-closed refusal if receiver attempts cross-tenant command.
// 4. Unheld Seat Denial: Receiver seat requires active held seat on the principal.
// ============================================================================

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const person = '33333333-3333-4333-8333-333333333333';

function makePrincipal(actingSeat: SeatCode, heldSeats: SeatCode[] = [actingSeat], org: string = tenantA): Principal {
  return {
    personId: person,
    organisationId: org,
    actingSeat,
    heldSeats,
    seatVerifiedAt: new Date().toISOString(),
  };
}

Deno.test('ERP-544 Edge: fromLegacyBody decodes PURCHASE/receive for B2a GRNI accrual pipeline', () => {
  const poId = '44444444-4444-4444-8444-444444444444';
  const lineId = '55555555-5555-4555-8555-555555555555';
  const env = fromLegacyBody({
    type: 'PURCHASE',
    scm_step: 'receive',
    purchase_order_id: poId,
    delivery_note_ref: 'DN-GRNI-001',
    items: [
      { po_line_id: lineId, po_line_no: 1, quantity: 5, unit_cost: 25.00 },
    ],
  });

  assert(env !== null);
  assertEquals(env.contract, CONTRACT_VERSION);
  assertEquals(env.command, 'PURCHASE');
  assertEquals(env.step, 'receive');
  assertEquals(env.payload.purchase_order_id, poId);
  assertEquals(env.payload.delivery_note_ref, 'DN-GRNI-001');

  const items = env.payload.items as Array<Record<string, unknown>>;
  assertEquals(items.length, 1);
  assertEquals(items[0].po_line_id, lineId);
  assertEquals(items[0].quantity, 5);
  assertEquals(items[0].unit_cost, 25.00);
});

Deno.test('ERP-544 Edge: authorizeCommand restricts PURCHASE/receive to receiver seat only', () => {
  const envReceive: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'receive',
    payload: {},
    csrf: 'test-token',
  };

  const receiver = makePrincipal('receiver');
  assert(authorizeCommand(receiver, envReceive).ok, 'receiver seat must be authorized for PURCHASE/receive');

  const illegalSeats: SeatCode[] = [
    'quartermaster',
    'financial_controller',
    'counter',
    'technician',
    'stores',
    'payer',
    'director',
    'managing_director',
    'owner',
  ];

  for (const seat of illegalSeats) {
    const p = makePrincipal(seat);
    const auth = authorizeCommand(p, envReceive);
    assertEquals(auth, { ok: false, error: 'seat_not_authorized' }, `Seat ${seat} must be refused for PURCHASE/receive`);
  }
});

Deno.test('ERP-544 Edge: cross-tenant receive attempts fail closed', () => {
  const p = makePrincipal('receiver', ['receiver'], tenantA);
  const envReceive: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'receive',
    payload: {},
    csrf: 'test-token',
  };

  const auth = authorizeCommand(p, envReceive, { tenantOfTarget: tenantB });
  assertEquals(auth, { ok: false, error: 'cross_tenant_denied' });
});

Deno.test('ERP-544 Edge: unheld seat is refused even if seat is legal for command', () => {
  const p = makePrincipal('receiver', ['counter'], tenantA);
  const envReceive: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'receive',
    payload: {},
    csrf: 'test-token',
  };

  assertEquals(authorizeCommand(p, envReceive), { ok: false, error: 'seat_not_authorized' });
});
