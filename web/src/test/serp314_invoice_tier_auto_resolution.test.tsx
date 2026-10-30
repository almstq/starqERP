import { describe, expect, it, beforeEach, vi } from 'vitest';
import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ERPProvider, useERP } from '../context/ERPContext';
import * as apiGateway from '../services/apiGateway';
import { resolvePriceListForCustomer, type PriceList } from '../domain/priceLists';

// SERP-314 acceptance criterion 3 — "Creating invoice automatically resolves
// item unit price based on customer tier". ERPContext.createInvoice derives the
// effective PriceList from the target customer's bound priceListId when the
// caller supplies no explicit priceList. These tests drive the real context in
// demo (unsigned) mode: the registry holds a locally-created list, the customer
// is bound to its code, and the invoice goes through the actual
// createInvoice -> resolveItemPrice pipeline.
function TierAutoResolutionHarness() {
  const { createInvoice, invoices, createCustomer, createPriceList, archivePriceList, priceLists } = useERP();
  const [boundId, setBoundId] = useState('');

  const seedRegistry = async () => {
    await createPriceList({
      code: 'trade_15',
      name: 'Trade 15',
      description: '',
      discountPercent: 15,
      itemOverrides: [],
    });
  };

  const bindCustomer = async () => {
    const cust = await createCustomer({
      name: 'Bound One',
      phone: '+960 7000001',
      email: 'bound@client.mv',
      type: 'Individual',
      island: "Male'",
      vehicles: [],
      notes: '',
      priceListId: 'trade_15',
    });
    setBoundId(cust.id);
  };

  const invoice = (priceList?: PriceList) => {
    createInvoice({
      customerId: boundId,
      customerName: 'Bound One',
      customerPhone: '+960 7000001',
      customerIsland: "Male'",
      date: '2026-09-08',
      dueDate: '2026-09-22',
      items: [
        {
          id: 'inventory-1',
          description: 'Test item',
          quantity: 2,
          unitPrice: 100,
          amount: 200,
          category: 'Material/Part',
        },
      ],
      subtotal: 200,
      gstRate: 0.08,
      gstAmount: 16,
      totalAmount: 216,
      amountPaid: 0,
      balanceDue: 216,
      status: 'Sent',
      notes: 'SERP-314 criterion 3 fixture',
      bankDetails: 'Test account',
      priceList,
    });
  };

  return (
    <>
      <button onClick={seedRegistry}>Seed registry</button>
      <button onClick={bindCustomer}>Bind customer</button>
      <button onClick={() => archivePriceList('trade_15')}>Archive price list</button>
      <button onClick={() => invoice(undefined)}>Invoice bound</button>
      <button
        onClick={() =>
          invoice({
            id: 'price-list-override',
            name: 'Override 20',
            discountPercent: 20,
            itemOverrides: [],
          })
        }
      >
        Invoice explicit override
      </button>
      <output data-testid="unit-price">{invoices[0]?.items[0]?.unitPrice ?? ''}</output>
      <output data-testid="amount">{invoices[0]?.items[0]?.amount ?? ''}</output>
      <output data-testid="subtotal">{invoices[0]?.subtotal ?? ''}</output>
      <output data-testid="registry-count">{priceLists.length}</output>
      <output data-testid="active-count">{priceLists.filter((list) => list.active !== false).length}</output>
      <output data-testid="bound-customer-id">{boundId}</output>
    </>
  );
}

