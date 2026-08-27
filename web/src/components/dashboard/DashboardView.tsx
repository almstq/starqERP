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
import {
  Button,
  Surface,
  Badge,
  DataTable,
  ColumnDef,
  ActionGroup,
  ResponsiveGrid,
} from '../ui';

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

  const recentJobColumns: ColumnDef<any>[] = [
    {
      key: 'jobId',
      header: 'Job ID / Bay',
      width: '16%',
      render: (job) => (
        <div className="min-w-0">
          <div className="mono-num text-xs font-semibold" style={{ color: 'var(--md-sys-color-primary)' }} title={job.jobId}>
            {job.jobId}
          </div>
          <div className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] truncate mt-0.5">
            {job.bayNumber || 'Main Bay'}
          </div>
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer & Asset',
      width: '26%',
      render: (job) => (
        <div className="min-w-0">
          <div className="font-semibold text-xs text-[var(--md-sys-color-on-surface)] truncate">{job.customerName}</div>
          <div className="text-[11px] mono-num truncate text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
            {job.vehicle?.plateNumber} ({job.vehicle?.model})
          </div>
        </div>
      ),
    },
    {
      key: 'serviceType',
      header: 'Service',
      width: '16%',
      hideOn: 'compact',
      render: (job) => (
        <span className="text-xs text-[var(--md-sys-color-on-surface-variant)] truncate">
          {job.serviceType}
        </span>
      ),
    },
    {
      key: 'assignedStaff',
      header: 'Staff',
      width: '16%',
      hideOn: 'medium',
      render: (job) => (
        <div className="flex flex-wrap gap-1 min-w-0">
          {job.assignedStaff.map((s: any) => (
            <Badge key={s.id} variant="neutral" size="sm">
              {s.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'quotedAmount',
      header: 'Quoted',
      align: 'right',
      isNumeric: true,
      width: '14%',
      render: (job) => (
        <div className="text-right">
          <div className="font-semibold text-xs tabular-nums text-[var(--md-sys-color-on-surface)]">
            {formatMVR(job.quotedAmount)}
          </div>
          <div className="text-[10px] tabular-nums" style={{ color: 'var(--positive)' }}>
            Est: {formatMVR(job.actualProfit)}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '12%',
      render: (job) => (
        <Badge variant="neutral" size="sm">
          {job.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      width: '8%',
      render: () => (
        <span className="text-xs font-semibold hover:underline" style={{ color: 'var(--md-sys-color-primary)' }}>
          Inspect →
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 w-full min-w-0">
      {/* Top Banner / Welcome with Quick Actions */}
      <Surface variant="filled" level={1} padding="md" className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] truncate">
              Operations Overview
            </h1>
            <Badge variant="positive" size="sm">
              Live System
            </Badge>
          </div>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] max-w-2xl">
            Real-time operations dashboard. Monitor work orders, bay scheduling, cash settlements, invoice balances, and material inventory.
          </p>
        </div>

        <ActionGroup align="right" className="shrink-0">
          <Button
            variant="filled"
            size="sm"
            onClick={() => setIsCreateJobOpen(true)}
            icon={<Plus size={15} />}
          >
            <span>New Work Order</span>
          </Button>
          <Button
            variant="tonal"
            size="sm"
            onClick={() => setIsCreateInvoiceOpen(true)}
            icon={<Receipt size={15} />}
          >
            <span>New Invoice</span>
          </Button>
          <Button
            variant="outlined"
            size="sm"
            onClick={() => setIsAICopilotOpen(true)}
            icon={<Sparkles size={15} style={{ color: 'var(--md-sys-color-primary)' }} />}
          >
            <span>starqAI</span>
          </Button>
        </ActionGroup>
      </Surface>

      {/* Primary KPI Grid (Fluid auto-fit, container-safe, never forced 2 cols) */}
      <ResponsiveGrid columns="auto" minItemWidth="160px" gap="sm">
        <Surface variant="filled" level={2} padding="sm" container className="space-y-1 min-w-0">
          <span className="block text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)] truncate">
            Sales Today
          </span>
          <div className="text-base sm:text-lg font-bold mono-num text-[var(--md-sys-color-on-surface)] truncate">
            {formatMVR(totalSalesToday, false)}
          </div>
          <span className="text-[10px] sm:text-[11px] text-[var(--md-sys-color-on-surface-variant)] block truncate">
            {invoices.filter((inv) => inv.date === new Date().toISOString().split('T')[0]).length} invoices logged
          </span>
        </Surface>

        <Surface
          variant="filled"
          level={2}
          padding="sm"
          container
          onClick={() => navigate('/payments')}
          className="space-y-1 min-w-0 cursor-pointer hover:border-[var(--md-sys-color-primary)] transition-all"
        >
          <span className="block text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)] truncate">
            Cash Received
          </span>
          <div className="text-base sm:text-lg font-bold mono-num truncate" style={{ color: 'var(--positive)' }}>
            {formatMVR(totalCashReceived, false)}
          </div>
          <span className="text-[10px] sm:text-[11px] text-[var(--md-sys-color-on-surface-variant)] block truncate">
            Month-to-date collections
          </span>
        </Surface>

        <Surface
          variant="filled"
          level={2}
          padding="sm"
          container
          onClick={() => navigate('/invoices')}
          className="space-y-1 min-w-0 cursor-pointer hover:border-[var(--md-sys-color-primary)] transition-all"
        >
          <span className="block text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)] truncate">
            Receivables Due
          </span>
          <div className="text-base sm:text-lg font-bold mono-num truncate" style={{ color: 'var(--md-sys-color-error)' }}>
            {formatMVR(totalOutstandingInvoices, false)}
          </div>
          <span className="text-[10px] sm:text-[11px] text-[var(--md-sys-color-on-surface-variant)] block truncate">
            Outstanding invoices
          </span>
        </Surface>

        <Surface
          variant="filled"
          level={2}
          padding="sm"
          container
          onClick={() => navigate('/purchasing')}
          className="space-y-1 min-w-0 cursor-pointer hover:border-[var(--md-sys-color-primary)] transition-all"
        >
          <span className="block text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)] truncate">
            Accounts Payable
          </span>
          <div className="text-base sm:text-lg font-bold mono-num truncate" style={{ color: 'var(--warning)' }}>
            {formatMVR(totalAccountsPayable, false)}
          </div>
          <span className="text-[10px] sm:text-[11px] text-[var(--md-sys-color-on-surface-variant)] block truncate">
            Vendor dues (4 suppliers)
          </span>
        </Surface>

        <Surface
          variant="filled"
          level={2}
          padding="sm"
          container
          onClick={() => navigate('/jobs')}
          className="space-y-1 min-w-0 cursor-pointer hover:border-[var(--md-sys-color-primary)] transition-all"
        >
          <span className="block text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)] truncate">
            Active Jobs
          </span>
          <div className="text-base sm:text-lg font-bold mono-num truncate" style={{ color: 'var(--md-sys-color-primary)' }}>
            {activeJobsCount} In Bay
          </div>
          <span className="text-[10px] sm:text-[11px] text-[var(--md-sys-color-on-surface-variant)] block truncate">
            Floor work orders
          </span>
        </Surface>

        <Surface
          variant="filled"
          level={2}
          padding="sm"
          container
          onClick={() => navigate('/inventory')}
          className="space-y-1 min-w-0 cursor-pointer hover:border-[var(--md-sys-color-primary)] transition-all"
        >
          <span className="block text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)] truncate">
            Low Stock Items
          </span>
          <div
            className="text-base sm:text-lg font-bold mono-num truncate"
            style={{ color: lowStockItemsCount > 0 ? 'var(--md-sys-color-error)' : 'var(--positive)' }}
          >
            {lowStockItemsCount} Items
          </div>
          <span className="text-[10px] sm:text-[11px] text-[var(--md-sys-color-on-surface-variant)] block truncate">
            Reorder required
          </span>
        </Surface>
      </ResponsiveGrid>

      {/* 2-Column Section: Needs Attention + starqAI Assistant Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 w-full min-w-0">
        {/* Needs Attention Panel (7 cols) */}
        <Surface variant="filled" level={1} padding="md" className="lg:col-span-7 space-y-3.5 min-w-0">
          <div
            className="flex items-center justify-between pb-3 min-w-0"
            style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              <AlertCircle size={17} style={{ color: 'var(--md-sys-color-error)' }} className="shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--md-sys-color-on-surface)] truncate">
                Needs Attention
              </h2>
            </div>
            <Badge variant="destructive" size="sm">
              {alerts.length} Action Required
            </Badge>
          </div>

          <div className="space-y-2.5 min-w-0">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 rounded-[var(--md-sys-shape-corner-medium)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 transition-all"
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                }}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertTriangle
                    size={16}
                    className="shrink-0 mt-0.5"
                    style={{ color: alert.urgency === 'critical' ? 'var(--md-sys-color-error)' : 'var(--warning)' }}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <p className="text-xs font-semibold text-[var(--md-sys-color-on-surface)] truncate">{alert.title}</p>
                      {alert.amount && (
                        <span className="mono-num text-xs font-bold" style={{ color: 'var(--md-sys-color-error)' }}>
                          {formatMVR(alert.amount)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5 line-clamp-2">
                      {alert.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <Button
                    variant="filled"
                    size="xs"
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
                  >
                    <span>{alert.actionLabel}</span>
                    <ArrowRight size={12} />
                  </Button>
                  <Button
                    variant="text"
                    size="xs"
                    onClick={() => dismissAlert(alert.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Surface>

        {/* starqAI Insights Widget (5 cols) */}
        <Surface variant="filled" level={1} padding="md" className="lg:col-span-5 space-y-3.5 flex flex-col justify-between min-w-0">
          <div>
            <div
              className="flex items-center justify-between pb-3 min-w-0"
              style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}
            >
              <div className="flex items-center gap-2 min-w-0 truncate">
                <Sparkles size={17} style={{ color: 'var(--md-sys-color-primary)' }} className="shrink-0" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--md-sys-color-on-surface)] truncate">
                  starqAI Insights
                </h2>
              </div>
              <button
                onClick={() => setIsAICopilotOpen(true)}
                className="text-xs font-semibold hover:underline shrink-0"
                style={{ color: 'var(--md-sys-color-primary)' }}
              >
                Open Copilot →
              </button>
            </div>

            <div className="mt-3.5 space-y-3 min-w-0">
              {aiInsights.slice(0, 2).map((insight) => (
                <div
                  key={insight.id}
                  className="p-3 rounded-[var(--md-sys-shape-corner-medium)] text-xs space-y-1.5 min-w-0"
                  style={{
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                  }}
                >
                  <div className="flex items-center justify-between min-w-0">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider truncate"
                      style={{ color: 'var(--md-sys-color-primary)' }}
                    >
                      {insight.category}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {insight.impact}
                    </Badge>
                  </div>
                  <p className="font-semibold text-[var(--md-sys-color-on-surface)] truncate">{insight.title}</p>
                  <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] leading-relaxed line-clamp-2">
                    {insight.description}
                  </p>
                  <div
                    className="pt-2 flex items-center justify-between min-w-0"
                    style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}
                  >
                    <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] truncate max-w-[160px]">
                      {insight.recommendedAction}
                    </span>
                    <Button
                      variant="tonal"
                      size="xs"
                      onClick={() => triggerAIInsightAction(insight)}
                      className="shrink-0"
                    >
                      {insight.actionButtonLabel}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="p-3 rounded-[var(--md-sys-shape-corner-small)] text-xs flex items-center justify-between mt-3 min-w-0"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              <Zap size={14} style={{ color: 'var(--md-sys-color-primary)' }} className="shrink-0" />
              <span className="truncate text-[var(--md-sys-color-on-surface)]">Job IGN-0234 reached clearcoat bake pass.</span>
            </div>
            <Link
              to="/jobs/job-1"
              className="font-bold hover:underline shrink-0 ml-2"
              style={{ color: 'var(--md-sys-color-primary)' }}
            >
              View
            </Link>
          </div>
        </Surface>
      </div>

      {/* Active Work Orders in Floor Module */}
      <Surface variant="filled" level={1} padding="md" className="space-y-4 min-w-0">
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 min-w-0"
          style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}
        >
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--md-sys-color-on-surface)] truncate">
              Active Work Orders & Floor Bays
            </h2>
            <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] truncate">Live floor progress for service and repair packages</p>
          </div>

          <Link
            to="/jobs"
            className="text-xs font-semibold hover:underline flex items-center gap-1 shrink-0"
            style={{ color: 'var(--md-sys-color-primary)' }}
          >
            <span>View All Jobs</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* Jobs Table in Canonical DataTable */}
        <DataTable
          data={activeJobs}
          columns={recentJobColumns}
          keyExtractor={(j) => j.id}
          onRowClick={(j) => navigate(`/jobs/${j.id}`)}
          emptyMessage="No active work orders on floor."
        />
      </Surface>

      {/* Financial Performance Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 w-full min-w-0">
        <Surface variant="filled" level={1} padding="md" className="lg:col-span-8 space-y-4 min-w-0">
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 min-w-0"
            style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}
          >
            <div className="min-w-0">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--md-sys-color-on-surface)] truncate">
                Financial Performance (MVR)
              </h2>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] truncate">Revenue & Operating Surplus</p>
            </div>
            <div className="flex items-center gap-3 text-xs shrink-0">
              <span className="flex items-center gap-1.5 text-[var(--md-sys-color-on-surface-variant)]">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--md-sys-color-primary)' }} /> Revenue
              </span>
              <span className="flex items-center gap-1.5 text-[var(--md-sys-color-on-surface-variant)]">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--positive)' }} /> Surplus
              </span>
            </div>
          </div>

          <div className="h-56 sm:h-60 w-full pt-2 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MONTHLY_SALES_CHART_DATA}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--md-sys-color-primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--md-sys-color-primary)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" opacity={0.6} />
                <XAxis dataKey="month" stroke="var(--md-sys-color-on-surface-variant)" fontSize={11} />
                <YAxis stroke="var(--md-sys-color-on-surface-variant)" fontSize={11} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    borderColor: 'var(--md-sys-color-outline-variant)',
                    color: 'var(--md-sys-color-on-surface)',
                    borderRadius: 'var(--md-sys-shape-corner-medium)',
                    fontSize: '12px'
                  }}
                  formatter={(val: any) => [formatMVR(Number(val || 0)), '']}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--md-sys-color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="profit" stroke="var(--positive)" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Surface>

        <Surface variant="filled" level={1} padding="md" className="lg:col-span-4 space-y-4 flex flex-col justify-between min-w-0">
          <div>
            <h2
              className="text-xs font-semibold uppercase tracking-wider text-[var(--md-sys-color-on-surface)] pb-3"
              style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}
            >
              Service Mix Distribution
            </h2>
            <div className="mt-3.5 space-y-2.5 text-xs min-w-0">
              {SERVICE_BREAKDOWN_DATA.map((srv, i) => (
                <div key={i} className="space-y-1 min-w-0">
                  <div className="flex items-center justify-between text-xs min-w-0">
                    <span className="font-medium text-[var(--md-sys-color-on-surface)] truncate">{srv.name}</span>
                    <span className="mono-num font-bold shrink-0">{srv.value}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--md-sys-color-surface-container-high)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${srv.value}%`, backgroundColor: srv.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="p-3.5 rounded-[var(--md-sys-shape-corner-small)] space-y-1.5 mt-3 text-xs min-w-0"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div className="flex items-center justify-between min-w-0">
              <span className="text-[var(--md-sys-color-on-surface-variant)]">BML Main Account:</span>
              <span className="mono-num font-semibold text-[var(--md-sys-color-on-surface)]">7730000189201</span>
            </div>
            <div className="flex items-center justify-between min-w-0">
              <span className="text-[var(--md-sys-color-on-surface-variant)]">Tax Status:</span>
              <span className="font-semibold text-[var(--positive)]">Non-GST Registered</span>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
};
