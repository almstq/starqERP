import { describe, it, expect } from 'vitest';
import { reconcileInventoryToGL } from './inventoryReconciliation';
import { InventoryItem } from '../types/erp';

describe('SERP-466: Inventory Asset (1310) to GL Reconciliation Invariant', () => {
  const createMockItem = (overrides: Partial<InventoryItem>): InventoryItem => ({
    id: 'item-001',
    sku: 'PNT-CLR-2K',
    name: '2K Clear Coat 1L',
    category: 'Paints & Primers',
    quantityOnHand: 10,
    unit: 'Litre',
    reorderLevel: 5,
    unitCost: 150.00,
    sellingPrice: 220.00,
    supplierId: 'supp-001',
    supplierName: 'Color Chem Maldives',
    locationInShop: 'Shelf A-1',
    stockStatus: 'In Stock',
    lastRestockedDate: '2026-01-10',
    ...overrides,
  });

  it('reconciles cleanly when inventory subledger valuation matches Account 1310 balance (happy path)', () => {
    const items: InventoryItem[] = [
      createMockItem({ id: 'item-1', sku: 'PNT-CLR-2K', quantityOnHand: 10, unitCost: 150.00 }), // 1,500.00
      createMockItem({ id: 'item-2', sku: 'THN-STD-5L', name: 'Standard Thinner 5L', quantityOnHand: 4, unitCost: 200.00 }), // 800.00
    ];

    // Total subledger = 1500 + 800 = 2300.00
    const result = reconcileInventoryToGL(items, 2300.00);

    expect(result.isReconciled).toBe(true);
    expect(result.subledgerTotal).toBe(2300.00);
    expect(result.controlAccountBalance).toBe(2300.00);
    expect(result.variance).toBe(0);
    expect(result.error).toBeNull();
    expect(result.activeItems).toHaveLength(2);
    expect(result.unreconciledItems).toEqual([]);
    expect(result.excludedNonPositiveStockItems).toEqual([]);
  });

  it('ignores zero or negative on-hand items in inventory asset valuation calculation and surfaces them in excludedNonPositiveStockItems', () => {
    const items: InventoryItem[] = [
      createMockItem({ id: 'item-1', sku: 'SKU-IN-STOCK', quantityOnHand: 5, unitCost: 100.00 }), // 500.00
      createMockItem({ id: 'item-2', sku: 'SKU-OUT-OF-STOCK', quantityOnHand: 0, unitCost: 100.00, stockStatus: 'Out of Stock' }),
      createMockItem({ id: 'item-3', sku: 'SKU-DISCREPANCY', quantityOnHand: -2, unitCost: 100.00 }),
    ];

    const result = reconcileInventoryToGL(items, 500.00);

    expect(result.isReconciled).toBe(true);
    expect(result.subledgerTotal).toBe(500.00);
    expect(result.activeItems).toHaveLength(1);
    expect(result.activeItems[0].sku).toBe('SKU-IN-STOCK');
    expect(result.unreconciledItems).toEqual([]);
    expect(result.excludedNonPositiveStockItems).toHaveLength(2);
    expect(result.excludedNonPositiveStockItems.map((i) => i.sku)).toEqual(['SKU-OUT-OF-STOCK', 'SKU-DISCREPANCY']);
  });

  it('handles empty inventory set when GL balance is 0.00', () => {
    const result = reconcileInventoryToGL([], 0.00);
    expect(result.isReconciled).toBe(true);
    expect(result.subledgerTotal).toBe(0);
    expect(result.variance).toBe(0);
    expect(result.activeItems).toHaveLength(0);
    expect(result.unreconciledItems).toEqual([]);
    expect(result.excludedNonPositiveStockItems).toEqual([]);
  });

  // Acceptance Criterion: Automated test that deliberately breaks the invariant and proves failure
  describe('Deliberate Breakage & Invariant Violation Failure', () => {
    it('correctly FAILS with non-zero variance, carries honest aggregate limitation wording, and populates unreconciledItems with full active set (GL Control > Subledger)', () => {
      const items: InventoryItem[] = [
        createMockItem({ id: 'item-1', sku: 'SKU-BASE-01', quantityOnHand: 10, unitCost: 100.00 }), // 1,000.00
      ];

      // GL control has 1600.00 (e.g. manual stray journal into 1310 without stock receipt)
      const controlBalance = 1600.00;
      const result = reconcileInventoryToGL(items, controlBalance);

      expect(result.isReconciled).toBe(false);
      expect(result.subledgerTotal).toBe(1000.00);
      expect(result.controlAccountBalance).toBe(1600.00);
      expect(result.variance).toBe(-600.00);
      expect(result.error).toContain('Inventory Reconciliation Invariant Violated');
      expect(result.error).toContain('Subledger total (MVR 1000.00) does not match Account 1310 control balance (MVR 1600.00)');
      expect(result.error).toContain('Variance: MVR -600.00');
      // Assert honest aggregate limitation wording is present instead of causal/contributing claim
      expect(result.error).toContain('Active subledger items at time of mismatch (aggregate-only comparison; per-item GL postings do not exist, so the specific contributing item(s) cannot be isolated from this data -- manual investigation required)');
      expect(result.error).toContain('[SKU-BASE-01]');
      // Assert unreconciledItems equals the full activeItems set on mismatch
      expect(result.unreconciledItems).toEqual(result.activeItems);
      expect(result.unreconciledItems).toHaveLength(1);
      expect(result.unreconciledItems[0].sku).toBe('SKU-BASE-01');
    });

    it('correctly FAILS on mismatch, populates unreconciledItems with all active items, and states aggregate limitation rather than isolated culprits (Subledger > Control)', () => {
      const items: InventoryItem[] = [
        createMockItem({ id: 'item-101', sku: 'OIL-FILTER-HD', quantityOnHand: 20, unitCost: 50.00 }), // 1,000.00
        createMockItem({ id: 'item-102', sku: 'BRAKE-PAD-FRONT', quantityOnHand: 5, unitCost: 400.00 }), // 2,000.00
      ];

      // GL control balance is only 1000.00 (missing BRAKE-PAD-FRONT receipt posting)
      const controlBalance = 1000.00;
      const result = reconcileInventoryToGL(items, controlBalance);

      expect(result.isReconciled).toBe(false);
      expect(result.subledgerTotal).toBe(3000.00);
      expect(result.controlAccountBalance).toBe(1000.00);
      expect(result.variance).toBe(2000.00);
      expect(result.error).toContain('Variance: MVR 2000.00');
      // Assert error contains aggregate explanation without causal claim
      expect(result.error).toContain('Active subledger items at time of mismatch (aggregate-only comparison; per-item GL postings do not exist, so the specific contributing item(s) cannot be isolated from this data -- manual investigation required): [OIL-FILTER-HD, BRAKE-PAD-FRONT]');
      // Assert unreconciledItems matches the entire activeItems array
      expect(result.unreconciledItems).toEqual(result.activeItems);
      expect(result.unreconciledItems.map((i) => i.sku)).toEqual(['OIL-FILTER-HD', 'BRAKE-PAD-FRONT']);
    });

    it('enforces strict zero tolerance for minor rounding discrepancies (e.g. 0.01 MVR mismatch)', () => {
      const items: InventoryItem[] = [
        createMockItem({ id: 'item-1', sku: 'CENT-SKU', quantityOnHand: 1, unitCost: 99.99 }),
      ];

      // Discrepancy of 0.01 MVR
      const controlBalance = 100.00;
      const result = reconcileInventoryToGL(items, controlBalance);

      expect(result.isReconciled).toBe(false);
      expect(result.variance).toBe(-0.01);
      expect(result.error).toContain('Variance: MVR -0.01');
      expect(result.error).toContain('[CENT-SKU]');
      expect(result.unreconciledItems).toEqual(result.activeItems);
    });

    it('deliberately tests and surfaces non-positive stock items in excludedNonPositiveStockItems alongside positive stock items', () => {
      const items: InventoryItem[] = [
        createMockItem({ id: 'item-pos-1', sku: 'POS-STOCK-1', quantityOnHand: 10, unitCost: 50.00 }), // 500.00
        createMockItem({ id: 'item-zero-1', sku: 'ZERO-STOCK-1', quantityOnHand: 0, unitCost: 75.00 }),
        createMockItem({ id: 'item-neg-1', sku: 'NEG-STOCK-1', quantityOnHand: -3, unitCost: 120.00 }), // -360.00
      ];

      // Reconciled against positive stock total 500.00
      const reconciledResult = reconcileInventoryToGL(items, 500.00);
      expect(reconciledResult.isReconciled).toBe(true);
      expect(reconciledResult.subledgerTotal).toBe(500.00);
      expect(reconciledResult.activeItems).toHaveLength(1);
      expect(reconciledResult.unreconciledItems).toEqual([]);
      expect(reconciledResult.excludedNonPositiveStockItems).toHaveLength(2);
      expect(reconciledResult.excludedNonPositiveStockItems[0].sku).toBe('ZERO-STOCK-1');
      expect(reconciledResult.excludedNonPositiveStockItems[0].quantityOnHand).toBe(0);
      expect(reconciledResult.excludedNonPositiveStockItems[0].totalValuation).toBe(0);
      expect(reconciledResult.excludedNonPositiveStockItems[1].sku).toBe('NEG-STOCK-1');
      expect(reconciledResult.excludedNonPositiveStockItems[1].quantityOnHand).toBe(-3);
      expect(reconciledResult.excludedNonPositiveStockItems[1].totalValuation).toBe(-360.00);

      // Also verify on unreconciled case that excludedNonPositiveStockItems is preserved and returned
      const unreconciledResult = reconcileInventoryToGL(items, 400.00);
      expect(unreconciledResult.isReconciled).toBe(false);
      expect(unreconciledResult.excludedNonPositiveStockItems).toHaveLength(2);
      expect(unreconciledResult.excludedNonPositiveStockItems.map((i) => i.sku)).toEqual(['ZERO-STOCK-1', 'NEG-STOCK-1']);
    });
  });
});
