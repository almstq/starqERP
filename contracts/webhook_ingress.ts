/**
 * Webhook Ingress Contract — SERP-353 / SERP-350.
 *
 * Implements the canonical 4-step webhook ingress pipeline:
 *
 *     verify signature -> deduplicate -> normalise -> enqueue
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CANONICAL INVARIANTS (SERP-353 & 202608290033_provider_events.sql)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. A WEBHOOK IS NOT A FINANCIAL EVENT.
 *    Receiving one performs exactly four steps and then stops. It does not
 *    post to the ledger, does not settle, does not activate a subscription,
 *    and does not grant entitlement. Financial decisions remain behind the
 *    command boundary under the seat matrix.
 *
 * 2. DEDUPLICATION IS A DATABASE CONSTRAINT, NOT APPLICATION MEMORY.
 *    `unique (provider_id, provider_event_id)` in SQL is the deduplication.
 *    An insert that violates it is the duplicate detection. Concurrent deliveries
 *    cannot both succeed.
 *
 * 3. RAW PAYLOAD IS DISPUTE EVIDENCE.
 *    Retained byte-for-byte as received. Never edited, never re-derived.
 *    Database triggers strictly enforce immutability of raw_payload and identity.
 *
 * 4. TENANT SCOPING IS NOT GUESSED.
 *    `organisation_id` is nullable. Events may arrive before attribution.
 *    Attribution is resolved during normalisation. Forcing a non-null tenant
 *    at ingress would force guessing, creating cross-tenant leak vectors.
 *
 * 5. PROVIDER SAFETY GATING.
 *    MOCK is the only executable provider today. BML and MIB throw
 *    `BankSpecRequiredError` until formal bank specifications exist.
 */

import {
  type PaymentProvider,
  PAYMENT_PROVIDERS,
  BankSpecRequiredError,
} from './payment_commands.ts';
import { Money } from './money.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface WebhookEventInput {
  readonly provider: PaymentProvider;
  readonly providerEventId: string;
  readonly rawPayload: string;
  readonly signature: string;
  readonly receivedAt?: string;
  readonly expectedSecret?: string;
  readonly headers?: Record<string, string>;
}

export type WebhookProcessingState =
  | 'received'
  | 'normalised'
  | 'consumed'
  | 'rejected';

export type WebhookEventType =
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.uncertain'
  | 'refund.succeeded'
  | 'refund.failed'
  | 'settlement.batch_closed';

