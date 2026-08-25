import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Bell,
  Sparkles,
  ChevronDown,
  Menu,
  Wrench,
  Receipt,
  CreditCard,
  Boxes,
  UserPlus,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  LogOut,
  Sliders,
  DollarSign,
  Sun,
  Moon,
  Shield,
  Lock,
  Flame,
  Ship,
  Activity,
  UserCheck,
  FileCheck2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Badge } from '../common/Badge';

interface HeaderProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isCollapsed,
  setIsCollapsed,
  onOpenMobileMenu
}) => {
  const {
    alerts,
    dismissAlert,
    setActiveTab,
    setSelectedInvoiceId,
    setSelectedJobId,
    setSelectedPOId,
    setIsCreateJobOpen,
    setIsCreateInvoiceOpen,
    setIsRecordPaymentOpen,
    setIsReceiveStockOpen,
    setIsNewCustomerOpen,
    setIsAICopilotOpen,
    setIsGlobalSearchOpen,
    totalSalesToday,
    formatMVR,
    currentTenant,
    tenants,
    switchTenant,
    setIsSetupModalOpen,
    currentUser,
    users,
    switchCurrentUser,
    theme,
    toggleTheme,
    hasPermission,
    isPendingApproval
  } = useERP();

  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);
  const [isUserPersonaDropdownOpen, setIsUserPersonaDropdownOpen] = useState(false);

  const quickActionRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const tenantRef = useRef<HTMLDivElement>(null);
  const userPersonaRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickActionRef.current && !quickActionRef.current.contains(event.target as Node)) {
        setIsQuickActionOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (tenantRef.current && !tenantRef.current.contains(event.target as Node)) {
        setIsTenantDropdownOpen(false);
      }
      if (userPersonaRef.current && !userPersonaRef.current.contains(event.target as Node)) {
        setIsUserPersonaDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTenantIcon = (industry: string) => {
    if (industry.includes('Marine')) return Ship;
    if (industry.includes('Clinic')) return Activity;
    if (industry.includes('Trading')) return Boxes;
    return Flame;
  };

  const TenantIcon = getTenantIcon(currentTenant.industry);

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-all duration-300 flex items-center justify-between px-3 sm:px-6 ${
        isCollapsed ? 'left-0 lg:left-20' : 'left-0 lg:left-64'
      }`}
    >
      {/* Left side: Menu toggle + Tenant Switcher + Search trigger */}
      <div className="flex items-center gap-2 sm:gap-4 flex-1 max-w-2xl">
        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Menu Open Toggle */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Multi-Tenant Organization Switcher Dropdown */}
        <div className="relative" ref={tenantRef}>
          <button
            onClick={() => setIsTenantDropdownOpen(!isTenantDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-xs transition-all max-w-[200px] sm:max-w-[260px]"
          >
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <TenantIcon className="w-3.5 h-3.5" />
            </div>
            <div className="text-left min-w-0 flex-1">
              <div className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs">
                {currentTenant.name}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                <span>{currentTenant.island}</span>
                <span>•</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">{currentTenant.currency}</span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {isTenantDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in duration-150">
              <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Active SME Tenants</span>
                <span className="text-[9px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded font-semibold">
                  Multi-Tenant
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                {tenants.map((t) => {
                  const Icon = getTenantIcon(t.industry);
                  const isSelected = t.id === currentTenant.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        switchTenant(t.id);
                        setIsTenantDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold">{t.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {t.industry} ({t.island})
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setIsTenantDropdownOpen(false);
                    setIsSetupModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Setup New Maldivian SME</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Search Bar Trigger */}
        <button
          onClick={() => setIsGlobalSearchOpen(true)}
          className="hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all flex-1 max-w-sm"
        >
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">Search jobs, plates, invoices...</span>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-auto text-[10px] bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 font-mono border border-slate-200 dark:border-slate-700 shadow-xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right side: Dark Mode Toggle, AI Copilot trigger, Quick Action, Notifications, User Persona Switcher */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Dark Mode Switcher */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
        </button>

        {/* Starq AI Trigger */}
        <button
          onClick={() => setIsAICopilotOpen(true)}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold transition-all shadow-xs group"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline">Starq AI</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/80 rounded-full text-blue-800 dark:text-blue-200 font-bold">
            4
          </span>
        </button>

        {/* Quick Action "+" Dropdown */}
        {!isPendingApproval && (
          <div className="relative" ref={quickActionRef}>
            <button
              onClick={() => setIsQuickActionOpen(!isQuickActionOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-sm shadow-blue-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">New Action</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>

            {isQuickActionOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Create New Action
                </div>

                {hasPermission('jobs', 'create') && (
                  <button
                    onClick={() => {
                      setIsCreateJobOpen(true);
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 text-left transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                      <Wrench className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        New Job / Work Order
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Repaint, wrap, repair
                      </div>
                    </div>
                  </button>
                )}

                {hasPermission('invoices', 'create') && (
                  <button
                    onClick={() => {
                      setIsCreateInvoiceOpen(true);
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 text-left transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                      <Receipt className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        New Invoice (MIRA GST)
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {currentTenant.gstRate}% tax standard invoice
                      </div>
                    </div>
                  </button>
                )}

                {hasPermission('payments', 'create') && (
                  <button
                    onClick={() => {
                      setIsRecordPaymentOpen(true);
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-sky-600 text-left transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        Record Payment Slip
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        BML / MIB / Cash slip
                      </div>
                    </div>
                  </button>
                )}

                {hasPermission('inventory', 'edit') && (
                  <button
                    onClick={() => {
                      setIsReceiveStockOpen(true);
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-amber-600 text-left transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                      <Boxes className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        Receive Stock & Materials
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Add clearcoat, wrap, primer
                      </div>
                    </div>
                  </button>
                )}

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  onClick={() => {
                    setIsNewCustomerOpen(true);
                    setIsQuickActionOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                >
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <UserPlus className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Add Customer Profile
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Notifications & Needs Attention Flyout */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Needs Attention Alerts"
          >
            <Bell className="w-5 h-5" />
            {alerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Needs Attention ({alerts.length})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Action items requiring SME review
                  </p>
                </div>
                <Badge variant="danger" size="sm">
                  {alerts.length} Urgent
                </Badge>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {alerts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    All clear! No overdue invoices or pending authorizations.
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                            alert.urgency === 'critical'
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                              : alert.urgency === 'warning'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                            {alert.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {alert.description}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => {
                                setActiveTab(alert.targetTab);
                                if (alert.targetTab === 'invoices' && alert.targetId) {
                                  setSelectedInvoiceId(alert.targetId);
                                } else if (alert.targetTab === 'jobs' && alert.targetId) {
                                  setSelectedJobId(alert.targetId);
                                } else if (alert.targetTab === 'purchasing' && alert.targetId) {
                                  setSelectedPOId(alert.targetId);
                                }
                                setIsNotificationsOpen(false);
                              }}
                              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {alert.actionLabel} →
                            </button>
                            <button
                              onClick={() => dismissAlert(alert.id)}
                              className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-auto"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Persona & Role Simulator Switcher */}
        <div className="relative" ref={userPersonaRef}>
          <button
            onClick={() => setIsUserPersonaDropdownOpen(!isUserPersonaDropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div
              className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center border shadow-xs ${
                currentUser.status === 'Pending Approval'
                  ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300'
                  : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'
              }`}
            >
              {currentUser.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight flex items-center gap-1">
                <span>{currentUser.name}</span>
                {currentUser.status === 'Pending Approval' && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {currentUser.roleName}
                </span>
                <span>•</span>
                <span>{currentUser.status}</span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isUserPersonaDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in duration-150 text-xs">
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {currentTenant.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  TIN: {currentTenant.tinNumber} • {currentTenant.island}
                </p>
              </div>

              <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Simulate User Persona (RBAC Testing)
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                {users.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        switchCurrentUser(u.id);
                        setIsUserPersonaDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-left transition-colors ${
                        isCurrent
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1">
                          <span>{u.name}</span>
                          {u.status === 'Pending Approval' && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[9px] font-bold">
                              PENDING
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {u.roleName} ({u.jobTitle || 'Staff'})
                        </div>
                      </div>
                      {isCurrent && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

              <button
                onClick={() => {
                  setActiveTab('settings');
                  setIsUserPersonaDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Sliders className="w-4 h-4 text-slate-400" />
                <span>Tenant Profile & Permissions</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('audit');
                  setIsUserPersonaDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <FileCheck2 className="w-4 h-4 text-blue-500" />
                <span>Activity & Audit Trail</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
