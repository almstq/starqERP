import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ERPProvider } from '../context/ERPContext';
import { appRoutes } from '../app/router';
import * as apiGateway from '../services/apiGateway';
import * as authService from '../services/auth';
import { UserSession } from '../services/auth';

// SERP-234/component_reachability - proves the Counter POS screen is reached
// through the SAME route tree the real app uses (createMemoryRouter built
// from the exact appRoutes exported by app/router.tsx), not a standalone
// render of the component. This is what a dead-import or a route removed
// from AppShell's nav but never wired would fail: this test renders the
// router at /pos and asserts CounterView's own content appears, and that
// AppShell's own nav link to /pos exists - the same auth/session boundary
// every other authenticated view goes through (AuthGate -> AppShell -> Outlet).

const session: UserSession = {
  person_id: 'user-serp234-counter-route',
  person_uuid: '00000000-0000-4000-8000-000000000103',
  name: 'Test Counter Operator',
  email: 'counter-route@serp234.mv',
  seats: ['counter'],
  acting_as: 'counter',
  seat_label: 'Counter',
  csrf: 'csrf-serp234-counter-route',
  allowed_entities: ['demo-garage'],
  current_organisation_id: '00000000-0000-4000-8000-000000000002',
  current_book_id: 'book-serp234',
  organisations: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      slug: 'demo-garage',
      name: 'Demo Garage',
      books: [{ id: 'book-serp234', code: 'MAIN', name: 'Main', is_default: true, archetype_id: 'automotive_workshop' }],
    },
  ],
} as UserSession;

const EMPTY_CATALOGUE = { ok: true, locations: [], products: [], on_hand: [], prices: [] };

function renderAppAt(initialPath: string) {
  const memoryRouter = createMemoryRouter(appRoutes, { initialEntries: [initialPath] });
  return render(
    <ThemeProvider>
      <AuthProvider>
        <ERPProvider>
          <RouterProvider router={memoryRouter} />
        </ERPProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('SERP-234 Counter POS route reachability (real route tree, not a standalone render)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.spyOn(authService, 'fetchCurrentUser').mockResolvedValue(session);
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(EMPTY_CATALOGUE as any);
  });

  it('navigating to /pos through the real router renders CounterView, gated by the same AuthGate/AppShell boundary as every other authenticated view', async () => {
    renderAppAt('/pos');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Counter' })).toBeInTheDocument();
    });
  });

  it('AppShell exposes a Counter nav link pointing at /pos', async () => {
    renderAppAt('/');

    await waitFor(() => {
      const link = screen.getAllByRole('link', { name: /Counter/i })[0];
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/pos');
    });
  });
});
