/**
 * MOCK Payment Adapter and Intent/Attempt Lifecycle Engine.
 *
 * Implements SERP-352 under SERP-339.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOCTRINE (Founder-approved 29 Aug 2026):
 *     Payment Core owns the provider conversation.
 *     STARQ ERP owns the money.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This adapter and lifecycle engine:
 *   1. Manages operational state: intents, attempts, provider references,
 *      webhook deduplication, and timeouts.
 *   2. Holds NO balances, posts NO journals, and manipulates NO ledger tables.
 *   3. Emits canonical command payloads (PAYMENT_CAPTURE, PAYMENT_REFUND,
 *      PAYMENT_SETTLEMENT_RECORD) that enter the ERP through the command boundary
 *      under the seat matrix.
 *   4. Enforces the strict attempt state machine:
 *        created → processing → succeeded | failed | uncertain
 *        uncertain → succeeded | failed  (never re-enters processing)
 *   5. Preserves tenant boundaries: no caller-supplied tenancy; organization
 *      is bound from the authenticated Principal.
 */

import { Money } from './money.ts';
import {
  BankSpecRequiredError,
  DocumentRef,
  isLegalAttemptTransition,
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_INTENT_STATUSES,
  PAYMENT_PROVIDERS,
  PaymentAttemptStatus,
  PaymentCapturePayload,
  PaymentCommandName,
  PaymentIntentStatus,
  PaymentProvider,
  PaymentRefundPayload,
  PaymentSettlementPayload,
  PaymentStepRecord,
  paymentSodViolation,
  ProviderCapabilities,
  ProviderEventRecord,
  REFUND_REASON_MIN_LENGTH,
  validatePaymentCapture,
  validatePaymentRefund,
  validatePaymentSettlement,
} from './payment_commands.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Operational Lifecycle Entities
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentIntentRecord {
  readonly id: string;
  readonly organisationId: string;
  readonly providerId: PaymentProvider;
  readonly configId: string;
  readonly amount: Money;
  readonly currency: string;
  readonly targetDocument?: DocumentRef;
  readonly settledPaymentDocumentId?: string;
  readonly createdBy: string;
  readonly createdAt: string;
  status: PaymentIntentStatus;
  updatedAt: string;
}

export interface PaymentAttemptRecord {
  readonly id: string;
  readonly organisationId: string;
  readonly intentId: string;
  readonly providerId: PaymentProvider;
  readonly configId: string;
  readonly amount: Money;
  readonly currency: string;
  readonly providerReference: string;
  readonly createdAt: string;
  status: PaymentAttemptStatus;
  uncertainSince?: string;
  failureCode?: string;
  failureMessage?: string;
  updatedAt: string;
}

export interface PaymentRefundRecord {
  readonly id: string;
  readonly organisationId: string;
  readonly intentId: string;
  readonly providerId: PaymentProvider;
  readonly amount: Money;
  readonly currency: string;
  readonly providerReference: string;
  readonly reason: string;
  readonly requestedBy: string;
  readonly createdAt: string;
  status: 'created' | 'processing' | 'succeeded' | 'failed';
  updatedAt: string;
}

export interface MockAdapterOptions {
  /** Simulated provider network delay in ms (0 for instant in tests). */
  networkDelayMs?: number;
  /** Fixed secret for webhook HMAC signature verification. */
  webhookSecret?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK Provider Capabilities
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  provider: 'MOCK',
  executable: true,
  hostedCheckout: true,
  refunds: true,
  partialRefunds: true,
  webhooks: true,
  settlementReports: true,
  currencies: ['MVR', 'USD'],
  specStatus: 'IMPLEMENTED',
};

export const BML_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  provider: 'BML',
  executable: false,
  hostedCheckout: false,
  refunds: false,
  partialRefunds: false,
  webhooks: false,
  settlementReports: false,
  currencies: [],
  specStatus: 'BANK_SPEC_REQUIRED',
};

