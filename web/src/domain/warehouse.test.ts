import { describe, it, expect } from 'vitest';
import {
  createStockTransferOrder,
  dispatchStockTransfer,
  receiveStockTransfer,
  evaluateWarehouseStockReorders,
  availableQuantity,
  reserveStock,
  releaseReservationOnIssue,
  cancelReservation,
  reverseReservation,
  StockReservationError,
  MALDIVES_DEFAULT_WAREHOUSES,
  WarehouseStockItem,
  StockReservation,
} from './warehouse';

describe('SERP-013: Multi-Warehouse & Inter-Island Stock Transfer Engine', () => {
  const sourceWh = MALDIVES_DEFAULT_WAREHOUSES[0]; // WH-MLE (Male)
  const destWh = MALDIVES_DEFAULT_WAREHOUSES[2]; // WH-THL (Thilafushi Yard)

  const sampleItems = [
    { itemId: 'item-01', itemCode: 'SEAL-01', itemName: 'Marine Hydraulic Seals', quantity: 20, unitCostMvr: 500, batchNumber: 'LOT-2026-08' },
    { itemId: 'item-02', itemCode: 'PUMP-88', itemName: 'High-Flow Bilge Pump', quantity: 5, unitCostMvr: 4000, batchNumber: 'LOT-2026-04' },
  ];

  it('creates an inter-island Stock Transfer Order with accurate valuation', () => {
    const order = createStockTransferOrder({
      id: 'sto-101',
      transferNumber: 'STO-2026-001',
      sourceWarehouse: sourceWh,
      destinationWarehouse: destWh,
      vesselNameOrSeaRoute: 'MV Albatross Express - Male to Thilafushi',
      items: sampleItems,
      tenantId: 'tenant-01',
    });

    expect(order.totalTransferValueMvr).toBe(30000); // (20*500) + (5*4000) = 10,000 + 20,000
    expect(order.sourceWarehouseCode).toBe('WH-MLE');
    expect(order.destinationWarehouseCode).toBe('WH-THL');
    expect(order.status).toBe('DRAFT');
  });

  it('generates a balanced In-Transit journal upon dispatch', () => {
    const order = createStockTransferOrder({
      id: 'sto-101',
      transferNumber: 'STO-2026-001',
      sourceWarehouse: sourceWh,
      destinationWarehouse: destWh,
      vesselNameOrSeaRoute: 'MV Albatross Express',
      items: sampleItems,
      tenantId: 'tenant-01',
    });

    const dispatched = dispatchStockTransfer(order, '2026-08-28', 'tenant-01');
    expect(dispatched.status).toBe('DISPATCHED');
    expect(dispatched.dispatchJournal).toBeDefined();
    expect(dispatched.dispatchJournal?.isBalanced).toBe(true);
    expect(dispatched.dispatchJournal?.lines.find((l) => l.accountCode === '1320')?.debit).toBe(30000);
    expect(dispatched.dispatchJournal?.lines.find((l) => l.accountCode === '1310')?.credit).toBe(30000);
  });

  it('generates a balanced Receipt journal clearing In-Transit upon destination delivery', () => {
    const order = createStockTransferOrder({
      id: 'sto-101',
      transferNumber: 'STO-2026-001',
      sourceWarehouse: sourceWh,
      destinationWarehouse: destWh,
      vesselNameOrSeaRoute: 'MV Albatross Express',
      items: sampleItems,
      tenantId: 'tenant-01',
    });

    const dispatched = dispatchStockTransfer(order, '2026-08-28', 'tenant-01');
    const received = receiveStockTransfer(dispatched, '2026-08-29', 'tenant-01');

    expect(received.status).toBe('RECEIVED');
    expect(received.receiptJournal).toBeDefined();
    expect(received.receiptJournal?.isBalanced).toBe(true);
    expect(received.receiptJournal?.lines.find((l) => l.accountCode === '1310')?.debit).toBe(30000);
    expect(received.receiptJournal?.lines.find((l) => l.accountCode === '1320')?.credit).toBe(30000);
  });

  it('detects low stock reorder alerts across warehouse locations', () => {
    const stockItems: WarehouseStockItem[] = [
      {
        id: 'stk-1',
        itemId: 'item-01',
        itemCode: 'SEAL-01',
        itemName: 'Marine Hydraulic Seals',
        warehouseId: 'wh-thilafushi',
        warehouseCode: 'WH-THL',
        quantityOnHand: 4, // Below reorder point of 10
        reorderPoint: 10,
        safetyStock: 5,
        unitCostMvr: 500,
      },
      {
        id: 'stk-2',
        itemId: 'item-02',
        itemCode: 'PUMP-88',
        itemName: 'High-Flow Bilge Pump',
        warehouseId: 'wh-thilafushi',
        warehouseCode: 'WH-THL',
        quantityOnHand: 15,
        reorderPoint: 5,
        safetyStock: 2,
        unitCostMvr: 4000,
      },
    ];

    const alerts = evaluateWarehouseStockReorders(stockItems);
    expect(alerts.length).toBe(1);
    expect(alerts[0].itemCode).toBe('SEAL-01');
    expect(alerts[0].deficitQuantity).toBe(11); // 10 + 5 - 4
  });
});

