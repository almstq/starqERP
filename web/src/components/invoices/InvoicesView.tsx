import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Search,
  Plus,
  Filter,
  CreditCard,
  Printer,
  ChevronRight,
  Clock,
  AlertCircle,
  FileCheck,
  Building2,
  DollarSign
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { RecordPaymentModal } from '../payments/RecordPaymentModal';

export const InvoicesView: React.FC = () => {
  const navigate = useNavigate();
  const {
    invoices,
    setIsCreateInvoiceOpen,
    setIsRecordPaymentOpen,
    setPrefilledInvoiceId,
    formatMVR,
    totalOutstandingInvoices
  } = useERP();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.linkedJobNumber && inv.linkedJobNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalInvoicedSum = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaidSum = invoices.reduce((sum, i) => sum + i.amountPaid, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="erp-h1 text-2xl">Commercial Invoices</h1>
            <span className="erp-pill erp-pill-neutral text-xs">
              {invoices.length} Invoices
            </span>
          </div>
          <p className="erp-muted mt-0.5 text-xs">
            Track customer billings, payment settlements, and outstanding balances
          </p>
        </div>

        <button
          onClick={() => setIsCreateInvoiceOpen(true)}
          className="erp-btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>New Invoice</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Total Invoiced (MTD)</span>
          <div className="erp-figure text-2xl font-bold mt-1">
            {formatMVR(totalInvoicedSum, false)}
          </div>
        </div>

        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Outstanding Receivables</span>
          <div className={`erp-figure text-2xl font-bold mt-1 ${totalOutstandingInvoices > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {formatMVR(totalOutstandingInvoices, false)}
          </div>
        </div>

        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Settled Collections</span>
          <div className="erp-figure text-2xl font-bold erp-money-in mt-1">
            {formatMVR(totalPaidSum, false)}
          </div>
        </div>
      </div>

      {/* Toolbar & Search */}
      <div className="erp-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="erp-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by invoice #, customer name, job ID..."
            className="erp-input w-full pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="erp-muted">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="erp-input py-1 text-xs"
          >
            <option value="All">All Invoices</option>
            <option value="Paid">Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="erp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer & Job</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th className="text-right">Total Amount</th>
                <th className="text-right">Amount Paid</th>
                <th className="text-right">Balance Due</th>
                <th className="text-center">Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center erp-muted py-8">
                    No commercial invoices matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    data-clickable="true"
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
                    <td>
                      <div className="font-mono font-bold" style={{ color: 'var(--accent)' }}>
                        {inv.invoiceNumber}
                      </div>
                    </td>
                    <td>
                      <div className="font-bold text-xs">{inv.customerName}</div>
                      {inv.linkedJobNumber && (
                        <div className="text-[11px] font-mono erp-muted">Job: {inv.linkedJobNumber}</div>
                      )}
                    </td>
                    <td className="text-xs">{inv.date}</td>
                    <td className="text-xs erp-muted">{inv.dueDate}</td>
                    <td className="text-right font-mono font-bold">{formatMVR(inv.totalAmount)}</td>
                    <td className="text-right font-mono erp-money-in">{formatMVR(inv.amountPaid)}</td>
                    <td className="text-right font-mono font-bold">
                      {inv.balanceDue > 0 ? (
                        <span className="text-rose-400">{formatMVR(inv.balanceDue)}</span>
                      ) : (
                        <span className="text-emerald-400">0.00</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className={`erp-pill ${
                        inv.status === 'Paid'
                          ? 'erp-pill-positive'
                          : inv.status === 'Overdue'
                          ? 'erp-pill-danger'
                          : 'erp-pill-warning'
                      } text-[11px]`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                        Inspect →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateInvoiceModal />
      <RecordPaymentModal />
    </div>
  );
};
