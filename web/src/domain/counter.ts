/**
 * SERP-085 — Counter session, cart and hold workflow.
 *
 * DOMAIN ONLY. This module holds no sale authority: it never computes a unit
 * price, subtotal, tax, or net worth. Every price/total shown to an operator
 * comes from the server-side COUNTER_SALE response. The cart carries only
 * product_id + quantity; pricing and stock mutation are resolved by
 * api_garage_command inside a single transaction.
 *
 * Holds are expiring and reversible, and every cart AND hold is scoped to
 * (organisation, person, outlet). Nothing about another tenant, another
 * operator, or another outlet is ever reachable from a given scope.
 */

export type ProductTaxClassification = 'standard_rated' | 'zero_rated' | 'exempt';
export type OutletTaxRegime = 'gst_general' | 'gst_tourism';

export interface CounterLocation {
  id: string;
  code: string;
  name: string;
  kind: string;
  tax_regime?: OutletTaxRegime;
  active: boolean;
}

export interface CounterProduct {
  id: string;
  sku: string;
  kind: 'service' | 'stock' | 'consumable';
  name: string;
  category?: string | null;
  barcode: string | null;
  reorder_threshold?: number | null;
  tax_classification?: ProductTaxClassification;
  sale_allowed: boolean;
  active: boolean;
}

/**
 * One row of the bulk approved-price resolution carried on the counter
 * catalogue. ALWAYS server-authored (api_counter_approved_prices): the client
 * never computes these amounts, it only looks them up for display.
 */
export interface ApprovedPriceRow {
  product_id: string;
  source: 'price_list_override' | 'product_prices' | 'none';
  unit_amount: number;
  discount_percent: number;
  price_list_version: number | null;
  currency: string;
}

/**
 * The single-item resolution from GET /api/ops/counter/resolve — mirrors the
 * api_counter_price_resolution RPC response verbatim. `price.resolved === false`
 * is the server's fail-closed "no approved price" state (reason:
 * stock_line_no_price); the UI must show it as such, never invent a price.
 */
export interface PriceResolution {
  ok: boolean;
  product: {
    id: string;
    sku: string;
    kind: string;
    name: string;
    barcode: string | null;
    tax_classification?: ProductTaxClassification;
    active: boolean;
    sale_allowed: boolean;
  } | null;
  price: {
    resolved: boolean;
    reason?: string;
    source?: 'price_list_override' | 'product_prices' | 'none';
    unit_amount?: number;
    discount_percent?: number;
    price_list_id?: string | null;
    price_list_version?: number | null;
    currency?: string;
  };
  tax?: {
    mode: string;
    rate: number;
    tax_classification?: ProductTaxClassification;
    rule_version?: string;
    tax_amount: number;
    net_amount: number;
    gross_amount: number;
  };
  resolution: boolean;
}

export interface OnHandRow {
  organisation_id: string;
  location_id: string;
  product_id: string;
  derived_quantity: number;
}

