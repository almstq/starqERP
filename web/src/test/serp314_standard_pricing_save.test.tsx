import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ERPProvider, useERP } from '../context/ERPContext';
import { NewCustomerModal } from '../components/customers/NewCustomerModal';
import * as apiGateway from '../services/apiGateway';
import * as authService from '../services/auth';
import { UserSession } from '../services/auth';

/**
 * Copilot review findings (PR #121, seq 2809-2810 + seq 2872):
 *
 * 1. While the price list registry is loading, NewCustomerModal blocked saving
 *    a customer with Standard Pricing (no tier) - handleSubmit early-returned
 *    (`if (!name.trim() || priceListsLoading) return;`) and the Save button was
 *    disabled on `priceListsLoading`. The loading gate is only meaningful when
 *    a tiered binding has actually been selected, so the bounded fix scopes the
 *    gate to `priceListsLoading && priceListId`. Standard-pricing customers are
 *    no longer blocked by registry load; a tiered selection during load remains
 *    impossible anyway because the select itself stays disabled.
 *
 * 2. The registry is reset to DEMO_PRICE_LISTS (reference tiers) at the start
 *    of every authenticated session/tenant load so a previous tenant's real
 *    registry is never visible while the new one is pending, and DEMO options
 *    remain available during load/failure.
 *
 * Mocks (fetchCurrentUser, dispatchCommand) live in a top-level beforeEach so
 * every test has deterministic setup and ordering independence.
 */

function makeSession(id: string, orgId: string, orgSlug: string, orgName: string): UserSession {
  return {
    person_id: `user-${id}`,
    name: 'Test Owner',
    email: `owner@${id}.mv`,
    seats: ['managing_director'],
    acting_as: 'managing_director',
    seat_label: 'Managing Director',
    csrf: `csrf-${id}`,
    allowed_entities: [orgSlug],
    current_organisation_id: orgId,
    current_book_id: `book-${id}`,
    organisations: [
      {
        id: orgId,
        slug: orgSlug,
        name: orgName,
        books: [
          {
            id: `book-${id}`,
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
      id: `app-${id}`,
      status: 'approved',
      name: orgName,
      legal_name: orgName,
      created_at: new Date().toISOString(),
    },
  } as UserSession;
}

const activeSession = makeSession(
  'serp314-a',
  'org-serp314-100',
  'serp314-standard-pricing-workshop',
  'Standard Pricing Test Workshop Pvt Ltd',
);

const switchedSession = makeSession(
  'serp314-b',
  'org-serp314-200',
  'serp314-tenant-b-workshop',
  'Tenant B Test Workshop Pvt Ltd',
);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authService, 'fetchCurrentUser').mockResolvedValue(activeSession);
  vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({ ok: true } as any);
});

function ModalHarness() {
  const { setIsNewCustomerOpen, isNewCustomerOpen } = useERP();
  return (
    <>
      <button data-testid="open-modal" onClick={() => setIsNewCustomerOpen(true)}>
        Open modal
      </button>
      <output data-testid="open-state">{String(isNewCustomerOpen)}</output>
      <NewCustomerModal />
    </>
  );
}

async function renderModalWhilePriceListsLoading() {
  vi.spyOn(apiGateway, 'apiGet').mockImplementation(() => new Promise(() => {}));
  render(
    <MemoryRouter>
      <AuthProvider>
        <ERPProvider>
          <ModalHarness />
        </ERPProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByTestId('open-modal'));
  await waitFor(() => {
    expect(screen.getByText('Loading pricing tiers…')).toBeTruthy();
  });
}

function RegistryProbe() {
  const { priceLists, priceListsLoading } = useERP();
  const { login } = useAuth();
  return (
    <>
      <output data-testid="registry-codes">{priceLists.map((p) => p.code).join(',')}</output>
      <output data-testid="registry-loading">{String(priceListsLoading)}</output>
      <button data-testid="switch-tenant" onClick={() => login(switchedSession)}>
        Switch tenant
      </button>
    </>
  );
}

describe('SERP-314 standard-pricing save is not blocked by price list loading', () => {
  it('sanity: with apiGet pending, the modal is genuinely in the price-list loading state', async () => {
    await renderModalWhilePriceListsLoading();
    expect(screen.getByTestId('open-state')).toHaveTextContent('true');
  });

  it('saves a Standard Pricing (no tier) customer while the price list registry is still loading', async () => {
    await renderModalWhilePriceListsLoading();

    fireEvent.change(screen.getByPlaceholderText('e.g. Ibrahim Shaan or Horizon Trading'), {
      target: { value: 'Ibrahim Shaan' },
    });

    const saveButton = screen.getByRole('button', { name: /Save/i });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    const spy = apiGateway.dispatchCommand as ReturnType<typeof vi.spyOn>;
    expect(spy).toHaveBeenCalled();
    const command = spy.mock.calls[0][0];
    expect(command.command).toBe('CUSTOMER');
    expect(command.payload.price_list_id).toBeUndefined();
  });

  it('regression guard: a tiered binding is still impossible while the registry loads (select disabled)', async () => {
    await renderModalWhilePriceListsLoading();

    const loadingOption = screen.getByText('Loading pricing tiers…');
    const tierSelect = loadingOption.closest('select') as HTMLSelectElement;
    expect(tierSelect).toBeDisabled();
  });
});

describe('SERP-314 price list registry is preserved during authenticated load', () => {
  it('keeps DEMO tier options available while the registry fetch is pending (no empty-array clear)', async () => {
    await renderModalWhilePriceListsLoading();

    const loadingOption = screen.getByText('Loading pricing tiers…');
    const tierSelect = loadingOption.closest('select') as HTMLSelectElement;

    const wholesaleOption = Array.from(tierSelect.options).find((o) => o.value === 'wholesale');
    expect(wholesaleOption).toBeTruthy();
    expect(wholesaleOption?.text.trim()).toBe('Wholesale');
  });
});

describe('SERP-314 cross-tenant registry isolation', () => {
  it('resets to DEMO reference tiers at the start of a new tenant load; previous tenant registry is never shown', async () => {
    const realApiGet = vi.spyOn(apiGateway, 'apiGet').mockResolvedValue({
      ok: true,
      customers: [],
      jobs: [],
      invoices: [],
      expenses: [],
      payments: [],
      suppliers: [],
      purchaseOrders: [],
      events: [],
      price_lists: [{ code: 'org-a-tier-code', name: 'Org A Tier', discount_percent: 0, active: true, version: 1 }],
    } as any);

    render(
      <MemoryRouter>
        <AuthProvider>
          <ERPProvider>
            <RegistryProbe />
          </ERPProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('registry-codes')).toHaveTextContent('org-a-tier-code');
    });
    expect(screen.getByTestId('registry-loading')).toHaveTextContent('false');

    realApiGet.mockImplementation(() => new Promise(() => {}));
    fireEvent.click(screen.getByTestId('switch-tenant'));

    await waitFor(() => {
      const codes = screen.getByTestId('registry-codes').textContent ?? '';
      expect(codes).toContain('wholesale');
      expect(codes).not.toContain('org-a-tier-code');
    });
    expect(screen.getByTestId('registry-loading')).toHaveTextContent('true');
  });
});