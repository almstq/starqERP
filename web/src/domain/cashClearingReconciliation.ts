/**
 * STARQ ERP — Cash & Bank Clearing Subledger to GL Reconciliation Invariant (SERP-461)
 *
 * Implements the cash/bank clearing to GL reconciliation invariant:
 * Compares an imported bank statement against the general ledger transactions
 * for bank accounts, enforcing strict zero tolerance on cents-rounded amounts.
 *
 * Invariant Rules & Structural Constraints (Room #16509):
 * 1. Account Validity:
 *    - This invariant is verified and valid for GL account '1111' (Bank of Maldives MVR Main) ONLY.
 *    - Account '1111' is configured with posting_control = 'postable' (supabase/migrations/202608300035_chart_of_accounts_as_data.sql:73).
 *    - Accounts '1112' (BML USD) and '1113' (MIB MVR) have NO live payment-posting journal lines in the current codebase
 *      (journals.ts:276-278 unconditionally posts every customer invoice payment to DR 1111 / CR 1210 regardless of payment method,
 *      currency, or bank account).
 *    - If an account other than '1111' is checked, it is flagged as unverified/zero-producer invalidity rather than reporting a silent false variance.
 * 2. Date Cutoff (asOf):
 *    - The closing ledger balance is evaluated as of statement.endDate (or explicit asOf cutoff).
 *    - Journals dated strictly after asOf are excluded from the closing balance calculation.
 * 3. Opening-Balance Verification:
 *    - Compares statement.openingBalance against the ledger balance strictly prior to statement.startDate.
 *    - Reported as an independent pass/fail check, separate from closing-balance variance.
 * 4. Cents Rounding:
 *    - The ledger balance sum from calculateTenantLedgerBalance is rounded to 2 decimal places (cents)
 *      before any comparison (accounting for floating-point accumulation).
 * 5. Honest Labeling:
 *    - This is a RAW-BALANCE COMPARATOR between the bank statement and the posted GL ledger.
 *    - It explicitly does NOT claim to be a full bank reconciliation with automated timing adjustments
 *      (e.g. unpresented cheques or uncredited deposits are unaddressed, matching the 0/0 stub in BankReconciliationView.tsx:135).
 * 6. Line-Level State:
 *    - Statement lines with status 'unreconciled' are surfaced as 'not marked matched in statement state'.
 *    - No causal attribution is claimed between the unreconciled lines and the closing variance.
 *    - 'matched' status in current architecture is set by manual UI actions (BankReconciliationView.tsx:193/214/244),
 *      not by autoMatchStatementLines (which assigns no status).
 *
 * Authority: docs/governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md §2 (G8 / SERP-461)
 */

import { BankStatement, BankStatementLine, calculateTenantLedgerBalance } from './bankReconciliation';
import type { JournalEntry } from './journals';

export const VERIFIED_BANK_ACCOUNT_CODE = '1111';

export interface CashClearingOpeningBalanceCheck {
  statementOpeningBalance: number;
  ledgerOpeningBalance: number;
  variance: number;
  isReconciled: boolean;
  error: string | null;
}

export interface CashClearingReconciliationResult {
  /** Account code checked */
  accountCode: string;
  /** Whether the account code has verified live posting producers */
  isAccountVerified: boolean;
  /** Cutoff date used for closing balance (statement.endDate or explicit asOf) */
  asOf: string;
  /** Statement closing balance */
  statementClosingBalance: number;
  /** Ledger balance as of asOf date (rounded to cents) */
  ledgerClosingBalance: number;
  /** Variance: statementClosingBalance - ledgerClosingBalance */
  variance: number;
  /** Independent opening balance reconciliation */
  openingBalanceCheck: CashClearingOpeningBalanceCheck;
  /** Strict zero-tolerance match flag (variance === 0 on cents-rounded values && openingBalanceCheck.isReconciled) */
  isReconciled: boolean;
  /** Statement lines not marked matched in statement state */
  unmatchedStatementLines: BankStatementLine[];
  /** Detailed error message if unreconciled or account unverified, otherwise null */
  error: string | null;
}

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export interface CashClearingReconciliationParams {
  statement: BankStatement;
  journals: JournalEntry[];
  tenantId: string;
  accountCode?: string;
  asOf?: string;
}

/**
 * Reconciles a BankStatement against posted general ledger journal entries.
 *
 * Raw-balance comparator enforcing strict zero tolerance on cents-rounded balances.
 */
