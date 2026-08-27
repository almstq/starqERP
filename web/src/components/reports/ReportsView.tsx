import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  FileSpreadsheet,
  Download,
  Calendar,
  ShieldCheck,
  Wrench,
  Layers,
  ArrowUpRight,
  Printer,
  CheckCircle2,
  Scale,
  BookOpen,
  Building2,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { useERP } from '../../context/ERPContext';
import { Badge } from '../common/Badge';
import { Surface, Button } from '../ui';
import { MONTHLY_SALES_CHART_DATA, SERVICE_BREAKDOWN_DATA } from '../../data/mockData';
import { computeTrialBalance, computeProfitAndLoss, computeBalanceSheet } from '../../lib/bookkeeping';

export const ReportsView: React.FC = () => {
  const { formatMVR, invoices, payments, expenses, purchaseOrders, jobs, staff, currentTenant, currentBook } = useERP();

  const [dateRange, setDateRange] = useState('This Year (2026)');
  const [activeReportTab, setActiveReportTab] = useState<'statements' | 'analytics'>('statements');

  const isGstRegistered = currentTenant.gstStatus === 'registered';

  // Compute double-entry financial statements in real-time
  const trialBalance = useMemo(() => {
    return computeTrialBalance({
      invoices,
      payments,
      expenses,
      purchaseOrders,
      isGstRegistered,
    });
  }, [invoices, payments, expenses, purchaseOrders, isGstRegistered]);

  const profitAndLoss = useMemo(() => {
    return computeProfitAndLoss({
      invoices,
      expenses,
      purchaseOrders,
      isGstRegistered,
    });
  }, [invoices, expenses, purchaseOrders, isGstRegistered]);

  const balanceSheet = useMemo(() => {
    return computeBalanceSheet({
      invoices,
      payments,
      expenses,
      purchaseOrders,
      isGstRegistered,
    });
  }, [invoices, payments, expenses, purchaseOrders, isGstRegistered]);

  const technicianStats = staff.map((st) => {
    const assignedJobs = jobs.filter((j) => j.assignedStaff.some((s) => s.id === st.id));
    const completedCount = assignedJobs.filter((j) => j.status === 'Completed' || j.status === 'Invoiced').length;
    const totalJobValue = assignedJobs.reduce((sum, j) => sum + j.quotedAmount, 0);
    return {
      name: st.name,
      role: st.role,
      jobsCount: assignedJobs.length,
      completedCount,
      totalJobValue
    };
  });

  const companyLegalName = currentTenant.legalName || currentTenant.name || 'Starq Technologies Private Limited';
  const orgCode = currentBook?.code || (currentTenant.name ? currentTenant.name.slice(0, 3).toUpperCase() : 'STQ');
  const currencyCode = currentTenant.currency || 'MVR';

  return (
    <div className="space-y-6 pb-12 w-full min-w-0">
      
      {/* ─────────────────────────────────────────────────────────────────────
         FORMAL EXECUTIVE DOCUMENT MASTHEAD (Visible ONLY when printing / PDF export)
         ───────────────────────────────────────────────────────────────────── */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-slate-900">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xl font-black uppercase tracking-tight text-slate-900">
              {companyLegalName}
            </div>
            <div className="text-xs font-semibold text-slate-700 tracking-wide mt-0.5">
              FINANCIAL STATEMENTS & GENERAL LEDGER REPORT
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1 space-x-2">
              <span>ORG: {orgCode}</span>
              <span>•</span>
              <span>TIN: {currentTenant.tinNumber || 'NON-REGISTERED'}</span>
              <span>•</span>
              <span>CURRENCY: {currencyCode}</span>
              <span>•</span>
              <span>PERIOD: {dateRange}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block border border-slate-900 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded">
              {trialBalance.isBalanced ? '✔ ZERO_VARIANCE_PASS' : '⚠ VARIANCE_DETECTED'}
            </div>
            <div className="text-[9px] text-slate-500 font-mono mt-1">
              GENERATED: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
         INTERACTIVE SCREEN HEADER (Hidden in Print Mode)
         ───────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)]">
              Reports & Financial Statements
            </h1>
            <Badge variant="neutral" size="sm">
              {currentTenant.name}
            </Badge>
          </div>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
            Double-entry bookkeeping, balancing trial balance, P&L, and operational analytics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Segmented Tab Switcher */}
          <div className="flex p-1 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)]">
            <button
              onClick={() => setActiveReportTab('statements')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeReportTab === 'statements'
                  ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-primary)] shadow-xs border border-[var(--md-sys-color-primary)]'
                  : 'text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Financial Statements</span>
            </button>
            <button
              onClick={() => setActiveReportTab('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeReportTab === 'analytics'
                  ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-primary)] shadow-xs border border-[var(--md-sys-color-primary)]'
                  : 'text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Operational Analytics</span>
            </button>
          </div>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-medium border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)] focus:outline-none focus:border-[var(--md-sys-color-primary)] shadow-xs cursor-pointer"
          >
            <option value="This Month">Current Month (August 2026)</option>
            <option value="Last Quarter">Q1 2026</option>
            <option value="This Year (2026)">Full Year 2026</option>
          </select>

          <Button
            variant="tonal"
            size="sm"
            onClick={() => window.print()}
            icon={<Printer size={14} />}
          >
            <span>Export PDF</span>
          </Button>
        </div>
      </div>

      {activeReportTab === 'statements' ? (
        <div className="space-y-6">
          {/* Trial Balance Health Banner (Screen Only) */}
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden ${
            trialBalance.isBalanced
              ? 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.3)] text-[#4ade80]'
              : 'bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.3)] text-[#fbbf24]'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${trialBalance.isBalanced ? 'bg-[rgba(34,197,94,0.2)] text-[#34d399]' : 'bg-[rgba(245,158,11,0.2)] text-[#f59e0b]'}`}>
                {trialBalance.isBalanced ? <CheckCircle2 className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
                  {trialBalance.isBalanced ? 'Trial Balance Verified & In Balance' : 'Trial Balance Variance Detected'}
                </h3>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  Total Debits ({formatMVR(trialBalance.totalDebits)}) = Total Credits ({formatMVR(trialBalance.totalCredits)}) • Variance: {formatMVR(trialBalance.difference)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={trialBalance.isBalanced ? 'positive' : 'warning'} size="sm">
                {trialBalance.isBalanced ? '0.00 Variance (DEC-043)' : 'Out of Balance'}
              </Badge>
              <Badge variant={isGstRegistered ? 'info' : 'neutral'} size="sm">
                {isGstRegistered ? `GST Registered (${currentTenant.gstRate}%)` : 'Non-Registered (0% GST)'}
              </Badge>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────────
             1. GENERAL LEDGER TRIAL BALANCE (Print Avoid Break)
             ───────────────────────────────────────────────────────────────── */}
          <div className="statement-section">
            <Surface variant="filled" level={1} padding="md" className="space-y-4 print:p-0 print:border-none print:bg-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] uppercase tracking-wider print:text-black print:text-xs">
                    General Ledger Trial Balance
                  </h2>
                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] print:text-gray-600 print:text-[10px]">
                    Double-entry account balances as of {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[var(--md-sys-color-primary)] print:text-black print:text-[10px]">
                  ISO Currency: {currencyCode}
                </span>
              </div>

              <div className="erp-scroll-region overflow-x-auto rounded-xl border border-[var(--md-sys-color-outline-variant)] print:border-none">
                <table className="w-full text-left text-xs min-w-[680px] print:min-w-0 print-doc-table">
                  <thead className="bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] uppercase text-[10px] font-bold tracking-wider border-b border-[var(--md-sys-color-outline-variant)] whitespace-nowrap">
                    <tr>
                      <th className="py-2.5 px-4 w-24">Code</th>
                      <th className="py-2.5 px-4">Account Title</th>
                      <th className="py-2.5 px-4 w-28">Type</th>
                      <th className="py-2.5 px-4 text-right w-36">Debit ({currencyCode})</th>
                      <th className="py-2.5 px-4 text-right w-36">Credit ({currencyCode})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
                    {trialBalance.accounts.map((acc) => (
                      <tr key={acc.code} className="hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors">
                        <td className="py-2 px-4 font-mono font-bold text-[var(--md-sys-color-primary)] print:text-black">{acc.code}</td>
                        <td className="py-2 px-4 font-semibold text-[var(--md-sys-color-on-surface)] print:text-black">{acc.name}</td>
                        <td className="py-2 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase print:border print:border-gray-400 print:text-black ${
                            acc.type === 'asset' ? 'bg-blue-500/15 text-sky-400 border border-blue-500/30' :
                            acc.type === 'liability' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                            acc.type === 'revenue' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                            'bg-slate-500/15 text-slate-300 border border-slate-500/30'
                          }`}>
                            {acc.type}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-[var(--md-sys-color-on-surface)] print:text-black">
                          {acc.debit > 0 ? formatMVR(acc.debit) : '—'}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-medium text-[var(--md-sys-color-on-surface)] print:text-black">
                          {acc.credit > 0 ? formatMVR(acc.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[var(--md-sys-color-surface-container-high)] font-bold border-t-2 border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)]">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-4 text-right uppercase tracking-wider text-[11px] print:text-black">
                        Totals (Debits & Credits)
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-extrabold text-[var(--md-sys-color-primary)] text-sm print:text-black">
                        {formatMVR(trialBalance.totalDebits)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-extrabold text-[var(--md-sys-color-primary)] text-sm print:text-black">
                        {formatMVR(trialBalance.totalCredits)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Surface>
          </div>

          {/* ─────────────────────────────────────────────────────────────────
             2. PROFIT & LOSS & BALANCE SHEET (Clean 2-Column with Break Avoidance)
             ───────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start print:grid-cols-2 print:gap-4">
            
            {/* Profit & Loss Statement */}
            <div className="statement-section print-avoid-break">
              <Surface variant="filled" level={1} padding="md" className="space-y-4 print:p-0 print:border-none print:bg-transparent">
                <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-3 print:border-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 print:hidden">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] print:text-black print:text-xs uppercase tracking-wider">
                        Statement of Profit & Loss (P&L)
                      </h2>
                      <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] print:text-gray-600 print:text-[10px]">
                        Period: {dateRange}
                      </p>
                    </div>
                  </div>
                  <Badge variant={profitAndLoss.netOperatingIncome >= 0 ? 'positive' : 'destructive'} size="sm">
                    Margin: {profitAndLoss.operatingMarginPct}%
                  </Badge>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[var(--md-sys-color-outline-variant)] print:border-gray-200">
                    <span className="font-semibold text-[var(--md-sys-color-on-surface)] print:text-black">Gross Operating Revenue</span>
                    <span className="font-mono font-bold text-[var(--md-sys-color-on-surface)] print:text-black">{formatMVR(profitAndLoss.grossRevenue)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] print:text-gray-700 print:border-gray-200">
                    <span>Less: Cost of Goods Sold (Parts & Direct Costs)</span>
                    <span className="font-mono font-medium text-rose-400 print:text-red-700">({formatMVR(profitAndLoss.costOfSales)})</span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-[var(--md-sys-color-surface-container-high)] px-2 rounded-lg font-bold text-[var(--md-sys-color-on-surface)] print:bg-gray-100 print:text-black">
                    <span>Gross Operating Profit</span>
                    <span className="font-mono text-emerald-400 print:text-emerald-800">{formatMVR(profitAndLoss.grossProfit)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] print:text-gray-700 print:border-gray-200">
                    <span>Less: Operating & Administrative Expenses</span>
                    <span className="font-mono font-medium text-rose-400 print:text-red-700">({formatMVR(profitAndLoss.operatingExpenses)})</span>
                  </div>
                  <div className="flex justify-between py-2 bg-emerald-500/15 border border-emerald-500/30 px-3 rounded-xl font-extrabold text-sm text-emerald-300 print:bg-gray-100 print:border-t-2 print:border-b-4 print:border-double print:border-black print:text-black">
                    <span>Net Operating Income</span>
                    <span className="font-mono">{formatMVR(profitAndLoss.netOperatingIncome)}</span>
                  </div>
                </div>
              </Surface>
            </div>

            {/* Balance Sheet Summary */}
            <div className="statement-section print-avoid-break">
              <Surface variant="filled" level={1} padding="md" className="space-y-4 print:p-0 print:border-none print:bg-transparent">
                <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-3 print:border-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/15 text-sky-400 border border-blue-500/30 print:hidden">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] print:text-black print:text-xs uppercase tracking-wider">
                        Balance Sheet Summary
                      </h2>
                      <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] print:text-gray-600 print:text-[10px]">
                        Assets = Liabilities + Equity
                      </p>
                    </div>
                  </div>
                  <Badge variant={balanceSheet.isBalanced ? 'positive' : 'destructive'} size="sm">
                    {balanceSheet.isBalanced ? 'Balanced' : 'Unbalanced'}
                  </Badge>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold uppercase text-[10px] tracking-wider text-[var(--md-sys-color-primary)] print:text-black">
                      Current Assets
                    </span>
                    <div className="flex justify-between py-0.5 text-[var(--md-sys-color-on-surface-variant)] pl-2 print:text-gray-700">
                      <span>Cash & Bank Balances</span>
                      <span className="font-mono font-medium text-[var(--md-sys-color-on-surface)] print:text-black">{formatMVR(balanceSheet.currentAssets.cashAndBank)}</span>
                    </div>
                    <div className="flex justify-between py-0.5 text-[var(--md-sys-color-on-surface-variant)] pl-2 print:text-gray-700">
                      <span>Accounts Receivable (Trade Debtors)</span>
                      <span className="font-mono font-medium text-[var(--md-sys-color-on-surface)] print:text-black">{formatMVR(balanceSheet.currentAssets.accountsReceivable)}</span>
                    </div>
                    <div className="flex justify-between py-1 bg-[var(--md-sys-color-surface-container-high)] px-2 rounded font-bold text-[var(--md-sys-color-on-surface)] print:bg-gray-100 print:text-black">
                      <span>Total Assets</span>
                      <span className="font-mono text-sky-400 print:text-black">{formatMVR(balanceSheet.totalAssets)}</span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-[var(--md-sys-color-outline-variant)] print:border-gray-200">
                    <span className="font-bold uppercase text-[10px] tracking-wider text-amber-400 print:text-black">
                      Current Liabilities & Equity
                    </span>
                    <div className="flex justify-between py-0.5 text-[var(--md-sys-color-on-surface-variant)] pl-2 print:text-gray-700">
                      <span>Accounts Payable (Trade Creditors)</span>
                      <span className="font-mono font-medium text-[var(--md-sys-color-on-surface)] print:text-black">{formatMVR(balanceSheet.currentLiabilities.accountsPayable)}</span>
                    </div>
                    <div className="flex justify-between py-0.5 text-[var(--md-sys-color-on-surface-variant)] pl-2 print:text-gray-700">
                      <span>GST Output Tax Payable</span>
                      <span className="font-mono font-medium text-[var(--md-sys-color-on-surface)] print:text-black">{formatMVR(balanceSheet.currentLiabilities.gstPayable)}</span>
                    </div>
                    <div className="flex justify-between py-0.5 text-[var(--md-sys-color-on-surface-variant)] pl-2 print:text-gray-700">
                      <span>Current Period Net Earnings</span>
                      <span className="font-mono font-medium text-[var(--md-sys-color-on-surface)] print:text-black">{formatMVR(balanceSheet.equity.currentPeriodIncome)}</span>
                    </div>
                    <div className="flex justify-between py-1 bg-amber-500/15 border border-amber-500/30 px-2 rounded font-bold text-amber-300 print:bg-gray-100 print:border-t-2 print:border-b-4 print:border-double print:border-black print:text-black">
                      <span>Total Liabilities & Equity</span>
                      <span className="font-mono">{formatMVR(balanceSheet.totalLiabilitiesAndEquity)}</span>
                    </div>
                  </div>
                </div>
              </Surface>
            </div>
          </div>

          {/* Document Footer (Print Mode Only) */}
          <div className="hidden print:block pt-6 mt-6 border-t border-slate-300 text-[9px] text-slate-500 font-mono text-center">
            Authoritative electronic double-entry financial statement produced by starqERP™ • Strictly Confidential • ISO Standard Double-Entry Ledger
          </div>
        </div>
      ) : (
        /* Operational Analytics Tab */
        <div className="space-y-6">
          {/* GST Return Snapshot */}
          <Surface variant="filled" level={1} padding="md" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--md-sys-color-outline-variant)] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
                    Maldives Inland Revenue Authority (MIRA) GST Return Snapshot
                  </h2>
                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    GST Registration TIN: {currentTenant.tinNumber || 'TIN-NOT-SET'} • {currentTenant.gstRate}% statutory rate
                  </p>
                </div>
              </div>
              <Badge variant={isGstRegistered ? 'positive' : 'neutral'} size="sm">
                {isGstRegistered ? 'GST Registered' : 'Non-Registered'}
              </Badge>
            </div>
            <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
              Statutory return figures produced by the double-entry accounting engine and reconciled against MIRA schedule standards.
            </p>
          </Surface>

          {/* Revenue vs Expenses Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Surface variant="filled" level={1} padding="md" className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] uppercase tracking-wider">
                    Monthly Financial Overview
                  </h2>
                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Revenue, Operating Costs & Net Margin</p>
                </div>
              </div>

              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MONTHLY_SALES_CHART_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--md-sys-color-surface-container-high)',
                        borderColor: 'var(--md-sys-color-outline-variant)',
                        color: 'var(--md-sys-color-on-surface)',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                      }}
                      formatter={(val: number | string | undefined) => [
                        formatMVR(typeof val === 'number' ? val : Number(val || 0)),
                        ''
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Total Revenue (MVR)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Operating Expenses (MVR)" fill="#f87171" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Net Margin (MVR)" fill="#34d399" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Surface>

            <Surface variant="filled" level={1} padding="md" className="lg:col-span-4 space-y-4 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] uppercase tracking-wider">
                  Service Revenue Share
                </h2>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Contribution to overall enterprise profit</p>

                <div className="mt-4 space-y-2.5">
                  {SERVICE_BREAKDOWN_DATA.map((srv, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: srv.color }} />
                        <span className="font-semibold text-[var(--md-sys-color-on-surface)]">{srv.name}</span>
                      </div>
                      <span className="font-bold mono-num text-[var(--md-sys-color-primary)]">{srv.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--md-sys-color-primary-container)] border border-[var(--md-sys-color-primary)] text-xs text-[var(--md-sys-color-on-surface)]">
                <span className="font-bold text-[var(--md-sys-color-primary)]">Insight: </span>
                <span>High-margin specialized services generate 58% gross margin, exceeding standard retail throughput.</span>
              </div>
            </Surface>
          </div>

          {/* Specialist Performance Table */}
          <Surface variant="filled" level={1} padding="md" className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] uppercase tracking-wider">
                Staff & Specialist Performance
              </h2>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Throughput, job completion rate, and gross work order output</p>
            </div>

            <div className="erp-scroll-region overflow-x-auto rounded-xl border border-[var(--md-sys-color-outline-variant)]">
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead className="bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] uppercase text-[10px] font-bold tracking-wider border-b border-[var(--md-sys-color-outline-variant)] whitespace-nowrap">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Specialization</th>
                    <th className="py-3 px-4 text-center">Active Jobs</th>
                    <th className="py-3 px-4 text-center">Completed Work</th>
                    <th className="py-3 px-4 text-right">Job Output Value (MVR)</th>
                    <th className="py-3 px-4 text-center">Quality Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
                  {technicianStats.map((tech, i) => (
                    <tr key={i} className="hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors">
                      <td className="py-3 px-4 font-bold text-[var(--md-sys-color-on-surface)]">{tech.name}</td>
                      <td className="py-3 px-4 text-[var(--md-sys-color-on-surface-variant)]">{tech.role}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-[var(--md-sys-color-primary)]">
                        {tech.jobsCount}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-400">
                        {tech.completedCount}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-[var(--md-sys-color-on-surface)] mono-num">
                        {formatMVR(tech.totalJobValue)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="neutral" size="sm">
                          Active
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        </div>
      )}
    </div>
  );
};
