/**
 * STARQ ERP — Accounts Payable (2110) Subledger to GL Reconciliation Invariant (SERP-461)
 *
 * Implements the subledger-to-GL reconciliation invariant for Accounts Payable (Account 2110):
 * Reconciles open procurement purchase orders (the AP subledger gross total) against the general ledger
 * liability control balance for Account 2110.
 *
 * Subledger Rules & Live Producer Logic (journals.ts:364-407):
 * - Live generator derives operational journals from purchase orders:
 *   For every PurchaseOrder where status is NOT in ('Draft', 'Cancelled'):
 *     - If paymentStatus === 'Paid': credits Account 1111 (Bank), excluded from AP 2110.
 *     - If paymentStatus !== 'Paid' ('Unpaid' or 'Partially Paid'): credits Account 2110 for the FULL po.totalAmount.
 * - Subledger Balance = PO Gross Total: sum of po.totalAmount across qualifying POs.
 *   Note on Partially Paid POs: In the current engine, Partially Paid POs are NOT netted for amounts
 *   already paid; journals.ts has no producer reducing 2110 for partial payments, so the gross total is
 *   the exact value posted to GL.
 * - GL balance = -1 * calculateTenantLedgerBalance(journals, tenantId, '2110')
 *   (Note: calculateTenantLedgerBalance computes Debit - Credit; as Account 2110 is a liability normally holding
 *   credit balances, the credit balance is -1 * (Debit - Credit) = Credit - Debit).
 *
 * Tolerance & Attribution Rules:
 * - Strict zero tolerance: variance === 0 on cents-rounded amounts.
 * - Honest Attribution & Full Active Composition:
 *   unreconciledPurchaseOrders contains the full active PO set at the time of mismatch for manual investigation.
 *   Per-item GL postings do not exist in the GL schema, so specific contributing culprit POs cannot be isolated
 *   from aggregate GL balance data alone.
 * - Manual Disbursement / Multi-Currency Settlement Disclosure:
 *   multiCurrency.ts:137-153 (calculateRealizedFxGainLoss for AP_DISBURSEMENT) generates payment journals that debit
 *   Account 2110 for the full originalMvr amount. However, in the current engine, manual disbursement journals do not
 *   automatically mutate or sync po.paymentStatus to 'Paid'. Whenever a disbursement is posted to 2110 without updating
 *   the corresponding PO, the subledger will overstate AP by the paid amount. The error text explicitly documents this
 *   data-consistency gap.
 *
 * Authority: docs/governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md §2 (G8 / SERP-461)
 */

import { PurchaseOrder } from '../types/erp';
import { calculateTenantLedgerBalance } from './bankReconciliation';
import type { JournalEntry } from './journals';

export const AP_CONTROL_ACCOUNT_CODE = '2110';

export interface UnreconciledPurchaseOrderSummary {
  id: string;
  poNumber: string;
  supplierName: string;
  orderDate: string;
  totalAmount: number;
  status: PurchaseOrder['status'];
  paymentStatus: PurchaseOrder['paymentStatus'];
}

export interface ApReconciliationResult {
  /** Account code checked (2110) */
  accountCode: string;
  /** Subledger gross total: sum of full totalAmount across qualifying open purchase orders (Partially Paid POs are not netted) */
  subledgerTotal: number;
  /** GL Credit balance of Account 2110 (cents rounded) */
  glControlBalance: number;
  /** Difference: subledgerTotal - glControlBalance */
  variance: number;
  /** Strict zero-tolerance match flag (variance === 0 on cents-rounded values) */
  isReconciled: boolean;
  /** Qualifying active purchase orders contributing to the subledger gross valuation */
  activePurchaseOrders: UnreconciledPurchaseOrderSummary[];
  /**
   * On mismatch, the full active purchase orders set at time of mismatch for manual investigation.
   * Note: Aggregate-only comparison; per-PO GL postings do not exist, so specific contributing PO(s)
   * cannot be isolated from aggregate data alone. Empty array when reconciled.
   */
  unreconciledPurchaseOrders: UnreconciledPurchaseOrderSummary[];
  /** Excluded POs (Draft, Cancelled, or Paid) surfaced for operational audit */
  excludedPurchaseOrders: UnreconciledPurchaseOrderSummary[];
  /** Detailed error message if unreconciled, otherwise null */
  error: string | null;
}

