/**
 * Payment command contract — the financial boundary between Starq Payment Core
 * and canonical STARQ ERP.
 *
 * Promoted into canonical `starqERP/contracts/` under SERP-348 / SERP-339.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE THIS FILE ENFORCES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *     Payment Core owns the provider conversation.
 *     STARQ ERP owns the money.
 *
 * Payment Core may hold intents, attempts, provider references, webhook
 * receipts and timeouts. It holds NO balances, posts NO journals, and is never
 * a source of financial truth. Every financial consequence enters the ledger
 * through the command envelope, authorised by the seat matrix, recorded in
 * `audit_events`, and expressed in canonical structures:
 *
 *     commercial_documents      (document_type = 'payment' | 'receipt')
 *     settlement_allocations    (payment_document_id → settled_document_id)
 *     journal_proposals         (never a direct posting)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE REVIEWED `AccountingPort` WAS REPLACED RATHER THAN ADAPTED
 * ─────────────────────────────────────────────────────────────────────────────
 * The reference implementation's port took `amount: any` on all four methods,
 * accepted `tenantId` as a caller-supplied parameter, addressed documents by a
 * bare `invoiceId: string`, carried no idempotency key, and offered
 * `recordSettlement` / `recordProviderFee` as direct posting instructions.
 *
 * Each of those contradicts something this codebase already established:
 *
 *   `amount: any`        → discards Money at the one boundary that needs it
 *   `tenantId` parameter → SERP-166/167/178 removed caller-supplied tenancy
 *   `invoiceId: string`  → cannot address commercial_documents(organisation_id, id)
 *   no idempotency key   → IdempotencyRecord is how this system replays safely
 *   direct posting       → DEC-068, one source of financial truth
 *
 * So the shape below is not a port at all. It is a command payload, because
 * that is the only way a financial effect is permitted to enter this system.
 */

import type { Money } from './money.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Provider identity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registered providers. BML and MIB compile and register, but every operation
 * they expose fails with BANK_SPEC_REQUIRED until real specifications exist.
 * MOCK is the only executable provider today.
 */
