import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  DollarSign,
  CreditCard,
  Receipt,
  Truck,
  Wrench,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  Car,
  Package,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  ChevronRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { useERP } from '../../context/ERPContext';
import { MONTHLY_SALES_CHART_DATA, SERVICE_BREAKDOWN_DATA } from '../../data/mockData';

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const {
    totalSalesToday,
    totalCashReceived,
    totalOutstandingInvoices,
    totalAccountsPayable,
    activeJobsCount,
    lowStockItemsCount,
    alerts,
    dismissAlert,
    aiInsights,
    triggerAIInsightAction,
    jobs,
    invoices,
    payments,
    formatMVR,
    setIsCreateJobOpen,
    setIsCreateInvoiceOpen,
    setIsAICopilotOpen,
  } = useERP();

  const activeJobs = jobs.filter((j) => !['Completed', 'Paid'].includes(j.status));

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Welcome with Quick Actions */}
      <div className="erp-card p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="erp-h1 text-2xl sm:text-3xl">Operations Overview</h1>
            <span className="erp-pill erp-pill-positive text-xs">Live System</span>
          </div>
          <p className="erp-muted text-xs sm:text-sm max-w-2xl">
            Real-time operations dashboard. Monitor work orders, bay scheduling, cash settlements, invoice balances, and material inventory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsCreateJobOpen(true)}
            className="erp-btn-primary flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>New Work Order</span>
          </button>
          <button
            onClick={() => setIsCreateInvoiceOpen(true)}
            className="erp-btn-quiet flex items-center gap-1.5"
          >
            <Receipt size={16} />
            <span>New Invoice</span>
          </button>
          <button
            onClick={() => setIsAICopilotOpen(true)}
            className="erp-btn-quiet flex items-center gap-1.5"
          >
            <Sparkles size={16} style={{ color: 'var(--accent)' }} />
            <span>Starq AI</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (6 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Sales Today</span>
          <div className="erp-figure text-lg mt-1 font-bold">{formatMVR(totalSalesToday, false)}</div>
          <span className="text-[11px] erp-muted mt-0.5 block">
            {invoices.filter((inv) => inv.date === new Date().toISOString().split('T')[0]).length} invoices logged
          </span>
        </div>

        <div
          className="erp-card p-4 cursor-pointer hover:border-[var(--accent)] transition-all"
          onClick={() => navigate('/payments')}
        >
          <span className="erp-muted block text-xs font-semibold">Cash Received</span>
          <div className="erp-figure text-lg mt-1 font-bold erp-money-in">{formatMVR(totalCashReceived, false)}</div>
          <span className="text-[11px] erp-muted mt-0.5 block">Month-to-date collections</span>
        </div>

        <div
          className="erp-card p-4 cursor-pointer hover:border-[var(--accent)] transition-all"
          onClick={() => navigate('/invoices')}
        >
          <span className="erp-muted block text-xs font-semibold">Receivables Due</span>
          <div className="erp-figure text-lg mt-1 font-bold text-rose-400">{formatMVR(totalOutstandingInvoices, false)}</div>
          <span className="text-[11px] erp-muted mt-0.5 block">Outstanding invoices</span>
        </div>

        <div
          className="erp-card p-4 cursor-pointer hover:border-[var(--accent)] transition-all"
          onClick={() => navigate('/purchasing')}
        >
          <span className="erp-muted block text-xs font-semibold">Accounts Payable</span>
          <div className="erp-figure text-lg mt-1 font-bold erp-money-out">{formatMVR(totalAccountsPayable, false)}</div>
          <span className="text-[11px] erp-muted mt-0.5 block">Vendor dues (4 suppliers)</span>
        </div>

        <div
          className="erp-card p-4 cursor-pointer hover:border-[var(--accent)] transition-all"
          onClick={() => navigate('/jobs')}
        >
          <span className="erp-muted block text-xs font-semibold">Active Jobs</span>
          <div className="erp-figure text-lg mt-1 font-bold" style={{ color: 'var(--accent)' }}>{activeJobsCount} In Bay</div>
          <span className="text-[11px] erp-muted mt-0.5 block">Floor work orders</span>
        </div>

        <div
          className="erp-card p-4 cursor-pointer hover:border-[var(--accent)] transition-all"
          onClick={() => navigate('/inventory')}
        >
          <span className="erp-muted block text-xs font-semibold">Low Stock Items</span>
          <div className={`erp-figure text-lg mt-1 font-bold ${lowStockItemsCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {lowStockItemsCount} Items
          </div>
          <span className="text-[11px] erp-muted mt-0.5 block">Reorder required</span>
        </div>
      </div>

      {/* 2-Column Section: Needs Attention + Starq AI Assistant Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Needs Attention Panel (7 cols) */}
        <div className="lg:col-span-7 erp-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Needs Attention</h2>
            </div>
            <span className="erp-pill erp-pill-danger text-[11px]">
              {alerts.length} Action Required
            </span>
          </div>

          <div className="space-y-2.5">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${
                    alert.urgency === 'critical' ? 'text-rose-400' : 'text-amber-400'
                  }`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold">{alert.title}</p>
                      {alert.amount && (
                        <span className="font-mono text-xs font-bold text-rose-400">
                          {formatMVR(alert.amount)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] erp-muted mt-0.5 line-clamp-1">{alert.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => {
                      if (alert.targetTab === 'invoices' && alert.targetId) {
                        navigate(`/invoices/${alert.targetId}`);
                      } else if (alert.targetTab === 'jobs' && alert.targetId) {
                        navigate(`/jobs/${alert.targetId}`);
                      } else if (alert.targetTab === 'purchasing' && alert.targetId) {
                        navigate(`/purchasing/${alert.targetId}`);
                      } else {
                        navigate(`/${alert.targetTab}`);
                      }
                    }}
                    className="erp-btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
                  >
                    <span>{alert.actionLabel}</span>
                    <ArrowRight size={12} />
                  </button>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="text-[11px] erp-muted hover:underline px-1.5 py-1"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Starq AI Insights Widget (5 cols) */}
        <div className="lg:col-span-5 erp-card p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-bold uppercase tracking-wider">Starq AI Insights</h2>
              </div>
              <button
                onClick={() => setIsAICopilotOpen(true)}
                className="text-xs font-semibold hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Open Copilot →
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {aiInsights.slice(0, 2).map((insight) => (
                <div
                  key={insight.id}
                  className="p-3 rounded-xl border text-xs space-y-1.5"
                  style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                      {insight.category}
                    </span>
                    <span className="erp-pill erp-pill-neutral text-[10px]">{insight.impact}</span>
                  </div>
                  <p className="font-bold">{insight.title}</p>
                  <p className="text-[11px] erp-muted leading-relaxed">{insight.description}</p>
                  <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[10px] erp-muted truncate max-w-[180px]">
                      {insight.recommendedAction}
                    </span>
                    <button
                      onClick={() => triggerAIInsightAction(insight)}
                      className="erp-btn-primary text-[10px] py-1 px-2"
                    >
                      {insight.actionButtonLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl border text-xs flex items-center justify-between mt-2" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <Zap size={15} style={{ color: 'var(--accent)' }} />
              <span>Job IGN-0234 reached clearcoat bake pass.</span>
            </div>
            <Link
              to="/jobs/job-1"
              className="font-bold hover:underline shrink-0 ml-2"
              style={{ color: 'var(--accent)' }}
            >
              View Job
            </Link>
          </div>
        </div>
      </div>

      {/* Active Work Orders in Floor Module */}
      <div className="erp-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Active Work Orders & Bays</h2>
            <p className="text-xs erp-muted">Live floor progress for service and repair packages</p>
          </div>

          <Link
            to="/jobs"
            className="text-xs font-semibold hover:underline flex items-center gap-1"
            style={{ color: 'var(--accent)' }}
          >
            <span>View All Jobs (Kanban & List)</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* Jobs Table */}
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Job ID / Bay</th>
                <th>Customer & Asset</th>
                <th>Service & Package</th>
                <th>Assigned Staff</th>
                <th className="text-right">Quoted & Profit</th>
                <th className="text-center">Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {activeJobs.map((job) => (
                <tr
                  key={job.id}
                  data-clickable="true"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  <td>
                    <div className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{job.jobId}</div>
                    <div className="text-[11px] erp-muted">{job.bayNumber || 'Main Bay'}</div>
                  </td>
                  <td>
                    <div className="font-semibold">{job.customerName}</div>
                    <div className="text-[11px] erp-muted font-mono">{job.vehicle.plateNumber} ({job.vehicle.model})</div>
                  </td>
                  <td>
                    <div className="font-medium">{job.serviceType}</div>
                    <div className="text-[11px] erp-muted truncate max-w-xs">{job.requestedWork}</div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {job.assignedStaff.map((s) => (
                        <span key={s.id} className="erp-pill erp-pill-neutral text-[10px]">{s.name}</span>
                      ))}
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="font-mono font-bold">{formatMVR(job.quotedAmount)}</div>
                    <div className="text-[10px] font-mono erp-money-in">Est: {formatMVR(job.actualProfit)}</div>
                  </td>
                  <td className="text-center">
                    <span className="erp-pill erp-pill-info text-[11px]">{job.status}</span>
                  </td>
                  <td className="text-right">
                    <span className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                      Inspect →
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Charts & Settlements Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Performance Chart (8 cols) */}
        <div className="lg:col-span-8 erp-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Financial Performance (MVR)</h2>
              <p className="text-xs erp-muted">Revenue & Operating Surplus</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 erp-muted">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--chart-1)' }} /> Revenue
              </span>
              <span className="flex items-center gap-1.5 erp-muted">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--positive)' }} /> Surplus
              </span>
            </div>
          </div>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MONTHLY_SALES_CHART_DATA}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                    borderRadius: 'var(--radius-card)',
                    fontSize: '12px'
                  }}
                  formatter={(val: any) => [formatMVR(Number(val || 0)), '']}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="profit" stroke="var(--positive)" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Service Breakdown (4 cols) */}
        <div className="lg:col-span-4 erp-card p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              Service Mix Distribution
            </h2>
            <div className="mt-4 space-y-3 text-xs">
              {SERVICE_BREAKDOWN_DATA.map((srv, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{srv.name}</span>
                    <span className="font-mono font-bold">{srv.value}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${srv.value}%`, backgroundColor: srv.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border space-y-2 mt-4 text-xs" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <span className="erp-muted">BML Main Account:</span>
              <span className="font-mono font-semibold">7730000189201</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="erp-muted">Tax Status:</span>
              <span className="font-semibold text-emerald-400">Non-GST Registered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payments Received */}
      <div className="erp-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Recent Cash Settlements</h2>
            <p className="text-xs erp-muted">Verified Bank of Maldives and customer receipts</p>
          </div>
          <Link
            to="/payments"
            className="text-xs font-semibold hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            All Payments ({payments.length}) →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {payments.slice(0, 3).map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/payments/${p.id}`)}
              className="p-3.5 rounded-xl border text-xs space-y-2 cursor-pointer hover:border-[var(--accent)] transition-all"
              style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{p.paymentNumber}</span>
                <span className="erp-pill erp-pill-positive text-[10px]">{p.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{p.customerName}</span>
                <span className="font-mono font-extrabold erp-money-in text-sm">{formatMVR(p.amount)}</span>
              </div>
              <div className="text-[11px] erp-muted flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                <span>{p.method}</span>
                <span>{p.paymentDate}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
