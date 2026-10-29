import { describe, it, expect } from 'vitest';
import {
  reconcileApToGL,
  AP_CONTROL_ACCOUNT_CODE,
} from './apReconciliation';
import { PurchaseOrder } from '../types/erp';
import type { JournalEntry } from './journals';

describe('SERP-461: Accounts Payable (2110) Subledger to GL Reconciliation Invariant', () => {
  const tenantId = 'tenant-test-ap';

  const createMockPO = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
    id: 'po-001',
    poNumber: 'PO-2026-001',
    supplierId: 'supp-01',
    supplierName: 'State Trading Organization (STO)',
    orderDate: '2026-08-10',
    expectedDeliveryDate: '2026-08-20',
    items: [
      {
        id: 'line-1',
        inventoryId: 'inv-1',
        itemName: 'Engine Oil 5W-30',
        quantity: 10,
        unit: 'Bottle',
        unitCost: 150.00,
        totalCost: 1500.00,
        receivedQuantity: 0,
      },
    ],
    subtotal: 1500.00,
    gstAmount: 120.00,
    totalAmount: 1620.00,
    status: 'Sent',
    paymentStatus: 'Unpaid',
    ...overrides,
  });

  const createMockJournal = (
    date: string,
    accountCode: string,
    debit: number,
    credit: number,
    overrides: Partial<JournalEntry> = {}
  ): JournalEntry => ({
    id: `jnl-${Math.random().toString(36).substring(2, 9)}`,
    tenantId,
    entryNumber: `JE-AP-${date}`,
    date,
    reference: 'PO-REF',
    narration: 'Procurement Bill AP movement',
    source: 'BILL',
    status: 'POSTED',
    lines: [
      {
        id: `line-${Math.random().toString(36).substring(2, 9)}`,
        accountId: `acc-${accountCode}`,
        accountCode,
        accountName: 'Accounts Payable',
        accountClass: 'LIABILITY',
        debit,
        credit,
        narration: 'AP ledger movement',
      },
    ],
    totalDebit: debit,
    totalCredit: credit,
    isBalanced: debit === credit,
    postedBy: 'System / Procurement Engine',
    postedAt: `${date}T10:00:00Z`,
    ...overrides,
  });

  it('reconciles cleanly when gross subledger of unpaid/partially paid POs matches Account 2110 credit balance (happy path)', () => {
    const purchaseOrders: PurchaseOrder[] = [
      createMockPO({ id: 'po-1', poNumber: 'PO-001', totalAmount: 1620.00, paymentStatus: 'Unpaid' }),
      createMockPO({ id: 'po-2', poNumber: 'PO-002', supplierName: 'Maldives Marine Supply', totalAmount: 3380.00, paymentStatus: 'Partially Paid' }),
    ];

    // Subledger gross total = 1620.00 + 3380.00 = 5000.00 (Partially Paid is counted at gross total)
    // Live producer derives BILL journals crediting 2110 with 5000.00 total
    const journals: JournalEntry[] = [
      createMockJournal('2026-08-10', AP_CONTROL_ACCOUNT_CODE, 0, 1620.00),
      createMockJournal('2026-08-12', AP_CONTROL_ACCOUNT_CODE, 0, 3380.00),
    ];

    const result = reconcileApToGL({
      purchaseOrders,
      journals,
      tenantId,
    });

    expect(result.accountCode).toBe('2110');
    expect(result.isReconciled).toBe(true);
    expect(result.subledgerTotal).toBe(5000.00);
    expect(result.glControlBalance).toBe(5000.00);
    expect(result.variance).toBe(0);
    expect(result.error).toBeNull();
    expect(result.activePurchaseOrders).toHaveLength(2);
    expect(result.unreconciledPurchaseOrders).toEqual([]);
    expect(result.excludedPurchaseOrders).toEqual([]);
  });

  it('correctly FAILS with non-zero variance, carries honest aggregate limitation wording, and populates unreconciledPurchaseOrders with full active set', () => {
    const purchaseOrders: PurchaseOrder[] = [
      createMockPO({ id: 'po-1', poNumber: 'PO-STO-881', supplierName: 'STO Maldives', totalAmount: 2500.00, paymentStatus: 'Unpaid' }),
      createMockPO({ id: 'po-2', poNumber: 'PO-ALIA-102', supplierName: 'Alia Investments', totalAmount: 1500.00, paymentStatus: 'Unpaid' }),
    ];

    // Total subledger gross = 4000.00. GL balance has only 3000.00 credit (variance 1000.00)
    const journals: JournalEntry[] = [
      createMockJournal('2026-08-10', AP_CONTROL_ACCOUNT_CODE, 0, 3000.00),
    ];

    const result = reconcileApToGL({
      purchaseOrders,
      journals,
      tenantId,
    });

    expect(result.isReconciled).toBe(false);
    expect(result.subledgerTotal).toBe(4000.00);
    expect(result.glControlBalance).toBe(3000.00);
    expect(result.variance).toBe(1000.00);
    expect(result.error).toContain('Accounts Payable Reconciliation Invariant Violated [Account 2110]');
    expect(result.error).toContain('Subledger gross total (MVR 4000.00) does not match Account 2110 GL credit balance (MVR 3000.00)');
    expect(result.error).toContain('Variance: MVR 1000.00');
    // Aggregate-only limitation wording
    expect(result.error).toContain('Active open POs on subledger at time of mismatch (aggregate-only comparison; per-PO GL postings do not exist, so specific contributing PO(s) cannot be isolated from aggregate data alone -- manual investigation required)');
    // unreconciledPurchaseOrders equals the full active set
    expect(result.unreconciledPurchaseOrders).toEqual(result.activePurchaseOrders);
    expect(result.unreconciledPurchaseOrders).toHaveLength(2);
    expect(result.unreconciledPurchaseOrders.map((p) => p.poNumber)).toEqual(['PO-STO-881', 'PO-ALIA-102']);
  });

  it('proves Paid POs are excluded from the AP subledger side since they post to Bank 1111 not 2110', () => {
    const purchaseOrders: PurchaseOrder[] = [
      createMockPO({ id: 'po-unpaid', poNumber: 'PO-UNPAID', totalAmount: 1000.00, paymentStatus: 'Unpaid' }),
      createMockPO({ id: 'po-paid', poNumber: 'PO-PAID', totalAmount: 4000.00, paymentStatus: 'Paid' }), // Paid: excluded from AP
    ];

    // GL only records the 1000.00 to 2110 (Paid PO was credited to 1111 Bank per journals.ts:366)
    const journals: JournalEntry[] = [
      createMockJournal('2026-08-10', AP_CONTROL_ACCOUNT_CODE, 0, 1000.00),
    ];

    const result = reconcileApToGL({
      purchaseOrders,
      journals,
      tenantId,
    });

    expect(result.isReconciled).toBe(true);
    expect(result.subledgerTotal).toBe(1000.00);
    expect(result.glControlBalance).toBe(1000.00);
    expect(result.variance).toBe(0);
    expect(result.activePurchaseOrders).toHaveLength(1);
    expect(result.activePurchaseOrders[0].poNumber).toBe('PO-UNPAID');
    expect(result.excludedPurchaseOrders).toHaveLength(1);
    expect(result.excludedPurchaseOrders[0].poNumber).toBe('PO-PAID');
    expect(result.excludedPurchaseOrders[0].paymentStatus).toBe('Paid');
  });

  it('proves Draft and Cancelled POs are excluded from the AP subledger calculation', () => {
    const purchaseOrders: PurchaseOrder[] = [
      createMockPO({ id: 'po-active', poNumber: 'PO-ACTIVE', totalAmount: 1200.00, status: 'Sent', paymentStatus: 'Unpaid' }),
      createMockPO({ id: 'po-draft', poNumber: 'PO-DRAFT', totalAmount: 800.00, status: 'Draft', paymentStatus: 'Unpaid' }),
      createMockPO({ id: 'po-cancelled', poNumber: 'PO-CANCELLED', totalAmount: 1500.00, status: 'Cancelled', paymentStatus: 'Unpaid' }),
    ];

    const journals: JournalEntry[] = [
      createMockJournal('2026-08-10', AP_CONTROL_ACCOUNT_CODE, 0, 1200.00),
    ];

    const result = reconcileApToGL({
      purchaseOrders,
      journals,
      tenantId,
    });

    expect(result.isReconciled).toBe(true);
    expect(result.subledgerTotal).toBe(1200.00);
    expect(result.activePurchaseOrders).toHaveLength(1);
    expect(result.activePurchaseOrders[0].poNumber).toBe('PO-ACTIVE');
    expect(result.excludedPurchaseOrders).toHaveLength(2);
    expect(result.excludedPurchaseOrders.map((p) => p.poNumber)).toEqual(['PO-DRAFT', 'PO-CANCELLED']);
  });

  it('proves multiCurrency AP_DISBURSEMENT debiting 2110 for a bill settlement causes variance equal to the paid amount when PO paymentStatus remains Unpaid/Partially Paid', () => {
    // Bill originally entered at 15,420.00 MVR ($1,000 USD @ 15.42)
    const poOriginalMvr = 15420.00;
    const purchaseOrders: PurchaseOrder[] = [
      createMockPO({ id: 'po-usd', poNumber: 'PO-USD-IMPORT', totalAmount: poOriginalMvr, paymentStatus: 'Unpaid' }),
    ];

    // GL Bill derivation: CR 2110 with 15,420.00
    const billJournal = createMockJournal('2026-08-10', AP_CONTROL_ACCOUNT_CODE, 0, poOriginalMvr);

    // Multi-currency AP disbursement posted via MultiCurrencyView (multiCurrency.ts:140-144):
    // Settled at 15.45 => settledMvr = 15,450.00, originalMvr = 15,420.00, FX loss = 30.00
    // DR 2110 (originalMvr = 15,420.00)
    // DR 6410 Realized FX Loss (30.00)
    // CR 1111 Bank (15,450.00)
    const disbursementJournal: JournalEntry = {
      id: 'je-fx-disbursement',
      tenantId,
      entryNumber: 'JE-FX-DISBURSE',
      date: '2026-08-20',
      source: 'FX_REALIZATION',
      reference: 'FX-PO-USD-IMPORT',
      narration: 'Realized FX Loss on settlement of PO-USD-IMPORT (1000 USD)',
      lines: [
        {
          id: 'l1',
          accountId: 'acc-2110',
          accountCode: AP_CONTROL_ACCOUNT_CODE,
          accountName: 'Accounts Payable',
          accountClass: 'LIABILITY',
          debit: poOriginalMvr, // Full bill settlement debit to 2110
          credit: 0,
          narration: 'AP Bill Clearing (1000 USD @ 15.42)',
        },
        {
          id: 'l2',
          accountId: 'acc-6410',
          accountCode: '6410',
          accountName: 'Realized Foreign Exchange Loss',
          accountClass: 'EXPENSE',
          debit: 30.00,
          credit: 0,
          narration: 'FX Loss on PO-USD-IMPORT',
        },
        {
          id: 'l3',
          accountId: 'acc-1111',
          accountCode: '1111',
          accountName: 'Bank of Maldives (BML) MVR Main',
          accountClass: 'ASSET',
          debit: 0,
          credit: 15450.00,
          narration: 'Bank Settlement (1000 USD @ 15.45)',
        },
      ],
      totalDebit: 15450.00,
      totalCredit: 15450.00,
      isBalanced: true,
      postedBy: 'System / FX Engine',
      postedAt: '2026-08-20T10:00:00Z',
      status: 'POSTED',
    };

    const journals: JournalEntry[] = [billJournal, disbursementJournal];

    const result = reconcileApToGL({
      purchaseOrders,
      journals,
      tenantId,
    });

    // GL net credit balance is 15420 - 15420 = 0.00.
    // Subledger remains at 15420.00 because PO was not updated to Paid.
    // Variance exactly equals the paid originalMvr amount (15,420.00).
    expect(result.isReconciled).toBe(false);
    expect(result.subledgerTotal).toBe(poOriginalMvr);
    expect(result.glControlBalance).toBe(0);
    expect(result.variance).toBe(poOriginalMvr);
    expect(result.error).toContain('Note on Disbursements & Data Consistency: Manual or multi-currency AP disbursements (e.g. multiCurrency.ts AP_DISBURSEMENT debiting 2110 at originalMvr) settle bills in the GL without automatically updating PO paymentStatus to \'Paid\' in current engine');
  });

  it('enforces strict zero tolerance for minor rounding discrepancies (0.01 MVR mismatch)', () => {
    const purchaseOrders: PurchaseOrder[] = [
      createMockPO({ totalAmount: 1000.00, paymentStatus: 'Unpaid' }),
    ];

    const journals: JournalEntry[] = [
      createMockJournal('2026-08-10', AP_CONTROL_ACCOUNT_CODE, 0, 999.99),
    ];

    const result = reconcileApToGL({
      purchaseOrders,
      journals,
      tenantId,
    });

    expect(result.isReconciled).toBe(false);
    expect(result.variance).toBe(0.01);
    expect(result.error).toContain('Variance: MVR 0.01');
  });
});
