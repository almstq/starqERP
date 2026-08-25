import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  User,
  Wrench,
  Calendar,
  DollarSign,
  CreditCard,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Plus
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export const InvoiceDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { invoices, jobs, payments, formatMVR, setIsRecordPaymentOpen } = useERP();

  const invoice = invoices.find(
    (inv) => inv.id === id || inv.invoiceNumber.toLowerCase() === id?.toLowerCase()
  );

  if (!invoice) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/invoices')} className="erp-btn-quiet flex items-center gap-2">
          <ArrowLeft size={16} />
          <span>Back to Invoices</span>
        </button>
        <div className="erp-card p-12 text-center">
          <FileText size={40} className="erp-muted mx-auto mb-3" />
          <h2 className="erp-h1 text-xl">Invoice Not Found</h2>
          <p className="erp-muted mt-2 text-sm">No commercial invoice matching ID "{id}" was found.</p>
          <button onClick={() => navigate('/invoices')} className="erp-btn-primary mt-6">
            View All Invoices
          </button>
        </div>
      </div>
    );
  }

  const linkedJob = jobs.find((j) => j.id === invoice.linkedJobId || j.jobId === invoice.linkedJobNumber);
  const linkedPayments = payments.filter((p) => p.invoiceId === invoice.id || p.invoiceNumber === invoice.invoiceNumber);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/invoices')}
            className="erp-btn-quiet p-2 rounded-xl flex items-center justify-center"
            title="Back to Invoices"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="erp-h1 text-2xl">{invoice.invoiceNumber}</h1>
              <span className={`erp-pill ${
                invoice.status === 'Paid' ? 'erp-pill-positive' : invoice.status === 'Overdue' ? 'erp-pill-danger' : 'erp-pill-warning'
              }`}>
                {invoice.status}
              </span>
            </div>
            <p className="erp-muted mt-0.5 text-xs">
              Issued: {invoice.date} • Due: {invoice.dueDate}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {invoice.balanceDue > 0 && (
            <button
              onClick={() => setIsRecordPaymentOpen(true)}
              className="erp-btn-primary flex items-center gap-1.5"
            >
              <CreditCard size={14} />
              <span>Record Payment</span>
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="erp-btn-quiet p-2"
            title="Print Invoice"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Line items, Customer details, Billing terms */}
        <div className="lg:col-span-8 space-y-6">
          {/* Customer & Job Links */}
          <div className="erp-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="erp-muted block text-[11px]">Billed To Customer:</span>
              <Link
                to={`/customers/${invoice.customerId}`}
                className="font-bold text-sm hover:underline block"
                style={{ color: 'var(--accent)' }}
              >
                {invoice.customerName} →
              </Link>
              {invoice.customerPhone && (
                <span className="erp-muted block font-mono">{invoice.customerPhone}</span>
              )}
            </div>

            {(invoice.linkedJobId || invoice.linkedJobNumber) && (
              <div className="space-y-1 sm:border-l sm:pl-4" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted block text-[11px]">Linked Work Order:</span>
                <Link
                  to={`/jobs/${invoice.linkedJobId || linkedJob?.id || ''}`}
                  className="font-mono font-bold text-sm hover:underline block"
                  style={{ color: 'var(--accent)' }}
                >
                  {invoice.linkedJobNumber || linkedJob?.jobId || 'Work Order'} →
                </Link>
                {linkedJob?.vehicle && (
                  <span className="erp-muted block">
                    Asset: {linkedJob.vehicle.plateNumber} ({linkedJob.vehicle.model})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="erp-card p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">Line Items & Services</h2>
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="font-semibold">{item.description}</td>
                      <td className="text-center font-mono">{item.quantity}</td>
                      <td className="text-right font-mono">{formatMVR(item.unitPrice)}</td>
                      <td className="text-right font-mono font-bold">{formatMVR(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="pt-4 border-t space-y-2 text-xs" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between">
                <span className="erp-muted">Subtotal:</span>
                <span className="font-mono font-semibold">{formatMVR(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="erp-muted">Tax Status:</span>
                <span className="font-mono erp-muted">Non-GST Registered</span>
              </div>
              <div className="flex justify-between pt-2 border-t text-sm font-bold" style={{ borderColor: 'var(--border)' }}>
                <span>Total Amount Due:</span>
                <span className="font-mono" style={{ color: 'var(--accent)' }}>{formatMVR(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Applied Payments Table */}
          <div className="erp-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-bold uppercase tracking-wider">Payments Received for this Invoice</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Date</th>
                    <th>Method / Reference</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedPayments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center erp-muted py-6">
                        No payments recorded against this invoice yet.
                      </td>
                    </tr>
                  ) : (
                    linkedPayments.map((p) => (
                      <tr key={p.id} data-clickable="true" onClick={() => navigate(`/payments/${p.id}`)}>
                        <td className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{p.paymentNumber}</td>
                        <td className="text-xs">{p.paymentDate}</td>
                        <td className="text-xs">{p.method} ({p.referenceNumber})</td>
                        <td className="text-right font-mono font-bold erp-money-in">{formatMVR(p.amount)}</td>
                        <td className="text-right">
                          <span className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>View Receipt →</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Settlement Snapshot & Balances */}
        <div className="lg:col-span-4 space-y-6">
          <div className="erp-card p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">Settlement Overview</h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="erp-muted">Invoice Total:</span>
                <span className="font-mono font-bold">{formatMVR(invoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="erp-muted">Amount Settled:</span>
                <span className="font-mono font-semibold erp-money-in">{formatMVR(invoice.amountPaid)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="font-semibold">Remaining Balance:</span>
                <span className={`font-mono font-bold text-sm ${invoice.balanceDue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {formatMVR(invoice.balanceDue)}
                </span>
              </div>
            </div>

            {invoice.balanceDue > 0 ? (
              <button
                onClick={() => setIsRecordPaymentOpen(true)}
                className="erp-btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5 mt-2"
              >
                <CreditCard size={14} />
                <span>Record Payment of {formatMVR(invoice.balanceDue)}</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl border flex items-center gap-2 text-xs" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--positive)' }} />
                <span className="font-semibold" style={{ color: 'var(--positive)' }}>
                  Fully settled and cleared.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
