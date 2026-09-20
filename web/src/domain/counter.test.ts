import { describe, expect, it } from 'vitest';
import {
  addToCart,
  approvedPriceFor,
  ApprovedPriceRow,
  buildCounterSalePayload,
  buildTenderLines,
  calculateVariance,
  Cart,
  cartIsEmpty,
  cartItemCount,
  cartLineCount,
  CartLine,
  createHeldCart,
  CounterCatalogue,
  CounterProduct,
  formatLowStockLabel,
  formatVarianceLabel,
  isExpired,
  isLowStock,
  isPlausibleBarcode,
  loadCart,
  loadHolds,
  lowStockState,
  normalizeBarcodeInput,
  onHandAt,
  pruneExpiredHolds,
  removeFromCart,
  resumeHeldCart,
  saveCart,
  saveHolds,
  selectableProducts,
  setCartQuantity,
  TenderLine,
  calculateRefundTotals,
  canReturnItem,
  formatReversalLabel,
  remainingReturnableQty,
  canTransact,
  isRetryableError,
  formatResilienceErrorMessage,
  createRetryContext,
  incrementRetry,
} from './counter';

describe('SERP-085 counter cart domain', () => {
  const PRODUCT_A = '00000000-0000-4000-8000-000000000401';
  const PRODUCT_B = '00000000-0000-4000-8000-000000000402';

  it('starts empty', () => {
    const cart: Cart = [];
    expect(cartIsEmpty(cart)).toBe(true);
    expect(cartLineCount(cart)).toBe(0);
    expect(cartItemCount(cart)).toBe(0);
  });

  it('adds a first line', () => {
    const cart = addToCart([], PRODUCT_A, 1);
    expect(cart).toEqual([{ productId: PRODUCT_A, quantity: 1 }]);
  });

  it('merges duplicate products into one line', () => {
    const cart = addToCart(addToCart([], PRODUCT_A, 1), PRODUCT_A, 2);
    expect(cart).toEqual([{ productId: PRODUCT_A, quantity: 3 }]);
    expect(cartLineCount(cart)).toBe(1);
    expect(cartItemCount(cart)).toBe(3);
  });

  it('keeps distinct products as separate lines', () => {
    const cart = addToCart(addToCart([], PRODUCT_A, 1), PRODUCT_B, 4);
    expect(cartLineCount(cart)).toBe(2);
    expect(cartItemCount(cart)).toBe(5);
  });

  it('clamps quantity to a positive integer', () => {
    const cart = addToCart([], PRODUCT_A, 0.5);
    expect(cart[0].quantity).toBe(1);
  });

  it('sets quantity and removes the line at zero or negative', () => {
    const cart = addToCart(addToCart([], PRODUCT_A, 1), PRODUCT_B, 2);
    expect(setCartQuantity(cart, PRODUCT_A, 7)).toEqual([
      { productId: PRODUCT_A, quantity: 7 },
      { productId: PRODUCT_B, quantity: 2 },
    ]);
    expect(setCartQuantity(cart, PRODUCT_A, 0).map((l) => l.productId)).toEqual([PRODUCT_B]);
    expect(setCartQuantity(cart, PRODUCT_B, -3)).toEqual([{ productId: PRODUCT_A, quantity: 1 }]);
  });

  it('removes a single line', () => {
    const cart = addToCart(addToCart([], PRODUCT_A, 1), PRODUCT_B, 2);
    expect(removeFromCart(cart, PRODUCT_A).map((l) => l.productId)).toEqual([PRODUCT_B]);
  });
});

