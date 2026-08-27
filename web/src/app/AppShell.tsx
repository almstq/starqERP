import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wrench, FileText, CreditCard, Receipt,
  Package, ShoppingCart, Truck, BarChart3, ShieldCheck, Settings as SettingsIcon,
  Search, Bell, Sun, Moon, Laptop, Menu, X, LogOut, ChevronDown,
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { MfaSetupModal } from '../components/auth/MfaSetupModal';
import { MfaChallengeModal } from '../components/auth/MfaChallengeModal';
import { ThemeSelector } from '../components/ui';
import { StarqLogomark } from '../components/brand/StarqLogo';

export type MaterialWindowClass = 'compact' | 'medium' | 'expanded' | 'large' | 'extra-large';

export function useMaterialWindowClass(): MaterialWindowClass {
  const [windowClass, setWindowClass] = useState<MaterialWindowClass>(() => {
    if (typeof window === 'undefined') return 'expanded';
    const w = window.innerWidth;
    if (w < 600) return 'compact';
    if (w < 840) return 'medium';
    if (w < 1200) return 'expanded';
    if (w < 1600) return 'large';
    return 'extra-large';
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 600) setWindowClass('compact');
      else if (w < 840) setWindowClass('medium');
      else if (w < 1200) setWindowClass('expanded');
      else if (w < 1600) setWindowClass('large');
      else setWindowClass('extra-large');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowClass;
}

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
  const location = useLocation();
  const { currentTenant } = useERP();
  const { session, logout } = useAuth();
  const { themeMode, setThemeMode, resolvedTheme } = useTheme();
  const windowClass = useMaterialWindowClass();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);

  const workspace = currentTenant?.name || 'Starq Technologies';
  const initials = workspace.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();


  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  const isCompact = windowClass === 'compact';
  const isMedium = windowClass === 'medium';
  const isExpandedOrAbove = !isCompact && !isMedium;

  return (
    <div
      className="flex min-h-screen w-full"
      style={{
        backgroundColor: 'var(--md-sys-color-surface)',
        color: 'var(--md-sys-color-on-surface)',
      }}
    >
      {/* Accessible skip-link for keyboard navigation (SERP-035) */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* ── 1. MEDIUM WINDOW CLASS: Material 3 NavigationRail (600–839px) ─── */}
      {isMedium && (
        <aside
          className="flex flex-col items-center w-18 shrink-0 py-4"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            borderRight: '1px solid var(--md-sys-color-outline-variant)',
          }}
          aria-label="Navigation Rail"
        >
          {/* Rail Brand Icon */}
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[var(--md-sys-shape-corner-medium)] shrink-0 mb-4"
            style={{
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
            }}
            title="starqERP"
          >
            <StarqLogomark size={20} />
          </div>

          {/* Rail Items */}
          <nav className="flex flex-1 flex-col gap-1 w-full px-2" aria-label="Modules">
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={label}
                className={({ isActive }) =>
                  `group relative overflow-hidden flex flex-col items-center justify-center p-2 rounded-[var(--md-sys-shape-corner-full)] transition-all duration-150 ${
                    isActive ? 'font-semibold' : ''
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        backgroundColor: 'var(--md-sys-color-secondary-container)',
                        color: 'var(--md-sys-color-on-secondary-container)',
                      }
                    : {
                        color: 'var(--md-sys-color-on-surface-variant)',
                      }
                }
              >
                {/* State Layer */}
                <span
                  className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-150 opacity-0 group-hover:opacity-[var(--md-sys-state-hover-opacity)] group-active:opacity-[var(--md-sys-state-pressed-opacity)] bg-current"
                  aria-hidden="true"
                />
                <Icon size={18} strokeWidth={1.9} aria-hidden="true" className="relative z-10" />
              </NavLink>
            ))}
          </nav>
        </aside>
      )}

      {/* ── 2. EXPANDED / LARGE / EXTRA-LARGE: Persistent Drawer (>= 840px) ── */}
      {isExpandedOrAbove && (
        <aside
          className="flex shrink-0 flex-col w-60 lg:w-64"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            borderRight: '1px solid var(--md-sys-color-outline-variant)',
          }}
          aria-label="Main Navigation"
        >
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-5 py-4 shrink-0">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[var(--md-sys-shape-corner-medium)] shrink-0"
              style={{
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
              }}
            >
              <StarqLogomark size={18} />
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-[16px] font-semibold tracking-tight truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                <span>starq</span>
                <span
                  className="mono-num text-[11px] font-bold ml-1 px-1.5 py-0.5 rounded-[var(--md-sys-shape-corner-small)]"
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary-container)',
                    color: 'var(--md-sys-color-on-primary-container)',
                  }}
                >
                  ERP
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2 overflow-y-auto" aria-label="Modules">
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `group relative overflow-hidden flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--md-sys-shape-corner-full)] text-xs font-medium transition-all duration-150 ${
                    isActive ? 'font-semibold' : ''
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        backgroundColor: 'var(--md-sys-color-secondary-container)',
                        color: 'var(--md-sys-color-on-secondary-container)',
                      }
                    : {
                        color: 'var(--md-sys-color-on-surface-variant)',
                      }
                }
              >
                {/* State Layer */}
                <span
                  className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-150 opacity-0 group-hover:opacity-[var(--md-sys-state-hover-opacity)] group-active:opacity-[var(--md-sys-state-pressed-opacity)] bg-current"
                  aria-hidden="true"
                />
                <Icon size={17} strokeWidth={1.9} aria-hidden="true" className="relative z-10 shrink-0" />
                <span className="relative z-10 truncate">{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* System Footer */}
          <div
            className="px-5 py-3 shrink-0"
            style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}
          >
            <div
              className="flex items-center justify-between text-[11px]"
              style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
            >
              <span className="mono-num font-medium">starqERP v1.0</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--positive)' }} />
                <span>Online</span>
              </span>
            </div>
          </div>
        </aside>
      )}

      {/* ── 3. COMPACT WINDOW CLASS: Slide-over Modal Navigation Drawer (< 600px) ── */}
      {isCompact && mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              borderRight: '1px solid var(--md-sys-color-outline-variant)',
            }}
            className="relative flex flex-col w-72 max-w-[80vw] h-full shadow-2xl z-10"
          >
            <div className="flex items-center justify-between px-5 py-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-[var(--md-sys-shape-corner-small)] shrink-0"
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                  }}
                >
                  <StarqLogomark size={16} />
                </div>
                <span className="font-semibold text-sm text-[var(--md-sys-color-on-surface)]">starqERP</span>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-full hover:bg-[var(--md-sys-color-surface-container-high)]"
                style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2 overflow-y-auto" aria-label="Modules">
              {NAV.map(({ to, label, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `group relative overflow-hidden flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--md-sys-shape-corner-full)] text-xs font-medium transition-all duration-150 ${
                      isActive ? 'font-semibold' : ''
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                          backgroundColor: 'var(--md-sys-color-secondary-container)',
                          color: 'var(--md-sys-color-on-secondary-container)',
                        }
                      : {
                          color: 'var(--md-sys-color-on-surface-variant)',
                        }
                  }
                >
                  {/* State Layer */}
                  <span
                    className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-150 opacity-0 group-hover:opacity-[var(--md-sys-state-hover-opacity)] group-active:opacity-[var(--md-sys-state-pressed-opacity)] bg-current"
                    aria-hidden="true"
                  />
                  <Icon size={17} strokeWidth={1.9} aria-hidden="true" className="relative z-10 shrink-0" />
                  <span className="relative z-10 truncate">{label}</span>
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main Column Area ── */}
      <div className="flex min-w-0 flex-1 flex-col w-full">
        {/* TopAppBar */}
        <header
          className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2.5 shrink-0 h-14 sm:h-16 w-full"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
          }}
          role="banner"
        >
          {/* Hamburger Menu on Compact (< 600px) */}
          {isCompact && (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="p-2 rounded-full hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors cursor-pointer shrink-0"
              style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
              aria-label="Open navigation menu"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          )}

          {/* Search Bar */}
          <div className="relative flex-1 max-w-xs sm:max-w-md min-w-0">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
              aria-hidden="true"
            />
            <input
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                color: 'var(--md-sys-color-on-surface)',
                borderColor: 'var(--md-sys-color-outline-variant)',
                borderRadius: 'var(--md-sys-shape-corner-full)',
              }}
              className="w-full h-8 sm:h-9 pl-9 pr-3 text-xs border outline-none transition-colors placeholder:text-[var(--md-sys-color-on-surface-variant)] focus:border-[var(--md-sys-color-primary)] focus:ring-1 focus:ring-[var(--md-sys-color-primary)]"
              placeholder="Search..."
              aria-label="Search across customers, jobs, invoices"
              type="search"
            />
          </div>

          {/* Header Action Controls */}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Material 3 Three-Option Theme Menu Selector */}
            <ThemeSelector />

            <button
              type="button"
              className="relative p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors cursor-pointer hidden sm:flex"
              style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
              aria-label="Notifications"
            >
              <Bell size={17} aria-hidden="true" />
              <span
                className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: 'var(--md-sys-color-primary)' }}
                aria-hidden="true"
              />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setTenantMenuOpen(!tenantMenuOpen)}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-[var(--md-sys-shape-corner-full)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors cursor-pointer text-xs font-medium max-w-[130px] sm:max-w-[200px]"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  color: 'var(--md-sys-color-on-surface)',
                }}
                aria-label={`Active workspace: ${workspace}. Click to switch tenant or logout.`}
                aria-expanded={tenantMenuOpen}
                aria-haspopup="menu"
              >
                {currentTenant.logoUrl ? (
                  <span
                    className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full overflow-hidden shrink-0"
                    style={{
                      backgroundColor: 'var(--md-sys-color-surface-container-high)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                    }}
                  >
                    <img
                      src={currentTenant.logoUrl}
                      alt=""
                      className="max-h-full max-w-full object-contain select-none"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  </span>
                ) : (
                  <span
                    className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[10px] font-bold mono-num shrink-0"
                    style={{
                      backgroundColor: 'var(--md-sys-color-primary-container)',
                      color: 'var(--md-sys-color-on-primary-container)',
                    }}
                    aria-hidden="true"
                  >
                    {initials}
                  </span>
                )}
                <span className="truncate min-w-0 hidden xs:inline sm:inline">{workspace}</span>
                <ChevronDown size={14} className="shrink-0 hidden sm:block" aria-hidden="true" />
              </button>

              {tenantMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setTenantMenuOpen(false)} aria-hidden="true" />
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl shadow-lg border overflow-hidden"
                    style={{
                      backgroundColor: 'var(--md-sys-color-surface-container)',
                      borderColor: 'var(--md-sys-color-outline-variant)',
                    }}
                  >
                    {session?.organisations && session.organisations.length > 1 && (
                      <>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                          Switch Tenant
                        </div>
                        {session.organisations.map((org) => (
                          <button
                            key={org.id}
                            role="menuitem"
                            onClick={() => {
                              setTenantMenuOpen(false);
                              if (org.id !== session.current_organisation_id) {
                                window.location.href = `/api/auth/switch-org?id=${org.id}`;
                              }
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors flex items-center gap-2"
                            style={{
                              color: org.id === session.current_organisation_id
                                ? 'var(--md-sys-color-primary)'
                                : 'var(--md-sys-color-on-surface)',
                              fontWeight: org.id === session.current_organisation_id ? 600 : 400,
                            }}
                          >
                            {org.name}
                          </button>
                        ))}
                        <div className="mx-2 my-1 border-t" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }} />
                      </>
                    )}
                    <div className="px-3 py-1.5 text-[10px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {session?.name ?? 'Not signed in'}
                      {session?.seat_label && (
                        <span className="block text-[9px] opacity-70">{session.seat_label}</span>
                      )}
                    </div>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setTenantMenuOpen(false);
                        logout().then(() => navigate('/login'));
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors flex items-center gap-2"
                      style={{ color: 'var(--md-sys-color-error, #b3261e)' }}
                    >
                      <LogOut size={14} aria-hidden="true" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* View Content Area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-3 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8 focus:outline-none overflow-y-auto w-full"
          style={{ backgroundColor: 'var(--md-sys-color-surface)' }}
        >
          <div className="w-full max-w-7xl mx-auto min-w-0">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Security & Authentication Modals (SERP-268) */}
      <MfaSetupModal />
      <MfaChallengeModal />
    </div>
  );
};
