import { describe, expect, it } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ERPProvider, useERP } from '../context/ERPContext';

function InvoiceCreationHarness() {
  const { createInvoice, invoices } = useERP();

  return (
    <>
      <button
        onClick={() => createInvoice({
          customerId: 'customer-1',
          customerName: 'Test Customer',
          customerPhone: '+960 7000000',
          customerIsland: 'Malé',
          date: '2026-09-08',
          dueDate: '2026-09-22',
          items: [{
            id: 'inventory-1',
            description: 'Test item',
            quantity: 2,
            unitPrice: 100,
            amount: 200,
            category: 'Material/Part',
          }],
          subtotal: 200,
          gstRate: 0.08,
          gstAmount: 16,
          totalAmount: 216,
          amountPaid: 0,
          balanceDue: 216,
          status: 'Sent',
          notes: 'SERP-314 acceptance fixture',
          bankDetails: 'Test account',
          priceList: {
            id: 'price-list-1',
            name: 'Wholesale',
            discountPercent: 20,
            itemOverrides: [],
          },
        })}
      >
        Create priced invoice
      </button>
      <output data-testid="latest-price">{invoices[0]?.items[0]?.unitPrice ?? ''}</output>
    </>
  );
}

// quantity 3 x MVR 0.05 is a known IEEE-754 drift case: 3 * 0.05 ===
// 0.15000000000000002 in raw JS. No priceList is supplied here at all --
// this proves createInvoice's own rounding holds even on the plain,
// no-priceList path, not just the price-resolution path above.
function DriftProneInvoiceHarness() {
  const { createInvoice, invoices } = useERP();

  return (
    <>
      <button
        onClick={() => createInvoice({
          customerId: 'customer-1',
          customerName: 'Test Customer',
          customerPhone: '+960 7000000',
          customerIsland: 'Malé',
          date: '2026-09-08',
          dueDate: '2026-09-22',
          items: [{
            id: 'inventory-2',
            description: 'Drift-prone item',
            quantity: 3,
            unitPrice: 0.05,
            amount: 0.15,
            category: 'Material/Part',
          }],
          subtotal: 0.15,
          gstRate: 0.08,
          gstAmount: 0.01,
          totalAmount: 0.16,
          amountPaid: 0,
          balanceDue: 0.16,
          status: 'Sent',
          notes: 'SERP-314 rounding regression fixture',
          bankDetails: 'Test account',
        })}
      >
        Create drift-prone invoice
      </button>
      <output data-testid="drift-amount">{invoices[0]?.items[0]?.amount ?? ''}</output>
      <output data-testid="drift-subtotal">{invoices[0]?.subtotal ?? ''}</output>
      <output data-testid="drift-total">{invoices[0]?.totalAmount ?? ''}</output>
      <output data-testid="drift-balance">{invoices[0]?.balanceDue ?? ''}</output>
    </>
  );
}

describe('SERP-314 invoice price resolution wiring', () => {
  it('applies a supplied price list during real ERPContext invoice creation', () => {
    render(
      <ERPProvider>
        <InvoiceCreationHarness />
      </ERPProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create priced invoice' }));

    expect(screen.getByTestId('latest-price')).toHaveTextContent('80');
  });

  it('rounds line amount/subtotal/total/balance to 2dp, no IEEE-754 drift', () => {
    render(
      <ERPProvider>
        <DriftProneInvoiceHarness />
      </ERPProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create drift-prone invoice' }));

    expect(screen.getByTestId('drift-amount')).toHaveTextContent('0.15');
    expect(screen.getByTestId('drift-subtotal')).toHaveTextContent('0.15');
    expect(screen.getByTestId('drift-total')).toHaveTextContent('0.16');
    expect(screen.getByTestId('drift-balance')).toHaveTextContent('0.16');
  });
});
