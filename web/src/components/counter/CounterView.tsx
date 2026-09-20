import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Minus,
  Package,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  Lock,
  Clock,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost, ApiError, dispatchCommand } from '../../services/apiGateway';
import { Button, Input, Select, Surface, Badge } from '../ui';
import {
  addToCart,
  approvedPriceFor,
  buildCounterSalePayload,
  buildTenderLines,
  calculateVariance,
  Cart,
  cartIsEmpty,
  cartItemCount,
  cartLineCount,
  CounterCatalogue,
  CounterLocation,
  CounterProduct,
  CounterSession,
  createHeldCart,
  formatVarianceLabel,
  HeldCart,
  isExpired,
  isLowStock,
  isPlausibleBarcode,
  loadCart,
  loadHolds,
  normalizeBarcodeInput,
  onHandAt,
  PaymentMethod,
  PriceResolution,
  pruneExpiredHolds,
  removeFromCart,
  resumeHeldCart,
  saveCart,
  saveHolds,
  selectableProducts,
  setCartQuantity,
  TenderLine,
  TenderMethod,
  CounterReturn,
  ReversalType,
  RefundMethod,
  formatReversalLabel,
  canTransact,
  isRetryableError,
  formatResilienceErrorMessage,
} from '../../domain/counter';

interface CounterSaleResult {
  invoice_id: string;
  invoice_number: string;
  receipt_number?: string;
  payment_id: string;
  location_id: string;
  subtotal: number;
  tax_total: number;
  total_amount: number;
  payment_method?: PaymentMethod;
  tendered_amount?: number;
  change_amount?: number;
  tender?: TenderLine[];
  lines: Array<{ product_id: string; name: string; quantity: number; unit_price: number; net_amount: number }>;
  on_hand: Record<string, number>;
}

interface CounterReceipt {
  receipt: {
    receipt_id: string;
    receipt_number: string;
    invoice_number: string;
    currency: string;
    renders: number;
    tendered_amount: number;
    change_amount: number;
    total_amount: number;
    tender: Array<{ payment_method: TenderMethod; amount_tendered: number; tender_order: number }>;
  };
}

