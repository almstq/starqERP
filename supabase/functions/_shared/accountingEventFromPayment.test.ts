import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildInvoicePaymentAccountingEvent,
  debitAccountCodeForPaymentMethod,
  isUniqueViolation,
} from './accountingEventFromPayment.ts';

Deno.test('debitAccountCodeForPaymentMethod: Cash -> 1110, everything else -> 1115', () => {
  assertEquals(debitAccountCodeForPaymentMethod('Cash'), '1110');
  assertEquals(debitAccountCodeForPaymentMethod('BML Bank Transfer'), '1115');
  assertEquals(debitAccountCodeForPaymentMethod('POS Card'), '1115');
  assertEquals(debitAccountCodeForPaymentMethod(undefined), '1115');
});

Deno.test('buildInvoicePaymentAccountingEvent: produces a balanced event keyed on the command idempotency key', () => {
  const { event, lines } = buildInvoicePaymentAccountingEvent({
    organisationId: 'org-1',
    invoiceId: 'inv-1',
    amount: 750,
    paymentDate: '2026-10-29',
    method: 'BML Bank Transfer',
    idempotencyKeyHeader: 'cmd-key-abc',
    eventId: 'evt-1',
  });

  assertEquals(event.idempotency_key, 'invoice_payment:cmd-key-abc');
  assertEquals(event.organisation_id, 'org-1');
  assertEquals(event.source_id, 'inv-1');
  assertEquals(event.gross_amount, 750);

  assertEquals(lines.length, 2);
  const debitLine = lines.find((l) => l.debit > 0)!;
  const creditLine = lines.find((l) => l.credit > 0)!;
  assertEquals(debitLine.account_code, '1115'); // bank, not cash
  assertEquals(debitLine.debit, 750);
  assertEquals(creditLine.account_code, '1210'); // AR control
  assertEquals(creditLine.credit, 750);
  assertEquals(debitLine.debit, creditLine.credit); // balanced
});

Deno.test('buildInvoicePaymentAccountingEvent: identical idempotency key header always yields the identical event key', () => {
  const first = buildInvoicePaymentAccountingEvent({
    organisationId: 'org-1', invoiceId: 'inv-1', amount: 200, method: 'Cash',
    idempotencyKeyHeader: 'cmd-key-retry', eventId: 'evt-a',
  });
  const second = buildInvoicePaymentAccountingEvent({
    organisationId: 'org-1', invoiceId: 'inv-1', amount: 200, method: 'Cash',
    idempotencyKeyHeader: 'cmd-key-retry', eventId: 'evt-b', // different event id, same command retry
  });
  // Same command-level idempotency key -> same accounting-event idempotency
  // key -> the table's unique(organisation_id, idempotency_key) constraint
  // is what actually stops the duplicate insert on a replayed command.
  assertEquals(first.event.idempotency_key, second.event.idempotency_key);
});

Deno.test('isUniqueViolation: recognizes Postgres 23505, rejects everything else', () => {
  assert(isUniqueViolation({ code: '23505' }));
  assert(!isUniqueViolation({ code: '23503' }));
  assert(!isUniqueViolation(new Error('some other failure')));
  assert(!isUniqueViolation(null));
});
