import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ERPProvider } from '../context/ERPContext';
import { PriceListsTab } from '../components/settings/PriceListsTab';
import * as apiGateway from '../services/apiGateway';
import * as authService from '../services/auth';
import { UserSession } from '../services/auth';

/**
 * Copilot finding (PR #121, thread 3966710111): PriceListsTab can render while
 * the authenticated registry fetch is still pending (ERPContext resets
 * priceLists to DEMO_PRICE_LISTS and sets priceListsLoading=true). In that
 * window, Edit/Archive could be triggered against DEMO rows that have no
 * registryId, which throws "Price list registry id is missing." from
 * update/archive (ERPContext.tsx:2172/2211).
 *
 * Bounded UI-only guard (seq 2881): Edit/Archive are rendered only when the
 * registry has loaded and the row carries a real registryId
 * (priceListsLoading false AND list.registryId present). No migration, RLS,
 * or authorization semantics changed.
 */

const adminSession: UserSession = {
  person_id: 'user-serp314-pricelists-tab',
  name: 'Test Owner',
  email: 'owner@pricelists-tab.mv',
  seats: ['managing_director'],
  acting_as: 'managing_director',
  seat_label: 'Managing Director',
  csrf: 'csrf-pricelists-tab',
  allowed_entities: ['serp314-pricelists-tab-workshop'],
  current_organisation_id: 'org-pricelists-100',
  current_book_id: 'book-pricelists-100',
  organisations: [
    {
      id: 'org-pricelists-100',
      slug: 'serp314-pricelists-tab-workshop',
      name: 'PriceLists Tab Test Workshop Pvt Ltd',
      books: [
        {
          id: 'book-pricelists-100',
          code: 'MAIN',
          name: 'Main Operating Book',
          is_default: true,
          archetype_id: 'automotive_workshop',
        },
      ],
    },
  ],
  platform_entitlement: null,
  application: {
    id: 'app-pricelists-tab',
    status: 'approved',
    name: 'PriceLists Tab Test Workshop',
    legal_name: 'PriceLists Tab Test Workshop Pvt Ltd',
    created_at: new Date().toISOString(),
  },
} as UserSession;

const REAL_REGISTRY = {
  ok: true,
  customers: [],
  jobs: [],
  invoices: [],
  expenses: [],
  payments: [],
  suppliers: [],
  purchaseOrders: [],
  events: [],
  price_lists: [
    {
      code: 'trade_15',
      name: 'Trade Discount',
      registry_id: '00000000-0000-4000-8000-000000000011',
      discount_percent: 15,
      active: true,
      version: 2,
    },
    {
      code: 'vip_night',
      name: 'VIP Night',
      registry_id: '00000000-0000-4000-8000-000000000022',
      discount_percent: 5,
      active: true,
      version: 1,
    },
  ],
} as any;

function renderTab() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ERPProvider>
          <PriceListsTab />
        </ERPProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('SERP-314 PriceListsTab admin mutations are guarded during registry load', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authService, 'fetchCurrentUser').mockResolvedValue(adminSession);
    vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({ ok: true } as any);
  });

  it('hides Edit/Archive while the registry fetch is pending (DEMO rows, no registryId)', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockImplementation(() => new Promise(() => {}));
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Retail')).toBeTruthy();
    });

    expect(screen.queryAllByRole('button', { name: /^Edit /i })).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: /^Archive /i })).toHaveLength(0);
  });

  it('renders Edit/Archive only once the authenticated registry row carries a real registryId', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(REAL_REGISTRY);
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Trade Discount')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'Edit Trade Discount' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archive Trade Discount' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit VIP Night' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archive VIP Night' })).toBeTruthy();
  });

  it('keeps Edit/Archive hidden when the registry read is denied and only DEMO rows remain', async () => {
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue({
      ok: false,
      error: 'seat_not_authorized',
      customers: [],
      jobs: [],
      invoices: [],
      expenses: [],
      payments: [],
      suppliers: [],
      purchaseOrders: [],
      events: [],
      price_lists: [],
    } as any);
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Wholesale')).toBeTruthy();
    });

    expect(screen.queryAllByRole('button', { name: /^Edit /i })).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: /^Archive /i })).toHaveLength(0);
  });
});