export function reconcileCashClearingToGL({
  statement,
  journals,
  tenantId,
  accountCode = VERIFIED_BANK_ACCOUNT_CODE,
  asOf = statement.endDate,
}: CashClearingReconciliationParams): CashClearingReconciliationResult {
  const isAccountVerified = accountCode === VERIFIED_BANK_ACCOUNT_CODE;

  // Unmatched lines in current statement state
  const unmatchedStatementLines = (statement.lines || []).filter(
    (line) => line.status === 'unreconciled'
  );

  if (!isAccountVerified) {
    const errorMsg = `Cash Clearing Reconciliation Invalid Account: Account '${accountCode}' has no verified live payment-posting producers in current engine (journals.ts:276-278 posts all payments to Account 1111). Verification is valid for Account 1111 (BML MVR Main) only.`;
    return {
      accountCode,
      isAccountVerified: false,
      asOf,
      statementClosingBalance: roundToCents(statement.closingBalance),
      ledgerClosingBalance: 0,
      variance: roundToCents(statement.closingBalance),
      openingBalanceCheck: {
        statementOpeningBalance: roundToCents(statement.openingBalance),
        ledgerOpeningBalance: 0,
        variance: roundToCents(statement.openingBalance),
        isReconciled: false,
        error: errorMsg,
      },
      isReconciled: false,
      unmatchedStatementLines,
      error: errorMsg,
    };
  }

  // 1. Opening Balance Check (strictly before statement.startDate)
  // Filters journals dated < statement.startDate
  const openingJournals = journals.filter((j) => {
    return j.date < statement.startDate;
  });
  const rawLedgerOpening = calculateTenantLedgerBalance(openingJournals, tenantId, accountCode);
  const ledgerOpeningBalance = roundToCents(rawLedgerOpening);
  const statementOpeningBalance = roundToCents(statement.openingBalance);
  const openingVariance = roundToCents(statementOpeningBalance - ledgerOpeningBalance);
  const isOpeningReconciled = openingVariance === 0;

  const openingError = isOpeningReconciled
    ? null
    : `Cash Clearing Opening Balance Discrepancy [Account ${accountCode}]: Statement opening balance (MVR ${statementOpeningBalance.toFixed(2)}) does not match GL opening balance before ${statement.startDate} (MVR ${ledgerOpeningBalance.toFixed(2)}). Variance: MVR ${openingVariance.toFixed(2)}.`;

  const openingBalanceCheck: CashClearingOpeningBalanceCheck = {
    statementOpeningBalance,
    ledgerOpeningBalance,
    variance: openingVariance,
    isReconciled: isOpeningReconciled,
    error: openingError,
  };

  // 2. Closing Balance Check (dated on or before asOf)
  const closingJournals = journals.filter((j) => {
    return j.date <= asOf;
  });
  const rawLedgerClosing = calculateTenantLedgerBalance(closingJournals, tenantId, accountCode);
  const ledgerClosingBalance = roundToCents(rawLedgerClosing);
  const statementClosingBalance = roundToCents(statement.closingBalance);
  const variance = roundToCents(statementClosingBalance - ledgerClosingBalance);
  const isClosingReconciled = variance === 0;

  const isReconciled = isOpeningReconciled && isClosingReconciled;

  let error: string | null = null;
  if (!isReconciled) {
    const errorParts: string[] = [];
    if (openingError) {
      errorParts.push(openingError);
    }
    if (!isClosingReconciled) {
      const lineRefs = unmatchedStatementLines.map((l) => l.reference || l.id).join(', ');
      errorParts.push(
        `Cash Clearing Closing Balance Discrepancy [Account ${accountCode}]: Raw statement balance as of ${asOf} (MVR ${statementClosingBalance.toFixed(2)}) does not match GL balance (MVR ${ledgerClosingBalance.toFixed(2)}). Variance: MVR ${variance.toFixed(2)} (raw-balance comparator; timing differences/in-transit items unadjusted). Unmatched lines in statement state: [${lineRefs || 'none'}].`
      );
    }
    error = errorParts.join('\n');
  }

  return {
    accountCode,
    isAccountVerified: true,
    asOf,
    statementClosingBalance,
    ledgerClosingBalance,
    variance,
    openingBalanceCheck,
    isReconciled,
    unmatchedStatementLines,
    error,
  };
}