describe('SERP-085 counter holds domain', () => {
  const PRODUCT_A = '00000000-0000-4000-8000-000000000401';
  const PRODUCT_B = '00000000-0000-4000-8000-000000000402';
  const NOW = Date.parse('2026-09-19T10:00:00.000Z');

  const cart: Cart = [
    { productId: PRODUCT_A, quantity: 2 },
    { productId: PRODUCT_B, quantity: 1 },
  ];

  it('creates a hold that expires after the lifetime', () => {
    const hold = createHeldCart(cart, NOW);
    expect(hold.cart).toEqual(cart);
    expect(Date.parse(hold.heldAt)).toBe(NOW);
    expect(Date.parse(hold.expiresAt)).toBe(NOW + 15 * 60 * 1000);
    expect(isExpired(hold, NOW)).toBe(false);
    expect(isExpired(hold, NOW + 15 * 60 * 1000)).toBe(true);
  });

  it('deep-copies the cart so later cart edits cannot mutate a held snapshot', () => {
    const mutable = cart.map((line) => ({ ...line }));
    const hold = createHeldCart(mutable, NOW);
    mutable[0].quantity = 99;
    expect(hold.cart[0].quantity).toBe(2);
  });

  it('resumes a held cart as a fresh copy', () => {
    const hold = createHeldCart(cart, NOW);
    const resumed = resumeHeldCart(hold);
    resumed[0].quantity = 50;
    expect(hold.cart[0].quantity).toBe(2);
    expect(resumed[0].quantity).toBe(50);
  });

  it('prunes expired holds so they can never be resumed', () => {
    const live = createHeldCart(cart, NOW);
    const stale = createHeldCart(cart, NOW - 20 * 60 * 1000);
    const survivors = pruneExpiredHolds([live, stale], NOW);
    expect(survivors).toEqual([live]);
  });
});

describe('SERP-085 counter hold persistence is scoped', () => {
  it('reads and writes holds under (org|person|outlet) keys and prunes on read', () => {
    window.localStorage.clear();
    const scopeA = { organisationId: 'org-1', personUuid: 'person-1', locationId: 'loc-1' };
    const scopeB = { organisationId: 'org-1', personUuid: 'person-1', locationId: 'loc-2' };

    const hold = createHeldCart([{ productId: 'p1', quantity: 1 }], Date.now());
    const expired = { ...createHeldCart([{ productId: 'p2', quantity: 1 }], 0), expiresAt: new Date(0).toISOString() };
    saveHolds(scopeA, [hold, expired]);

    const loaded = loadHolds(scopeA);
    expect(loaded.map((h) => h.id)).toEqual([hold.id]);

    expect(loadHolds(scopeB)).toEqual([]);
  });

  it('scopes the active cart too', () => {
    window.localStorage.clear();
    const scopeA = { organisationId: 'org-1', personUuid: 'person-1', locationId: 'loc-1' };
    const scopeB = { organisationId: 'org-1', personUuid: 'person-1', locationId: 'loc-2' };

    saveCart(scopeA, [{ productId: 'p1', quantity: 3 }]);
    expect(loadCart(scopeA)).toEqual([{ productId: 'p1', quantity: 3 }]);
    expect(loadCart(scopeB)).toEqual([]);
  });

  it('sanitizes malformed persisted carts', () => {
    window.localStorage.clear();
    const scope = { organisationId: 'org-1', personUuid: 'person-1', locationId: 'loc-1' };
    window.localStorage.setItem(
      `starq:erp:counter:cart:org-1|person-1|loc-1`,
      JSON.stringify([
        { productId: 'p1', quantity: -5 },
        { productId: '', quantity: 2 },
        { productId: 'p2', quantity: 1.9 },
      ]),
    );
    expect(loadCart(scope)).toEqual([{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 1 }]);
  });
});