export interface NormalizedWebhookEvent {
  readonly provider: PaymentProvider;
  readonly providerEventId: string;
  readonly eventType: WebhookEventType;
  readonly intentId?: string;
  readonly attemptId?: string;
  readonly organisationId?: string | null;
  readonly amount?: Money;
  readonly currency?: string;
  readonly occurredAt: string;
  readonly rawPayload: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Representation of public.provider_events row in Postgres.
 */
export interface ProviderEventRow {
  readonly id: string;
  readonly provider_id: PaymentProvider;
  readonly provider_event_id: string;
  readonly organisation_id: string | null;
  readonly signature_verified: boolean;
  readonly raw_payload: string;
  readonly received_at: string;
  readonly processing_state: WebhookProcessingState;
  readonly rejection_reason?: string | null;
  readonly consumed_by_command_id?: string | null;
  readonly consumed_at?: string | null;
}

export interface EnqueueMessage {
  readonly queue: 'payment_webhooks';
  readonly eventId: string;
  readonly provider: PaymentProvider;
  readonly providerEventId: string;
  readonly organisationId: string | null;
  readonly eventType: WebhookEventType;
  readonly normalised: NormalizedWebhookEvent;
  readonly enqueuedAt: string;
}

export interface WebhookIngressResult {
  readonly step: 'verify' | 'deduplicate' | 'normalise' | 'enqueue';
  readonly status: 'enqueued' | 'duplicate' | 'rejected';
  readonly eventRow: ProviderEventRow;
  readonly enqueueMessage?: EnqueueMessage;
  readonly rejectionReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Abstraction (Mirroring Postgres constraints)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderEventStorage {
  /**
   * Attempts to insert a new provider_event row.
   * If a unique conflict on (provider_id, provider_event_id) occurs, returns
   * inserted: false and the existing row.
   */
  insertOrGetDuplicate(
    row: Omit<ProviderEventRow, 'id'> & { id?: string },
  ): Promise<{ inserted: boolean; row: ProviderEventRow }>;

  /**
   * Updates state of an existing provider event.
   * raw_payload, provider_id, and provider_event_id are immutable.
   */
  updateProcessingState(
    id: string,
    update: {
      processing_state: WebhookProcessingState;
      organisation_id?: string | null;
      rejection_reason?: string | null;
      consumed_by_command_id?: string | null;
      consumed_at?: string | null;
    },
  ): Promise<ProviderEventRow>;

  getById(id: string): Promise<ProviderEventRow | null>;
  getByProviderEventId(
    provider: PaymentProvider,
    providerEventId: string,
  ): Promise<ProviderEventRow | null>;
}

/**
 * In-memory storage faithfully enforcing all Postgres trigger and check constraints:
 * - unique (provider_id, provider_event_id)
 * - immutable raw_payload, provider_id, provider_event_id
 * - no deletion
 * - check ((processing_state = 'rejected') = (rejection_reason is not null))
 * - check ((processing_state = 'consumed') = (consumed_at is not null))
 */
export class InMemoryProviderEventStorage implements ProviderEventStorage {
  private readonly eventsById = new Map<string, ProviderEventRow>();
  private readonly eventsByKey = new Map<string, string>(); // "provider:eventId" -> id

  async insertOrGetDuplicate(
    row: Omit<ProviderEventRow, 'id'> & { id?: string },
  ): Promise<{ inserted: boolean; row: ProviderEventRow }> {
    const key = `${row.provider_id}:${row.provider_event_id}`;
    const existingId = this.eventsByKey.get(key);
    if (existingId) {
      const existing = this.eventsById.get(existingId)!;
      return { inserted: false, row: existing };
    }

    // Check constraints
    if (row.processing_state === 'rejected' && !row.rejection_reason) {
      throw new Error('check violation: rejected event must have rejection_reason');
    }
    if (row.processing_state !== 'rejected' && row.rejection_reason) {
      throw new Error('check violation: non-rejected event must not have rejection_reason');
    }
    if (row.processing_state === 'consumed' && !row.consumed_at) {
      throw new Error('check violation: consumed event must have consumed_at');
    }

    const id = row.id ?? crypto.randomUUID();
    const stored: ProviderEventRow = {
      ...row,
      id,
      consumed_by_command_id: row.consumed_by_command_id ?? null,
      consumed_at: row.consumed_at ?? null,
    };

    this.eventsById.set(id, stored);
    this.eventsByKey.set(key, id);
    return { inserted: true, row: stored };
  }

  async updateProcessingState(
    id: string,
    update: {
      processing_state: WebhookProcessingState;
      organisation_id?: string | null;
      rejection_reason?: string | null;
      consumed_by_command_id?: string | null;
      consumed_at?: string | null;
    },
  ): Promise<ProviderEventRow> {
    const existing = this.eventsById.get(id);
    if (!existing) {
      throw new Error(`provider_event not found: ${id}`);
    }

    // Check constraints
    if (update.processing_state === 'rejected' && !update.rejection_reason && !existing.rejection_reason) {
      throw new Error('check violation: rejected event must have rejection_reason');
    }
    if (update.processing_state !== 'rejected' && (update.rejection_reason !== undefined ? update.rejection_reason !== null : existing.rejection_reason)) {
      throw new Error('check violation: non-rejected event must not have rejection_reason');
    }
    if (update.processing_state === 'consumed' && !update.consumed_at && !existing.consumed_at) {
      throw new Error('check violation: consumed event must have consumed_at');
    }

    const updated: ProviderEventRow = {
      ...existing,
      processing_state: update.processing_state,
      organisation_id: update.organisation_id !== undefined ? update.organisation_id : existing.organisation_id,
      rejection_reason: update.rejection_reason !== undefined ? update.rejection_reason : (update.processing_state === 'rejected' ? existing.rejection_reason : null),
      consumed_by_command_id: update.consumed_by_command_id !== undefined ? update.consumed_by_command_id : existing.consumed_by_command_id,
      consumed_at: update.consumed_at !== undefined ? update.consumed_at : existing.consumed_at,
    };

    this.eventsById.set(id, updated);
    return updated;
  }

