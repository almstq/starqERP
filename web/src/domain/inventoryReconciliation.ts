/**
 * STARQ ERP — Inventory Asset (1310) to GL Reconciliation Invariant (SERP-466)
 *
 * Implements the core subledger-to-GL reconciliation invariant for Merchandise & Operating Inventory (Account 1310).
 *
 * Invariant Rule:
 * The total valuation of physical stock across all items in the inventory subledger
 * (sum of quantityOnHand * unitCost, evaluated under the established weighted-average valuation convention)
 * must exactly balance (zero tolerance: variance === 0 on cents-rounded values)
 * with the control account balance in the general ledger (Account 1310).
 *
 * Authority: docs/governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md §2 (G8 / SERP-466)
 */

import { InventoryItem } from '../types/erp';

export interface UnreconciledInventoryItemSummary {
  itemId: string;
  sku: string;
  name: string;
  category: string;
  quantityOnHand: number;
  unitCost: number;
  totalValuation: number;
  locationInShop?: string;
}

export interface InventoryReconciliationResult {
  /** Sum of (quantityOnHand * unitCost) across positive-stock items in subledger */
  subledgerTotal: number;
  /** Balance of Inventory Asset Control Account (1310) in GL */
  controlAccountBalance: number;
  /** Difference: subledgerTotal - controlAccountBalance */
  variance: number;
  /** Exact match flag (zero tolerance: variance === 0 on cents-rounded values) */
  isReconciled: boolean;
  /** Active stock items contributing to the subledger valuation (quantityOnHand > 0) */
  activeItems: UnreconciledInventoryItemSummary[];
  /**
   * On mismatch, the full active subledger items set at time of mismatch for manual investigation.
   * Note: Because accounting_event_lines / journal_lines are account-level only and do not carry
   * item/SKU identifiers, a specific contributing culprit cannot be isolated from aggregate GL data alone.
   * Empty array when reconciled.
   */
  unreconciledItems: UnreconciledInventoryItemSummary[];
  /**
   * Items with non-positive on-hand quantity (quantityOnHand <= 0).
   * These are excluded from subledgerTotal valuation and surfaced here for visibility/reconciliation audit.
   * Always returned (empty array when none), regardless of isReconciled status.
   */
  excludedNonPositiveStockItems: UnreconciledInventoryItemSummary[];
  /** Detailed error message if unreconciled, otherwise null */
  error: string | null;
}

/**
 * Reconciles the inventory subledger (InventoryItem[]) against the Inventory Asset (1310) control account.
 *
 * Valuation Method:
 * Evaluates stock items with quantityOnHand > 0.
 * Item valuation is computed as quantityOnHand * unitCost (rounded to cents).
 * Non-positive stock items (<= 0) are excluded from subledger valuation and captured in excludedNonPositiveStockItems.
 *
 * Tolerance: Strict zero tolerance (variance === 0 on cents-rounded amounts).
 */
export function reconcileInventoryToGL(
  items: InventoryItem[],
  controlAccountBalance: number
): InventoryReconciliationResult {
  const activeItems: UnreconciledInventoryItemSummary[] = [];
  const excludedNonPositiveStockItems: UnreconciledInventoryItemSummary[] = [];
  let subledgerTotal = 0;

  for (const item of items) {
    if (item.quantityOnHand > 0) {
      const itemValuation = Math.round(item.quantityOnHand * item.unitCost * 100) / 100;
      subledgerTotal += itemValuation;

      activeItems.push({
        itemId: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        quantityOnHand: item.quantityOnHand,
        unitCost: item.unitCost,
        totalValuation: itemValuation,
        locationInShop: item.locationInShop,
      });
    } else {
      // quantityOnHand <= 0: excluded from asset valuation, surfaced for operational audit
      const nonPositiveValuation = Math.round(item.quantityOnHand * item.unitCost * 100) / 100;
      excludedNonPositiveStockItems.push({
        itemId: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        quantityOnHand: item.quantityOnHand,
        unitCost: item.unitCost,
        totalValuation: nonPositiveValuation,
        locationInShop: item.locationInShop,
      });
    }
  }

  // Round totals to standard 2-decimal cents
  const roundedSubledger = Math.round(subledgerTotal * 100) / 100;
  const roundedControl = Math.round(controlAccountBalance * 100) / 100;
  const variance = Math.round((roundedSubledger - roundedControl) * 100) / 100;
  const isReconciled = variance === 0;

  const unreconciledItems = isReconciled ? [] : [...activeItems];

  let error: string | null = null;
  if (!isReconciled) {
    const skuList = activeItems.map((item) => item.sku).join(', ');
    error = `Inventory Reconciliation Invariant Violated: Subledger total (MVR ${roundedSubledger.toFixed(2)}) does not match Account 1310 control balance (MVR ${roundedControl.toFixed(2)}). Variance: MVR ${variance.toFixed(2)}. Active subledger items at time of mismatch (aggregate-only comparison; per-item GL postings do not exist, so the specific contributing item(s) cannot be isolated from this data -- manual investigation required): [${skuList || 'none'}].`;
  }

  return {
    subledgerTotal: roundedSubledger,
    controlAccountBalance: roundedControl,
    variance,
    isReconciled,
    activeItems,
    unreconciledItems,
    excludedNonPositiveStockItems,
    error,
  };
}
