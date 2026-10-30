import { accountClassForCode, AccountRecord } from './accounts';
import { JournalEntry } from './journals';
import { assertJournalPostable } from './postingControl';
import { AccountingPeriod } from './periods';

export interface WarehouseLocation {
  id: string;
  code: string;
  name: string;
  island: string;
  atoll: string;
  isMainHub: boolean;
  contactPerson: string;
  phone: string;
}

export interface WarehouseStockItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseCode: string;
  quantityOnHand: number;
  reorderPoint: number;
  safetyStock: number;
  unitCostMvr: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface StockTransferOrder {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  sourceWarehouseCode: string;
  destinationWarehouseId: string;
  destinationWarehouseCode: string;
  vesselNameOrSeaRoute: string; // e.g. "MV Horizon Trader - Sea Transfer"
  carrierReference?: string;
  items: Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    unitCostMvr: number;
    totalValueMvr: number;
    batchNumber?: string;
  }>;
  totalTransferValueMvr: number;
  status: 'DRAFT' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  dispatchedDate?: string;
  receivedDate?: string;
  dispatchJournal?: JournalEntry;
  receiptJournal?: JournalEntry;
}

export const MALDIVES_DEFAULT_WAREHOUSES: WarehouseLocation[] = [
  {
    id: 'wh-male',
    code: 'WH-MLE',
    name: 'Male Central Hub Warehouse',
    island: 'Male',
    atoll: 'Kaafu',
    isMainHub: true,
    contactPerson: 'Moosa Ali',
    phone: '+960 7791234',
  },
  {
    id: 'wh-hulhumale',
    code: 'WH-HUL',
    name: 'Hulhumale Phase 2 Logistics Depot',
    island: 'Hulhumale',
    atoll: 'Kaafu',
    isMainHub: false,
    contactPerson: 'Ibrahim Rasheed',
    phone: '+960 7812345',
  },
  {
    id: 'wh-thilafushi',
    code: 'WH-THL',
    name: 'Thilafushi Heavy Marine Yard',
    island: 'Thilafushi',
    atoll: 'Kaafu',
    isMainHub: false,
    contactPerson: 'Naeem Shareef',
    phone: '+960 7903456',
  },
];

/**
 * Creates and evaluates a Stock Transfer Order between inter-island warehouses.
 */
export function createStockTransferOrder(params: {
  id: string;
  transferNumber: string;
  sourceWarehouse: WarehouseLocation;
  destinationWarehouse: WarehouseLocation;
  vesselNameOrSeaRoute: string;
  items: Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    unitCostMvr: number;
    batchNumber?: string;
  }>;
  tenantId: string;
}): StockTransferOrder {
  const {
    id,
    transferNumber,
    sourceWarehouse,
    destinationWarehouse,
    vesselNameOrSeaRoute,
    items,
    tenantId,
  } = params;

  const enrichedItems = items.map((it) => ({
    ...it,
    totalValueMvr: round2(it.quantity * it.unitCostMvr),
  }));

  const totalValue = round2(enrichedItems.reduce((s, it) => s + it.totalValueMvr, 0));

  const order: StockTransferOrder = {
    id,
    transferNumber,
    sourceWarehouseId: sourceWarehouse.id,
    sourceWarehouseCode: sourceWarehouse.code,
    destinationWarehouseId: destinationWarehouse.id,
    destinationWarehouseCode: destinationWarehouse.code,
    vesselNameOrSeaRoute,
    items: enrichedItems,
    totalTransferValueMvr: totalValue,
    status: 'DRAFT',
  };

  return order;
}

/**
 * Dispatches the transfer order, moving inventory to Goods-in-Transit (Account 1350).
 *
 * When periods and accounts are supplied, the journal passes through
 * assertJournalPostable() as actor 'system' before it is returned.
 * Callers that do not supply them keep the previous transfer contract.
 */
