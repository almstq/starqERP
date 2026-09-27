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

const OUTLET_ID = '00000000-0000-4000-8000-000000000301';
const PROD_COLA = 'prod-coca-cola';
const PROD_RICE = 'prod-basmati-rice';
const PROD_PANADOL = 'prod-panadol';

const MIXED_CATALOGUE = {
  ok: true,
  gst_registration_status: 'registered',
  gst_rate: 0.08,
  gst_rate_percent: 8,
  locations: [
    {
      id: OUTLET_ID,
      code: 'RETAIL-01',
      name: 'Male Central Outlet',
      kind: 'retail',
      tax_regime: 'gst_general',
      active: true,
    },
  ],
  products: [
    {
      id: PROD_COLA,
      sku: 'COLA-330',
      kind: 'stock',
      name: 'Coca-Cola 330ml Can',
      barcode: '5449000000996',
      tax_classification: 'standard_rated',
      sale_allowed: true,
      active: true,
    },
    {
      id: PROD_RICE,
      sku: 'RICE-1KG',
      kind: 'stock',
      name: 'Premium Basmati Rice 1kg',
      barcode: '8901234567890',
      tax_classification: 'zero_rated',
      sale_allowed: true,
      active: true,
    },
    {
      id: PROD_PANADOL,
      sku: 'PANADOL-10',
      kind: 'stock',
      name: 'Panadol Extra 500mg 10s',
      barcode: '5000000000019',
      tax_classification: 'exempt',
      sale_allowed: true,
      active: true,
    },
  ],
  on_hand: [
    { organisation_id: '00000000-0000-4000-8000-000000000001', location_id: OUTLET_ID, product_id: PROD_COLA, derived_quantity: 50 },
    { organisation_id: '00000000-0000-4000-8000-000000000001', location_id: OUTLET_ID, product_id: PROD_RICE, derived_quantity: 50 },
    { organisation_id: '00000000-0000-4000-8000-000000000001', location_id: OUTLET_ID, product_id: PROD_PANADOL, derived_quantity: 50 },
  ],
  prices: [
    { product_id: PROD_COLA, source: 'product_prices', unit_amount: 15.00, discount_percent: 0, price_list_version: null, currency: 'MVR' },
    { product_id: PROD_RICE, source: 'product_prices', unit_amount: 38.00, discount_percent: 0, price_list_version: null, currency: 'MVR' },
    { product_id: PROD_PANADOL, source: 'product_prices', unit_amount: 25.00, discount_percent: 0, price_list_version: null, currency: 'MVR' },
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

describe('SERP-448 POS cart line GST display & conventional checkout totals (Founder #6931 §6, §7)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.spyOn(authService, 'fetchCurrentUser').mockResolvedValue(session);
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(MIXED_CATALOGUE as any);
  });

  it('displays compact line-level GST treatments and reconciles mixed basket totals to server result', async () => {
    renderTerminal();

    // Wait for catalogue to load
    await waitFor(() => {
      expect(screen.getByText('Coca-Cola 330ml Can')).toBeInTheDocument();
    });

    // Add Cola (standard_rated 8%), Rice (zero_rated 0%), Panadol (exempt 0%)
    fireEvent.click(screen.getByText('Coca-Cola 330ml Can'));
    fireEvent.click(screen.getByText('Premium Basmati Rice 1kg'));
    fireEvent.click(screen.getByText('Panadol Extra 500mg 10s'));

    // Verify per-line GST treatment badges (Founder §6)
    const colaBadge = screen.getByTestId(`cart-line-gst-${PROD_COLA}`);
    const riceBadge = screen.getByTestId(`cart-line-gst-${PROD_RICE}`);
    const panadolBadge = screen.getByTestId(`cart-line-gst-${PROD_PANADOL}`);

    expect(colaBadge).toHaveTextContent('GST 8% · MVR 1.20');
    expect(riceBadge).toHaveTextContent('GST 0% · Zero-rated');
    expect(panadolBadge).toHaveTextContent('Exempt');

    // Verify conventional checkout accounting structure: Subtotal, GST, TOTAL DUE (Founder §7)
    const subtotalEl = screen.getByTestId('checkout-subtotal');
    const gstEl = screen.getByTestId('checkout-gst');
    const totalDueEl = screen.getByTestId('checkout-total-due');

    // Subtotal: 15.00 + 38.00 + 25.00 = 78.00
    expect(subtotalEl).toHaveTextContent('MVR 78.00');

    // GST = SUM(authoritative line GST amounts) = 1.20 + 0.00 + 0.00 = 1.20
    // Proves NO blanket basket rate (which would have yielded 78 * 0.08 = 6.24)
    expect(gstEl).toHaveTextContent('MVR 1.20');

    // TOTAL DUE = Subtotal + GST = 79.20
    expect(totalDueEl).toHaveTextContent('MVR 79.20');
  });

  it('dynamically recalculates line GST and totals when quantity changes', async () => {
    renderTerminal();

    await waitFor(() => {
      expect(screen.getByText('Coca-Cola 330ml Can')).toBeInTheDocument();
    });

    // Add Cola (qty 1)
    fireEvent.click(screen.getByText('Coca-Cola 330ml Can'));

    expect(screen.getByTestId(`cart-line-gst-${PROD_COLA}`)).toHaveTextContent('GST 8% · MVR 1.20');
    expect(screen.getByTestId('checkout-subtotal')).toHaveTextContent('MVR 15.00');
    expect(screen.getByTestId('checkout-gst')).toHaveTextContent('MVR 1.20');
    expect(screen.getByTestId('checkout-total-due')).toHaveTextContent('MVR 16.20');

    // Increase Cola qty to 2 via "+" button
    const increaseBtn = screen.getByRole('button', { name: /Increase Coca-Cola 330ml Can/i });
    fireEvent.click(increaseBtn);

    // Qty 2 * 15 = 30.00 -> line GST = 2.40
    expect(screen.getByTestId(`cart-line-gst-${PROD_COLA}`)).toHaveTextContent('GST 8% · MVR 2.40');
    expect(screen.getByTestId('checkout-subtotal')).toHaveTextContent('MVR 30.00');
    expect(screen.getByTestId('checkout-gst')).toHaveTextContent('MVR 2.40');
    expect(screen.getByTestId('checkout-total-due')).toHaveTextContent('MVR 32.40');
  });

  it('renders explicit not-registered state with zero tax and exact totals', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue({
      ...MIXED_CATALOGUE,
      gst_registration_status: 'not_registered',
      gst_rate: null,
      gst_rate_percent: null,
    } as any);

    renderTerminal();

    await waitFor(() => {
      expect(screen.getByText('Coca-Cola 330ml Can')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Coca-Cola 330ml Can'));

    // Line indicates No GST
    expect(screen.getByTestId(`cart-line-gst-${PROD_COLA}`)).toHaveTextContent('No GST');

    // Checkout displays explicit row
    expect(screen.getByTestId('checkout-gst-unregistered')).toHaveTextContent('Not GST registered — no GST');
    expect(screen.getByTestId('checkout-subtotal')).toHaveTextContent('MVR 15.00');
    expect(screen.getByTestId('checkout-total-due')).toHaveTextContent('MVR 15.00');
  });

  it('fails closed when authoritative rate is missing for registered entity', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue({
      ...MIXED_CATALOGUE,
      gst_registration_status: 'registered',
      gst_rate: null,
      gst_rate_percent: null,
    } as any);

    renderTerminal();

    await waitFor(() => {
      expect(screen.getByText('Coca-Cola 330ml Can')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Coca-Cola 330ml Can'));

    // Line and checkout flag unavailable rate
    expect(screen.getByTestId(`cart-line-gst-${PROD_COLA}`)).toHaveTextContent('Rate unavailable');
    expect(screen.getByTestId('checkout-gst-error')).toHaveTextContent('Rate unavailable');
    expect(screen.getByTestId('checkout-subtotal')).toHaveTextContent('MVR 15.00');

    // Complete sale button is disabled with fail-closed label
    const completeBtn = screen.getByRole('button', { name: /Tax rate unavailable/i });
    expect(completeBtn).toBeDisabled();
  });
});
