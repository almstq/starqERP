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

Deno.test('ERP-540 Edge: fromLegacyBody correctly decodes PURCHASE commands and steps', () => {
  // need step
  const envNeed = fromLegacyBody({
    type: 'PURCHASE',
    scm_step: 'need',
    supplierId: '44444444-4444-4444-8444-444444444444',
    items: [{ description: 'Oil Filter', quantity: 10, unitPrice: 15.00 }],
  });
  assert(envNeed !== null);
  assertEquals(envNeed.contract, CONTRACT_VERSION);
  assertEquals(envNeed.command, 'PURCHASE');
  assertEquals(envNeed.step, 'need');
  assertEquals(envNeed.payload.supplierId, '44444444-4444-4444-8444-444444444444');

  // award step with action fallback
  const envAward = fromLegacyBody({
    type: 'PURCHASE',
    action: 'AWARD',
    purchase_order_id: '55555555-5555-4555-8555-555555555555',
  });
  assert(envAward !== null);
  assertEquals(envAward.contract, CONTRACT_VERSION);
  assertEquals(envAward.command, 'PURCHASE');
  assertEquals(envAward.step, 'award');

  // SOP key fallback
  const envSop = fromLegacyBody({
    sop: 'purchase',
    scm_step: 'quote',
  });
  assert(envSop !== null);
  assertEquals(envSop.contract, CONTRACT_VERSION);
  assertEquals(envSop.command, 'PURCHASE');
  assertEquals(envSop.step, 'quote');
});

Deno.test('ERP-540 Edge: authorizeCommand strictly requires a valid step for PURCHASE', () => {
  const p = makePrincipal('financial_controller');

  // Missing step
  const noStep: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    payload: {},
    csrf: 'test',
  };
  assertEquals(authorizeCommand(p, noStep), { ok: false, error: 'step_required' });

  // Invalid step
  const invalidStep: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'invalid_step' as any,
    payload: {},
    csrf: 'test',
  };
  assertEquals(authorizeCommand(p, invalidStep), { ok: false, error: 'step_not_permitted' });
});

Deno.test('ERP-540 Edge: authorizeCommand enforces PURCHASE/need seat permissions', () => {
  const envNeed: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'need',
    payload: {},
    csrf: 'test',
  };

  // Legal seats for need
  const legalSeats: SeatCode[] = [
    'counter',
    'technician',
    'quartermaster',
    'stores',
    'managing_director',
    'director',
    'financial_controller',
  ];

  for (const seat of legalSeats) {
    const p = makePrincipal(seat);
    const auth = authorizeCommand(p, envNeed);
    assert(auth.ok, `Expected seat ${seat} to be authorized for PURCHASE/need`);
  }

  // Illegal seats for need
  const illegalSeats: SeatCode[] = ['receiver', 'payer'];
  for (const seat of illegalSeats) {
    const p = makePrincipal(seat);
    const auth = authorizeCommand(p, envNeed);
    assertEquals(auth, { ok: false, error: 'seat_not_authorized' }, `Expected seat ${seat} to be refused for PURCHASE/need`);
  }
});

Deno.test('ERP-540 Edge: authorizeCommand enforces PURCHASE/award seat permissions', () => {
  const envAward: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'award',
    payload: {},
    csrf: 'test',
  };

  // Only financial_controller can award
  const fc = makePrincipal('financial_controller');
  assert(authorizeCommand(fc, envAward).ok);

  const nonFcSeats: SeatCode[] = ['counter', 'technician', 'quartermaster', 'stores', 'receiver', 'payer'];
  for (const seat of nonFcSeats) {
    const p = makePrincipal(seat);
    assertEquals(authorizeCommand(p, envAward), { ok: false, error: 'seat_not_authorized' });
  }
});

Deno.test('ERP-540 Edge: cross-tenant access is refused fail-closed', () => {
  const p = makePrincipal('quartermaster', ['quartermaster'], tenantA);
  const envNeed: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'need',
    payload: {},
    csrf: 'test',
  };

  // Target belongs to tenant B
  const auth = authorizeCommand(p, envNeed, { tenantOfTarget: tenantB });
  assertEquals(auth, { ok: false, error: 'cross_tenant_denied' });

  // Missing tenant
  const noTenant: Principal = { ...p, organisationId: '' };
  assertEquals(authorizeCommand(noTenant, envNeed), { ok: false, error: 'tenant_not_resolved' });
});

Deno.test('ERP-540 Edge: unheld seat is refused even if seat is legal for command', () => {
  // Principal holds 'counter' but attempts to act as 'quartermaster'
  const p = makePrincipal('quartermaster', ['counter'], tenantA);
  const envNeed: CommandEnvelope = {
    contract: CONTRACT_VERSION,
    command: 'PURCHASE',
    step: 'need',
    payload: {},
    csrf: 'test',
  };

  assertEquals(authorizeCommand(p, envNeed), { ok: false, error: 'seat_not_authorized' });
});