export function dispatchStockTransfer(
  order: StockTransferOrder,
  dispatchDate: string,
  tenantId: string,
  periods?: AccountingPeriod[],
  accounts?: AccountRecord[]
): StockTransferOrder {
  const dispatchJournal: JournalEntry = {
    id: `je-disp-${order.transferNumber}`,
    entryNumber: `JE-DISP-${order.transferNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
    date: dispatchDate,
    source: 'STOCK_TRANSFER_DISPATCH',
    reference: order.transferNumber,
    narration: `Stock Transfer Dispatch ${order.transferNumber} from ${order.sourceWarehouseCode} to In-Transit via ${order.vesselNameOrSeaRoute}`,
    lines: [
      {
        id: 'std-01',
        accountCode: '1320',
        accountId: 'acc-1320',
        accountClass: accountClassForCode('1320'),
        accountName: 'Goods in Transit (Sea Freight & Clearing)',
        debit: order.totalTransferValueMvr,
        credit: 0,
        narration: `In-Transit inventory moving to ${order.destinationWarehouseCode}`,
      },
      {
        id: 'std-02',
        accountCode: '1310',
        accountId: 'acc-1310',
        accountClass: accountClassForCode('1310'),
        accountName: 'Merchandise & Spare Parts Inventory',
        debit: 0,
        credit: order.totalTransferValueMvr,
        narration: `Relieve inventory from ${order.sourceWarehouseCode}`,
      },
    ],
    totalDebit: order.totalTransferValueMvr,
    totalCredit: order.totalTransferValueMvr,
    isBalanced: true,
    postedBy: 'System / Warehouse Engine',
    postedAt: new Date().toISOString(),
    tenantId,
    status: 'POSTED',
  };

  if (periods && accounts) {
    assertJournalPostable({ entry: dispatchJournal, periods, accounts, actor: 'system' });
  }

  return {
    ...order,
    status: 'DISPATCHED',
    dispatchedDate: dispatchDate,
    dispatchJournal,
  };
}

/**
 * Receives the transfer order at the destination warehouse, clearing Goods-in-Transit.
 * The posting gate runs when periods and accounts are both supplied.
 */
export function receiveStockTransfer(
  order: StockTransferOrder,
  receiveDate: string,
  tenantId: string,
  periods?: AccountingPeriod[],
  accounts?: AccountRecord[]
): StockTransferOrder {
  const receiptJournal: JournalEntry = {
    id: `je-recv-${order.transferNumber}`,
    entryNumber: `JE-RECV-${order.transferNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
    date: receiveDate,
    source: 'STOCK_TRANSFER_RECEIPT',
    reference: order.transferNumber,
    narration: `Stock Transfer Receipt ${order.transferNumber} at ${order.destinationWarehouseCode} from In-Transit`,
    lines: [
      {
        id: 'str-01',
        accountCode: '1310',
        accountId: 'acc-1310',
        accountClass: accountClassForCode('1310'),
        accountName: 'Merchandise & Spare Parts Inventory',
        debit: order.totalTransferValueMvr,
        credit: 0,
        narration: `Receive stock into ${order.destinationWarehouseCode}`,
      },
      {
        id: 'str-02',
        accountCode: '1320',
        accountId: 'acc-1320',
        accountClass: accountClassForCode('1320'),
        accountName: 'Goods in Transit (Sea Freight & Clearing)',
        debit: 0,
        credit: order.totalTransferValueMvr,
        narration: `Clear In-Transit inventory upon dock verification`,
      },
    ],
    totalDebit: order.totalTransferValueMvr,
    totalCredit: order.totalTransferValueMvr,
    isBalanced: true,
    postedBy: 'System / Warehouse Engine',
    postedAt: new Date().toISOString(),
    tenantId,
    status: 'POSTED',
  };

  if (periods && accounts) {
    assertJournalPostable({ entry: receiptJournal, periods, accounts, actor: 'system' });
  }

  return {
    ...order,
    status: 'RECEIVED',
    receivedDate: receiveDate,
    receiptJournal,
  };
}

export type StockReservationStatus = 'ACTIVE' | 'RELEASED' | 'CANCELLED';

/** Generic demand the hold is taken against. Not tied to an industry document. */
export type StockReservationSource = 'ORDER' | 'PENDING_SALE';

export interface StockReservation {
  id: string;
  tenantId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  sourceType: StockReservationSource;
  sourceId: string;
  status: StockReservationStatus;
  createdAt: string;
  releasedAt?: string;
  cancelledAt?: string;
  /**
   * Set only on the new ACTIVE hold that restores a released or cancelled one.
   * The original record is left as it was.
   */
  reversesReservationId?: string;
}

export class StockReservationError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'invalid_quantity'
      | 'insufficient_available'
      | 'tenant_mismatch'
      | 'invalid_status'
      | 'missing_scope',
  ) {
    super(message);
    this.name = 'StockReservationError';
  }
}

