import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Search,
  Plus,
  Building2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowUpRight,
  TrendingUp,
  Landmark
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { RecordPaymentModal } from './RecordPaymentModal';

export const PaymentsView: React.FC = () => {
  const navigate = useNavigate();
  const {
    payments,
    setIsRecordPaymentOpen,
    formatMVR,
    totalCashReceived
  } = useERP();

  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.paymentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMethod = methodFilter === 'All' || p.method.includes(methodFilter);
    return matchesSearch && matchesMethod;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="erp-h1 text-2xl">Payments & Cash Receipts</h1>
            <span className="erp-pill erp-pill-positive text-xs">
              {payments.length} Transactions
            </span>
          </div>
          <p className="erp-muted mt-0.5 text-xs">
            Customer payment receipts, bank transfers (BML, MIB), and settlement reconciliation
          </p>
        </div>

        <button
          onClick={() => setIsRecordPaymentOpen(true)}
          className="erp-btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Record Payment</span>
        </button>
      </div>

      {/* Account Balances Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="erp-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold erp-muted">BML Main Business A/C</span>
            <Landmark size={16} className="text-rose-400" />
          </div>
          <div className="erp-figure text-xl font-bold">MVR 342,890.00</div>
          <div className="text-[11px] erp-muted font-mono">A/C: 7730000189201</div>
        </div>

        <div className="erp-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold erp-muted">MIB Islamic Account</span>
            <Landmark size={16} className="text-emerald-400" />
          </div>
          <div className="erp-figure text-xl font-bold">MVR 88,400.00</div>
          <div className="text-[11px] erp-muted font-mono">A/C: 9010048192011</div>
        </div>

        <div className="erp-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold erp-muted">Workshop Cash Register</span>
            <CreditCard size={16} className="text-amber-400" />
          </div>
          <div className="erp-figure text-xl font-bold">MVR 12,500.00</div>
          <div className="text-[11px] erp-muted">Physical drawer cash</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="erp-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="erp-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by payment #, customer, reference, invoice..."
            className="erp-input w-full pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="erp-muted">Method:</span>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="erp-input py-1 text-xs"
          >
            <option value="All">All Channels</option>
            <option value="BML Transfer">BML Transfer</option>
            <option value="MIB Transfer">MIB Transfer</option>
            <option value="Cash">Cash</option>
            <option value="POS Card">Card Swipe</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="erp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Customer Name</th>
                <th>Matched Invoice</th>
                <th>Channel & Ref</th>
                <th>Date</th>
                <th className="text-right">Amount Received</th>
                <th className="text-center">Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center erp-muted py-8">
                    No payment transactions matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    data-clickable="true"
                    onClick={() => navigate(`/payments/${payment.id}`)}
                  >
                    <td>
                      <div className="font-mono font-bold" style={{ color: 'var(--accent)' }}>
                        {payment.paymentNumber}
                      </div>
                    </td>
                    <td className="font-semibold text-xs">{payment.customerName}</td>
                    <td>
                      <span className="font-mono text-xs">{payment.invoiceNumber}</span>
                    </td>
                    <td className="text-xs">
                      <div>{payment.method}</div>
                      <div className="text-[11px] font-mono erp-muted">Ref: {payment.referenceNumber}</div>
                    </td>
                    <td className="text-xs">{payment.paymentDate}</td>
                    <td className="text-right font-mono font-bold erp-money-in">
                      {formatMVR(payment.amount)}
                    </td>
                    <td className="text-center">
                      <span className="erp-pill erp-pill-positive text-[11px]">{payment.status}</span>
                    </td>
                    <td className="text-right">
                      <span className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                        View Receipt →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RecordPaymentModal />
    </div>
  );
};
