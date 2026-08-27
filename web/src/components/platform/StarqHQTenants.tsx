import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { PLATFORM_CLIENTS_REGISTRY } from '../../data/mockData';
import {
  Building2,
  Layers,
  Users,
  Search,
  CheckCircle2,
  Sparkles,
  MapPin,
  ShieldCheck,
  Info
} from 'lucide-react';
import { Badge } from '../common/Badge';

export const StarqHQTenants: React.FC = () => {
  const { tenants } = useERP();
  const [searchQuery, setSearchQuery] = useState('');

  // Merge live local tenants with platform client registry for complete portfolio view
  const clientList = PLATFORM_CLIENTS_REGISTRY.map((registryClient) => {
    const liveTenant = tenants.find((t) => t.id === registryClient.id);
    return {
      ...registryClient,
      isLocalActive: Boolean(liveTenant),
      booksCount: liveTenant ? liveTenant.books?.length || 1 : registryClient.booksCount,
    };
  });

  const filteredClients = clientList.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.archetype.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.island.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--md-sys-color-on-surface)]">
              Customer Organisations Directory
            </h2>
            <Badge variant="accent" size="sm">
              {clientList.length} Organisations Total
            </Badge>
          </div>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
            Complete starqERP client tenant portfolio across Maldives. Ledgers remain segregated by RLS.
          </p>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-[var(--md-sys-color-on-surface-variant)]" />
          <input
            type="text"
            placeholder="Search clients, legal names, atolls..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-[var(--md-sys-shape-corner-small)] border bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] w-64"
            style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}
          />
        </div>
      </div>

      {/* Security Privacy Notice */}
      <div
        className="p-3 rounded-[var(--md-sys-shape-corner-small)] border flex items-start gap-2.5 text-xs text-[var(--md-sys-color-on-surface-variant)]"
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container)',
          borderColor: 'var(--md-sys-color-outline-variant)',
        }}
      >
        <ShieldCheck size={16} className="text-indigo-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-[var(--md-sys-color-on-surface)]">Platform Metadata Only:</strong> Operators manage subscriptions, seat allocations, and provisioning. Ambient access to customer tax invoices, payroll, and private journals is blocked by PostgreSQL Row-Level Security.
        </div>
      </div>

      {/* Tenants Table */}
      <div
        className="rounded-[var(--md-sys-shape-corner-medium)] border overflow-hidden"
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container)',
          borderColor: 'var(--md-sys-color-outline-variant)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className="border-b font-bold text-[var(--md-sys-color-on-surface-variant)] bg-black/5 dark:bg-white/5"
                style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}
              >
                <th className="p-3">Customer Organisation</th>
                <th className="p-3">Legal Entity Name</th>
                <th className="p-3">Operating Archetype</th>
                <th className="p-3">Location</th>
                <th className="p-3 text-center">Books</th>
                <th className="p-3 text-center">Seats Quota</th>
                <th className="p-3">SaaS Plan</th>
                <th className="p-3 text-center">Schema Version</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
              {filteredClients.map((client) => (
                <tr
                  key={client.id}
                  className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <td className="p-3 font-semibold text-[var(--md-sys-color-on-surface)]">
                    <div className="flex items-center gap-2">
                      <Building2 size={15} className="text-[var(--md-sys-color-primary)] shrink-0" />
                      <span>{client.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-[var(--md-sys-color-on-surface-variant)] font-mono text-[11px]">
                    {client.legalName}
                  </td>
                  <td className="p-3 text-[var(--md-sys-color-on-surface)]">
                    <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[11px] font-semibold">
                      {client.archetype}
                    </span>
                  </td>
                  <td className="p-3 text-[var(--md-sys-color-on-surface-variant)] flex items-center gap-1 mt-1">
                    <MapPin size={12} className="text-rose-500 shrink-0" />
                    <span>{client.island}</span>
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-[var(--md-sys-color-on-surface)]">
                    {client.booksCount}
                  </td>
                  <td className="p-3 text-center font-mono text-[var(--md-sys-color-on-surface)]">
                    {client.activeUsersCount} active
                  </td>
                  <td className="p-3">
                    <Badge variant={client.plan === 'Enterprise' ? 'accent' : 'neutral'} size="sm">
                      {client.plan}
                    </Badge>
                  </td>
                  <td className="p-3 text-center font-mono text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                    v2026.08
                  </td>
                  <td className="p-3 text-center">
                    <Badge
                      variant={
                        client.status === 'active'
                          ? 'positive'
                          : client.status === 'pending'
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {client.status.toUpperCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
