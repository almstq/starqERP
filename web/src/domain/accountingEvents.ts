/**
 * STARQ ERP — First-Class Accounting-Event & Subledger Abstraction (SERP-460)
 *
 * PURPOSE & ARCHITECTURAL FOUNDATION:
 * Implements the durable, auditable, tenant-scoped accounting-event abstraction
 * linking operational business transactions (Order-to-Cash, Procure-to-Pay, Cash/Payment)
 * to general ledger journal proposals (public.journal_proposals) without uncontrolled
 * or direct GL posting.
 *
 * CONCRETE MECHANISM SELECTION:
 * - Table / Event Log Entity: `accounting_events` with line-item detail `accounting_event_lines`.
 * - Dual Engine Integration: Client-side TypeScript domain validation & mapping engine
 *   coupled with immutable PostgreSQL subledger schema and idempotency replay controls.
 * - Why this mechanism:
 *   1. Reuses existing idempotency key architecture (202608250014_idempotency_replay.sql).
 *   2. Reuses journal proposal staging boundary (202608200003_commercial_accounting.sql)
 *      and posting controls (postingControl.ts / 202608300035).
 *   3. Enforces that operational facts NEVER post directly to GL; they MUST translate into
 *      balanced journal proposals with status 'draft' / 'validated' subject to posting gates.
 *
 * AUTHORITY: SERP-460 Task Specification; STARQERP Convergence Doctrine §3-§5.
 */

import { PostingActor, postingControlFor, PostingRejected } from './postingControl';
import { AccountRecord } from './accounts';

export type AccountingEventStatus = 'RECORDED' | 'PROPOSED' | 'POSTED' | 'REJECTED';

export type OperationalEventFamily =
  | 'ORDER_TO_CASH'
  | 'PROCURE_TO_PAY'
  | 'CASH_PAYMENT'
  | 'INVENTORY_GL'
  | 'RECORD_TO_REPORT';

export type OperationalEventType =
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_SETTLED'
  | 'PAYMENT_REFUNDED'
  | 'SALES_INVOICE_ISSUED'
  | 'COUNTER_RETURN_VOIDED'
  | 'SUPPLIER_INVOICE_ACCRUED';

export interface AccountingEventLinePayload {
  lineNo: number;
  accountCode: string;
  accountName?: string;
  debit: number;
  credit: number;
  narration?: string;
  currency?: string;
}

export interface OperationalFactEvent {
  id: string;
  organisationId: string;
  family: OperationalEventFamily;
  eventType: OperationalEventType;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  eventDate: string; // ISO YYYY-MM-DD
  currency: string;
  grossAmount: number;
  taxAmount?: number;
  netAmount?: number;
  narration: string;
  lines: AccountingEventLinePayload[];
  metadata?: Record<string, unknown>;
  recordedAt: string;
}

export interface ProposedJournalLine {
  lineNo: number;
  accountCode: string;
  amount: number; // Positive = Debit, Negative = Credit
  narration?: string;
}

