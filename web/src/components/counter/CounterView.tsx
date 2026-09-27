import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  LayoutDashboard,
  Lock,
  Minus,
  Package,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Unlock,
  User,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost, ApiError, dispatchCommand } from '../../services/apiGateway';
import { Button, Input, Select, Surface, Badge } from '../ui';
import {
  addToCart,
  ApprovedPriceRow,
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
  calculateEstimatedTax,
  isTaxRateMissingForSale,
  formatTaxLineLabel,
  formatTaxLineValue,
  formatReceiptGstDetails,
  CounterPrintStatus,
  evaluatePrinterOutcome,
  formatPrinterFailureNotice,
} from '../../domain/counter';

const DEFAULT_OUTLET: CounterLocation = {
  id: '00000000-0000-4000-8000-000000000010',
  code: 'MAIN',
  name: 'Main POS Counter',
  kind: 'outlet',
  active: true,
};

const DEFAULT_RETAIL_PRODUCTS: CounterProduct[] = [
  { id: 'prod-coca-cola', sku: 'COLA-330', name: 'Coca-Cola 330ml Can', category: 'Beverages', barcode: '5449000000996', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 10 },
  { id: 'prod-sprite', sku: 'SPRITE-330', name: 'Sprite 330ml Can', category: 'Beverages', barcode: '5449000014528', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 10 },
  { id: 'prod-taza-water', sku: 'TAZA-500', name: 'Taza Mineral Water 500ml', category: 'Beverages', barcode: '6291000000111', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 20 },
  { id: 'prod-redbull', sku: 'REDBULL-250', name: 'Red Bull Energy Drink 250ml', category: 'Beverages', barcode: '9002490100070', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 10 },
  { id: 'prod-lays-chips', sku: 'LAYS-CLASSIC', name: 'Lays Classic Potato Chips 50g', category: 'Snacks', barcode: '8901491101837', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 10 },
  { id: 'prod-pringles', sku: 'PRINGLES-SC', name: 'Pringles Sour Cream & Onion 107g', category: 'Snacks', barcode: '8886467100017', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 8 },
  { id: 'prod-oreo', sku: 'OREO-133', name: 'Oreo Original Sandwich Cookies 133g', category: 'Snacks', barcode: '8901030000001', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 10 },
  { id: 'prod-bajiya', sku: 'BAJIYA-PC', name: 'Maldivian Fish Bajiya (Fresh)', category: 'Bakery', barcode: '2000000000014', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 15 },
  { id: 'prod-fishroll', sku: 'FISHROLL-PC', name: 'Spicy Fish Roll (Fresh)', category: 'Bakery', barcode: '2000000000021', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 15 },
  { id: 'prod-almudhish', sku: 'ALMUDHISH-400', name: 'Al Mudhish Milk Powder 400g', category: 'Groceries', barcode: '6084000001018', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 5 },
  { id: 'prod-dilmah-tea', sku: 'DILMAH-100', name: 'Dilmah Ceylon Tea Bags 100s', category: 'Groceries', barcode: '9312631100012', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 5 },
  { id: 'prod-basmati-rice', sku: 'RICE-1KG', name: 'Premium Basmati Rice 1kg', category: 'Groceries', barcode: '8901234567890', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 10 },
  { id: 'prod-panadol', sku: 'PANADOL-10', name: 'Panadol Extra 500mg 10s', category: 'Essentials', barcode: '5000000000019', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 10 },
  { id: 'prod-dettol-soap', sku: 'DETTOL-100', name: 'Dettol Original Soap 100g', category: 'Essentials', barcode: '5000000000026', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 10 },
  { id: 'prod-usbc-cable', sku: 'USBC-CABLE', name: 'Fast USB-C Braided Cable 1m', category: 'Electronics', barcode: '6934177700019', kind: 'stock', sale_allowed: true, active: true, reorder_threshold: 5 },
];