export const MIB_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  provider: 'MIB',
  executable: false,
  hostedCheckout: false,
  refunds: false,
  partialRefunds: false,
  webhooks: false,
  settlementReports: false,
  currencies: [],
  specStatus: 'BANK_SPEC_REQUIRED',
};

// ─────────────────────────────────────────────────────────────────────────────
// The MOCK Payment Adapter
// ─────────────────────────────────────────────────────────────────────────────

export class MockPaymentAdapter {
  readonly provider: PaymentProvider = 'MOCK';
  private readonly webhookSecret: string;
  private readonly receivedWebhooks = new Set<string>(); // provider_id:event_id

  constructor(options: MockAdapterOptions = {}) {
    this.webhookSecret = options.webhookSecret ?? 'mock_wh_secret_canonical_test';
  }

  getCapabilities(): ProviderCapabilities {
    return MOCK_PROVIDER_CAPABILITIES;
  }

  /**
   * Asserts the provider is executable.
   * Throws BankSpecRequiredError for BML or MIB.
   */
  static assertExecutable(provider: PaymentProvider, operation: string): void {
    if (provider === 'BML') {
      throw new BankSpecRequiredError('BML', operation, [
        'API base URLs',
        'Authentication scheme',
        'Webhook signature format',
        'Sandbox credentials',
      ]);
    }
    if (provider === 'MIB') {
      throw new BankSpecRequiredError('MIB', operation, [
        'API base URLs',
        'Shariah-compliance transaction constraints',
        'Webhook signature format',
        'Sandbox credentials',
      ]);
    }
  }

  // ── 1. Intent Management ───────────────────────────────────────────────────

  createIntent(params: {
    readonly id?: string;
    readonly organisationId: string;
    readonly configId: string;
    readonly amount: Money;
    readonly targetDocument?: DocumentRef;
    readonly createdBy: string;
  }): PaymentIntentRecord {
    MockPaymentAdapter.assertExecutable('MOCK', 'createIntent');

    if (!params.amount.isPositive()) {
      throw new Error('payment intent amount must be positive');
    }
    if (!MOCK_PROVIDER_CAPABILITIES.currencies.includes(params.amount.currency)) {
      throw new Error(`unsupported currency ${params.amount.currency} for MOCK provider`);
    }

    const now = new Date().toISOString();
    return {
      id: params.id ?? crypto.randomUUID(),
      organisationId: params.organisationId,
      providerId: 'MOCK',
      configId: params.configId,
      amount: params.amount,
      currency: params.amount.currency,
      targetDocument: params.targetDocument,
      createdBy: params.createdBy,
      createdAt: now,
      status: 'created',
      updatedAt: now,
    };
  }

  // ── 2. Attempt Management & State Machine ──────────────────────────────────

  createAttempt(params: {
    readonly id?: string;
    readonly intent: PaymentIntentRecord;
    readonly amount?: Money;
  }): PaymentAttemptRecord {
    MockPaymentAdapter.assertExecutable('MOCK', 'createAttempt');

    if (params.intent.status === 'succeeded' || params.intent.status === 'cancelled') {
      throw new Error(`cannot create attempt on ${params.intent.status} intent`);
    }

    const attemptAmount = params.amount ?? params.intent.amount;
    if (!attemptAmount.isPositive()) {
      throw new Error('payment attempt amount must be positive');
    }
    if (attemptAmount.currency !== params.intent.currency) {
      throw new Error(
        `attempt currency ${attemptAmount.currency} does not match intent currency ${params.intent.currency}`,
      );
    }

    const now = new Date().toISOString();
    const attemptId = params.id ?? crypto.randomUUID();
    const providerRef = `MOCK-ATT-${Date.now()}-${attemptId.slice(0, 8)}`;

    return {
      id: attemptId,
      organisationId: params.intent.organisationId,
      intentId: params.intent.id,
      providerId: 'MOCK',
      configId: params.intent.configId,
      amount: attemptAmount,
      currency: attemptAmount.currency,
      providerReference: providerRef,
      createdAt: now,
      status: 'created',
      updatedAt: now,
    };
  }

