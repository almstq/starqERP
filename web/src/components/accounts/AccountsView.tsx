import React, { useState, useMemo } from 'react';
import {
  AccountRecord,
  AccountClass,
  AccountCurrency,
  AccountStatus,
  CLASS_LABELS,
  CLASS_CODE_RANGES,
  SUBTYPE_LABELS,
  buildAccountTree,
  flattenAccountTree,
  AccountHierarchyNode,
} from '../../domain/accounts';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../../data/defaultChartOfAccounts';
import { NewAccountModal } from './NewAccountModal';
import { AccountDetailModal } from './AccountDetailModal';
import { Badge } from '../common/Badge';
import {
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Lock,
  Layers,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Scale,
  Building2,
  Filter,
  MoreVertical,
  Edit2,
  Eye,
  Archive,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export const AccountsView: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountRecord[]>(() => {
    // Initialise from localStorage or fallback to canonical default
    const saved = localStorage.getItem('starq:chart_of_accounts:v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_CHART_OF_ACCOUNTS;
      }
    }
    return DEFAULT_CHART_OF_ACCOUNTS;
  });

  const [selectedClass, setSelectedClass] = useState<AccountClass | 'ALL'>('ALL');
  const [selectedCurrency, setSelectedCurrency] = useState<AccountCurrency | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<AccountStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Set of expanded parent node IDs
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Expand root level nodes by default
    return new Set(DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.level <= 1).map((a) => a.id));
  });

  // Modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedParentForNew, setSelectedParentForNew] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountRecord | null>(null);
  const [viewingAccount, setViewingAccount] = useState<AccountRecord | null>(null);

  // Persist accounts state
  const saveAccounts = (newAccounts: AccountRecord[]) => {
    setAccounts(newAccounts);
    try {
      localStorage.setItem('starq:chart_of_accounts:v1', JSON.stringify(newAccounts));
    } catch {
      // ignore storage errors
    }
  };

  // Toggle single node expansion
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(accounts.map((a) => a.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // Class filter
      if (selectedClass !== 'ALL' && acc.accountClass !== selectedClass) return false;
      // Currency filter
      if (selectedCurrency !== 'ALL' && acc.currency !== selectedCurrency && acc.currency !== 'MULTI') return false;
      // Status filter
      if (selectedStatus !== 'ALL' && acc.status !== selectedStatus) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = acc.code.toLowerCase().includes(q);
        const matchesName = acc.name.toLowerCase().includes(q);
        const matchesDesc = acc.description?.toLowerCase().includes(q);
        const matchesSubtype = SUBTYPE_LABELS[acc.subtype]?.toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesDesc && !matchesSubtype) return false;
      }
      return true;
    });
  }, [accounts, selectedClass, selectedCurrency, selectedStatus, searchQuery]);

  // Compute hierarchy tree
  const accountTree = useMemo(() => {
    return buildAccountTree(filteredAccounts);
  }, [filteredAccounts]);

  // Flattened for render
  const flatNodes = useMemo(() => {
    if (searchQuery.trim()) {
      // When searching, display all matched nodes flat without collapsing
      return filteredAccounts.map((a) => ({ ...a, children: [] }));
    }
    return flattenAccountTree(accountTree, expandedIds);
  }, [accountTree, expandedIds, searchQuery, filteredAccounts]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter((a) => a.status === 'ACTIVE').length;
    const assetsCount = accounts.filter((a) => a.accountClass === 'ASSET').length;
    const liabilitiesCount = accounts.filter((a) => a.accountClass === 'LIABILITY').length;
    const equityCount = accounts.filter((a) => a.accountClass === 'EQUITY').length;
    const revenueCount = accounts.filter((a) => a.accountClass === 'REVENUE').length;
    const expenseCount = accounts.filter((a) => a.accountClass === 'EXPENSE').length;
    return { total, active, assetsCount, liabilitiesCount, equityCount, revenueCount, expenseCount };
  }, [accounts]);

  // Handlers for Add/Edit/Delete
  const handleSaveAccount = (record: AccountRecord) => {
    const existingIndex = accounts.findIndex((a) => a.id === record.id);
    if (existingIndex >= 0) {
      const next = [...accounts];
      next[existingIndex] = record;
      saveAccounts(next);
    } else {
      saveAccounts([...accounts, record]);
      // Auto-expand parent if added under a parent
      if (record.parentId) {
        setExpandedIds((prev) => new Set([...prev, record.parentId!]));
      }
    }
  };

  const handleToggleStatus = (account: AccountRecord) => {
    const nextStatus: AccountStatus = account.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = accounts.map((a) => (a.id === account.id ? { ...a, status: nextStatus } : a));
    saveAccounts(updated);
  };

  const handleArchive = (account: AccountRecord) => {
    if (account.isSystem) return;
    const updated = accounts.map((a) => (a.id === account.id ? { ...a, status: 'ARCHIVED' as AccountStatus } : a));
    saveAccounts(updated);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset Chart of Accounts back to canonical Maldivian SME defaults? Any custom sub-accounts will be replaced.')) {
      saveAccounts(DEFAULT_CHART_OF_ACCOUNTS);
      setExpandedIds(new Set(DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.level <= 1).map((a) => a.id)));
    }
  };

  return (
    <div className="space-y-6" data-testid="chart-of-accounts-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-[var(--md-sys-color-primary)]" />
            Chart of Accounts
          </h1>
          <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mt-1">
            Authoritative double-entry general ledger account hierarchy for Maldivian commerce and IFRS reporting.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)] flex items-center gap-1.5 transition"
            title="Reset to default Maldives template"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[var(--md-sys-color-outline)]" />
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingAccount(null);
              setSelectedParentForNew(null);
              setIsNewModalOpen(true);
            }}
            data-testid="add-account-btn"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:opacity-90 shadow-sm flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            New Account
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] flex flex-col justify-between h-[104px]">
          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-medium flex items-center gap-1.5 h-4 truncate">
            <span className="truncate">Total Accounts</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[var(--md-sys-color-on-surface)] leading-none my-auto">{metrics.total}</div>
          <div className="text-[11px] text-[var(--md-sys-color-primary)] font-medium h-3.5 truncate leading-none">{metrics.active} active</div>
        </div>

        <div className="p-3.5 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] flex flex-col justify-between h-[104px]">
          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-medium flex items-center gap-1.5 h-4 truncate">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">Assets (1000s)</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[var(--md-sys-color-on-surface)] leading-none my-auto">{metrics.assetsCount}</div>
          <div className="text-[11px] text-[var(--md-sys-color-outline)] h-3.5 truncate leading-none">Cash, Bank, Stock</div>
        </div>

        <div className="p-3.5 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] flex flex-col justify-between h-[104px]">
          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-medium flex items-center gap-1.5 h-4 truncate">
            <TrendingDown className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="truncate">Liabilities (2000s)</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[var(--md-sys-color-on-surface)] leading-none my-auto">{metrics.liabilitiesCount}</div>
          <div className="text-[11px] text-[var(--md-sys-color-outline)] h-3.5 truncate leading-none">AP, GST, TGST</div>
        </div>

        <div className="p-3.5 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] flex flex-col justify-between h-[104px]">
          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-medium flex items-center gap-1.5 h-4 truncate">
            <Scale className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">Equity (3000s)</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[var(--md-sys-color-on-surface)] leading-none my-auto">{metrics.equityCount}</div>
          <div className="text-[11px] text-[var(--md-sys-color-outline)] h-3.5 truncate leading-none">Capital & Retained</div>
        </div>

        <div className="p-3.5 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] flex flex-col justify-between h-[104px]">
          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-medium flex items-center gap-1.5 h-4 truncate">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">Revenue (4000s)</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[var(--md-sys-color-on-surface)] leading-none my-auto">{metrics.revenueCount}</div>
          <div className="text-[11px] text-[var(--md-sys-color-outline)] h-3.5 truncate leading-none">Sales & Services</div>
        </div>

        <div className="p-3.5 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] flex flex-col justify-between h-[104px]">
          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] font-medium flex items-center gap-1.5 h-4 truncate">
            <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">Expenses (5000s)</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[var(--md-sys-color-on-surface)] leading-none my-auto">{metrics.expenseCount}</div>
          <div className="text-[11px] text-[var(--md-sys-color-outline)] h-3.5 truncate leading-none">COGS & Operating</div>
        </div>
      </div>

      {/* Filter and Tab Navigation Bar */}
      <div className="p-4 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] space-y-4">
        {/* Classification Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[var(--md-sys-color-outline-variant)]">
          {(['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const).map((cls) => {
            const isSelected = selectedClass === cls;
            return (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(cls)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shadow-sm'
                    : 'text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]'
                }`}
              >
                {cls === 'ALL' ? 'All Classes' : `${CLASS_LABELS[cls]} (${CLASS_CODE_RANGES[cls].prefix}000s)`}
              </button>
            );
          })}
        </div>

        {/* Search and Secondary Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--md-sys-color-outline)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, account name, or subtype..."
              className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface)] focus:outline-none focus:border-[var(--md-sys-color-primary)]"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Currency Filter */}
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value as AccountCurrency | 'ALL')}
              className="h-9 px-2.5 text-xs rounded-lg border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] focus:outline-none focus:border-[var(--md-sys-color-primary)]"
            >
              <option value="ALL">All Currencies</option>
              <option value="MVR">MVR Only</option>
              <option value="USD">USD Only</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as AccountStatus | 'ALL')}
              className="h-9 px-2.5 text-xs rounded-lg border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] focus:outline-none focus:border-[var(--md-sys-color-primary)]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
              <option value="ARCHIVED">Archived Only</option>
            </select>

            {/* Expand / Collapse */}
            {!searchQuery && (
              <div className="flex items-center border border-[var(--md-sys-color-outline-variant)] rounded-lg overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={expandAll}
                  className="px-2.5 py-1.5 text-xs font-medium bg-[var(--md-sys-color-surface)] hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] border-r border-[var(--md-sys-color-outline-variant)]"
                  title="Expand All"
                >
                  Expand
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-2.5 py-1.5 text-xs font-medium bg-[var(--md-sys-color-surface)] hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)]"
                  title="Collapse All"
                >
                  Collapse
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Account Tree Table View */}
      <div className="rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] overflow-hidden shadow-sm">
        <div className="erp-scroll-region overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[760px]">
            <thead>
              <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider font-semibold whitespace-nowrap">
                <th className="py-3 px-4 w-28 shrink-0">Code</th>
                <th className="py-3 px-4 min-w-[280px]">Account Name</th>
                <th className="py-3 px-4 w-28 shrink-0">Class</th>
                <th className="py-3 px-4 w-44 shrink-0 hidden md:table-cell">Subtype</th>
                <th className="py-3 px-4 w-24 shrink-0 text-center">Currency</th>
                <th className="py-3 px-4 w-32 shrink-0 text-right">Balance</th>
                <th className="py-3 px-4 w-24 shrink-0 text-center">Status</th>
                <th className="py-3 px-4 w-28 shrink-0 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
              {flatNodes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--md-sys-color-on-surface-variant)]">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-[var(--md-sys-color-outline)]" />
                    <p className="font-medium text-sm">No accounts found</p>
                    <p className="text-xs text-[var(--md-sys-color-outline)] mt-0.5">
                      Try adjusting your search query or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                flatNodes.map((node) => {
                  const hasChildren = node.children && node.children.length > 0;
                  const isExpanded = expandedIds.has(node.id);
                  const indentPx = node.level * 20;

                  return (
                    <tr
                      key={node.id}
                      className="hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors group"
                      data-testid={`account-row-${node.code}`}
                    >
                      {/* Code */}
                      <td className="py-2.5 px-4 font-mono font-bold text-[var(--md-sys-color-primary)] whitespace-nowrap">
                        {node.code}
                      </td>

                      {/* Name with indentation & Expand chevron */}
                      <td className="py-2.5 px-4 min-w-[280px]">
                        <div className="flex items-center gap-1.5 whitespace-nowrap" style={{ paddingLeft: `${indentPx}px` }}>
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={() => toggleExpand(node.id)}
                              className="p-1 rounded hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] shrink-0"
                              title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[var(--md-sys-color-primary)]" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="w-5 shrink-0" />
                          )}

                          {hasChildren ? (
                            isExpanded ? (
                              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                            ) : (
                              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                            )
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-[var(--md-sys-color-outline)] shrink-0" />
                          )}

                          <span className={`font-medium whitespace-nowrap ${node.level === 0 ? 'font-bold text-sm text-[var(--md-sys-color-on-surface)]' : 'text-[var(--md-sys-color-on-surface)]'}`}>
                            {node.name}
                          </span>

                          {node.isSystem && (
                            <span title="System Locked Account">
                              <Lock className="w-3 h-3 text-[var(--md-sys-color-outline)] shrink-0 ml-1" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-[var(--md-sys-color-on-surface-variant)]">
                          {CLASS_LABELS[node.accountClass]}
                        </span>
                      </td>

                      {/* Subtype */}
                      <td className="py-2.5 px-4 hidden md:table-cell text-[var(--md-sys-color-on-surface-variant)] whitespace-nowrap">
                        {SUBTYPE_LABELS[node.subtype]}
                      </td>

                      {/* Currency */}
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <span className="font-mono px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)]">
                          {node.currency}
                        </span>
                      </td>

                      {/* Balance */}
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-[var(--md-sys-color-on-surface)] whitespace-nowrap">
                        {node.currency === 'USD' ? '$' : 'MVR '} {node.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <Badge variant={node.status === 'ACTIVE' ? 'success' : 'neutral'}>
                          {node.status}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setViewingAccount(node);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-[var(--md-sys-color-outline)] hover:text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-high)] transition"
                            title="View Account Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedParentForNew(node.id);
                              setEditingAccount(null);
                              setIsNewModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-[var(--md-sys-color-outline)] hover:text-emerald-500 hover:bg-[var(--md-sys-color-surface-container-high)] transition"
                            title="Add Sub-Account"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingAccount(node);
                              setIsNewModalOpen(true);
                            }}
                            disabled={node.isSystem}
                            className="p-1.5 rounded-lg text-[var(--md-sys-color-outline)] hover:text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-high)] disabled:opacity-30 transition"
                            title={node.isSystem ? 'System accounts cannot be edited' : 'Edit Account'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <NewAccountModal
        isOpen={isNewModalOpen}
        onClose={() => {
          setIsNewModalOpen(false);
          setEditingAccount(null);
          setSelectedParentForNew(null);
        }}
        onSave={handleSaveAccount}
        accounts={accounts}
        initialParentId={selectedParentForNew}
        editingAccount={editingAccount}
      />

      <AccountDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setViewingAccount(null);
        }}
        account={viewingAccount}
        accounts={accounts}
        onEdit={(account) => {
          setIsDetailModalOpen(false);
          setEditingAccount(account);
          setIsNewModalOpen(true);
        }}
      />
    </div>
  );
};
