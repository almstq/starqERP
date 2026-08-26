import React, { useState, useEffect } from 'react';
import {
  Search,
  Wrench,
  Users,
  Receipt,
  Boxes,
  ArrowRight,
  Sparkles,
  Car
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Badge } from '../common/Badge';

export const GlobalSearchModal: React.FC = () => {
  const {
    isGlobalSearchOpen,
    setIsGlobalSearchOpen,
    jobs,
    customers,
    invoices,
    inventory,
    setActiveTab,
    setSelectedJobId,
    setSelectedCustomerId,
    setSelectedInvoiceId,
    formatMVR
  } = useERP();

  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsGlobalSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsGlobalSearchOpen]);

  if (!isGlobalSearchOpen) return null;

  const q = query.toLowerCase().trim();

  const filteredJobs = q
    ? jobs.filter(
        (j) =>
          j.jobId.toLowerCase().includes(q) ||
          j.customerName.toLowerCase().includes(q) ||
          j.vehicle.plateNumber.toLowerCase().includes(q) ||
          j.vehicle.model.toLowerCase().includes(q) ||
          j.serviceType.toLowerCase().includes(q)
      )
    : jobs.slice(0, 3);

  const filteredCustomers = q
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.island.toLowerCase().includes(q) ||
          c.vehicles.some((v) => v.plateNumber.toLowerCase().includes(q) || v.model.toLowerCase().includes(q))
      )
    : customers.slice(0, 3);

  const filteredInvoices = q
    ? invoices.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.customerName.toLowerCase().includes(q) ||
          (inv.linkedJobNumber && inv.linkedJobNumber.toLowerCase().includes(q))
      )
    : invoices.slice(0, 2);

  const filteredInventory = q
    ? inventory.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      )
    : inventory.slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={() => setIsGlobalSearchOpen(false)}
      />

      {/* Search Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <Search className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs, customers, vehicle plate #, invoice or inventory..."
            aria-label="Search across work orders, customers, invoices, and inventory"
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono border border-slate-700" aria-label="Press Escape to close">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4 text-xs">
          {/* Jobs */}
          {filteredJobs.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span>Work Orders ({filteredJobs.length})</span>
              </div>
              <div className="space-y-1">
                {filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => {
                      setActiveTab('jobs');
                      setSelectedJobId(job.id);
                      setIsGlobalSearchOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                        {job.jobId.slice(-3)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{job.jobId}</span>
                          <span className="text-slate-400">• {job.customerName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                          <Car className="w-3 h-3 text-slate-400" />
                          <span>
                            {job.vehicle.plateNumber} ({job.vehicle.make} {job.vehicle.model}) — {job.serviceType}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={
                          job.status === 'Completed'
                            ? 'success'
                            : job.status === 'In Progress'
                            ? 'info'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {job.status}
                      </Badge>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customers */}
          {filteredCustomers.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Customers & Fleets ({filteredCustomers.length})</span>
              </div>
              <div className="space-y-1">
                {filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setActiveTab('customers');
                      setSelectedCustomerId(c.id);
                      setIsGlobalSearchOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div>
                      <div className="font-bold text-slate-200 flex items-center gap-2">
                        <span>{c.name}</span>
                        <Badge size="sm">{c.type}</Badge>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {c.phone} • {c.island} • {c.vehicles.length} vehicle(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-slate-300">{formatMVR(c.totalInvoiced, false)}</div>
                      <div className="text-[10px] text-slate-400">Total Billed</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices */}
          {filteredInvoices.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                <span>Invoices ({filteredInvoices.length})</span>
              </div>
              <div className="space-y-1">
                {filteredInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      setActiveTab('invoices');
                      setSelectedInvoiceId(inv.id);
                      setIsGlobalSearchOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div>
                      <span className="font-bold text-slate-200">{inv.invoiceNumber}</span>
                      <span className="text-slate-400 ml-2">({inv.customerName})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-100">{formatMVR(inv.totalAmount)}</span>
                      <Badge variant={inv.status === 'Paid' ? 'success' : inv.status === 'Overdue' ? 'danger' : 'warning'} size="sm">
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inventory */}
          {filteredInventory.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-purple-400" />
                <span>Inventory & Paint Materials ({filteredInventory.length})</span>
              </div>
              <div className="space-y-1">
                {filteredInventory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveTab('inventory');
                      setIsGlobalSearchOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-200">{item.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {item.sku} • {item.locationInShop}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-200">
                        {item.quantityOnHand} {item.unit}
                      </span>
                      <Badge variant={item.stockStatus === 'Low Stock' ? 'danger' : 'success'} size="sm" className="ml-2">
                        {item.stockStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Navigate with mouse or arrow keys</span>
          <span className="flex items-center gap-1 text-amber-400 font-medium">
            <Sparkles className="w-3 h-3" /> Starq Intelligent Search
          </span>
        </div>
      </div>
    </div>
  );
};