export interface CounterCatalogue {
  ok: boolean;
  locations: CounterLocation[];
  products: CounterProduct[];
  on_hand: OnHandRow[];
  prices: ApprovedPriceRow[];
  gst_registration_status: 'registered' | 'not_registered' | 'pending' | 'suspended' | 'cancelled' | 'unknown';
  gst_rate?: number | null;
  gst_rate_percent?: number | null;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export type Cart = CartLine[];

/**
 * SERP-087 — tender declaration. The operator states only WHAT the customer
 * handed over (method + amount). The client never computes a total, a change,
 * a subtotal or a tax figure, and never sends one: api_garage_command validates
 * the mix against the server-computed sale total and returns the change.
 */
export type TenderMethod = 'cash' | 'card' | 'transfer';
export type PaymentMethod = TenderMethod | 'mixed';

export interface TenderLine {
  method: TenderMethod;
  amount_tendered: number;
}

export interface CounterScope {
  organisationId: string;
  personUuid: string;
  locationId: string;
}

export interface HeldCart {
  id: string;
  cart: Cart;
  heldAt: string;
  expiresAt: string;
}

export const HOLD_LIFETIME_MS = 15 * 60 * 1000;

const CART_KEY_PREFIX = 'starq:erp:counter:cart:';
const HOLDS_KEY_PREFIX = 'starq:erp:counter:holds:';

export function scopeStorageKey(prefix: string, scope: CounterScope): string {
  return `${prefix}${scope.organisationId}|${scope.personUuid}|${scope.locationId}`;
}

export function cartStorageKey(scope: CounterScope): string {
  return scopeStorageKey(CART_KEY_PREFIX, scope);
}

export function holdsStorageKey(scope: CounterScope): string {
  return scopeStorageKey(HOLDS_KEY_PREFIX, scope);
}

/**
 * Add a product to the cart. Duplicate products merge into one line; quantity
 * is clamped to a positive integer.
 */
export function addToCart(cart: Cart, productId: string, quantity = 1): Cart {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const existing = cart.find((line) => line.productId === productId);
  if (existing) {
    return cart.map((line) =>
      line.productId === productId ? { ...line, quantity: line.quantity + qty } : line
    );
  }
  return [...cart, { productId, quantity: qty }];
}

/**
 * Set the quantity of an existing line. A quantity at or below zero removes
 * the line entirely.
 */
export function setCartQuantity(cart: Cart, productId: string, quantity: number): Cart {
  const qty = Math.floor(Number(quantity) || 0);
  if (qty <= 0) return removeFromCart(cart, productId);
  return cart.map((line) =>
    line.productId === productId ? { ...line, quantity: qty } : line
  );
}

export function removeFromCart(cart: Cart, productId: string): Cart {
  return cart.filter((line) => line.productId !== productId);
}

export function cartLineCount(cart: Cart): number {
  return cart.length;
}

export function cartItemCount(cart: Cart): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartIsEmpty(cart: Cart): boolean {
  return cart.length === 0;
}

/**
 * Live derived on-hand for one product at one outlet. A product that has no
 * stock movements at the outlet reads as 0 — a stock ledger without rows has
 * nothing on hand, and the client must not invent availability from
 * inventory_items metadata.
 */
export function onHandAt(onHand: OnHandRow[], locationId: string, productId: string): number {
  const row = onHand.find(
    (entry) => entry.location_id === locationId && entry.product_id === productId,
  );
  return row ? Number(row.derived_quantity) : 0;
}

/**
 * Products that may actually be put in a counter cart. Service lines are
 * rejected by the backing COUNTER_SALE branch
 * (stock_line_product_not_inventoried), so the UI mirrors that: only active,
 * sale-allowed, inventoried kinds are selectable here.
 */
export function selectableProducts(products: CounterProduct[]): CounterProduct[] {
  return products.filter((product) =>
    product.active && product.sale_allowed && product.kind !== 'service',
  );
}

export function isExpired(hold: HeldCart, now: number): boolean {
  return Date.parse(hold.expiresAt) <= now;
}

export function createHeldCart(cart: Cart, now: number, lifetimeMs = HOLD_LIFETIME_MS): HeldCart {
  const heldAt = new Date(now).toISOString();
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${now}-${Math.floor(Math.random() * 1e9)}`,
    cart: cart.map((line) => ({ ...line })),
    heldAt,
    expiresAt: new Date(now + lifetimeMs).toISOString(),
  };
}

export function resumeHeldCart(hold: HeldCart): Cart {
  return hold.cart.map((line) => ({ ...line }));
}

/**
 * Expiring holds: prune anything past its expiry. Pruning is a read-time
 * concern — an expired hold must never be resumable, so the surviving list is
 * the only authorisation that matters.
 */
export function pruneExpiredHolds(holds: HeldCart[], now: number): HeldCart[] {
  return holds.filter((hold) => !isExpired(hold, now));
}

export function loadHolds(scope: CounterScope, now = Date.now()): HeldCart[] {
  try {
    const raw = window.localStorage.getItem(holdsStorageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HeldCart[];
    return pruneExpiredHolds(Array.isArray(parsed) ? parsed : [], now);
  } catch {
    return [];
  }
}

export function saveHolds(scope: CounterScope, holds: HeldCart[]): void {
  try {
    window.localStorage.setItem(holdsStorageKey(scope), JSON.stringify(holds));
  } catch {
    // Storage unavailable (private mode, quota) — the in-memory cart still
    // works; only cross-reload hold persistence degrades.
  }
}

export function loadCart(scope: CounterScope): Cart {
  try {
    const raw = window.localStorage.getItem(cartStorageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Cart;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((line) => ({
        productId: String(line.productId),
        quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
      }))
      .filter((line) => line.productId);
  } catch {
    return [];
  }
}

export function saveCart(scope: CounterScope, cart: Cart): void {
  try {
    window.localStorage.setItem(cartStorageKey(scope), JSON.stringify(cart));
  } catch {
    // Degrade gracefully — see saveHolds.
  }
}

/**
 * Build the COUNTER_SALE command body the way api_garage_command expects.
 * This carries ONLY identifiers, quantities and the customer-tendered input —
 * no price, no tax rate, no grand total, no change. The server resolves every
 * monetary value and validates the declared tender against it. When neither
 * paymentMethod nor tender is supplied, the legacy identifier-only shape is
 * produced unchanged (server default remains: payment_method/tender REQUIRED
 * for any real sale, enforced in the COUNTER_SALE branch).
 */
export function buildCounterSalePayload(
  cart: Cart,
  locationId: string,
  opts?: {
    taxMode?: string;
    paymentMethod?: PaymentMethod;
    tender?: TenderLine[];
  },
): {
  location_id: string;
  tax_mode: string;
  items: Array<{ product_id: string; quantity: number }>;
  payment_method?: PaymentMethod;
  tender?: TenderLine[];
} {
  const items = cart.map((line) => ({
    product_id: line.productId,
    quantity: line.quantity,
  }));
  const base = {
    location_id: locationId,
    tax_mode: opts?.taxMode ?? 'exclusive',
    items,
  };
  if (!opts?.paymentMethod && !opts?.tender) return base;
  return {
    ...base,
    payment_method: opts!.paymentMethod ?? 'cash',
    tender: opts!.tender ?? [],
  };
}

/**
 * SERP-087 — the tender legs sent to the server, from the operator's manual
 * entry. Pure shaping only: it never computes a total or change (the server
 * owns reconciliation). `mixed` emits one leg per method that has a value
 * (> 0); a single method emits exactly one leg (matching the server's
 * counter_sale_single_method_requires_single_tender gate). Empty result means
 * "nothing tendered yet" — the server fails the sale closed rather than guess.
 */
export function buildTenderLines(
  method: PaymentMethod,
  tendered: Record<TenderMethod, number>,
): TenderLine[] {
  if (method === 'mixed') {
    return (['cash', 'card', 'transfer'] as const)
      .filter((m) => tendered[m] > 0)
      .map((m) => ({ method: m, amount_tendered: tendered[m] }));
  }
  return tendered[method] > 0 ? [{ method, amount_tendered: tendered[method] }] : [];
}

/**
 * Normalize a raw scanner/submission barcode the same way the servers does
 * (btrim + upper). This is identity only — it never fabricates a barcode and
 * never validates one; the backing RPC owns grammar enforcement.
 */
export function normalizeBarcodeInput(raw: string): string {
  return String(raw ?? '').trim().toUpperCase();
}

/**
 * The bulk approved-price lookup for one product. Returns null when the
 * catalogue carries no resolved price for the product — callers must render
 * that as "no approved price", never as MVR 0.00.
 */
export function approvedPriceFor(prices: ApprovedPriceRow[], productId: string): ApprovedPriceRow | null {
  return prices.find((row) => row.product_id === productId) ?? null;
}

/**
 * SERP-085/086/144: Evaluate estimated GST for the counter cart.
 * If not registered, estimated tax is 0.
 * If registered and authoritative rate is available, returns numeric tax amount.
 * If registered and authoritative rate is missing/null, returns null (fail closed: no numeric fallback, do NOT default to 0 or 0.08).
 */
export function calculateEstimatedTax(
  status: CounterCatalogue['gst_registration_status'],
  rate: number | null | undefined,
  lines: CartLine[],
  prices: ApprovedPriceRow[],
): number | null {
  if (status !== 'registered') {
    return 0;
  }
  if (rate == null || typeof rate !== 'number' || rate < 0) {
    return null; // Authoritative rate unavailable — fail closed without numeric fallback!
  }
  let totalTax = 0;
  for (const line of lines) {
    const approved = approvedPriceFor(prices, line.productId);
    if (approved && approved.source !== 'none' && approved.unit_amount > 0) {
      const discountFactor = approved.discount_percent > 0 ? 1 - approved.discount_percent / 100 : 1;
      const lineAmount = line.quantity * (approved.unit_amount * discountFactor);
      totalTax += lineAmount * rate;
    }
  }
  return totalTax;
}

/**
 * SERP-144: Check whether counter sale completion is blocked by missing authoritative tax rate.
 * For registered entities, an authoritative GST rate is required to complete sale.
 */
export function isTaxRateMissingForSale(
  status: CounterCatalogue['gst_registration_status'],
  rate: number | null | undefined,
): boolean {
  if (status === 'unknown') {
    return true; // Statutory status unconfigured or lookup failed - fail closed!
  }
  return status === 'registered' && (rate == null || typeof rate !== 'number' || rate < 0);
}

/**
 * Pure guard used by the scan surface: indicates whether a normalized scan
 * should be sent to the server at all. A run of printable scanner characters
 * (letters, digits, dot/underscore/hyphen) is worth resolving; anything shorter
 * than one character or containing whitespace/other symbols is a likely
 * misread and should not fire a network call.
 */
export function isPlausibleBarcode(normalized: string): boolean {
  return /^[0-9A-Z][0-9A-Z._-]{0,31}$/.test(normalized);
}

/**
 * SERP-089 — Cash-session close and variance.
 * Server-authoritative session state representing the till register.
 */
export interface CounterSession {
  id: string | null;
  session_number: string | null;
  location_id: string;
  status: 'open' | 'closed' | 'unopened';
  currency: string;
  opened_at: string | null;
  opened_by?: string | null;
  opened_seat?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  closed_seat?: string | null;
  opening_float: number;
  cash_sales_amount: number;
  card_sales_amount: number;
  transfer_sales_amount: number;
  total_sales_amount: number;
  expected_cash: number;
  counted_cash?: number | null;
  variance_amount?: number | null;
  notes?: string | null;
  transaction_count: number;
}

export function calculateVariance(expectedCash: number, countedCash: number): number {
  return Math.round(((countedCash - expectedCash) + Number.EPSILON) * 100) / 100;
}

export function formatVarianceLabel(variance: number, currency: string = 'MVR'): string {
  if (variance === 0) return `Exact (${currency} 0.00)`;
  if (variance > 0) return `+${variance.toFixed(2)} ${currency} (Over)`;
  return `${variance.toFixed(2)} ${currency} (Short)`;
}

/**
 * SERP-438 — Reorder threshold and low-stock visibility signal.
 * Determines whether a product's live on-hand quantity is at or below its configured
 * reorder threshold. Null threshold means no threshold configured (never flags low stock).
 */
export function isLowStock(product: CounterProduct, onHand: number): boolean {
  if (product.kind !== 'stock') return false;
  if (product.reorder_threshold === null || product.reorder_threshold === undefined) {
    return false;
  }
  return onHand <= product.reorder_threshold;
}

export interface LowStockState {
  isLowStock: boolean;
  isOutOfStock: boolean;
  threshold: number | null;
  onHand: number;
  varianceToThreshold: number | null;
}

export function lowStockState(product: CounterProduct, onHand: number): LowStockState {
  const threshold = product.reorder_threshold ?? null;
  const isOutOfStock = onHand <= 0 && product.kind === 'stock';
  const isLow = isLowStock(product, onHand);
  const varianceToThreshold = threshold !== null ? Math.round((onHand - threshold + Number.EPSILON) * 100) / 100 : null;

  return {
    isLowStock: isLow,
    isOutOfStock,
    threshold,
    onHand,
    varianceToThreshold,
  };
}

export function formatLowStockLabel(product: CounterProduct, onHand: number): string | null {
  if (product.kind !== 'stock') return null;
  if (onHand <= 0) return 'Out of Stock';
  if (isLowStock(product, onHand)) {
    return `Low Stock (≤ ${product.reorder_threshold})`;
  }
  return null;
}

/**
 * SERP-088 — Controlled return, refund and void.
 */
export type ReversalType = 'return' | 'void' | 'refund';
export type RefundMethod = 'cash' | 'card' | 'transfer' | 'store_credit';
export type ApprovalMode = 'manager_seat' | 'solo_capacity' | 'supervisor_override';

export interface CounterReturnItem {
  line_no: number;
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  net_amount: number;
  tax_amount: number;
  gross_amount: number;
}

export interface CounterRefundTender {
  method: RefundMethod;
  amount: number;
}

export interface CounterReturn {
  id: string;
  return_number: string;
  original_sale_id: string;
  original_sale_number?: string;
  credit_note_id: string;
  credit_note_number?: string;
  location_id: string;
  reversal_type: ReversalType;
  currency: string;
  subtotal: number;
  tax_total: number;
  total_refund_amount: number;
  items: CounterReturnItem[];
  refund_tenders: CounterRefundTender[];
  reason: string;
  approval_mode: ApprovalMode;
  approver_person_id?: string | null;
  approver_seat?: string | null;
  created_at: string;
  created_by: string;
  created_seat: string;
}

export function remainingReturnableQty(soldQty: number, previouslyReturnedQty: number): number {
  return Math.max(0, Math.round(((soldQty - previouslyReturnedQty) + Number.EPSILON) * 1000000) / 1000000);
}

export function canReturnItem(
  soldQty: number,
  previouslyReturnedQty: number,
  requestedReturnQty: number
): boolean {
  if (requestedReturnQty <= 0) return false;
  const remaining = remainingReturnableQty(soldQty, previouslyReturnedQty);
  return requestedReturnQty <= remaining;
}

export function calculateRefundTotals(tenders: CounterRefundTender[]): number {
  const sum = tenders.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  return Math.round((sum + Number.EPSILON) * 100) / 100;
}

export function formatReversalLabel(
  reversalType: ReversalType,
  returnNumber: string,
  amount: number,
  currency: string = 'MVR'
): string {
  const kindLabel = reversalType === 'void' ? 'Void' : 'Return';
  return `${kindLabel} ${returnNumber} — ${currency} ${amount.toFixed(2)}`;
}

/**
 * SERP-090 — Counter Resilience, Retry & Negative-Authorization Guardrails.
 *
 * Invariants:
 * 1. Online Server-Authoritative Only:
 *    Transactions can only be executed when online. Offline transactional selling
 *    and speculative local ledger entries are strictly prohibited.
 * 2. Idempotent Retry Safety:
 *    Failed requests due to network issues or transient server errors can be retried
 *    safely using the SAME idempotency key.
 * 3. Strict Fail-Closed Negative Auth:
 *    Unauthorized seats, unapproved segregated returns, cross-tenant access, and
 *    overselling/negative-stock all fail closed with attributable error messages.
 */

export function canTransact(isOnline: boolean): boolean {
  return isOnline === true;
}

export function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === 'string') {
    return (
      error.includes('Failed to fetch') ||
      error.includes('NetworkError') ||
      error.includes('timeout') ||
      error.includes('network_offline') ||
      error.includes('request_timeout')
    );
  }
  if (typeof error === 'object' && error !== null) {
    const errObj = error as { status?: number; code?: string; message?: string };
    if (errObj.status && [502, 503, 504].includes(errObj.status)) return true;
    if (errObj.code && ['network_offline', 'request_timeout', 'timeout'].includes(errObj.code)) return true;
    if (errObj.message && (errObj.message.includes('Failed to fetch') || errObj.message.includes('timeout'))) return true;
  }
  return false;
}

export function formatResilienceErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'seat_not_authorized':
      return 'Unauthorized seat: Your current active seat does not have permission to execute this counter operation.';
    case 'stock_insufficient':
    case 'stock_line_quantity_exceeds_onhand':
      return 'Insufficient stock on hand. Overselling is rejected; negative stock cannot be created.';
    case 'idempotency_key_conflict':
    case 'idempotency_conflict':
      return 'Idempotency conflict: This transaction key was already submitted with different details.';
    case 'reversal_approval_required':
      return 'Supervisor approval required: This return cannot be submitted without an authorized manager.';
    case 'reversal_approver_unauthorized':
      return 'Approver unauthorized: The selected approver does not hold a valid managerial seat in this organisation.';
    case 'sale_already_voided':
      return 'Sale already voided: This invoice has already been fully voided.';
    case 'cannot_void_partially_returned_sale':
      return 'Cannot void: Items from this sale have already been partially returned. Use itemized return instead.';
    case 'sale_not_found':
      return 'Sale not found: The original counter sale does not exist in this organisation.';
    case 'location_not_found':
      return 'Location not found: The specified counter location is invalid or inactive.';
    case 'no_open_session':
      return 'No open session: An active till session must be opened before trading or closing.';
    case 'counter_session_already_open':
      return 'Session already open: An active cash session already exists at this location.';
    case 'tender_insufficient':
      return 'Tender insufficient: The tendered amount is less than the required sale total.';
    case 'change_exceeds_cash':
      return 'Change exceeds cash: Change cannot exceed the cash tendered.';
    case 'network_offline':
      return 'Network offline: Counter transactions require an active connection to the server.';
    case 'request_timeout':
      return 'Request timed out: Server did not respond in time. You may retry safely using the same transaction key.';
    case 'tax_rate_unavailable':
      return 'Authoritative tax rate unavailable. Cannot complete sale for GST-registered entity without valid tax configuration.';
    case 'tax_registration_status_unknown':
      return 'Statutory tax registration unconfigured. Cannot complete sale without authoritative tax status.';
    default:
      return `Transaction rejected (${errorCode}).`;
  }
}

export interface RetryContext {
  idempotencyKey: string;
  attemptCount: number;
}

export function createRetryContext(existingKey?: string): RetryContext {
  return {
    idempotencyKey: existingKey || crypto.randomUUID(),
    attemptCount: 1,
  };
}

export function incrementRetry(context: RetryContext): RetryContext {
  return {
    idempotencyKey: context.idempotencyKey,
    attemptCount: context.attemptCount + 1,
  };
}

/**
 * SERP-445 / Founder #6860: Format the tax label for checkout totals or receipt.
 * Distinguishes registered (with rate) from not_registered.
 */
export function formatTaxLineLabel(
  status: 'registered' | 'not_registered' | null | undefined,
  ratePercent: number | null | undefined,
): string {
  if (status === 'registered') {
    return ratePercent != null ? `Estimated Tax (${ratePercent}%)` : 'Estimated Tax';
  }
  return 'Tax';
}

/**
 * SERP-445 / Founder #6860: Format the tax value for checkout totals or receipt.
 * Ensures not_registered renders an explicit row ('Not GST registered — no GST')
 * so that exempt/unregistered is clearly distinguishable from hidden tax.
 */
export function formatTaxLineValue(
  status: 'registered' | 'not_registered' | null | undefined,
  taxTotal: number,
  currency = 'MVR',
): string {
  if (status === 'registered' || taxTotal > 0) {
    return `${currency} ${taxTotal.toFixed(2)}`;
  }
  return 'Not GST registered — no GST';
}

/**
 * SERP-445 / Founder #6860: Format receipt GST details strictly from authoritative server response.
 * Server values (gst_rate_percent, gst_registration_status, tax_total) are preserved verbatim,
 * never client-recomputed.
 */
export function formatReceiptGstDetails(sale: {
  gst_rate_percent?: number | null;
  gst_rate?: number | null;
  gst_registration_status?: 'registered' | 'not_registered' | null;
  tax_total?: number | null;
}): {
  label: string;
  value: string;
  isRegistered: boolean;
  statusBadge: string;
  receiptSubtitle: string;
} {
  const isRegistered = sale.gst_registration_status === 'registered'
    || (sale.gst_registration_status !== 'not_registered' && Number(sale.tax_total ?? 0) > 0);
  const ratePct = sale.gst_rate_percent != null
    ? sale.gst_rate_percent
    : sale.gst_rate != null
      ? Math.round(Number(sale.gst_rate) * 100)
      : null;

  if (isRegistered) {
    return {
      label: ratePct != null ? `GST (${ratePct}%)` : 'GST',
      value: `MVR ${Number(sale.tax_total ?? 0).toFixed(2)}`,
      isRegistered: true,
      statusBadge: 'GST Registered',
      receiptSubtitle: 'Tax Invoice / Receipt',
    };
  }

  return {
    label: 'GST',
    value: 'Not GST registered — no GST',
    isRegistered: false,
    statusBadge: 'Not GST Registered',
    receiptSubtitle: 'Receipt (Not GST registered)',
  };
}