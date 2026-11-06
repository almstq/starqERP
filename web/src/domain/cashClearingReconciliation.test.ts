import { describe, it, expect } from 'vitest';
import {
  reconcileCashClearingToGL,
  VERIFIED_BANK_ACCOUNT_CODE,
} from './cashClearingReconciliation';
import { BankStatement, BankStatementLine } from './bankReconciliation';
import type { JournalEntry } from './journals';

describe('SERP-461: Cash & Bank Clearing Subledger to GL Reconciliation Invariant', () => {
  const tenantId = 'tenant-test-001';

  const createMockStatementLine = (overrides: Partial<BankStatementLine> = {}): BankStatementLine => ({
    id: 'line-001',
    statementId: 'stmt-2026-08',
    date: '2026-08-10',
    description: 'Payment receipt',
    reference: 'REF-BML-001',
    debit: 0,
    credit: 5000.00,
    balance: 15000.00,
    status: 'unreconciled',
    ...overrides,
  });

  const createMockStatement = (overrides: Partial<BankStatement> = {}): BankStatement => ({
    id: 'stmt-2026-08',
    bankAccountId: 'bank-acc-001',
    bankName: 'BML',
    accountNumber: '7701123456001',
    currency: 'MVR',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    openingBalance: 10000.00,
    closingBalance: 15000.00,
    uploadedAt: '2026-09-01T10:00:00Z',
    uploadedBy: 'staff-001',
    lines: [createMockStatementLine()],
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
    entryNumber: `JE-${date}-001`,
    date,
    reference: 'JNL-REF',
    narration: 'Bank payment movement',
    source: 'PAYMENT',
    status: 'POSTED',
    lines: [
      {
        id: `line-${Math.random().toString(36).substring(2, 9)}`,
        accountId: `acc-${accountCode}`,
        accountCode,
        accountName: 'Bank Account',
        accountClass: 'ASSET',
        debit,
        credit,
        narration: 'Bank movement line',
      },
    ],
    totalDebit: debit,
    totalCredit: credit,
    isBalanced: debit === credit,
    postedBy: 'system',
    postedAt: `${date}T10:00:00Z`,
    ...overrides,
  });

  it('reconciles cleanly on Account 1111 when opening balance and closing balance asOf date both match (happy path)', () => {
    // Ledger setup:
    // 1. Prior to startDate (e.g. 2026-07-15): 10,000.00 DR to 1111 (opening balance)
    // 2. During statement period (e.g. 2026-08-10): 5,000.00 DR to 1111 (closing = 15,000.00)
    const journals: JournalEntry[] = [
      createMockJournal('2026-07-15', VERIFIED_BANK_ACCOUNT_CODE, 10000.00, 0),
      createMockJournal('2026-08-10', VERIFIED_BANK_ACCOUNT_CODE, 5000.00, 0),
    ];

    const statement = createMockStatement({
      openingBalance: 10000.00,
      closingBalance: 15000.00,
    });

    const result = reconcileCashClearingToGL({
      statement,
      journals,
      tenantId,
      accountCode: VERIFIED_BANK_ACCOUNT_CODE,
    });

    expect(result.isAccountVerified).toBe(true);
    expect(result.accountCode).toBe('1111');
    expect(result.asOf).toBe('2026-08-31');
    expect(result.isReconciled).toBe(true);
    expect(result.variance).toBe(0);
    expect(result.statementClosingBalance).toBe(15000.00);
    expect(result.ledgerClosingBalance).toBe(15000.00);
    expect(result.error).toBeNull();

    // Opening balance independent verification
    expect(result.openingBalanceCheck.isReconciled).toBe(true);
    expect(result.openingBalanceCheck.statementOpeningBalance).toBe(10000.00);
    expect(result.openingBalanceCheck.ledgerOpeningBalance).toBe(10000.00);
    expect(result.openingBalanceCheck.variance).toBe(0);
    expect(result.openingBalanceCheck.error).toBeNull();
  });

  it('correctly FAILS with non-zero variance when statement closing balance does not match GL ledger balance (deliberate closing-balance breakage)', () => {
    const journals: JournalEntry[] = [
      createMockJournal('2026-07-15', VERIFIED_BANK_ACCOUNT_CODE, 10000.00, 0),
      createMockJournal('2026-08-10', VERIFIED_BANK_ACCOUNT_CODE, 4000.00, 0), // Ledger reaches 14,000, statement is 15,000
    ];

    const statement = createMockStatement({
      openingBalance: 10000.00,
      closingBalance: 15000.00,
    });

    const result = reconcileCashClearingToGL({
      statement,
      journals,
      tenantId,
      accountCode: VERIFIED_BANK_ACCOUNT_CODE,
    });

    expect(result.isReconciled).toBe(false);
    expect(result.variance).toBe(1000.00);
    expect(result.statementClosingBalance).toBe(15000.00);
    expect(result.ledgerClosingBalance).toBe(14000.00);
    expect(result.openingBalanceCheck.isReconciled).toBe(true);
    expect(result.error).toContain('Cash Clearing Closing Balance Discrepancy [Account 1111]');
    expect(result.error).toContain('Raw statement balance as of 2026-08-31 (MVR 15000.00) does not match GL balance (MVR 14000.00)');
    expect(result.error).toContain('Variance: MVR 1000.00');
    expect(result.error).toContain('raw-balance comparator; timing differences/in-transit items unadjusted');
    expect(result.unmatchedStatementLines).toHaveLength(1);
    expect(result.unmatchedStatementLines[0].reference).toBe('REF-BML-001');
  });

  it('correctly FAILS and reports independent error when statement opening balance does not match prior GL balance (deliberate opening-balance breakage)', () => {
    const journals: JournalEntry[] = [
      createMockJournal('2026-07-15', VERIFIED_BANK_ACCOUNT_CODE, 9500.00, 0), // Ledger opening is 9,500, statement opening is 10,000
      createMockJournal('2026-08-10', VERIFIED_BANK_ACCOUNT_CODE, 5000.00, 0),
    ];

    const statement = createMockStatement({
      openingBalance: 10000.00,
      closingBalance: 14500.00, // Ledger total = 14,500, so closing matches, but opening is broken
    });

    const result = reconcileCashClearingToGL({
      statement,
      journals,
      tenantId,
      accountCode: VERIFIED_BANK_ACCOUNT_CODE,
    });

    expect(result.isReconciled).toBe(false);
    expect(result.variance).toBe(0); // Closing variance is 0
    expect(result.openingBalanceCheck.isReconciled).toBe(false); // Independent check fails
    expect(result.openingBalanceCheck.variance).toBe(500.00);
    expect(result.openingBalanceCheck.statementOpeningBalance).toBe(10000.00);
    expect(result.openingBalanceCheck.ledgerOpeningBalance).toBe(9500.00);
    expect(result.openingBalanceCheck.error).toContain('Cash Clearing Opening Balance Discrepancy [Account 1111]');
    expect(result.openingBalanceCheck.error).toContain('Variance: MVR 500.00');
    expect(result.error).toContain('Cash Clearing Opening Balance Discrepancy');
  });

  it('proves journals dated strictly after asOf date are excluded from the closing balance calculation', () => {
    const journals: JournalEntry[] = [
      createMockJournal('2026-07-20', VERIFIED_BANK_ACCOUNT_CODE, 10000.00, 0),
      createMockJournal('2026-08-15', VERIFIED_BANK_ACCOUNT_CODE, 5000.00, 0),
      // Future journal dated in September (after statement.endDate 2026-08-31)
      createMockJournal('2026-09-05', VERIFIED_BANK_ACCOUNT_CODE, 20000.00, 0),
    ];

    const statement = createMockStatement({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      openingBalance: 10000.00,
      closingBalance: 15000.00,
    });

    // Without date cutoff, ledger would be 35,000. With cutoff at 2026-08-31, ledger is 15,000.
    const result = reconcileCashClearingToGL({
      statement,
      journals,
      tenantId,
      accountCode: VERIFIED_BANK_ACCOUNT_CODE,
      asOf: '2026-08-31',
    });

    expect(result.isReconciled).toBe(true);
    expect(result.ledgerClosingBalance).toBe(15000.00);
    expect(result.variance).toBe(0);
  });

  it('flags zero-producer invalidity when queried on an account without payment-posting producers (e.g. Account 1113 MIB)', () => {
    const journals: JournalEntry[] = [
      createMockJournal('2026-08-10', '1113', 5000.00, 0),
    ];

    const statement = createMockStatement({
      bankName: 'MIB',
      openingBalance: 10000.00,
      closingBalance: 15000.00,
    });

    const result = reconcileCashClearingToGL({
      statement,
      journals,
      tenantId,
      accountCode: '1113',
    });

    expect(result.isAccountVerified).toBe(false);
    expect(result.isReconciled).toBe(false);
    expect(result.error).toContain("Account '1113' has no verified live payment-posting producers in current engine");
    expect(result.error).toContain('Verification is valid for Account 1111 (BML MVR Main) only');
    expect(result.openingBalanceCheck.isReconciled).toBe(false);
  });

  it('enforces strict zero tolerance for minor rounding discrepancies (0.01 MVR mismatch)', () => {
    const journals: JournalEntry[] = [
      createMockJournal('2026-07-15', VERIFIED_BANK_ACCOUNT_CODE, 10000.00, 0),
      createMockJournal('2026-08-10', VERIFIED_BANK_ACCOUNT_CODE, 4999.99, 0),
    ];

    const statement = createMockStatement({
      openingBalance: 10000.00,
      closingBalance: 15000.00,
    });

    const result = reconcileCashClearingToGL({
      statement,
      journals,
      tenantId,
      accountCode: VERIFIED_BANK_ACCOUNT_CODE,
    });

    expect(result.isReconciled).toBe(false);
    expect(result.variance).toBe(0.01);
    expect(result.error).toContain('Variance: MVR 0.01');
  });

  it('surfaces unmatched statement lines without making false causal claims', () => {
    const lines: BankStatementLine[] = [
      createMockLine('L1', 'REF-MATCHED', 'matched', 1000.00),
      createMockLine('L2', 'REF-UNMATCHED-1', 'unreconciled', 2500.00),
      createMockLine('L3', 'REF-UNMATCHED-2', 'unreconciled', 1500.00),
    ];

    const statement = createMockStatement({
      lines,
      openingBalance: 10000.00,
      closingBalance: 15000.00,
    });

    const journals: JournalEntry[] = [
      createMockJournal('2026-07-15', VERIFIED_BANK_ACCOUNT_CODE, 10000.00, 0),
      createMockJournal('2026-08-10', VERIFIED_BANK_ACCOUNT_CODE, 1000.00, 0), // variance = 4,000
    ];

    const result = reconcileCashClearingToGL({
      statement,
      journals,
      tenantId,
      accountCode: VERIFIED_BANK_ACCOUNT_CODE,
    });

    expect(result.isReconciled).toBe(false);
    expect(result.unmatchedStatementLines).toHaveLength(2);
    expect(result.unmatchedStatementLines.map((l) => l.reference)).toEqual(['REF-UNMATCHED-1', 'REF-UNMATCHED-2']);
    expect(result.error).toContain('Unmatched lines in statement state: [REF-UNMATCHED-1, REF-UNMATCHED-2]');
    expect(result.error).toContain('raw-balance comparator; timing differences/in-transit items unadjusted');
  });

  function createMockLine(
    id: string,
    reference: string,
    status: BankStatementLine['status'],
    credit: number
  ): BankStatementLine {
    return {
      id,
      statementId: 'stmt-001',
      date: '2026-08-15',
      description: 'Transfer',
      reference,
      debit: 0,
      credit,
      balance: 10000.00 + credit,
      status,
    };
  }
});
