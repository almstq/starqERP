/**
 * Webhook Ingress Contract & Pipeline Tests — SERP-353.
 *
 * Verifies the 4-step webhook ingress pipeline:
 *     verify signature -> deduplicate -> normalise -> enqueue
 *
 * Enforces canonical invariants:
 *   1. Webhook is NOT a financial event (no ledger writes, no direct mutations).
 *   2. Deduplication is enforced as a unique constraint on (provider_id, provider_event_id).
 *   3. Raw payload is preserved byte-for-byte as dispute evidence.
 *   4. Tenant attribution is resolved without guessing (organisation_id is nullable).
 *   5. Provider safety gating (BML/MIB require bank spec; MOCK executable).
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  WebhookIngressPipeline,
  InMemoryProviderEventStorage,
  normaliseWebhookPayload,
  verifyMockSignature,
  type WebhookEventInput,
  type EnqueueMessage,
} from '../../contracts/webhook_ingress.ts';
import { BankSpecRequiredError } from '../../contracts/payment_commands.ts';
import { Money } from '../../contracts/money.ts';

// ── 1. Provider Safety Gating ────────────────────────────────────────────────

Deno.test('SERP-353: MOCK is executable; BML and MIB refuse with BANK_SPEC_REQUIRED', async () => {
  const storage = new InMemoryProviderEventStorage();
  const pipeline = new WebhookIngressPipeline(storage);

  const bmlInput: WebhookEventInput = {
    provider: 'BML',
    providerEventId: 'bml_evt_001',
    rawPayload: JSON.stringify({ event: 'payment.succeeded' }),
    signature: 'any_sig',
  };

  await assertRejects(
    async () => {
      await pipeline.process(bmlInput);
    },
    BankSpecRequiredError,
    'BANK_SPEC_REQUIRED: BML.ingestWebhook',
  );

  const mibInput: WebhookEventInput = {
    provider: 'MIB',
    providerEventId: 'mib_evt_001',
    rawPayload: JSON.stringify({ event: 'payment.succeeded' }),
    signature: 'any_sig',
  };

  await assertRejects(
    async () => {
      await pipeline.process(mibInput);
    },
    BankSpecRequiredError,
    'BANK_SPEC_REQUIRED: MIB.ingestWebhook',
  );
});

// ── 2. Step 1: Signature Verification & Dispute Evidence ──────────────────────

Deno.test('SERP-353: Invalid signature rejects event and records dispute evidence verbatim', async () => {
  const storage = new InMemoryProviderEventStorage();
  const pipeline = new WebhookIngressPipeline(storage, {
    defaultMockSecret: 'secret_123',
  });

  const rawBody = '{"event":"payment.succeeded","attempt_id":"att_01","amount":"150.00","currency":"MVR"}';
  const input: WebhookEventInput = {
    provider: 'MOCK',
    providerEventId: 'evt_invalid_sig_01',
    rawPayload: rawBody,
    signature: 'forged_or_wrong_signature',
  };

  const result = await pipeline.process(input);

  assertEquals(result.status, 'rejected');
  assertEquals(result.step, 'verify');
  assertEquals(result.rejectionReason, 'invalid_signature');
  assertEquals(result.eventRow.signature_verified, false);
  assertEquals(result.eventRow.processing_state, 'rejected');
  assertEquals(result.eventRow.rejection_reason, 'invalid_signature');

  // Byte-for-byte dispute evidence retention
  assertEquals(result.eventRow.raw_payload, rawBody);
  assertEquals(result.enqueueMessage, undefined);

  // Stored in database/storage as rejected
  const stored = await storage.getByProviderEventId('MOCK', 'evt_invalid_sig_01');
  assertExists(stored);
  assertEquals(stored.signature_verified, false);
  assertEquals(stored.processing_state, 'rejected');
});

// ── 3. Step 2: Database Deduplication Constraint ──────────────────────────────

Deno.test('SERP-353: Deduplication enforces unique (provider, provider_event_id)', async () => {
  const storage = new InMemoryProviderEventStorage();
  let enqueuedCount = 0;
  const pipeline = new WebhookIngressPipeline(storage, {
    defaultMockSecret: 'test_sec',
    enqueueSink: () => {
      enqueuedCount++;
    },
  });

  const eventId = 'evt_duplicate_test_01';
  const signature = `sig_mock_${eventId}_test_sec`;
  const rawBody = JSON.stringify({
    event: 'payment.succeeded',
    event_id: eventId,
    attempt_id: 'att_dup_01',
    amount: '500.00',
    currency: 'MVR',
  });

  const input: WebhookEventInput = {
    provider: 'MOCK',
    providerEventId: eventId,
    rawPayload: rawBody,
    signature,
  };

  // First delivery: succeeds and enqueues
  const first = await pipeline.process(input);
  assertEquals(first.status, 'enqueued');
  assertEquals(first.step, 'enqueue');
  assertEquals(enqueuedCount, 1);

  // Second delivery of same event: duplicate detected by storage constraint
  const second = await pipeline.process(input);
  assertEquals(second.status, 'duplicate');
  assertEquals(second.step, 'deduplicate');
  assertEquals(second.rejectionReason, 'duplicate_event');
  assertEquals(second.eventRow.id, first.eventRow.id);

  // Crucial invariant: Second delivery does NOT re-enqueue
  assertEquals(enqueuedCount, 1);
});

// ── 4. Step 3: Normalisation & Tenant Attribution ─────────────────────────────

Deno.test('SERP-353: Normalisation parses payload without guessing tenant', async () => {
  const storage = new InMemoryProviderEventStorage();
  const pipeline = new WebhookIngressPipeline(storage, {
    defaultMockSecret: 'sec_norm',
  });

  const eventId = 'evt_norm_org_01';
  const signature = `sig_mock_${eventId}_sec_norm`;
  const orgId = '55555555-5555-5555-8555-555555555555';

  const rawWithOrg = JSON.stringify({
    event: 'payment.succeeded',
    event_id: eventId,
    intent_id: 'int_001',
    attempt_id: 'att_001',
    organisation_id: orgId,
    amount: '750.50',
    currency: 'MVR',
    occurred_at: '2026-09-28T10:00:00.000Z',
  });

  const resWithOrg = await pipeline.process({
    provider: 'MOCK',
    providerEventId: eventId,
    rawPayload: rawWithOrg,
    signature,
  });

  assertEquals(resWithOrg.status, 'enqueued');
  assertEquals(resWithOrg.eventRow.organisation_id, orgId);
  assertEquals(resWithOrg.enqueueMessage?.normalised.organisationId, orgId);
  assertEquals(
    resWithOrg.enqueueMessage?.normalised.amount?.toDecimalString(),
    '750.500000',
  );

  // Now an event with NO organisation: organisation_id must be NULL, never guessed
  const eventIdNoOrg = 'evt_norm_no_org_02';
  const sigNoOrg = `sig_mock_${eventIdNoOrg}_sec_norm`;
  const rawNoOrg = JSON.stringify({
    event: 'payment.failed',
    event_id: eventIdNoOrg,
    intent_id: 'int_002',
    attempt_id: 'att_002',
    occurred_at: '2026-09-28T10:05:00.000Z',
  });

  const resNoOrg = await pipeline.process({
    provider: 'MOCK',
    providerEventId: eventIdNoOrg,
    rawPayload: rawNoOrg,
    signature: sigNoOrg,
  });

  assertEquals(resNoOrg.status, 'enqueued');
  assertEquals(resNoOrg.eventRow.organisation_id, null);
  assertEquals(resNoOrg.enqueueMessage?.normalised.organisationId, null);
  assertEquals(resNoOrg.enqueueMessage?.normalised.eventType, 'payment.failed');
});

// ── 5. Step 3: Malformed & Unsupported Payload Handling ───────────────────────

Deno.test('SERP-353: Malformed payload rejects at normalise step with reason', async () => {
  const storage = new InMemoryProviderEventStorage();
  const pipeline = new WebhookIngressPipeline(storage, {
    defaultMockSecret: 'sec_malformed',
  });

  // Malformed JSON
  const eventId1 = 'evt_bad_json';
  const resBadJson = await pipeline.process({
    provider: 'MOCK',
    providerEventId: eventId1,
    rawPayload: 'not-json-at-all',
    signature: `sig_mock_${eventId1}_sec_malformed`,
  });

  assertEquals(resBadJson.status, 'rejected');
  assertEquals(resBadJson.step, 'normalise');
  assertEquals(resBadJson.rejectionReason, 'invalid_json_payload');
  assertEquals(resBadJson.eventRow.processing_state, 'rejected');

  // Unsupported event type
  const eventId2 = 'evt_unsupported_type';
  const resUnsupported = await pipeline.process({
    provider: 'MOCK',
    providerEventId: eventId2,
    rawPayload: JSON.stringify({ event: 'unsupported.random.event' }),
    signature: `sig_mock_${eventId2}_sec_malformed`,
  });

  assertEquals(resUnsupported.status, 'rejected');
  assertEquals(resUnsupported.step, 'normalise');
  assertEquals(
    resUnsupported.rejectionReason,
    'unsupported_event_type: unsupported.random.event',
  );
});

// ── 6. Step 4: Enqueue Dispatch & No Direct Ledger Posting ───────────────────

Deno.test('SERP-353: Enqueue dispatches message and stops without ledger write', async () => {
  const storage = new InMemoryProviderEventStorage();
  const dispatched: EnqueueMessage[] = [];

  const pipeline = new WebhookIngressPipeline(storage, {
    defaultMockSecret: 'sec_enqueue',
    enqueueSink: (msg) => {
      dispatched.push(msg);
    },
  });

  const eventId = 'evt_enq_001';
  const signature = `sig_mock_${eventId}_sec_enqueue`;
  const rawBody = JSON.stringify({
    event: 'refund.succeeded',
    event_id: eventId,
    attempt_id: 'att_ref_01',
    amount: '120.00',
    currency: 'MVR',
  });

  const result = await pipeline.process({
    provider: 'MOCK',
    providerEventId: eventId,
    rawPayload: rawBody,
    signature,
  });

  assertEquals(result.status, 'enqueued');
  assertEquals(result.step, 'enqueue');
  assertEquals(dispatched.length, 1);
  assertEquals(dispatched[0].queue, 'payment_webhooks');
  assertEquals(dispatched[0].eventType, 'refund.succeeded');
  assertEquals(dispatched[0].normalised.amount?.toDecimalString(), '120.000000');

  // The result contains ONLY the eventRow and enqueueMessage — holds no balances,
  // creates no commercial documents, and performs NO direct ledger posting.
  assertEquals(result.eventRow.processing_state, 'normalised');
  assertEquals(result.eventRow.consumed_by_command_id, null);
  assertEquals(result.eventRow.consumed_at, null);
});

// ── 7. Storage Constraint Checks ──────────────────────────────────────────────

Deno.test('SERP-353: Storage constraints enforce check conditions strictly', async () => {
  const storage = new InMemoryProviderEventStorage();

  // Rejected must have rejection_reason
  await assertRejects(
    async () => {
      await storage.insertOrGetDuplicate({
        provider_id: 'MOCK',
        provider_event_id: 'evt_check_01',
        organisation_id: null,
        signature_verified: false,
        raw_payload: '{}',
        received_at: new Date().toISOString(),
        processing_state: 'rejected',
        // rejection_reason missing!
      });
    },
    Error,
    'check violation: rejected event must have rejection_reason',
  );

  // Non-rejected must not have rejection_reason
  await assertRejects(
    async () => {
      await storage.insertOrGetDuplicate({
        provider_id: 'MOCK',
        provider_event_id: 'evt_check_02',
        organisation_id: null,
        signature_verified: true,
        raw_payload: '{}',
        received_at: new Date().toISOString(),
        processing_state: 'received',
        rejection_reason: 'unexpected',
      });
    },
    Error,
    'check violation: non-rejected event must not have rejection_reason',
  );
});