const QTY_EPSILON = 1e-9;

function assertScope(value: string, label: string): void {
  if (value.trim() === '') {
    throw new StockReservationError(`${label} is required.`, 'missing_scope');
  }
}

function assertFiniteNonNegative(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new StockReservationError(
      `${label} must be a finite non-negative quantity.`,
      'invalid_quantity',
    );
  }
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new StockReservationError(
      'Reservation quantity must be a finite positive number.',
      'invalid_quantity',
    );
  }
}

function assertSameTenant(reservation: StockReservation, tenantId: string): void {
  assertScope(tenantId, 'tenantId');
  if (reservation.tenantId !== tenantId) {
    throw new StockReservationError(
      'Reservation belongs to a different tenant.',
      'tenant_mismatch',
    );
  }
}

function holdsThisStock(reservation: StockReservation, scope: {
  tenantId: string;
  itemId: string;
  warehouseId: string;
}): boolean {
  return reservation.status === 'ACTIVE'
    && reservation.tenantId === scope.tenantId
    && reservation.itemId === scope.itemId
    && reservation.warehouseId === scope.warehouseId;
}

/**
 * Sellable quantity. On-hand is an input and is never reduced here.
 * Only ACTIVE reservations for the same tenant, item, and warehouse count.
 */
export function availableQuantity(params: {
  quantityOnHand: number;
  reservations: readonly StockReservation[];
  tenantId: string;
  itemId: string;
  warehouseId: string;
}): number {
  assertFiniteNonNegative('quantityOnHand', params.quantityOnHand);
  assertScope(params.tenantId, 'tenantId');
  assertScope(params.itemId, 'itemId');
  assertScope(params.warehouseId, 'warehouseId');

  const reserved = params.reservations.reduce((sum, reservation) => {
    return holdsThisStock(reservation, params) ? sum + reservation.quantity : sum;
  }, 0);

  return params.quantityOnHand - reserved;
}

/**
 * Hold stock against a pending sale or order. Fails closed when the request
 * is non-positive or exceeds what is still available. Does not change on-hand.
 */
export function reserveStock(params: {
  id: string;
  tenantId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  sourceType: StockReservationSource;
  sourceId: string;
  quantityOnHand: number;
  reservations: readonly StockReservation[];
  reservedAt: string;
}): StockReservation {
  assertScope(params.id, 'id');
  assertScope(params.tenantId, 'tenantId');
  assertScope(params.itemId, 'itemId');
  assertScope(params.warehouseId, 'warehouseId');
  assertScope(params.sourceId, 'sourceId');
  assertScope(params.reservedAt, 'reservedAt');
  assertPositiveQuantity(params.quantity);

  if (params.reservations.some((reservation) => reservation.id === params.id)) {
    throw new StockReservationError('Reservation id already exists.', 'invalid_status');
  }

  const duplicateHold = params.reservations.some((reservation) => (
    holdsThisStock(reservation, params)
    && reservation.sourceType === params.sourceType
    && reservation.sourceId === params.sourceId
  ));
  if (duplicateHold) {
    throw new StockReservationError(
      'An active reservation already exists for this order or pending sale.',
      'invalid_status',
    );
  }

  const available = availableQuantity(params);
  if (params.quantity - available > QTY_EPSILON) {
    throw new StockReservationError(
      `Cannot reserve ${params.quantity} when ${available} is available.`,
      'insufficient_available',
    );
  }

  return {
    id: params.id,
    tenantId: params.tenantId,
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    quantity: params.quantity,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    status: 'ACTIVE',
    createdAt: params.reservedAt,
  };
}

/**
 * Release a hold because the stock was issued. On-hand is returned unchanged:
 * the issue itself is a separate stock movement.
 */
export function releaseReservationOnIssue(params: {
  reservation: StockReservation;
  tenantId: string;
  quantityOnHand: number;
  releasedAt: string;
}): { reservation: StockReservation; quantityOnHand: number } {
  assertSameTenant(params.reservation, params.tenantId);
  assertFiniteNonNegative('quantityOnHand', params.quantityOnHand);
  assertScope(params.releasedAt, 'releasedAt');
  if (params.reservation.status !== 'ACTIVE') {
    throw new StockReservationError(
      `Only an active reservation can be released on issue (status ${params.reservation.status}).`,
      'invalid_status',
    );
  }

  return {
    reservation: {
      ...params.reservation,
      status: 'RELEASED',
      releasedAt: params.releasedAt,
    },
    quantityOnHand: params.quantityOnHand,
  };
}

