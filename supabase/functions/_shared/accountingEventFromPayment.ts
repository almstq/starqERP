// SERP-460: builds the accounting_events + accounting_event_lines insert
// payload for an INVOICE_PAYMENT command, server-side, using only
// server-derived identity (organisation_id, the request's idempotency key)
// and the command body already authorized by api_garage_command. Pure
// function -- no Supabase client, no I/O -- so the shape can be checked
// without a live database.

export interface AccountingEventLineInsert {
  readonly organisation_id: string;
  readonly event_id: string;
  readonly line_no: number;
  readonly account_code: string;
  readonly debit: number;
  readonly credit: number;
}

export interface AccountingEventInsert {
  readonly id: string;
  readonly organisation_id: string;
  readonly family: 'CASH_PAYMENT';
  readonly event_type: 'PAYMENT_RECEIVED';
  readonly source_type: 'invoice_payment';
  readonly source_id: string;
  readonly idempotency_key: string;
  readonly event_date: string;
  readonly currency: 'MVR';
  readonly gross_amount: number;
  readonly narration: string;
}

export interface InvoicePaymentAccountingEvent {
  readonly event: AccountingEventInsert;
  readonly lines: readonly [AccountingEventLineInsert, AccountingEventLineInsert];
}

/**
 * Cash on Hand (1110) for cash receipts, Bank Control (1115) for everything
 * else (bank transfer, card, cheque) -- both existing chart-of-accounts
 * codes, nothing invented.
 */
export function debitAccountCodeForPaymentMethod(method: unknown): '1110' | '1115' {
  return method === 'Cash' ? '1110' : '1115';
}

export function buildInvoicePaymentAccountingEvent(params: {
  organisationId: string;
  invoiceId: string;
  amount: number;
  paymentDate?: string;
  method: unknown;
  idempotencyKeyHeader: string; // the x-idempotency-key for this command, already a UUID
  eventId: string; // pre-generated id so the lines can reference it before insert
}): InvoicePaymentAccountingEvent {
  const { organisationId, invoiceId, amount, paymentDate, method, idempotencyKeyHeader, eventId } = params;
  const debitAccountCode = debitAccountCodeForPaymentMethod(method);
  const eventDate = typeof paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(paymentDate)
    ? paymentDate
    : new Date().toISOString().slice(0, 10);

  return {
    event: {
      id: eventId,
      organisation_id: organisationId,
      family: 'CASH_PAYMENT',
      event_type: 'PAYMENT_RECEIVED',
      source_type: 'invoice_payment',
      source_id: invoiceId,
      // Keyed on the command's own idempotency key, not a new one, so a
      // retried/replayed INVOICE_PAYMENT command can never double-insert --
      // the table's unique(organisation_id, idempotency_key) constraint is
      // the actual guard; this just makes the key line up with it.
      idempotency_key: `invoice_payment:${idempotencyKeyHeader}`,
      event_date: eventDate,
      currency: 'MVR',
      gross_amount: amount,
      narration: `Payment received for invoice ${invoiceId}`,
    },
    lines: [
      { organisation_id: organisationId, event_id: eventId, line_no: 1, account_code: debitAccountCode, debit: amount, credit: 0 },
      { organisation_id: organisationId, event_id: eventId, line_no: 2, account_code: '1210', debit: 0, credit: amount },
    ],
  };
}

/** Postgres unique_violation -- the expected outcome on a command replay, not a real failure. */
export function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === '23505');
}