export const CounterView: React.FC = () => {
  const { session } = useAuth();
  const [catalogue, setCatalogue] = useState<CounterCatalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [saleResult, setSaleResult] = useState<CounterSaleResult | null>(null);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // SERP-087: tender declaration — what the customer hands over per method.
  // The client computes NOTHING here: the server validates the mix against its
  // own total and returns the authoritative change on the accepted response.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [tenderInput, setTenderInput] = useState<Record<TenderMethod, string>>({ cash: '', card: '', transfer: '' });
  const [receipt, setReceipt] = useState<CounterReceipt | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  // SERP-089: Till close / Cash session state
  const [tillModalOpen, setTillModalOpen] = useState(false);
  const [tillSession, setTillSession] = useState<CounterSession | null>(null);
  const [loadingTillSession, setLoadingTillSession] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [tillNotesInput, setTillNotesInput] = useState('');
  const [closingTill, setClosingTill] = useState(false);
  const [tillCloseError, setTillCloseError] = useState<string | null>(null);
  const [closedTillResult, setClosedTillResult] = useState<CounterSession | null>(null);

  const openTillModal = async () => {
    if (!outlet?.id) return;
    setTillModalOpen(true);
    setTillCloseError(null);
    setClosedTillResult(null);
    setCountedCashInput('');
    setTillNotesInput('');
    setLoadingTillSession(true);
    try {
      const data = await apiGet<{ ok: boolean; session?: CounterSession }>(
        `/api/ops/counter/session/current?location_id=${encodeURIComponent(outlet.id)}`,
      );
      if (data.ok && data.session) {
        setTillSession(data.session);
      }
    } catch (err) {
      setTillCloseError(err instanceof ApiError ? err.code : 'session_summary_failed');
    } finally {
      setLoadingTillSession(false);
    }
  };

  const handleTillCloseSubmit = async () => {
    if (!outlet?.id) return;
    const counted = parseFloat(countedCashInput);
    if (isNaN(counted) || counted < 0) {
      setTillCloseError('Please enter a valid, non-negative counted cash amount.');
      return;
    }
    setClosingTill(true);
    setTillCloseError(null);
    try {
      const res = await apiPost<{ ok: boolean; session: CounterSession }>(
        '/api/ops/counter/session/close',
        {
          location_id: outlet.id,
          counted_cash: counted,
          notes: tillNotesInput.trim() || undefined,
        },
      );
      if (res.ok && res.session) {
        setClosedTillResult(res.session);
        setTillSession(null);
      }
    } catch (err) {
      setTillCloseError(err instanceof ApiError ? err.code : 'till_close_failed');
    } finally {
      setClosingTill(false);
    }
  };

  // SERP-090: Network resilience & online-only transaction gate
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true,
  );
  const [activeSaleKey, setActiveSaleKey] = useState<string | null>(null);
  const [activeReversalKey, setActiveReversalKey] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // SERP-088: Returns & Voids state
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [reversalType, setReversalType] = useState<ReversalType>('return');
  const [returnSaleId, setReturnSaleId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnProductId, setReturnProductId] = useState('');
  const [returnQtyInput, setReturnQtyInput] = useState('1');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash');
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [operatingCapacity, setOperatingCapacity] = useState<'segregated' | 'solo'>('segregated');
  const [approverIdInput, setApproverIdInput] = useState('');
  const [submittingReversal, setSubmittingReversal] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);
  const [reversalResult, setReversalResult] = useState<CounterReturn | null>(null);

  const handleReversalSubmit = async () => {
    if (!outlet?.id) return;
    if (!canTransact(isOnline)) {
      setReversalError('network_offline');
      return;
    }
    if (!returnSaleId.trim()) {
      setReversalError('Original Sale ID is required.');
      return;
    }
    if (returnReason.trim().length < 3) {
      setReversalError('Reason must be at least 3 characters.');
      return;
    }
    setSubmittingReversal(true);
    setReversalError(null);

    const idempotencyKey = activeReversalKey || crypto.randomUUID();
    if (!activeReversalKey) setActiveReversalKey(idempotencyKey);

    try {
      const endpoint = reversalType === 'void' ? '/api/ops/counter/void' : '/api/ops/counter/return';
      const payload: Record<string, unknown> = {
        location_id: outlet.id,
        original_sale_id: returnSaleId.trim(),
        reason: returnReason.trim(),
        operating_capacity: operatingCapacity,
      };
      if (approverIdInput.trim()) {
        payload.approver_person_id = approverIdInput.trim();
      }
      if (reversalType === 'return') {
        const qty = parseFloat(returnQtyInput);
        if (!returnProductId.trim() || isNaN(qty) || qty <= 0) {
          setReversalError('Valid Product ID and positive quantity are required for return.');
          setSubmittingReversal(false);
          return;
        }
        payload.items = [{ product_id: returnProductId.trim(), quantity: qty }];
      }
      const refundAmt = parseFloat(refundAmountInput);
      if (!isNaN(refundAmt) && refundAmt > 0) {
        payload.refund_tenders = [{ method: refundMethod, amount: refundAmt }];
      }

      const res = await apiPost<{ ok: boolean; return: CounterReturn }>(endpoint, payload, idempotencyKey);
      if (res.ok && res.return) {
        setReversalResult(res.return);
        setActiveReversalKey(null);
      }
    } catch (err) {
      setReversalError(err instanceof ApiError ? err.code : 'reversal_failed');
    } finally {
      setSubmittingReversal(false);
    }
  };

  const organisationId = session?.current_organisation_id ?? session?.person_uuid ?? '';
  const personUuid = session?.person_uuid ?? session?.person_id ?? '';

  const outlets = catalogue?.locations ?? [];
  const [outletId, setOutletId] = useState<string>('');
  const outlet: CounterLocation | undefined = outlets.find((l) => l.id === outletId) ?? outlets[0];

  const scope = useMemo(
    () => ({ organisationId, personUuid, locationId: outlet?.id ?? '' }),
    [organisationId, personUuid, outlet?.id],
  );

  const [cart, setCart] = useState<Cart>([]);
  const [holds, setHolds] = useState<HeldCart[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<CounterCatalogue>('/api/ops/counter/catalogue');
        if (data.ok) {
          setCatalogue(data);
          if (!outletId && data.locations.length > 0) {
            setOutletId(data.locations[0].id);
          }
          setCatalogueError(null);
        }
      } catch (error) {
        setCatalogueError(error instanceof ApiError ? error.code : 'counter_catalogue_unavailable');
      }
    })();
    // outletId intentionally not a dep — the catalogue drives the first outlet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outlet (and therefore tenant/outlet scope) changed, or first load: load the
  // scope's cart + holds. This is what stops one outlet's cart leaking into
  // another — every read/write is keyed by (org, person, outlet).
  useEffect(() => {
    if (!scope.organisationId || !scope.personUuid || !scope.locationId) return;
    setCart(loadCart(scope));
    setHolds(pruneExpiredHolds(loadHolds(scope), Date.now()));
    setSaleResult(null);
    setSaleError(null);
    setReceipt(null);
    setReceiptError(null);
    setSelectedProduct((current) => (current && catalogue?.products.some((p) => p.id === current) ? current : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.organisationId, scope.personUuid, scope.locationId]);

  const persistCart = (next: Cart) => {
    setCart(next);
    if (scope.organisationId && scope.personUuid && scope.locationId) {
      saveCart(scope, next);
    }
  };

  const persistHolds = (next: HeldCart[]) => {
    setHolds(next);
    if (scope.organisationId && scope.personUuid && scope.locationId) {
      saveHolds(scope, next);
    }
  };

  const products = selectableProducts(catalogue?.products ?? []);
  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.sku.toLowerCase().includes(needle) ||
        (p.barcode ?? '').toLowerCase().includes(needle),
    );
  }, [products, query]);

  const hold = () => {
    if (cartIsEmpty(cart)) return;
    const held = createHeldCart(cart, Date.now());
    persistHolds([...holds, held]);
    persistCart([]);
  };

  const resume = (held: HeldCart) => {
    persistCart(resumeHeldCart(held));
    persistHolds(holds.filter((h) => h.id !== held.id));
    setSaleResult(null);
  };

  const discard = (held: HeldCart) => {
    persistHolds(holds.filter((h) => h.id !== held.id));
  };

  const complete = async () => {
    if (!outlet || cartIsEmpty(cart)) return;
    if (!canTransact(isOnline)) {
      setSaleError('network_offline');
      return;
    }
    setCompleting(true);
    setSaleError(null);
    setSaleResult(null);
    setReceipt(null);
    setReceiptError(null);

    const idempotencyKey = activeSaleKey || crypto.randomUUID();
    if (!activeSaleKey) setActiveSaleKey(idempotencyKey);

    const tender = buildTenderLines(paymentMethod, {
      cash: Number(tenderInput.cash || 0),
      card: Number(tenderInput.card || 0),
      transfer: Number(tenderInput.transfer || 0),
    });
    try {
      const payload = buildCounterSalePayload(cart, outlet.id, {
        paymentMethod,
        tender,
      });
      const response = await dispatchCommand<Record<string, unknown>, { ok: boolean; counter_sale?: CounterSaleResult }>({
        command: 'COUNTER_SALE',
        payload,
        idempotencyKey,
      });
      // The server recomputes the total and validates the declared tender in
      // the SAME transaction. A rejected tender (insufficient / change exceeds
      // cash / bad mix) fails the whole sale closed — nothing is deducted or
      // settled. Only the accepted response's receipt + change are shown.
      if (response.ok && response.counter_sale) {
        setSaleResult(response.counter_sale);
        setActiveSaleKey(null);
        persistCart([]);
      } else {
        setSaleError('counter_sale_no_response');
      }
    } catch (error) {
      setSaleError(error instanceof ApiError ? error.code : 'counter_sale_failed');
    } finally {
      setCompleting(false);
    }
  };

  const loadReceipt = async () => {
    if (!saleResult?.payment_id) return;
    setReceiptBusy(true);
    setReceiptError(null);
    try {
      const data = await apiGet<CounterReceipt>(
        `/api/ops/counter/receipt?receipt_id=${encodeURIComponent(saleResult.payment_id)}`,
      );
      setReceipt(data);
    } catch (error) {
      setReceiptError(error instanceof ApiError ? error.code : 'receipt_load_failed');
    } finally {
      setReceiptBusy(false);
    }
  };

  const reRenderReceipt = async () => {
    if (!saleResult?.payment_id) return;
    setReceiptBusy(true);
    setReceiptError(null);
    try {
      // Duplicate-proof: the server increments renders on the SAME financial
      // record (same receipt_number — never a second document), then we re-fetch.
      await apiPost<{ ok: boolean; renders: number }>('/api/ops/counter/receipt/render', {
        receipt_id: saleResult.payment_id,
      });
      const data = await apiGet<CounterReceipt>(
        `/api/ops/counter/receipt?receipt_id=${encodeURIComponent(saleResult.payment_id)}`,
      );
      setReceipt(data);
    } catch (error) {
      setReceiptError(error instanceof ApiError ? error.code : 'receipt_render_failed');
    } finally {
      setReceiptBusy(false);
    }
  };

  /**
   * SERP-086 barcode lookup. The client sends ONLY the scanned identifier to
   * /api/ops/counter/resolve; the server (api_counter_price_resolution) decides
   * the approved unit price. A fail-closed resolution (resolved:false,
   * stock_line_no_price) is surfaced to the operator — never invented client-side.
   */
  const resolveScan = async (raw: string) => {
    const normalized = normalizeBarcodeInput(raw);
    setScanInput(normalized);
    if (!isPlausibleBarcode(normalized)) {
      setScanError('barcode_scan_invalid');
      return;
    }
    setScanning(true);
    setScanError(null);
    try {
      const resolution = await apiGet<PriceResolution>(
        `/api/ops/counter/resolve?barcode=${encodeURIComponent(normalized)}`,
      );
      if (resolution.ok && resolution.resolution && resolution.product) {
        setSelectedProduct(resolution.product.id);
        persistCart(addToCart(cart, resolution.product.id, 1));
        setScanInput('');
      } else {
        setScanError(resolution.price?.reason ?? 'barcode_not_found');
      }
    } catch (error) {
      setScanError(error instanceof ApiError ? error.code : 'barcode_resolve_failed');
    } finally {
      setScanning(false);
    }
  };

  if (catalogueError) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Surface variant="outlined" padding="lg">
          <div role="alert" className="flex items-start gap-3">
            <AlertTriangle size={20} style={{ color: 'var(--md-sys-color-error)' }} aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--md-sys-color-on-surface)' }}>Counter unavailable</p>
              <p className="text-xs mt-1" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Could not load the counter catalogue ({catalogueError}).
              </p>
            </div>
          </div>
        </Surface>
      </div>
    );
  }

  if (!catalogue) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
        Loading counter…
      </div>
    );
  }

  const availableProducts = filteredProducts
    .map((product) => {
      const onHand = onHandAt(catalogue.on_hand, outlet?.id ?? '', product.id);
      const cartLine = cart.find((line) => line.productId === product.id);
      const approved = approvedPriceFor(catalogue.prices, product.id);
      const isLow = isLowStock(product, onHand);
      return { product, onHand, inCart: cartLine?.quantity ?? 0, approved, isLow };
    })
    .filter((entry) => !filterLowStockOnly || entry.isLow || entry.onHand <= 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {!isOnline && (
        <div
          role="alert"
          className="mb-4 p-3.5 rounded-lg flex items-center justify-between gap-3 text-sm font-medium"
          style={{
            backgroundColor: 'var(--md-sys-color-error-container, #fde8e8)',
            color: 'var(--md-sys-color-on-error-container, #9b1c1c)',
            border: '1px solid var(--md-sys-color-error, #f05252)',
          }}
        >
          <div className="flex items-center gap-2">
            <WifiOff size={18} aria-hidden="true" />
            <span>
              <strong>Counter POS is Online-Only</strong> — Transactions cannot be processed while offline. Reconnect to the network to trade.
            </span>
          </div>
          <Badge variant="destructive" size="sm">Offline</Badge>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
          >
            <Store size={20} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--md-sys-color-on-surface)' }}>Counter</h1>
            <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              {outlet?.name ?? 'No outlet'} — cart & holds are scoped to this outlet
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {outlets.length > 1 && (
            <div className="w-full sm:w-56">
              <Select
                label="Outlet"
                aria-label="Outlet"
                value={outletId}
                onChange={(event) => setOutletId(event.target.value)}
                options={outlets.map((l) => ({ value: l.id, label: l.name }))}
              />
            </div>
          )}
          <Button
            size="sm"
            variant="outlined"
            disabled={!canTransact(isOnline)}
            onClick={() => {
              setReturnModalOpen(true);
              setReversalResult(null);
              setReversalError(null);
            }}
            icon={<RotateCcw size={14} aria-hidden="true" />}
            aria-label="Return or Void"
          >
            Return / Void
          </Button>
          <Button
            size="sm"
            variant="outlined"
            onClick={openTillModal}
            icon={<Lock size={14} aria-hidden="true" />}
            aria-label="Close Till"
          >
            Till Close
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Catalogue */}
        <div className="lg:col-span-2 space-y-4">
          <Surface variant="elevated" padding="md">
            <div className="flex flex-col gap-3">
              {/* SERP-086: barcode scan into the counter. Identifier in, server
                  resolves the approved price; the client never prices an item. */}
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void resolveScan(scanInput);
                }}
              >
                <Input
                  aria-label="Scan or type a barcode"
                  placeholder="Scan barcode…"
                  value={scanInput}
                  onChange={(event) => setScanInput(event.target.value)}
                  disabled={scanning}
                  onBlur={() => {
                    if (scanInput && !scanning) void resolveScan(scanInput);
                  }}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="filled"
                  disabled={scanning || !isPlausibleBarcode(normalizeBarcodeInput(scanInput))}
                  loading={scanning}
                >
                  Add
                </Button>
              </form>
              {scanError && (
                <p role="alert" className="text-[11px] font-medium" style={{ color: 'var(--md-sys-color-error)' }}>
                  Scan rejected: {scanError}. No price was resolved.
                </p>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    aria-label="Search products"
                    placeholder="Search by name, SKU or barcode"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    icon={<Search size={16} aria-hidden="true" />}
                  />
                </div>
                <Button
                  size="sm"
                  variant={filterLowStockOnly ? 'filled' : 'outlined'}
                  onClick={() => setFilterLowStockOnly((prev) => !prev)}
                  aria-pressed={filterLowStockOnly}
                  aria-label="Toggle low stock filter"
                >
                  {filterLowStockOnly ? 'Low Stock Only ✓' : 'Low Stock Only'}
                </Button>
              </div>
              <div
                className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[52vh] overflow-y-auto erp-scroll-region"
                role="region"
                aria-label="Product grid"
              >
                {availableProducts.map(({ product, onHand, inCart, approved, isLow }) => {
                  const selected = selectedProduct === product.id;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProduct(product.id)}
                      onDoubleClick={() => persistCart(addToCart(cart, product.id, 1))}
                      aria-pressed={selected}
                      style={{
                        backgroundColor: selected
                          ? 'var(--md-sys-color-secondary-container)'
                          : 'var(--md-sys-color-surface-container-low)',
                        color: 'var(--md-sys-color-on-surface)',
                        border: selected
                          ? '1px solid var(--md-sys-color-primary)'
                          : isLow
                            ? '1px solid var(--md-sys-color-warning, #f59e0b)'
                            : '1px solid var(--md-sys-color-outline-variant)',
                        borderRadius: 'var(--md-sys-shape-corner-medium)',
                      }}
                      className="flex flex-col items-start gap-1 px-3 py-3 text-left min-h-[76px] transition-colors"
                    >
                      <span className="text-xs font-semibold leading-tight line-clamp-2">{product.name}</span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        {product.sku}
                      </span>
                      {product.barcode && (
                        <span className="text-[10px] font-mono" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          {product.barcode}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 mt-auto flex-wrap">
                        {approved && approved.source !== 'none' && approved.unit_amount > 0 ? (
                          <Badge variant="info">
                            MVR {Number(approved.unit_amount).toFixed(2)}
                            {approved.source === 'price_list_override' ? ' (list)' : ''}
                          </Badge>
                        ) : (
                          <Badge variant="neutral">no approved price</Badge>
                        )}
                        <Badge variant={onHand > 0 ? 'positive' : 'warning'} dot>{onHand} in stock</Badge>
                        {isLow && onHand > 0 && (
                          <Badge variant="warning">Low (≤ {product.reorder_threshold})</Badge>
                        )}
                        {onHand <= 0 && (
                          <Badge variant="destructive">Out of stock</Badge>
                        )}
                        {inCart > 0 && <Badge variant="info">in cart ×{inCart}</Badge>}
                      </span>
                    </button>
                  );
                })}
                {availableProducts.length === 0 && (
                  <p className="text-xs col-span-full py-8 text-center" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    {filterLowStockOnly ? 'No low-stock products at this outlet.' : `No products match “${query}”.`}
                  </p>
                )}
              </div>
            </div>
          </Surface>

          {/* Holds */}
          {holds.length > 0 && (
            <Surface variant="elevated" padding="md">
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                Held carts{holds.length > 0 ? ` (${holds.filter((h) => !isExpired(h, now)).length} active)` : ''}
              </h2>
              <div className="space-y-2">
                {holds.map((held) => {
                  const expired = isExpired(held, now);
                  const remainingMs = Date.parse(held.expiresAt) - now;
                  const minutes = Math.max(0, Math.ceil(remainingMs / 60000));
                  return (
                    <div
                      key={held.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl"
                      style={{
                        backgroundColor: expired
                          ? 'var(--md-sys-color-surface-container)'
                          : 'var(--md-sys-color-surface-container-lowest)',
                        border: `1px solid ${expired ? 'var(--md-sys-color-outline-variant)' : 'var(--md-sys-color-outline)'}`,
                        opacity: expired ? 0.6 : 1,
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                          {cartLineCount(held.cart)} line(s), {cartItemCount(held.cart)} item(s)
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          {expired ? 'Expired' : `${minutes} min remaining`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={expired ? 'neutral' : 'warning'} dot>{expired ? 'expired' : 'held'}</Badge>
                        <Button size="sm" variant="tonal" disabled={expired} onClick={() => resume(held)} icon={<RotateCcw size={14} aria-hidden="true" />}>
                          Resume
                        </Button>
                        <Button size="sm" variant="text" onClick={() => discard(held)} icon={<Trash2 size={14} aria-hidden="true" />}>
                          Discard
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Surface>
          )}
        </div>

        {/* Cart */}
        <div className="space-y-4">
          <Surface variant="elevated" padding="md">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                <ShoppingCart size={16} aria-hidden="true" /> Cart
              </h2>
              {!cartIsEmpty(cart) && (
                <Badge variant="neutral">{cartLineCount(cart)} line(s) · {cartItemCount(cart)} item(s)</Badge>
              )}
            </div>

            {cartIsEmpty(cart) ? (
              <div
                className="flex flex-col items-center justify-center py-10 text-center rounded-xl"
                style={{ border: '1px dashed var(--md-sys-color-outline-variant)' }}
              >
                <Package size={28} style={{ color: 'var(--md-sys-color-outline)' }} aria-hidden="true" />
                <p className="text-xs mt-3" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Select a product to start. Totals are resolved server-side when the sale completes.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[44vh] overflow-y-auto erp-scroll-region">
                {cart.map((line) => {
                  const product = catalogue.products.find((p) => p.id === line.productId);
                  const onHand = onHandAt(catalogue.on_hand, outlet?.id ?? '', line.productId);
                  const approved = approvedPriceFor(catalogue.prices, line.productId);
                  const short = line.quantity > onHand;
                  return (
                    <div
                      key={line.productId}
                      className="flex items-center gap-2 p-2 rounded-xl"
                      style={{ border: `1px solid ${short ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-outline-variant)'}` }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                          {product?.name ?? line.productId}
                        </p>
                        {approved && approved.source !== 'none' && approved.unit_amount > 0 && (
                          <p className="text-[10px] font-mono" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                            MVR {Number(approved.unit_amount).toFixed(2)}
                            {approved.source === 'price_list_override' ? ' · list' : ''}
                            {approved.discount_percent > 0 ? ` · −${approved.discount_percent}%` : ''}
                          </p>
                        )}
                        {short && (
                          <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--md-sys-color-error)' }}>
                            <AlertTriangle size={10} aria-hidden="true" /> only {onHand} in stock
                          </p>
                        )}
                        {!short && product && isLowStock(product, onHand) && (
                          <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--md-sys-color-warning, #d97706)' }}>
                            <AlertTriangle size={10} aria-hidden="true" /> Low stock: {onHand} on hand (threshold: {product.reorder_threshold})
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="xs" variant="outlined" aria-label={`Decrease ${product?.name ?? 'item'}`}
                          onClick={() => persistCart(setCartQuantity(cart, line.productId, line.quantity - 1))}
                          icon={<Minus size={12} aria-hidden="true" />} />
                        <span className="w-8 text-center text-xs font-semibold tabular-nums" aria-label="quantity">
                          {line.quantity}
                        </span>
                        <Button size="xs" variant="outlined" aria-label={`Increase ${product?.name ?? 'item'}`}
                          onClick={() => persistCart(addToCart(cart, line.productId, 1))}
                          icon={<Plus size={12} aria-hidden="true" />} />
                        <Button size="xs" variant="text" aria-label={`Remove ${product?.name ?? 'item'}`}
                          onClick={() => persistCart(removeFromCart(cart, line.productId))}
                          icon={<Trash2 size={13} aria-hidden="true" />} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-2 mt-4">
              <div role="group" aria-label="Tender">
                <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Tender — declare what was handed over; totals &amp; change are server-authoritative
                </p>
                <div className="flex gap-1.5 mb-2">
                  {(['cash', 'card', 'transfer', 'mixed'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      aria-pressed={paymentMethod === method}
                      onClick={() => setPaymentMethod(method)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-full capitalize transition-colors"
                      style={{
                        backgroundColor: paymentMethod === method
                          ? 'var(--md-sys-color-primary)'
                          : 'var(--md-sys-color-surface-container-high)',
                        color: paymentMethod === method
                          ? 'var(--md-sys-color-on-primary)'
                          : 'var(--md-sys-color-on-surface)',
                        border: `1px solid ${paymentMethod === method ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}`,
                      }}
                    >
                      {method}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['cash', 'card', 'transfer'] as const)
                    .filter((m) => paymentMethod === 'mixed' || paymentMethod === m)
                    .map((m) => (
                      <Input
                        key={m}
                        aria-label={`${m} tendered`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        placeholder={`${m} tendered`}
                        className="w-[9.5rem] shrink-0"
                        value={tenderInput[m] ?? ''}
                        onChange={(e) => setTenderInput((t) => ({ ...t, [m]: e.target.value }))}
                      />
                    ))}
                </div>
              </div>
              <Button variant="tonal" disabled={cartIsEmpty(cart) || !canTransact(isOnline)} onClick={hold} icon={<ShoppingCart size={15} aria-hidden="true" />}>
                Hold cart
              </Button>
              <Button variant="filled" loading={completing} disabled={cartIsEmpty(cart) || !outlet || completing || !canTransact(isOnline)}
                onClick={complete} icon={<CheckCircle2 size={15} aria-hidden="true" />}>
                Complete sale
              </Button>
              {saleError && (
                <div className="space-y-2 mt-1">
                  <p role="alert" className="text-[11px] font-medium" style={{ color: 'var(--md-sys-color-error)' }}>
                    Sale rejected: {formatResilienceErrorMessage(saleError)}. Nothing was deducted — the server failed the transaction closed.
                  </p>
                  {isRetryableError(saleError) && (
                    <Button
                      size="sm"
                      variant="outlined"
                      onClick={complete}
                      loading={completing}
                      icon={<RefreshCw size={13} aria-hidden="true" />}
                    >
                      Retry sale (idempotent)
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Surface>

          {saleResult && (
            <Surface variant="elevated" padding="md" style={{ border: '1px solid var(--positive-subtle)' }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={18} style={{ color: 'var(--positive)' }} aria-hidden="true" />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  Sale complete
                </h2>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Invoice <span className="font-mono font-semibold">{saleResult.invoice_number}</span> settled.
                These totals are the server-authoritative values from the sale transaction.
              </p>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Subtotal</span>
                  <span className="font-semibold tabular-nums">MVR {Number(saleResult.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Tax</span>
                  <span className="font-semibold tabular-nums">MVR {Number(saleResult.tax_total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
                  <span className="font-semibold">Total</span>
                  <span className="font-bold tabular-nums">MVR {Number(saleResult.total_amount).toFixed(2)}</span>
                </div>
                {saleResult.tendered_amount !== undefined && (
                  <>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Tendered</span>
                      <span className="font-semibold tabular-nums">MVR {Number(saleResult.tendered_amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        Change{Number(saleResult.change_amount ?? 0) > 0 ? '' : ' (none)'}
                      </span>
                      <span className="font-semibold tabular-nums">MVR {Number(saleResult.change_amount ?? 0).toFixed(2)}</span>
                    </div>
                  </>
                )}
                {saleResult.receipt_number && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Receipt</span>
                    <span className="font-mono font-semibold">{saleResult.receipt_number}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="tonal" loading={receiptBusy} onClick={loadReceipt} icon={<Receipt size={14} aria-hidden="true" />}>
                  View receipt
                </Button>
                <Button size="sm" variant="outlined" disabled={!receipt} onClick={reRenderReceipt} icon={<Copy size={14} aria-hidden="true" />}>
                  Re-print (duplicate)
                </Button>
              </div>
              {receiptError && (
                <p role="alert" className="text-[11px] font-medium mt-2" style={{ color: 'var(--md-sys-color-error)' }}>
                  Receipt unavailable: {receiptError}
                </p>
              )}
              {receipt && (
                <div className="mt-3 p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Receipt {receipt.receipt.receipt_number}</span>
                    <Badge variant="neutral">rendered ×{receipt.receipt.renders}</Badge>
                  </div>
                  {receipt.receipt.tender.map((leg) => (
                    <div key={leg.payment_method} className="flex justify-between mt-1">
                      <span className="capitalize" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{leg.payment_method}</span>
                      <span className="tabular-nums">MVR {Number(leg.amount_tendered).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between mt-1">
                    <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Change</span>
                    <span className="tabular-nums">MVR {Number(receipt.receipt.change_amount).toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-[10px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Duplicate-proof: every re-print reuses receipt {receipt.receipt.receipt_number} — one financial record per sale.
                  </p>
                </div>
              )}
            </Surface>
          )}
        </div>
      </div>

      {tillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="w-full max-w-lg">
            <Surface variant="elevated" padding="lg" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lock size={18} style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true" />
                  <h2 className="text-base font-semibold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    Cash Session & Till Close
                  </h2>
                </div>
                <Button
                  size="sm"
                  variant="text"
                  onClick={() => setTillModalOpen(false)}
                  aria-label="Close dialog"
                >
                  ✕
                </Button>
              </div>

              {loadingTillSession ? (
                <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Loading session details…</p>
              ) : closedTillResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--positive-subtle)', color: 'var(--positive)' }}>
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span className="text-xs font-semibold">Till Session Closed Successfully</span>
                  </div>
                  <div className="text-xs space-y-1.5 p-3 rounded-lg" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Session No</span>
                      <span className="font-mono font-semibold">{closedTillResult.session_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Opening Float</span>
                      <span className="font-semibold tabular-nums">{closedTillResult.currency} {Number(closedTillResult.opening_float).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Cash Sales (Net)</span>
                      <span className="font-semibold tabular-nums">{closedTillResult.currency} {Number(closedTillResult.cash_sales_amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
                      <span className="font-semibold">Expected Cash</span>
                      <span className="font-bold tabular-nums">{closedTillResult.currency} {Number(closedTillResult.expected_cash).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Counted Cash</span>
                      <span className="font-bold tabular-nums">{closedTillResult.currency} {Number(closedTillResult.counted_cash ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1 border-t" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
                      <span>Variance</span>
                      <span className="tabular-nums" style={{ color: (closedTillResult.variance_amount ?? 0) === 0 ? 'var(--positive)' : 'var(--md-sys-color-error)' }}>
                        {formatVarianceLabel(closedTillResult.variance_amount ?? 0, closedTillResult.currency)}
                      </span>
                    </div>
                    {closedTillResult.notes && (
                      <div className="pt-2 text-[11px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        <span className="font-medium">Note:</span> {closedTillResult.notes}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => setTillModalOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs space-y-1.5 p-3 rounded-lg" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Outlet</span>
                      <span className="font-semibold">{outlet?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Opening Float</span>
                      <span className="font-semibold tabular-nums">
                        {tillSession?.currency ?? 'MVR'} {Number(tillSession?.opening_float ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Cash Sales (Net of change)</span>
                      <span className="font-semibold tabular-nums">
                        {tillSession?.currency ?? 'MVR'} {Number(tillSession?.cash_sales_amount ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
                      <span className="font-semibold">Expected Cash in Till</span>
                      <span className="font-bold tabular-nums">
                        {tillSession?.currency ?? 'MVR'} {Number(tillSession?.expected_cash ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      Counted Cash in Drawer
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={countedCashInput}
                      onChange={(e) => setCountedCashInput(e.target.value)}
                      aria-label="Counted Cash in Drawer"
                    />
                  </div>

                  {countedCashInput !== '' && !isNaN(parseFloat(countedCashInput)) && (
                    <div className="p-2.5 rounded-lg text-xs flex justify-between items-center" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
                      <span className="font-medium">Calculated Variance:</span>
                      <span className="font-bold tabular-nums">
                        {formatVarianceLabel(
                          calculateVariance(tillSession?.expected_cash ?? 0, parseFloat(countedCashInput)),
                          tillSession?.currency ?? 'MVR'
                        )}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      Reason / Notes (Auditable)
                    </label>
                    <Input
                      placeholder="e.g. End of day shift close, coin shortage explanation..."
                      value={tillNotesInput}
                      onChange={(e) => setTillNotesInput(e.target.value)}
                      aria-label="Till Close Notes"
                    />
                  </div>

                  {tillCloseError && (
                    <p role="alert" className="text-xs font-medium" style={{ color: 'var(--md-sys-color-error)' }}>
                      {tillCloseError}
                    </p>
                  )}

                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outlined" onClick={() => setTillModalOpen(false)} disabled={closingTill}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleTillCloseSubmit}
                      loading={closingTill}
                      disabled={countedCashInput === '' || isNaN(parseFloat(countedCashInput))}
                    >
                      Close Till & Record Variance
                    </Button>
                  </div>
                </div>
              )}
            </Surface>
          </div>
        </div>
      )}

      {returnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="w-full max-w-lg">
            <Surface variant="elevated" padding="lg" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <RotateCcw size={18} style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true" />
                  <h2 className="text-base font-semibold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    Controlled Return & Void (SERP-088)
                  </h2>
                </div>
                <Button
                  size="sm"
                  variant="text"
                  onClick={() => setReturnModalOpen(false)}
                  aria-label="Close dialog"
                >
                  ✕
                </Button>
              </div>

              {reversalResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--positive-subtle)', color: 'var(--positive)' }}>
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span className="text-xs font-semibold">Reversal Processed Successfully</span>
                  </div>
                  <div className="text-xs space-y-1.5 p-3 rounded-lg" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Return Number</span>
                      <span className="font-mono font-semibold">{reversalResult.return_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Type</span>
                      <span className="font-semibold uppercase">{reversalResult.reversal_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Credit Note</span>
                      <span className="font-mono font-semibold">{reversalResult.credit_note_number ?? reversalResult.credit_note_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Total Refund</span>
                      <span className="font-bold tabular-nums">{reversalResult.currency} {Number(reversalResult.total_refund_amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Approval Mode</span>
                      <span className="font-medium">{reversalResult.approval_mode}</span>
                    </div>
                    <div className="pt-1 border-t text-[11px]" style={{ borderColor: 'var(--md-sys-color-outline-variant)', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      <span className="font-medium">Reason:</span> {reversalResult.reason}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => setReturnModalOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={reversalType === 'return' ? 'primary' : 'outlined'}
                      onClick={() => setReversalType('return')}
                    >
                      Itemized Return
                    </Button>
                    <Button
                      size="sm"
                      variant={reversalType === 'void' ? 'primary' : 'outlined'}
                      onClick={() => setReversalType('void')}
                    >
                      Void Entire Sale
                    </Button>
                  </div>

                  <Input
                    label="Original Sale ID (UUID)"
                    aria-label="Original Sale ID"
                    placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                    value={returnSaleId}
                    onChange={(e) => setReturnSaleId(e.target.value)}
                  />

                  {reversalType === 'return' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Input
                          label="Product ID"
                          aria-label="Product ID"
                          placeholder="Product UUID"
                          value={returnProductId}
                          onChange={(e) => setReturnProductId(e.target.value)}
                        />
                      </div>
                      <div>
                        <Input
                          label="Quantity"
                          aria-label="Return Quantity"
                          type="number"
                          min="1"
                          value={returnQtyInput}
                          onChange={(e) => setReturnQtyInput(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Select
                        label="Refund Method"
                        aria-label="Refund Method"
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                        options={[
                          { value: 'cash', label: 'Cash' },
                          { value: 'card', label: 'Card' },
                          { value: 'transfer', label: 'Bank Transfer' },
                          { value: 'store_credit', label: 'Store Credit' },
                        ]}
                      />
                    </div>
                    <div>
                      <Input
                        label="Refund Amount (optional override)"
                        aria-label="Refund Amount"
                        type="number"
                        placeholder="Auto"
                        value={refundAmountInput}
                        onChange={(e) => setRefundAmountInput(e.target.value)}
                      />
                    </div>
                  </div>

                  <Input
                    label="Reason for Return / Void"
                    aria-label="Reason"
                    placeholder="e.g. Defective part / Customer cancelled / Wrong item"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                  />

                  <div className="space-y-2 pt-1 border-t" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>Operating Capacity (SERP-030)</span>
                      <Select
                        aria-label="Operating Capacity"
                        value={operatingCapacity}
                        onChange={(e) => setOperatingCapacity(e.target.value as 'segregated' | 'solo')}
                        options={[
                          { value: 'segregated', label: 'Segregated (Requires Approval)' },
                          { value: 'solo', label: 'Solo Operator (Compensated)' },
                        ]}
                      />
                    </div>
                    {operatingCapacity === 'segregated' && (
                      <Input
                        label="Supervisor Approver Person ID (UUID)"
                        aria-label="Supervisor Approver Person ID"
                        placeholder="Manager / Director Person UUID"
                        value={approverIdInput}
                        onChange={(e) => setApproverIdInput(e.target.value)}
                      />
                    )}
                  </div>

                  {reversalError && (
                    <div className="space-y-1.5">
                      <p role="alert" className="text-xs font-medium" style={{ color: 'var(--md-sys-color-error)' }}>
                        {formatResilienceErrorMessage(reversalError)}
                      </p>
                      {isRetryableError(reversalError) && (
                        <Button
                          size="sm"
                          variant="outlined"
                          onClick={handleReversalSubmit}
                          loading={submittingReversal}
                          icon={<RefreshCw size={13} aria-hidden="true" />}
                        >
                          Retry {reversalType === 'void' ? 'Void' : 'Return'} (idempotent)
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outlined" onClick={() => setReturnModalOpen(false)} disabled={submittingReversal}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleReversalSubmit}
                      loading={submittingReversal}
                      disabled={!returnSaleId.trim() || returnReason.trim().length < 3 || !canTransact(isOnline)}
                    >
                      Process {reversalType === 'void' ? 'Void' : 'Return'}
                    </Button>
                  </div>
                </div>
              )}
            </Surface>
          </div>
        </div>
      )}
    </div>
  );
};