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
  person_id: 'user-serp085-counter',
  person_uuid: '00000000-0000-4000-8000-000000000102',
  name: 'Test Counter Operator',
  email: 'counter@serp085.mv',
  seats: ['counter'],
  acting_as: 'counter',
  seat_label: 'Counter',
  csrf: 'csrf-serp085-counter',
  allowed_entities: ['demo-garage'],
  current_organisation_id: '00000000-0000-4000-8000-000000000002',
  current_book_id: 'book-serp085',
  organisations: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      slug: 'demo-garage',
      name: 'Demo Garage',
      books: [{ id: 'book-serp085', code: 'MAIN', name: 'Main', is_default: true, archetype_id: 'automotive_workshop' }],
    },
  ],
} as UserSession;

const OUTLET = '00000000-0000-4000-8000-000000000301';
const PRODUCT_A = '00000000-0000-4000-8000-000000000401';
const PRODUCT_B = '00000000-0000-4000-8000-000000000402';

const CATALOGUE = {
  ok: true,
  locations: [{ id: OUTLET, code: 'DEMO-WORKSHOP', name: 'Demo Workshop', kind: 'workshop', active: true }],
  products: [
    { id: PRODUCT_A, sku: 'DEMO-STOCK-OIL', kind: 'stock', name: 'Engine Oil 5W30', barcode: '6291041500213', sale_allowed: true, active: true },
    { id: PRODUCT_B, sku: 'DEMO-CONS-FILTER', kind: 'consumable', name: 'Oil Filter', barcode: null, sale_allowed: true, active: true },
    { id: 'service-1', sku: 'DEMO-SVC-PAINT', kind: 'service', name: 'Paint Service', barcode: null, sale_allowed: true, active: true },
  ],
  on_hand: [
    { organisation_id: '00000000-0000-4000-8000-000000000002', location_id: OUTLET, product_id: PRODUCT_A, derived_quantity: 10 },
    { organisation_id: '00000000-0000-4000-8000-000000000002', location_id: OUTLET, product_id: PRODUCT_B, derived_quantity: 0 },
  ],
  prices: [
    { product_id: PRODUCT_A, source: 'product_prices', unit_amount: 100, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  ],
};

function renderCounter() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <CounterView />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('SERP-085 counter view (cart and hold workflow against the real backend)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.spyOn(authService, 'fetchCurrentUser').mockResolvedValue(session);
  });

  it('loads the tenant counter catalogue and renders selectable products with on-hand', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(CATALOGUE as any);
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText('Engine Oil 5W30')).toBeTruthy();
    });

    expect(screen.getByText('10 in stock')).toBeTruthy();
    expect(screen.getByText('0 in stock')).toBeTruthy();
    expect(screen.queryByText('Paint Service')).toBeNull();
  });

  it('adds products to the cart and reports line/item counts', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(CATALOGUE as any);
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText('Engine Oil 5W30')).toBeTruthy();
    });

    const oilButton = screen.getByRole('button', { name: /Engine Oil 5W30/i });
    // double click = add one (single-click selects, double-click adds)
    fireEvent.doubleClick(oilButton);
    fireEvent.doubleClick(oilButton);
    fireEvent.doubleClick(screen.getByRole('button', { name: /Oil Filter/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 line\(s\) · 3 item\(s\)/)).toBeTruthy();
    });
  });

  it('builds a server-authoritative COUNTER_SALE payload (identifiers + tender input, no computed money)', async () => {
    const dispatch = vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({
      ok: true,
      counter_sale: {
        invoice_id: 'inv-1',
        invoice_number: 'SI-00001',
        payment_id: 'pay-1',
        receipt_number: 'RCT-00001',
        location_id: OUTLET,
        subtotal: 100,
        tax_total: 6,
        total_amount: 106,
        payment_method: 'cash',
        tendered_amount: 200,
        change_amount: 94,
        tender: [{ method: 'cash', amount_tendered: 200 }],
        lines: [],
        on_hand: {},
      },
    } as any);
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(CATALOGUE as any);
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText('Engine Oil 5W30')).toBeTruthy();
    });

    fireEvent.doubleClick(screen.getByRole('button', { name: /Engine Oil 5W30/i }));
    fireEvent.doubleClick(screen.getByRole('button', { name: /Oil Filter/i }));

    // SERP-087: the operator declares what was handed over (cash 200).
    const cashTendered = screen.getByLabelText(/Cash tendered/i) as HTMLInputElement;
    fireEvent.change(cashTendered, { target: { value: '200' } });

    const complete = screen.getByRole('button', { name: /Complete sale/i });
    await waitFor(() => expect((complete as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(complete);

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    const [{ command, payload }] = dispatch.mock.calls[0] as [{ command: string; payload: Record<string, unknown> }];
    expect(command).toBe('COUNTER_SALE');
    expect(payload).toEqual({
      location_id: OUTLET,
      tax_mode: 'exclusive',
      items: [
        { product_id: PRODUCT_A, quantity: 1 },
        { product_id: PRODUCT_B, quantity: 1 },
      ],
      payment_method: 'cash',
      tender: [{ method: 'cash', amount_tendered: 200 }],
    });
    // The client declares identifiers AND what the customer handed over — it
    // never computes or sends a price, subtotal, tax, total or change figure.
    expect(JSON.stringify(payload)).not.toMatch(/\bprice\b|subtotal|\btax\b|\btotal\b|change/i);
  });

  it('shows the server-returned tender fields and receipt number after a sale (SERP-087)', async () => {
    vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({
      ok: true,
      counter_sale: {
        invoice_id: 'inv-1',
        invoice_number: 'SI-00001',
        payment_id: 'pay-1',
        receipt_number: 'RCT-00001',
        location_id: OUTLET,
        subtotal: 100,
        tax_total: 6,
        total_amount: 106,
        payment_method: 'cash',
        tendered_amount: 200,
        change_amount: 94,
        tender: [{ method: 'cash', amount_tendered: 200 }],
        lines: [],
        on_hand: {},
      },
    } as any);
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(CATALOGUE as any);
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText('Engine Oil 5W30')).toBeTruthy();
    });

    fireEvent.doubleClick(screen.getByRole('button', { name: /Engine Oil 5W30/i }));
    const cashTendered = screen.getByLabelText(/Cash tendered/i) as HTMLInputElement;
    fireEvent.change(cashTendered, { target: { value: '200' } });

    const complete = screen.getByRole('button', { name: /Complete sale/i });
    await waitFor(() => expect((complete as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(complete);

    await waitFor(() => {
      expect(screen.getByText('RCT-00001')).toBeTruthy();
    });
    expect(screen.getByText(/MVR 200\.00/)).toBeTruthy();
    expect(screen.getByText(/MVR 94\.00/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /View receipt/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Re-print \(duplicate\)/i })).toBeTruthy();
  });

  it('shows the server-returned totals after a successful sale and clears the cart', async () => {
    vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({
      ok: true,
      counter_sale: {
        invoice_id: 'inv-1',
        invoice_number: 'SI-00001',
        payment_id: 'pay-1',
        location_id: OUTLET,
        subtotal: 100,
        tax_total: 6,
        total_amount: 106,
        lines: [],
        on_hand: {},
      },
    } as any);
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(CATALOGUE as any);
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText('Engine Oil 5W30')).toBeTruthy();
    });

    fireEvent.doubleClick(screen.getByRole('button', { name: /Engine Oil 5W30/i }));

    const complete = screen.getByRole('button', { name: /Complete sale/i });
    await waitFor(() => expect((complete as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(complete);

    await waitFor(() => {
      expect(screen.getByText('SI-00001')).toBeTruthy();
    });
    expect(screen.getByText(/MVR 106\.00/)).toBeTruthy();
    expect(screen.getByText(/Select a product to start/i)).toBeTruthy();
  });

  it('holds a cart and resumes it within the expiry window', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(CATALOGUE as any);
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText('Engine Oil 5W30')).toBeTruthy();
    });

    fireEvent.doubleClick(screen.getByRole('button', { name: /Engine Oil 5W30/i }));
    fireEvent.click(screen.getByRole('button', { name: /Hold cart/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Resume/i })).toBeTruthy();
    });

    expect(screen.getByText('1 line(s), 1 item(s)')).toBeTruthy();
    expect(screen.queryByText('2 line(s) · 3 item(s)')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Resume/i }));

    await waitFor(() => {
      expect(screen.getByText(/1 line\(s\) · 1 item\(s\)/)).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /Resume/i })).toBeNull();
  });

  it('discards a held cart without resuming it', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(CATALOGUE as any);
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText('Engine Oil 5W30')).toBeTruthy();
    });

    fireEvent.doubleClick(screen.getByRole('button', { name: /Engine Oil 5W30/i }));
    fireEvent.click(screen.getByRole('button', { name: /Hold cart/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Discard/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Discard/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Discard/i })).toBeNull();
    });
  });

  it('surfaces a server rejection closed, without clearing the cart or deducting stock', async () => {
    const err = new apiGateway.ApiError(400, 'stock_line_insufficient_on_hand', 'req-1');
    vi.spyOn(apiGateway, 'dispatchCommand').mockRejectedValue(err);
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(CATALOGUE as any);
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText('Engine Oil 5W30')).toBeTruthy();
    });

    fireEvent.doubleClick(screen.getByRole('button', { name: /Engine Oil 5W30/i }));
    fireEvent.click(screen.getByRole('button', { name: /Complete sale/i }));

    await waitFor(() => {
      expect(screen.getByText(/stock_line_insufficient_on_hand/)).toBeTruthy();
    });
    expect(screen.getByText(/1 line\(s\) · 1 item\(s\)/)).toBeTruthy();
  });

  it('keeps the complete and hold buttons disabled on an empty cart', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(CATALOGUE as any);
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText('Engine Oil 5W30')).toBeTruthy();
    });

    expect((screen.getByRole('button', { name: /Complete sale/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Hold cart/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows an unavailable state when the catalogue read fails closed', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockRejectedValue(new apiGateway.ApiError(500, 'counter_catalogue_unavailable', 'req-x'));
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText(/Counter unavailable/i)).toBeTruthy();
    });
    expect(screen.getByText(/counter_catalogue_unavailable/)).toBeTruthy();
  });

  it('resolves a scanned barcode through the server and adds the product to the cart (SERP-086)', async () => {
    const resolve = vi.spyOn(apiGateway, 'apiGet').mockImplementation(async (path: string) => {
      if (String(path).startsWith('/api/ops/counter/catalogue')) return CATALOGUE as any;
      if (String(path).startsWith('/api/ops/counter/resolve')) {
        return {
          ok: true,
          product: { id: PRODUCT_A, sku: 'DEMO-STOCK-OIL', kind: 'stock', name: 'Engine Oil 5W30', barcode: '6291041500213', active: true, sale_allowed: true },
          price: { resolved: true, source: 'product_prices', unit_amount: 100, discount_percent: 0, price_list_id: null, price_list_version: null, currency: 'MVR' },
          tax: { mode: 'exclusive', rate: 0.08, tax_amount: 8, net_amount: 100, gross_amount: 108 },
          resolution: true,
        };
      }
      throw new apiGateway.ApiError(404, 'not_found', 'req-x');
    });
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText('Engine Oil 5W30')).toBeTruthy();
    });

    const scan = screen.getByLabelText(/Scan or type a barcode/i) as HTMLInputElement;
    fireEvent.change(scan, { target: { value: '6291041500213' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));

    await waitFor(() => {
      expect(resolve).toHaveBeenCalledWith('/api/ops/counter/resolve?barcode=6291041500213');
    });
    await waitFor(() => {
      expect(screen.getByText(/1 line\(s\) · 1 item\(s\)/)).toBeTruthy();
    });
  });

  it('shows the server-approved price from the catalogue without computing it client-side (SERP-086)', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(CATALOGUE as any);
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText('MVR 100.00')).toBeTruthy();
    });
  });

  it('views and re-renders a duplicate-proof receipt (SERP-087)', async () => {
    const PAY = '00000000-0000-4000-8000-000000000501';
    const receiptBody = (renders: number) => ({
      ok: true,
      receipt: {
        receipt_id: PAY,
        receipt_number: 'RCT-00001',
        invoice_number: 'SI-00001',
        currency: 'MVR',
        renders,
        tendered_amount: 200,
        change_amount: 94,
        total_amount: 106,
        tender: [{ payment_method: 'cash', amount_tendered: 200, tender_order: 1 }],
      },
    });
    vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({
      ok: true,
      counter_sale: {
        invoice_id: 'inv-1',
        invoice_number: 'SI-00001',
        payment_id: PAY,
        receipt_number: 'RCT-00001',
        location_id: OUTLET,
        subtotal: 100,
        tax_total: 6,
        total_amount: 106,
        payment_method: 'cash',
        tendered_amount: 200,
        change_amount: 94,
        tender: [{ method: 'cash', amount_tendered: 200 }],
        lines: [],
        on_hand: {},
      },
    } as any);
    let rendersNow = 0;
    vi.spyOn(apiGateway, 'apiGet').mockImplementation(async (path: string) => {
      if (String(path).startsWith('/api/ops/counter/catalogue')) return CATALOGUE as any;
      if (String(path).startsWith('/api/ops/counter/receipt')) return receiptBody(rendersNow) as any;
      throw new apiGateway.ApiError(404, 'not_found', 'req-x');
    });
    const render = vi.spyOn(apiGateway, 'apiPost').mockImplementation(async (_path: string, _body: any) => {
      rendersNow = rendersNow + 1;
      return { ok: true, renders: rendersNow } as any;
    });
    renderCounter();

    await waitFor(() => {
      expect(screen.getByText('Engine Oil 5W30')).toBeTruthy();
    });

    fireEvent.doubleClick(screen.getByRole('button', { name: /Engine Oil 5W30/i }));
    const cashTendered = screen.getByLabelText(/Cash tendered/i) as HTMLInputElement;
    fireEvent.change(cashTendered, { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: /Complete sale/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /View receipt/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /View receipt/i }));
    await waitFor(() => {
      expect(screen.getByText(/rendered ×0/i)).toBeTruthy();
    });

    // Re-print is a duplicate of the SAME financial record — never a second one.
    fireEvent.click(screen.getByRole('button', { name: /Re-print \(duplicate\)/i }));
    await waitFor(() => {
      expect(render).toHaveBeenCalledWith('/api/ops/counter/receipt/render', { receipt_id: PAY });
    });
    await waitFor(() => {
      expect(screen.getByText(/rendered ×1/i)).toBeTruthy();
    });
  });
});