export const PAYMENT_PROVIDERS = ['MOCK', 'BML', 'MIB'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/**
 * What a provider can actually do. Declared per provider so the ERP never
 * offers a customer an operation the bank cannot perform, and so an
 * unimplemented adapter is a data fact rather than a runtime surprise.
 */
export interface ProviderCapabilities {
  readonly provider: PaymentProvider;
  readonly executable: boolean;
  readonly hostedCheckout: boolean;
  readonly refunds: boolean;
  readonly partialRefunds: boolean;
  readonly webhooks: boolean;
  readonly settlementReports: boolean;
  readonly currencies: readonly string[];
  /** Populated for BML/MIB once the bank documents its behaviour. */
  readonly specStatus: 'IMPLEMENTED' | 'BANK_SPEC_REQUIRED';
}

/**
 * Thrown by any BML/MIB adapter operation whose behaviour is not yet
 * documented. Never faked, never silently defaulted. If this reaches a user,
 * the correct message is that the payment method is not yet available — not
 * that the payment failed.
 */
export class BankSpecRequiredError extends Error {
  readonly code = 'BANK_SPEC_REQUIRED' as const;
  constructor(
    readonly provider: PaymentProvider,
    readonly operation: string,
    readonly requires: readonly string[],
  ) {
    super(
      `BANK_SPEC_REQUIRED: ${provider}.${operation} — awaiting ${requires.join(', ')}`,
    );
    this.name = 'BankSpecRequiredError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Document addressing — composite, always
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A reference to a row in `commercial_documents`.
 *
 * The organisation is NOT carried here. It comes from the Principal, which the
 * server assembles from the session. A payload that could name its own
 * organisation is a payload that can cross a tenant boundary, and the composite
 * foreign keys on `settlement_allocations` exist precisely so the database can
 * refuse that. Passing organisation_id in the payload would defeat both.
 */
export interface DocumentRef {
  readonly documentId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment lifecycle — operational state, owned by Payment Core
// ─────────────────────────────────────────────────────────────────────────────

export const PAYMENT_INTENT_STATUSES = [
  'created',
  'pending',
  'requires_action',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number];

/**
 * `uncertain` is the state that prevents double charging.
 *
 * A provider or network timeout does NOT mean the payment failed — it means we
 * do not know. An attempt in `uncertain` may never be retried and may never be
 * reported to the customer as a failure. It is resolved only by a webhook, a
 * provider status query, or a settlement file. This is the single most
 * important state in the model.
 */
export const PAYMENT_ATTEMPT_STATUSES = [
  'created',
  'processing',
  'succeeded',
  'failed',
  'uncertain',
] as const;
export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];

/**
 * Legal transitions. There is no path back to `created` from anything: a retry
 * creates a NEW attempt so the history remains append-only, consistent with
 * `settlement_allocations` and `audit_events`.
 */
export const PAYMENT_ATTEMPT_TRANSITIONS: Readonly<
  Record<PaymentAttemptStatus, readonly PaymentAttemptStatus[]>
> = {
  created: ['processing', 'failed'],
  processing: ['succeeded', 'failed', 'uncertain'],
  uncertain: ['succeeded', 'failed'],
  succeeded: [],
  failed: [],
};

export function isLegalAttemptTransition(
  from: PaymentAttemptStatus,
  to: PaymentAttemptStatus,
): boolean {
  return PAYMENT_ATTEMPT_TRANSITIONS[from].includes(to);
}

// ─────────────────────────────────────────────────────────────────────────────
// The commands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Commands added to the COMMANDS list in contracts/commands.ts.
 * Each is authorised by the seat matrix exactly like every existing command.
 */
export const PAYMENT_COMMANDS = [
  'PAYMENT_CAPTURE',
  'PAYMENT_REFUND',
  'PAYMENT_SETTLEMENT_RECORD',
] as const;
export type PaymentCommandName = (typeof PAYMENT_COMMANDS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Segregation of duties on payments (SERP-348 / SERP-339)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Segregation pairs that must never be satisfied by the same person on the
 * same payment, regardless of how many seats that person holds.
 *
 * PAYMENT_REFUND sits opposite PAYMENT_CAPTURE.
 */
export const PAYMENT_SOD_PAIRS: readonly (readonly [PaymentCommandName, PaymentCommandName])[] = [
  ['PAYMENT_CAPTURE', 'PAYMENT_REFUND'],
] as const;

export interface PaymentStepRecord {
  readonly command: PaymentCommandName;
  readonly personId: string;
}

/**
 * Does taking `command` as `personId` break a segregation pair against prior history?
 * Returns the offending pair, or null when clear.
 */
export function paymentSodViolation(
  history: readonly PaymentStepRecord[],
  command: PaymentCommandName,
  personId: string,
): readonly [PaymentCommandName, PaymentCommandName] | null {
  for (const pair of PAYMENT_SOD_PAIRS) {
    const [a, b] = pair;
    const other = command === a ? b : command === b ? a : null;
    if (!other) continue;
    if (history.some((h) => h.command === other && h.personId === personId)) {
      return pair;
    }
  }
  return null;
}

/**
 * RECORD A CAPTURED PAYMENT.
 *
 * Emitted by Payment Core once a provider has confirmed capture — never from
 * webhook code directly, and never before verification and deduplication.
 *
 * The server, in ONE transaction:
 *   1. resolves organisation from the Principal;
 *   2. checks the idempotency key, replaying the stored result if seen;
 *   3. inserts commercial_documents (document_type='payment', status='issued')
 *      with a number allocated by the existing document_sequences path;
 *   4. inserts settlement_allocations, one row per settled document;
 *   5. writes a journal_proposal — not a posting;
 *   6. writes audit_events;
 *   7. stores the idempotency outcome.
 *
 * If any step fails the whole thing rolls back and the provider event remains
 * unconsumed, so redelivery retries cleanly.
 */
export interface PaymentCapturePayload {
  /** Client-generated, persisted with the pending command, stable across retry. */
  readonly idempotencyKey: string;

  readonly provider: PaymentProvider;
  /** The provider's own reference. Unique per provider; stored, never trusted as identity. */
  readonly providerReference: string;
  /** Payment Core's attempt id, for tracing back to the provider conversation. */
  readonly paymentAttemptId: string;

  /** Captured amount. Exact — see money.ts. */
  readonly amount: Money;

  /** When the PROVIDER captured, not when we learned of it. */
  readonly capturedAt: string;

  /**
   * Documents this payment settles, with the amount applied to each.
   *
   * Amounts must be strictly positive — `settlement_allocations` has
   * `check (allocated_amount > 0)` — and must sum to exactly `amount`. Use
   * Money.allocate() to split; never divide.
   */
  readonly allocations: readonly {
    readonly document: DocumentRef;
    readonly amount: Money;
  }[];

  /** Bank account credited, where known. References bank_accounts. */
  readonly bankAccountId?: string;
}

/**
 * RECORD A REFUND.
 *
 * A refund is NOT a negative payment. `settlement_allocations.allocated_amount`
 * is constrained positive, and the table carries `reversal_of` for exactly this
 * purpose. So a refund produces a new allocation row referencing the original
 * through `reversal_of`, plus a credit-note-shaped commercial document.
 *
 * The cumulative ceiling — total refunds ≤ captured — is enforced server-side
 * under a row lock on the original payment document, not in application memory.
 */
export interface PaymentRefundPayload {
  readonly idempotencyKey: string;
  readonly provider: PaymentProvider;
  readonly providerReference: string;

  /** The payment document being reversed. */
  readonly originalPayment: DocumentRef;
  /** The specific allocation being reversed, if partial. */
  readonly reversalOfAllocationId?: string;

  readonly amount: Money;
  readonly refundedAt: string;
  /** Required. Appears in the audit record and on the credit note. */
  readonly reason: string;
}

/**
 * RECORD A BANK SETTLEMENT.
 *
 * Settlement is a DIFFERENT event from capture and usually arrives days later,
 * net of provider fees. Recording it must never retroactively alter the capture
 * — that would rewrite a statutory figure after the fact.
 *
 * This command records the bank's movement and raises a journal PROPOSAL for
 * the fee and the clearing difference. A human accepts the proposal. Nothing
 * posts automatically.
 */
export interface PaymentSettlementPayload {
  readonly idempotencyKey: string;
  readonly provider: PaymentProvider;
  /** The provider's settlement batch identifier. */
  readonly batchReference: string;

  /** Gross of the captures in this batch. */
  readonly grossAmount: Money;
  /** Provider fees deducted. Zero is valid; absent is not. */
  readonly feeAmount: Money;
  /** What actually landed in the bank account. gross - fee. */
  readonly netAmount: Money;

  readonly settledAt: string;
  readonly bankAccountId: string;

  /** Payment documents included in this batch. */
  readonly capturedPayments: readonly DocumentRef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload invariants — checked before anything touches the database
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentValidationError =
  | 'allocations_empty'
  | 'allocation_not_positive'
  | 'allocations_do_not_sum_to_amount'
  | 'currency_mismatch'
  | 'amount_not_positive'
  | 'duplicate_document_in_allocations'
  | 'settlement_net_mismatch'
  | 'reason_too_short'
  | 'unknown_provider';

/** Minimum characters for a refund reason, matching SOD_REASON_MIN_LENGTH. */
export const REFUND_REASON_MIN_LENGTH = 12 as const;

export function validatePaymentCapture(
  payload: PaymentCapturePayload,
): PaymentValidationError[] {
  const errors: PaymentValidationError[] = [];

  if (!PAYMENT_PROVIDERS.includes(payload.provider)) {
    errors.push('unknown_provider');
  }
  if (!payload.amount.isPositive()) {
    errors.push('amount_not_positive');
  }
  if (payload.allocations.length === 0) {
    errors.push('allocations_empty');
    return errors;
  }

  const seen = new Set<string>();
  for (const a of payload.allocations) {
    if (!a.amount.isPositive()) errors.push('allocation_not_positive');
    if (a.amount.currency !== payload.amount.currency) {
      errors.push('currency_mismatch');
    }
    if (seen.has(a.document.documentId)) {
      errors.push('duplicate_document_in_allocations');
    }
    seen.add(a.document.documentId);
  }

  // Only meaningful if currencies agree; summing mixed currencies throws.
  if (!errors.includes('currency_mismatch')) {
    const total = payload.allocations
      .map((a) => a.amount)
      .reduce((x, y) => x.add(y));
    if (!total.equals(payload.amount)) {
      errors.push('allocations_do_not_sum_to_amount');
    }
  }

  return [...new Set(errors)];
}

export function validatePaymentRefund(
  payload: PaymentRefundPayload,
): PaymentValidationError[] {
  const errors: PaymentValidationError[] = [];
  if (!PAYMENT_PROVIDERS.includes(payload.provider)) errors.push('unknown_provider');
  if (!payload.amount.isPositive()) errors.push('amount_not_positive');
  if (payload.reason.trim().length < REFUND_REASON_MIN_LENGTH) {
    errors.push('reason_too_short');
  }
  return errors;
}

export function validatePaymentSettlement(
  payload: PaymentSettlementPayload,
): PaymentValidationError[] {
  const errors: PaymentValidationError[] = [];
  if (!PAYMENT_PROVIDERS.includes(payload.provider)) errors.push('unknown_provider');

  const sameCurrency = payload.grossAmount.currency === payload.feeAmount.currency &&
    payload.grossAmount.currency === payload.netAmount.currency;
  if (!sameCurrency) {
    errors.push('currency_mismatch');
    return errors;
  }
  if (!payload.grossAmount.subtract(payload.feeAmount).equals(payload.netAmount)) {
    errors.push('settlement_net_mismatch');
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook ingress — deliberately NOT a financial boundary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A received provider event, before it means anything.
 *
 * Webhook receipt performs exactly four steps and then stops:
 *   verify signature → deduplicate → normalise → enqueue.
 *
 * It does not post, does not settle, does not activate a subscription, and does
 * not grant entitlement. A forged webhook must be incapable of moving money or
 * opening ERP access, and the only way to guarantee that is to keep the
 * financial decision behind the command boundary where the seat matrix lives.
 */
export interface ProviderEventRecord {
  readonly provider: PaymentProvider;
  /** The provider's event id. UNIQUE (provider, providerEventId) in SQL — that constraint is the deduplication. */
  readonly providerEventId: string;
  readonly receivedAt: string;
  readonly signatureVerified: boolean;
  /** Raw body, retained verbatim for dispute and replay. Never re-derived. */
  readonly rawPayload: string;
  readonly processingState: 'received' | 'normalised' | 'consumed' | 'rejected';
  readonly rejectionReason?: string;
}
