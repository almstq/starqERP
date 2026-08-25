import React from 'react';
import {
  LayoutDashboard,
  Users,
  Wrench,
  Receipt,
  CreditCard,
  Wallet,
  Boxes,
  ShoppingBag,
  Truck,
  BarChart3,
  Settings,
  Sparkles,
  ChevronRight,
  Flame,
  Ship,
  Activity,
  AlertCircle,
  FileCheck2,
  Lock,
  X,
  Plus,
  ShieldAlert
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { NavigationTab, PermissionModule } from '../../types/erp';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const {
    activeTab,
    setActiveTab,
    activeJobsCount,
    lowStockItemsCount,
    alerts,
    setIsAICopilotOpen,
    currentTenant,
    currentUser,
    hasPermission,
    isPendingApproval,
    setIsSetupModalOpen
  } = useERP();

  const getTenantIcon = (industry: string) => {
    if (industry.includes('Marine')) return Ship;
    if (industry.includes('Clinic')) return Activity;
    if (industry.includes('Trading')) return Boxes;
    return Flame;
  };

  const TenantIcon = getTenantIcon(currentTenant.industry);

  const rawNavItems: {
    id: NavigationTab;
    moduleKey: PermissionModule;
    label: string;
    icon: React.ElementType;
    badge?: number;
    badgeVariant?: 'blue' | 'amber' | 'rose';
  }[] = [
    { id: 'dashboard', moduleKey: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', moduleKey: 'customers' as PermissionModule, label: 'Customers', icon: Users },
    {
      id: 'jobs',
      moduleKey: 'jobs',
      label: currentTenant.industry.includes('Clinic') ? 'Patients & Consults' : 'Jobs / Work Orders',
      icon: currentTenant.industry.includes('Clinic') ? Activity : Wrench,
      badge: activeJobsCount,
      badgeVariant: 'blue'
    },
    {
      id: 'invoices',
      moduleKey: 'invoices',
      label: 'Tax Invoices',
      icon: Receipt,
      badge: alerts.filter((a) => a.type === 'overdue_invoice').length > 0 ? 1 : undefined,
      badgeVariant: 'rose'
    },
    { id: 'payments', moduleKey: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'expenses', moduleKey: 'expenses', label: 'Expenses', icon: Wallet },
    {
      id: 'inventory',
      moduleKey: 'inventory',
      label: 'Inventory',
      icon: Boxes,
      badge: lowStockItemsCount > 0 ? lowStockItemsCount : undefined,
      badgeVariant: 'amber'
    },
    { id: 'purchasing', moduleKey: 'purchasing', label: 'Purchasing', icon: ShoppingBag },
    { id: 'suppliers', moduleKey: 'suppliers' as PermissionModule, label: 'Suppliers', icon: Truck },
    { id: 'reports', moduleKey: 'reports', label: 'Reports & MIRA', icon: BarChart3 },
    { id: 'audit', moduleKey: 'audit', label: 'Audit Trail', icon: FileCheck2 },
    { id: 'settings', moduleKey: 'settings', label: 'Settings', icon: Settings }
  ];

  // Filter based on user's role permissions (RBAC impact on navigation)
  const navItems = rawNavItems.filter((item) => {
    if (isPendingApproval) return item.id === 'dashboard'; // Pending user only sees greeting/pending dashboard
    return hasPermission(item.moduleKey, 'view');
  });

  const handleNavClick = (tabId: NavigationTab) => {
    setActiveTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 bg-[#0F172A] border-r border-slate-800 transition-all duration-300 flex flex-col ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 text-white">
              <TenantIcon className="w-5 h-5 font-bold stroke-[2.5]" />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-white">
                    Starq<span className="text-blue-400">ERP</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30 uppercase">
                    SaaS
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 truncate">{currentTenant.name}</span>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          {isMobileOpen && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Current User Status Pill in Sidebar */}
        {(!isCollapsed || isMobileOpen) && (
          <div className="px-3 pt-3">
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                isPendingApproval
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate text-white text-xs">{currentUser.name}</div>
                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  <span>{currentUser.roleName}</span>
                  <span>•</span>
                  <span className={isPendingApproval ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                    {currentUser.status}
                  </span>
                </div>
              </div>
              {isPendingApproval ? (
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </div>
          </div>
        )}

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <div
            className={`px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${
              isCollapsed && !isMobileOpen ? 'text-center' : ''
            }`}
          >
            {isCollapsed && !isMobileOpen ? '•••' : 'Authorized Modules'}
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 font-semibold border-l-4 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={isCollapsed && !isMobileOpen ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />

                {(!isCollapsed || isMobileOpen) && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}

                {(!isCollapsed || isMobileOpen) && item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      item.badgeVariant === 'rose'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : item.badgeVariant === 'amber'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {isCollapsed && !isMobileOpen && item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* AI Assistant Quick Pill in Sidebar */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/50 space-y-2">
          <button
            onClick={() => {
              setIsAICopilotOpen(true);
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/80 hover:border-blue-500/50 text-left transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-blue-300 flex items-center gap-1">
                  Starq AI Copilot
                  <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.2 rounded font-mono">
                    {currentTenant.currency}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">4 active SME insights</p>
              </div>
            )}
          </button>
        </div>

        {/* Multi-Tenant Footprint */}
        {(!isCollapsed || isMobileOpen) && (
          <div className="px-4 py-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate">{currentTenant.island} Branch</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">v2.0 SaaS</span>
          </div>
        )}
      </aside>
    </>
  );
};
