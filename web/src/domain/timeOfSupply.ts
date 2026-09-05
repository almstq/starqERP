/**
 * Maldives GST time of supply — SERP-339 beta finance layer.
 *
 * Statutory reference: MIRA general rule + consolidated GST Regulation,
 * Validation Study §3.3 / §4.1, Table 2.
 *
 * taxRates.ts's own header says time of supply "is the earlier of invoice
 * issue or payment received... this module does not guess it" and expects a
 * caller-supplied date. That caller-supplied date is what THIS module
 * computes - it derives time of supply from the underlying supply event and
 * document set, rather than trusting whichever date a UI happened to save.
 *
 * Three extensions beyond the plain "invoice or payment, whichever is
 * earlier" rule, all load-bearing:
 *  1. Receipts, credit notes and debit notes are time-of-supply events in
 *     their own right, not just invoices - the ordinary case for a business
 *     that issues receipts to unregistered retail customers.
 *  2. DEEMED SUPPLY: a tax invoice or receipt must be issued within three
 *     days of goods being delivered/made available, or of service
 *     completion. If nothing is issued in that window, time of supply is
 *     deemed to be the third day - even though a real invoice later exists.
 *     Worked example from the study: delivery on the 29th, invoice raised on
 *     the 4th of the next month -> the tax event still falls in the EARLIER
 *     period (the deemed 3rd day), not the invoice month.
 *  3. Consideration in kind and a granted right to use immovable property
 *     each have their own two-sided trigger rule (Table 2).
 *
 * Advances, deposits and instalments are explicitly flagged in the study as
 * needing MIRA's Guide to Time of Supply (G835) mapped before this module
 * can compute them - so, like TaxRateUnavailable, this throws rather than
 * guessing for that case.
 */

export type SupplyEventType =
  | 'GOODS_DELIVERY'
  | 'SERVICE_COMPLETION'
  | 'CONSIDERATION_IN_KIND'
  | 'RIGHT_TO_USE_IMMOVABLE_PROPERTY'
  | 'ADVANCE_DEPOSIT_OR_INSTALMENT';

export type SupplyDocumentType = 'TAX_INVOICE' | 'RECEIPT' | 'CREDIT_NOTE' | 'DEBIT_NOTE';

export interface SupplyDocument {
  type: SupplyDocumentType;
  /** ISO date the document was issued. */
  issuedDate: string;
}

export interface TimeOfSupplyRequest {
  supplyEventType: SupplyEventType;
  /** ISO date goods were delivered/made available, or the service was completed.
   * Required for GOODS_DELIVERY / SERVICE_COMPLETION - it anchors the 3-day deemed window. */
  supplyEventDate?: string;
  /** Any tax invoice / receipt / credit note / debit note issued for this supply. */
  documents?: SupplyDocument[];
  /** ISO date(s) of any full or partial payment received. */
  paymentDates?: string[];
  /** CONSIDERATION_IN_KIND / RIGHT_TO_USE_IMMOVABLE_PROPERTY only: when the supplier acquired the right to use the property. */
  rightAcquiredDate?: string;
  /** RIGHT_TO_USE_IMMOVABLE_PROPERTY only: when the supplier began using the property. */
  useBeganDate?: string;
}

export type TimeOfSupplyBasis = 'DOCUMENT' | 'PAYMENT' | 'DEEMED_THIRD_DAY' | 'CONSIDERATION_IN_KIND' | 'RIGHT_TO_USE';

export interface TimeOfSupplyDecision {
  timeOfSupply: string;
  basis: TimeOfSupplyBasis;
  triggeringDocumentType?: SupplyDocumentType;
  reason: string;
}

export class TimeOfSupplyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeOfSupplyValidationError';
  }
}

/** Thrown, never guessed at, when the Regulation requires case-specific rules this module doesn't have (yet). */
export class TimeOfSupplyUnresolved extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeOfSupplyUnresolved';
  }
}

function parseIsoDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TimeOfSupplyValidationError(`${field} must be an ISO date (YYYY-MM-DD).`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new TimeOfSupplyValidationError(`${field} is not a valid calendar date.`);
  }
  return date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.valueOf());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface Candidate {
  date: Date;
  basis: 'DOCUMENT' | 'PAYMENT';
  documentType?: SupplyDocumentType;
}