describe('SERP-466: stock reservation', () => {
  const scope = {
    tenantId: 'tenant-01',
    itemId: 'item-01',
    warehouseId: 'wh-01',
  };
  const onHand = 10;

  function hold(overrides: Partial<Parameters<typeof reserveStock>[0]> = {}): StockReservation {
    return reserveStock({
      id: 'res-1',
      quantity: 4,
      sourceType: 'ORDER',
      sourceId: 'order-1',
      quantityOnHand: onHand,
      reservations: [],
      reservedAt: '2026-10-29T08:00:00.000Z',
      ...scope,
      ...overrides,
    });
  }

  it('reduces available quantity and leaves on-hand unchanged', () => {
    const stock = { quantityOnHand: onHand };
    const reservation = hold();

    expect(reservation.status).toBe('ACTIVE');
    expect(stock.quantityOnHand).toBe(10);
    expect(availableQuantity({
      quantityOnHand: stock.quantityOnHand,
      reservations: [reservation],
      ...scope,
    })).toBe(6);
  });

  it('ignores released, cancelled, and out-of-scope holds', () => {
    const active = hold();
    const released = { ...hold({ id: 'res-2', sourceId: 'order-2', quantity: 1 }), status: 'RELEASED' as const };
    const cancelled = { ...hold({ id: 'res-3', sourceId: 'order-3', quantity: 2 }), status: 'CANCELLED' as const };
    const otherTenant = hold({ id: 'res-4', tenantId: 'tenant-02', sourceId: 'order-4', quantity: 9, quantityOnHand: 9 });
    const otherWarehouse = hold({ id: 'res-5', warehouseId: 'wh-02', sourceId: 'order-5', quantity: 3 });

    expect(availableQuantity({
      quantityOnHand: onHand,
      reservations: [active, released, cancelled, otherTenant, otherWarehouse],
      ...scope,
    })).toBe(6);
  });

  it('fails closed on a non-positive or over-available quantity', () => {
    expect(() => hold({ quantity: 0 })).toThrow(StockReservationError);
    expect(() => hold({ quantity: -2 })).toThrow(StockReservationError);
    expect(() => hold({ quantity: Number.NaN })).toThrow(StockReservationError);

    const existing = hold();
    expect(() => hold({
      id: 'res-2',
      sourceId: 'order-2',
      quantity: 7,
      reservations: [existing],
    })).toThrow(StockReservationError);

    const exact = hold({
      id: 'res-2',
      sourceId: 'order-2',
      quantity: 6,
      reservations: [existing],
    });
    expect(exact.quantity).toBe(6);
  });

  it('refuses a second active hold for the same order or pending sale', () => {
    const existing = hold({ sourceType: 'PENDING_SALE', sourceId: 'sale-9' });
    expect(() => hold({
      id: 'res-2',
      sourceType: 'PENDING_SALE',
      sourceId: 'sale-9',
      quantity: 1,
      reservations: [existing],
    })).toThrow(StockReservationError);
  });

  it('releases the hold on issue without changing on-hand', () => {
    const original = hold();
    const issued = releaseReservationOnIssue({
      reservation: original,
      tenantId: scope.tenantId,
      quantityOnHand: onHand,
      releasedAt: '2026-10-29T09:00:00.000Z',
    });

    expect(original.status).toBe('ACTIVE');
    expect(issued.reservation.status).toBe('RELEASED');
    expect(issued.quantityOnHand).toBe(onHand);
    expect(availableQuantity({
      quantityOnHand: issued.quantityOnHand,
      reservations: [issued.reservation],
      ...scope,
    })).toBe(onHand);
    expect(() => releaseReservationOnIssue({
      reservation: issued.reservation,
      tenantId: scope.tenantId,
      quantityOnHand: onHand,
      releasedAt: '2026-10-29T09:01:00.000Z',
    })).toThrow(StockReservationError);
  });

  it('cancels an active hold and frees available quantity', () => {
    const original = hold({ sourceType: 'PENDING_SALE', sourceId: 'sale-1' });
    const cancelled = cancelReservation({
      reservation: original,
      tenantId: scope.tenantId,
      quantityOnHand: onHand,
      cancelledAt: '2026-10-29T09:05:00.000Z',
    });

    expect(original.status).toBe('ACTIVE');
    expect(cancelled.reservation.status).toBe('CANCELLED');
    expect(cancelled.quantityOnHand).toBe(onHand);
    expect(availableQuantity({
      quantityOnHand: onHand,
      reservations: [cancelled.reservation],
      ...scope,
    })).toBe(onHand);
    expect(() => cancelReservation({
      reservation: cancelled.reservation,
      tenantId: scope.tenantId,
      quantityOnHand: onHand,
      cancelledAt: '2026-10-29T09:06:00.000Z',
    })).toThrow(StockReservationError);
  });

  it('reverses a release by appending a new active hold', () => {
    const original = hold();
    const issued = releaseReservationOnIssue({
      reservation: original,
      tenantId: scope.tenantId,
      quantityOnHand: onHand,
      releasedAt: '2026-10-29T09:00:00.000Z',
    });
    const reversed = reverseReservation({
      reservation: issued.reservation,
      reservations: [issued.reservation],
      newReservationId: 'res-1-rev',
      tenantId: scope.tenantId,
      quantityOnHand: onHand,
      reversedAt: '2026-10-29T10:00:00.000Z',
    });

    expect(reversed.original.status).toBe('RELEASED');
    expect(issued.reservation.status).toBe('RELEASED');
    expect(reversed.restored.status).toBe('ACTIVE');
    expect(reversed.restored.reversesReservationId).toBe(original.id);
    expect(reversed.quantityOnHand).toBe(onHand);
    expect(availableQuantity({
      quantityOnHand: onHand,
      reservations: [reversed.original, reversed.restored],
      ...scope,
    })).toBe(6);
    expect(() => reverseReservation({
      reservation: reversed.original,
      reservations: [reversed.original, reversed.restored],
      newReservationId: 'res-1-rev-2',
      tenantId: scope.tenantId,
      quantityOnHand: onHand,
      reversedAt: '2026-10-29T10:05:00.000Z',
    })).toThrow(StockReservationError);
  });

  it('reverses a cancellation the same way and refuses an active hold', () => {
    const original = hold();
    const cancelled = cancelReservation({
      reservation: original,
      tenantId: scope.tenantId,
      quantityOnHand: onHand,
      cancelledAt: '2026-10-29T09:05:00.000Z',
    });
    const reversed = reverseReservation({
      reservation: cancelled.reservation,
      reservations: [cancelled.reservation],
      newReservationId: 'res-1-rev',
      tenantId: scope.tenantId,
      quantityOnHand: onHand,
      reversedAt: '2026-10-29T10:00:00.000Z',
    });

    expect(reversed.original.status).toBe('CANCELLED');
    expect(reversed.restored.status).toBe('ACTIVE');
    expect(() => reverseReservation({
      reservation: reversed.restored,
      reservations: [reversed.original, reversed.restored],
      newReservationId: 'res-again',
      tenantId: scope.tenantId,
      quantityOnHand: onHand,
      reversedAt: '2026-10-29T10:10:00.000Z',
    })).toThrow(StockReservationError);
  });

  it('refuses to restore a hold when the quantity is no longer available', () => {
    const original = hold({ quantity: 8 });
    const issued = releaseReservationOnIssue({
      reservation: original,
      tenantId: scope.tenantId,
      quantityOnHand: onHand,
      releasedAt: '2026-10-29T09:00:00.000Z',
    });
    const taken = hold({
      id: 'res-other',
      sourceId: 'order-other',
      quantity: 6,
      reservations: [issued.reservation],
    });

    expect(() => reverseReservation({
      reservation: issued.reservation,
      reservations: [issued.reservation, taken],
      newReservationId: 'res-1-rev',
      tenantId: scope.tenantId,
      quantityOnHand: onHand,
      reversedAt: '2026-10-29T10:00:00.000Z',
    })).toThrow(StockReservationError);
  });

  it('refuses a reservation operation for a different tenant', () => {
    const original = hold();
    expect(() => releaseReservationOnIssue({
      reservation: original,
      tenantId: 'tenant-02',
      quantityOnHand: onHand,
      releasedAt: '2026-10-29T09:00:00.000Z',
    })).toThrow(StockReservationError);
    expect(() => cancelReservation({
      reservation: original,
      tenantId: 'tenant-02',
      quantityOnHand: onHand,
      cancelledAt: '2026-10-29T09:00:00.000Z',
    })).toThrow(StockReservationError);
  });
});
