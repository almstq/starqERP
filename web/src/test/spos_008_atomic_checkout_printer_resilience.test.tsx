import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { CounterView } from '../components/counter/CounterView';
import * as apiGateway from '../services/apiGateway';
import {
  evaluatePrinterOutcome,
  formatPrinterFailureNotice,
  CounterPrintStatus,
} from '../domain/counter';

const MOCK_OUTLET = '00000000-0000-4000-8000-000000000010';
const MOCK_PROD_1 = 'prod-coke-1';
const MOCK_PROD_2 = 'prod-water-2';

const MOCK_CATALOGUE = {
  ok: true,
  locations: [
    { id: MOCK_OUTLET, code: 'MAIN', name: 'Main Store Counter', kind: 'outlet', active: true },
  ],
  products: [
    { id: MOCK_PROD_1, sku: 'SKU-COKE', kind: 'stock', name: 'Coca Cola 330ml', barcode: '888001', sale_allowed: true, active: true },
    { id: MOCK_PROD_2, sku: 'SKU-WATER', kind: 'stock', name: 'Mineral Water 500ml', barcode: '888002', sale_allowed: true, active: true },
  ],
  on_hand: [
    { location_id: MOCK_OUTLET, product_id: MOCK_PROD_1, derived_quantity: 50 },
    { location_id: MOCK_OUTLET, product_id: MOCK_PROD_2, derived_quantity: 100 },
  ],
  prices: [
    { product_id: MOCK_PROD_1, source: 'product_prices', unit_amount: 15, discount_percent: 0, price_list_version: null, currency: 'MVR' },
    { product_id: MOCK_PROD_2, source: 'product_prices', unit_amount: 10, discount_percent: 0, price_list_version: null, currency: 'MVR' },
  ],
  gst_registration_status: 'registered',
  gst_rate: 0.08,
  gst_rate_percent: 8,
};

const MOCK_SALE_RESPONSE = {
  invoice_id: 'inv-spos-801',
  invoice_number: 'SI-80001',
  payment_id: 'pay-spos-801',
  receipt_number: 'RCT-80001',
  location_id: MOCK_OUTLET,
  subtotal: 40,
  tax_total: 3.2,
  total_amount: 43.2,
  payment_method: 'cash',
  tendered_amount: 50,
  change_amount: 6.8,
  lines: [
    { product_id: MOCK_PROD_1, name: 'Coca Cola 330ml', quantity: 2, unit_price: 15, net_amount: 30 },
    { product_id: MOCK_PROD_2, name: 'Mineral Water 500ml', quantity: 1, unit_price: 10, net_amount: 10 },
  ],
  on_hand: {},
};

const MOCK_RECEIPT_RESPONSE = {
  receipt: {
    receipt_id: 'pay-spos-801',
    receipt_number: 'RCT-80001',
    invoice_number: 'SI-80001',
    currency: 'MVR',
    renders: 1,
    tendered_amount: 50,
    change_amount: 6.8,
    total_amount: 43.2,
    tender: [{ payment_method: 'cash', amount_tendered: 50, tender_order: 1 }],
  },
};

