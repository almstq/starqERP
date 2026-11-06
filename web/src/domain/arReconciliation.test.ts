import { describe, it, expect } from 'vitest';
import { reconcileAccountsReceivable } from './arReconciliation';
import { Invoice } from '../types/erp';

describe('SERP-461: Accounts Receivable (1210) Reconciliation Invariant', () => {
  const createMockInvoice = (overrides: Partial<Invoice>): Invoice => ({
    id: 'inv-001',
    invoiceNumber: 'INV-2026-0001',
    customerId: 'cust-001',
    customerName: 'Island Traders LLC',
    customerPhone: '7771234',
    customerIsland: 'Male',
    date: '2026-01-10',
    dueDate: '2026-02-10',
    items: [],
    subtotal: 1000,
    gstRate: 0.08,
    gstAmount: 80,
    totalAmount: 1080,
    amountPaid: 0,
    balanceDue: 1080,
    status: 'Sent',
    bankDetails: 'BML MVR Account',
    ...overrides,
  });

  it('reconciles cleanly when subledger matches Account 1210 control balance (happy path)', () => {
    const invoices: Invoice[] = [
      createMockInvoice({ id: 'inv-1', invoiceNumber: 'INV-001', totalAmount: 1080, amountPaid: 0, balanceDue: 1080 }),
      createMockInvoice({ id: 'inv-2', invoiceNumber: 'INV-002', totalAmount: 500, amountPaid: 200, balanceDue: 300, status: 'Partially Paid' }),
    ];

    // Total subledger = 1080 + 300 = 1380
    const result = reconcileAccountsReceivable(invoices, 1380);

    expect(result.isReconciled).toBe(true);
    expect(result.subledgerTotal).toBe(1380);
    expect(result.controlAccountBalance).toBe(1380);
    expect(result.variance).toBe(0);
    expect(result.error).toBeNull();
    expect(result.activeInvoices).toHaveLength(2);
    expect(result.unreconciledInvoices).toEqual([]);
  });

  it('ignores fully paid (balanceDue = 0) and cancelled invoices in subledger calculation', () => {
    const invoices: Invoice[] = [
      createMockInvoice({ id: 'inv-1', invoiceNumber: 'INV-001', totalAmount: 1000, amountPaid: 1000, balanceDue: 0, status: 'Paid' }),
      createMockInvoice({ id: 'inv-2', invoiceNumber: 'INV-002', totalAmount: 800, amountPaid: 0, balanceDue: 800, status: 'Cancelled' }),
      createMockInvoice({ id: 'inv-3', invoiceNumber: 'INV-003', totalAmount: 600, amountPaid: 100, balanceDue: 500 }),
    ];

    const result = reconcileAccountsReceivable(invoices, 500);

    expect(result.isReconciled).toBe(true);
    expect(result.subledgerTotal).toBe(500);
    expect(result.activeInvoices).toHaveLength(1);
    expect(result.activeInvoices[0].invoiceId).toBe('inv-3');
    expect(result.unreconciledInvoices).toEqual([]);
  });

  it('handles empty invoice set when control account balance is 0', () => {
    const result = reconcileAccountsReceivable([], 0);
    expect(result.isReconciled).toBe(true);
    expect(result.subledgerTotal).toBe(0);
    expect(result.variance).toBe(0);
    expect(result.activeInvoices).toHaveLength(0);
    expect(result.unreconciledInvoices).toEqual([]);
  });

  // Acceptance Criterion: Automated test that deliberately breaks the invariant and proves failure
  describe('Deliberate Breakage & Invariant Violation Failure', () => {
    it('correctly FAILS with non-zero variance, names specific invoice numbers in error text, and populates unreconciledInvoices (GL Control > Subledger)', () => {
      const invoices: Invoice[] = [
        createMockInvoice({ id: 'inv-1', invoiceNumber: 'INV-2026-0001', totalAmount: 1000, amountPaid: 0, balanceDue: 1000 }),
      ];

      // GL has 1500 (e.g. manual stray journal into 1210 without an invoice)
      const controlBalance = 1500;
      const result = reconcileAccountsReceivable(invoices, controlBalance);

      expect(result.isReconciled).toBe(false);
      expect(result.subledgerTotal).toBe(1000);
      expect(result.controlAccountBalance).toBe(1500);
      expect(result.variance).toBe(-500);
      expect(result.error).toContain('AR Reconciliation Invariant Violated');
      expect(result.error).toContain('Subledger total (MVR 1000.00) does not match Account 1210 control balance (MVR 1500.00)');
      expect(result.error).toContain('Variance: MVR -500.00');
      // Assert specific invoice number is explicitly identified in error text
      expect(result.error).toContain('Contributing subledger invoices: [INV-2026-0001]');
      // Assert unreconciledInvoices contains the invoice item
      expect(result.unreconciledInvoices).toHaveLength(1);
      expect(result.unreconciledInvoices[0].invoiceNumber).toBe('INV-2026-0001');
    });

    it('correctly FAILS and identifies all contributing invoices when invoices exist without GL debit posting (Subledger > Control)', () => {
      const invoices: Invoice[] = [
        createMockInvoice({ id: 'inv-101', invoiceNumber: 'INV-ALPHA', totalAmount: 2500, amountPaid: 500, balanceDue: 2000 }),
        createMockInvoice({ id: 'inv-102', invoiceNumber: 'INV-BETA', totalAmount: 1200, amountPaid: 0, balanceDue: 1200 }),
      ];

      // GL control balance is 2000 (missing inv-102's 1200 receivable posting)
      const controlBalance = 2000;
      const result = reconcileAccountsReceivable(invoices, controlBalance);

      expect(result.isReconciled).toBe(false);
      expect(result.subledgerTotal).toBe(3200);
      expect(result.controlAccountBalance).toBe(2000);
      expect(result.variance).toBe(1200);
      expect(result.error).toContain('Variance: MVR 1200.00');
      // Assert specific invoice numbers are identified in error text
      expect(result.error).toContain('Contributing subledger invoices: [INV-ALPHA, INV-BETA]');
      expect(result.unreconciledInvoices.map((i) => i.invoiceNumber)).toEqual(['INV-ALPHA', 'INV-BETA']);
    });

    it('enforces exact zero tolerance for minor rounding discrepancies (e.g. 0.01 MVR mismatch)', () => {
      const invoices: Invoice[] = [
        createMockInvoice({ id: 'inv-1', invoiceNumber: 'INV-CENT', balanceDue: 100.00 }),
      ];

      // A 1-laari discrepancy
      const controlBalance = 100.01;
      const result = reconcileAccountsReceivable(invoices, controlBalance);

      expect(result.isReconciled).toBe(false);
      expect(result.variance).toBe(-0.01);
      expect(result.error).toContain('Variance: MVR -0.01');
      expect(result.error).toContain('Contributing subledger invoices: [INV-CENT]');
      expect(result.unreconciledInvoices).toHaveLength(1);
    });
  });
});
