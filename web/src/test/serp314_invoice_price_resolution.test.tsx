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
});