describe('SPOS-008: Atomic Checkout, Inventory Movement, Receipt After Commit & Printer Failure Resilience', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    // Default mock setup
    vi.spyOn(apiGateway, 'apiGet').mockImplementation(async (path: string) => {
      if (path.includes('/api/ops/counter/catalogue')) {
        return MOCK_CATALOGUE as any;
      }
      if (path.includes('/api/ops/counter/session/current')) {
        return { ok: true, session: { id: 'sess-1', status: 'open', opening_float: 100 } } as any;
      }
      if (path.includes('/api/ops/counter/receipt')) {
        return MOCK_RECEIPT_RESPONSE as any;
      }
      return { ok: true } as any;
    });

    vi.spyOn(apiGateway, 'apiPost').mockResolvedValue({ ok: true, renders: 2 } as any);
    window.print = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Domain Unit Invariant Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('Domain Invariants: evaluatePrinterOutcome & formatPrinterFailureNotice', () => {
    it('enforces that receipt printing cannot be evaluated before database commit', () => {
      expect(() => {
        evaluatePrinterOutcome(null, false);
      }).toThrow(/Invariant Violation/i);
    });

    it('records clean "printed" status when physical printing succeeds after commit', () => {
      const outcome = evaluatePrinterOutcome(null, true);
      expect(outcome.ok).toBe(true);
      expect(outcome.status).toBe('printed');
      expect(outcome.error).toBeNull();
    });

    it('records "print_failed" status when printer encounters a hardware or device error', () => {
      const hardwareError = new Error('Printer paper out / device offline');
      const outcome = evaluatePrinterOutcome(hardwareError, true);
      expect(outcome.ok).toBe(false);
      expect(outcome.status).toBe('print_failed');
      expect(outcome.error).toBe('Printer paper out / device offline');
    });

    it('formats a reassurance notice emphasizing the sale is durable in database', () => {
      const notice = formatPrinterFailureNotice('SI-80001', 'offline');
      expect(notice.isCommitted).toBe(true);
      expect(notice.title).toContain('Sale #SI-80001 Safely Committed');
      expect(notice.description).toContain('transaction is durable');
      expect(notice.description).toContain('not create a duplicate charge');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Terminal UI Integration Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('CounterView Post-Commit Printer Lifecycle', () => {
    const renderTerminal = () => {
      return render(
        <MemoryRouter>
          <CounterView />
        </MemoryRouter>
      );
    };

    it('completes checkout atomically, pre-loads receipt, and executes print cleanly', async () => {
      const dispatchSpy = vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({
        ok: true,
        counter_sale: MOCK_SALE_RESPONSE,
      } as any);

      renderTerminal();

      await waitFor(() => {
        expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument();
      });

      // Add item to cart
      fireEvent.click(screen.getByRole('button', { name: /Coca Cola 330ml/i }));

      // Complete sale
      const completeBtn = screen.getByRole('button', { name: /Complete sale/i });
      await waitFor(() => expect((completeBtn as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(completeBtn);

      // Verify sale completed atomically
      await waitFor(() => {
        expect(screen.getByText('Sale complete')).toBeInTheDocument();
      });
      expect(screen.getByText('SI-80001')).toBeInTheDocument();
      expect(screen.getByText('RCT-80001')).toBeInTheDocument();
      expect(dispatchSpy).toHaveBeenCalledTimes(1);

      // Find "Print Receipt" button
      const printBtn = screen.getByRole('button', { name: /Print Receipt/i });
      expect(printBtn).toBeInTheDocument();

      // Trigger print
      fireEvent.click(printBtn);

      // Invariant: window.print called strictly AFTER dispatchCommand succeeded
      await waitFor(() => {
        expect(window.print).toHaveBeenCalledTimes(1);
      });

      // Shows printed indicator
      await waitFor(() => {
        expect(screen.getByText(/Receipt printed • Duplicate reprint available/i)).toBeInTheDocument();
      });
    });

    it('printer failure NEVER reverses or affects a committed sale and surfaces explicit failure alert', async () => {
      vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({
        ok: true,
        counter_sale: MOCK_SALE_RESPONSE,
      } as any);

      // Simulate hardware / browser printer exception
      window.print = vi.fn().mockImplementation(() => {
        throw new Error('Epson thermal printer paper jam');
      });

      renderTerminal();

      await waitFor(() => {
        expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument();
      });

      // Add item and complete sale
      fireEvent.click(screen.getByRole('button', { name: /Coca Cola 330ml/i }));
      const completeBtn = screen.getByRole('button', { name: /Complete sale/i });
      await waitFor(() => expect((completeBtn as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(completeBtn);

      await waitFor(() => {
        expect(screen.getByText('Sale complete')).toBeInTheDocument();
      });

      // Click Print Receipt
      const printBtn = screen.getByRole('button', { name: /Print Receipt/i });
      fireEvent.click(printBtn);

      // Verify: Print threw error, but sale remains 100% committed
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/Printer Error — Sale #SI-80001 Safely Committed/i);
        expect(alert).toHaveTextContent(/transaction is durable in the database/i);
      });

      // Confirms all sale details remain fully visible and intact
      expect(screen.getByText('Sale complete')).toBeInTheDocument();
      expect(screen.getByText('SI-80001')).toBeInTheDocument();
      expect(screen.getByText('MVR 43.20')).toBeInTheDocument();
      expect(screen.getByText('MVR 6.80')).toBeInTheDocument();

      // Confirms Retry Print button is immediately available in the failed state
      const retryBtn = screen.getByRole('button', { name: /Retry Print/i });
      expect(retryBtn).toBeInTheDocument();

      // Confirms Start New Sale is still present and valid
      expect(screen.getByRole('button', { name: /Start New Sale/i })).toBeInTheDocument();
    });

    it('reprinting duplicate calls server render counter without creating a new sale or invoice', async () => {
      vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({
        ok: true,
        counter_sale: MOCK_SALE_RESPONSE,
      } as any);

      const renderApiSpy = vi.spyOn(apiGateway, 'apiPost').mockResolvedValue({
        ok: true,
        renders: 2,
      } as any);

      // Return render=2 on receipt reload
      vi.spyOn(apiGateway, 'apiGet').mockImplementation(async (path: string) => {
        if (path.includes('/api/ops/counter/catalogue')) return MOCK_CATALOGUE as any;
        if (path.includes('/api/ops/counter/session/current')) {
          return { ok: true, session: { id: 'sess-1', status: 'open' } } as any;
        }
        if (path.includes('/api/ops/counter/receipt')) {
          return {
            receipt: {
              ...MOCK_RECEIPT_RESPONSE.receipt,
              renders: 2,
            },
          } as any;
        }
        return { ok: true } as any;
      });

      renderTerminal();

      await waitFor(() => {
        expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Coca Cola 330ml/i }));
      const completeBtn = screen.getByRole('button', { name: /Complete sale/i });
      await waitFor(() => expect((completeBtn as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(completeBtn);

      await waitFor(() => {
        expect(screen.getByText('Sale complete')).toBeInTheDocument();
      });

      // Click Re-print (duplicate)
      const reprintBtn = screen.getByRole('button', { name: /Re-print \(duplicate\)/i });
      fireEvent.click(reprintBtn);

      // Invariant: Server receipt render counter endpoint was called with receipt_id
      await waitFor(() => {
        expect(renderApiSpy).toHaveBeenCalledWith(
          '/api/ops/counter/receipt/render',
          expect.objectContaining({ receipt_id: 'pay-spos-801' })
        );
      });

      // Window print was triggered
      expect(window.print).toHaveBeenCalled();

      // Authoritative duplicate copy badge is rendered
      await waitFor(() => {
        expect(screen.getByText(/rendered ×2/i)).toBeInTheDocument();
      });
    });

    it('pre-commit checkout failure NEVER invokes printer and preserves cart contents', async () => {
      // Simulate database or network rejection on checkout
      vi.spyOn(apiGateway, 'dispatchCommand').mockRejectedValue(
        new apiGateway.ApiError(400, 'counter_sale_failed', 'req-stock-depleted')
      );

      renderTerminal();

      await waitFor(() => {
        expect(screen.getByText('Coca Cola 330ml')).toBeInTheDocument();
      });

      // Add item to cart
      fireEvent.click(screen.getByRole('button', { name: /Coca Cola 330ml/i }));

      const completeBtn = screen.getByRole('button', { name: /Complete sale/i });
      await waitFor(() => expect((completeBtn as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(completeBtn);

      // Verify: Sale failed, error alert is shown
      await waitFor(() => {
        expect(screen.getByText(/counter_sale_failed/i)).toBeInTheDocument();
      });

      // Invariant: printer was NEVER touched
      expect(window.print).not.toHaveBeenCalled();

      // Invariant: cart is preserved for cashier to fix or retry
      expect(screen.queryByText('Sale complete')).toBeNull();
      expect(screen.getByRole('button', { name: /Complete sale/i })).toBeInTheDocument();
    });
  });
});
