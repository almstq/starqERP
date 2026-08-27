import React from 'react';
import { useERP } from '../../context/ERPContext';
import {
  Layers,
  Server,
  CheckCircle2,
  AlertCircle,
  GitBranch,
  ShieldCheck,
  FileCode2,
  Database
} from 'lucide-react';
import { Badge } from '../common/Badge';

export const StarqHQProvisioning: React.FC = () => {
  const { tenants } = useERP();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-3 border-b" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
        <h2 className="text-base font-bold text-[var(--md-sys-color-on-surface)]">
          Tenant Provisioning & Database Architecture
        </h2>
        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
          Atomic tenant provisioning sequence contracts, schema version compatibility, and isolation invariants.
        </p>
      </div>

      {/* Provisioning Contract Flow Diagram */}
      <div
        className="p-5 rounded-[var(--md-sys-shape-corner-medium)] border space-y-4"
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container)',
          borderColor: 'var(--md-sys-color-outline-variant)',
        }}
      >
        <div className="flex items-center gap-2 font-bold text-sm text-[var(--md-sys-color-on-surface)]">
          <Layers size={18} className="text-[var(--md-sys-color-primary)]" />
          <span>Authoritative Tenant Provisioning Sequence</span>
        </div>
        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] leading-relaxed">
          When an application is approved in Starq HQ, the backend provisioning contract executes an atomic transaction creating the complete tenant workspace structure:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded border bg-[var(--md-sys-color-surface)] space-y-1.5" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
            <span className="font-bold text-[var(--md-sys-color-primary)] block font-mono">STEP 1</span>
            <div className="font-semibold text-[var(--md-sys-color-on-surface)]">Tenant & Legal Identity</div>
            <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">Creates record in <code>public.organisations</code> with validated TIN/GST regime.</p>
          </div>

          <div className="p-3 rounded border bg-[var(--md-sys-color-surface)] space-y-1.5" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
            <span className="font-bold text-indigo-500 block font-mono">STEP 2</span>
            <div className="font-semibold text-[var(--md-sys-color-on-surface)]">Books & Locations</div>
            <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">Seeds primary operating book in <code>public.books</code> and physical outlet locations.</p>
          </div>

          <div className="p-3 rounded border bg-[var(--md-sys-color-surface)] space-y-1.5" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
            <span className="font-bold text-emerald-500 block font-mono">STEP 3</span>
            <div className="font-semibold text-[var(--md-sys-color-on-surface)]">Owner Membership & Roles</div>
            <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">Binds applicant Google identity to Owner/Managing Director role and seats.</p>
          </div>

          <div className="p-3 rounded border bg-[var(--md-sys-color-surface)] space-y-1.5" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
            <span className="font-bold text-amber-500 block font-mono">STEP 4</span>
            <div className="font-semibold text-[var(--md-sys-color-on-surface)]">Archetype & Sequences</div>
            <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">Initializes Chart of Accounts, job stages, tax rates, and document counters (INV-, PO-).</p>
          </div>
        </div>
      </div>

      {/* Migration & Schema Compatibility State */}
      <div
        className="p-5 rounded-[var(--md-sys-shape-corner-medium)] border space-y-3"
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container)',
          borderColor: 'var(--md-sys-color-outline-variant)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--md-sys-color-on-surface)]">
            <Server size={18} className="text-emerald-500" />
            <span>Database Schema Compatibility Status</span>
          </div>
          <Badge variant="neutral" size="sm">
            Continuous Integration Managed
          </Badge>
        </div>

        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
          Schema migrations follow strict engineering governance (Repository PR → Automated CI Verification → Live Supabase Pipeline).
        </p>

        <div className="text-xs space-y-2 font-mono">
          <div className="flex items-center justify-between p-2.5 rounded bg-black/5 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-indigo-500" />
              <span>Migration 0024: platform schema & operator control plane</span>
            </div>
            <Badge variant="warning" size="sm">Pending Deployment</Badge>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded bg-black/5 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-indigo-500" />
              <span>Migration 0025: public.books & composite FK isolation</span>
            </div>
            <Badge variant="warning" size="sm">Pending Deployment</Badge>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded bg-black/5 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-emerald-500" />
              <span>PostgreSQL Multi-Tenant Row-Level Security Policies</span>
            </div>
            <Badge variant="neutral" size="sm">Authored in Repo</Badge>
          </div>
        </div>
      </div>
    </div>
  );
};
