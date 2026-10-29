// tests/spos008_adversarial_review.test.tsx
// Vision INDEPENDENT ADVERSARIAL REVIEW artifact for PR #159 / SPOS-008.
// Review-only. NOT part of the PR.
//
// The PR's own suite proves printer FAILURE is handled. It does not prove
// printer CANCELLATION is. window.print() returning normally is treated by the
// product as `printed` -- but a cashier who dismisses the print dialog has NOT
// printed anything, and the UI will claim they have.
//
// These cases are written to FAIL against the current head if the claim in the
// PR body ("Explicit Print-Failed State") does not cover cancellation.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { CounterView } from '../components/counter/CounterView';
import * as apiGateway from '../services/apiGateway';

const MOCK_OUTLET = '00000000-0000-4000-8000-000000000010';
const MOCK_CATALOGUE = {
  ok: true,
  locations: [{ id: MOCK_OUTLET, code: 'MAIN', name: 'Main Store Counter', kind: 'outlet', active: true }],
  products: [{ id: 'p1', sku: 'SKU-COKE', kind: 'stock', name: 'Coca Cola 330ml', barcode: '888001', sale_allowed: true, active: true }],
  on_hand: [{ location_id: MOCK_OUTLET, product_id: 'p1', derived_quantity: 50 }],
  prices: [{ product_id: 'p1', source: 'product_prices', unit_amount: 15, discount_percent: 0, price_list_version: null, currency: 'MVR' }],
  gst_registration_status: 'registered', gst_rate: 0.08, gst_rate_percent: 8,
};
const MOCK_SALE = {
  invoice_id: 'inv-adv-1', invoice_number: 'SI-90001', payment_id: 'pay-adv-1',
  receipt_number: 'RCT-90001', location_id: MOCK_OUTLET, subtotal: 15, tax_total: 1.2,
  total_amount: 16.2, payment_method: 'cash', tendered_amount: 20, change_amount: 3.8,
  lines: [{ product_id: 'p1', name: 'Coca Cola 330ml', quantity: 1, unit_price: 15, net_amount: 15 }],
  on_hand: {},
};
const MOCK_RECEIPT = { receipt: { receipt_id: 'pay-adv-1', receipt_number: 'RCT-90001', invoice_number: 'SI-90001', currency: 'MVR', renders: 1, tendered_amount: 20, change_amount: 3.8, total_amount: 16.2, tender: [{ payment_method: 'cash', amount_tendered: 20, tender_order: 1 }] } };

function renderTerminal() {
  return render(<MemoryRouter><CounterView /></MemoryRouter>);
}

async function completeASale() {
  await waitFor(() => expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /Coca Cola 330ml/i }));
  const complete = screen.getByRole('button', { name: /Complete sale/i });
  await waitFor(() => expect((complete as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(complete);
  await waitFor(() => expect(screen.getByText('Sale complete')).toBeInTheDocument());
}

describe('SPOS-008 adversarial: printer CANCELLATION and silent-failure surfaces', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.spyOn(apiGateway, 'apiGet').mockImplementation(async (path: string) => {
      if (path.includes('/api/ops/counter/catalogue')) return MOCK_CATALOGUE as any;
      if (path.includes('/api/ops/counter/session/current')) return { ok: true, session: { id: 's1', status: 'open', opening_float: 100 } } as any;
      if (path.includes('/api/ops/counter/receipt')) return MOCK_RECEIPT as any;
      return { ok: true } as any;
    });
    vi.spyOn(apiGateway, 'apiPost').mockResolvedValue({ ok: true, renders: 2 } as any);
    vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({ ok: true, counter_sale: MOCK_SALE } as any);
    window.print = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it('ADVERSARIAL: dismissing the print dialog is NOT reported as "Receipt printed"', async () => {
    // A real browser CANCELS the print dialog without throwing. window.print()
    // returns undefined and NO exception is raised. The product currently maps
    // "no exception" to status 'printed'.
    window.print = vi.fn(); // returns normally = the cancellation case

    renderTerminal();
    await completeASale();

    fireEvent.click(screen.getByRole('button', { name: /Print Receipt/i }));

    await waitFor(() => expect(window.print).toHaveBeenCalled());

    // Ask the product what state it is now in.
    const claimsPrinted = screen.queryByText(/Receipt printed/i) !== null;
    const showsFailure = screen.queryByRole('alert') !== null;

    console.log('DIAG cancel-case: claims "Receipt printed" =', claimsPrinted);
    console.log('DIAG cancel-case: shows any alert         =', showsFailure);

    // The honest requirement: a cancelled print must NOT be asserted as done.
    expect(claimsPrinted).toBe(false);
  });

  it('ADVERSARIAL: receipt data unavailable at print time must surface, not silently print', async () => {
    renderTerminal();
    await completeASale();

    // Receipt endpoint now returns nothing usable.
    vi.spyOn(apiGateway, 'apiGet').mockImplementation(async (path: string) => {
      if (path.includes('/api/ops/counter/catalogue')) return MOCK_CATALOGUE as any;
      if (path.includes('/api/ops/counter/session/current')) return { ok: true, session: { id: 's1', status: 'open', opening_float: 100 } } as any;
      if (path.includes('/api/ops/counter/receipt')) return {} as any; // no receipt, no receipt_number
      return { ok: true } as any;
    });

    fireEvent.click(screen.getByRole('button', { name: /Print Receipt/i }));

    await new Promise((r) => setTimeout(r, 150));
    console.log('DIAG empty-receipt: window.print called =', (window.print as any).mock?.calls?.length);
    console.log('DIAG empty-receipt: alert shown =', screen.queryByRole('alert') !== null);
    expect(window.print).not.toHaveBeenCalled();
  });

  it('ADVERSARIAL: a reprint that fails server-side must not leave a false "printed" claim', async () => {
    window.print = vi.fn();
    renderTerminal();
    await completeASale();

    // The render endpoint rejects.
    vi.spyOn(apiGateway, 'apiPost').mockRejectedValue(new Error('render_increment_failed'));

    fireEvent.click(screen.getByRole('button', { name: /Re-print \(duplicate\)/i }));
    await new Promise((r) => setTimeout(r, 150));

    console.log('DIAG reprint-fail: claims printed =', screen.queryByText(/Receipt printed/i) !== null);
    console.log('DIAG reprint-fail: alert shown    =', screen.queryByRole('alert') !== null);
    expect(screen.queryByText(/Receipt printed/i)).toBe(null);
  });
});