const DEFAULT_PRICES: ApprovedPriceRow[] = [
  { product_id: 'prod-coca-cola', source: 'product_prices', unit_amount: 15, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-sprite', source: 'product_prices', unit_amount: 15, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-taza-water', source: 'product_prices', unit_amount: 7, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-redbull', source: 'product_prices', unit_amount: 35, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-lays-chips', source: 'product_prices', unit_amount: 22, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-pringles', source: 'product_prices', unit_amount: 48, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-oreo', source: 'product_prices', unit_amount: 18, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-bajiya', source: 'product_prices', unit_amount: 5, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-fishroll', source: 'product_prices', unit_amount: 6, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-almudhish', source: 'product_prices', unit_amount: 65, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-dilmah-tea', source: 'product_prices', unit_amount: 45, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-basmati-rice', source: 'product_prices', unit_amount: 38, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-panadol', source: 'product_prices', unit_amount: 25, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-dettol-soap', source: 'product_prices', unit_amount: 14, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  { product_id: 'prod-usbc-cable', source: 'product_prices', unit_amount: 65, discount_percent: 0, price_list_version: null, currency: 'MVR' },
];

const DEFAULT_ON_HAND = DEFAULT_RETAIL_PRODUCTS.map((p) => ({
  organisation_id: '10000000-0000-4000-8000-000000000001',
  location_id: DEFAULT_OUTLET.id,
  product_id: p.id,
  derived_quantity: 45,
}));

interface CounterSaleResult {
  invoice_id: string;
  invoice_number: string;
  receipt_number?: string;
  payment_id: string;
  location_id: string;
  currency?: string;
  subtotal: number;
  tax_total: number;
  total_amount: number;
  gst_rate?: number | null;
  gst_rate_percent?: number | null;
  gst_registration_status?: 'registered' | 'not_registered' | null;
  is_taxable?: boolean;
  payment_method?: PaymentMethod;
  tendered_amount?: number;
  change_amount?: number;
  tender?: TenderLine[];
  lines: Array<{
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    net_amount: number;
    tax_rate?: number;
    tax_amount?: number;
  }>;
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
  const navigate = useNavigate();
  const { session } = useAuth();
  const [catalogue, setCatalogue] = useState<CounterCatalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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
  const [printStatus, setPrintStatus] = useState<CounterPrintStatus>('idle');
  const [printError, setPrintError] = useState<string | null>(null);

  // SERP-089: Till session lifecycle (Open & Close)
  const [openTillModalOpen, setOpenTillModalOpen] = useState(false);
  const [openingFloatInput, setOpeningFloatInput] = useState('0.00');
  const [openingTill, setOpeningTill] = useState(false);
  const [openTillError, setOpenTillError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<CounterSession | null>(null);
  const [hasOpenSession, setHasOpenSession] = useState<boolean | null>(null);

  const [tillModalOpen, setTillModalOpen] = useState(false);
  const [tillSession, setTillSession] = useState<CounterSession | null>(null);
  const [loadingTillSession, setLoadingTillSession] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [tillNotesInput, setTillNotesInput] = useState('');
  const [closingTill, setClosingTill] = useState(false);
  const [tillCloseError, setTillCloseError] = useState<string | null>(null);
  const [closedTillResult, setClosedTillResult] = useState<CounterSession | null>(null);

  const openOpenTillModal = () => {
    setOpenTillModalOpen(true);
    setOpenTillError(null);
    setOpeningFloatInput('0.00');
  };

  const handleOpenTillSubmit = async () => {
    if (!outlet?.id) return;
    const openingFloat = parseFloat(openingFloatInput || '0');
    if (isNaN(openingFloat) || openingFloat < 0) {
      setOpenTillError('Please enter a valid, non-negative opening cash float.');
      return;
    }
    setOpeningTill(true);
    setOpenTillError(null);
    try {
      const res = await apiPost<{ ok: boolean; session: CounterSession; idempotent_replay?: boolean }>(
        '/api/ops/counter/session/open',
        {
          location_id: outlet.id,
          opening_float: openingFloat,
        },
      );
      if (res.ok && res.session) {
        setActiveSession(res.session);
        setHasOpenSession(true);
        setOpenTillModalOpen(false);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'counter_session_already_open') {
        setHasOpenSession(true);
        setOpenTillModalOpen(false);
      } else {
        setOpenTillError(err instanceof ApiError ? err.code : 'open_till_failed');
      }
    } finally {
      setOpeningTill(false);
    }
  };

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
        setActiveSession(null);
        setHasOpenSession(false);
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
  const completingRef = useRef(false);
  const activeSaleKeyRef = useRef<string | null>(null);
  const submittingReversalRef = useRef(false);
  const activeReversalKeyRef = useRef<string | null>(null);

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
  interface SaleLookupItem {
    line_no: number;
    product_id: string;
    description: string;
    quantity: number;
    returned_quantity: number;
    remaining_quantity: number;
    unit_price: number;
    net_amount: number;
    tax_amount: number;
    gross_amount: number;
  }

  interface SaleLookupResult {
    sale_id: string;
    invoice_number: string;
    receipt_number?: string | null;
    receipt_id?: string | null;
    created_at: string;
    currency: string;
    gross_total: number;
    tax_total: number;
    net_total: number;
    is_fully_voided: boolean;
    lines: SaleLookupItem[];
    prior_returns: any[];
  }

  interface SupervisorInfo {
    person_id: string;
    name: string;
    seat: string;
  }

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [reversalType, setReversalType] = useState<ReversalType>('return');
  const [returnSearchQuery, setReturnSearchQuery] = useState('');
  const [searchingSale, setSearchingSale] = useState(false);
  const [lookedUpSale, setLookedUpSale] = useState<SaleLookupResult | null>(null);
  const [selectedReturnItems, setSelectedReturnItems] = useState<Record<string, { selected: boolean; qty: number }>>({});
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash');
  const [operatingCapacity, setOperatingCapacity] = useState<'segregated' | 'solo'>('segregated');
  const [selectedApproverId, setSelectedApproverId] = useState('');
  const [availableSupervisors, setAvailableSupervisors] = useState<SupervisorInfo[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [submittingReversal, setSubmittingReversal] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);
  const [reversalResult, setReversalResult] = useState<CounterReturn | null>(null);

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const isCurrentUserManager = useMemo(() => {
    const seats = session?.seats ?? [];
    return seats.some((s) => ['owner', 'managing_director', 'director'].includes(s));
  }, [session?.seats]);

  const loadSupervisors = async () => {
    setLoadingSupervisors(true);
    try {
      const res = await apiGet<{ ok: boolean; supervisors: SupervisorInfo[] }>('/api/ops/counter/supervisors');
      if (res.ok && res.supervisors) {
        setAvailableSupervisors(res.supervisors);
        if (res.supervisors.length > 0 && !selectedApproverId) {
          setSelectedApproverId(res.supervisors[0].person_id);
        }
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setLoadingSupervisors(false);
    }
  };

  const openReturnModal = () => {
    setReturnModalOpen(true);
    setReversalType('return');
    setReturnSearchQuery('');
    setLookedUpSale(null);
    setSelectedReturnItems({});
    setReturnReason('');
    setRefundMethod('cash');
    setReversalError(null);
    setReversalResult(null);
    loadSupervisors();
  };

  const handleLookupSale = async () => {
    const q = returnSearchQuery.trim();
    if (!q) return;
    setSearchingSale(true);
    setReversalError(null);
    try {
      const res = await apiGet<{ ok: boolean; sale: SaleLookupResult }>(
        `/api/ops/counter/sale/lookup?query=${encodeURIComponent(q)}`
      );
      if (res.ok && res.sale) {
        setLookedUpSale(res.sale);
        const initialSelections: Record<string, { selected: boolean; qty: number }> = {};
        for (const line of res.sale.lines) {
          if (line.remaining_quantity > 0) {
            initialSelections[line.product_id] = {
              selected: true,
              qty: line.remaining_quantity,
            };
          }
        }
        setSelectedReturnItems(initialSelections);
      }
    } catch (err) {
      setLookedUpSale(null);
      setReversalError(err instanceof ApiError && err.code === 'sale_not_found' ? 'sale_not_found' : 'sale_lookup_failed');
    } finally {
      setSearchingSale(false);
    }
  };

  const calculatedReturnTotal = useMemo(() => {
    if (!lookedUpSale) return 0;
    if (reversalType === 'void') {
      return lookedUpSale.gross_total;
    }
    let total = 0;
    for (const line of lookedUpSale.lines) {
      const sel = selectedReturnItems[line.product_id];
      if (sel && sel.selected && sel.qty > 0) {
        total += line.unit_price * sel.qty;
      }
    }
    return Math.round((total + Number.EPSILON) * 100) / 100;
  }, [lookedUpSale, reversalType, selectedReturnItems]);

  const handleReversalSubmit = async () => {
    if (submittingReversalRef.current || submittingReversal || !outlet?.id || !lookedUpSale) return;
    if (!canTransact(isOnline)) {
      setReversalError('network_offline');
      return;
    }
    if (returnReason.trim().length < 3) {
      setReversalError('Reason must be at least 3 characters.');
      return;
    }
    submittingReversalRef.current = true;
    setSubmittingReversal(true);
    setReversalError(null);

    if (!activeReversalKeyRef.current) {
      activeReversalKeyRef.current = activeReversalKey || crypto.randomUUID();
      setActiveReversalKey(activeReversalKeyRef.current);
    }
    const idempotencyKey = activeReversalKeyRef.current;

    try {
      const endpoint = reversalType === 'void' ? '/api/ops/counter/void' : '/api/ops/counter/return';
      const payload: Record<string, unknown> = {
        location_id: outlet.id,
        original_sale_id: lookedUpSale.sale_id,
        reason: returnReason.trim(),
        operating_capacity: operatingCapacity,
      };
      if (!isCurrentUserManager && operatingCapacity === 'segregated' && selectedApproverId) {
        payload.approver_person_id = selectedApproverId;
      }
      if (reversalType === 'return') {
        const itemsToReturn: Array<{ product_id: string; quantity: number }> = [];
        for (const line of lookedUpSale.lines) {
          const sel = selectedReturnItems[line.product_id];
          if (sel && sel.selected && sel.qty > 0) {
            itemsToReturn.push({ product_id: line.product_id, quantity: sel.qty });
          }
        }
        if (itemsToReturn.length === 0) {
          setReversalError('Please select at least one item to return.');
          return;
        }
        payload.items = itemsToReturn;
      }
      if (calculatedReturnTotal > 0) {
        payload.refund_tenders = [{ method: refundMethod, amount: calculatedReturnTotal }];
      }

      const res = await apiPost<{ ok: boolean; return: CounterReturn }>(endpoint, payload, idempotencyKey);
      if (res.ok && res.return) {
        setReversalResult(res.return);
        activeReversalKeyRef.current = null;
        setActiveReversalKey(null);
      }
    } catch (err) {
      setReversalError(err instanceof ApiError ? err.code : 'reversal_failed');
    } finally {
      submittingReversalRef.current = false;
      setSubmittingReversal(false);
    }
  };

  const organisationId = session?.current_organisation_id ?? session?.person_uuid ?? '';
  const personUuid = session?.person_uuid ?? session?.person_id ?? '';

  const outlets = catalogue?.locations && catalogue.locations.length > 0 ? catalogue.locations : [DEFAULT_OUTLET];
  const [outletId, setOutletId] = useState<string>('');
  const outlet: CounterLocation = outlets.find((l) => l.id === outletId) ?? outlets[0];

  const allProducts = catalogue?.products && catalogue.products.length > 0 ? catalogue.products : DEFAULT_RETAIL_PRODUCTS;
  const activePrices = catalogue?.prices && catalogue.prices.length > 0 ? catalogue.prices : DEFAULT_PRICES;
  const activeOnHand = catalogue?.on_hand && catalogue.on_hand.length > 0 ? catalogue.on_hand : DEFAULT_ON_HAND;

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of allProducts) {
      if (p.category && p.category.trim()) {
        cats.add(p.category.trim());
      } else {
        cats.add('General');
      }
    }
    return Array.from(cats).sort();
  }, [allProducts]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allProducts.length };
    for (const p of allProducts) {
      const cat = p.category && p.category.trim() ? p.category.trim() : 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [allProducts]);

  const scope = useMemo(
    () => ({ organisationId, personUuid, locationId: outlet.id }),
    [organisationId, personUuid, outlet.id],
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
    setSelectedProduct((current) => (current && allProducts.some((p) => p.id === current) ? current : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.organisationId, scope.personUuid, scope.locationId]);

  useEffect(() => {
    if (!outlet?.id) return;
    (async () => {
      try {
        const res = await apiGet<{ ok: boolean; has_open_session?: boolean; session?: CounterSession }>(
          `/api/ops/counter/session/current?location_id=${encodeURIComponent(outlet.id)}`,
        );
        if (res.ok) {
          setHasOpenSession(Boolean(res.has_open_session));
          if (res.session && res.has_open_session) {
            setActiveSession(res.session);
          }
        }
      } catch {
        // Non-blocking in offline / unprovisioned mode
      }
    })();
  }, [outlet?.id]);

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

  const lastClickTimeRef = useRef<number>(0);

  const handleProductTileClick = (productId: string) => {
    lastClickTimeRef.current = Date.now();
    setSelectedProduct(productId);
    persistCart(addToCart(cart, productId, 1));
  };

  const handleProductTileDoubleClick = (productId: string) => {
    // If a click just fired, browser already added the item; avoid phantom 3rd item
    const elapsed = Date.now() - lastClickTimeRef.current;
    if (elapsed < 300) {
      return;
    }
    setSelectedProduct(productId);
    persistCart(addToCart(cart, productId, 1));
  };

  const products = selectableProducts(allProducts);
  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategory !== 'all') {
      list = list.filter((p) => (p.category && p.category.trim() ? p.category.trim() : 'General') === selectedCategory);
    }
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.sku.toLowerCase().includes(needle) ||
        (p.barcode ?? '').toLowerCase().includes(needle),
    );
  }, [products, query, selectedCategory]);

  // LIVE running subtotal/total shown in large type purely for cashier glanceability.
  // The authoritative financial calculation and taxes remain strictly server-resolved on complete().
  const liveTotals = useMemo(() => {
    let subtotal = 0;
    let hasUnpricedItem = false;
    for (const line of cart) {
      const approved = approvedPriceFor(activePrices, line.productId);
      if (approved && approved.source !== 'none' && approved.unit_amount > 0) {
        const discountFactor = approved.discount_percent > 0 ? 1 - approved.discount_percent / 100 : 1;
        subtotal += line.quantity * (approved.unit_amount * discountFactor);
      } else {
        hasUnpricedItem = true;
      }
    }
    return { subtotal, hasUnpricedItem };
  }, [cart, activePrices]);

  const resetForNewSale = () => {
    setSaleResult(null);
    setReceipt(null);
    setSaleError(null);
    setReceiptError(null);
    setPrintStatus('idle');
    setPrintError(null);
    setTenderInput({ cash: '', card: '', transfer: '' });
  };

  const isTaxMissing = useMemo(() => {
    if (!catalogue) return false;
    return isTaxRateMissingForSale(catalogue.gst_registration_status, catalogue.gst_rate);
  }, [catalogue]);

  const estimatedTax = useMemo(() => {
    if (!catalogue || cartIsEmpty(cart)) return 0;
    return calculateEstimatedTax(catalogue.gst_registration_status, catalogue.gst_rate, cart, activePrices);
  }, [catalogue, cart, activePrices]);

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
    if (completingRef.current || completing || !outlet || cartIsEmpty(cart)) return;
    if (!canTransact(isOnline)) {
      setSaleError('network_offline');
      return;
    }
    if (catalogue?.gst_registration_status === 'unknown') {
      setSaleError('tax_registration_status_unknown');
      return;
    }
    if (isTaxMissing) {
      setSaleError('tax_rate_unavailable');
      return;
    }
    completingRef.current = true;
    setCompleting(true);
    setSaleError(null);
    setSaleResult(null);
    setReceipt(null);
    setReceiptError(null);

    if (!activeSaleKeyRef.current) {
      activeSaleKeyRef.current = activeSaleKey || crypto.randomUUID();
      setActiveSaleKey(activeSaleKeyRef.current);
    }
    const idempotencyKey = activeSaleKeyRef.current;

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
        activeSaleKeyRef.current = null;
        setActiveSaleKey(null);
        persistCart([]);
        setPrintStatus('idle');
        setPrintError(null);
        // Eagerly pre-load receipt after commit for immediate printing/reprinting
        loadReceipt(response.counter_sale.payment_id);
      } else {
        setSaleError('counter_sale_no_response');
      }
    } catch (error) {
      setSaleError(error instanceof ApiError ? error.code : 'counter_sale_failed');
    } finally {
      completingRef.current = false;
      setCompleting(false);
    }
  };

  const loadReceipt = async (explicitPaymentId?: string) => {
    const paymentId = explicitPaymentId || saleResult?.payment_id;
    if (!paymentId) return null;
    setReceiptBusy(true);
    setReceiptError(null);
    try {
      const data = await apiGet<CounterReceipt>(
        `/api/ops/counter/receipt?receipt_id=${encodeURIComponent(paymentId)}`,
      );
      if (data && (data.receipt || (data as any).receipt_number)) {
        setReceipt(data);
        return data;
      }
      return null;
    } catch (error) {
      setReceiptError(error instanceof ApiError ? error.code : 'receipt_load_failed');
      return null;
    } finally {
      setReceiptBusy(false);
    }
  };

  /**
   * SPOS-008: Terminal printer failure resilience.
   * Receipt emission occurs strictly AFTER database commit has completed.
   * Printer failure or cancellation NEVER reverses or affects the committed sale.
   */
  const handlePrintReceipt = async (isReprint = false) => {
    if (!saleResult?.payment_id) return;
    setPrintStatus('printing');
    setPrintError(null);

    try {
      if (isReprint) {
        // Duplicate-proof: server increments renders on the existing receipt
        await apiPost<{ ok: boolean; renders: number }>('/api/ops/counter/receipt/render', {
          receipt_id: saleResult.payment_id,
        });
      }

      // Ensure receipt data is loaded
      const receiptData = await loadReceipt(saleResult.payment_id);
      if (!receiptData) {
        const outcome = evaluatePrinterOutcome('receipt_data_unavailable', true);
        setPrintStatus(outcome.status);
        setPrintError(outcome.error);
        return;
      }

      // Physical printer invocation (window.print() or hardware device)
      try {
        window.print();
        const outcome = evaluatePrinterOutcome(null, true);
        setPrintStatus(outcome.status);
        setPrintError(null);
      } catch (printErr) {
        const outcome = evaluatePrinterOutcome(printErr, true);
        setPrintStatus(outcome.status);
        setPrintError(outcome.error);
      }
    } catch (err) {
      const outcome = evaluatePrinterOutcome(err, true);
      setPrintStatus(outcome.status);
      setPrintError(outcome.error);
    }
  };

  const reRenderReceipt = async () => {
    await handlePrintReceipt(true);
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
      const onHand = onHandAt(activeOnHand, outlet.id, product.id);
      const cartLine = cart.find((line) => line.productId === product.id);
      const approved = approvedPriceFor(activePrices, product.id);
      const isLow = isLowStock(product, onHand);
      return { product, onHand, inCart: cartLine?.quantity ?? 0, approved, isLow };
    })
    .filter((entry) => !filterLowStockOnly || entry.isLow || entry.onHand <= 0);

  return (
    // SERP-090/Founder seq 6860: fixed cashier terminal viewport. The POS root
    // is constrained to the screen height (100dvh with 100vh fallback); the
    // header, till controls, barcode/search/category bar, cart header, totals,
    // tender controls and Complete Sale stay permanently visible. Only the
    // product grid and the cart item list scroll internally — long lists can
    // never push checkout controls off-screen.
    <div className="counter-root w-full max-w-[1700px] mx-auto px-3 sm:px-6 py-4 flex flex-col h-[100vh] overflow-hidden gap-4 font-sans supports-[height:100dvh]:h-[100dvh]">
      {!isOnline && (
        <div
          role="alert"
          className="p-3.5 rounded-xl flex items-center justify-between gap-3 text-sm font-semibold"
          style={{
            backgroundColor: 'var(--md-sys-color-error-container)',
            color: 'var(--md-sys-color-on-error-container)',
            border: '1px solid var(--md-sys-color-error)',
          }}
        >
          <div className="flex items-center gap-2">
            <WifiOff size={18} aria-hidden="true" />
            <span>
              <strong>Counter POS is Online-Only</strong> — Transactions cannot be processed while offline. Reconnect to trade.
            </span>
          </div>
          <Badge variant="destructive" size="sm">Offline</Badge>
        </div>
      )}

      {/* 1. Dedicated Cashier & Outlet Identity Bar (Edge-to-Edge POS Header) */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-surface-container border border-outline-variant/60 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="tonal"
            onClick={() => navigate('/dashboard')}
            icon={<LayoutDashboard size={16} aria-hidden="true" />}
            aria-label="Exit to ERP"
            className="font-bold shrink-0"
          >
            Exit to ERP
          </Button>
          <div className="h-6 w-px bg-outline-variant/60 hidden sm:block" />
          <div
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
            style={{
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-on-primary-container)',
            }}
          >
            <Store size={20} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black tracking-tight" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                Counter
              </h1>
              <Badge variant="info" size="sm" className="font-bold">POS</Badge>
              <Badge variant={isOnline ? 'positive' : 'destructive'} dot size="sm">
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
              {catalogue && (
                <Badge
                  variant={
                    catalogue.gst_registration_status === 'registered'
                      ? (isTaxMissing ? 'destructive' : 'info')
                      : 'neutral'
                  }
                  size="sm"
                  className="font-medium"
                >
                  {catalogue.gst_registration_status === 'registered'
                    ? (isTaxMissing
                        ? 'GST Registered (Rate Unavailable)'
                        : `GST Registered (${catalogue.gst_rate_percent}%)`)
                    : 'Not GST Registered'}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-medium mt-0.5" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              <span className="flex items-center gap-1 font-semibold text-primary">
                <User size={13} aria-hidden="true" />
                {session?.name || session?.email || session?.seat_label || 'Cashier'}
              </span>
              <span>•</span>
              <span className="truncate max-w-[200px] sm:max-w-none">{outlet?.name ?? 'No outlet'}</span>
              {outlet && (
                <span className="font-mono text-[11px] opacity-75">
                  (Till #{outlet.id.slice(-4)})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          {outlets.length > 1 && (
            <div className="w-44 sm:w-56">
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
            onClick={openReturnModal}
            icon={<RotateCcw size={14} aria-hidden="true" />}
            aria-label="Return or Void"
          >
            Return / Void
          </Button>
          <Button
            size="sm"
            variant={hasOpenSession === false ? 'filled' : 'outlined'}
            onClick={openOpenTillModal}
            icon={<Unlock size={14} aria-hidden="true" />}
            aria-label="Open Till"
          >
            Open Till
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
      </header>

      {hasOpenSession === false && (
        <div
          role="status"
          className="p-3 sm:p-3.5 rounded-xl flex items-center justify-between gap-3 text-sm font-medium"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            color: 'var(--md-sys-color-on-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <Unlock size={18} style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true" />
            <span>
              <strong>Till is not open for this shift.</strong> Record opening float to begin formal cash tracking.
            </span>
          </div>
          <Button size="sm" variant="filled" onClick={openOpenTillModal} icon={<Unlock size={14} aria-hidden="true" />}>
            Open Till
          </Button>
        </div>
      )}

      {/* 2. Two-Pane Terminal Layout — flex-1 min-h-0 so the grid (left) and
          cart (right) fill the remaining viewport height and scroll INTERNALLY
          instead of growing the page (Founder seq 6860). */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT / Majority Width (Catalogue & Holds) */}
        <main className="lg:col-span-7 xl:col-span-7 2xl:col-span-8 space-y-4 flex flex-col min-h-0">
          <Surface variant="elevated" padding="md" className="rounded-2xl border border-outline-variant/60 shadow-sm flex-1 min-h-0 flex flex-col">
            <div className="flex flex-col gap-3.5 min-h-0 flex-1">
              {/* Barcode scanner bar pinned at top */}
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void resolveScan(scanInput);
                }}
              >
                <div className="flex-1 relative">
                  <Input
                    aria-label="Scan or type a barcode"
                    placeholder="Scan barcode or enter code…"
                    value={scanInput}
                    onChange={(event) => setScanInput(event.target.value)}
                    disabled={scanning}
                    onBlur={() => {
                      if (scanInput && !scanning) void resolveScan(scanInput);
                    }}
                    className="w-full text-sm font-mono h-11"
                  />
                </div>
                <Button
                  type="submit"
                  variant="filled"
                  className="h-11 px-4 font-bold"
                  disabled={scanning || !isPlausibleBarcode(normalizeBarcodeInput(scanInput))}
                  loading={scanning}
                >
                  Add
                </Button>
              </form>

              {scanError && (
                <p role="alert" className="text-xs font-semibold" style={{ color: 'var(--md-sys-color-error)' }}>
                  Scan rejected: {scanError}. No price was resolved.
                </p>
              )}

              {/* Search & Filter bar */}
              <div className="flex items-center gap-2.5">
                <div className="flex-1">
                  <Input
                    aria-label="Search products"
                    placeholder="Search by product name, SKU, or barcode…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    icon={<Search size={18} aria-hidden="true" />}
                    className="text-sm h-11"
                  />
                </div>
                <Button
                  size="md"
                  className="h-11 font-semibold text-xs sm:text-sm shrink-0"
                  variant={filterLowStockOnly ? 'filled' : 'outlined'}
                  onClick={() => setFilterLowStockOnly((prev) => !prev)}
                  aria-pressed={filterLowStockOnly}
                  aria-label="Toggle low stock filter"
                >
                  {filterLowStockOnly ? 'Low Stock Only ✓' : 'Low Stock Only'}
                </Button>
              </div>

              {/* Category Navigation Pills */}
              <div
                className="flex items-center gap-2 overflow-x-auto pb-1 erp-scroll-region"
                role="tablist"
                aria-label="Filter products by category"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'all'}
                  onClick={() => setSelectedCategory('all')}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                  style={{
                    backgroundColor: selectedCategory === 'all'
                      ? 'var(--md-sys-color-primary)'
                      : 'var(--md-sys-color-surface-container-high)',
                    color: selectedCategory === 'all'
                      ? 'var(--md-sys-color-on-primary)'
                      : 'var(--md-sys-color-on-surface-variant)',
                    border: selectedCategory === 'all'
                      ? '1px solid var(--md-sys-color-primary)'
                      : '1px solid var(--md-sys-color-outline-variant)',
                  }}
                >
                  <span>All</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-normal"
                    style={{
                      backgroundColor: selectedCategory === 'all'
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface-container-highest)',
                      color: selectedCategory === 'all'
                        ? 'var(--md-sys-color-on-primary-container)'
                        : 'var(--md-sys-color-on-surface-variant)',
                    }}
                  >
                    {categoryCounts['all'] ?? 0}
                  </span>
                </button>
                {availableCategories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setSelectedCategory(cat)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                      style={{
                        backgroundColor: isSelected
                          ? 'var(--md-sys-color-primary)'
                          : 'var(--md-sys-color-surface-container-high)',
                        color: isSelected
                          ? 'var(--md-sys-color-on-primary)'
                          : 'var(--md-sys-color-on-surface-variant)',
                        border: isSelected
                          ? '1px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                      }}
                    >
                      <Tag size={12} aria-hidden="true" />
                      <span>{cat}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-normal"
                        style={{
                          backgroundColor: isSelected
                            ? 'var(--md-sys-color-primary-container)'
                            : 'var(--md-sys-color-surface-container-highest)',
                          color: isSelected
                            ? 'var(--md-sys-color-on-primary-container)'
                            : 'var(--md-sys-color-on-surface-variant)',
                        }}
                      >
                        {categoryCounts[cat] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Product Grid - Dense, touch-friendly retail tiles */}
              <div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 flex-1 min-h-0 overflow-y-auto erp-scroll-region p-1"
                role="region"
                aria-label="Product grid"
              >
                {availableProducts.map(({ product, onHand, inCart, approved, isLow }) => {
                  const selected = selectedProduct === product.id;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleProductTileClick(product.id)}
                      onDoubleClick={() => handleProductTileDoubleClick(product.id)}
                      aria-pressed={selected}
                      style={{
                        backgroundColor: selected
                          ? 'var(--md-sys-color-secondary-container)'
                          : 'var(--md-sys-color-surface-container-low)',
                        color: 'var(--md-sys-color-on-surface)',
                        border: selected
                          ? '2px solid var(--md-sys-color-primary)'
                          : isLow
                            ? '2px solid var(--warning)'
                            : '1px solid var(--md-sys-color-outline-variant)',
                        borderRadius: 'var(--md-sys-shape-corner-large, 14px)',
                      }}
                      className="flex flex-col items-start gap-1 p-2.5 sm:p-3 text-left min-h-[118px] transition-all hover:shadow-md active:scale-[0.99] relative cursor-pointer group"
                    >
                      <div className="w-full flex items-center justify-between gap-1 min-w-0">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap truncate min-w-0"
                          style={{
                            backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                            color: 'var(--md-sys-color-on-surface-variant)',
                          }}
                          title={product.category || 'General'}
                        >
                          {product.category || 'General'}
                        </span>
                        {inCart > 0 && (
                          <Badge variant="info" size="sm" className="shrink-0 font-bold whitespace-nowrap text-[10px] px-1.5 py-0.5">
                            in cart ×{inCart}
                          </Badge>
                        )}
                      </div>

                      <span className="text-xs sm:text-sm font-bold leading-tight line-clamp-2 mt-0.5" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                        {product.name}
                      </span>

                      <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                        <span className="font-semibold">{product.sku}</span>
                        {product.barcode && (
                          <>
                            <span>•</span>
                            <span>{product.barcode}</span>
                          </>
                        )}
                      </div>

                      {/* Prominent Price & Stock display */}
                      <div className="mt-auto w-full pt-1.5 flex items-baseline justify-between gap-1 border-t border-outline-variant/30 min-w-0">
                        <div className="min-w-0 shrink-0">
                          {approved && approved.source !== 'none' && approved.unit_amount > 0 ? (
                            <span className="text-xs sm:text-sm xl:text-base font-black font-mono tracking-tight text-primary tabular-nums whitespace-nowrap inline-flex items-baseline">
                              <span>MVR&nbsp;{Number(approved.unit_amount).toFixed(2)}</span>
                              {approved.source === 'price_list_override' ? (
                                <span className="text-[10px] font-normal text-on-surface-variant ml-0.5">(list)</span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-on-surface-variant italic whitespace-nowrap">
                              no approved price
                            </span>
                          )}
                        </div>
                        <div className="shrink-0">
                          <Badge variant={onHand > 0 ? 'positive' : 'warning'} dot size="sm" className="whitespace-nowrap text-[10px] px-1.5 py-0.5">
                            {onHand} in stock
                          </Badge>
                        </div>
                      </div>

                      {isLow && onHand > 0 && (
                        <span className="text-[10px] text-[var(--warning)] font-medium">
                          Low (≤ {product.reorder_threshold})
                        </span>
                      )}
                      {onHand <= 0 && (
                        <span className="text-[10px] text-[var(--md-sys-color-error)] font-medium">
                          Out of stock
                        </span>
                      )}
                    </button>
                  );
                })}
                {availableProducts.length === 0 && (
                  <div className="col-span-full py-12 text-center" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    <Package size={36} className="mx-auto mb-2 opacity-40" aria-hidden="true" />
                    <p className="text-sm font-semibold">
                      {filterLowStockOnly ? 'No low-stock products at this outlet.' : `No products match “${query}”.`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Surface>

          {/* Held Carts Section */}
          {holds.length > 0 && (
            <Surface variant="elevated" padding="md" className="rounded-2xl border border-outline-variant/60 shadow-sm">
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                <Clock size={16} aria-hidden="true" />
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
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                          {cartLineCount(held.cart)} line(s), {cartItemCount(held.cart)} item(s)
                        </p>
                        <p className="text-xs font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          {expired ? 'Expired' : `${minutes} min remaining`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={expired ? 'neutral' : 'warning'} dot>{expired ? 'expired' : 'held'}</Badge>
                        <Button
                          size="sm"
                          variant="tonal"
                          disabled={expired}
                          onClick={() => resume(held)}
                          icon={<RotateCcw size={14} aria-hidden="true" />}
                        >
                          Resume
                        </Button>
                        <Button
                          size="sm"
                          variant="text"
                          onClick={() => discard(held)}
                          icon={<Trash2 size={14} aria-hidden="true" />}
                        >
                          Discard
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Surface>
          )}
        </main>

        {/* RIGHT / Dominant Sticky Cart Panel */}
        <aside className="lg:col-span-5 xl:col-span-5 2xl:col-span-4 flex flex-col min-h-0">
          <Surface variant="elevated" padding="none" className="rounded-2xl border border-outline-variant/70 shadow-md flex flex-col h-full min-h-0 overflow-hidden">
            {/* Cart Header */}
            <div className="shrink-0 flex items-center justify-between p-3.5 pb-2.5 border-b border-outline-variant/60">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
                >
                  <ShoppingCart size={15} aria-hidden="true" />
                </div>
                <h2 className="text-base font-black tracking-tight" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                  Cart
                </h2>
              </div>
              {!cartIsEmpty(cart) && (
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" size="sm" className="font-mono font-bold text-xs">
                    {cartLineCount(cart)} line(s) · {cartItemCount(cart)} item(s)
                  </Badge>
                  <Button
                    size="xs"
                    variant="text"
                    onClick={() => persistCart([])}
                    icon={<Trash2 size={13} aria-hidden="true" />}
                    aria-label="Clear cart"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>

            {/* Independent Scrolling Cart Items Area */}
            <div className="flex-1 min-h-0 overflow-y-auto erp-scroll-region p-2.5 space-y-1.5">
              {cartIsEmpty(cart) ? (
                <div
                  className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl h-full min-h-[140px]"
                  style={{
                    border: '2px dashed var(--md-sys-color-outline-variant)',
                    backgroundColor: 'var(--md-sys-color-surface-container-low)',
                  }}
                >
                  <Package size={28} style={{ color: 'var(--md-sys-color-outline)' }} aria-hidden="true" />
                  <p className="text-xs font-bold mt-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>Cart is empty</p>
                  <p className="text-[11px] mt-0.5 max-w-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Select a product to start. Totals are resolved server-side when the sale completes.
                  </p>
                </div>
              ) : (
                cart.map((line) => {
                  const product = allProducts.find((p) => p.id === line.productId);
                  const onHand = onHandAt(activeOnHand, outlet.id, line.productId);
                  const approved = approvedPriceFor(activePrices, line.productId);
                  const short = line.quantity > onHand;
                  const unitPrice = (approved && approved.source !== 'none' && approved.unit_amount > 0) ? Number(approved.unit_amount) : 0;
                  const lineTotal = unitPrice * line.quantity;

                  return (
                    <div
                      key={line.productId}
                      className="px-2.5 py-1.5 rounded-lg transition-all"
                      style={{
                        backgroundColor: 'var(--md-sys-color-surface-container-low)',
                        border: `1px solid ${short ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-outline-variant)'}`,
                      }}
                    >
                      {/* Top Row: Name and Line Total */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold truncate flex-1" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                          {product?.name ?? line.productId}
                        </span>
                        <span className="text-xs font-bold font-mono tabular-nums shrink-0" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                          MVR {lineTotal.toFixed(2)}
                        </span>
                      </div>

                      {/* Bottom Row: Unit Price / Warnings & Compact Stepper */}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {approved && approved.source !== 'none' && approved.unit_amount > 0 ? (
                            <span className="text-[11px] font-mono font-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                              MVR {Number(approved.unit_amount).toFixed(2)}
                              {approved.source === 'price_list_override' ? ' · list' : ''}
                              {approved.discount_percent > 0 ? ` · −${approved.discount_percent}%` : ''}
                            </span>
                          ) : (
                            <span className="text-[11px] italic" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>no price</span>
                          )}
                          {short ? (
                            <span className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: 'var(--md-sys-color-error)' }}>
                              <AlertTriangle size={10} aria-hidden="true" /> {onHand} left
                            </span>
                          ) : product && isLowStock(product, onHand) ? (
                            <span className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: 'var(--warning)' }}>
                              <AlertTriangle size={10} aria-hidden="true" /> {onHand} left
                            </span>
                          ) : null}
                        </div>

                        {/* Compact Stepper */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            className="relative w-6 h-6 rounded flex items-center justify-center text-xs font-bold border transition-colors hover:opacity-80 touch-manipulation before:absolute before:-inset-2.5 before:content-['']"
                            style={{
                              borderColor: 'var(--md-sys-color-outline-variant)',
                              color: 'var(--md-sys-color-on-surface)',
                            }}
                            aria-label={`Decrease ${product?.name ?? 'item'}`}
                            onClick={() => persistCart(setCartQuantity(cart, line.productId, line.quantity - 1))}
                          >
                            <Minus size={11} aria-hidden="true" />
                          </button>
                          <span className="w-5 text-center text-xs font-extrabold tabular-nums font-mono" aria-label="quantity" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className="relative w-6 h-6 rounded flex items-center justify-center text-xs font-bold border transition-colors hover:opacity-80 touch-manipulation before:absolute before:-inset-2.5 before:content-['']"
                            style={{
                              borderColor: 'var(--md-sys-color-outline-variant)',
                              color: 'var(--md-sys-color-on-surface)',
                            }}
                            aria-label={`Increase ${product?.name ?? 'item'}`}
                            onClick={() => persistCart(addToCart(cart, line.productId, 1))}
                          >
                            <Plus size={11} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="relative w-6 h-6 rounded flex items-center justify-center transition-colors hover:opacity-80 ml-0.5 touch-manipulation before:absolute before:-inset-2.5 before:content-['']"
                            style={{ color: 'var(--md-sys-color-error)' }}
                            aria-label={`Remove ${product?.name ?? 'item'}`}
                            onClick={() => persistCart(removeFromCart(cart, line.productId))}
                          >
                            <Trash2 size={12} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Fixed Bottom Checkout / Result Controls */}
            <div className="shrink-0 p-3 border-t border-outline-variant/60 space-y-2.5 bg-surface-container">
              {saleResult ? (
                /* Compact Post-Sale Action Card (Register & Catalog Stay Stationary) */
                <div
                  className="p-3 rounded-xl border space-y-2"
                  style={{
                    backgroundColor: 'var(--positive-subtle)',
                    borderColor: 'var(--positive)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CheckCircle2 size={18} style={{ color: 'var(--positive)' }} aria-hidden="true" />
                      <div>
                        <h2 className="text-xs font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                          Sale complete
                        </h2>
                        <p className="text-[11px] font-mono" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          {saleResult.invoice_number && (
                            <>Invoice <span className="font-bold">{saleResult.invoice_number}</span> settled.</>
                          )}
                          {saleResult.receipt_number && (
                            <span className="ml-1 font-bold">{saleResult.receipt_number}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge variant="positive" size="sm">Settled</Badge>
                  </div>

                  {/* Financial Breakdown */}
                  <div
                    className="p-2 rounded-lg text-xs space-y-1"
                    style={{ backgroundColor: 'var(--md-sys-color-surface-container-lowest)' }}
                  >
                    {saleResult.total_amount !== undefined && (
                      <div className="flex justify-between font-bold text-on-surface">
                        <span>Total</span>
                        <span className="font-mono tabular-nums">MVR {Number(saleResult.total_amount).toFixed(2)}</span>
                      </div>
                    )}
                    {saleResult.tendered_amount !== undefined && (
                      <div className="flex justify-between text-on-surface-variant">
                        <span>Tendered</span>
                        <span className="font-mono tabular-nums">MVR {Number(saleResult.tendered_amount).toFixed(2)}</span>
                      </div>
                    )}
                    <div
                      className="flex justify-between font-bold pt-1 border-t border-outline-variant/40"
                      style={{ color: Number(saleResult.change_amount ?? 0) > 0 ? 'var(--positive)' : 'var(--md-sys-color-on-surface)' }}
                    >
                      <span>Change Due</span>
                      <span className="font-mono text-base tabular-nums">
                        MVR {Number(saleResult.change_amount ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* SPOS-008: Explicit Printer Failure Notice */}
                  {printStatus === 'print_failed' && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="p-2.5 rounded-lg border text-xs space-y-1"
                      style={{
                        borderColor: 'var(--md-sys-color-error, #f87171)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--md-sys-color-error, #f87171)',
                      }}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle size={14} aria-hidden="true" />
                        <span>Printer Error — Sale #{saleResult.invoice_number} Safely Committed</span>
                      </div>
                      <p className="text-[11px] opacity-90">
                        The transaction is durable in the database. The physical printer did not respond.
                        Reprint is available and will not create a duplicate charge.
                      </p>
                    </div>
                  )}

                  {/* Direct Actions: New Sale, View Receipt */}
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full font-bold text-xs h-9"
                      onClick={resetForNewSale}
                      autoFocus
                      icon={<Plus size={14} aria-hidden="true" />}
                    >
                      Start New Sale
                    </Button>
                    <Button
                      variant="tonal"
                      size="sm"
                      className="w-full font-bold text-xs h-9"
                      loading={receiptBusy || printStatus === 'printing'}
                      onClick={() => {
                        loadReceipt();
                        setReceiptModalOpen(true);
                      }}
                      icon={<Receipt size={14} aria-hidden="true" />}
                    >
                      View receipt
                    </Button>
                  </div>

                  {/* SPOS-008: Print & Re-print actions */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      variant={printStatus === 'print_failed' ? 'primary' : 'outlined'}
                      size="sm"
                      className="w-full font-bold text-xs h-8"
                      loading={printStatus === 'printing'}
                      onClick={() => handlePrintReceipt(false)}
                      icon={<Printer size={13} aria-hidden="true" />}
                    >
                      {printStatus === 'print_failed' ? 'Retry Print' : 'Print Receipt'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="sm"
                      className="w-full font-bold text-xs h-8"
                      disabled={!receipt && !saleResult}
                      loading={printStatus === 'printing'}
                      onClick={() => handlePrintReceipt(true)}
                      icon={<Copy size={13} aria-hidden="true" />}
                    >
                      Re-print (duplicate)
                    </Button>
                  </div>

                  {printStatus === 'printed' && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--positive)]">
                      <CheckCircle2 size={13} aria-hidden="true" />
                      <span>Receipt printed • Duplicate reprint available</span>
                    </div>
                  )}

                  {receipt && (receipt.receipt || (receipt as any).receipt_number) && (
                    <div
                      className="p-1.5 rounded-lg text-xs"
                      style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[11px]">
                          Receipt {receipt.receipt?.receipt_number ?? (receipt as any).receipt_number ?? saleResult.receipt_number}
                        </span>
                        <Badge variant="neutral">
                          rendered ×{receipt.receipt?.renders ?? (receipt as any).renders ?? 0}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Live Running Totals & Checkout Actions */
                <>
                  <div
                    className="p-3 rounded-xl border space-y-1.5"
                    style={{
                      backgroundColor: 'var(--md-sys-color-surface-container-high)',
                      borderColor: 'var(--md-sys-color-outline-variant)',
                    }}
                  >
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-semibold text-on-surface-variant">Estimated Subtotal</span>
                      <span className="font-mono font-bold text-on-surface tabular-nums">
                        MVR {liveTotals.subtotal.toFixed(2)}
                      </span>
                    </div>
                    {catalogue?.gst_registration_status === 'registered' ? (
                      <div className="flex justify-between items-baseline text-xs">
                        <span className={`font-semibold ${isTaxMissing ? 'text-error' : 'text-on-surface-variant'}`}>
                          Estimated Tax {isTaxMissing ? '' : `(${catalogue.gst_rate_percent}%)`}
                        </span>
                        {isTaxMissing ? (
                          <span className="font-semibold text-error text-xs">Rate unavailable</span>
                        ) : (
                          <span className="font-mono font-bold text-on-surface tabular-nums">
                            MVR {(estimatedTax ?? 0).toFixed(2)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="font-semibold text-on-surface-variant">Tax</span>
                        <span className="font-mono font-semibold text-on-surface-variant text-xs">
                          Not GST registered — no GST
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline pt-1.5 border-t border-outline-variant/60">
                      <div>
                        <span className="text-sm font-black tracking-tight text-on-surface block">
                          TOTAL DUE
                        </span>
                        <span className="text-[10px] text-on-surface-variant">
                          {isTaxMissing
                            ? 'Sale blocked: missing tax configuration'
                            : 'Exact total resolved server-side'}
                        </span>
                      </div>
                      <div className="text-right">
                        {isTaxMissing ? (
                          <span className="text-sm font-bold tracking-tight text-error block">
                            Rate Unavailable
                          </span>
                        ) : (
                          <span className="text-xl font-black font-mono tracking-tight text-primary tabular-nums block">
                            MVR {(liveTotals.subtotal + (estimatedTax ?? 0)).toFixed(2)}
                          </span>
                        )}
                        {liveTotals.hasUnpricedItem && (
                          <span className="text-[10px] font-semibold text-[var(--warning)]">
                            Unapproved prices in cart
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isTaxMissing && !cartIsEmpty(cart) && (
                    <div role="alert" className="p-2 rounded-lg bg-error-container/40 border border-error/30 text-xs font-semibold text-error">
                      Authoritative GST rate is unavailable for this registered organisation. Complete sale is blocked until statutory tax configuration is loaded.
                    </div>
                  )}

                  {/* Tender & Payment Controls */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['cash', 'card', 'transfer', 'mixed'] as const).map((method) => {
                        const active = paymentMethod === method;
                        return (
                          <button
                            key={method}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setPaymentMethod(method)}
                            className="h-9 px-1 text-xs font-bold rounded-lg capitalize transition-all flex items-center justify-center gap-1 shadow-sm"
                            style={{
                              backgroundColor: active
                                ? 'var(--md-sys-color-primary)'
                                : 'var(--md-sys-color-surface-container-high)',
                              color: active
                                ? 'var(--md-sys-color-on-primary)'
                                : 'var(--md-sys-color-on-surface)',
                              border: `2px solid ${active ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}`,
                            }}
                          >
                            {method === 'cash' && <Banknote size={13} aria-hidden="true" />}
                            {method === 'card' && <CreditCard size={13} aria-hidden="true" />}
                            {method === 'transfer' && <RotateCcw size={12} aria-hidden="true" />}
                            {method === 'mixed' && <Sparkles size={12} aria-hidden="true" />}
                            <span>{method}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Tender Inputs */}
                    <div className="flex flex-wrap gap-2">
                      {(['cash', 'card', 'transfer'] as const)
                        .filter((m) => paymentMethod === 'mixed' || paymentMethod === m)
                        .map((m) => (
                          <div key={m} className="flex-1 min-w-[110px]">
                            <label className="block text-[10px] font-bold capitalize text-on-surface-variant mb-0.5">
                              {m} Tendered
                            </label>
                            <Input
                              aria-label={`${m} tendered`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="0.01"
                              placeholder="0.00"
                              onFocus={(e) => e.target.select()}
                              className="w-full text-sm font-mono font-bold h-9"
                              value={tenderInput[m] ?? ''}
                              onChange={(e) => setTenderInput((t) => ({ ...t, [m]: e.target.value }))}
                            />
                          </div>
                        ))}
                    </div>

                    {/* Action Buttons: Hold and Big Complete Sale / Charge */}
                    <div className="grid grid-cols-3 gap-2 pt-0.5">
                      <Button
                        variant="tonal"
                        size="md"
                        className="col-span-1 h-11 font-bold text-xs"
                        disabled={cartIsEmpty(cart) || !canTransact(isOnline)}
                        onClick={hold}
                        icon={<ShoppingCart size={15} aria-hidden="true" />}
                      >
                        Hold cart
                      </Button>
                      <Button
                        variant="filled"
                        size="lg"
                        className="col-span-2 h-11 text-sm font-black tracking-wide shadow-md active:scale-[0.99] transition-transform"
                        loading={completing}
                        disabled={cartIsEmpty(cart) || !outlet || completing || !canTransact(isOnline) || isTaxMissing}
                        onClick={complete}
                        icon={<CheckCircle2 size={17} aria-hidden="true" />}
                      >
                        {isTaxMissing ? 'Tax rate unavailable' : 'Complete sale'}
                      </Button>
                    </div>

                    {saleError && (
                      <div className="p-2.5 rounded-lg bg-error-container/40 border border-error/30 space-y-1.5">
                        <p role="alert" className="text-xs font-semibold text-error">
                          Sale rejected: {formatResilienceErrorMessage(saleError)}
                        </p>
                        {isRetryableError(saleError) && (
                          <Button
                            size="xs"
                            variant="outlined"
                            onClick={complete}
                            loading={completing}
                            icon={<RefreshCw size={12} aria-hidden="true" />}
                          >
                            Retry sale (idempotent)
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </Surface>
        </aside>
      </div>

      {/* Open Till Modal */}
      {openTillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="w-full max-w-md">
            <Surface variant="elevated" padding="lg" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Unlock size={18} style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true" />
                  <h2 className="text-base font-semibold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    Open Till &amp; Start Shift
                  </h2>
                </div>
                <Button
                  size="sm"
                  variant="text"
                  onClick={() => setOpenTillModalOpen(false)}
                  aria-label="Close dialog"
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-4">
                <div className="text-xs space-y-1.5 p-3 rounded-lg" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Outlet</span>
                    <span className="font-semibold">{outlet.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Till ID</span>
                    <span className="font-mono font-semibold">Till #{outlet.id.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Cashier</span>
                    <span className="font-semibold">{session?.name || session?.email || session?.seat_label || 'Cashier'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="opening-float-input" className="text-xs font-semibold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    Opening Cash Float (MVR)
                  </label>
                  <p className="text-[11px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Count physical cash notes and coins present in the cash drawer at shift start.
                  </p>
                  <Input
                    id="opening-float-input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={openingFloatInput}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setOpeningFloatInput(e.target.value)}
                    autoFocus
                    aria-label="Opening Cash Float"
                    className="text-base font-mono font-bold"
                  />
                </div>

                {openTillError && (
                  <p role="alert" className="text-xs font-semibold" style={{ color: 'var(--md-sys-color-error)' }}>
                    {openTillError === 'counter_session_already_open'
                      ? 'A cash session is already open at this till.'
                      : openTillError === 'seat_not_authorized'
                        ? 'Your current role seat is not authorized to open counter sessions.'
                        : `Could not open till: ${openTillError}`}
                  </p>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outlined" onClick={() => setOpenTillModalOpen(false)} disabled={openingTill}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleOpenTillSubmit}
                    loading={openingTill}
                    disabled={openingFloatInput === '' || isNaN(parseFloat(openingFloatInput)) || parseFloat(openingFloatInput) < 0}
                  >
                    Open Till &amp; Start
                  </Button>
                </div>
              </div>
            </Surface>
          </div>
        </div>
      )}

      {/* Till Close Modal */}
      {tillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="w-full max-w-lg">
            <Surface variant="elevated" padding="lg" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lock size={18} style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true" />
                  <h2 className="text-base font-semibold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    Cash Session &amp; Till Close
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
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setCountedCashInput(e.target.value)}
                      autoFocus
                      aria-label="Counted Cash in Drawer"
                    />
                  </div>

                  {countedCashInput !== '' && !isNaN(parseFloat(countedCashInput)) && (() => {
                    const counted = parseFloat(countedCashInput);
                    const expected = Number(tillSession?.expected_cash ?? 0);
                    const variance = calculateVariance(expected, counted);
                    const isBalanced = variance === 0;
                    const isShortage = variance < 0;
                    return (
                      <div
                        className="p-3 rounded-xl border space-y-2"
                        style={{
                          backgroundColor: isBalanced
                            ? 'var(--positive-subtle)'
                            : isShortage
                              ? 'var(--md-sys-color-error-container)'
                              : 'var(--md-sys-color-surface-container-high)',
                          borderColor: isBalanced
                            ? 'var(--positive)'
                            : isShortage
                              ? 'var(--md-sys-color-error)'
                              : 'var(--md-sys-color-outline-variant)',
                        }}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Expected Cash:</span>
                          <span className="font-mono font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                            {tillSession?.currency ?? 'MVR'} {expected.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Counted Cash:</span>
                          <span className="font-mono font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                            {tillSession?.currency ?? 'MVR'} {counted.toFixed(2)}
                          </span>
                        </div>
                        <div
                          className="flex justify-between items-center pt-2 border-t font-bold text-xs"
                          style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}
                        >
                          <span>Calculated Variance:</span>
                          <Badge variant={isBalanced ? 'positive' : isShortage ? 'destructive' : 'info'} size="sm">
                            {isBalanced
                              ? 'BALANCED (MVR 0.00)'
                              : isShortage
                                ? `SHORTAGE: -MVR ${Math.abs(variance).toFixed(2)}`
                                : `OVERAGE: +MVR ${variance.toFixed(2)}`}
                          </Badge>
                        </div>
                      </div>
                    );
                  })()}

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
                      {countedCashInput !== '' && !isNaN(parseFloat(countedCashInput))
                        ? calculateVariance(Number(tillSession?.expected_cash ?? 0), parseFloat(countedCashInput)) === 0
                          ? 'Confirm Till Close (Balanced)'
                          : `Confirm Till Close (${formatVarianceLabel(calculateVariance(Number(tillSession?.expected_cash ?? 0), parseFloat(countedCashInput)), tillSession?.currency ?? 'MVR')})`
                        : 'Close Till & Record Variance'}
                    </Button>
                  </div>
                </div>
              )}
            </Surface>
          </div>
        </div>
      )}

      {/* Cashier-Usable Return & Void Modal (SERP-088) */}
      {returnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="w-full max-w-xl">
            <Surface variant="elevated" padding="lg" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant/60">
                <div className="flex items-center gap-2">
                  <RotateCcw size={18} style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true" />
                  <h2 className="text-base font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    Process Return or Void
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
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--positive-subtle)', color: 'var(--positive)' }}>
                    <CheckCircle2 size={20} aria-hidden="true" />
                    <span className="text-sm font-bold">Reversal Processed Successfully</span>
                  </div>
                  <div className="text-xs space-y-2 p-3.5 rounded-xl border" style={{ backgroundColor: 'var(--md-sys-color-surface-container)', borderColor: 'var(--md-sys-color-outline-variant)' }}>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Return Number</span>
                      <span className="font-mono font-bold">{reversalResult.return_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Type</span>
                      <span className="font-bold uppercase">{reversalResult.reversal_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Credit Note</span>
                      <span className="font-mono font-bold">{reversalResult.credit_note_number ?? reversalResult.credit_note_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Total Refund</span>
                      <span className="font-bold font-mono text-sm tabular-nums" style={{ color: 'var(--positive)' }}>
                        {reversalResult.currency} {Number(reversalResult.total_refund_amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Approval Mode</span>
                      <span className="font-semibold capitalize">{reversalResult.approval_mode.replace('_', ' ')}</span>
                    </div>
                    <div className="pt-2 border-t text-[11px]" style={{ borderColor: 'var(--md-sys-color-outline-variant)', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      <span className="font-medium">Reason:</span> {reversalResult.reason}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    className="w-full h-11 text-sm font-bold"
                    onClick={() => setReturnModalOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search / Scan Bar */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                      Scan Barcode or Enter Receipt / Invoice Number
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. RCT-00001, SI-00001, or scan receipt barcode"
                        value={returnSearchQuery}
                        onChange={(e) => setReturnSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleLookupSale();
                        }}
                        autoFocus
                        className="flex-1 text-sm font-mono"
                        aria-label="Search receipt or invoice"
                      />
                      <Button
                        variant="primary"
                        onClick={handleLookupSale}
                        loading={searchingSale}
                        disabled={!returnSearchQuery.trim()}
                        icon={<Search size={14} aria-hidden="true" />}
                      >
                        Find Sale
                      </Button>
                    </div>
                  </div>

                  {/* Sale Lookup Result Details */}
                  {lookedUpSale ? (
                    <div className="space-y-4 pt-1">
                      {/* Sale Summary Banner */}
                      <div className="p-3 rounded-xl border text-xs space-y-1.5" style={{ backgroundColor: 'var(--md-sys-color-surface-container)', borderColor: 'var(--md-sys-color-outline-variant)' }}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                            Invoice: {lookedUpSale.invoice_number}
                          </span>
                          {lookedUpSale.receipt_number && (
                            <Badge variant="neutral" size="sm" className="font-mono font-bold">
                              Receipt: {lookedUpSale.receipt_number}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          <span>Date: {new Date(lookedUpSale.created_at).toLocaleString()}</span>
                          <span className="font-mono font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                            Original Total: {lookedUpSale.currency} {lookedUpSale.gross_total.toFixed(2)}
                          </span>
                        </div>
                        {lookedUpSale.is_fully_voided && (
                          <div className="p-2 rounded-lg font-bold text-center" style={{ backgroundColor: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-error)' }}>
                            This sale has already been fully voided.
                          </div>
                        )}
                      </div>

                      {!lookedUpSale.is_fully_voided && (
                        <>
                          {/* Mode Tabs */}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={reversalType === 'void' ? 'primary' : 'outlined'}
                              onClick={() => setReversalType('void')}
                            >
                              Void Entire Sale
                            </Button>
                            <Button
                              size="sm"
                              variant={reversalType === 'return' ? 'primary' : 'outlined'}
                              onClick={() => setReversalType('return')}
                            >
                              Itemized Return
                            </Button>
                          </div>

                          {reversalType === 'void' ? (
                            <div className="p-3 rounded-xl border text-xs" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', borderColor: 'var(--md-sys-color-outline-variant)' }}>
                              <p className="font-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                                Void will cancel the entire transaction, return all items to stock, and issue a full refund of <span className="font-bold font-mono">MVR {lookedUpSale.gross_total.toFixed(2)}</span>.
                              </p>
                            </div>
                          ) : (
                            /* Itemized Return List */
                            <div className="space-y-2">
                              <label className="block text-xs font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                                Select Items to Return
                              </label>
                              <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 rounded-xl border" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
                                {lookedUpSale.lines.map((line) => {
                                  const sel = selectedReturnItems[line.product_id] ?? { selected: false, qty: 1 };
                                  const disabled = line.remaining_quantity <= 0;

                                  return (
                                    <div
                                      key={line.product_id}
                                      className="p-2.5 rounded-lg flex items-center justify-between gap-2 transition-colors text-xs"
                                      style={{
                                        backgroundColor: sel.selected && !disabled
                                          ? 'var(--md-sys-color-surface-container-high)'
                                          : 'var(--md-sys-color-surface-container-low)',
                                        opacity: disabled ? 0.5 : 1,
                                      }}
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <input
                                          type="checkbox"
                                          disabled={disabled}
                                          checked={sel.selected && !disabled}
                                          onChange={(e) =>
                                            setSelectedReturnItems((prev) => ({
                                              ...prev,
                                              [line.product_id]: {
                                                selected: e.target.checked,
                                                qty: prev[line.product_id]?.qty || 1,
                                              },
                                            }))
                                          }
                                          className="rounded cursor-pointer"
                                          aria-label={`Select ${line.description}`}
                                        />
                                        <div className="min-w-0">
                                          <p className="font-bold truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                                            {line.description}
                                          </p>
                                          <p className="text-[11px] font-mono" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                                            MVR {line.unit_price.toFixed(2)} each · {line.remaining_quantity} returnable (sold {line.quantity})
                                          </p>
                                        </div>
                                      </div>

                                      {/* Quantity Stepper */}
                                      {!disabled && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            className="relative w-6 h-6 rounded flex items-center justify-center text-xs font-bold border transition-colors hover:opacity-80 touch-manipulation before:absolute before:-inset-2.5 before:content-['']"
                                            style={{
                                              borderColor: 'var(--md-sys-color-outline-variant)',
                                              color: 'var(--md-sys-color-on-surface)',
                                            }}
                                            onClick={() =>
                                              setSelectedReturnItems((prev) => ({
                                                ...prev,
                                                [line.product_id]: {
                                                  selected: true,
                                                  qty: Math.max(1, (prev[line.product_id]?.qty || 1) - 1),
                                                },
                                              }))
                                            }
                                            aria-label="Decrease quantity"
                                          >
                                            <Minus size={11} aria-hidden="true" />
                                          </button>
                                          <span className="w-5 text-center text-xs font-bold font-mono tabular-nums">
                                            {sel.qty}
                                          </span>
                                          <button
                                            type="button"
                                            className="relative w-6 h-6 rounded flex items-center justify-center text-xs font-bold border transition-colors hover:opacity-80 touch-manipulation before:absolute before:-inset-2.5 before:content-['']"
                                            style={{
                                              borderColor: 'var(--md-sys-color-outline-variant)',
                                              color: 'var(--md-sys-color-on-surface)',
                                            }}
                                            onClick={() =>
                                              setSelectedReturnItems((prev) => ({
                                                ...prev,
                                                [line.product_id]: {
                                                  selected: true,
                                                  qty: Math.min(line.remaining_quantity, (prev[line.product_id]?.qty || 1) + 1),
                                                },
                                              }))
                                            }
                                            aria-label="Increase quantity"
                                          >
                                            <Plus size={11} aria-hidden="true" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Refund Tender & Method */}
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
                            <div className="flex flex-col justify-end">
                              <span className="text-[11px] font-bold text-on-surface-variant mb-1">Total Refund Amount</span>
                              <div className="h-10 px-3 rounded-xl border flex items-center font-mono font-bold text-sm tabular-nums" style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)', borderColor: 'var(--md-sys-color-outline-variant)', color: 'var(--positive)' }}>
                                MVR {calculatedReturnTotal.toFixed(2)}
                              </div>
                            </div>
                          </div>

                          {/* Reason Selector */}
                          <div className="space-y-1.5">
                            <label className="block text-xs font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                              Reason for Reversal
                            </label>
                            <div className="flex flex-wrap gap-1.5 mb-1">
                              {['Customer Cancelled', 'Defective / Damaged', 'Cashier Error', 'Wrong Item Scanned'].map((chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => setReturnReason(chip)}
                                  className="text-[11px] px-2 py-0.5 rounded-full border transition-colors hover:opacity-80"
                                  style={{
                                    backgroundColor: returnReason === chip ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)',
                                    color: returnReason === chip ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)',
                                    borderColor: returnReason === chip ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)',
                                  }}
                                >
                                  {chip}
                                </button>
                              ))}
                            </div>
                            <Input
                              placeholder="Type reason for audit log..."
                              value={returnReason}
                              onChange={(e) => setReturnReason(e.target.value)}
                              aria-label="Reason for reversal"
                            />
                          </div>

                          {/* Manager Approval Workflow (Zero UUIDs) */}
                          <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
                            {isCurrentUserManager ? (
                              <div className="flex items-center gap-2 p-2.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--positive-subtle)', color: 'var(--positive)' }}>
                                <ShieldCheck size={16} aria-hidden="true" />
                                <span className="font-semibold">
                                  Manager Authorization Active ({session?.name || session?.seat_label || 'Manager'})
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                                    Operating Capacity (SERP-030)
                                  </span>
                                  <Select
                                    aria-label="Operating Capacity"
                                    value={operatingCapacity}
                                    onChange={(e) => setOperatingCapacity(e.target.value as 'segregated' | 'solo')}
                                    options={[
                                      { value: 'segregated', label: 'Supervisor Approval' },
                                      { value: 'solo', label: 'Solo Operator (Compensated Audit)' },
                                    ]}
                                  />
                                </div>
                                {operatingCapacity === 'segregated' && (
                                  <div>
                                    <Select
                                      label="Authorizing Supervisor"
                                      aria-label="Authorizing Supervisor"
                                      value={selectedApproverId}
                                      onChange={(e) => setSelectedApproverId(e.target.value)}
                                      options={
                                        availableSupervisors.length > 0
                                          ? availableSupervisors.map((s) => ({
                                              value: s.person_id,
                                              label: `${s.name} (${s.seat})`,
                                            }))
                                          : [{ value: '', label: loadingSupervisors ? 'Loading supervisors…' : 'No supervisor found' }]
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}

                  {reversalError && (
                    <div className="space-y-1 p-2.5 rounded-lg bg-error-container/40 border border-error/30">
                      <p role="alert" className="text-xs font-semibold text-error">
                        {reversalError === 'sale_not_found'
                          ? 'Sale not found. Please verify the receipt or invoice number.'
                          : formatResilienceErrorMessage(reversalError)}
                      </p>
                      {isRetryableError(reversalError) && (
                        <Button
                          size="xs"
                          variant="outlined"
                          onClick={handleReversalSubmit}
                          loading={submittingReversal}
                          icon={<RefreshCw size={12} aria-hidden="true" />}
                        >
                          Retry {reversalType === 'void' ? 'Void' : 'Return'}
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outlined" onClick={() => setReturnModalOpen(false)} disabled={submittingReversal}>
                      Cancel
                    </Button>
                    {lookedUpSale && !lookedUpSale.is_fully_voided && (
                      <Button
                        variant="primary"
                        onClick={handleReversalSubmit}
                        loading={submittingReversal}
                        disabled={
                          returnReason.trim().length < 3 ||
                          calculatedReturnTotal <= 0 ||
                          !canTransact(isOnline) ||
                          (!isCurrentUserManager && operatingCapacity === 'segregated' && !selectedApproverId)
                        }
                      >
                        Process {reversalType === 'void' ? 'Void' : 'Return'} (MVR {calculatedReturnTotal.toFixed(2)})
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Surface>
          </div>
        </div>
      )}

      {/* Official Tax Receipt Modal Dialog */}
      {receiptModalOpen && saleResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="w-full max-w-sm">
            <Surface variant="elevated" padding="md" className="rounded-2xl space-y-3" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="flex items-center justify-between pb-2 border-b border-outline-variant/60">
                <div className="flex items-center gap-2">
                  <Receipt size={17} style={{ color: 'var(--md-sys-color-primary)' }} aria-hidden="true" />
                  <h2 className="text-base font-bold" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                    Tax Receipt
                  </h2>
                </div>
                <Button
                  size="sm"
                  variant="text"
                  onClick={() => setReceiptModalOpen(false)}
                  aria-label="Close dialog"
                >
                  ✕
                </Button>
              </div>

              {/* Monospace Authentic Receipt Card */}
              <div className="p-4 rounded-xl font-mono text-xs bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-on-surface)] border-2 border-dashed border-[var(--md-sys-color-outline-variant)] shadow-inner space-y-2">
                <div className="text-center pb-2 border-b border-dashed border-[var(--md-sys-color-outline-variant)]">
                  <p className="font-black text-sm tracking-wider uppercase">{outlet?.name ?? 'starqPOS'}</p>
                  <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] font-sans font-medium uppercase mt-0.5">
                    {formatReceiptGstDetails(saleResult).receiptSubtitle}
                  </p>
                  {saleResult.receipt_number && (
                    <p className="text-xs font-bold text-[var(--md-sys-color-on-surface)] mt-1">
                      Receipt: <span className="font-mono font-bold">{saleResult.receipt_number}</span>
                    </p>
                  )}
                  <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">
                    Invoice: {saleResult.invoice_number}
                  </p>
                  <p className="text-[9px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                    GST Status: {formatReceiptGstDetails(saleResult).statusBadge}
                  </p>
                </div>

                {saleResult.lines && saleResult.lines.length > 0 && (
                  <div className="py-2 border-b border-dashed border-[var(--md-sys-color-outline-variant)] space-y-1">
                    {saleResult.lines.map((line, idx) => (
                      <div key={idx} className="flex justify-between items-start text-[11px]">
                        <div className="pr-2 truncate">
                          <span>{line.name}</span>
                          <span className="text-[var(--md-sys-color-on-surface-variant)] ml-1">×{line.quantity}</span>
                        </div>
                        <span className="tabular-nums font-semibold shrink-0">
                          MVR {Number(line.net_amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1 pt-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--md-sys-color-on-surface-variant)]">Subtotal</span>
                    <span className="font-semibold tabular-nums">MVR {Number(saleResult.subtotal).toFixed(2)}</span>
                  </div>
                  {(() => {
                    const gst = formatReceiptGstDetails(saleResult);
                    return (
                      <div className="flex justify-between">
                        <span className="text-[var(--md-sys-color-on-surface-variant)]">{gst.label}</span>
                        <span className={`tabular-nums ${gst.isRegistered ? 'font-semibold' : 'text-[11px] font-medium'}`}>
                          {gst.value}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="flex justify-between font-bold text-sm pt-1.5 border-t border-dashed border-[var(--md-sys-color-outline-variant)]">
                    <span>TOTAL</span>
                    <span className="font-black tabular-nums">MVR {Number(saleResult.total_amount).toFixed(2)}</span>
                  </div>
                  {saleResult.tendered_amount !== undefined && (
                    <>
                      <div className="flex justify-between text-[var(--md-sys-color-on-surface-variant)] pt-1">
                        <span>Tendered</span>
                        <span className="font-semibold tabular-nums">MVR {Number(saleResult.tendered_amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-[var(--positive)]">
                        <span>Change{Number(saleResult.change_amount ?? 0) > 0 ? '' : ' (none)'}</span>
                        <span className="tabular-nums">MVR {Number(saleResult.change_amount ?? 0).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="text-center pt-2 border-t border-dashed border-[var(--md-sys-color-outline-variant)] text-[10px] text-[var(--md-sys-color-on-surface-variant)] font-sans">
                  <p>Thank you for your business!</p>
                  <p className="text-[9px]">Duplicate-proof • Server Authoritative</p>
                </div>
              </div>

              {printStatus === 'print_failed' && (
                <div
                  role="alert"
                  className="p-2 rounded-lg border text-xs space-y-1"
                  style={{
                    borderColor: 'var(--md-sys-color-error, #f87171)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--md-sys-color-error, #f87171)',
                  }}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={13} aria-hidden="true" />
                    <span>Printer Failure</span>
                  </div>
                  <p className="text-[10px] opacity-90">
                    Printer is unavailable. Sale is committed and reprint is safe.
                  </p>
                </div>
              )}

              {/* Receipt Modal Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outlined"
                  className="flex-1"
                  disabled={!receipt && !saleResult}
                  loading={printStatus === 'printing'}
                  onClick={() => handlePrintReceipt(true)}
                  icon={<Copy size={13} aria-hidden="true" />}
                >
                  Re-print Copy
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  className="flex-1"
                  loading={printStatus === 'printing'}
                  onClick={() => handlePrintReceipt(false)}
                  icon={<Printer size={13} aria-hidden="true" />}
                >
                  {printStatus === 'print_failed' ? 'Retry Print' : 'Print'}
                </Button>
              </div>
            </Surface>
          </div>
        </div>
      )}
    </div>
  );
};