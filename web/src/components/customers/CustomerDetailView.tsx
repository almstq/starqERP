import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Car,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Receipt,
  Wrench,
  DollarSign,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  ChevronRight,
  Edit3
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export const CustomerDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { customers, jobs, invoices, formatMVR } = useERP();

  const [activeTab, setActiveTab] = useState<'overview' | 'vehicles' | 'jobs' | 'invoices' | 'notes'>('overview');

  const customer = customers.find((c) => c.id === id);

  if (!customer) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/customers')} className="erp-btn-quiet flex items-center gap-2">
          <ArrowLeft size={16} />
          <span>Back to Customers</span>
        </button>
        <div className="erp-card p-12 text-center">
          <Users size={40} className="erp-muted mx-auto mb-3" />
          <h2 className="erp-h1 text-xl">Customer Profile Not Found</h2>
          <p className="erp-muted mt-2 text-sm">No customer matching ID "{id}" was found.</p>
          <button onClick={() => navigate('/customers')} className="erp-btn-primary mt-6">
            View All Customers
          </button>
        </div>
      </div>
    );
  }

  const customerJobs = jobs.filter((j) => j.customerId === customer.id);
  const customerInvoices = invoices.filter((inv) => inv.customerId === customer.id);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation & Profile Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/customers')}
          className="erp-btn-quiet p-2 rounded-xl flex items-center justify-center"
          title="Back to Customers"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="erp-h1 text-2xl">{customer.name}</h1>
            <span className={`erp-pill ${
              customer.type === 'VIP' ? 'erp-pill-warning' : customer.type === 'Fleet' ? 'erp-pill-info' : 'erp-pill-neutral'
            }`}>
              {customer.type}
            </span>
          </div>
          <p className="erp-muted mt-0.5 text-xs flex items-center gap-3">
            <span>{customer.phone}</span>
            <span>•</span>
            <span>{customer.email}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              <span>{customer.island}</span>
            </span>
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Total Invoiced</span>
          <div className="erp-figure text-lg mt-1">{formatMVR(customer.totalInvoiced, false)}</div>
        </div>
        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Outstanding Balance</span>
          <div className={`erp-figure text-lg mt-1 ${customer.outstandingBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {formatMVR(customer.outstandingBalance, false)}
          </div>
        </div>
        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Active Work Orders</span>
          <div className="erp-figure text-lg mt-1" style={{ color: 'var(--accent)' }}>
            {customerJobs.filter(j => !['Completed', 'Paid'].includes(j.status)).length} Active
          </div>
        </div>
        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Registered Vehicles</span>
          <div className="erp-figure text-lg mt-1">{customer.vehicles.length} Units</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-4" style={{ borderColor: 'var(--border)' }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'vehicles', label: `Vehicles (${customer.vehicles.length})` },
          { id: 'jobs', label: `Work Orders (${customerJobs.length})` },
          { id: 'invoices', label: `Invoices (${customerInvoices.length})` },
          { id: 'notes', label: 'Notes & Preferences' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className="pb-3 text-sm font-semibold transition-all relative"
            style={{
              color: activeTab === tab.id ? 'var(--foreground)' : 'var(--muted-foreground)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="erp-card p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider erp-muted">Primary Contact & Location</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Full Name:</span>
                <span className="font-semibold">{customer.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Phone Number:</span>
                <span className="font-mono">{customer.phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Email Address:</span>
                <span>{customer.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Island / Atoll:</span>
                <span>{customer.island}</span>
              </div>
              <div className="flex justify-between py-1" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Customer Since:</span>
                <span>{customer.createdAt}</span>
              </div>
            </div>
          </div>

          <div className="erp-card p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider erp-muted">Quick Registered Vehicles</h3>
            <div className="space-y-2">
              {customer.vehicles.map((v, idx) => (
                <div key={idx} className="p-3 rounded-xl border flex items-center justify-between text-xs" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2.5">
                    <Car size={16} style={{ color: 'var(--accent)' }} />
                    <div>
                      <span className="font-mono font-bold block" style={{ color: 'var(--accent)' }}>{v.plateNumber}</span>
                      <span className="erp-muted text-[11px]">{v.make} {v.model} ({v.color})</span>
                    </div>
                  </div>
                  <span className="erp-pill erp-pill-neutral text-[10px]">{v.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vehicles' && (
        <div className="erp-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider">Registered Vehicles & Vessels</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customer.vehicles.map((v, idx) => (
              <div key={idx} className="p-4 rounded-xl border space-y-2" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm" style={{ color: 'var(--accent)' }}>{v.plateNumber}</span>
                  <span className="erp-pill erp-pill-neutral text-[10px]">{v.type}</span>
                </div>
                <div className="text-xs font-semibold">{v.make} {v.model}</div>
                <div className="text-[11px] erp-muted">
                  Year: {v.year || 'N/A'} • Color: {v.color}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="erp-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider">Work Order History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Service</th>
                  <th>Vehicle</th>
                  <th className="text-right">Quoted Amount</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {customerJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center erp-muted py-8">No work orders recorded for this customer.</td>
                  </tr>
                ) : (
                  customerJobs.map((j) => (
                    <tr key={j.id} data-clickable="true" onClick={() => navigate(`/jobs/${j.id}`)}>
                      <td className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{j.jobId}</td>
                      <td className="font-semibold">{j.serviceType}</td>
                      <td className="font-mono text-xs">{j.vehicle.plateNumber} ({j.vehicle.model})</td>
                      <td className="text-right font-mono font-bold">{formatMVR(j.quotedAmount)}</td>
                      <td className="text-center">
                        <span className="erp-pill erp-pill-info">{j.status}</span>
                      </td>
                      <td className="text-right">
                        <span className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>View →</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="erp-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider">Commercial Invoices</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th className="text-right">Total Amount</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {customerInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center erp-muted py-8">No invoices generated for this customer.</td>
                  </tr>
                ) : (
                  customerInvoices.map((inv) => (
                    <tr key={inv.id} data-clickable="true" onClick={() => navigate(`/invoices/${inv.id}`)}>
                      <td className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{inv.invoiceNumber}</td>
                      <td className="text-xs">{inv.date}</td>
                      <td className="text-right font-mono font-bold">{formatMVR(inv.totalAmount)}</td>
                      <td className="text-right font-mono erp-money-in">{formatMVR(inv.amountPaid)}</td>
                      <td className={`text-right font-mono font-bold ${inv.balanceDue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatMVR(inv.balanceDue)}
                      </td>
                      <td className="text-center">
                        <span className={`erp-pill ${inv.status === 'Paid' ? 'erp-pill-positive' : 'erp-pill-warning'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>Inspect →</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="erp-card p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider">Customer Operational Notes</h3>
          <div className="p-4 rounded-xl text-xs leading-relaxed" style={{ background: 'var(--muted)' }}>
            {customer.notes || 'No customer notes recorded.'}
          </div>
        </div>
      )}
    </div>
  );
};