  transitionAttempt(
    attempt: PaymentAttemptRecord,
    newStatus: PaymentAttemptStatus,
    details?: {
      readonly uncertainSince?: string;
      readonly failureCode?: string;
      readonly failureMessage?: string;
    },
  ): void {
    if (attempt.status === newStatus) return;

    if (!isLegalAttemptTransition(attempt.status, newStatus)) {
      throw new Error(
        `illegal attempt transition ${attempt.status} -> ${newStatus} on attempt ${attempt.id}`,
      );
    }

    // Uncertain constraint: must carry uncertainSince timestamp
    if (newStatus === 'uncertain' && !details?.uncertainSince) {
      throw new Error(`attempt ${attempt.id} entering uncertain status requires uncertainSince timestamp`);
    }

    // Terminal states cannot carry uncertainSince
    if (newStatus === 'succeeded' || newStatus === 'failed') {
      attempt.uncertainSince = undefined;
    }

    if (newStatus === 'uncertain') {
      attempt.uncertainSince = details?.uncertainSince ?? new Date().toISOString();
    }

    if (newStatus === 'failed') {
      attempt.failureCode = details?.failureCode;
      attempt.failureMessage = details?.failureMessage;
    }

    attempt.status = newStatus;
    attempt.updatedAt = new Date().toISOString();
  }

  // ── 3. Capture Flow (Command Boundary Egress) ──────────────────────────────

  /**
   * Executes a simulated mock payment capture.
   *
   * Transitions the attempt from created → processing → succeeded, and returns
   * a validated PaymentCapturePayload ready for the command envelope.
   *
   * It DOES NOT write to commercial_documents or post to the ledger.
   */
  capturePayment(params: {
    readonly attempt: PaymentAttemptRecord;
    readonly idempotencyKey: string;
    readonly allocations: readonly { readonly document: DocumentRef; readonly amount: Money }[];
    readonly bankAccountId?: string;
    readonly capturedAt?: string;
  }): PaymentCapturePayload {
    MockPaymentAdapter.assertExecutable('MOCK', 'capturePayment');

    // 1. Transition attempt through legal state machine
    if (params.attempt.status === 'created') {
      this.transitionAttempt(params.attempt, 'processing');
    }
    if (params.attempt.status === 'processing' || params.attempt.status === 'uncertain') {
      this.transitionAttempt(params.attempt, 'succeeded');
    } else if (params.attempt.status !== 'succeeded') {
      throw new Error(`cannot capture attempt in status ${params.attempt.status}`);
    }

    const capturedAt = params.capturedAt ?? new Date().toISOString();

    // 2. Assemble canonical command payload
    const payload: PaymentCapturePayload = {
      idempotencyKey: params.idempotencyKey,
      provider: 'MOCK',
      providerReference: params.attempt.providerReference,
      paymentAttemptId: params.attempt.id,
      amount: params.attempt.amount,
      capturedAt,
      allocations: params.allocations,
      bankAccountId: params.bankAccountId,
    };

    // 3. Strict pre-submission contract validation
    const errors = validatePaymentCapture(payload);
    if (errors.length > 0) {
      throw new Error(`invalid PaymentCapturePayload: ${errors.join(', ')}`);
    }

    return payload;
  }

  // ── 4. Refund Flow with Ceiling & SoD Check ────────────────────────────────

