/**
 * STARQ ERP — Opening Trial Balance & Financial Balances Onboarding Wizard (SERP-306)
 *
 * Captures opening balances per chart-of-accounts account (bank/cash, AR, AP,
 * fixed assets, equity, etc.) as of a Go-Live date and builds one balanced,
 * immutable Opening Balance journal entry. Does not derive balances from
 * transactions (that is computeTrialBalance in lib/bookkeeping.ts) — this is
 * a one-time data-entry migration step, same family as SERP-303/304/305.
 */

import { AccountRecord } from '../accounts';
import { JournalEntry, JournalLine } from '../journals';
import { assertJournalPostable } from '../postingControl';
import { AccountingPeriod } from '../periods';

export interface OpeningBalanceLineInput {
  accountCode: string;
  debit: number;
  credit: number;
}

export interface OpeningBalanceValidationResult {
  isValid: boolean;
  errors: string[];
  journalEntry?: JournalEntry;
  totalDebit: number;
  totalCredit: number;
}

/**
 * Validates and, if valid, builds the Opening Balance journal entry.
 * When periods are supplied, the entry also passes through
 * assertJournalPostable() as actor 'system' — an opening balance is a
 * one-time migration posting, not an ad hoc user journal entry, so it may
 * target AR/AP/bank control accounts the way other engine-posted journals
 * in this codebase do (warehouse transfers, FX realization, job costing).
 */
export function buildOpeningBalanceJournal(params: {
  lines: OpeningBalanceLineInput[];
  accounts: AccountRecord[];
  asOfDate: string;
  tenantId: string;
  periods?: AccountingPeriod[];
}): OpeningBalanceValidationResult {
  const { lines: inputLines, accounts, asOfDate, tenantId, periods } = params;
  const errors: string[] = [];

  if (!inputLines || inputLines.length === 0) {
    errors.push('At least one opening balance line is required.');
  }

  const seenCodes = new Set<string>();
  const journalLines: JournalLine[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  (inputLines || []).forEach((input, idx) => {
    const lineNo = idx + 1;

    if (input.debit < 0 || input.credit < 0) {
      errors.push(`Line ${lineNo} (${input.accountCode}): amounts cannot be negative.`);
      return;
    }
    if (input.debit > 0 && input.credit > 0) {
      errors.push(`Line ${lineNo} (${input.accountCode}): cannot have both a debit and a credit.`);
      return;
    }
    if (input.debit === 0 && input.credit === 0) {
      errors.push(`Line ${lineNo} (${input.accountCode}): must have a non-zero debit or credit.`);
      return;
    }

    if (seenCodes.has(input.accountCode)) {
      errors.push(`Account ${input.accountCode} appears more than once — combine into a single line.`);
      return;
    }
    seenCodes.add(input.accountCode);

    const account = accounts.find((a) => a.code === input.accountCode);
    if (!account) {
      errors.push(`Account ${input.accountCode} does not exist in the chart of accounts.`);
      return;
    }

    journalLines.push({
      id: `ob-${input.accountCode}`,
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      accountClass: account.accountClass,
      narration: `Opening balance as of ${asOfDate}`,
      debit: input.debit,
      credit: input.credit,
    });

    totalDebit += input.debit;
    totalCredit += input.credit;
  });

  const variance = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
  if (variance !== 0) {
    errors.push(
      `Opening balances are unbalanced: Debit=${totalDebit.toFixed(2)}, Credit=${totalCredit.toFixed(2)}, Variance=${variance.toFixed(2)}.`
    );
  }

  if (errors.length > 0) {
    return { isValid: false, errors, totalDebit, totalCredit };
  }

  const journalEntry: JournalEntry = {
    id: `je-opening-balance-${asOfDate}`,
    entryNumber: `JE-OB-${asOfDate.replace(/-/g, '')}`,
    date: asOfDate,
    source: 'OPENING_BALANCE',
    reference: `OPENING-BALANCE-${asOfDate}`,
    narration: `Opening Trial Balance as of ${asOfDate}`,
    lines: journalLines,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    isBalanced: true,
    postedBy: 'System / Opening Balance Wizard',
    postedAt: new Date().toISOString(),
    tenantId,
    status: 'POSTED',
  };

  if (periods) {
    assertJournalPostable({ entry: journalEntry, periods, accounts, actor: 'system' });
  }

  return { isValid: true, errors: [], journalEntry, totalDebit, totalCredit };
}

/**
 * Standard CSV template for bulk opening-balance entry, matching the
 * generateXTemplateCsv() convention used by the other migration wizards.
 */
export function generateOpeningBalanceTemplateCsv(): string {
  const header = 'account_code,debit,credit\n';
  const sample = '1111,500000,0\n1210,120000,0\n2110,0,45000\n3100,0,575000\n';
  return header + sample;
}
