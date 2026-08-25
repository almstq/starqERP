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
  BookOpen
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';
import { useERP } from '../../context/ERPContext';
import { Badge } from '../common/Badge';
import { MONTHLY_SALES_CHART_DATA, SERVICE_BREAKDOWN_DATA } from '../../data/mockData';
import { computeTrialBalance, computeProfitAndLoss, computeBalanceSheet } from '../../lib/bookkeeping';

export const ReportsView: React.FC = () => {
  const { formatMVR, invoices, payments, expenses, purchaseOrders, jobs, staff, currentTenant } = useERP();

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

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Reports & Financial Statements
            </h1>
            <Badge variant="purple" size="sm">
              {currentTenant.name}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Double-entry bookkeeping, balancing trial balance, P&L, and operational analytics
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveReportTab('statements')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeReportTab === 'statements'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Financial Statements</span>
            </button>
            <button
              onClick={() => setActiveReportTab('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeReportTab === 'analytics'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Operational Analytics</span>
            </button>
          </div>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-xs"
          >
            <option value="This Month">Current Month (August 2026)</option>
            <option value="Last Quarter">Q1 2026</option>
            <option value="This Year (2026)">Full Year 2026</option>
          </select>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {activeReportTab === 'statements' ? (
        <div className="space-y-6">
          {/* Trial Balance Health Banner */}
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            trialBalance.isBalanced
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${trialBalance.isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {trialBalance.isBalanced ? <CheckCircle2 className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold">
                  {trialBalance.isBalanced ? 'Trial Balance Verified & In Balance' : 'Trial Balance Variance Detected'}
                </h3>
                <p className="text-xs text-slate-600">
                  Total Debits ({formatMVR(trialBalance.totalDebits)}) = Total Credits ({formatMVR(trialBalance.totalCredits)}) • Variance: {formatMVR(trialBalance.difference)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={trialBalance.isBalanced ? 'success' : 'warning'} size="sm">
                {trialBalance.isBalanced ? '0.00 Variance (DEC-043)' : 'Out of Balance'}
              </Badge>
              <Badge variant={isGstRegistered ? 'blue' : 'neutral'} size="sm">
                {isGstRegistered ? `GST Registered (${currentTenant.gstRate}%)` : 'Non-Registered (0% GST)'}
              </Badge>
            </div>
          </div>

          {/* Trial Balance Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  General Ledger Trial Balance
                </h2>
                <p className="text-xs text-slate-500">Double-entry account balances as of 25 August 2026</p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">ISO Currency: {currentTenant.currency}</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-24">Code</th>
                    <th className="py-3 px-4">Account Title</th>
                    <th className="py-3 px-4 w-28">Type</th>
                    <th className="py-3 px-4 text-right w-36">Debit (MVR)</th>
                    <th className="py-3 px-4 text-right w-36">Credit (MVR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {trialBalance.accounts.map((acc) => (
                    <tr key={acc.code} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-600">{acc.code}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{acc.name}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          acc.type === 'asset' ? 'bg-blue-50 text-blue-700' :
                          acc.type === 'liability' ? 'bg-amber-50 text-amber-700' :
                          acc.type === 'revenue' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {acc.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900">
                        {acc.debit > 0 ? formatMVR(acc.debit) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900">
                        {acc.credit > 0 ? formatMVR(acc.credit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300 text-slate-900">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider text-[11px]">
                      Totals (Debits & Credits)
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-blue-700 text-sm">
                      {formatMVR(trialBalance.totalDebits)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-blue-700 text-sm">
                      {formatMVR(trialBalance.totalCredits)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Profit & Loss & Balance Sheet Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profit & Loss Statement */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Statement of Profit & Loss (P&L)</h2>
                    <p className="text-xs text-slate-500">Period: Year-to-Date 2026</p>
                  </div>
                </div>
                <Badge variant={profitAndLoss.netOperatingIncome >= 0 ? 'success' : 'danger'} size="sm">
                  Margin: {profitAndLoss.operatingMarginPct}%
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="font-semibold text-slate-700">Gross Operating Revenue</span>
                  <span className="font-mono font-bold text-slate-900">{formatMVR(profitAndLoss.grossRevenue)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-600">
                  <span>Less: Cost of Goods Sold (Parts & Direct Costs)</span>
                  <span className="font-mono font-medium text-rose-600">({formatMVR(profitAndLoss.costOfSales)})</span>
                </div>
                <div className="flex justify-between py-1.5 bg-slate-50 px-2 rounded-lg font-bold text-slate-900">
                  <span>Gross Operating Profit</span>
                  <span className="font-mono text-emerald-600">{formatMVR(profitAndLoss.grossProfit)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-600">
                  <span>Less: Operating & Administrative Expenses</span>
                  <span className="font-mono font-medium text-rose-600">({formatMVR(profitAndLoss.operatingExpenses)})</span>
                </div>
                <div className="flex justify-between py-2 bg-emerald-50/70 border border-emerald-200 px-3 rounded-xl font-extrabold text-sm text-emerald-900">
                  <span>Net Operating Income</span>
                  <span className="font-mono">{formatMVR(profitAndLoss.netOperatingIncome)}</span>
                </div>
              </div>
            </div>

            {/* Balance Sheet Summary */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Balance Sheet Summary</h2>
                    <p className="text-xs text-slate-500">Assets = Liabilities + Equity</p>
                  </div>
                </div>
                <Badge variant={balanceSheet.isBalanced ? 'success' : 'danger'} size="sm">
                  {balanceSheet.isBalanced ? 'Balanced' : 'Unbalanced'}
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-blue-700">Current Assets</span>
                  <div className="flex justify-between py-1 text-slate-600 pl-2">
                    <span>Cash & Bank Balances</span>
                    <span className="font-mono font-medium text-slate-900">{formatMVR(balanceSheet.currentAssets.cashAndBank)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600 pl-2">
                    <span>Accounts Receivable (Trade Debtors)</span>
                    <span className="font-mono font-medium text-slate-900">{formatMVR(balanceSheet.currentAssets.accountsReceivable)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-blue-50/50 px-2 rounded font-bold text-blue-900">
                    <span>Total Assets</span>
                    <span className="font-mono">{formatMVR(balanceSheet.totalAssets)}</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-amber-700">Current Liabilities & Equity</span>
                  <div className="flex justify-between py-1 text-slate-600 pl-2">
                    <span>Accounts Payable (Trade Creditors)</span>
                    <span className="font-mono font-medium text-slate-900">{formatMVR(balanceSheet.currentLiabilities.accountsPayable)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600 pl-2">
                    <span>GST Output Tax Payable</span>
                    <span className="font-mono font-medium text-slate-900">{formatMVR(balanceSheet.currentLiabilities.gstPayable)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-600 pl-2">
                    <span>Current Period Net Earnings</span>
                    <span className="font-mono font-medium text-slate-900">{formatMVR(balanceSheet.equity.currentPeriodIncome)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-amber-50/50 px-2 rounded font-bold text-amber-900">
                    <span>Total Liabilities & Equity</span>
                    <span className="font-mono">{formatMVR(balanceSheet.totalLiabilitiesAndEquity)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Operational Analytics Tab */
        <div className="space-y-6">
          {/* GST return snapshot */}
          {isGstRegistered ? (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Maldives Inland Revenue Authority (MIRA) GST Return Snapshot
                    </h2>
                    <p className="text-xs text-slate-500">
                      GST Registration TIN: {currentTenant.tinNumber} • {currentTenant.gstRate}% rate
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Return figures are produced by the accounting engine and are reconciled against the statutory tax schedule.
              </p>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-500 border border-slate-200">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">GST Return</h2>
                    <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                      {currentTenant.name} is not registered for GST, so no return, rate or TIN is
                      shown. Register with MIRA and record the TIN in Settings to enable this report.
                    </p>
                  </div>
                </div>
                <Badge variant="neutral" size="sm">
                  Not GST-registered
                </Badge>
              </div>
            </div>
          )}

          {/* 2 Big Charts: Revenue vs Expenses Bar Chart + Profit Margins */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Monthly Financial Overview
                  </h2>
                  <p className="text-xs text-slate-500">Revenue, Operating Costs & Net Income</p>
                </div>
              </div>

              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MONTHLY_SALES_CHART_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.8} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        color: '#0f172a',
                        borderRadius: '0.75rem',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '12px'
                      }}
                      formatter={(val: number | string | undefined) => [
                        formatMVR(typeof val === 'number' ? val : Number(val || 0)),
                        ''
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Total Revenue (MVR)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Operating Expenses (MVR)" fill="#f87171" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Net Margin (MVR)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Service Revenue Share
                </h2>
                <p className="text-xs text-slate-500">Contribution to overall garage profit</p>

                <div className="mt-4 space-y-3">
                  {SERVICE_BREAKDOWN_DATA.map((srv, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: srv.color }} />
                        <span className="font-semibold text-slate-800">{srv.name}</span>
                      </div>
                      <span className="font-bold mono-num text-blue-600">{srv.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-slate-700">
                <span className="font-bold text-blue-700">Insight: </span>
                <span>Vinyl Wraps & Ceramic coatings carry a 58% gross margin, higher than full body repairs (42%).</span>
              </div>
            </div>
          </div>

          {/* Technician & Bay Performance Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Technician & Specialist Performance
                </h2>
                <p className="text-xs text-slate-500">Throughput, job completion rate, and gross work order output</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Technician</th>
                    <th className="py-3 px-4">Specialization</th>
                    <th className="py-3 px-4 text-center">Active Jobs Assigned</th>
                    <th className="py-3 px-4 text-center">Completed Work</th>
                    <th className="py-3 px-4 text-right">Job Output Value (MVR)</th>
                    <th className="py-3 px-4 text-center">Quality Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {technicianStats.map((tech, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{tech.name}</td>
                      <td className="py-3 px-4 text-slate-500">{tech.role}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-blue-600">
                        {tech.jobsCount}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-600">
                        {tech.completedCount}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-slate-900 mono-num">
                        {formatMVR(tech.totalJobValue)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="neutral" size="sm">
                          Not tracked
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