/** Drop a hold because the sale or order was cancelled. On-hand stays as it was. */
export function cancelReservation(params: {
  reservation: StockReservation;
  tenantId: string;
  quantityOnHand: number;
  cancelledAt: string;
}): { reservation: StockReservation; quantityOnHand: number } {
  assertSameTenant(params.reservation, params.tenantId);
  assertFiniteNonNegative('quantityOnHand', params.quantityOnHand);
  assertScope(params.cancelledAt, 'cancelledAt');
  if (params.reservation.status !== 'ACTIVE') {
    throw new StockReservationError(
      `Only an active reservation can be cancelled (status ${params.reservation.status}).`,
      'invalid_status',
    );
  }

  return {
    reservation: {
      ...params.reservation,
      status: 'CANCELLED',
      cancelledAt: params.cancelledAt,
    },
    quantityOnHand: params.quantityOnHand,
  };
}

/**
 * Restore a hold that was released or cancelled in error.
 * Appends a new ACTIVE reservation. The original record is not rewritten.
 */
export function reverseReservation(params: {
  reservation: StockReservation;
  reservations: readonly StockReservation[];
  newReservationId: string;
  tenantId: string;
  quantityOnHand: number;
  reversedAt: string;
}): { original: StockReservation; restored: StockReservation; quantityOnHand: number } {
  assertSameTenant(params.reservation, params.tenantId);
  assertFiniteNonNegative('quantityOnHand', params.quantityOnHand);
  assertScope(params.newReservationId, 'newReservationId');
  assertScope(params.reversedAt, 'reversedAt');

  if (params.reservation.status === 'ACTIVE') {
    throw new StockReservationError(
      'An active reservation is already holding stock and cannot be reversed.',
      'invalid_status',
    );
  }
  if (params.reservation.status !== 'RELEASED' && params.reservation.status !== 'CANCELLED') {
    throw new StockReservationError(
      `Reservation status ${params.reservation.status} cannot be reversed.`,
      'invalid_status',
    );
  }
  if (params.reservations.some((reservation) => reservation.id === params.newReservationId)) {
    throw new StockReservationError('Reservation id already exists.', 'invalid_status');
  }
  const alreadyRestored = params.reservations.some((reservation) => (
    reservation.status === 'ACTIVE'
    && reservation.reversesReservationId === params.reservation.id
    && reservation.tenantId === params.tenantId
  ));
  if (alreadyRestored) {
    throw new StockReservationError(
      'This reservation already has an active reversing hold.',
      'invalid_status',
    );
  }

  const available = availableQuantity({
    quantityOnHand: params.quantityOnHand,
    reservations: params.reservations,
    tenantId: params.reservation.tenantId,
    itemId: params.reservation.itemId,
    warehouseId: params.reservation.warehouseId,
  });
  if (params.reservation.quantity - available > QTY_EPSILON) {
    throw new StockReservationError(
      `Cannot restore a hold of ${params.reservation.quantity} when ${available} is available.`,
      'insufficient_available',
    );
  }

  return {
    original: params.reservation,
    quantityOnHand: params.quantityOnHand,
    restored: {
      id: params.newReservationId,
      tenantId: params.reservation.tenantId,
      itemId: params.reservation.itemId,
      warehouseId: params.reservation.warehouseId,
      quantity: params.reservation.quantity,
      sourceType: params.reservation.sourceType,
      sourceId: params.reservation.sourceId,
      status: 'ACTIVE',
      createdAt: params.reversedAt,
      reversesReservationId: params.reservation.id,
    },
  };
}

/**
 * Evaluates low-stock reorder triggers across all warehouse locations.
 */
export function evaluateWarehouseStockReorders(
  items: WarehouseStockItem[]
): Array<WarehouseStockItem & { deficitQuantity: number }> {
  return items
    .filter((it) => it.quantityOnHand <= it.reorderPoint)
    .map((it) => ({
      ...it,
      deficitQuantity: it.reorderPoint + it.safetyStock - it.quantityOnHand,
    }));
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}
