/**
 * Test Suite: SERP-352 MOCK Payment Adapter and Intent/Attempt Lifecycle Engine.
 *
 * Verifies:
 *   1. Provider capability gating & BANK_SPEC_REQUIRED refusal
 *   2. Intent lifecycle & validation
 *   3. Attempt append-only creation & strict state machine
 *   4. Timeout / UNCERTAIN safety (no re-charge)
 *   5. Command boundary capture (PaymentCapturePayload validation)
 *   6. Refund ceiling & Segregation of Duties (opposite PaymentCapture)
 *   7. Settlement batching & balancing (gross - fee = net)
 *   8. Webhook ingress (verify signature -> deduplicate -> normalise -> enqueue)
 */

import { assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { Money } from '../../contracts/money.ts';
import {
  BankSpecRequiredError,
  DocumentRef,
  validatePaymentCapture,
  validatePaymentRefund,
  validatePaymentSettlement,
} from '../../contracts/payment_commands.ts';
import {
  BML_PROVIDER_CAPABILITIES,
  MIB_PROVIDER_CAPABILITIES,
  MOCK_PROVIDER_CAPABILITIES,
  MockPaymentAdapter,
} from '../../contracts/mock_payment_adapter.ts';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const CONFIG_MOCK = '22222222-2222-4222-8222-222222222222';
const PERSON_ALICE = 'aaaaaaaa-1111-4111-8111-111111111111';
const PERSON_BOB = 'bbbbbbbb-2222-4222-8222-222222222222';

// ── 1. Provider Capabilities & Safety Gating ─────────────────────────────────

Deno.test('SERP-352: MOCK is executable; BML and MIB are BANK_SPEC_REQUIRED', () => {
  const adapter = new MockPaymentAdapter();
  const caps = adapter.getCapabilities();
  assertEquals(caps.provider, 'MOCK');
  assertEquals(caps.executable, true);
  assertEquals(caps.specStatus, 'IMPLEMENTED');

  assertEquals(BML_PROVIDER_CAPABILITIES.executable, false);
  assertEquals(BML_PROVIDER_CAPABILITIES.specStatus, 'BANK_SPEC_REQUIRED');
  assertEquals(MIB_PROVIDER_CAPABILITIES.executable, false);
  assertEquals(MIB_PROVIDER_CAPABILITIES.specStatus, 'BANK_SPEC_REQUIRED');

  assertThrows(
    () => MockPaymentAdapter.assertExecutable('BML', 'createIntent'),
    BankSpecRequiredError,
    'BANK_SPEC_REQUIRED: BML.createIntent',
  );

  assertThrows(
    () => MockPaymentAdapter.assertExecutable('MIB', 'createAttempt'),
    BankSpecRequiredError,
    'BANK_SPEC_REQUIRED: MIB.createAttempt',
  );
});

// ── 2. Intent Creation & Invariants ──────────────────────────────────────────

Deno.test('SERP-352: Payment Intent lifecycle creation', () => {
  const adapter = new MockPaymentAdapter();
  const amount = Money.fromDecimalString('500.00', 'MVR');

  const intent = adapter.createIntent({
    organisationId: ORG_A,
    configId: CONFIG_MOCK,
    amount,
    createdBy: PERSON_ALICE,
  });

  assertEquals(intent.status, 'created');
  assertEquals(intent.organisationId, ORG_A);
  assertEquals(intent.configId, CONFIG_MOCK);
  assertEquals(intent.currency, 'MVR');
  assertEquals(intent.amount.equals(amount), true);

  // Negative or zero amount is refused
  assertThrows(
    () =>
      adapter.createIntent({
        organisationId: ORG_A,
        configId: CONFIG_MOCK,
        amount: Money.zero('MVR'),
        createdBy: PERSON_ALICE,
      }),
    Error,
    'payment intent amount must be positive',
  );

  // Unsupported currency refused
  assertThrows(
    () =>
      adapter.createIntent({
        organisationId: ORG_A,
        configId: CONFIG_MOCK,
        amount: Money.fromDecimalString('100.00', 'EUR'),
        createdBy: PERSON_ALICE,
      }),
    Error,
    'unsupported currency EUR',
  );
});

// ── 3. Attempt State Machine & Timeout / UNCERTAIN Safety ─────────────────────

Deno.test('SERP-352: Attempt state machine: created -> processing -> succeeded', () => {
  const adapter = new MockPaymentAdapter();
  const intent = adapter.createIntent({
    organisationId: ORG_A,
    configId: CONFIG_MOCK,
    amount: Money.fromDecimalString('250.00', 'MVR'),
    createdBy: PERSON_ALICE,
  });

  const attempt = adapter.createAttempt({ intent });
  assertEquals(attempt.status, 'created');
  assertEquals(attempt.providerReference.startsWith('MOCK-ATT-'), true);

  adapter.transitionAttempt(attempt, 'processing');
  assertEquals(attempt.status, 'processing');

  adapter.transitionAttempt(attempt, 'succeeded');
  assertEquals(attempt.status, 'succeeded');

  // Terminal states cannot transition
  assertThrows(
    () => adapter.transitionAttempt(attempt, 'failed'),
    Error,
    'illegal attempt transition succeeded -> failed',
  );
  assertThrows(
    () => adapter.transitionAttempt(attempt, 'created'),
    Error,
    'illegal attempt transition succeeded -> created',
  );
});

Deno.test('SERP-352: Attempt timeout produces UNCERTAIN; cannot re-enter processing', () => {
  const adapter = new MockPaymentAdapter();
  const intent = adapter.createIntent({
    organisationId: ORG_A,
    configId: CONFIG_MOCK,
    amount: Money.fromDecimalString('1500.00', 'MVR'),
    createdBy: PERSON_ALICE,
  });

  const attempt = adapter.createAttempt({ intent });
  adapter.transitionAttempt(attempt, 'processing');

  // Transition to uncertain requires timestamp
  assertThrows(
    () => adapter.transitionAttempt(attempt, 'uncertain'),
    Error,
    'requires uncertainSince timestamp',
  );

  const timeoutTime = new Date().toISOString();
  adapter.transitionAttempt(attempt, 'uncertain', { uncertainSince: timeoutTime });
  assertEquals(attempt.status, 'uncertain');
  assertEquals(attempt.uncertainSince, timeoutTime);

  // Re-entering processing from uncertain is STRICTLY PROHIBITED (prevents double charge)
  assertThrows(
    () => adapter.transitionAttempt(attempt, 'processing'),
    Error,
    'illegal attempt transition uncertain -> processing',
  );

  // Uncertain may only resolve to succeeded or failed
  adapter.transitionAttempt(attempt, 'succeeded');
  assertEquals(attempt.status, 'succeeded');
  assertEquals(attempt.uncertainSince, undefined);
});

Deno.test('SERP-352: Append-only attempts — retrying creates a NEW attempt', () => {
  const adapter = new MockPaymentAdapter();
  const intent = adapter.createIntent({
    organisationId: ORG_A,
    configId: CONFIG_MOCK,
    amount: Money.fromDecimalString('300.00', 'MVR'),
    createdBy: PERSON_ALICE,
  });

  const attempt1 = adapter.createAttempt({ intent });
  adapter.transitionAttempt(attempt1, 'processing');
  adapter.transitionAttempt(attempt1, 'failed', {
    failureCode: 'CARD_DECLINED',
    failureMessage: 'Insufficient funds in test card',
  });
  assertEquals(attempt1.status, 'failed');

  // Retry creates a second distinct attempt on the same intent
  const attempt2 = adapter.createAttempt({ intent });
  assertEquals(attempt2.status, 'created');
  assertEquals(attempt2.id !== attempt1.id, true);
  assertEquals(attempt2.providerReference !== attempt1.providerReference, true);

  // First attempt remains failed and unchanged
  assertEquals(attempt1.status, 'failed');
  assertEquals(attempt1.failureCode, 'CARD_DECLINED');
});

// ── 4. Payment Capture Egress (Command Boundary) ─────────────────────────────

Deno.test('SERP-352: Payment Capture emits valid PaymentCapturePayload without direct ledger write', () => {
  const adapter = new MockPaymentAdapter();
  const intent = adapter.createIntent({
    organisationId: ORG_A,
    configId: CONFIG_MOCK,
    amount: Money.fromDecimalString('1000.00', 'MVR'),
    createdBy: PERSON_ALICE,
  });

  const attempt = adapter.createAttempt({ intent });
  const docRef: DocumentRef = { documentId: 'cccccccc-1111-4111-8111-111111111111' };

  const payload = adapter.capturePayment({
    attempt,
    idempotencyKey: 'idemp_cap_001',
    allocations: [{ document: docRef, amount: Money.fromDecimalString('1000.00', 'MVR') }],
    bankAccountId: '33333333-3333-4333-8333-333333333333',
  });

  assertEquals(attempt.status, 'succeeded');
  assertEquals(payload.idempotencyKey, 'idemp_cap_001');
  assertEquals(payload.provider, 'MOCK');
  assertEquals(payload.paymentAttemptId, attempt.id);
  assertEquals(payload.amount.equals(intent.amount), true);

  // Must validate cleanly against canonical contract
  const validationErrors = validatePaymentCapture(payload);
  assertEquals(validationErrors.length, 0);
});

// ── 5. Refund Flow: Ceiling & Segregation of Duties ──────────────────────────

Deno.test('SERP-352: Refund enforces cumulative ceiling and reason length', () => {
  const adapter = new MockPaymentAdapter();
  const intent = adapter.createIntent({
    organisationId: ORG_A,
    configId: CONFIG_MOCK,
    amount: Money.fromDecimalString('1000.00', 'MVR'),
    createdBy: PERSON_ALICE,
  });

  const originalPayment: DocumentRef = { documentId: 'dddddddd-1111-4111-8111-111111111111' };

  // First refund of 600.00 MVR
  const refund1 = adapter.refundPayment({
    intent,
    priorRefunds: [],
    stepHistory: [{ command: 'PAYMENT_CAPTURE', personId: PERSON_ALICE }],
    requestedBy: PERSON_BOB, // Bob refunds, Alice captured (passes SoD)
    amount: Money.fromDecimalString('600.00', 'MVR'),
    reason: 'Customer returned item with receipt in undamaged condition',
    idempotencyKey: 'idemp_ref_001',
    originalPayment,
  });

  assertEquals(refund1.refundRecord.status, 'succeeded');
  assertEquals(validatePaymentRefund(refund1.commandPayload).length, 0);

  // Second refund of 500.00 MVR exceeds remaining 400.00 MVR ceiling
  assertThrows(
    () =>
      adapter.refundPayment({
        intent,
        priorRefunds: [refund1.refundRecord],
        stepHistory: [{ command: 'PAYMENT_CAPTURE', personId: PERSON_ALICE }],
        requestedBy: PERSON_BOB,
        amount: Money.fromDecimalString('500.00', 'MVR'),
        reason: 'Customer requested secondary partial refund for remaining',
        idempotencyKey: 'idemp_ref_002',
        originalPayment,
      }),
    Error,
    'would exceed captured amount',
  );

  // Refund reason too short (< 12 characters)
  assertThrows(
    () =>
      adapter.refundPayment({
        intent,
        priorRefunds: [refund1.refundRecord],
        stepHistory: [{ command: 'PAYMENT_CAPTURE', personId: PERSON_ALICE }],
        requestedBy: PERSON_BOB,
        amount: Money.fromDecimalString('100.00', 'MVR'),
        reason: 'returned',
        idempotencyKey: 'idemp_ref_003',
        originalPayment,
      }),
    Error,
    'must be at least 12 characters',
  );
});

Deno.test('SERP-352: Refund enforces Segregation of Duties opposite Capture', () => {
  const adapter = new MockPaymentAdapter();
  const intent = adapter.createIntent({
    organisationId: ORG_A,
    configId: CONFIG_MOCK,
    amount: Money.fromDecimalString('500.00', 'MVR'),
    createdBy: PERSON_ALICE,
  });

  const originalPayment: DocumentRef = { documentId: 'dddddddd-1111-4111-8111-111111111111' };

  // Alice captured the payment; Alice tries to refund -> REFUSED BY SOD
  assertThrows(
    () =>
      adapter.refundPayment({
        intent,
        priorRefunds: [],
        stepHistory: [{ command: 'PAYMENT_CAPTURE', personId: PERSON_ALICE }],
        requestedBy: PERSON_ALICE,
        amount: Money.fromDecimalString('200.00', 'MVR'),
        reason: 'Customer requested refund directly from cashier at counter',
        idempotencyKey: 'idemp_ref_sod',
        originalPayment,
      }),
    Error,
    'Segregation of Duties violation',
  );
});

// ── 6. Settlement Batching & Balancing (gross - fee = net) ───────────────────

Deno.test('SERP-352: Settlement generates balanced payload (gross - fee = net)', () => {
  const adapter = new MockPaymentAdapter();

  const doc1: DocumentRef = { documentId: '11111111-2222-3333-4444-555555555551' };
  const doc2: DocumentRef = { documentId: '11111111-2222-3333-4444-555555555552' };

  const settlementPayload = adapter.generateSettlement({
    idempotencyKey: 'idemp_settle_001',
    batchReference: 'BATCH-MOCK-20260928-01',
    bankAccountId: '44444444-4444-4444-8444-444444444444',
    captures: [
      {
        document: doc1,
        grossAmount: Money.fromDecimalString('1000.00', 'MVR'),
        feeAmount: Money.fromDecimalString('25.00', 'MVR'),
      },
      {
        document: doc2,
        grossAmount: Money.fromDecimalString('2000.00', 'MVR'),
        feeAmount: Money.fromDecimalString('50.00', 'MVR'),
      },
    ],
  });

  assertEquals(settlementPayload.provider, 'MOCK');
  assertEquals(settlementPayload.grossAmount.toDecimalString(), '3000.000000');
  assertEquals(settlementPayload.feeAmount.toDecimalString(), '75.000000');
  assertEquals(settlementPayload.netAmount.toDecimalString(), '2925.000000');

  // Exact balancing validation
  const errors = validatePaymentSettlement(settlementPayload);
  assertEquals(errors.length, 0);
});

// ── 7. Webhook Ingress (4-Step Deduplicating Pipeline) ────────────────────────

Deno.test('SERP-352: Webhook ingress signature verification and deduplication', () => {
  const adapter = new MockPaymentAdapter({ webhookSecret: 'test_secret_xyz' });
  const eventId = 'evt_test_12345';
  const payloadStr = JSON.stringify({ event: 'payment.succeeded', amount: 500 });
  const validSig = `sig_mock_${eventId}_test_secret_xyz`;

  // 1. First delivery accepted & normalised
  const eventRecord = adapter.ingestWebhook({
    providerEventId: eventId,
    rawPayload: payloadStr,
    signature: validSig,
  });

  assertEquals(eventRecord.signatureVerified, true);
  assertEquals(eventRecord.processingState, 'normalised');
  assertEquals(eventRecord.providerEventId, eventId);

  // 2. Duplicate delivery refused by deduplication constraint
  assertThrows(
    () =>
      adapter.ingestWebhook({
        providerEventId: eventId,
        rawPayload: payloadStr,
        signature: validSig,
      }),
    Error,
    'duplicate provider event refused by unique constraint',
  );

  // 3. Invalid signature rejected
  const badSigEvent = adapter.ingestWebhook({
    providerEventId: 'evt_tampered_999',
    rawPayload: payloadStr,
    signature: 'bad_signature_value',
  });
  assertEquals(badSigEvent.signatureVerified, false);
  assertEquals(badSigEvent.processingState, 'rejected');
  assertEquals(badSigEvent.rejectionReason, 'invalid_signature');
});