function roundToCents(amount: number): number {
  const rounded = Math.round(amount * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export interface ReconcileApParams {
  purchaseOrders: PurchaseOrder[];
  journals: JournalEntry[];
  tenantId: string;
}

/**
 * Reconciles the Accounts Payable subledger (PurchaseOrder[]) against Account 2110 general ledger transactions.
 */
export function reconcileApToGL({
  purchaseOrders,
  journals,
  tenantId,
}: ReconcileApParams): ApReconciliationResult {
  const activePurchaseOrders: UnreconciledPurchaseOrderSummary[] = [];
  const excludedPurchaseOrders: UnreconciledPurchaseOrderSummary[] = [];
  let rawSubledgerTotal = 0;

  for (const po of purchaseOrders) {
    // Exclude Draft and Cancelled POs per journals.ts:364
    if (po.status === 'Draft' || po.status === 'Cancelled') {
      excludedPurchaseOrders.push({
        id: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        orderDate: po.orderDate,
        totalAmount: po.totalAmount,
        status: po.status,
        paymentStatus: po.paymentStatus,
      });
      continue;
    }

    // Per journals.ts:366, if paymentStatus === 'Paid', procurement posts to 1111 Bank, not 2110 AP.
    // Unpaid and Partially Paid both post the full po.totalAmount to Account 2110 (no partial netting in current engine).
    if (po.paymentStatus === 'Paid') {
      excludedPurchaseOrders.push({
        id: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        orderDate: po.orderDate,
        totalAmount: po.totalAmount,
        status: po.status,
        paymentStatus: po.paymentStatus,
      });
      continue;
    }

    // Qualifying open AP item (gross total)
    const poValuation = roundToCents(po.totalAmount);
    rawSubledgerTotal += poValuation;

    activePurchaseOrders.push({
      id: po.id,
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      orderDate: po.orderDate,
      totalAmount: poValuation,
      status: po.status,
      paymentStatus: po.paymentStatus,
    });
  }

  const subledgerTotal = roundToCents(rawSubledgerTotal);

  // calculateTenantLedgerBalance calculates Debit - Credit.
  // For a liability account (2110), the normal credit balance is Credit - Debit = -1 * (Debit - Credit).
  const netDebitMinusCredit = calculateTenantLedgerBalance(journals, tenantId, AP_CONTROL_ACCOUNT_CODE);
  const glControlBalance = roundToCents(-netDebitMinusCredit);

  const variance = roundToCents(subledgerTotal - glControlBalance);
  const isReconciled = variance === 0;

  const unreconciledPurchaseOrders = isReconciled ? [] : [...activePurchaseOrders];

  let error: string | null = null;
  if (!isReconciled) {
    const poList = activePurchaseOrders.map((po) => `${po.poNumber} (${po.supplierName}: MVR ${po.totalAmount.toFixed(2)})`).join(', ');
    error = `Accounts Payable Reconciliation Invariant Violated [Account ${AP_CONTROL_ACCOUNT_CODE}]: Subledger gross total (MVR ${subledgerTotal.toFixed(2)}) does not match Account 2110 GL credit balance (MVR ${glControlBalance.toFixed(2)}). Variance: MVR ${variance.toFixed(2)}. Active open POs on subledger at time of mismatch (aggregate-only comparison; per-PO GL postings do not exist, so specific contributing PO(s) cannot be isolated from aggregate data alone -- manual investigation required): [${poList || 'none'}]. Note on Disbursements & Data Consistency: Manual or multi-currency AP disbursements (e.g. multiCurrency.ts AP_DISBURSEMENT debiting 2110 at originalMvr) settle bills in the GL without automatically updating PO paymentStatus to 'Paid' in current engine; the subledger may overstate AP whenever a disbursement has been posted to 2110 without updating the corresponding PO record. Additionally, Partially Paid POs are tracked at gross total and not netted for partial payments in current subledger derivation.`;
  }

  return {
    accountCode: AP_CONTROL_ACCOUNT_CODE,
    subledgerTotal,
    glControlBalance,
    variance,
    isReconciled,
    activePurchaseOrders,
    unreconciledPurchaseOrders,
    excludedPurchaseOrders,
    error,
  };
}