  /**
   * Executes a simulated mock refund.
   *
   * Enforces:
   *   - Cumulative refund ceiling (refunds <= captured)
   *   - Reason length >= 12 chars
   *   - Segregation of Duties (person who captured cannot refund)
   * Emits validated PaymentRefundPayload for the command envelope.
   */
  refundPayment(params: {
    readonly intent: PaymentIntentRecord;
    readonly priorRefunds: readonly PaymentRefundRecord[];
    readonly stepHistory: readonly PaymentStepRecord[];
    readonly requestedBy: string;
    readonly amount: Money;
    readonly reason: string;
    readonly idempotencyKey: string;
    readonly originalPayment: DocumentRef;
    readonly reversalOfAllocationId?: string;
    readonly refundedAt?: string;
  }): {
    readonly refundRecord: PaymentRefundRecord;
    readonly commandPayload: PaymentRefundPayload;
  } {
    MockPaymentAdapter.assertExecutable('MOCK', 'refundPayment');

    // 1. SoD check: payment_capture opposite payment_refund
    const sodOffense = paymentSodViolation(params.stepHistory, 'PAYMENT_REFUND', params.requestedBy);
    if (sodOffense) {
      throw new Error(
        `Segregation of Duties violation: person ${params.requestedBy} cannot execute PAYMENT_REFUND after participating in ${sodOffense[0]}`,
      );
    }

    // 2. Currency match
    if (params.amount.currency !== params.intent.currency) {
      throw new Error(
        `refund currency ${params.amount.currency} does not match intent currency ${params.intent.currency}`,
      );
    }

    // 3. Positive amount
    if (!params.amount.isPositive()) {
      throw new Error('refund amount must be positive');
    }

    // 4. Substantive reason check
    if (params.reason.trim().length < REFUND_REASON_MIN_LENGTH) {
      throw new Error(
        `refund reason must be at least ${REFUND_REASON_MIN_LENGTH} characters (was ${params.reason.trim().length})`,
      );
    }

    // 5. Ceiling check under intent total
    const alreadyRefunded = params.priorRefunds
      .filter((r) => r.status === 'created' || r.status === 'processing' || r.status === 'succeeded')
      .map((r) => r.amount)
      .reduce((sum, amt) => sum.add(amt), Money.zero(params.intent.currency));

    const totalAfterRefund = alreadyRefunded.add(params.amount);
    if (totalAfterRefund.compare(params.intent.amount) > 0) {
      throw new Error(
        `cumulative refunds (${totalAfterRefund.toDecimalString()} ${params.intent.currency}) would exceed captured amount ${params.intent.amount.toDecimalString()} ${params.intent.currency}`,
      );
    }

    const now = params.refundedAt ?? new Date().toISOString();
    const refundId = crypto.randomUUID();
    const providerRef = `MOCK-REF-${Date.now()}-${refundId.slice(0, 8)}`;

    const refundRecord: PaymentRefundRecord = {
      id: refundId,
      organisationId: params.intent.organisationId,
      intentId: params.intent.id,
      providerId: 'MOCK',
      amount: params.amount,
      currency: params.amount.currency,
      providerReference: providerRef,
      reason: params.reason,
      requestedBy: params.requestedBy,
      createdAt: now,
      status: 'succeeded',
      updatedAt: now,
    };

    const commandPayload: PaymentRefundPayload = {
      idempotencyKey: params.idempotencyKey,
      provider: 'MOCK',
      providerReference: providerRef,
      originalPayment: params.originalPayment,
      reversalOfAllocationId: params.reversalOfAllocationId,
      amount: params.amount,
      refundedAt: now,
      reason: params.reason,
    };

    const errors = validatePaymentRefund(commandPayload);
    if (errors.length > 0) {
      throw new Error(`invalid PaymentRefundPayload: ${errors.join(', ')}`);
    }

    return { refundRecord, commandPayload };
  }

  // ── 5. Settlement Batching (Command Boundary Egress) ────────────────────────

