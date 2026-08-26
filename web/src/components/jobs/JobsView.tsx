import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Search,
  Plus,
  LayoutGrid,
  List,
  ChevronRight,
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { CreateJobModal } from './CreateJobModal';
import {
  Button,
  Input,
  Select,
  Surface,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  ActionGroup,
  type BadgeVariant,
} from '../ui';

export const JobsView: React.FC = () => {
  const navigate = useNavigate();
  const {
    jobs,
    setIsCreateJobOpen,
    formatMVR,
    activeJobsCount,
    workflowStages,
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

  const getStatusBadgeVariant = (status: string): BadgeVariant => {
    const lower = status.toLowerCase();
    if (lower.includes('draft')) return 'info';
    if (lower.includes('ready') || lower.includes('complete') || lower.includes('invoiced')) return 'positive';
    if (lower.includes('progress') || lower.includes('diag') || lower.includes('parts')) return 'warning';
    if (lower.includes('void') || lower.includes('cancel')) return 'destructive';
    return 'neutral';
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 w-full min-w-0">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--md-sys-color-on-surface)] truncate">
              Work Orders & Floor Pipeline
            </h1>
            <Badge variant="accent" size="sm">
              {activeJobsCount} Active
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-[var(--md-sys-color-on-surface-variant)] truncate">
            Dynamic pipeline stages ({workflowStages.length} phases), bay allocations & material tracking
          </p>
        </div>

        <ActionGroup align="right" className="shrink-0">
          {/* View Toggle */}
          <div
            className="flex items-center p-0.5 sm:p-1 rounded-[var(--md-sys-shape-corner-full)]"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <Button
              variant={viewMode === 'kanban' ? 'tonal' : 'text'}
              size="xs"
              onClick={() => setViewMode('kanban')}
              icon={<LayoutGrid size={14} />}
            >
              <span>Kanban</span>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'tonal' : 'text'}
              size="xs"
              onClick={() => setViewMode('list')}
              icon={<List size={14} />}
            >
              <span>Table</span>
            </Button>
          </div>

          <Button
            variant="filled"
            size="sm"
            onClick={() => setIsCreateJobOpen(true)}
            icon={<Plus size={15} />}
          >
            <span>New Job</span>
          </Button>
        </ActionGroup>
      </div>

      {/* Filter Surface */}
      <Surface variant="filled" level={1} padding="sm" className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
        <div className="flex-1 w-full md:max-w-md min-w-0">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by job ID, customer, plate, model…"
            icon={<Search size={14} />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              Service:
            </span>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                color: 'var(--md-sys-color-on-surface)',
                borderColor: 'var(--md-sys-color-outline-variant)',
                borderRadius: 'var(--md-sys-shape-corner-small)',
              }}
              className="h-8 sm:h-9 px-2.5 text-xs border outline-none cursor-pointer max-w-[140px] truncate"
            >
              {services.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              Stage:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                color: 'var(--md-sys-color-on-surface)',
                borderColor: 'var(--md-sys-color-outline-variant)',
                borderRadius: 'var(--md-sys-shape-corner-small)',
              }}
              className="h-8 sm:h-9 px-2.5 text-xs border outline-none cursor-pointer max-w-[140px] truncate"
            >
              <option value="All">All Stages</option>
              {workflowStages.map((stg) => (
                <option key={stg.id} value={stg.name}>{stg.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Surface>

      {/* Kanban View Mode */}
      {viewMode === 'kanban' && (
        <div className="erp-scroll-region pb-4">
          <div className="flex gap-3 sm:gap-4 min-w-max">
            {workflowStages.map((stage) => {
              const stageJobs = filteredJobs.filter(
                (j) =>
                  j.status.toLowerCase() === stage.name.toLowerCase() ||
                  j.status.toLowerCase() === stage.code.toLowerCase()
              );

              return (
                <div
                  key={stage.id}
                  className="w-68 sm:w-72 shrink-0 flex flex-col max-h-[75vh] p-3 sm:p-3.5 rounded-[var(--md-sys-shape-corner-large)] min-w-0"
                  style={{
                    backgroundColor: 'var(--md-sys-color-surface-container-low)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                  }}
                >
                  {/* Stage Column Header */}
                  <div
                    className="flex items-center justify-between pb-2.5 mb-2.5 min-w-0"
                    style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span
                        className="mono-num text-[11px] font-bold px-1.5 py-0.5 rounded-[var(--md-sys-shape-corner-extra-small)] shrink-0"
                        style={{
                          backgroundColor: 'var(--md-sys-color-primary-container)',
                          color: 'var(--md-sys-color-on-primary-container)',
                        }}
                      >
                        {stage.code}
                      </span>
                      <span className="text-xs font-semibold truncate text-[var(--md-sys-color-on-surface)]">
                        {stage.name}
                      </span>
                    </div>
                    <Badge variant="neutral" size="sm">
                      {stageJobs.length}
                    </Badge>
                  </div>

                  {/* Stage Cards Container */}
                  <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 min-w-0">
                    {stageJobs.length === 0 ? (
                      <div
                        className="p-4 text-center text-xs rounded-[var(--md-sys-shape-corner-medium)]"
                        style={{
                          border: '1px dashed var(--md-sys-color-outline-variant)',
                          color: 'var(--md-sys-color-on-surface-variant)',
                        }}
                      >
                        No jobs
                      </div>
                    ) : (
                      stageJobs.map((job) => (
                        <div
                          key={job.id}
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          style={{
                            backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                            border: '1px solid var(--md-sys-color-outline-variant)',
                            borderRadius: 'var(--md-sys-shape-corner-medium)',
                          }}
                          className="p-3 space-y-2 cursor-pointer transition-all hover:border-[var(--md-sys-color-primary)] hover:shadow-xs min-w-0"
                        >
                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <span className="mono-num font-bold text-xs truncate" style={{ color: 'var(--md-sys-color-primary)' }}>
                              {job.jobId}
                            </span>
                            <Badge
                              variant={job.priority === 'Urgent' ? 'destructive' : 'neutral'}
                              size="sm"
                            >
                              {job.priority}
                            </Badge>
                          </div>

                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-[var(--md-sys-color-on-surface)] truncate">
                              {job.customerName}
                            </div>
                            <div className="text-[11px] mono-num truncate" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                              {job.vehicle?.plateNumber} • {job.vehicle?.model}
                            </div>
                          </div>

                          <div className="text-[11px] truncate" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                            {job.serviceType}
                          </div>

                          <div
                            className="pt-2 flex items-center justify-between text-xs min-w-0"
                            style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}
                          >
                            <span className="mono-num font-bold text-[var(--md-sys-color-on-surface)] truncate">
                              {formatMVR(job.quotedAmount)}
                            </span>
                            <span
                              className="text-[11px] font-semibold flex items-center gap-0.5 hover:underline shrink-0"
                              style={{ color: 'var(--md-sys-color-primary)' }}
                            >
                              <span>Inspect</span>
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

      {/* Table View Mode */}
      {viewMode === 'list' && (
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Job ID</TableHead>
              <TableHead>Customer & Vehicle</TableHead>
              <TableHead className="hidden sm:table-cell">Service</TableHead>
              <TableHead className="hidden md:table-cell">Bay</TableHead>
              <TableHead alignRight>Amount</TableHead>
              <TableHead alignRight className="hidden sm:table-cell">Margin</TableHead>
              <TableHead>Status</TableHead>
              <TableHead alignRight>Action</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {filteredJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  No work orders matching search criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredJobs.map((job) => (
                <TableRow
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>
                    <span className="mono-num">{job.jobId}</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-[var(--md-sys-color-on-surface)] truncate max-w-[160px] sm:max-w-none">
                      {job.customerName}
                    </div>
                    <div className="text-[11px] mono-num truncate" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {job.vehicle?.plateNumber} ({job.vehicle?.model})
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    {job.serviceType}
                  </TableCell>
                  <TableCell className="hidden md:table-cell" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    {job.bayNumber || 'Main Bay'}
                  </TableCell>
                  <TableCell isNumeric className="font-bold text-[var(--md-sys-color-on-surface)]">
                    {formatMVR(job.quotedAmount)}
                  </TableCell>
                  <TableCell isNumeric style={{ color: 'var(--positive)' }} className="hidden sm:table-cell">
                    {job.targetMarginPercentage}%
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(job.status)} size="sm">
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell alignRight>
                    <span className="text-xs font-semibold hover:underline" style={{ color: 'var(--md-sys-color-primary)' }}>
                      Inspect →
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <CreateJobModal />
    </div>
  );
};
