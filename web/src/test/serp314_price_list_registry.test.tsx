import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ERPProvider, useERP } from '../context/ERPContext';
import { PriceListsTab } from '../components/settings/PriceListsTab';
import {
  canManagePriceListsForSession,
  priceListBindingName,
  priceListBindingOptions,
  resolveItemPrice,
  type PriceList,
} from '../domain/priceLists';
import { isCurrentSessionDataLoad } from '../lib/sessionLoadGuard';

function RegistryHarness() {
  const { priceLists } = useERP();
  return (
    <>
      <PriceListsTab />
      <output data-testid="registry-count">{priceLists.length}</output>
    </>
  );
}

describe('SERP-314 Gap 2 admin price-list registry', () => {
  it('invokes create, update, and archive through the actual admin UI', async () => {
    render(
      <ERPProvider>
        <RegistryHarness />
      </ERPProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'New Price List' }));
    fireEvent.change(screen.getByLabelText('Stable code *'), { target: { value: 'trade_15' } });
    fireEvent.change(screen.getByLabelText('Display name *'), { target: { value: 'Trade 15' } });
    fireEvent.change(screen.getByLabelText('Flat discount (%)'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Price List' }));

    expect(await screen.findByText('Trade 15')).toBeInTheDocument();
    expect(screen.getByText('15%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Trade 15' }));
    fireEvent.change(screen.getByLabelText('Display name *'), { target: { value: 'Trade 15 Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByText('Trade 15 Updated')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Archive Trade 15 Updated' }));
    await waitFor(() => expect(screen.getByText('Archived')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Delete Trade 15 Updated' })).not.toBeInTheDocument();
  });

  it('rejects duplicate and malformed admin input before mutation', async () => {
    render(
      <ERPProvider>
        <PriceListsTab />
      </ERPProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'New Price List' }));
    fireEvent.change(screen.getByLabelText('Stable code *'), { target: { value: 'retail' } });
    fireEvent.change(screen.getByLabelText('Display name *'), { target: { value: 'Duplicate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Price List' }));
    await waitFor(() => expect(screen.getAllByRole('alert').some((alert) => alert.textContent?.includes('Price list code already exists.'))).toBe(true));

    fireEvent.change(screen.getByLabelText('Stable code *'), { target: { value: 'bad code' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Price List' }));
    await waitFor(() => expect(screen.getAllByRole('alert').some((alert) => alert.textContent?.includes('Price list code is required and may only contain lowercase letters, numbers, hyphens, and underscores.'))).toBe(true));
  });

  it('keeps standard pricing unbound and derives active customer options from the registry', () => {
    const archived: PriceList = {
      id: 'old', name: 'Old', discountPercent: 10, itemOverrides: [], active: false,
    };
    const active: PriceList = {
      id: 'trade_15', name: 'Trade 15', discountPercent: 15, itemOverrides: [], active: true,
    };

    expect(resolveItemPrice({ id: 'p1', sellingPrice: 100 }, undefined)).toBe(100);
    expect(priceListBindingOptions([active, archived])).toEqual([{ id: 'trade_15', name: 'Trade 15' }]);
    expect(priceListBindingOptions([])).toEqual([]);
    expect(priceListBindingName('legacy_historical_code', [active])).toBe('Unknown Tier (legacy_historical_code)');
    expect(priceListBindingName(undefined, [active])).toBeUndefined();
  });

  it('uses the authoritative authenticated acting seat for live admin visibility', () => {
    expect(canManagePriceListsForSession({
      current_organisation_id: 'org-a',
      acting_as: 'managing_director',
      seats: ['managing_director'],
    })).toBe(true);
    expect(canManagePriceListsForSession({
      current_organisation_id: 'org-a',
      acting_as: 'counter',
      seats: ['counter', 'managing_director'],
    })).toBe(false);
    expect(canManagePriceListsForSession({
      current_organisation_id: 'org-a',
      acting_as: 'managing_director',
      seats: ['counter'],
    })).toBe(false);
    expect(canManagePriceListsForSession(null)).toBe(false);
  });

  it('rejects stale, cancelled, or cross-organisation data responses', () => {
    expect(isCurrentSessionDataLoad(2, 2, 'org-a', 'org-a', false)).toBe(true);
    expect(isCurrentSessionDataLoad(1, 2, 'org-a', 'org-a', false)).toBe(false);
    expect(isCurrentSessionDataLoad(2, 2, 'org-a', 'org-b', false)).toBe(false);
    expect(isCurrentSessionDataLoad(2, 2, 'org-a', 'org-a', true)).toBe(false);
  });
});