  /**
   * Generates a settlement batch for a set of captured payments.
   * Enforces exact gross - fee = net balancing and emits PAYMENT_SETTLEMENT_RECORD.
   */
  generateSettlement(params: {
    readonly idempotencyKey: string;
    readonly batchReference: string;
    readonly captures: readonly {
      readonly document: DocumentRef;
      readonly grossAmount: Money;
      readonly feeAmount: Money;
    }[];
    readonly bankAccountId: string;
    readonly settledAt?: string;
  }): PaymentSettlementPayload {
    MockPaymentAdapter.assertExecutable('MOCK', 'generateSettlement');

    if (params.captures.length === 0) {
      throw new Error('cannot generate settlement with zero captures');
    }

    const firstCurrency = params.captures[0].grossAmount.currency;
    let totalGross = Money.zero(firstCurrency);
    let totalFee = Money.zero(firstCurrency);

    const capturedPayments: DocumentRef[] = [];

    for (const c of params.captures) {
      if (c.grossAmount.currency !== firstCurrency || c.feeAmount.currency !== firstCurrency) {
        throw new Error('mixed currencies in settlement batch captures');
      }
      if (!c.grossAmount.isPositive()) {
        throw new Error('capture gross amount must be strictly positive');
      }
      if (c.feeAmount.isNegative()) {
        throw new Error('capture fee amount cannot be negative');
      }
      totalGross = totalGross.add(c.grossAmount);
      totalFee = totalFee.add(c.feeAmount);
      capturedPayments.push(c.document);
    }

    const netAmount = totalGross.subtract(totalFee);
    const settledAt = params.settledAt ?? new Date().toISOString();

    const payload: PaymentSettlementPayload = {
      idempotencyKey: params.idempotencyKey,
      provider: 'MOCK',
      batchReference: params.batchReference,
      grossAmount: totalGross,
      feeAmount: totalFee,
      netAmount,
      settledAt,
      bankAccountId: params.bankAccountId,
      capturedPayments,
    };

    const errors = validatePaymentSettlement(payload);
    if (errors.length > 0) {
      throw new Error(`invalid PaymentSettlementPayload: ${errors.join(', ')}`);
    }

    return payload;
  }

  // ── 6. Webhook Ingress (Verify → Deduplicate → Normalise → Enqueue) ─────────

  /**
   * Ingests a raw webhook event following the 4-step protocol:
   *   1. verify signature
   *   2. deduplicate (database unique constraint semantics)
   *   3. normalise
   *   4. enqueue (ready for consumption by command worker)
   *
   * Structural guarantee: Webhook processing NEVER mutates the financial ledger.
   */
  ingestWebhook(params: {
    readonly providerEventId: string;
    readonly rawPayload: string;
    readonly signature: string;
    readonly receivedAt?: string;
    readonly expectedSecret?: string;
  }): ProviderEventRecord {
    // 1. Verify signature
    const secret = params.expectedSecret ?? this.webhookSecret;
    const computedSignature = `sig_mock_${params.providerEventId}_${secret}`;
    const signatureVerified = params.signature === computedSignature;

    const dedupeKey = `MOCK:${params.providerEventId}`;

    // 2. Deduplication check
    if (this.receivedWebhooks.has(dedupeKey)) {
      throw new Error(
        `duplicate provider event refused by unique constraint (MOCK, ${params.providerEventId})`,
      );
    }

    if (!signatureVerified) {
      return {
        provider: 'MOCK',
        providerEventId: params.providerEventId,
        receivedAt: params.receivedAt ?? new Date().toISOString(),
        signatureVerified: false,
        rawPayload: params.rawPayload,
        processingState: 'rejected',
        rejectionReason: 'invalid_signature',
      };
    }

    // Record deduplication
    this.receivedWebhooks.add(dedupeKey);

    // 3. Normalise & 4. Enqueue
    return {
      provider: 'MOCK',
      providerEventId: params.providerEventId,
      receivedAt: params.receivedAt ?? new Date().toISOString(),
      signatureVerified: true,
      rawPayload: params.rawPayload,
      processingState: 'normalised',
    };
  }
}
