/**
 * SERP-328 offline gateway fixtures.
 *
 * The app is fully gateway-driven (Google OAuth + /api/* RPCs). To keep the
 * suite deterministic and to respect the active security freeze, every /api/*
 * request is fulfilled IN THE BROWSER by Playwright route fixtures. The real
 * starq-api edge function and the linked Supabase project are never contacted.
 *
 * This is the "Simulates multi-tenant login / session switching" layer the
 * SERP-328 acceptance asks for. It mirrors the exact response shapes the
 * client already types against in `web/src/services/*`.
 *
 * NOTE (honesty): invitation lifecycle responses here are UI-circuit fixtures
 * only. The REAL accept_staff_invitation RPC path is classified defective under
 * SERP-300 (SECURITY DEFINER + null ACL + SQLSTATE 42703 memberships.role), so
 * the invitation acceptance journey is NEVER reported green from fixtures.
 */
import type { BrowserContext, Page, Route } from '@playwright/test';
import type { UserSession } from '../../src/services/auth';
import type { StaffInvitationRecord } from '../../src/services/apiGateway';

export interface CapturedRequest {
  ts: number;
  method: string;
  path: string;
  body?: unknown;
}

export interface Installation {
  captured: CapturedRequest[];
  opsEvents: Array<Record<string, unknown>>;
  currentlySwitched: { organisation_id?: string; book_id?: string };
  /** The mutable current session the gateway is serving. */
  current: UserSession | null;
  switchTo: (user: UserSession | null) => void;
}

