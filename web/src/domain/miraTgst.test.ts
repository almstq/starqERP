import { describe, it, expect } from 'vitest';
import { calculateMiraTgstReturn, createGreenTaxJournalEntry, GreenTaxStayRecord } from './miraTgst';

describe('SERP-319: MIRA Tourism GST (16% TGSTA) and Green Tax Engine', () => {
  const sampleInvoices = [
    {
      id: 'inv-tour-01',
      invoiceNumber: 'INV-TGST-001',
      issueDate: '2026-08-05',
      customerName: 'Global Luxury Charters',
      subtotal: 200000,
      taxAmount: 32000, // 16% TGST
      isTourismSector: true,
      gstRate: 0.16,
      status: 'paid',
    },
    {
      id: 'inv-gen-01',
      invoiceNumber: 'INV-GEN-001',
      issueDate: '2026-08-10',
      customerName: 'Local Male Delivery',
      subtotal: 50000,
      taxAmount: 4000, // 8% General GST
      isTourismSector: false,
      gstRate: 0.08,
      status: 'paid',
    },
  ];

  const sampleExpenses = [
    {
      id: 'exp-tour-01',
      reference: 'EXP-YACHT-FUEL',
      date: '2026-08-12',
      supplierName: 'State Electric & Fuel Maldives',
      amount: 58000, // 50000 + 8000 (16% TGST)
      taxAmount: 8000,
      isTourismSector: true,
    },
  ];

  const sampleStays: GreenTaxStayRecord[] = [
    {
      id: 'stay-01',
      guestName: 'Alexander Wright',
      passportOrId: 'GB9920194',
      nationality: 'British',
      isTourist: true,
      checkInDate: '2026-08-01',
      checkOutDate: '2026-08-08',
      totalNights: 7,
      ratePerNightUsd: 6.0,
      totalGreenTaxUsd: 42.0,
      exchangeRate: 15.42,
      totalGreenTaxMvr: 647.64,
    },
    {
      id: 'stay-02',
      guestName: 'Ibrahim Rasheed',
      passportOrId: 'A091823',
      nationality: 'Maldivian',
      isTourist: false, // Maldivians exempt
      checkInDate: '2026-08-10',
      checkOutDate: '2026-08-13',
      totalNights: 3,
      ratePerNightUsd: 6.0,
      totalGreenTaxUsd: 0,
      exchangeRate: 15.42,
      totalGreenTaxMvr: 0,
    },
  ];

  it('calculates 16% TGST output tax and input tax deductions accurately', () => {
    const result = calculateMiraTgstReturn({
      invoices: sampleInvoices,
      expenses: sampleExpenses,
      greenTaxStays: sampleStays,
      periodYear: 2026,
      periodMonth: 8,
      tin: '1002345GST501',
      legalEntityName: 'Maldives Yacht Charters Pvt Ltd',
    });

    expect(result.totalTourismTaxableSuppliesMvr).toBe(200000);
    expect(result.totalTgstOutputTaxMvr).toBe(32000); // 16% of 200,000
    expect(result.totalTourismPurchasesMvr).toBe(50000);
    expect(result.totalTgstInputTaxMvr).toBe(8000);
    expect(result.netTgstPayableMvr).toBe(24000); // 32,000 - 8,000
  });

  it('tracks Green Tax ($6.00 USD/night) for tourists while exempting local citizens', () => {
    const result = calculateMiraTgstReturn({
      invoices: sampleInvoices,
      expenses: sampleExpenses,
      greenTaxStays: sampleStays,
      periodYear: 2026,
      periodMonth: 8,
      tin: '1002345GST501',
      legalEntityName: 'Maldives Yacht Charters Pvt Ltd',
      usdToMvrRate: 15.42,
    });

    expect(result.totalTouristBedNights).toBe(7); // Only British tourist
    expect(result.totalGreenTaxPayableUsd).toBe(42.0); // 7 nights * $6
    expect(result.totalGreenTaxPayableMvr).toBe(647.64); // 42 * 15.42
  });

  it('generates balanced double-entry journal entry for Green Tax liability', () => {
    const result = calculateMiraTgstReturn({
      invoices: sampleInvoices,
      expenses: sampleExpenses,
      greenTaxStays: sampleStays,
      periodYear: 2026,
      periodMonth: 8,
      tin: '1002345GST501',
      legalEntityName: 'Maldives Yacht Charters Pvt Ltd',
    });

    const je = createGreenTaxJournalEntry(result, 'tenant-safari-01');
    expect(je).toBeDefined();
    expect(je?.isBalanced).toBe(true);
    expect(je?.totalDebit).toBe(647.64);
    expect(je?.totalCredit).toBe(647.64);
    expect(je?.lines[1].accountCode).toBe('2160'); // Green Tax Payable (MIRA)
  });
});
