import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  CONTRACT_VERSION,
  preparePriceListCommandForEdge,
  type Principal,
} from '../supabase/functions/_shared/commands.ts';

const tenant = '11111111-1111-4111-8111-111111111111';
const person = '22222222-2222-4222-8222-222222222222';
const product = '33333333-3333-4333-8333-333333333333';

const admin: Principal = {
  personId: person,
  organisationId: tenant,
  actingSeat: 'managing_director',
  heldSeats: ['managing_director'],
  seatVerifiedAt: '2026-09-09T00:00:00.000Z',
};

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'PRICE_LIST',
    action: 'create',
    code: 'trade_15',
    name: 'Trade 15',
    description: 'Authenticated boundary fixture',
    discount_percent: 15,
    overrides: [{ product_id: product, unit_price: 42 }],
    ...overrides,
  };
}

Deno.test('SERP-314 Gap 2 executable authenticated Edge boundary accepts admin create', () => {
  const result = preparePriceListCommandForEdge(body(), admin);
  assert(result.ok);
  assertEquals(result.intent.contract, CONTRACT_VERSION);
  assertEquals(result.intent.command, 'PRICE_LIST');
  assertEquals(result.intent.step, undefined);
  assertEquals(result.intent.payload.action, 'create');
});

Deno.test('SERP-314 Gap 2 executable boundary rejects non-admin and malformed requests', () => {
  const counter: Principal = { ...admin, actingSeat: 'counter', heldSeats: ['counter'] };
  assertEquals(preparePriceListCommandForEdge(body(), counter), {
    ok: false,
    error: 'seat_not_authorized',
    status: 403,
  });
  assertEquals(preparePriceListCommandForEdge(body({ description: 'x'.repeat(1001) }), admin), {
    ok: false,
    error: 'price_list_description_invalid',
    status: 400,
  });
});

Deno.test('SERP-314 Gap 2 boundary refuses tenantless principals and preserves domain actions', () => {
  assertEquals(preparePriceListCommandForEdge(body(), { ...admin, organisationId: '' }), {
    ok: false,
    error: 'tenant_not_resolved',
    status: 403,
  });
  const update = preparePriceListCommandForEdge(body({
    action: 'update',
    price_list_id: '44444444-4444-4444-8444-444444444444',
    expected_version: 1,
  }), admin);
  assert(update.ok);
  assertEquals(update.intent.step, undefined);
  assertEquals(update.intent.payload.action, 'update');
});