export interface GatewayOptions {
  /** Session the gateway serves before any authentication (may be null). */
  session: () => UserSession | null;
  /** Session established on simulated Google sign-in. */
  afterAuth?: () => UserSession;
  invitations?: StaffInvitationRecord[];
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

const JSON_TYPES = /^application\/json/;

const E2E_PORT = process.env.E2E_PORT ?? '3001';
const ALLOWED_ORIGINS = [
  `http://localhost:${E2E_PORT}`,
  `http://127.0.0.1:${E2E_PORT}`,
];

/**
 * Install the offline gateway on a context/page.
 * Register order matters: the catch-all is registered first so the specific
 * `/api/**` matcher (registered second / checked first) wins for API calls.
 */
export async function installGateway(
  target: BrowserContext | Page,
  opts: GatewayOptions,
): Promise<Installation> {
  const state: Installation = {
    captured: [],
    opsEvents: [],
    currentlySwitched: {},
    current: opts.session(),
    switchTo: (user) => {
      state.current = user;
    },
  };

  const context = 'context' in target ? target.context() : target;

  // Catch-all: only allow same-origin dev-server traffic, abort everything else.
  //
  // The allowed origins are derived from E2E_PORT, the same variable
  // playwright.config.ts uses to pick the port. They were previously hardcoded
  // to :3001, which meant that running the suite on any other port aborted
  // EVERY request — including the initial document — and surfaced as
  // `net::ERR_FAILED` on page.goto with no assertion ever reached. That reads
  // exactly like a broken application and is really a mismatched allowlist, so
  // the two must stay tied to one source.
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (ALLOWED_ORIGINS.some((origin) => url.startsWith(origin))) {
      return route.continue();
    }
    return route.abort();
  });

  // API gateway fixture surface.
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname.replace(/\/+$/, '') || '/';
    let body: unknown = null;
    if (JSON_TYPES.test(request.headers()['content-type'] ?? '')) {
      try {
        body = request.postDataJSON();
      } catch {
        /* non-JSON body */
      }
    }

    state.captured.push({ ts: Date.now(), method, path, body });

    const session = () => state.current;

    // ── Auth surface ──────────────────────────────────────────────────────
    if (method === 'GET' && path === '/api/me') {
      return json(route, 200, { ok: true, user: session() });
    }
    if (method === 'POST' && path === '/api/auth/google') {
      if (opts.afterAuth) state.current = opts.afterAuth();
      return json(route, 200, { ok: true, user: session() });
    }
    if (method === 'POST' && path === '/api/auth/logout') {
      state.current = opts.session();
      return json(route, 200, { ok: true });
    }
    if (method === 'POST' && path === '/api/auth/seat') {
      return json(route, 200, { ok: true, user: session() });
    }
    if (method === 'POST' && path === '/api/auth/context') {
      const p = (body ?? {}) as { organisation_id?: string; book_id?: string };
      const base = session() as UserSession | null;
      state.currentlySwitched = {
        organisation_id: p.organisation_id ?? base?.current_organisation_id ?? undefined,
        book_id: p.book_id ?? base?.current_book_id ?? undefined,
      };
      if (base) {
        state.current = {
          ...base,
          current_organisation_id: p.organisation_id ?? base.current_organisation_id,
          current_book_id: p.book_id ?? base.current_book_id,
        };
      }
      return json(route, 200, {
        ok: true,
        user: state.current,
      });
    }

    // ── Domain data read surface (SERP-289 hydration; empty slate) ───────
    const OPS_READS: Record<string, string> = {
      '/api/ops/customers': 'customers',
      '/api/ops/jobs': 'jobs',
      '/api/ops/invoices': 'invoices',
      '/api/ops/expenses': 'expenses',
      '/api/ops/payments': 'payments',
      '/api/ops/suppliers': 'suppliers',
      '/api/ops/purchase-orders': 'purchaseOrders',
      '/api/ops/audit': 'events',
    };
    if (method === 'GET' && OPS_READS[path] !== undefined) {
      return json(route, 200, { ok: true, [OPS_READS[path]]: [] });
    }

    // ── Command / mutation surface (fire-and-forget echo) ─────────────────
    if (method === 'POST' && path === '/api/ops/event') {
      const p = body as Record<string, unknown>;
      state.opsEvents.push(p);
      return json(route, 200, {
        ok: true,
        state: 'accepted',
        request_id: `e2e-req-${state.captured.length}`,
        ...p,
      });
    }

    // ── Invitation administration surface (SERP-286 UI circuits) ──────────
    if (method === 'GET' && path === '/api/tenant/invitations') {
      return json(route, 200, { ok: true, invitations: opts.invitations ?? [] });
    }
    if (method === 'POST' && path === '/api/tenant/invitations') {
      const p = body as Record<string, unknown>;
      const invitation: StaffInvitationRecord = {
        id: `inv-e2e-${state.captured.length}`,
        organisation_id: session()?.current_organisation_id ?? 'tenant-starq',
        email: String(p.email ?? ''),
        name: String(p.name ?? ''),
        role_id: String(p.role_id ?? ''),
        book_ids: Array.isArray(p.book_ids) ? p.book_ids.map(String) : [],
        location_ids: Array.isArray(p.location_ids) ? p.location_ids.map(String) : [],
        token: 'e2e-token-inert',
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return json(route, 200, { ok: true, invitation });
    }
    if (method === 'POST' && /^\/api\/tenant\/invitations\/[^/]+\/resend$/.test(path)) {
      return json(route, 200, {
        ok: true,
        invitation: { id: path.split('/')[4] },
      });
    }
    if (method === 'POST' && /^\/api\/tenant\/invitations\/[^/]+\/revoke$/.test(path)) {
      return json(route, 200, { ok: true, status: 'revoked' });
    }

    // ── Platform / onboarding surfaces ────────────────────────────────────
    if (method === 'GET' && path === '/api/platform/applications') {
      return json(route, 200, { ok: true, applications: [] });
    }
    if (method === 'GET' && path === '/api/onboarding/application') {
      return json(route, 200, { ok: true, application: null });
    }
    if (method === 'POST' && path === '/api/onboarding/apply') {
      return json(route, 200, {
        ok: true,
        application: { id: 'app-e2e-1', status: 'pending' },
      });
    }

    return json(route, 404, { ok: false, error: 'e2e_stub_no_route', path });
  });

  return state;
}

/** Inject a programmable Google Identity Services stub for the login surface. */
export function installFakeGoogleIdentity(page: Page) {
  return page.addInitScript(() => {
    const api = {
      initialize: (config: Record<string, unknown>) => {
        (window as unknown as { __gisConfig?: Record<string, unknown> }).__gisConfig = config;
      },
      renderButton: (
        element: HTMLElement,
        _config: Record<string, unknown>,
      ) => {
        element.innerHTML = '';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Continue with Google';
        btn.dataset.testid = 'gis-google-button';
        btn.addEventListener('click', () => {
          const cfg = (window as unknown as { __gisConfig?: { callback?: (r: { credential: string }) => void } })
            .__gisConfig;
          cfg?.callback?.({ credential: 'e2e-fake-google-credential' });
        });
        element.appendChild(btn);
      },
      prompt: () => undefined,
    };
    (window as unknown as { google?: { accounts?: { id: typeof api } } }).google = {
      accounts: { id: api },
    };
  });
}