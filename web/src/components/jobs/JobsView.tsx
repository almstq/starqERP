import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Search,
  Plus,
  Filter,
  LayoutGrid,
  List,
  Car,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Package,
  DollarSign,
  TrendingUp,
  Receipt,
  GitBranch,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { CreateJobModal } from './CreateJobModal';
import { JobOrder, JobStatus, WorkflowStage } from '../../types/erp';

export const JobsView: React.FC = () => {
  const navigate = useNavigate();
  const {
    jobs,
    setIsCreateJobOpen,
    formatMVR,
    updateJobStatus,
    activeJobsCount,
    workflowStages,
    currentTenant,
    hasPermission
  } = useERP();

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredJobs = jobs.filter((j) => {
    const matchesSearch =
      j.jobId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.vehicle?.plateNumber && j.vehicle.plateNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (j.vehicle?.model && j.vehicle.model.toLowerCase().includes(searchQuery.toLowerCase())) ||
      j.serviceType.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesService = serviceFilter === 'All' || j.serviceType === serviceFilter;
    const matchesStatus = statusFilter === 'All' || j.status === statusFilter;

    return matchesSearch && matchesService && matchesStatus;
  });

  const services = ['All', ...new Set(jobs.map((j) => j.serviceType))];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="erp-h1 text-2xl">Work Orders & Floor Pipeline</h1>
            <span className="erp-pill erp-pill-info text-xs">
              {activeJobsCount} Active Orders
            </span>
          </div>
          <p className="erp-muted mt-0.5 text-xs">
            Dynamic pipeline stages ({workflowStages.length} phases), bay assignments, and material tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="erp-card p-1 flex items-center gap-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'kanban' ? 'erp-btn-primary' : 'erp-muted hover:text-white'
              }`}
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'list' ? 'erp-btn-primary' : 'erp-muted hover:text-white'
              }`}
            >
              <List size={14} />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          <button
            onClick={() => setIsCreateJobOpen(true)}
            className="erp-btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            <span>New Work Order</span>
          </button>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="erp-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="erp-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by job ID, customer, plate #, model..."
            className="erp-input w-full pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="erp-muted">Service:</span>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="erp-input py-1 text-xs"
            >
              {services.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="erp-muted">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="erp-input py-1 text-xs"
            >
              <option value="All">All Stages</option>
              {workflowStages.map((stg) => (
                <option key={stg.id} value={stg.name}>{stg.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="erp-scroll-x pb-4">
          <div className="flex gap-4 min-w-[1000px]">
            {workflowStages.map((stage) => {
              const stageJobs = filteredJobs.filter(
                (j) => j.status.toLowerCase() === stage.name.toLowerCase() || j.status.toLowerCase() === stage.code.toLowerCase()
              );

              return (
                <div
                  key={stage.id}
                  className="w-72 shrink-0 erp-card p-3 flex flex-col max-h-[75vh]"
                >
                  {/* Stage Header */}
                  <div className="flex items-center justify-between pb-2 border-b mb-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>
                        {stage.code}
                      </span>
                      <span className="text-xs font-bold truncate">{stage.name}</span>
                    </div>
                    <span className="erp-pill erp-pill-neutral text-[10px]">{stageJobs.length}</span>
                  </div>

                  {/* Stage Card List */}
                  <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                    {stageJobs.length === 0 ? (
                      <div className="p-4 text-center erp-muted text-xs border border-dashed rounded-xl" style={{ borderColor: 'var(--border)' }}>
                        No jobs in stage
                      </div>
                    ) : (
                      stageJobs.map((job) => (
                        <div
                          key={job.id}
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          className="p-3.5 rounded-xl border space-y-2 cursor-pointer transition-all hover:border-[var(--accent)]"
                          style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs" style={{ color: 'var(--accent)' }}>
                              {job.jobId}
                            </span>
                            <span className={`erp-pill ${
                              job.priority === 'Urgent' ? 'erp-pill-danger' : 'erp-pill-neutral'
                            } text-[10px]`}>
                              {job.priority}
                            </span>
                          </div>

                          <div>
                            <div className="font-bold text-xs">{job.customerName}</div>
                            <div className="text-[11px] font-mono erp-muted">
                              {job.vehicle?.plateNumber} • {job.vehicle?.model}
                            </div>
                          </div>

                          <div className="text-[11px] erp-muted truncate">
                            {job.serviceType}
                          </div>

                          <div className="pt-2 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)' }}>
                            <span className="font-mono font-bold">{formatMVR(job.quotedAmount)}</span>
                            <span className="text-[11px] hover:underline flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
                              <span>Details</span>
                              <ChevronRight size={12} />
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'list' && (
        <div className="erp-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Customer & Vehicle</th>
                  <th>Service Type</th>
                  <th>Bay</th>
                  <th className="text-right">Quoted Amount</th>
                  <th className="text-right">Est. Margin</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center erp-muted py-8">
                      No work orders matching search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => (
                    <tr
                      key={job.id}
                      data-clickable="true"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      <td className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{job.jobId}</td>
                      <td>
                        <div className="font-bold text-xs">{job.customerName}</div>
                        <div className="text-[11px] erp-muted font-mono">{job.vehicle?.plateNumber} ({job.vehicle?.model})</div>
                      </td>
                      <td className="text-xs">{job.serviceType}</td>
                      <td className="text-xs erp-muted">{job.bayNumber || 'Main Bay'}</td>
                      <td className="text-right font-mono font-bold">{formatMVR(job.quotedAmount)}</td>
                      <td className="text-right font-mono erp-money-in">{job.targetMarginPercentage}%</td>
                      <td className="text-center">
                        <span className="erp-pill erp-pill-info text-[11px]">{job.status}</span>
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
      )}

      <CreateJobModal />
    </div>
  );
};
