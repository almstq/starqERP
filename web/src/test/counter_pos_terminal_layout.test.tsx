import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { CounterView } from '../components/counter/CounterView';
import * as apiGateway from '../services/apiGateway';
import * as authService from '../services/auth';
import { UserSession } from '../services/auth';

const session: UserSession = {
  person_id: 'user-pos-terminal',
  person_uuid: '00000000-0000-4000-8000-000000000109',
  name: 'Ahmed Cashier',
  email: 'cashier@starqpos.mv',
  seats: ['counter'],
  acting_as: 'counter',
  seat_label: 'Senior Cashier',
  csrf: 'csrf-pos-terminal',
  allowed_entities: ['starq-retail'],
  current_organisation_id: '00000000-0000-4000-8000-000000000001',
  current_book_id: 'book-retail',
  organisations: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      slug: 'starq-retail',
      name: 'Starq Retail Outlet',
      books: [{ id: 'book-retail', code: 'MAIN', name: 'Main', is_default: true, archetype_id: 'retail_pos' }],
    },
  ],
} as UserSession;

const OUTLET = '00000000-0000-4000-8000-000000000301';
const PRODUCT_A = '00000000-0000-4000-8000-000000000401';
const PRODUCT_B = '00000000-0000-4000-8000-000000000402';

