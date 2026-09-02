import { rateMatchesBand, taxOnExclusive, taxWithinInclusive } from './taxRates';

export interface GreenTaxStayRecord {
  id: string;
  guestName: string;
  passportOrId: string;
  nationality: string; // Foreign tourists pay $6/night, Maldivian citizens exempt
  isTourist: boolean;
  checkInDate: string;
  checkOutDate: string;
  totalNights: number;
  ratePerNightUsd: number; // Official MIRA rate: $6.00 USD per night
  totalGreenTaxUsd: number;
  exchangeRate: number; // Default 15.42 MVR/USD
  totalGreenTaxMvr: number;
}

export interface MiraTgstReturn {
  returnId: string;
  tin: string;
  legalEntityName: string;
  taxPeriod: string; // YYYY-MM
  periodStartDate: string;
  periodEndDate: string;
  filingDueDate: string; // 28th of following month
  currency: 'MVR';
  
  // Tourism GST output tax, at the rate in force on each supply date
  totalTourismTaxableSuppliesMvr: number;
  totalTgstOutputTaxMvr: number; // Supplies x the rate in force at time of supply

  // Deductible Tourism Input Tax
  totalTourismPurchasesMvr: number;
  totalTgstInputTaxMvr: number;

  // Net TGST
  netTgstPayableMvr: number;

  // Green Tax Summary
  totalTouristBedNights: number;
  totalGreenTaxPayableUsd: number;
  totalGreenTaxPayableMvr: number;
  greenTaxRecords: GreenTaxStayRecord[];

  generatedAt: string;
}

export interface CalculateTgstParams {
  invoices: Array<{
    id: string;
    invoiceNumber?: string;
    issueDate?: string;
    createdAt?: string;
    customerName?: string;
    subtotal: number;
    taxAmount?: number;
    isTourismSector?: boolean;
    gstRate?: number;
    status?: string;
  }>;
  expenses: Array<{
    id: string;
    reference?: string;
    date?: string;
    supplierName?: string;
    amount: number;
    taxAmount?: number;
    isTourismSector?: boolean;
    status?: string;
  }>;
  greenTaxStays?: GreenTaxStayRecord[];
  periodYear: number;
  periodMonth: number;
  tin: string;
  legalEntityName: string;
  usdToMvrRate?: number;
}

const DEFAULT_USD_MVR_RATE = 15.42;
const OFFICIAL_GREEN_TAX_RATE_USD = 6.0;

/**
 * Calculates the official MIRA Tourism GST and Green Tax return schedule.
 * The TGST rate is resolved per supply date from domain/taxRates.ts, never fixed
 * for the period: a return spanning 30 June / 1 July 2025 computes both 16% and 17%.
 */