  async getById(id: string): Promise<ProviderEventRow | null> {
    return this.eventsById.get(id) ?? null;
  }

  async getByProviderEventId(
    provider: PaymentProvider,
    providerEventId: string,
  ): Promise<ProviderEventRow | null> {
    const key = `${provider}:${providerEventId}`;
    const id = this.eventsByKey.get(key);
    if (!id) return null;
    return this.eventsById.get(id) ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature Verification
// ─────────────────────────────────────────────────────────────────────────────

export function verifyMockSignature(
  providerEventId: string,
  signature: string,
  secret: string,
): boolean {
  const expected = `sig_mock_${providerEventId}_${secret}`;
  return signature === expected;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseWebhookPayload(
  provider: PaymentProvider,
  rawPayload: string,
): { event?: NormalizedWebhookEvent; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch (_e) {
    return { error: 'invalid_json_payload' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'payload_must_be_an_object' };
  }

  const p = parsed as Record<string, unknown>;

  if (typeof p.event !== 'string') {
    return { error: 'missing_event_type' };
  }

  const allowedEvents: readonly WebhookEventType[] = [
    'payment.succeeded',
    'payment.failed',
    'payment.uncertain',
    'refund.succeeded',
    'refund.failed',
    'settlement.batch_closed',
  ];

  if (!allowedEvents.includes(p.event as WebhookEventType)) {
    return { error: `unsupported_event_type: ${p.event}` };
  }

  const eventType = p.event as WebhookEventType;
  const providerEventId = typeof p.event_id === 'string' ? p.event_id : (typeof p.id === 'string' ? p.id : '');
  const intentId = typeof p.intent_id === 'string' ? p.intent_id : undefined;
  const attemptId = typeof p.attempt_id === 'string' ? p.attempt_id : undefined;
  const organisationId = typeof p.organisation_id === 'string' ? p.organisation_id : null;
  const occurredAt = typeof p.occurred_at === 'string' ? p.occurred_at : new Date().toISOString();

  let amount: Money | undefined;
  if (typeof p.amount === 'string' && typeof p.currency === 'string') {
    amount = Money.fromDecimalString(p.amount, p.currency);
  } else if (typeof p.amount === 'number' && typeof p.currency === 'string') {
    amount = Money.fromDecimalString(p.amount.toFixed(2), p.currency);
  }

  return {
    event: {
      provider,
      providerEventId,
      eventType,
      intentId,
      attemptId,
      organisationId,
      amount,
      currency: amount ? amount.currency : (typeof p.currency === 'string' ? p.currency : undefined),
      occurredAt,
      rawPayload,
      metadata: p.metadata && typeof p.metadata === 'object' ? (p.metadata as Record<string, unknown>) : undefined,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Ingress Pipeline
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineConfig {
  readonly defaultMockSecret?: string;
  readonly enqueueSink?: (msg: EnqueueMessage) => Promise<void> | void;
}

export class WebhookIngressPipeline {
  private readonly defaultSecret: string;
  private readonly enqueueSink?: (msg: EnqueueMessage) => Promise<void> | void;

  constructor(
    private readonly storage: ProviderEventStorage,
    config?: PipelineConfig,
  ) {
    this.defaultSecret = config?.defaultMockSecret ?? 'mock_wh_secret_canonical_test';
    this.enqueueSink = config?.enqueueSink;
  }

  /**
   * Executes the canonical 4-step webhook ingress:
   *   1. Verify signature
   *   2. Deduplicate
   *   3. Normalise
   *   4. Enqueue
   *
   * NEVER posts to the ledger or activates subscriptions directly.
   */
  async process(input: WebhookEventInput): Promise<WebhookIngressResult> {
    // 0. Provider capability gating
    if (!PAYMENT_PROVIDERS.includes(input.provider)) {
      throw new Error(`unknown payment provider: ${input.provider}`);
    }

    if (input.provider === 'BML' || input.provider === 'MIB') {
      throw new BankSpecRequiredError(input.provider, 'ingestWebhook', [
        'Webhook signature format',
        'HMAC algorithm and public certificate',
        'Webhook payload schema',
        'Event deduplication spec',
      ]);
    }

    const receivedAt = input.receivedAt ?? new Date().toISOString();

    // ── 1. VERIFY SIGNATURE ──────────────────────────────────────────────────
    const secret = input.expectedSecret ?? this.defaultSecret;
    const signatureVerified = verifyMockSignature(
      input.providerEventId,
      input.signature,
      secret,
    );

    if (!signatureVerified) {
      // Record rejected event with verbatim raw_payload for dispute evidence
      const insertAttempt = await this.storage.insertOrGetDuplicate({
        provider_id: input.provider,
        provider_event_id: input.providerEventId,
        organisation_id: null,
        signature_verified: false,
        raw_payload: input.rawPayload,
        received_at: receivedAt,
        processing_state: 'rejected',
        rejection_reason: 'invalid_signature',
      });

      return {
        step: 'verify',
        status: 'rejected',
        rejectionReason: 'invalid_signature',
        eventRow: insertAttempt.row,
      };
    }

    // ── 2. DEDUPLICATE ────────────────────────────────────────────────────────
    // Insert into storage with initial processing_state: 'received'.
    // If (provider_id, provider_event_id) already exists, deduplication triggers.
    const dedupeInsert = await this.storage.insertOrGetDuplicate({
      provider_id: input.provider,
      provider_event_id: input.providerEventId,
      organisation_id: null,
      signature_verified: true,
      raw_payload: input.rawPayload,
      received_at: receivedAt,
      processing_state: 'received',
    });

    if (!dedupeInsert.inserted) {
      return {
        step: 'deduplicate',
        status: 'duplicate',
        rejectionReason: 'duplicate_event',
        eventRow: dedupeInsert.row,
      };
    }

    const storedRow = dedupeInsert.row;

    // ── 3. NORMALISE ──────────────────────────────────────────────────────────
    const normaliseResult = normaliseWebhookPayload(
      input.provider,
      input.rawPayload,
    );

    if (!normaliseResult.event || normaliseResult.error) {
      const rejectionReason = normaliseResult.error ?? 'normalisation_failed';
      const rejectedRow = await this.storage.updateProcessingState(storedRow.id, {
        processing_state: 'rejected',
        rejection_reason: rejectionReason,
      });

      return {
        step: 'normalise',
        status: 'rejected',
        rejectionReason,
        eventRow: rejectedRow,
      };
    }

    const norm = normaliseResult.event;
    const normalisedRow = await this.storage.updateProcessingState(storedRow.id, {
      processing_state: 'normalised',
      organisation_id: norm.organisationId ?? null,
    });

    // ── 4. ENQUEUE ────────────────────────────────────────────────────────────
    const enqueueMessage: EnqueueMessage = {
      queue: 'payment_webhooks',
      eventId: normalisedRow.id,
      provider: input.provider,
      providerEventId: input.providerEventId,
      organisationId: norm.organisationId ?? null,
      eventType: norm.eventType,
      normalised: norm,
      enqueuedAt: new Date().toISOString(),
    };

    if (this.enqueueSink) {
      await this.enqueueSink(enqueueMessage);
    }

    // STOP HERE. No direct ledger posting, no document creation.
    return {
      step: 'enqueue',
      status: 'enqueued',
      eventRow: normalisedRow,
      enqueueMessage,
    };
  }
}
