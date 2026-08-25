import React, { useState } from 'react';
import {
  Receipt,
  Search,
  Plus,
  Filter,
  DollarSign,
  Calendar,
  Building2,
  Tag,
  CreditCard,
  CheckCircle2,
  ArrowUpRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { PaymentMethod } from '../../types/erp';

export const ExpensesView: React.FC = () => {
  const { expenses, addExpense, formatMVR } = useERP();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [category, setCategory] = useState('Rent & Facilities');
  const [payee, setPayee] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BML Transfer');
  const [receiptRef, setReceiptRef] = useState('');

  const filtered = expenses.filter((e) => {
    const matchesSearch =
      e.payee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.receiptRef && e.receiptRef.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'All' || e.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...new Set(expenses.map((e) => e.category))];
  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payee || !amount || Number(amount) <= 0) return;
    addExpense({
      category,
      payee,
      description,
      amount: Number(amount),
      date: new Date().toISOString().split('T')[0],
      paymentMethod,
      receiptRef,
      status: 'Paid'
    });
    setIsAddOpen(false);
    setPayee('');
    setDescription('');
    setAmount('');
    setReceiptRef('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="erp-h1 text-2xl">Operating Expenses</h1>
            <span className="erp-pill erp-pill-neutral text-xs">
              {expenses.length} Records
            </span>
          </div>
          <p className="erp-muted mt-0.5 text-xs">
            Log and track operational overheads — shop rent, STELCO utilities, shop consumables, and payroll
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(!isAddOpen)}
          className="erp-btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Add Expense</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Total Operating Expenses (MTD)</span>
          <div className="erp-figure text-2xl font-bold erp-money-out mt-1">
            {formatMVR(totalExpenseAmount)}
          </div>
        </div>
        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Highest Category</span>
          <div className="erp-figure text-xl font-bold mt-1">Rent & Facilities</div>
        </div>
        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Settlement Channels</span>
          <div className="text-xs erp-muted mt-1 font-semibold">
            BML Corporate Account • Cash Petty Box
          </div>
        </div>
      </div>

      {/* Add Expense Drawer / Form */}
      {isAddOpen && (
        <form onSubmit={handleAddExpense} className="erp-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-bold uppercase tracking-wider">Record New Expense Payment</h2>
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="text-xs erp-muted hover:underline"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="erp-muted block mb-1">Expense Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="erp-input w-full"
              >
                <option value="Rent & Facilities">Rent & Facilities</option>
                <option value="Utilities & Electricity">Utilities & Electricity (STELCO)</option>
                <option value="Consumables & Tools">Consumables & Tools</option>
                <option value="Staff Payroll & Advance">Staff Payroll & Advance</option>
                <option value="Freight & Sea Cargo">Freight & Sea Cargo</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>

            <div>
              <label className="erp-muted block mb-1">Payee / Vendor</label>
              <input
                type="text"
                placeholder="e.g. STELCO Maldives"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                required
                className="erp-input w-full"
              />
            </div>

            <div>
              <label className="erp-muted block mb-1">Amount (MVR)</label>
              <input
                type="number"
                min="1"
                placeholder="MVR amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="erp-input w-full"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="erp-muted block mb-1">Description / Bill Memo</label>
              <input
                type="text"
                placeholder="e.g. Spray booth electricity bill for April"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="erp-input w-full"
              />
            </div>

            <div>
              <label className="erp-muted block mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="erp-input w-full"
              >
                <option value="BML Transfer">BML Transfer</option>
                <option value="MIB Transfer">MIB Transfer</option>
                <option value="Cash">Cash</option>
                <option value="POS Card">POS Card</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="erp-btn-quiet text-xs py-1.5"
            >
              Cancel
            </button>
            <button type="submit" className="erp-btn-primary text-xs py-1.5">
              Confirm & Post Expense
            </button>
          </div>
        </form>
      )}

      {/* Toolbar & Filters */}
      <div className="erp-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="erp-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by payee, memo, receipt ref..."
            className="erp-input w-full pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="erp-muted">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="erp-input py-1 text-xs"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="erp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Payee & Memo</th>
                <th>Method / Reference</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center erp-muted py-8">
                    No expense records found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((exp) => (
                  <tr key={exp.id}>
                    <td className="font-mono text-xs">{exp.date}</td>
                    <td>
                      <span className="erp-pill erp-pill-neutral text-[11px]">{exp.category}</span>
                    </td>
                    <td>
                      <div className="font-bold text-xs">{exp.payee}</div>
                      <div className="text-[11px] erp-muted">{exp.description}</div>
                    </td>
                    <td className="text-xs">
                      <div>{exp.paymentMethod}</div>
                      {exp.receiptRef && (
                        <div className="erp-muted font-mono text-[10px]">Ref: {exp.receiptRef}</div>
                      )}
                    </td>
                    <td className="text-right font-mono font-bold erp-money-out">
                      {formatMVR(exp.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