export function calculateMiraTgstReturn(params: CalculateTgstParams): MiraTgstReturn {
  const {
    invoices,
    expenses,
    greenTaxStays = [],
    periodYear,
    periodMonth,
    tin,
    legalEntityName,
    usdToMvrRate = DEFAULT_USD_MVR_RATE,
  } = params;

  const monthPadded = String(periodMonth).padStart(2, '0');
  const taxPeriod = `${periodYear}-${monthPadded}`;
  const periodStartDate = `${periodYear}-${monthPadded}-01`;
  const lastDay = new Date(periodYear, periodMonth, 0).getDate();
  const periodEndDate = `${periodYear}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

  const nextMonth = periodMonth === 12 ? 1 : periodMonth + 1;
  const nextYear = periodMonth === 12 ? periodYear + 1 : periodYear;
  const filingDueDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-28`;

  // 1. Tourism GST output tax, at the rate in force on each supply date.
  //    SERP-342: the rate is resolved per invoice by time of supply, not applied
  //    as a single period constant. A June-2025 and a July-2025 supply in the same
  //    return compute at 16% and 17% respectively, from this one code path.
  let totalTourismSupplies = 0;
  let totalTgstOutput = 0;

  for (const inv of invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft') continue;
    const invDate = inv.issueDate || inv.createdAt?.slice(0, 10) || '';
    if (invDate < periodStartDate || invDate > periodEndDate) continue;

    if (inv.isTourismSector || rateMatchesBand('gst_tourism', invDate, inv.gstRate)) {
      const subtotal = Number(inv.subtotal) || 0;
      const tax = inv.taxAmount !== undefined
        ? Number(inv.taxAmount)
        : taxOnExclusive('gst_tourism', invDate, subtotal);
      totalTourismSupplies += subtotal;
      totalTgstOutput += tax;
    }
  }

  // 2. Calculate Deductible Tourism Input Tax
  let totalTourismPurchases = 0;
  let totalTgstInput = 0;

  for (const exp of expenses) {
    if (exp.status === 'cancelled') continue;
    const expDate = exp.date || '';
    if (expDate < periodStartDate || expDate > periodEndDate) continue;

    if (exp.isTourismSector) {
      const totalAmt = Number(exp.amount) || 0;
      // Reverse charge on a tax-inclusive amount: rate/(1+rate). At 16% that is
      // the familiar 16/116; at 17% it becomes 17/117. Neither is hard-coded.
      const taxAmt = exp.taxAmount !== undefined
        ? Number(exp.taxAmount)
        : taxWithinInclusive('gst_tourism', expDate, totalAmt);
      const taxable = round2(totalAmt - taxAmt);
      totalTourismPurchases += taxable;
      totalTgstInput += taxAmt;
    }
  }

  const netTgstPayableMvr = round2(totalTgstOutput - totalTgstInput);

  // 3. Calculate Green Tax ($6.00 USD / night for foreign tourists)
  let totalBedNights = 0;
  let totalGreenTaxUsd = 0;
  const processedStays: GreenTaxStayRecord[] = [];

  for (const stay of greenTaxStays) {
    const isTour = stay.isTourist !== false && stay.nationality?.toLowerCase() !== 'maldivian';
    const nights = Math.max(1, stay.totalNights || 1);
    const taxUsd = isTour ? round2(nights * (stay.ratePerNightUsd || OFFICIAL_GREEN_TAX_RATE_USD)) : 0;
    const taxMvr = round2(taxUsd * usdToMvrRate);

    if (isTour) {
      totalBedNights += nights;
      totalGreenTaxUsd += taxUsd;
    }

    processedStays.push({
      ...stay,
      isTourist: isTour,
      totalNights: nights,
      ratePerNightUsd: OFFICIAL_GREEN_TAX_RATE_USD,
      totalGreenTaxUsd: taxUsd,
      exchangeRate: usdToMvrRate,
      totalGreenTaxMvr: taxMvr,
    });
  }

  const totalGreenTaxPayableMvr = round2(totalGreenTaxUsd * usdToMvrRate);

  return {
    returnId: `MIRA-TGST-${taxPeriod}-${tin || 'TAX'}`,
    // SERP-237: the engine must not invent a TIN either. A view passing an
    // empty string was still getting a fabricated identifier back, which is how
    // a fake number reaches a return even after the UI is cleaned up.
    tin: tin || '',
    legalEntityName,
    taxPeriod,
    periodStartDate,
    periodEndDate,
    filingDueDate,
    currency: 'MVR',
    totalTourismTaxableSuppliesMvr: round2(totalTourismSupplies),
    totalTgstOutputTaxMvr: round2(totalTgstOutput),
    totalTourismPurchasesMvr: round2(totalTourismPurchases),
    totalTgstInputTaxMvr: round2(totalTgstInput),
    netTgstPayableMvr,
    totalTouristBedNights: totalBedNights,
    totalGreenTaxPayableUsd: round2(totalGreenTaxUsd),
    totalGreenTaxPayableMvr,
    greenTaxRecords: processedStays,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Creates double-entry journal entry for Green Tax liability booking.
 */
export function createGreenTaxJournalEntry(ret: MiraTgstReturn, tenantId: string) {
  const mvrAmount = ret.totalGreenTaxPayableMvr;
  if (mvrAmount <= 0) return null;

  return {
    id: `je-green-tax-${ret.taxPeriod}`,
    entryNumber: `JE-GT-${ret.taxPeriod.replace('-', '')}`,
    date: ret.periodEndDate,
    source: 'TAX_PROVISION',
    reference: `MIRA-GREEN-TAX-${ret.taxPeriod}`,
    narration: `Green Tax Provision for ${ret.taxPeriod} (${ret.totalTouristBedNights} bed nights @ $6.00 USD)`,
    lines: [
      {
        id: `gt-line-dr`,
        accountCode: '1210', // Accounts Receivable (or Guest Ledger)
        accountName: 'Trade Debtors Control Account',
        debit: mvrAmount,
        credit: 0,
        description: `Green Tax Collected (${ret.totalTouristBedNights} nights)`,
      },
      {
        id: `gt-line-cr`,
        accountCode: '2123', // Green Tax Payable to MIRA
        accountName: 'Green Tax Payable (MIRA)',
        debit: 0,
        credit: mvrAmount,
        description: `Green Tax Statutory Liability to MIRA`,
      },
    ],
    totalDebit: mvrAmount,
    totalCredit: mvrAmount,
    isBalanced: true,
    postedBy: 'System / TGST Engine',
    postedAt: new Date().toISOString(),
    tenantId,
    status: 'POSTED',
  };
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}
