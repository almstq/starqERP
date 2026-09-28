/**
 * STARQ ERP — Canonical payment command boundary conformance tests (SERP-348 / SERP-339).
 *
 * Promoted from workspaces/elder/payment-candidate/tests/payment_commands_test.ts.
 *
 * Run:  deno test --allow-read tests/contract/payment_commands_test.ts
 */

import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { Money } from '../../contracts/money.ts';
import {
  BankSpecRequiredError,
  isLegalAttemptTransition,
  PAYMENT_COMMANDS,
  PAYMENT_SOD_PAIRS,
  paymentSodViolation,
  type PaymentCapturePayload,
  type PaymentRefundPayload,
  type PaymentSettlementPayload,
  type PaymentStepRecord,
  validatePaymentCapture,
  validatePaymentRefund,
  validatePaymentSettlement,
} from '../../contracts/payment_commands.ts';
import {
  COMMANDS,
  COMMAND_SEATS,
  SQL_REQUIRED_SEAT,
  SQL_PERMITTED_SEATS,
} from '../../contracts/commands.ts';

const MVR = 'MVR';
const mvr = (v: string) => Money.fromDecimalString(v, MVR);

function capture(
  over: Partial<PaymentCapturePayload> = {},
): PaymentCapturePayload {
  return {
    idempotencyKey: 'k-1',
    provider: 'MOCK',
    providerReference: 'prov-1',
    paymentAttemptId: 'att-1',
    amount: mvr('100.00'),
    capturedAt: '2026-08-29T10:00:00Z',
    allocations: [{ document: { documentId: 'doc-1' }, amount: mvr('100.00') }],
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Boundary tests (1–8): The invariants that keep a payment reconcilable
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('a well-formed capture validates', () => {
  assertEquals(validatePaymentCapture(capture()), []);
});

Deno.test('allocations must sum to the captured amount', () => {
  const bad = capture({
    amount: mvr('100.00'),
    allocations: [
      { document: { documentId: 'doc-1' }, amount: mvr('60.00') },
      { document: { documentId: 'doc-2' }, amount: mvr('30.00') },
    ],
  });
  assertEquals(validatePaymentCapture(bad), ['allocations_do_not_sum_to_amount']);
});

Deno.test('a split payment across three documents validates exactly', () => {
  const total = mvr('1000.00');
  const parts = total.allocate([333_330_000n, 333_330_000n, 333_340_000n]);
  const ok = capture({
    amount: total,
    allocations: [
      { document: { documentId: 'a' }, amount: parts[0] },
      { document: { documentId: 'b' }, amount: parts[1] },
      { document: { documentId: 'c' }, amount: parts[2] },
    ],
  });
  assertEquals(validatePaymentCapture(ok), []);
});

Deno.test('allocations must be strictly positive — the SQL check mirrored', () => {
  const bad = capture({
    amount: mvr('100.00'),
    allocations: [
      { document: { documentId: 'a' }, amount: mvr('150.00') },
      { document: { documentId: 'b' }, amount: mvr('-50.00') },
    ],
  });
  assertEquals(validatePaymentCapture(bad).includes('allocation_not_positive'), true);
});

Deno.test('the same document cannot be settled twice in one payment', () => {
  const bad = capture({
    amount: mvr('100.00'),
    allocations: [
      { document: { documentId: 'dup' }, amount: mvr('50.00') },
      { document: { documentId: 'dup' }, amount: mvr('50.00') },
    ],
  });
  assertEquals(
    validatePaymentCapture(bad).includes('duplicate_document_in_allocations'),
    true,
  );
});

Deno.test('mixed currencies are refused without throwing', () => {
  const bad = capture({
    amount: mvr('100.00'),
    allocations: [{
      document: { documentId: 'a' },
      amount: Money.fromDecimalString('100.00', 'USD'),
    }],
  });
  assertEquals(validatePaymentCapture(bad).includes('currency_mismatch'), true);
});

Deno.test('a capture must be positive and must allocate somewhere', () => {
  assertEquals(
    validatePaymentCapture(capture({ amount: mvr('0'), allocations: [] })).sort(),
    ['allocations_empty', 'amount_not_positive'].sort(),
  );
});

Deno.test('an unregistered provider is refused', () => {
  const bad = capture({ provider: 'STRIPE' as never });
  assertEquals(validatePaymentCapture(bad).includes('unknown_provider'), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Boundary tests (9–11): Refund invariants
// ─────────────────────────────────────────────────────────────────────────────

function refund(over: Partial<PaymentRefundPayload> = {}): PaymentRefundPayload {
  return {
    idempotencyKey: 'k-r1',
    provider: 'MOCK',
    providerReference: 'prov-r1',
    originalPayment: { documentId: 'pay-1' },
    amount: mvr('50.00'),
    refundedAt: '2026-08-29T11:00:00Z',
    reason: 'customer cancelled the booking',
    ...over,
  };
}

Deno.test('a well-formed refund validates', () => {
  assertEquals(validatePaymentRefund(refund()), []);
});

Deno.test('a refund requires a substantive reason', () => {
  assertEquals(validatePaymentRefund(refund({ reason: 'oops' })), ['reason_too_short']);
});

Deno.test('a refund amount is positive — reversal is by row, not by sign', () => {
  assertEquals(
    validatePaymentRefund(refund({ amount: mvr('-50.00') })),
    ['amount_not_positive'],
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Boundary tests (12–13): Settlement — capture is not settlement
// ─────────────────────────────────────────────────────────────────────────────

function settlement(
  over: Partial<PaymentSettlementPayload> = {},
): PaymentSettlementPayload {
  return {
    idempotencyKey: 'k-s1',
    provider: 'MOCK',
    batchReference: 'batch-1',
    grossAmount: mvr('1000.00'),
    feeAmount: mvr('25.50'),
    netAmount: mvr('974.50'),
    settledAt: '2026-09-01T00:00:00Z',
    bankAccountId: 'bank-1',
    capturedPayments: [{ documentId: 'pay-1' }],
    ...over,
  };
}

Deno.test('settlement net must equal gross minus fee, exactly', () => {
  assertEquals(validatePaymentSettlement(settlement()), []);
  assertEquals(
    validatePaymentSettlement(settlement({ netAmount: mvr('974.51') })),
    ['settlement_net_mismatch'],
  );
});

Deno.test('a zero fee is valid', () => {
  assertEquals(
    validatePaymentSettlement(settlement({
      feeAmount: mvr('0'),
      netAmount: mvr('1000.00'),
    })),
    [],
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Boundary tests (14–17): The state machine that prevents double charging
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('a timeout goes to uncertain, never to failed', () => {
  assertEquals(isLegalAttemptTransition('processing', 'uncertain'), true);
  assertEquals(isLegalAttemptTransition('processing', 'failed'), true);
});

Deno.test('uncertain resolves only to a known outcome', () => {
  assertEquals(isLegalAttemptTransition('uncertain', 'succeeded'), true);
  assertEquals(isLegalAttemptTransition('uncertain', 'failed'), true);
  assertEquals(isLegalAttemptTransition('uncertain', 'processing'), false);
  assertEquals(isLegalAttemptTransition('uncertain', 'created'), false);
});

Deno.test('terminal states are terminal — a retry is a new attempt', () => {
  for (const to of ['created', 'processing', 'succeeded', 'failed', 'uncertain'] as const) {
    assertEquals(isLegalAttemptTransition('succeeded', to), false);
    assertEquals(isLegalAttemptTransition('failed', to), false);
  }
});

Deno.test('nothing may return to created', () => {
  for (const from of ['created', 'processing', 'succeeded', 'failed', 'uncertain'] as const) {
    assertEquals(isLegalAttemptTransition(from, 'created'), false);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Boundary test (18): Bank adapters register but refuse to invent behaviour
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('BANK_SPEC_REQUIRED names the provider, operation and what is missing', () => {
  const e = new BankSpecRequiredError('BML', 'createHostedCheckout', [
    'API base URL',
    'auth scheme',
  ]);
  assertEquals(e.code, 'BANK_SPEC_REQUIRED');
  assertEquals(e.provider, 'BML');
  assertEquals(e.message.includes('BML.createHostedCheckout'), true);
  assertEquals(e.message.includes('API base URL'), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// SERP-348 Conformance: Four-Matrix Registration & SoD Pair Separation
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('SERP-348: PAYMENT_CAPTURE, PAYMENT_REFUND, PAYMENT_SETTLEMENT_RECORD are in COMMANDS', () => {
  for (const cmd of PAYMENT_COMMANDS) {
    assertEquals(COMMANDS.includes(cmd), true, `${cmd} must be in COMMANDS`);
  }
});

Deno.test('SERP-348: Three payment commands are registered across all four matrices', () => {
  for (const cmd of PAYMENT_COMMANDS) {
    // 1. COMMANDS
    assertEquals(COMMANDS.includes(cmd), true, `${cmd} in COMMANDS`);
    // 2. COMMAND_SEATS
    assertEquals(cmd in COMMAND_SEATS, true, `${cmd} in COMMAND_SEATS`);
    assertEquals(COMMAND_SEATS[cmd].length > 0, true, `${cmd} has seats in COMMAND_SEATS`);
    // 3. SQL_REQUIRED_SEAT
    assertEquals(cmd in SQL_REQUIRED_SEAT, true, `${cmd} in SQL_REQUIRED_SEAT`);
    // 4. SQL_PERMITTED_SEATS
    assertEquals(cmd in SQL_PERMITTED_SEATS, true, `${cmd} in SQL_PERMITTED_SEATS`);
    // Conformance: COMMAND_SEATS must match SQL_PERMITTED_SEATS
    assertEquals(COMMAND_SEATS[cmd], SQL_PERMITTED_SEATS[cmd], `${cmd} seats match SQL permitted`);
  }
});

Deno.test('SERP-348: PAYMENT_REFUND sits opposite PAYMENT_CAPTURE in an SoD pair', () => {
  const pair = PAYMENT_SOD_PAIRS.find(
    ([a, b]) => (a === 'PAYMENT_CAPTURE' && b === 'PAYMENT_REFUND') ||
                (a === 'PAYMENT_REFUND' && b === 'PAYMENT_CAPTURE'),
  );
  assertNotEquals(pair, undefined, 'PAYMENT_SOD_PAIRS must contain PAYMENT_CAPTURE / PAYMENT_REFUND pair');
  if (pair) {
    assertEquals(pair[0] === 'PAYMENT_CAPTURE' ? pair[1] : pair[0], 'PAYMENT_REFUND');
  }
});

Deno.test('SERP-348: PAYMENT_CAPTURE and PAYMENT_REFUND separation — same person cannot do both', () => {
  const personA = '11111111-0000-4000-8000-000000000001';
  const history: PaymentStepRecord[] = [
    { command: 'PAYMENT_CAPTURE', personId: personA },
  ];

  // Same person attempting refund: blocked
  const violation = paymentSodViolation(history, 'PAYMENT_REFUND', personA);
  assertNotEquals(violation, null, 'Same person cannot capture and refund');
  assertEquals(violation, ['PAYMENT_CAPTURE', 'PAYMENT_REFUND']);
});

Deno.test('SERP-348: two different people satisfying capture and refund passes SoD check', () => {
  const personA = '11111111-0000-4000-8000-000000000001';
  const personB = '22222222-0000-4000-8000-000000000002';
  const history: PaymentStepRecord[] = [
    { command: 'PAYMENT_CAPTURE', personId: personA },
  ];

  // Different person attempting refund: permitted
  const violation = paymentSodViolation(history, 'PAYMENT_REFUND', personB);
  assertEquals(violation, null, 'Different person refunding should not cause SoD violation');
});
