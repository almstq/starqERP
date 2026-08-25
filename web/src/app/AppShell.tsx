import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wrench, FileText, CreditCard, Receipt,
  Package, ShoppingCart, Truck, BarChart3, ShieldCheck, Settings as SettingsIcon,
  Search, Bell,
} from 'lucide-react';

/**
 * The application shell.
 *
 * Replaces the tab-state layout the AI Studio revision shipped with. Two things
 * change and both came from using the Hercules prototype rather than from
 * reasoning about it:
 *
 *   1. ROUTES, NOT TAB STATE. A job card has a URL. It can be sent to a
 *      technician, bookmarked, and reopened where it was left. Tab state cannot
 *      do any of that, and a workshop runs on people sending each other links.
 *
 *   2. THE NAV IS THE PRODUCT MAP. Eleven modules visible from the first
 *      screen, so the shape of the business is legible before anything is
 *      clicked — rather than one workflow with everything else implied.
 *
 * AUDIT IS OURS AND IT STAYS. The prototype has no audit view; the owner's
 * evidence ledger is the reason the console work was halted in the first place
 * (DEC-066), so it sits in the nav beside the rest.
 */

const NAV = [
  { to: '/',            label: 'Dashboard',        Icon: LayoutDashboard, end: true },
  { to: '/customers',   label: 'Customers',        Icon: Users },
  { to: '/jobs',        label: 'Jobs / Work Orders', Icon: Wrench },
  { to: '/invoices',    label: 'Invoices',         Icon: FileText },
  { to: '/payments',    label: 'Payments',         Icon: CreditCard },
  { to: '/expenses',    label: 'Expenses',         Icon: Receipt },
  { to: '/inventory',   label: 'Inventory',        Icon: Package },
  { to: '/purchasing',  label: 'Purchasing',       Icon: ShoppingCart },
  { to: '/suppliers',   label: 'Suppliers',        Icon: Truck },
  { to: '/reports',     label: 'Reports',          Icon: BarChart3 },
  { to: '/audit',       label: 'Audit Trail',      Icon: ShieldCheck },
  { to: '/settings',    label: 'Settings',         Icon: SettingsIcon },
];

export const AppShell: React.FC = () => {
  const navigate = useNavigate();

  // Placeholder until the organisation record is wired (SERP-166). Deliberately
  // NOT a customer name: no tenant brand ships in the product chrome.
  const workspace = 'Starq Technologies';
  const initials = workspace.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="erp-shell flex min-h-screen">
      <aside className="erp-sidebar hidden shrink-0 flex-col md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          {/*
            L4 — the logomark. The q of starq reduced to a bowl and a descender.
            Chosen because it is the only mark drawn from the NAME rather than
            from the category, so it belongs to starq and carries over to
            starqPay without being redrawn. Two shapes, so it holds at 16px.
          */}
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'var(--accent)' }}
          >
            <svg width="20" height="20" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <circle cx="30" cy="28" r="11" stroke="var(--accent-foreground)" strokeWidth="5" />
              <path d="M41 28v20" stroke="var(--accent-foreground)" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="leading-tight">
            {/*
              W4 — the wordmark. `starq` in Instrument Sans, `ERP` in Geist Mono,
              no space. The mono tag is what says "infrastructure" rather than
              "app", and it is the only trick the mark has.
            */}
            <div className="erp-wordmark text-[17px]">
              <span className="erp-wordmark-name">starq</span>
              <span className="erp-wordmark-tag">ERP</span>
            </div>
            {/*
              PRODUCT BRAND ONLY. This is STARQ ERP — a product Starq sells, not
              one customer's console. No tenant brand appears in the chrome.
              Founder, 24 Aug: "all starq branded. no ignition ink unless we are
              ready for 1st vercel deploy."

              The tenant's own name belongs in exactly one place — the workspace
              switcher in the header — and it comes from the organisation record
              at runtime, never from a string in the layout.
            */}
            <div className="erp-muted text-[10px] font-semibold tracking-[0.14em] uppercase">
              Multi-tenant ERP
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 pb-4">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className="erp-nav-item"
              style={({ isActive }) => (isActive ? undefined : undefined)}
              children={({ isActive }) => (
                <span className="erp-nav-item contents" data-active={isActive}>
                  <Icon size={17} strokeWidth={1.9} />
                  <span>{label}</span>
                </span>
              )}
            />
          ))}
        </nav>

        <div className="erp-card mx-3 mb-4 p-4">
          <div className="text-[13px] font-semibold">Growing with you</div>
          <p className="erp-muted mt-1 text-[11px] leading-snug">
            Simple today, full ERP tomorrow — modules unlock as your business grows.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center gap-4 px-6 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="relative w-full max-w-md">
            <Search size={15} className="erp-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
            <input
              className="erp-input w-full pl-9"
              placeholder="Search customers, jobs, invoices…"
              aria-label="Search"
            />
          </div>
          <div className="ml-auto flex items-center gap-4">
            <button className="erp-muted relative" aria-label="Notifications">
              <Bell size={18} />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full"
                    style={{ background: 'var(--accent)' }} />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 text-[13px] font-medium"
            >
              {/* Workspace switcher. The ONLY place a tenant name may appear,
                  and it is read from the active organisation, never hardcoded. */}
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ background: 'var(--sidebar-accent)', color: 'var(--foreground)' }}>
                {initials}
              </span>
              {workspace}
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-6 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