export interface TranslatedJournalProposal {
  proposalId: string;
  organisationId: string;
  accountingEventId: string;
  idempotencyKey: string;
  sourceType: string;
  sourceId: string;
  status: 'draft' | 'validated';
  transactionDate: string;
  currency: string;
  narration: string;
  lines: ProposedJournalLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface TranslationValidationResult {
  isValid: boolean;
  errors: string[];
  proposal?: TranslatedJournalProposal;
}

/**
 * Validates mathematical and segregation invariants on an incoming operational fact.
 */
export function validateOperationalEvent(event: OperationalFactEvent): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!event.id || !event.organisationId) {
    errors.push('Event ID and Organisation ID are required');
  }

  if (!event.idempotencyKey) {
    errors.push('Idempotency key is required to guarantee safe replay');
  }

  if (!event.lines || event.lines.length < 2) {
    errors.push('Accounting event must have at least 2 double-entry balancing lines');
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of event.lines || []) {
    if (line.debit < 0 || line.credit < 0) {
      errors.push(`Line ${line.lineNo} cannot have negative amounts`);
    }
    if (line.debit > 0 && line.credit > 0) {
      errors.push(`Line ${line.lineNo} cannot have both debit and credit`);
    }
    if (line.debit === 0 && line.credit === 0) {
      errors.push(`Line ${line.lineNo} must have a non-zero debit or credit amount`);
    }
    if (!line.accountCode || line.accountCode.trim() === '') {
      errors.push(`Line ${line.lineNo} missing account code`);
    }

    totalDebit += line.debit;
    totalCredit += line.credit;
  }

  // Double entry balance invariant: exact balance (zero tolerance)
  const variance = Math.abs(totalDebit - totalCredit);
  if (variance !== 0) {
    errors.push(`Accounting event lines are unbalanced: Debit=${totalDebit.toFixed(2)}, Credit=${totalCredit.toFixed(2)}, Variance=${variance.toFixed(4)}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Translates an operational fact accounting event into a balanced journal proposal.
 * Ensures that no GL posting occurs directly; output is strictly a proposal candidate.
 */
export function translateEventToProposal(
  event: OperationalFactEvent,
  accounts: AccountRecord[],
  actor: PostingActor = 'system'
): TranslationValidationResult {
  const validation = validateOperationalEvent(event);
  if (!validation.isValid) {
    return {
      isValid: false,
      errors: validation.errors,
    };
  }

  const errors: string[] = [];
  const proposedLines: ProposedJournalLine[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of event.lines) {
    const acct = accounts.find((a) => a.code === line.accountCode);
    if (!acct) {
      errors.push(`Account code ${line.accountCode} not found in chart of accounts`);
      continue;
    }

    // Verify posting control gate: Header accounts reject all journals
    const control = postingControlFor(acct, accounts);
    if (control === 'header') {
      errors.push(`Account ${acct.code} is a header grouping and cannot accept entries`);
    } else if (control === 'archived') {
      errors.push(`Account ${acct.code} is archived and closed to entries`);
    } else if (control === 'system' && actor !== 'system') {
      errors.push(`Account ${acct.code} is system-controlled; requires system actor`);
    }

    // Signed double entry amount for public.journal_proposal_lines:
    // Positive for debit, negative for credit
    const netAmount = line.debit > 0 ? line.debit : -line.credit;
    proposedLines.push({
      lineNo: line.lineNo,
      accountCode: line.accountCode,
      amount: netAmount,
      narration: line.narration || event.narration,
    });

    totalDebit += line.debit;
    totalCredit += line.credit;
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  const proposal: TranslatedJournalProposal = {
    proposalId: `prop_${event.id}`,
    organisationId: event.organisationId,
    accountingEventId: event.id,
    idempotencyKey: event.idempotencyKey,
    sourceType: `accounting_event:${event.eventType.toLowerCase()}`,
    sourceId: event.sourceId,
    status: 'draft',
    transactionDate: event.eventDate,
    currency: event.currency || 'MVR',
    narration: event.narration,
    lines: proposedLines,
    totalDebit,
    totalCredit,
    isBalanced: totalDebit === totalCredit,
  };

  return {
    isValid: true,
    errors: [],
    proposal,
  };
}

/**
 * SERP-460 producer wiring: builds the OperationalFactEvent for an existing,
 * already-recorded customer payment receipt so it can be translated into a
 * draft journal proposal via translateEventToProposal. This never posts to
 * GL itself -- it only produces the event payload; the caller is responsible
 * for calling translateEventToProposal (and evaluateEventReplay first) and
 * for what, if anything, it does with the resulting draft proposal.
 */
export function buildPaymentReceivedEvent(params: {
  paymentId: string;
  organisationId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  paymentDate: string;
  method: string;
  recordedAt?: string;
}): OperationalFactEvent {
  const { paymentId, organisationId, invoiceId, invoiceNumber, amount, paymentDate, method, recordedAt } = params;
  // Cash on Hand (1110) for cash receipts, Bank Control (1115) for everything
  // routed through a bank/card/cheque -- both already exist in the chart of
  // accounts spec; this never invents a new account code.
  const debitAccountCode = method === 'Cash' ? '1110' : '1115';

  return {
    id: paymentId,
    organisationId,
    family: 'CASH_PAYMENT',
    eventType: 'PAYMENT_RECEIVED',
    sourceType: 'invoice_payment',
    sourceId: invoiceId,
    idempotencyKey: `invoice_payment:${paymentId}`,
    eventDate: paymentDate,
    currency: 'MVR',
    grossAmount: amount,
    narration: `Payment received for invoice ${invoiceNumber} (${method})`,
    lines: [
      { lineNo: 1, accountCode: debitAccountCode, debit: amount, credit: 0, narration: `${method} receipt` },
      { lineNo: 2, accountCode: '1210', debit: 0, credit: amount, narration: `Receivable cleared for ${invoiceNumber}` },
    ],
    recordedAt: recordedAt || new Date().toISOString(),
  };
}

/**
 * Replay protection / idempotency checker for accounting events.
 * Detects whether an event with the same idempotency key and payload has already been processed.
 */
export function evaluateEventReplay(
  newEvent: OperationalFactEvent,
  existingEvents: OperationalFactEvent[]
): { isReplay: boolean; isConflict: boolean; existingEvent?: OperationalFactEvent } {
  const match = existingEvents.find(
    (e) => e.organisationId === newEvent.organisationId && e.idempotencyKey === newEvent.idempotencyKey
  );

  if (!match) {
    return { isReplay: false, isConflict: false };
  }

  // Exact payload match: safe idempotent replay
  const sameSource = match.sourceType === newEvent.sourceType && match.sourceId === newEvent.sourceId;
  const sameAmount = Math.abs(match.grossAmount - newEvent.grossAmount) < 0.005;
  const sameType = match.eventType === newEvent.eventType;

  if (sameSource && sameAmount && sameType) {
    return { isReplay: true, isConflict: false, existingEvent: match };
  }

  // Key matches but payload differs: idempotency key conflict
  return { isReplay: false, isConflict: true, existingEvent: match };
}
