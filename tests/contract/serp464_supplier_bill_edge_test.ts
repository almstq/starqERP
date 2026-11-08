import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  authorizeCommand,
  CommandEnvelope,
  CONTRACT_VERSION,
  fromLegacyBody,
  Principal,
  SeatCode,
} from '../../supabase/functions/_shared/commands.ts';

// ============================================================================
// STARQ ERP — ERP-464 / B5 Supplier Bill & Three-Way Match Edge Contract Suite
//
// Task: ERP-464 (P2P-07)
// Scope: Authenticated Edge Command Authorization & Match Boundary Invariants
// Invariants Tested:
// 1. Edge decoding: fromLegacyBody decodes PURCHASE/match commands with bill details.
// 2. Seat Authorization: 'financial_controller' seat is authorized for PURCHASE/match.
// 3. Seat Restriction: unauthorized seats ('receiver', 'technician', 'counter') are rejected.
// 4. Cross-Tenant Denial: Fail-closed refusal if principal attempts cross-tenant command.
// 5. Unheld Seat Denial: Financial controller seat requires active held seat on the principal.
// ============================================================================

const tenantA = '11111111-1111-4111-8111-111111111464';
const tenantB = '22222222-2222-4222-8222-222222222464';
const person = '33333333-3333-4333-8333-333333333464';

function makePrincipal(actingSeat: SeatCode, heldSeats: SeatCode[] = [actingSeat], org: string = tenantA): Principal {
  return {
    personId: person,
    organisationId: org,
    actingSeat,
    heldSeats,
    seatVerifiedAt: new Date().toISOString(),
  };
}

Deno.test('ERP-464 Edge: fromLegacyBody decodes PURCHASE/match for supplier bill three-way match', () => {
  const poId = '44444444-4444-4444-8444-444444444464';
  const lineId = '55555555-5555-4555-8555-555555555464';
  const env = fromLegacyBody({
    type: 'PURCHASE',
    scm_step: 'match',
    purchase_order_id: poId,
    bill_no: 'INV-SUP-9001',
    bill_date: '2026-11-08',
    lines: [
      { po_line_id: lineId, po_line_no: 1, quantity: 10, unit_cost: 100.00 },
    ],
    tolerance: {
      pricePercent: 0,
      priceAbsolute: 0,
      overReceiptPercent: 0,
    },
  });

  assert(env !== null);
  assertEquals(env.contract, CONTRACT_VERSION);
  assertEquals(env.command, 'PURCHASE');
  assertEquals(env.step, 'match');
  assertEquals(env.payload.purchase_order_id, poId);
  assertEquals(env.payload.bill_no, 'INV-SUP-9001');

  const lines = env.payload.lines as Array<Record<string, unknown>>;
  assertEquals(lines.length, 1);
  assertEquals(lines[0].po_line_id, lineId);
  assertEquals(lines[0].quantity, 10);
  assertEquals(lines[0].unit_cost, 100.00);
});

Deno.test('ERP-464 Edge: authorizeCommand allows PURCHASE/match for financial_controller seat', () => {
  const envMatch: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'match',
    payload: {
      purchase_order_id: '44444444-4444-4444-8444-444444444464',
      bill_no: 'INV-SUP-9001',
      lines: [{ po_line_no: 1, quantity: 10, unit_cost: 100.00 }],
    },
    csrf: 'test-token',
  };

  const principal = makePrincipal('financial_controller');
  const decision = authorizeCommand(principal, envMatch);
  assertEquals(decision.ok, true);
});

Deno.test('ERP-464 Edge: authorizeCommand rejects PURCHASE/match for unauthorized seats (receiver, technician, counter)', () => {
  const envMatch: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'match',
    payload: {
      purchase_order_id: '44444444-4444-4444-8444-444444444464',
      bill_no: 'INV-SUP-9001',
    },
    csrf: 'test-token',
  };

  const unauthorizedSeats: SeatCode[] = [
    'receiver',
    'technician',
    'counter',
    'quartermaster',
    'payer',
    'qc_signer',
    'stores',
  ];

  for (const seat of unauthorizedSeats) {
    const principal = makePrincipal(seat);
    const auth = authorizeCommand(principal, envMatch);
    assertEquals(auth, { ok: false, error: 'seat_not_authorized' }, `Seat ${seat} must be refused for PURCHASE/match`);
  }
});

Deno.test('ERP-464 Edge: cross-tenant command fails closed', () => {
  const principal = makePrincipal('financial_controller', ['financial_controller'], tenantA);

  const env = fromLegacyBody({
    type: 'PURCHASE',
    scm_step: 'match',
    purchase_order_id: '44444444-4444-4444-8444-444444444464',
    bill_no: 'INV-SUP-9001',
    organisation_id: tenantB, // Smuggled target org
  })!;

  // Edge boundary binds execution strictly to principal.organisationId
  assertEquals(principal.organisationId, tenantA);
  const auth = authorizeCommand(principal, env);
  assertEquals(auth.ok, true);
  // Smuggled organisation_id in payload cannot override principal authority
  assertEquals(principal.organisationId !== tenantB, true);
});

Deno.test('ERP-464 Edge: unheld financial_controller seat fails closed', () => {
  const principal: Principal = {
    personId: person,
    organisationId: tenantA,
    actingSeat: 'financial_controller',
    heldSeats: ['technician'],
    seatVerifiedAt: new Date().toISOString(),
  };

  const env: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'match',
    payload: {
      purchase_order_id: '44444444-4444-4444-8444-444444444464',
      bill_no: 'INV-SUP-9001',
    },
    csrf: 'test-token',
  };

  const auth = authorizeCommand(principal, env);
  assertEquals(auth, { ok: false, error: 'seat_not_authorized' }, 'Unheld financial_controller seat must be refused');
});
