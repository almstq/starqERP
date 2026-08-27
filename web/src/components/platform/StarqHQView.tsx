import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import {
  ShieldCheck,
  Building2,
  Users,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Layers,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '../common/Badge';

export const StarqHQView: React.FC = () => {
  const {
    tenants,
    pendingApplications,
    approveOrganisationApplication,
    rejectOrganisationApplication,
    switchActiveContext,
    setIsRegisterOrgModalOpen
  } = useERP();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'approvals' | 'clients' | 'telemetry'>('approvals');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleApprove = (appId: string) => {
    const approved = approveOrganisationApplication(appId);
    if (approved) {
      showToast(`Successfully provisioned "${approved.name}" as an active client tenant!`);
    }
  };

  const handleReject = (appId: string) => {
    rejectOrganisationApplication(appId, 'Application declined by Starq HQ Operator');
    showToast(`Application rejected.`);
  };

  const pendingCount = pendingApplications.filter((a) => a.status === 'pending_approval').length;
  const totalBooksCount = tenants.reduce((acc, t) => acc + (t.books?.length || 1), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Banner */}
      {toastMessage && (
        <div
          className="fixed top-16 right-6 z-50 px-4 py-3 rounded-[var(--md-sys-shape-corner-medium)] shadow-xl border text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-4"
          style={{
            backgroundColor: 'var(--md-sys-color-primary-container)',
            color: 'var(--md-sys-color-on-primary-container)',
            borderColor: 'var(--md-sys-color-outline-variant)',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Operator Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 font-mono"
              style={{
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
              }}
            >
              <ShieldCheck size={12} />
              Starq Platform Operator Plane
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20 font-mono">
              UI Prototype · Not Yet Authoritative
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--md-sys-color-on-surface)]">
            Starq HQ Platform Console & Client Analytics
          </h1>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
            Superadmin management of customer tenants, industry archetypes, provisioning pipelines, and multi-tenant telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRegisterOrgModalOpen(true)}
            className="px-3.5 py-2 rounded-[var(--md-sys-shape-corner-small)] text-xs font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
            style={{
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
            }}
          >
            <Plus size={15} />
            <span>New Business Intake</span>
          </button>
        </div>
      </div>

      {/* Platform Telemetry KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          className="p-4 rounded-[var(--md-sys-shape-corner-medium)] border"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderColor: 'var(--md-sys-color-outline-variant)',
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">
            <span>Local Active Tenants</span>
            <Building2 size={16} className="text-[var(--md-sys-color-primary)]" />
          </div>
          <div className="text-2xl font-black mono-num text-[var(--md-sys-color-on-surface)] mt-2">
            {tenants.length}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <span>Starq Tech & Club Ignition</span>
          </div>
        </div>

        <div
          className="p-4 rounded-[var(--md-sys-shape-corner-medium)] border"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderColor: 'var(--md-sys-color-outline-variant)',
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">
            <span>Operating Books Active</span>
            <Layers size={16} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-black mono-num text-[var(--md-sys-color-on-surface)] mt-2">
            {totalBooksCount}
          </div>
          <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mt-1">
            Segmented general ledgers
          </div>
        </div>

        <div
          className="p-4 rounded-[var(--md-sys-shape-corner-medium)] border"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderColor: 'var(--md-sys-color-outline-variant)',
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">
            <span>Pending Approvals</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black mono-num text-[var(--md-sys-color-on-surface)] mt-2">
            {pendingCount}
          </div>
          <div className="text-[10px] text-amber-600 font-semibold mt-1">
            {pendingCount > 0 ? 'Requires Superadmin Review' : 'All Clear'}
          </div>
        </div>

        <div
          className="p-4 rounded-[var(--md-sys-shape-corner-medium)] border"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderColor: 'var(--md-sys-color-outline-variant)',
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">
            <span>Platform Telemetry</span>
            <Activity size={16} className="text-amber-500" />
          </div>
          <div className="text-sm font-bold text-[var(--md-sys-color-on-surface)] mt-2">
            Not Connected Yet
          </div>
          <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mt-1">
            Telemetry daemon pending deployment
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'approvals'
              ? 'border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]'
              : 'border-transparent text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]'
          }`}
        >
          <span>Client Approval Queue</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('clients')}
          className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'clients'
              ? 'border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]'
              : 'border-transparent text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]'
          }`}
        >
          <span>Active Client Directory ({tenants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'telemetry'
              ? 'border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]'
              : 'border-transparent text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]'
          }`}
        >
          <span>System Architecture & Isolation</span>
        </button>
      </div>

      {/* TAB 1: CLIENT APPROVAL QUEUE */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
              Pending Organisation Applications
            </h2>
            <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
              Applications submitted by business owners waiting for Superadmin approval
            </span>
          </div>

          {pendingApplications.length === 0 ? (
            <div
              className="p-8 rounded-[var(--md-sys-shape-corner-medium)] border text-center space-y-2"
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container)',
                borderColor: 'var(--md-sys-color-outline-variant)',
              }}
            >
              <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
              <div className="font-bold text-sm text-[var(--md-sys-color-on-surface)]">
                No Pending Applications
              </div>
              <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] max-w-sm mx-auto">
                All client registration requests have been processed. Click "+ New Business Intake" to test creating a registration application.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApplications.map((app) => {
                const isPending = app.status === 'pending_approval';
                return (
                  <div
                    key={app.id}
                    className="p-4 rounded-[var(--md-sys-shape-corner-medium)] border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                    style={{
                      backgroundColor: 'var(--md-sys-color-surface-container)',
                      borderColor: 'var(--md-sys-color-outline-variant)',
                    }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--md-sys-color-on-surface)]">
                          {app.name}
                        </span>
                        <Badge variant={isPending ? 'warning' : app.status === 'approved' ? 'accent' : 'destructive'} size="sm">
                          {app.status === 'pending_approval' ? 'Pending Approval' : app.status.toUpperCase()}
                        </Badge>
                        <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 font-semibold text-[var(--md-sys-color-on-surface-variant)]">
                          {app.archetypeName}
                        </span>
                      </div>

                      <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>Legal Entity: <strong>{app.legalName}</strong></span>
                        <span>Primary Book: <strong>[{app.primaryBookCode}] {app.primaryBookName}</strong></span>
                        <span>Location: <strong>{app.island}, {app.atoll}</strong></span>
                        <span>Applicant: <strong>{app.applicantName} ({app.applicantEmail})</strong></span>
                        <span>Submitted: <strong>{app.submittedAt}</strong></span>
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleReject(app.id)}
                          className="px-3 py-1.5 rounded-[var(--md-sys-shape-corner-small)] text-xs font-semibold text-rose-600 hover:bg-rose-500/10 border border-rose-500/20"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(app.id)}
                          className="px-4 py-1.5 rounded-[var(--md-sys-shape-corner-small)] text-xs font-bold flex items-center gap-1.5 shadow-sm"
                          style={{
                            backgroundColor: 'var(--md-sys-color-primary)',
                            color: 'var(--md-sys-color-on-primary)',
                          }}
                        >
                          <CheckCircle2 size={14} />
                          <span>Approve & Provision</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE CLIENT DIRECTORY */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
              All Active Client Organisations
            </h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[var(--md-sys-color-on-surface-variant)]" />
              <input
                type="text"
                placeholder="Search organisations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-[var(--md-sys-shape-corner-small)] border bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)]"
                style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}
              />
            </div>
          </div>

          <div
            className="rounded-[var(--md-sys-shape-corner-medium)] border overflow-hidden"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderColor: 'var(--md-sys-color-outline-variant)',
            }}
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--md-sys-color-outline-variant)', backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
                  <th className="py-2.5 px-4 font-bold text-[var(--md-sys-color-on-surface)]">Organisation / Legal Entity</th>
                  <th className="py-2.5 px-3 font-bold text-[var(--md-sys-color-on-surface)]">Archetype</th>
                  <th className="py-2.5 px-3 font-bold text-[var(--md-sys-color-on-surface)]">Location</th>
                  <th className="py-2.5 px-3 font-bold text-[var(--md-sys-color-on-surface)]">Books</th>
                  <th className="py-2.5 px-3 font-bold text-[var(--md-sys-color-on-surface)]">Tax Status</th>
                  <th className="py-2.5 px-4 font-bold text-right text-[var(--md-sys-color-on-surface)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
                {tenants
                  .filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.legalName.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((t) => {
                    const isTenantZero = t.id === 'tenant-starq';
                    return (
                      <tr key={t.id} className="hover:bg-[var(--md-sys-color-surface-container-highest)]/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-1.5">
                            <span>{t.name}</span>
                            {isTenantZero && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded font-bold bg-indigo-500/10 text-indigo-600">
                                Tenant #0
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">{t.legalName}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] font-semibold text-[var(--md-sys-color-on-surface)]">{t.industry}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">{t.island}, {t.atoll}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {t.books && t.books.length > 0 ? (
                              t.books.map((b) => (
                                <span key={b.id} className="mono-num text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 font-bold">
                                  [{b.code}] {b.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">1 Default Book</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={t.gstStatus === 'registered' ? 'accent' : 'neutral'} size="sm">
                            {t.gstStatus === 'registered' ? `8% GST (${t.tinNumber || 'Registered'})` : '0% GST (Non-Reg)'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => switchActiveContext({ plane: 'tenant', tenantId: t.id, bookId: t.books?.[0]?.id })}
                            className="px-2.5 py-1 rounded-[var(--md-sys-shape-corner-small)] text-[11px] font-bold text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary-container)]/30 inline-flex items-center gap-1"
                          >
                            <span>Enter Workspace</span>
                            <ArrowUpRight size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM ARCHITECTURE & ISOLATION */}
      {activeTab === 'telemetry' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className="p-5 rounded-[var(--md-sys-shape-corner-medium)] border space-y-3"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderColor: 'var(--md-sys-color-outline-variant)',
            }}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-[var(--md-sys-color-on-surface)]">
              <ShieldCheck size={18} className="text-[var(--md-sys-color-primary)]" />
              <span>Two-Plane Architecture Invariants</span>
            </div>
            <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] space-y-2">
              <p>
                <strong>Starq HQ Control Plane</strong> is the platform governance layer, completely isolated from tenant general ledgers. Operators can manage client registrations, seat limits, and migrations without ambient read access to private customer financial journals.
              </p>
              <p>
                <strong>Starq Technologies Pvt Ltd</strong> is <strong>Tenant #0</strong>. It operates inside the Tenant Execution Plane with its own segregated books (<em>Starq Technologies</em> for Software/R&D, and <em>Starq Dynamics</em> for Professional Services), subject to identical RLS and audit invariants as any external customer.
              </p>
            </div>
          </div>

          <div
            className="p-5 rounded-[var(--md-sys-shape-corner-medium)] border space-y-3"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderColor: 'var(--md-sys-color-outline-variant)',
            }}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-[var(--md-sys-color-on-surface)]">
              <Server size={18} className="text-amber-500" />
              <span>Migration & Backend Contract Status</span>
            </div>
            <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] space-y-1.5 font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-black/5 dark:bg-white/5">
                <span>Migration 0024: platform schema & registry</span>
                <Badge variant="warning" size="sm">Pending Deployment</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/5 dark:bg-white/5">
                <span>Migration 0025: public.books & composite FKs</span>
                <Badge variant="warning" size="sm">Pending Deployment</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/5 dark:bg-white/5">
                <span>Server Provisioning RPC (SERP-284/285)</span>
                <Badge variant="neutral" size="sm">Prototype State</Badge>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
