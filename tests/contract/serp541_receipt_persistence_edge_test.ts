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

Deno.test('ERP-541 Edge: fromLegacyBody correctly decodes PURCHASE/receive commands and payload aliases', () => {
  // scm_step receive with purchase_order_id and items
  const env1 = fromLegacyBody({
    type: 'PURCHASE',
    scm_step: 'receive',
    purchase_order_id: '44444444-4444-4444-8444-444444444444',
    items: [{ product_id: '55555555-5555-4555-8555-555555555555', quantity: 5, unit_cost: 20.00 }],
  });
  assert(env1 !== null);
  assertEquals(env1.contract, CONTRACT_VERSION);
  assertEquals(env1.command, 'PURCHASE');
  assertEquals(env1.step, 'receive');
  assertEquals(env1.payload.purchase_order_id, '44444444-4444-4444-8444-444444444444');

  // poId alias with action receive
  const env2 = fromLegacyBody({
    type: 'PURCHASE',
    action: 'RECEIVE',
    poId: '44444444-4444-4444-8444-444444444444',
  });
  assert(env2 !== null);
  assertEquals(env2.contract, CONTRACT_VERSION);
  assertEquals(env2.command, 'PURCHASE');
  assertEquals(env2.step, 'receive');
  assertEquals(env2.payload.poId, '44444444-4444-4444-8444-444444444444');

  // SOP key fallback
  const env3 = fromLegacyBody({
    sop: 'purchase',
    scm_step: 'receive',
    document_id: '44444444-4444-4444-8444-444444444444',
  });
  assert(env3 !== null);
  assertEquals(env3.contract, CONTRACT_VERSION);
  assertEquals(env3.command, 'PURCHASE');
  assertEquals(env3.step, 'receive');
});

Deno.test('ERP-541 Edge: authorizeCommand enforces PURCHASE/receive seat permissions', () => {
  const envReceive: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'receive',
    payload: {},
    csrf: 'test',
  };

  // Only receiver seat is authorized per PURCHASE_STEP_SEATS.receive
  const receiver = makePrincipal('receiver');
  assert(authorizeCommand(receiver, envReceive).ok, 'receiver seat must be authorized for PURCHASE/receive');

  // Illegal seats for receive
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
    assertEquals(auth, { ok: false, error: 'seat_not_authorized' }, `Expected seat ${seat} to be refused for PURCHASE/receive`);
  }
});

Deno.test('ERP-541 Edge: cross-tenant receive access is refused fail-closed', () => {
  const p = makePrincipal('receiver', ['receiver'], tenantA);
  const envReceive: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'receive',
    payload: {},
    csrf: 'test',
  };

  // Target belongs to tenant B
  const auth = authorizeCommand(p, envReceive, { tenantOfTarget: tenantB });
  assertEquals(auth, { ok: false, error: 'cross_tenant_denied' });

  // Missing tenant
  const noTenant: Principal = { ...p, organisationId: '' };
  assertEquals(authorizeCommand(noTenant, envReceive), { ok: false, error: 'tenant_not_resolved' });
});

Deno.test('ERP-541 Edge: unheld seat is refused even if seat is legal for command', () => {
  // Principal holds 'counter' but attempts to act as 'receiver'
  const p = makePrincipal('receiver', ['counter'], tenantA);
  const envReceive: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'receive',
    payload: {},
    csrf: 'test',
  };

  assertEquals(authorizeCommand(p, envReceive), { ok: false, error: 'seat_not_authorized' });
});

Deno.test('ERP-541 Edge: fromLegacyBody preserves persisted PO line identities (po_line_id, po_line_no, subset items)', () => {
  const lineId1 = 'aaaa1111-1111-4111-8111-111111111111';
  const lineId2 = 'bbbb2222-2222-4222-8222-222222222222';
  const env = fromLegacyBody({
    type: 'PURCHASE',
    scm_step: 'receive',
    purchase_order_id: '44444444-4444-4444-8444-444444444444',
    items: [
      { po_line_id: lineId2, po_line_no: 2, quantity: 3 },
      { po_line_id: lineId1, po_line_no: 1, quantity: 10 },
    ],
  });
  assert(env !== null);
  assertEquals(env.command, 'PURCHASE');
  assertEquals(env.step, 'receive');
  const items = env.payload.items as Array<Record<string, unknown>>;
  assertEquals(items.length, 2);
  assertEquals(items[0].po_line_id, lineId2);
  assertEquals(items[0].po_line_no, 2);
  assertEquals(items[1].po_line_id, lineId1);
  assertEquals(items[1].po_line_no, 1);
});