describe('SERP-085 counter uses only server-authoritative data', () => {
  const OUTLET = '00000000-0000-4000-8000-000000000301';
  const PRODUCT = '00000000-0000-4000-8000-000000000401';

  it('reads derived on-hand from the server rows, defaulting to zero', () => {
    const catalogue: CounterCatalogue = {
      ok: true,
      locations: [{ id: OUTLET, code: 'WS', name: 'Workshop', kind: 'workshop', active: true }],
      products: [],
      on_hand: [
        { organisation_id: 'org', location_id: OUTLET, product_id: PRODUCT, derived_quantity: 12.5 },
      ],
      prices: [],
      gst_registration_status: 'not_registered',
    };
    expect(onHandAt(catalogue.on_hand, OUTLET, PRODUCT)).toBe(12.5);
    expect(onHandAt(catalogue.on_hand, OUTLET, 'other-product')).toBe(0);
    expect(onHandAt(catalogue.on_hand, 'other-outlet', PRODUCT)).toBe(0);
  });

  it('supports dynamic server-provided GST rates for registered entities', () => {
    const registeredCatalogue: CounterCatalogue = {
      ok: true,
      locations: [{ id: OUTLET, code: 'MAIN', name: 'Main', kind: 'outlet', active: true }],
      products: [],
      on_hand: [],
      prices: [],
      gst_registration_status: 'registered',
      gst_rate: 0.08,
      gst_rate_percent: 8,
    };
    expect(registeredCatalogue.gst_registration_status).toBe('registered');
    expect(registeredCatalogue.gst_rate).toBe(0.08);
    expect(registeredCatalogue.gst_rate_percent).toBe(8);
  });

  it('only offers active sale-allowed inventoried products', () => {
    const selectable = selectableProducts([
      { id: 's1', sku: 'S', kind: 'service', name: 'Service', barcode: null, sale_allowed: true, active: true },
      { id: 'k1', sku: 'K', kind: 'consumable', name: 'Part', barcode: null, sale_allowed: true, active: true },
      { id: 'k2', sku: 'K2', kind: 'stock', name: 'Item', barcode: '6291041500213', sale_allowed: true, active: false },
      { id: 'k3', sku: 'K3', kind: 'stock', name: 'Not for sale', barcode: null, sale_allowed: false, active: true },
    ]);
    expect(selectable.map((p) => p.id)).toEqual(['k1']);
  });

  it('builds a COUNTER_SALE payload with identifiers only — never price or totals', () => {
    const cart: Cart = [
      { productId: PRODUCT, quantity: 2 },
      { productId: 'second', quantity: 1 },
    ];
    const payload = buildCounterSalePayload(cart, OUTLET, { taxMode: 'exclusive' });
    expect(payload).toEqual({
      location_id: OUTLET,
      tax_mode: 'exclusive',
      items: [
        { product_id: PRODUCT, quantity: 2 },
        { product_id: 'second', quantity: 1 },
      ],
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/price|amount|total|gst|tax_amount/i);
  });
});

describe('SERP-085 counter line integrity', () => {
  it('preserves line order when mutating existing lines', () => {
    const lines: CartLine[] = [
      { productId: 'a', quantity: 1 },
      { productId: 'b', quantity: 2 },
      { productId: 'c', quantity: 3 },
    ];
    expect(setCartQuantity(lines, 'b', 9)).toEqual([
      { productId: 'a', quantity: 1 },
      { productId: 'b', quantity: 9 },
      { productId: 'c', quantity: 3 },
    ]);
  });
});

describe('SERP-086 counter barcode + approved pricing domain', () => {
  const PRODUCT_A = '00000000-0000-4000-8000-000000000401';
  const PRODUCT_B = '00000000-0000-4000-8000-000000000402';

  it('normalizes scanner input to upper/trimmed — mirror of the SQL btrim+upper', () => {
    expect(normalizeBarcodeInput(' 6291041500213 ')).toBe('6291041500213');
    expect(normalizeBarcodeInput('abc1234567890')).toBe('ABC1234567890');
    expect(normalizeBarcodeInput('')).toBe('');
  });

  it('guards plausibility so misreads do not fire network calls', () => {
    expect(isPlausibleBarcode('6291041500213')).toBe(true);
    expect(isPlausibleBarcode('A.B_C-D')).toBe(true);
    expect(isPlausibleBarcode('ABC')).toBe(true);
    expect(isPlausibleBarcode('')).toBe(false);
    expect(isPlausibleBarcode('62 104')).toBe(false);
    expect(isPlausibleBarcode('62/104*150021')).toBe(false);
  });

  it('looks up the server-approved price row for a product in the cart', () => {
    const prices: ApprovedPriceRow[] = [
      { product_id: PRODUCT_A, source: 'product_prices', unit_amount: 100, discount_percent: 0, price_list_version: null, currency: 'MVR' },
      { product_id: PRODUCT_B, source: 'none', unit_amount: 0, discount_percent: 0, price_list_version: null, currency: 'MVR' },
    ];
    expect(approvedPriceFor(prices, PRODUCT_A)?.unit_amount).toBe(100);
    expect(approvedPriceFor(prices, PRODUCT_A)?.source).toBe('product_prices');
    // A product with no price row reads as absent — never as MVR 0.00.
    expect(approvedPriceFor(prices, 'absent')).toBeNull();
    expect(approvedPriceFor(prices, 'absent')?.unit_amount ?? undefined).toBeUndefined();
  });

  it('keeps the catalogue price rows server-authored — no client computation', () => {
    const rows: ApprovedPriceRow[] = [
      { product_id: PRODUCT_A, source: 'price_list_override', unit_amount: 42, discount_percent: 25, price_list_version: 1, currency: 'MVR' },
    ];
    expect(rows[0].price_list_version).toBe(1);
    expect(rows[0].currency).toBe('MVR');
    expect(rows[0].discount_percent).toBe(25);
  });
});

describe('SERP-087 tender + receipt domain', () => {
  const OUTLET = '00000000-0000-4000-8000-000000000301';
  const PRODUCT = '00000000-0000-4000-8000-000000000401';

  it('emits one cash leg for a single-cash tender', () => {
    expect(buildTenderLines('cash', { cash: 200, card: 0, transfer: 0 })).toEqual([
      { method: 'cash', amount_tendered: 200 },
    ] as TenderLine[]);
  });

  it('emits nothing when zero was handed over — the server decides sufficiency', () => {
    expect(buildTenderLines('cash', { cash: 0, card: 0, transfer: 0 })).toEqual([]);
    expect(buildTenderLines('card', { cash: 0, card: 0, transfer: 0 })).toEqual([]);
  });

  it('emits exactly one leg for a single method, of the declared method', () => {
    expect(buildTenderLines('card', { cash: 0, card: 106, transfer: 0 })).toEqual([
      { method: 'card', amount_tendered: 106 },
    ]);
    expect(buildTenderLines('transfer', { cash: 0, card: 0, transfer: 106 })).toEqual([
      { method: 'transfer', amount_tendered: 106 },
    ]);
  });

  it('emits one leg per positive method for a mixed tender, skipping zero-value methods', () => {
    expect(buildTenderLines('mixed', { cash: 50, card: 56, transfer: 0 })).toEqual([
      { method: 'cash', amount_tendered: 50 },
      { method: 'card', amount_tendered: 56 },
    ]);
    expect(buildTenderLines('mixed', { cash: 0, card: 0, transfer: 106 })).toEqual([
      { method: 'transfer', amount_tendered: 106 },
    ]);
  });

  it('keeps legacy payload shape unchanged when no tender is declared', () => {
    const cart: Cart = [{ productId: PRODUCT, quantity: 1 }];
    expect(buildCounterSalePayload(cart, OUTLET)).toEqual({
      location_id: OUTLET,
      tax_mode: 'exclusive',
      items: [{ product_id: PRODUCT, quantity: 1 }],
    });
  });

  it('adds payment_method + tender legs, and never a computed money figure', () => {
    const cart: Cart = [{ productId: PRODUCT, quantity: 2 }];
    const payload = buildCounterSalePayload(cart, OUTLET, {
      taxMode: 'exclusive',
      paymentMethod: 'mixed',
      tender: [
        { method: 'cash', amount_tendered: 100 },
        { method: 'card', amount_tendered: 112 },
      ],
    });
    expect(payload).toEqual({
      location_id: OUTLET,
      tax_mode: 'exclusive',
      items: [{ product_id: PRODUCT, quantity: 2 }],
      payment_method: 'mixed',
      tender: [
        { method: 'cash', amount_tendered: 100 },
        { method: 'card', amount_tendered: 112 },
      ],
    });
    // The client declares what was handed over — subtotal/tax/total/change stay server-side.
    expect(JSON.stringify(payload)).not.toMatch(/\bprice\b|subtotal|\btax\b|\btotal\b|change/i);
  });
});

describe('SERP-089 counter cash-session variance domain', () => {
  it('calculates exact variance as 0.00', () => {
    expect(calculateVariance(500, 500)).toBe(0);
    expect(formatVarianceLabel(0, 'MVR')).toBe('Exact (MVR 0.00)');
  });

  it('calculates shortage as negative variance', () => {
    expect(calculateVariance(550, 540)).toBe(-10);
    expect(formatVarianceLabel(-10, 'MVR')).toBe('-10.00 MVR (Short)');
  });

  it('calculates overage as positive variance', () => {
    expect(calculateVariance(500, 525)).toBe(25);
    expect(formatVarianceLabel(25, 'MVR')).toBe('+25.00 MVR (Over)');
  });

  it('handles decimal roundings accurately (no floating point artifact)', () => {
    expect(calculateVariance(123.45, 120.10)).toBe(-3.35);
    expect(calculateVariance(100.10, 100.25)).toBe(0.15);
  });

  it('formats non-MVR currencies correctly', () => {
    expect(formatVarianceLabel(5, 'USD')).toBe('+5.00 USD (Over)');
    expect(formatVarianceLabel(-2.5, 'USD')).toBe('-2.50 USD (Short)');
    expect(formatVarianceLabel(0, 'USD')).toBe('Exact (USD 0.00)');
  });
});

describe('SERP-438 counter low-stock signal domain', () => {
  const stockItemWithThreshold: CounterProduct = {
    id: 'prod-stock-1',
    sku: 'SKU-001',
    kind: 'stock',
    name: 'Stock Item With Threshold',
    barcode: '1234567890',
    reorder_threshold: 5,
    sale_allowed: true,
    active: true,
  };

  const stockItemNoThreshold: CounterProduct = {
    id: 'prod-stock-2',
    sku: 'SKU-002',
    kind: 'stock',
    name: 'Stock Item No Threshold',
    barcode: null,
    reorder_threshold: null,
    sale_allowed: true,
    active: true,
  };

  const serviceItem: CounterProduct = {
    id: 'prod-srv-1',
    sku: 'SRV-001',
    kind: 'service',
    name: 'Service Item',
    barcode: null,
    reorder_threshold: 5,
    sale_allowed: true,
    active: true,
  };

  it('defaults to no low-stock signal when threshold is null or undefined (no forced configuration)', () => {
    expect(isLowStock(stockItemNoThreshold, 0)).toBe(false);
    expect(isLowStock(stockItemNoThreshold, -5)).toBe(false);
    expect(isLowStock(stockItemNoThreshold, 10)).toBe(false);
    expect(lowStockState(stockItemNoThreshold, 0).isLowStock).toBe(false);
    expect(lowStockState(stockItemNoThreshold, 0).threshold).toBeNull();
  });

  it('never flags service products as low stock regardless of on-hand', () => {
    expect(isLowStock(serviceItem, 0)).toBe(false);
    expect(isLowStock(serviceItem, -2)).toBe(false);
    expect(formatLowStockLabel(serviceItem, 0)).toBeNull();
  });

  it('detects on_hand strictly above threshold as NOT low stock', () => {
    expect(isLowStock(stockItemWithThreshold, 6)).toBe(false);
    expect(isLowStock(stockItemWithThreshold, 100)).toBe(false);
    const state = lowStockState(stockItemWithThreshold, 6);
    expect(state.isLowStock).toBe(false);
    expect(state.varianceToThreshold).toBe(1);
    expect(formatLowStockLabel(stockItemWithThreshold, 6)).toBeNull();
  });

  it('detects exact threshold boundary as low stock (on_hand === threshold)', () => {
    expect(isLowStock(stockItemWithThreshold, 5)).toBe(true);
    const state = lowStockState(stockItemWithThreshold, 5);
    expect(state.isLowStock).toBe(true);
    expect(state.varianceToThreshold).toBe(0);
    expect(formatLowStockLabel(stockItemWithThreshold, 5)).toBe('Low Stock (≤ 5)');
  });

  it('detects on_hand below threshold as low stock', () => {
    expect(isLowStock(stockItemWithThreshold, 3)).toBe(true);
    const state = lowStockState(stockItemWithThreshold, 3);
    expect(state.isLowStock).toBe(true);
    expect(state.isOutOfStock).toBe(false);
    expect(state.varianceToThreshold).toBe(-2);
    expect(formatLowStockLabel(stockItemWithThreshold, 3)).toBe('Low Stock (≤ 5)');
  });

  it('distinguishes out of stock (on_hand <= 0)', () => {
    expect(isLowStock(stockItemWithThreshold, 0)).toBe(true);
    const state = lowStockState(stockItemWithThreshold, 0);
    expect(state.isLowStock).toBe(true);
    expect(state.isOutOfStock).toBe(true);
    expect(formatLowStockLabel(stockItemWithThreshold, 0)).toBe('Out of Stock');
  });
});

describe('SERP-088 counter return, refund and void domain', () => {
  it('calculates remaining returnable quantity correctly', () => {
    expect(remainingReturnableQty(5, 0)).toBe(5);
    expect(remainingReturnableQty(5, 2)).toBe(3);
    expect(remainingReturnableQty(5, 5)).toBe(0);
    expect(remainingReturnableQty(5, 6)).toBe(0);
  });

  it('validates whether an item line can be returned', () => {
    // Original sold: 10, prior returned: 3 -> remaining: 7
    expect(canReturnItem(10, 3, 5)).toBe(true);
    expect(canReturnItem(10, 3, 7)).toBe(true);
    expect(canReturnItem(10, 3, 8)).toBe(false); // exceeds remaining
    expect(canReturnItem(10, 3, 0)).toBe(false); // zero not allowed
    expect(canReturnItem(10, 3, -1)).toBe(false); // negative not allowed
  });

  it('sums refund tenders correctly with decimal precision', () => {
    expect(calculateRefundTotals([
      { method: 'cash', amount: 50.25 },
      { method: 'card', amount: 25.50 },
    ])).toBe(75.75);

    expect(calculateRefundTotals([
      { method: 'cash', amount: 100 },
    ])).toBe(100);

    expect(calculateRefundTotals([])).toBe(0);
  });

  it('formats reversal label for returns and voids', () => {
    expect(formatReversalLabel('return', 'RET-00001', 50.00, 'MVR')).toBe('Return RET-00001 — MVR 50.00');
    expect(formatReversalLabel('void', 'RET-00002', 150.75, 'USD')).toBe('Void RET-00002 — USD 150.75');
  });
});

describe('SERP-090 counter retry and resilience domain', () => {
  it('strictly enforces online server-authoritative transactions', () => {
    expect(canTransact(true)).toBe(true);
    expect(canTransact(false)).toBe(false);
  });

  it('identifies retryable network and timeout errors', () => {
    expect(isRetryableError('Failed to fetch')).toBe(true);
    expect(isRetryableError('TypeError: NetworkError when attempting to fetch resource.')).toBe(true);
    expect(isRetryableError('request_timeout')).toBe(true);
    expect(isRetryableError('network_offline')).toBe(true);
    expect(isRetryableError('Connection timeout')).toBe(true);

    expect(isRetryableError({ status: 504 })).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
    expect(isRetryableError({ status: 502 })).toBe(true);
    expect(isRetryableError({ code: 'network_offline' })).toBe(true);
    expect(isRetryableError({ code: 'request_timeout' })).toBe(true);
    expect(isRetryableError({ message: 'Failed to fetch resource' })).toBe(true);

    // Non-retryable errors (auth, validation, business rules)
    expect(isRetryableError('seat_not_authorized')).toBe(false);
    expect(isRetryableError('stock_insufficient')).toBe(false);
    expect(isRetryableError('idempotency_key_conflict')).toBe(false);
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError({ status: 403 })).toBe(false);
    expect(isRetryableError({ status: 409 })).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });

  it('formats human-readable error messages for resilience and negative auth codes', () => {
    expect(formatResilienceErrorMessage('seat_not_authorized')).toContain('Unauthorized seat');
    expect(formatResilienceErrorMessage('stock_insufficient')).toContain('Insufficient stock on hand');
    expect(formatResilienceErrorMessage('stock_line_quantity_exceeds_onhand')).toContain('negative stock cannot be created');
    expect(formatResilienceErrorMessage('idempotency_key_conflict')).toContain('Idempotency conflict');
    expect(formatResilienceErrorMessage('reversal_approval_required')).toContain('Supervisor approval required');
    expect(formatResilienceErrorMessage('reversal_approver_unauthorized')).toContain('Approver unauthorized');
    expect(formatResilienceErrorMessage('sale_not_found')).toContain('Sale not found');
    expect(formatResilienceErrorMessage('location_not_found')).toContain('Location not found');
    expect(formatResilienceErrorMessage('no_open_session')).toContain('No open session');
    expect(formatResilienceErrorMessage('network_offline')).toContain('Network offline');
    expect(formatResilienceErrorMessage('request_timeout')).toContain('Request timed out');
    expect(formatResilienceErrorMessage('unknown_error_code')).toBe('Transaction rejected (unknown_error_code).');
  });

  it('maintains idempotency key across retry context attempts', () => {
    const ctx1 = createRetryContext('fixed-key-123');
    expect(ctx1.idempotencyKey).toBe('fixed-key-123');
    expect(ctx1.attemptCount).toBe(1);

    const ctx2 = incrementRetry(ctx1);
    expect(ctx2.idempotencyKey).toBe('fixed-key-123'); // MUST preserve the same key
    expect(ctx2.attemptCount).toBe(2);

    const ctx3 = incrementRetry(ctx2);
    expect(ctx3.idempotencyKey).toBe('fixed-key-123');
    expect(ctx3.attemptCount).toBe(3);
  });

  it('generates a fresh UUID when no existing key is provided', () => {
    const ctx = createRetryContext();
    expect(ctx.idempotencyKey).toBeTruthy();
    expect(typeof ctx.idempotencyKey).toBe('string');
    expect(ctx.attemptCount).toBe(1);
  });
});