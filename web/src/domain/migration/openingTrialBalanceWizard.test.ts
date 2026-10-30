import { describe, it, expect } from 'vitest';
import { buildOpeningBalanceJournal, generateOpeningBalanceTemplateCsv } from './openingTrialBalanceWizard';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../../data/defaultChartOfAccounts';
import { AccountingPeriod } from '../periods';

describe('SERP-306: Opening trial balance & financial balances onboarding wizard', () => {
  const accounts = DEFAULT_CHART_OF_ACCOUNTS;

  const openPeriods: AccountingPeriod[] = [
    {
      id: 'period-2026-01',
      periodName: 'January 2026',
      fiscalYear: 2026,
      month: 1,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      status: 'OPEN',
    },
  ];

  it('builds a balanced opening balance journal entry from valid lines', () => {
    const result = buildOpeningBalanceJournal({
      lines: [
        { accountCode: '1111', debit: 500000, credit: 0 },
        { accountCode: '1210', debit: 120000, credit: 0 },
        { accountCode: '2110', debit: 0, credit: 45000 },
        { accountCode: '3100', debit: 0, credit: 575000 },
      ],
      accounts,
      asOfDate: '2026-01-01',
      tenantId: 'tenant-01',
    });

    expect(result.isValid).toBe(true);
    expect(result.totalDebit).toBe(620000);
    expect(result.totalCredit).toBe(620000);
    expect(result.journalEntry?.source).toBe('OPENING_BALANCE');
    expect(result.journalEntry?.isBalanced).toBe(true);
    expect(result.journalEntry?.lines).toHaveLength(4);
  });

  it('fails closed when debits and credits do not balance', () => {
    const result = buildOpeningBalanceJournal({
      lines: [
        { accountCode: '1111', debit: 500000, credit: 0 },
        { accountCode: '3100', debit: 0, credit: 400000 },
      ],
      accounts,
      asOfDate: '2026-01-01',
      tenantId: 'tenant-01',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/unbalanced/);
  });

  it('rejects a line with both a debit and a credit', () => {
    const result = buildOpeningBalanceJournal({
      lines: [
        { accountCode: '1111', debit: 100, credit: 100 },
      ],
      accounts,
      asOfDate: '2026-01-01',
      tenantId: 'tenant-01',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/cannot have both/);
  });

  it('rejects a line with neither a debit nor a credit', () => {
    const result = buildOpeningBalanceJournal({
      lines: [
        { accountCode: '1111', debit: 0, credit: 0 },
        { accountCode: '3100', debit: 0, credit: 1 },
      ],
      accounts,
      asOfDate: '2026-01-01',
      tenantId: 'tenant-01',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('non-zero'))).toBe(true);
  });

  it('rejects a negative amount', () => {
    const result = buildOpeningBalanceJournal({
      lines: [{ accountCode: '1111', debit: -5, credit: 0 }],
      accounts,
      asOfDate: '2026-01-01',
      tenantId: 'tenant-01',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/negative/);
  });

  it('rejects an account code that does not exist in the chart of accounts', () => {
    const result = buildOpeningBalanceJournal({
      lines: [
        { accountCode: '9999', debit: 100, credit: 0 },
        { accountCode: '3100', debit: 0, credit: 100 },
      ],
      accounts,
      asOfDate: '2026-01-01',
      tenantId: 'tenant-01',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/does not exist/);
  });

  it('rejects a duplicate account code across lines', () => {
    const result = buildOpeningBalanceJournal({
      lines: [
        { accountCode: '1111', debit: 100, credit: 0 },
        { accountCode: '1111', debit: 50, credit: 0 },
        { accountCode: '3100', debit: 0, credit: 150 },
      ],
      accounts,
      asOfDate: '2026-01-01',
      tenantId: 'tenant-01',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('more than once'))).toBe(true);
  });

  it('rejects at least one line being required', () => {
    const result = buildOpeningBalanceJournal({
      lines: [],
      accounts,
      asOfDate: '2026-01-01',
      tenantId: 'tenant-01',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/At least one/);
  });

  it('still posts when an open period is supplied', () => {
    const result = buildOpeningBalanceJournal({
      lines: [
        { accountCode: '1111', debit: 100, credit: 0 },
        { accountCode: '3100', debit: 0, credit: 100 },
      ],
      accounts,
      asOfDate: '2026-01-15',
      tenantId: 'tenant-01',
      periods: openPeriods,
    });

    expect(result.isValid).toBe(true);
    expect(result.journalEntry).toBeDefined();
  });

  it('refuses to post into a LOCKED or CLOSED period when periods are supplied', () => {
    const closedPeriods: AccountingPeriod[] = [{ ...openPeriods[0], status: 'CLOSED' }];

    expect(() =>
      buildOpeningBalanceJournal({
        lines: [
          { accountCode: '1111', debit: 100, credit: 0 },
          { accountCode: '3100', debit: 0, credit: 100 },
        ],
        accounts,
        asOfDate: '2026-01-15',
        tenantId: 'tenant-01',
        periods: closedPeriods,
      })
    ).toThrow(/CLOSED/);
  });

  it('generates a usable CSV template with a header row', () => {
    const csv = generateOpeningBalanceTemplateCsv();
    expect(csv.split('\n')[0]).toBe('account_code,debit,credit');
    expect(csv).toContain('1111');
  });
});