function resolveDeemedSupply(request: TimeOfSupplyRequest, eventLabel: string): TimeOfSupplyDecision {
  if (!request.supplyEventDate) {
    throw new TimeOfSupplyValidationError(`supplyEventDate is required for ${request.supplyEventType}.`);
  }
  const supplyEventDate = parseIsoDate(request.supplyEventDate, 'supplyEventDate');
  const deemedDate = addDays(supplyEventDate, 3);

  const candidates: Candidate[] = [];
  for (const doc of request.documents ?? []) {
    candidates.push({ date: parseIsoDate(doc.issuedDate, 'document.issuedDate'), basis: 'DOCUMENT', documentType: doc.type });
  }
  for (const paymentDate of request.paymentDates ?? []) {
    candidates.push({ date: parseIsoDate(paymentDate, 'paymentDate'), basis: 'PAYMENT' });
  }

  const withinWindow = candidates.filter((c) => c.date.getTime() <= deemedDate.getTime());
  if (withinWindow.length > 0) {
    withinWindow.sort((a, b) => a.date.getTime() - b.date.getTime());
    const earliest = withinWindow[0];
    return {
      timeOfSupply: toIso(earliest.date),
      basis: earliest.basis,
      triggeringDocumentType: earliest.documentType,
      reason:
        earliest.basis === 'DOCUMENT'
          ? `${earliest.documentType} issued ${toIso(earliest.date)}, within 3 days of ${eventLabel} on ${toIso(supplyEventDate)}.`
          : `Payment received ${toIso(earliest.date)}, within 3 days of ${eventLabel} on ${toIso(supplyEventDate)}.`,
    };
  }

  return {
    timeOfSupply: toIso(deemedDate),
    basis: 'DEEMED_THIRD_DAY',
    reason: `No tax invoice, receipt, credit note or debit note issued and no payment received within 3 days of ${eventLabel} on ${toIso(supplyEventDate)} - deemed supply on the third day, regardless of when a document is later raised.`,
  };
}

export function resolveTimeOfSupply(request: TimeOfSupplyRequest): TimeOfSupplyDecision {
  switch (request.supplyEventType) {
    case 'GOODS_DELIVERY':
      return resolveDeemedSupply(request, 'goods being removed or made available');

    case 'SERVICE_COMPLETION':
      return resolveDeemedSupply(request, 'service completion');

    case 'CONSIDERATION_IN_KIND': {
      const invoiceDates = (request.documents ?? [])
        .filter((d) => d.type === 'TAX_INVOICE')
        .map((d) => parseIsoDate(d.issuedDate, 'document.issuedDate'));
      const paymentDates = (request.paymentDates ?? []).map((p) => parseIsoDate(p, 'paymentDate'));
      const candidates = [...invoiceDates, ...paymentDates];
      if (candidates.length === 0) {
        throw new TimeOfSupplyUnresolved(
          'CONSIDERATION_IN_KIND requires either an invoice-preparation date or a consideration-provided (payment) date.',
        );
      }
      const earliest = candidates.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
      return {
        timeOfSupply: toIso(earliest),
        basis: 'CONSIDERATION_IN_KIND',
        reason: 'Earlier of invoice preparation or consideration provided; both parties are deemed to have supplied.',
      };
    }

    case 'RIGHT_TO_USE_IMMOVABLE_PROPERTY': {
      if (!request.rightAcquiredDate || !request.useBeganDate) {
        throw new TimeOfSupplyValidationError(
          'RIGHT_TO_USE_IMMOVABLE_PROPERTY requires both rightAcquiredDate and useBeganDate.',
        );
      }
      const acquired = parseIsoDate(request.rightAcquiredDate, 'rightAcquiredDate');
      const began = parseIsoDate(request.useBeganDate, 'useBeganDate');
      const earliest = acquired.getTime() <= began.getTime() ? acquired : began;
      return {
        timeOfSupply: toIso(earliest),
        basis: 'RIGHT_TO_USE',
        reason: 'Earlier of the supplier acquiring the right to use the property or beginning to use it.',
      };
    }

    case 'ADVANCE_DEPOSIT_OR_INSTALMENT':
      throw new TimeOfSupplyUnresolved(
        'Advances, deposits and instalments are governed by specific Regulation provisions (MIRA Guide to Time of Supply, G835) not yet mapped into this module - do not guess a time of supply for this case.',
      );

    default:
      throw new TimeOfSupplyValidationError(`Unrecognised supplyEventType: ${request.supplyEventType as string}`);
  }
}