const CATALOGUE = {
  ok: true,
  locations: [{ id: OUTLET, code: 'RETAIL-01', name: 'Male Central Outlet', kind: 'retail', active: true }],
  products: [
    { id: PRODUCT_A, sku: 'SKU-COLA-CAN', kind: 'stock', name: 'Coca Cola 330ml', barcode: '5449000000996', sale_allowed: true, active: true },
    { id: PRODUCT_B, sku: 'SKU-WATER-500', kind: 'stock', name: 'Mineral Water 500ml', barcode: '6291000000111', sale_allowed: true, active: true },
  ],
  on_hand: [
    { organisation_id: '00000000-0000-4000-8000-000000000001', location_id: OUTLET, product_id: PRODUCT_A, derived_quantity: 50 },
    { organisation_id: '00000000-0000-4000-8000-000000000001', location_id: OUTLET, product_id: PRODUCT_B, derived_quantity: 30 },
  ],
  prices: [
    { product_id: PRODUCT_A, source: 'product_prices', unit_amount: 15, discount_percent: 0, price_list_version: null, currency: 'MVR' },
    { product_id: PRODUCT_B, source: 'product_prices', unit_amount: 7, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  ],
};

function renderTerminal() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <CounterView />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Cashier-ready POS terminal layout & presentation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.spyOn(authService, 'fetchCurrentUser').mockResolvedValue(session);
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(CATALOGUE as any);
  });

  it('renders cashier identity bar, outlet context, and online indicator', async () => {
    renderTerminal();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Counter' })).toBeInTheDocument();
    });

    // Cashier identity, Exit to ERP, and outlet info
    expect(screen.getByRole('button', { name: /Exit to ERP/i })).toBeInTheDocument();
    expect(screen.getByText('Ahmed Cashier')).toBeInTheDocument();
    expect(screen.getByText('Male Central Outlet')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('filters products using category navigation pills', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue({
      ok: true,
      locations: [{ id: OUTLET, code: 'RETAIL-01', name: 'Male Central Outlet', kind: 'retail', active: true }],
      products: [
        { id: PRODUCT_A, category: 'Beverages', sku: 'SKU-COLA-CAN', kind: 'stock', name: 'Coca Cola 330ml', barcode: '5449000000996', sale_allowed: true, active: true },
        { id: PRODUCT_B, category: 'Groceries', sku: 'SKU-WATER-500', kind: 'stock', name: 'Mineral Water 500ml', barcode: '6291000000111', sale_allowed: true, active: true },
      ],
      on_hand: [
        { organisation_id: '00000000-0000-4000-8000-000000000001', location_id: OUTLET, product_id: PRODUCT_A, derived_quantity: 50 },
        { organisation_id: '00000000-0000-4000-8000-000000000001', location_id: OUTLET, product_id: PRODUCT_B, derived_quantity: 30 },
      ],
      prices: [
        { product_id: PRODUCT_A, source: 'product_prices', unit_amount: 15, discount_percent: 0, price_list_version: null, currency: 'MVR' },
        { product_id: PRODUCT_B, source: 'product_prices', unit_amount: 7, discount_percent: 0, price_list_version: null, currency: 'MVR' },
      ],
    } as any);

    renderTerminal();

    await waitFor(() => {
      expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument();
      expect(screen.getByText('Mineral Water 500ml')).toBeInTheDocument();
    });

    // Category tabs exist
    expect(screen.getByRole('tab', { name: /All/i })).toBeInTheDocument();
    const beveragesTab = screen.getByRole('tab', { name: /Beverages/i });
    expect(beveragesTab).toBeInTheDocument();
    const groceriesTab = screen.getByRole('tab', { name: /Groceries/i });
    expect(groceriesTab).toBeInTheDocument();

    // Click Beverages -> only Coca Cola is visible
    fireEvent.click(beveragesTab);
    expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument();
    expect(screen.queryByText('Mineral Water 500ml')).toBeNull();

    // Click Groceries -> only Mineral Water is visible
    fireEvent.click(groceriesTab);
    expect(screen.queryByText('Coca Cola 330ml')).toBeNull();
    expect(screen.getByText('Mineral Water 500ml')).toBeInTheDocument();

    // Click All -> both are visible
    fireEvent.click(screen.getByRole('tab', { name: /All/i }));
    expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument();
    expect(screen.getByText('Mineral Water 500ml')).toBeInTheDocument();
  });

  it('gracefully falls back to default outlet and catalogue when backend has empty data', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue({
      ok: true,
      locations: [],
      products: [],
      on_hand: [],
      prices: [],
    } as any);

    renderTerminal();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Counter' })).toBeInTheDocument();
    });

    // Never shows "No outlet" or "No Till"
    expect(screen.queryByText(/No outlet/i)).toBeNull();
    expect(screen.queryByText(/No Till/i)).toBeNull();
    expect(screen.getByText('Main POS Counter')).toBeInTheDocument();
    expect(screen.getByText(/Till #0010/)).toBeInTheDocument();

    // Built-in retail items are rendered
    expect(screen.getByText('Coca-Cola 330ml Can')).toBeInTheDocument();
  });

  it('opens till session with cash float and lands in register', async () => {
    const postSpy = vi.spyOn(apiGateway, 'apiPost').mockResolvedValue({
      ok: true,
      session: {
        id: 'session-pos-001',
        session_number: 'CS-0001',
        location_id: OUTLET,
        status: 'open',
        currency: 'MVR',
        opening_float: 150,
      },
    } as any);

    renderTerminal();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Counter' })).toBeInTheDocument();
    });

    const openTillBtn = screen.getAllByRole('button', { name: 'Open Till' })[0];
    expect(openTillBtn).toBeInTheDocument();
    fireEvent.click(openTillBtn);

    // Modal opens
    expect(screen.getByRole('heading', { name: /Open Till & Start Shift/i })).toBeInTheDocument();
    const floatInput = screen.getByLabelText(/Opening Cash Float/i);
    expect(floatInput).toBeInTheDocument();

    // Enter opening float and submit
    fireEvent.change(floatInput, { target: { value: '150.00' } });
    const submitBtn = screen.getByRole('button', { name: /Open Till & Start/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/api/ops/counter/session/open',
        expect.objectContaining({
          location_id: OUTLET,
          opening_float: 150,
        }),
      );
    });

    // Modal is closed, cashier is in register screen
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Open Till & Start Shift/i })).toBeNull();
    });
    expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument();
  });

  it('displays a live running subtotal and total due as items are added', async () => {
    renderTerminal();

    await waitFor(() => {
      expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument();
    });

    // Before adding: running total is 0.00 (both subtotal and total due)
    expect(screen.getAllByText('MVR 0.00').length).toBeGreaterThanOrEqual(1);

    const colaButton = screen.getByRole('button', { name: /Coca Cola 330ml/i });
    fireEvent.doubleClick(colaButton); // +1 Coca Cola (15 MVR)
    fireEvent.doubleClick(colaButton); // +1 Coca Cola (15 MVR) -> 30 MVR

    const waterButton = screen.getByRole('button', { name: /Mineral Water 500ml/i });
    fireEvent.doubleClick(waterButton); // +1 Water (7 MVR) -> Total 37 MVR

    await waitFor(() => {
      // Running total display in dominant typography: 37.00
      expect(screen.getAllByText('MVR 37.00').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('provides large tender method selectors and quick tender input', async () => {
    renderTerminal();

    await waitFor(() => {
      expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument();
    });

    // Cash, Card, Transfer, Mixed buttons
    expect(screen.getByRole('button', { name: /cash/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /card/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /transfer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mixed/i })).toBeInTheDocument();

    // Switch to Card
    fireEvent.click(screen.getByRole('button', { name: /card/i }));
    expect(screen.getByLabelText(/card tendered/i)).toBeInTheDocument();
  });

  it('renders a receipt tape and an obvious Start New Sale button post-sale', async () => {
    vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({
      ok: true,
      counter_sale: {
        invoice_id: 'inv-pos-101',
        invoice_number: 'SI-10001',
        payment_id: 'pay-pos-101',
        receipt_number: 'RCT-10001',
        location_id: OUTLET,
        subtotal: 37,
        tax_total: 2.22,
        total_amount: 39.22,
        payment_method: 'cash',
        tendered_amount: 50,
        change_amount: 10.78,
        lines: [
          { product_id: PRODUCT_A, name: 'Coca Cola 330ml', quantity: 2, unit_price: 15, net_amount: 30 },
          { product_id: PRODUCT_B, name: 'Mineral Water 500ml', quantity: 1, unit_price: 7, net_amount: 7 },
        ],
        on_hand: {},
      },
    } as any);

    renderTerminal();

    await waitFor(() => {
      expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Coca Cola 330ml/i }));
    const complete = screen.getByRole('button', { name: /Complete sale/i });
    await waitFor(() => expect((complete as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(complete);

    // Post-sale receipt tape display
    await waitFor(() => {
      expect(screen.getByText('Sale complete')).toBeInTheDocument();
    });

    expect(screen.getByText('RCT-10001')).toBeInTheDocument();
    expect(screen.getByText(/MVR 39\.22/)).toBeInTheDocument();
    expect(screen.getByText(/MVR 50\.00/)).toBeInTheDocument();
    expect(screen.getByText(/MVR 10\.78/)).toBeInTheDocument();

    // Obvious "Start New Sale" action
    const newSaleBtn = screen.getByRole('button', { name: /Start New Sale/i });
    expect(newSaleBtn).toBeInTheDocument();

    // Clicking New Sale resets post-sale receipt and readies terminal for next customer
    fireEvent.click(newSaleBtn);
    expect(screen.queryByText('Sale complete')).toBeNull();
    expect(screen.getByText(/Cart is empty/i)).toBeInTheDocument();
  });

  it('adds product to cart directly on single tap / click and increments on subsequent taps', async () => {
    renderTerminal();

    await waitFor(() => {
      expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument();
    });

    const productBtn = screen.getByRole('button', { name: /Coca Cola 330ml/i });
    expect(screen.getByText(/Cart is empty/i)).toBeInTheDocument();

    // Single click/tap adds 1 to cart
    fireEvent.click(productBtn);
    expect(screen.queryByText(/Cart is empty/i)).toBeNull();
    expect(screen.getByText('in cart ×1')).toBeInTheDocument();

    // Subsequent click increments quantity to 2
    fireEvent.click(productBtn);
    expect(screen.getByText('in cart ×2')).toBeInTheDocument();
  });

  it('SERP-449: renders product-card category badge and price with whitespace-nowrap and truncate', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue({
      ok: true,
      locations: [{ id: OUTLET, code: 'RETAIL-01', name: 'Male Central Outlet', kind: 'retail', active: true }],
      products: [
        { id: PRODUCT_A, category: 'HOUSEHOLD', sku: 'SKU-COLA-CAN', kind: 'stock', name: 'Household Cleaner 500ml', barcode: '5449000000996', sale_allowed: true, active: true },
      ],
      on_hand: [
        { organisation_id: '00000000-0000-4000-8000-000000000001', location_id: OUTLET, product_id: PRODUCT_A, derived_quantity: 50 },
      ],
      prices: [
        { product_id: PRODUCT_A, source: 'product_prices', unit_amount: 21.5, discount_percent: 0, price_list_version: null, currency: 'MVR' },
      ],
    } as any);

    renderTerminal();

    await waitFor(() => {
      expect(screen.getByText('Household Cleaner 500ml')).toBeInTheDocument();
    });

    const categoryBadge = screen.getByTitle('HOUSEHOLD');
    expect(categoryBadge).toBeInTheDocument();
    expect(categoryBadge.className).toContain('whitespace-nowrap');
    expect(categoryBadge.className).toContain('truncate');

    const priceText = screen.getByText(/MVR[\s\u00A0]*21\.50/);
    expect(priceText).toBeInTheDocument();
    const priceContainer = priceText.closest('.whitespace-nowrap');
    expect(priceContainer).not.toBeNull();
  });
});
