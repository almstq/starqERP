import { describe, expect, it } from 'vitest';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../data/defaultChartOfAccounts';
import {
  CreditNote,
  CustomerAdvance,
  generateCreditNoteJournals,
  generateCustomerAdvanceJournals,
  generateSettlementAllocationJournals,
  SettlementAllocation,
} from './creditNotes';
import { AccountingPeriod, generateFiscalPeriods } from './periods';

const accounts = DEFAULT_CHART_OF_ACCOUNTS;

function augustPeriods(status: AccountingPeriod['status']): AccountingPeriod[] {
  return generateFiscalPeriods(2026).map((period) => (
    period.month === 8
      ? { ...period, status, lockedBy: 'Controller' }
      : period
  ));
}

const creditNote: CreditNote = {
  id: 'cn-1',
  creditNoteNumber: 'CN-2026-001',
  tenantId: 'tenant-01',
  customerId: 'cust-1',
  customerName: 'Example Customer',
  issueDate: '2026-08-15',
  reason: 'Allowance',
  items: [],
  subtotal: 1000,
  taxAmount: 80,
  totalAmount: 1080,
  allocatedAmount: 0,
  remainingBalance: 1080,
  status: 'Issued',
  currency: 'MVR',
  createdAt: '2026-08-15T00:00:00.000Z',
  createdBy: 'tester',
};

const advance: CustomerAdvance = {
  id: 'adv-1',
  receiptNumber: 'ADV-2026-001',
  tenantId: 'tenant-01',
  customerId: 'cust-1',
  customerName: 'Example Customer',
  paymentDate: '2026-08-15',
  amount: 1500,
  paymentMethod: 'Bank Transfer',
  reference: 'BML-1',
  allocatedAmount: 0,
  remainingBalance: 1500,
  status: 'Unallocated',
  currency: 'MVR',
  createdAt: '2026-08-15T00:00:00.000Z',
  createdBy: 'tester',
};

const allocation: SettlementAllocation = {
  id: 'alloc-1',
  allocationNumber: 'SET-2026-001',
  tenantId: 'tenant-01',
  sourceType: 'CUSTOMER_ADVANCE',
  sourceId: 'adv-1',
  sourceNumber: 'ADV-2026-001',
  targetInvoiceId: 'inv-1',
  targetInvoiceNumber: 'INV-2026-001',
  customerId: 'cust-1',
  customerName: 'Example Customer',
  allocatedAmount: 500,
  allocationDate: '2026-08-20',
  createdAt: '2026-08-20T00:00:00.000Z',
  createdBy: 'tester',
};

describe('SERP-467: credit note, advance, and settlement posting gate', () => {
  it('posts credit notes, advances, and allocations in an open period', () => {
    const periods = augustPeriods('OPEN');

    const [creditJournal] = generateCreditNoteJournals({
      creditNotes: [creditNote],
      accounts,
      periods,
      isGstRegistered: true,
    });
    expect(creditJournal.status).toBe('POSTED');
    expect(creditJournal.lines.map((line) => line.accountCode)).toEqual(['4210', '2121', '1210']);

    const [advanceJournal] = generateCustomerAdvanceJournals({
      advances: [advance],
      accounts,
      periods,
    });
    expect(advanceJournal.lines.map((line) => line.accountCode)).toEqual(['1111', '2150']);

    const [allocationJournal] = generateSettlementAllocationJournals({
      allocations: [allocation],
      accounts,
      periods,
    });
    expect(allocationJournal.lines.map((line) => line.accountCode)).toEqual(['2150', '1210']);
  });

  it('rejects a credit note dated in a LOCKED period', () => {
    expect(() => generateCreditNoteJournals({
      creditNotes: [creditNote],
      accounts,
      periods: augustPeriods('LOCKED'),
    })).toThrow(/LOCKED/);
  });

  it('rejects a credit note dated in a CLOSED period', () => {
    expect(() => generateCreditNoteJournals({
      creditNotes: [creditNote],
      accounts,
      periods: augustPeriods('CLOSED'),
    })).toThrow(/CLOSED/);
  });

  it('rejects a customer advance dated in a LOCKED or CLOSED period', () => {
    expect(() => generateCustomerAdvanceJournals({
      advances: [advance],
      accounts,
      periods: augustPeriods('LOCKED'),
    })).toThrow(/LOCKED/);
    expect(() => generateCustomerAdvanceJournals({
      advances: [advance],
      accounts,
      periods: augustPeriods('CLOSED'),
    })).toThrow(/CLOSED/);
  });

  it('rejects a settlement allocation dated in a LOCKED or CLOSED period', () => {
    expect(() => generateSettlementAllocationJournals({
      allocations: [allocation],
      accounts,
      periods: augustPeriods('LOCKED'),
    })).toThrow(/LOCKED/);
    expect(() => generateSettlementAllocationJournals({
      allocations: [allocation],
      accounts,
      periods: augustPeriods('CLOSED'),
    })).toThrow(/CLOSED/);
  });
});