describe('SERP-314 invoice tier auto-resolution', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({
      ok: true,
      customer: { customer_id: 'test-backend-customer' },
    } as any);
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue({ ok: true, customers: [] } as any);
  });

  it('auto-derives the bound tier when no explicit price list is supplied', async () => {
    render(
      <ERPProvider>
        <TierAutoResolutionHarness />
      </ERPProvider>
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Seed registry' }));
    await waitFor(() => expect(screen.getByTestId('registry-count')).toHaveTextContent('5'));
    fireEvent.click(screen.getByRole('button', { name: 'Bind customer' }));
    await waitFor(() => expect(screen.getByTestId('bound-customer-id')).not.toHaveTextContent(''));
    fireEvent.click(screen.getByRole('button', { name: 'Invoice bound' }));

    expect(screen.getByTestId('unit-price')).toHaveTextContent('85');
    expect(screen.getByTestId('amount')).toHaveTextContent('170');
    expect(screen.getByTestId('subtotal')).toHaveTextContent('170');
  });

  it('keeps an explicit caller-supplied price list as the winning override', async () => {
    render(
      <ERPProvider>
        <TierAutoResolutionHarness />
      </ERPProvider>
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Seed registry' }));
    await waitFor(() => expect(screen.getByTestId('registry-count')).toHaveTextContent('5'));
    fireEvent.click(screen.getByRole('button', { name: 'Bind customer' }));
    await waitFor(() => expect(screen.getByTestId('bound-customer-id')).not.toHaveTextContent(''));
    fireEvent.click(screen.getByRole('button', { name: 'Invoice explicit override' }));

    expect(screen.getByTestId('unit-price')).toHaveTextContent('80');
    expect(screen.getByTestId('amount')).toHaveTextContent('160');
  });

  it('leaves unbound customers at standard pricing', async () => {
    render(
      <ERPProvider>
        <TierAutoResolutionHarness />
      </ERPProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Invoice bound' }));

    expect(screen.getByTestId('unit-price')).toHaveTextContent('100');
    expect(screen.getByTestId('amount')).toHaveTextContent('200');
  });

  it('leaves a bound code with no registry row at standard pricing (Unknown Tier)', async () => {
    render(
      <ERPProvider>
        <TierAutoResolutionHarness />
      </ERPProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bind customer' }));
    await waitFor(() => expect(screen.getByTestId('bound-customer-id')).not.toHaveTextContent(''));
    fireEvent.click(screen.getByRole('button', { name: 'Invoice bound' }));

    expect(screen.getByTestId('unit-price')).toHaveTextContent('100');
    expect(screen.getByTestId('amount')).toHaveTextContent('200');
  });

  it('never auto-applies an archived price list (falls back to standard pricing)', async () => {
    render(
      <ERPProvider>
        <TierAutoResolutionHarness />
      </ERPProvider>
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Seed registry' }));
    await waitFor(() => expect(screen.getByTestId('registry-count')).toHaveTextContent('5'));
    fireEvent.click(screen.getByRole('button', { name: 'Bind customer' }));
    await waitFor(() => expect(screen.getByTestId('bound-customer-id')).not.toHaveTextContent(''));
    fireEvent.click(screen.getByRole('button', { name: 'Archive price list' }));
    await waitFor(() => expect(screen.getByTestId('active-count')).toHaveTextContent('4'));
    fireEvent.click(screen.getByRole('button', { name: 'Invoice bound' }));

    expect(screen.getByTestId('unit-price')).toHaveTextContent('100');
    expect(screen.getByTestId('amount')).toHaveTextContent('200');
  });
});

describe('SERP-314 resolvePriceListForCustomer domain lookup', () => {
  it('matches the stable binding code on list.id, never the registry UUID', () => {
    expect(
      resolvePriceListForCustomer({ priceListId: 'wholesale' }, [
        { id: 'wholesale', code: 'wholesale', name: 'Wholesale', discountPercent: 10, itemOverrides: [] },
      ])
    ).toMatchObject({ id: 'wholesale' });

    expect(
      resolvePriceListForCustomer(
        { priceListId: 'wholesale' },
        [{ id: 'uuid-from-registry', code: 'wholesale', name: 'Wholesale', discountPercent: 10, itemOverrides: [] }]
      )
    ).toBeUndefined();

    expect(
      resolvePriceListForCustomer(
        { priceListId: 'retail' },
        [{ id: 'retail', code: 'retail', name: 'Retail', active: false, discountPercent: 10, itemOverrides: [] }]
      )
    ).toBeUndefined();
  });

  it('is undefined for an unbound customer or an empty registry', () => {
    expect(resolvePriceListForCustomer(undefined, [])).toBeUndefined();
    expect(resolvePriceListForCustomer(null, [])).toBeUndefined();
    expect(resolvePriceListForCustomer({}, [])).toBeUndefined();
    expect(resolvePriceListForCustomer({ priceListId: 'retail' }, undefined)).toBeUndefined();
  });
});
