import React, { useState } from 'react';
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
  Printer
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

export const ReportsView: React.FC = () => {
  const { formatMVR, invoices, jobs, staff, currentTenant } = useERP();

  const [dateRange, setDateRange] = useState('This Year (2026)');

  const totalInvoicedSum = invoices.reduce((s, i) => s + i.totalAmount, 0);

  // A GST return is only shown for a tenant that is actually registered.
  //
  // REMOVED 24 August 2026. This block previously computed and displayed:
  //   estimatedInputTax   = totalGstCollected * 0.38
  //   netGstPayableToMIRA = totalGstCollected - estimatedInputTax
  // alongside a hardcoded TIN, an 8% rate and a "Ready for June 28 Return"
  // badge. The 0.38 was an invented coefficient with no source in law, in the
  // books, or anywhere else; a net payable derived from it is a fabricated
  // statutory figure. Starq is not GST-registered, so every one of those
  // numbers was a false claim rendered with the confidence of a real one.
  //
  // Two rules apply and both are absolute (DEC-073 §10, DEC-051, DEC-079):
  //   1. No GST line, rate, TIN or filing badge while gstStatus is
  //      'not_registered'.
  //   2. No statutory figure is ever COMPUTED in the client. When this panel
  //      is re-enabled it renders figures produced by the Python engine, or
  //      figures that reconcile to it — the client displays, it does not derive.
  const isGstRegistered = currentTenant.gstStatus === 'registered';

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ec4899'];

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
              Reports & Financial Intelligence
            </h1>
            <Badge variant="purple" size="sm">
              SME Analytics
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Profit margin breakdown, service profitability, and garage throughput
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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

      {/* GST return snapshot — rendered only for a GST-registered tenant. */}
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

          {/* Figures come from the accounting engine, not from this component.
              Wired in blueprint Phase 3 against the reconciliation harness
              (DEC-079). Until then a registered tenant sees the panel frame and
              no numbers, which is the honest state — not zeroes, which would
              read as a filed nil return. */}
          <p className="text-xs text-slate-500">
            Return figures are produced by the accounting engine and are not yet wired to this
            view. No figure is computed here.
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
        {/* Monthly Breakdown Chart */}
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

        {/* Service Type Share Pie */}
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
                    {/* First-pass quality is not tracked yet, so it is not claimed.
                        This cell previously rendered a hardcoded "98.4% First Pass"
                        success badge for EVERY technician — the same figure for a
                        lead painter with three jobs and for a manager with none. It
                        was a fabricated performance claim about named real people.
                        The real number comes from QC events (the `qc_signer` seat in
                        api_garage_command): first-pass rate = QC passes on first
                        submission / total QC submissions, per technician, per period.
                        Wired in blueprint Phase 3 with the rest of the client. */}
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
  );
};
