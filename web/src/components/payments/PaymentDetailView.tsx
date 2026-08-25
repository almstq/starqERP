import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  Calendar,
  DollarSign,
  User,
  FileText,
  Building2,
  Printer,
  ChevronRight,
  ShieldCheck,
  Receipt
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export const PaymentDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { payments, invoices, customers, formatMVR } = useERP();

  const payment = payments.find(
    (p) => p.id === id || p.paymentNumber.toLowerCase() === id?.toLowerCase()
  );

  if (!payment) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/payments')} className="erp-btn-quiet flex items-center gap-2">
          <ArrowLeft size={16} />
          <span>Back to Payments</span>
        </button>
        <div className="erp-card p-12 text-center">
          <CreditCard size={40} className="erp-muted mx-auto mb-3" />
          <h2 className="erp-h1 text-xl">Payment Receipt Not Found</h2>
          <p className="erp-muted mt-2 text-sm">No payment transaction matching ID "{id}" was found.</p>
          <button onClick={() => navigate('/payments')} className="erp-btn-primary mt-6">
            View All Payments
          </button>
        </div>
      </div>
    );
  }

  const linkedInvoice = invoices.find(
    (inv) => inv.id === payment.invoiceId || inv.invoiceNumber === payment.invoiceNumber
  );
  const customer = customers.find((c) => c.id === payment.customerId);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/payments')}
            className="erp-btn-quiet p-2 rounded-xl flex items-center justify-center"
            title="Back to Payments"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="erp-h1 text-2xl">{payment.paymentNumber}</h1>
              <span className="erp-pill erp-pill-positive flex items-center gap-1">
                <CheckCircle2 size={12} />
                <span>{payment.status}</span>
              </span>
            </div>
            <p className="erp-muted mt-0.5 text-xs">
              Recorded on {payment.paymentDate} • Bank Settlement Receipt
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="erp-btn-quiet flex items-center gap-1.5"
            title="Print Receipt"
          >
            <Printer size={16} />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Payment Details & Transaction Proof */}
        <div className="lg:col-span-7 space-y-6">
          {/* Amount Card */}
          <div className="erp-card p-6 space-y-2">
            <span className="erp-muted block text-xs font-semibold uppercase tracking-wider">
              Amount Received
            </span>
            <div className="erp-figure text-3xl font-extrabold erp-money-in">
              {formatMVR(payment.amount)}
            </div>
            <p className="erp-muted text-xs">
              Settled via {payment.method} • Ref: <span className="font-mono font-bold">{payment.referenceNumber}</span>
            </p>
          </div>

          {/* Transaction Metadata */}
          <div className="erp-card p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">Transaction Verification Details</h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Payment Reference #:</span>
                <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{payment.paymentNumber}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Settlement Date:</span>
                <span className="font-mono font-semibold">{payment.paymentDate}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Payment Channel:</span>
                <span className="font-semibold">{payment.method}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Bank Slip / Auth Reference:</span>
                <span className="font-mono font-bold">{payment.referenceNumber}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Settlement Account:</span>
                <span className="font-mono">Bank of Maldives (7730000189201)</span>
              </div>
              <div className="flex justify-between py-1.5" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Verification Status:</span>
                <span className="erp-pill erp-pill-positive text-[11px]">Bank Reconciled</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Matched Invoice & Customer */}
        <div className="lg:col-span-5 space-y-6">
          {/* Matched Commercial Invoice */}
          <div className="erp-card p-5 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider">Matched Invoice</h2>
            {linkedInvoice ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="erp-muted">Invoice #:</span>
                  <Link
                    to={`/invoices/${linkedInvoice.id}`}
                    className="font-mono font-bold hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    {linkedInvoice.invoiceNumber} →
                  </Link>
                </div>
                <div className="flex justify-between">
                  <span className="erp-muted">Invoice Total:</span>
                  <span className="font-mono font-semibold">{formatMVR(linkedInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="erp-muted">Invoice Status:</span>
                  <span className={`erp-pill ${linkedInvoice.status === 'Paid' ? 'erp-pill-positive' : 'erp-pill-warning'}`}>
                    {linkedInvoice.status}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <span className="erp-muted">Remaining Balance:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatMVR(linkedInvoice.balanceDue)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs erp-muted">
                Applied to Invoice <span className="font-mono font-bold">{payment.invoiceNumber}</span>
              </p>
            )}
          </div>

          {/* Payer Customer */}
          <div className="erp-card p-5 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider">Payer Customer</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="erp-muted">Customer Name:</span>
                {customer ? (
                  <Link
                    to={`/customers/${customer.id}`}
                    className="font-bold hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    {payment.customerName} →
                  </Link>
                ) : (
                  <span className="font-bold">{payment.customerName}</span>
                )}
              </div>
              {customer && (
                <>
                  <div className="flex justify-between">
                    <span className="erp-muted">Phone:</span>
                    <span className="font-mono">{customer.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="erp-muted">Island:</span>
                    <span>{customer.island}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
