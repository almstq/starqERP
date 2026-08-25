import React from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  Car,
  Wrench,
  Receipt,
  CreditCard,
  Plus,
  Calendar,
  DollarSign,
  Clock,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Badge } from '../common/Badge';

export const CustomerDetailDrawer: React.FC = () => {
  const {
    selectedCustomerId,
    setSelectedCustomerId,
    customers,
    jobs,
    invoices,
    payments,
    formatMVR,
    setActiveTab,
    setSelectedJobId,
    setSelectedInvoiceId,
    setIsCreateJobOpen,
    setIsCreateInvoiceOpen,
    setPrefilledCustomerId
  } = useERP();

  if (!selectedCustomerId) return null;

  const customer = customers.find((c) => c.id === selectedCustomerId);
  if (!customer) return null;

  const customerJobs = jobs.filter((j) => j.customerId === customer.id || j.customerName === customer.name);
  const customerInvoices = invoices.filter((i) => i.customerId === customer.id || i.customerName === customer.name);
  const customerPayments = payments.filter((p) => p.customerId === customer.id || p.customerName === customer.name);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={() => setSelectedCustomerId(null)}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-extrabold text-base flex items-center justify-center shadow-sm">
              {customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{customer.name}</h2>
                <Badge
                  variant={
                    customer.type === 'VIP'
                      ? 'purple'
                      : customer.type === 'Fleet'
                      ? 'info'
                      : 'neutral'
                  }
                >
                  {customer.type}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {customer.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {customer.email}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  {customer.island}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setSelectedCustomerId(null)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50/60 border-b border-slate-200 text-center">
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Invoiced</span>
            <div className="text-base font-extrabold text-slate-900 mono-num mt-0.5">
              {formatMVR(customer.totalInvoiced, false)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Outstanding</span>
            <div
              className={`text-base font-extrabold mono-num mt-0.5 ${
                customer.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {formatMVR(customer.outstandingBalance, false)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Jobs</span>
            <div className="text-base font-extrabold text-blue-600 mono-num mt-0.5">
              {customerJobs.filter((j) => !['Completed', 'Paid'].includes(j.status)).length} in shop
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex gap-2">
          <button
            onClick={() => {
              setPrefilledCustomerId(customer.id);
              setIsCreateJobOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Work Order</span>
          </button>
          <button
            onClick={() => {
              setPrefilledCustomerId(customer.id);
              setIsCreateInvoiceOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors shadow-2xs"
          >
            <Receipt className="w-4 h-4 text-blue-600" />
            <span>Create Invoice</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {/* Registered Vehicles / Assets */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-600" />
              <span>Registered Vehicles & Vessels ({customer.vehicles.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {customer.vehicles.map((veh, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-blue-600 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-xs">
                      {veh.plateNumber}
                    </span>
                    <Badge size="sm">{veh.type}</Badge>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    {veh.year} {veh.make} {veh.model}
                  </div>
                  <div className="text-[11px] text-slate-500">Color: {veh.color}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes & Preferences */}
          {customer.notes && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <div className="font-bold text-amber-800 mb-1">Customer Notes & Garage Specs</div>
              <p className="text-xs text-amber-900/80 leading-relaxed">{customer.notes}</p>
            </div>
          )}

          {/* Job History */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" />
              <span>Work Orders & History ({customerJobs.length})</span>
            </h3>
            {customerJobs.length === 0 ? (
              <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                No work orders recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {customerJobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setActiveTab('jobs');
                    }}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-600">{job.jobId}</span>
                        <span className="font-semibold text-slate-900">{job.serviceType}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {job.vehicle.plateNumber} ({job.vehicle.make} {job.vehicle.model})
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold mono-num text-slate-900">{formatMVR(job.quotedAmount)}</div>
                        <div className="text-[10px] text-slate-400">{job.startDate}</div>
                      </div>
                      <Badge
                        variant={job.status === 'Completed' ? 'success' : 'info'}
                        size="sm"
                      >
                        {job.status}
                      </Badge>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoices History */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>Invoices ({customerInvoices.length})</span>
            </h3>
            {customerInvoices.length === 0 ? (
              <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                No invoices found.
              </div>
            ) : (
              <div className="space-y-2">
                {customerInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      setSelectedInvoiceId(inv.id);
                      setActiveTab('invoices');
                    }}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900 font-mono">{inv.invoiceNumber}</div>
                      <div className="text-[11px] text-slate-500">Due: {inv.dueDate}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold mono-num text-slate-900">{formatMVR(inv.totalAmount)}</div>
                        {inv.balanceDue > 0 && (
                          <div className="text-[10px] text-rose-600 mono-num">
                            Due: {formatMVR(inv.balanceDue)}
                          </div>
                        )}
                      </div>
                      <Badge
                        variant={inv.status === 'Paid' ? 'success' : inv.status === 'Overdue' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payments Received */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Payments Log ({customerPayments.length})</span>
            </h3>
            {customerPayments.length === 0 ? (
              <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                No payments logged yet.
              </div>
            ) : (
              <div className="space-y-2">
                {customerPayments.map((pay) => (
                  <div
                    key={pay.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 font-mono">{pay.paymentNumber}</div>
                      <div className="text-[11px] text-slate-500">
                        {pay.method} • Ref: {pay.referenceNumber}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold mono-num text-emerald-600">{formatMVR(pay.amount)}</div>
                      <div className="text-[10px] text-slate-400">{pay.paymentDate}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
