import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Wrench,
  Car,
  Calendar,
  DollarSign,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Plus,
  ArrowRight,
  TrendingUp,
  Package,
  Layers,
  ChevronRight,
  Phone,
  ShieldCheck,
  Printer
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { JobStatus } from '../../types/erp';
import { WorkflowStepRail } from './WorkflowStepRail';

export const JobDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    jobs,
    formatMVR,
    updateJobStatus,
    addMaterialToJob,
    inventory,
    workflowStages,
    customers,
    generateJobInvoice
  } = useERP();

  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState(inventory[0]?.id || '');
  const [materialQty, setMaterialQty] = useState(1);

  const job = jobs.find((j) => j.id === id || j.jobId.toLowerCase() === id?.toLowerCase());

  if (!job) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/jobs')} className="erp-btn-quiet flex items-center gap-2">
          <ArrowLeft size={16} />
          <span>Back to Jobs</span>
        </button>
        <div className="erp-card p-12 text-center">
          <Wrench size={40} className="erp-muted mx-auto mb-3" />
          <h2 className="erp-h1 text-xl">Work Order Not Found</h2>
          <p className="erp-muted mt-2 text-sm">No job record matching ID "{id}" was found.</p>
          <button onClick={() => navigate('/jobs')} className="erp-btn-primary mt-6">
            View All Jobs
          </button>
        </div>
      </div>
    );
  }

  const customer = customers.find((c) => c.id === job.customerId);
  const currentStageIndex = workflowStages.findIndex(
    (s) => s.name.toLowerCase() === job.status.toLowerCase()
  );
  const nextStage = workflowStages[currentStageIndex + 1];

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventoryId || materialQty <= 0) return;
    addMaterialToJob(job.id, selectedInventoryId, Number(materialQty));
    setIsAddMaterialOpen(false);
    setMaterialQty(1);
  };

  const handleCreateInvoice = () => {
    generateJobInvoice(job.id);
    navigate('/invoices');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/jobs')}
            className="erp-btn-quiet p-2 rounded-xl flex items-center justify-center"
            title="Back to Jobs"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="erp-h1 text-2xl">{job.jobId}</h1>
              <span className={`erp-pill ${
                job.priority === 'Urgent' ? 'erp-pill-danger' : 'erp-pill-neutral'
              }`}>
                {job.priority} Priority
              </span>
              <span className="erp-pill erp-pill-info">{job.status}</span>
            </div>
            <p className="erp-muted mt-0.5 text-xs">
              {job.serviceType} • Bay: {job.bayNumber || 'Main Bay'} • Created {job.startDate}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {nextStage && (
            <button
              onClick={() => updateJobStatus(job.id, nextStage.name as JobStatus)}
              className="erp-btn-primary flex items-center gap-1.5"
            >
              <span>Move to {nextStage.name}</span>
              <ArrowRight size={14} />
            </button>
          )}
          {!job.linkedInvoiceId && (
            <button
              onClick={handleCreateInvoice}
              className="erp-btn-quiet flex items-center gap-1.5"
            >
              <FileText size={14} />
              <span>Generate Invoice</span>
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="erp-btn-quiet p-2"
            title="Print Job Sheet"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* Main Grid: Reference Screen (Job Details Left, Profitability & Payments Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Job Details, Asset, Materials */}
        <div className="lg:col-span-7 space-y-6">
          {/* Customer & Vehicle Info */}
          <div className="erp-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Car size={18} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-bold uppercase tracking-wider">Customer & Vehicle Details</h2>
              </div>
              {customer && (
                <Link
                  to={`/customers/${customer.id}`}
                  className="text-xs font-semibold hover:underline flex items-center gap-1"
                  style={{ color: 'var(--accent)' }}
                >
                  <span>Customer Profile</span>
                  <ChevronRight size={12} />
                </Link>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="erp-muted block text-[11px]">Customer Name</span>
                <span className="font-semibold text-sm block">{job.customerName}</span>
                <span className="erp-muted flex items-center gap-1 mt-0.5">
                  <Phone size={12} />
                  <span>{job.customerPhone}</span>
                </span>
              </div>

              {job.vehicle && (
                <div className="space-y-1">
                  <span className="erp-muted block text-[11px]">Vehicle / Vessel Asset</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm" style={{ color: 'var(--accent)' }}>
                      {job.vehicle.plateNumber}
                    </span>
                    <span className="font-semibold">
                      {job.vehicle.make} {job.vehicle.model}
                    </span>
                  </div>
                  <span className="erp-muted block text-[11px]">
                    Color: {job.vehicle.color} {job.vehicle.year ? `• Year: ${job.vehicle.year}` : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="erp-muted block text-[11px]">Requested Scope of Work</span>
              <p className="mt-1 text-xs leading-relaxed">{job.requestedWork}</p>
              {job.specialInstructions && (
                <div className="mt-2 p-2.5 rounded-lg text-xs" style={{ background: 'var(--muted)' }}>
                  <span className="font-semibold block text-[11px]">Special Instructions:</span>
                  <span className="erp-muted">{job.specialInstructions}</span>
                </div>
              )}
            </div>
          </div>

          {/* 13-Step Workflow Journey Rail with Seat Signpost (SERP-146) */}
          <WorkflowStepRail
            currentStatus={job.status}
            onAdvance={(next) => updateJobStatus(job.id, next as JobStatus)}
          />

          {/* Workflow Pipeline Progression */}
          <div className="erp-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Layers size={18} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-bold uppercase tracking-wider">Pipeline Stage Progression</h2>
              </div>
              <span className="text-xs erp-muted">
                Stage {currentStageIndex + 1} of {workflowStages.length}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {workflowStages.map((stage, idx) => {
                const isCurrent = stage.name.toLowerCase() === job.status.toLowerCase();
                const isPast = currentStageIndex > idx;
                return (
                  <button
                    key={stage.id}
                    onClick={() => updateJobStatus(job.id, stage.name as JobStatus)}
                    className="p-2.5 rounded-xl text-left border transition-all"
                    style={{
                      background: isCurrent ? 'var(--sidebar-accent)' : 'transparent',
                      borderColor: isCurrent ? 'var(--accent)' : 'var(--border)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] erp-muted">{stage.code}</span>
                      {isPast && <CheckCircle2 size={12} style={{ color: 'var(--positive)' }} />}
                      {isCurrent && <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />}
                    </div>
                    <div className="font-semibold text-xs mt-1 truncate">{stage.name}</div>
                  </button>
                );
              })}
            </div>

            {/* Active Stage SOP Guidance & Checklist (SERP-153 / DEC-092) */}
            {workflowStages[currentStageIndex] && (
              <div className="mt-3 p-3.5 rounded-xl border space-y-2 text-xs" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold">SOP Checklist: {workflowStages[currentStageIndex].name}</span>
                  {workflowStages[currentStageIndex].slaHours && (
                    <span className="text-[11px] font-mono erp-muted">
                      Target SLA: {workflowStages[currentStageIndex].slaHours}h
                    </span>
                  )}
                </div>
                <p className="erp-muted">{workflowStages[currentStageIndex].description}</p>
                {workflowStages[currentStageIndex].checklistItems && workflowStages[currentStageIndex].checklistItems!.length > 0 && (
                  <div className="pt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {workflowStages[currentStageIndex].checklistItems!.map((item, idx) => (
                      <label key={idx} className="flex items-center gap-2 text-[11px] p-1.5 rounded border cursor-pointer hover:opacity-90" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
                        <input type="checkbox" defaultChecked className="rounded w-3.5 h-3.5" />
                        <span className="truncate">{item}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Materials Used in Job */}
          <div className="erp-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Package size={18} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-bold uppercase tracking-wider">Materials & Consumables Used</h2>
              </div>
              <button
                onClick={() => setIsAddMaterialOpen(!isAddMaterialOpen)}
                className="erp-btn-quiet text-xs py-1 px-2.5 flex items-center gap-1"
              >
                <Plus size={12} />
                <span>Add Material</span>
              </button>
            </div>

            {isAddMaterialOpen && (
              <form onSubmit={handleAddMaterial} className="p-3.5 rounded-xl border space-y-3" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                <div className="text-xs font-bold">Log Material Usage (Deducts Physical Stock)</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="erp-muted block mb-1">Select Inventory Item</label>
                    <select
                      value={selectedInventoryId}
                      onChange={(e) => setSelectedInventoryId(e.target.value)}
                      className="erp-input w-full"
                    >
                      {inventory.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name} ({inv.quantityOnHand} {inv.unit} in stock)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="erp-muted block mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={materialQty}
                      onChange={(e) => setMaterialQty(Number(e.target.value))}
                      className="erp-input w-full"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddMaterialOpen(false)}
                    className="erp-btn-quiet text-xs py-1"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="erp-btn-primary text-xs py-1">
                    Confirm & Deduct
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Unit Cost</th>
                    <th className="text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {job.materialsUsed.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center erp-muted py-6">
                        No materials logged to this work order yet.
                      </td>
                    </tr>
                  ) : (
                    job.materialsUsed.map((m) => (
                      <tr key={m.id}>
                        <td className="font-semibold">{m.itemName}</td>
                        <td className="text-center font-mono">{m.quantity} {m.unit}</td>
                        <td className="text-right font-mono">{formatMVR(m.unitCost)}</td>
                        <td className="text-right font-mono font-bold">{formatMVR(m.totalCost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t text-xs" style={{ borderColor: 'var(--border)' }}>
              <span className="erp-muted">Total Material Cost:</span>
              <span className="font-mono font-bold text-sm erp-money-out">{formatMVR(job.actualMaterialCost)}</span>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Payment, Profitability & Linked Invoice */}
        <div className="lg:col-span-5 space-y-6">
          {/* Job Profitability Card */}
          <div className="erp-card p-5 space-y-4">
            <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <TrendingUp size={18} style={{ color: 'var(--positive)' }} />
              <h2 className="text-sm font-bold uppercase tracking-wider">Job Financials & Margin</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="erp-muted">Quoted Price:</span>
                <span className="font-mono font-bold text-sm">{formatMVR(job.quotedAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="erp-muted">Deposit Paid:</span>
                <span className="font-mono font-semibold erp-money-in">{formatMVR(job.depositPaid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="erp-muted">Balance Due:</span>
                <span className={`font-mono font-bold ${job.balanceDue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {formatMVR(job.balanceDue)}
                </span>
              </div>

              <div className="my-2 border-t" style={{ borderColor: 'var(--border)' }} />

              <div className="flex items-center justify-between">
                <span className="erp-muted">Actual Materials:</span>
                <span className="font-mono erp-money-out">- {formatMVR(job.actualMaterialCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="erp-muted">Estimated Labor:</span>
                <span className="font-mono erp-money-out">- {formatMVR(job.laborCostEstimate)}</span>
              </div>

              <div className="p-3.5 rounded-xl border mt-2 flex items-center justify-between" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                <div>
                  <span className="erp-muted block text-[10px] uppercase font-bold">Estimated Net Profit</span>
                  <span className="font-mono font-bold text-base erp-money-in">
                    {formatMVR(job.actualProfit)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="erp-muted block text-[10px] uppercase font-bold">Margin</span>
                  <span className="font-mono font-extrabold text-sm" style={{ color: 'var(--positive)' }}>
                    {job.targetMarginPercentage}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Technicians */}
          <div className="erp-card p-5 space-y-3">
            <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <User size={18} style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold uppercase tracking-wider">Assigned Staff</h2>
            </div>
            <div className="space-y-2">
              {job.assignedStaff.map((staff) => (
                <div key={staff.id} className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ background: 'var(--muted)' }}>
                  <span className="font-semibold">{staff.name}</span>
                  <span className="erp-pill erp-pill-neutral text-[11px]">{staff.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Linked Commercial Invoice */}
          <div className="erp-card p-5 space-y-3">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <FileText size={18} style={{ color: 'var(--accent)' }} />
                <h2 className="text-sm font-bold uppercase tracking-wider">Commercial Document</h2>
              </div>
            </div>

            {job.linkedInvoiceId ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="erp-muted">Linked Invoice:</span>
                  <Link
                    to={`/invoices/${job.linkedInvoiceId}`}
                    className="font-mono font-bold hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    {job.linkedInvoiceId} →
                  </Link>
                </div>
                <p className="erp-muted text-[11px]">
                  Commercial document generated. Payments applied to this invoice reflect in customer balance.
                </p>
              </div>
            ) : (
              <div className="text-xs space-y-2">
                <p className="erp-muted">No tax invoice generated for this job yet.</p>
                <button
                  onClick={handleCreateInvoice}
                  className="erp-btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                >
                  <FileText size={14} />
                  <span>Generate Invoice for MVR {job.quotedAmount.toLocaleString()}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
