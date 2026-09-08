import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ERPProvider, useERP } from '../context/ERPContext';
import * as apiGateway from '../services/apiGateway';
import { priceListBindingName, PRICE_LIST_BINDING_OPTIONS } from '../domain/priceLists';

function BindingHarness() {
  const { createCustomer, customers, currentArchetype, currentTerms } = useERP();

  const createUser = (priceListId?: string) => {
    createCustomer({
      name: 'Ibrahim Shaan',
      phone: '+960 778-0001',
      email: 'ishaan@client.mv',
      type: 'Individual',
      island: "Male'",
      vehicles: [],
      notes: '',
      priceListId,
    });
  };

  return (
    <>
      <button onClick={() => createUser(undefined)} data-testid="create-no-binding">
        Create no binding
      </button>
      <button onClick={() => createUser('wholesale')} data-testid="create-wholesale">
        Create wholesale
      </button>
      <output data-testid="latest-price-list-id">{customers[0]?.priceListId ?? ''}</output>
      <output data-testid="latest-name">{customers[0]?.name ?? ''}</output>
      <output data-testid="term">{String(currentTerms.customer)}</output>
      <output data-testid="archetype">{String(Boolean(currentArchetype))}</output>
    </>
  );
}

describe('SERP-314 customer price list binding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({ ok: true } as any);
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue({ ok: true, customers: [] } as any);
  });

  it('persists priceListId on the created customer (set/read in ERPContext state)', () => {
    render(
      <ERPProvider>
        <BindingHarness />
      </ERPProvider>
    );

    fireEvent.click(screen.getByTestId('create-wholesale'));

    expect(screen.getByTestId('latest-price-list-id')).toHaveTextContent('wholesale');
    expect(screen.getByTestId('latest-name')).toHaveTextContent('Ibrahim Shaan');
  });

  it('preserves customers with no binding (priceListId stays undefined)', () => {
    render(
      <ERPProvider>
        <BindingHarness />
      </ERPProvider>
    );

    fireEvent.click(screen.getByTestId('create-no-binding'));

    expect(screen.getByTestId('latest-price-list-id')).toHaveTextContent('');
    const created = (apiGateway.dispatchCommand as any).mock.calls;
    const payload = created[0][0].payload as Record<string, unknown>;
    expect(payload.price_list_id).toBeUndefined();
  });

  it('includes price_list_id in the CUSTOMER command payload when bound (persist path)', () => {
    render(
      <ERPProvider>
        <BindingHarness />
      </ERPProvider>
    );

    fireEvent.click(screen.getByTestId('create-wholesale'));

    const spy = apiGateway.dispatchCommand as ReturnType<typeof vi.spyOn>;
    const calls = spy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    const payload = calls[0][0].payload as Record<string, unknown>;
    expect(calls[0][0].command).toBe('CUSTOMER');
    expect(payload.price_list_id).toBe('wholesale');
  });

  it('exposes the known binding tiers through the reference registry (UI source)', () => {
    const ids = PRICE_LIST_BINDING_OPTIONS.map((o) => o.id);
    expect(ids).toContain('retail');
    expect(ids).toContain('wholesale');
    expect(ids).toContain('resort');
    expect(ids).toContain('vip');

    expect(priceListBindingName('wholesale')).toBe('Wholesale');
    expect(priceListBindingName(undefined)).toBeUndefined();
    expect(priceListBindingName('')).toBeUndefined();
    expect(priceListBindingName('does-not-exist')).toBe('Unknown Tier (does-not-exist)');
  });
});
