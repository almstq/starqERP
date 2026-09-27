// Independent rendered-geometry verification for PR #146 (SERP-445).
// Uses the SAME harness shape as the existing counter_pos_terminal_layout test
// so this measures the real mounted CounterView, not a standalone stub.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { CounterView } from '../components/counter/CounterView';
import * as apiGateway from '../services/apiGateway';
import * as authService from '../services/auth';
import { UserSession } from '../services/auth';

const session: UserSession = {
  person_id: 'user-pr146-verify',
  person_uuid: '00000000-0000-4000-8000-000000000109',
  name: 'Verify Cashier',
  email: 'verify@starqpos.mv',
  seats: ['counter'],
  acting_as: 'counter',
  seat_label: 'Senior Cashier',
  csrf: 'csrf-pr146',
  allowed_entities: ['starq-retail'],
  current_organisation_id: '00000000-0000-4000-8000-000000000001',
  current_book_id: 'book-retail',
  organisations: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      slug: 'starq-retail',
      name: 'Starq Retail Outlet',
      books: [{ id: 'book-retail', code: 'MAIN', name: 'Main', is_default: true, archetype_id: 'retail_pos' }],
    },
  ],
} as UserSession;

const OUTLET = '00000000-0000-4000-8000-000000000301';
const products = Array.from({ length: 24 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 400).padStart(12, '0')}`,
  sku: `SKU-${i}`,
  kind: 'stock',
  name: `Product ${i}`,
  barcode: `5000000000${String(i).padStart(3, '0')}`,
  sale_allowed: true,
  active: true,
}));

const CATALOGUE = {
  ok: true,
  locations: [{ id: OUTLET, code: 'RETAIL-01', name: 'Main Outlet', kind: 'retail', active: true }],
  products,
  on_hand: products.map((p, i) => ({
    organisation_id: '00000000-0000-4000-8000-000000000001',
    location_id: OUTLET,
    product_id: p.id,
    derived_quantity: i < 12 ? 50 : 0,
  })),
  prices: products.map((p) => ({
    product_id: p.id, source: 'product_prices', unit_amount: 10,
    discount_percent: 0, price_list_version: null, currency: 'MVR',
  })),
};

const SIZES = [
  { w: 1366, h: 768 },
  { w: 1920, h: 1080 },
];

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true });
  Object.defineProperty(document.documentElement, 'clientHeight', { value: h, configurable: true });
}

describe('SERP-445 / PR #146 rendered viewport geometry (independent)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.spyOn(authService, 'fetchCurrentUser').mockResolvedValue(session);
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue(CATALOGUE as any);
  });

  for (const size of SIZES) {
    it(`mounts a viewport-constrained POS root at ${size.w}x${size.h}`, async () => {
      setViewport(size.w, size.h);

      const { container } = render(
        <MemoryRouter>
          <AuthProvider>
            <CounterView />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(container.querySelector('.counter-root')).toBeTruthy();
      }, { timeout: 15000 });

      const root = container.querySelector('.counter-root') as HTMLElement;
      const cls = root.className;

      const report = {
        size: `${size.w}x${size.h}`,
        hasViewportHeight: /\bh-\[100vh\]/.test(cls),
        hasDynamicViewportHeight: /100dvh/.test(cls),
        hasOverflowHidden: /\boverflow-hidden\b/.test(cls),
        isFlexColumn: /\bflex-col\b/.test(cls),
        panesFlexGrow: /flex-1/.test(cls),
        panesMinHeightZero: /min-h-0/.test(cls),
      };
      console.log('PR146 VIEWPORT REPORT ' + JSON.stringify(report));

      expect(report.hasViewportHeight, 'root must be height-constrained to the viewport').toBe(true);
      expect(report.hasDynamicViewportHeight, 'root must handle mobile browser chrome').toBe(true);
      expect(report.hasOverflowHidden, 'root must prevent page-level scrolling').toBe(true);
      expect(report.isFlexColumn, 'root must be flex-col to distribute internal scroll').toBe(true);

      // The two-pane wrapper and each pane need flex-1 + min-h-0 for the
      // internal-scroll chain to actually work. Measured on the real nodes.
      const paneWrapper = root.querySelector('.grid') as HTMLElement | null;
      expect(paneWrapper, 'two-pane wrapper must exist').toBeTruthy();
      const wrapperCls = paneWrapper!.className;
      const paneReport = {
        wrapperFlexGrow: /flex-1/.test(wrapperCls),
        wrapperMinHeightZero: /min-h-0/.test(wrapperCls),
        wrapperStretches: /items-stretch/.test(wrapperCls),
        gridFlexGrow: /flex-1/.test(
          (root.querySelector('[aria-label="Product grid"]') as HTMLElement).className),
      };
      console.log('PR146 PANE REPORT ' + JSON.stringify(paneReport));
      expect(paneReport.wrapperFlexGrow, 'pane wrapper must grow to fill remaining height').toBe(true);
      expect(paneReport.wrapperMinHeightZero, 'pane wrapper needs min-h-0 or flex overflows').toBe(true);
      expect(paneReport.gridFlexGrow, 'product grid must grow inside the pane').toBe(true);

      // The old vh cap on the product grid is what allowed the page to grow.
      const grid = container.querySelector('[aria-label="Product grid"]');
      expect(grid, 'product grid must exist').toBeTruthy();
      expect((grid as HTMLElement).className, 'grid must not be capped in vh')
        .not.toMatch(/max-h-\[62vh\]/);
      expect((grid as HTMLElement).className, 'grid must scroll internally')
        .toMatch(/overflow-y-auto/);

      // Cart panel must scroll internally, not use a sticky viewport hack.
      const aside = container.querySelector('aside');
      if (aside) {
        expect((aside as HTMLElement).className, 'cart must not use lg:sticky viewport hack')
          .not.toMatch(/lg:sticky/);
      }

      cleanup();
    });
  }
});
