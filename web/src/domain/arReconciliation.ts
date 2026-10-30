/**
 * STARQ ERP — Accounts Receivable (1210) Reconciliation Invariant (SERP-461)
 *
 * Implements the core subledger-to-GL reconciliation invariant for Trade Receivables (Account 1210).
 *
 * Invariant Rule:
 * The sum of outstanding balances across all active customer invoices in the subledger
 * must exactly balance (zero tolerance) with the control account balance in the general ledger.
 *
 * Authority: docs/governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md §2 (G8 / SERP-461)
 */

import { Invoice } from '../types/erp';

export interface UnreconciledInvoiceSummary {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
}

export interface ARReconciliationResult {
  /** Sum of balanceDue across all unsettled invoices in subledger */
  subledgerTotal: number;
  /** Balance of AR Control Account (1210) in GL */
  controlAccountBalance: number;
  /** Difference: subledgerTotal - controlAccountBalance */
  variance: number;
  /** Exact match flag (zero tolerance: variance === 0 on cents-rounded values) */
  isReconciled: boolean;
  /** Active invoices contributing to the subledger total */
  activeInvoices: UnreconciledInvoiceSummary[];
  /** On mismatch, the active subledger invoices contributing to the discrepancy; empty array when reconciled */
  unreconciledInvoices: UnreconciledInvoiceSummary[];
  /** Detailed error message if unreconciled, otherwise null */
  error: string | null;
}

/**
 * Reconciles the Accounts Receivable subledger (invoices) against the Trade Receivables (1210) control account.
 *
 * Invoices excluded from AR subledger balance:
 * - Cancelled invoices (have no enforceable receivable claim).
 * - Invoices where balanceDue <= 0: fully settled invoices or credit/overpayment balances.
 *   Note: Credit balances / overpayment liabilities are out of scope for this asset invariant
 *   by design; a customer credit-liability reconciliation rule is a separate policy question.
 *
 * Tolerance: Strict zero tolerance (variance === 0 on cents-rounded amounts).
 */
export function reconcileAccountsReceivable(
  invoices: Invoice[],
  controlAccountBalance: number
): ARReconciliationResult {
  const activeInvoices: UnreconciledInvoiceSummary[] = [];
  let subledgerTotal = 0;

  for (const inv of invoices) {
    // Exclude cancelled invoices from enforceable receivable balance
    if (inv.status === 'Cancelled') {
      continue;
    }

    // Only invoices with positive balance due represent outstanding receivables.
    // balanceDue <= 0 represents fully settled invoices (or credit/overpayment balances
    // handled under liability accounts, outside this 1210 asset invariant).
    if (inv.balanceDue > 0) {
      subledgerTotal += inv.balanceDue;
      activeInvoices.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName: inv.customerName,
        totalAmount: inv.totalAmount,
        amountPaid: inv.amountPaid,
        balanceDue: inv.balanceDue,
        status: inv.status,
      });
    }
  }

  // Round totals to standard 2-decimal cents
  const roundedSubledger = Math.round(subledgerTotal * 100) / 100;
  const roundedControl = Math.round(controlAccountBalance * 100) / 100;
  const variance = Math.round((roundedSubledger - roundedControl) * 100) / 100;
  const isReconciled = variance === 0;

  const unreconciledInvoices = isReconciled ? [] : [...activeInvoices];

  let error: string | null = null;
  if (!isReconciled) {
    const invoiceList = activeInvoices.map((inv) => inv.invoiceNumber).join(', ');
    error = `AR Reconciliation Invariant Violated: Subledger total (MVR ${roundedSubledger.toFixed(2)}) does not match Account 1210 control balance (MVR ${roundedControl.toFixed(2)}). Variance: MVR ${variance.toFixed(2)}. Contributing subledger invoices: [${invoiceList || 'none'}].`;
  }

  return {
    subledgerTotal: roundedSubledger,
    controlAccountBalance: roundedControl,
    variance,
    isReconciled,
    activeInvoices,
    unreconciledInvoices,
    error,
  };
}
