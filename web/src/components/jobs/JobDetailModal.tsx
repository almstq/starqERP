import React, { useState } from 'react';
import {
  X,
  Car,
  Calendar,
  DollarSign,
  User,
  Wrench,
  Package,
  Plus,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Clock,
  Printer,
  Sparkles
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Badge } from '../common/Badge';
import { JobStatus } from '../../types/erp';

export const JobDetailModal: React.FC = () => {
  const {
    selectedJobId,
    setSelectedJobId,
    jobs,
    inventory,
    workflowStages,
    formatMVR,
    updateJobStatus,
    addMaterialToJob,
    generateJobInvoice,
    setActiveTab,
    setSelectedInvoiceId
  } = useERP();

  const [selectedInvId, setSelectedInvId] = useState('');
  const [materialQty, setMaterialQty] = useState(1);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);

  if (!selectedJobId) return null;

  const job = jobs.find((j) => j.id === selectedJobId || j.jobId === selectedJobId);
  if (!job) return null;

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvId || materialQty <= 0) return;
    addMaterialToJob(job.id, selectedInvId, Number(materialQty));
    setIsAddingMaterial(false);
    setSelectedInvId('');
    setMaterialQty(1);
  };

  const handleCreateInvoice = () => {
    const newInv = generateJobInvoice(job.id);
    setSelectedInvoiceId(newInv.id);
    setActiveTab('invoices');
    setSelectedJobId(null);
  };

  const currentStageIndex = workflowStages.findIndex(
    (s) => s.name.toLowerCase() === job.status.toLowerCase()
  );
  const currentStage = workflowStages[currentStageIndex];
  const nextStage = workflowStages[currentStageIndex + 1];

  const statusOptions = workflowStages.length > 0
    ? workflowStages.map((s) => s.name)
    : ['Check-in & Inspection', 'Surface Prep & Sanding', 'Spray Booth / Wrap Studio', 'Detailing, QC & Assembly', 'Ready for Customer Delivery', 'Tax Invoiced & Settled'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
        onClick={() => setSelectedJobId(null)}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-200 bg-slate-50">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xl font-extrabold text-blue-600 font-mono tracking-tight">
                {job.jobId}
              </span>
              <span className="text-lg font-bold text-slate-900">{job.serviceType}</span>
              <Badge
                variant={
                  job.status === 'Completed' || job.status === 'Invoiced'
                    ? 'success'
                    : job.status === 'In Progress'
                    ? 'blue'
                    : 'warning'
                }
                size="sm"
                dot
              >
                {job.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Customer: <span className="text-slate-900 font-semibold">{job.customerName}</span> ({job.customerPhone}) • Bay: <span className="text-blue-700 font-semibold">{job.bayNumber}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedJobId(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Quick Bar */}
        <div className="px-6 py-3 bg-slate-50/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">Workflow Stage:</span>
            <select
              value={job.status}
              onChange={(e) => updateJobStatus(job.id, e.target.value as JobStatus)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-blue-600 font-bold focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {nextStage && (
              <button
                onClick={() => updateJobStatus(job.id, nextStage.name as JobStatus)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-2xs"
              >
                <span>Advance to {nextStage.name}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!job.linkedInvoiceId ? (
              <button
                onClick={handleCreateInvoice}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Generate Invoice</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setSelectedInvoiceId(job.linkedInvoiceId!);
                  setActiveTab('invoices');
                  setSelectedJobId(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>View Invoice ({job.linkedInvoiceId})</span>
              </button>
            )}
          </div>
        </div>

        {/* Stage SOP Guidance & Checklist Banner (SERP-153 / DEC-092) */}
        {currentStage && (
          <div className="px-6 py-3.5 bg-blue-50/50 border-b border-blue-100 text-xs">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900">SOP Stage Guidance: {currentStage.name}</span>
                  {currentStage.slaHours && (
                    <span className="text-[11px] font-mono text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
                      Target SLA: {currentStage.slaHours} hrs
                    </span>
                  )}
                </div>
                <p className="text-slate-600">{currentStage.description}</p>

                {currentStage.checklistItems && currentStage.checklistItems.length > 0 && (
                  <div className="pt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {currentStage.checklistItems.map((item, idx) => (
                      <label key={idx} className="flex items-center gap-2 text-[11px] text-slate-700 bg-white/80 p-1.5 rounded border border-blue-100 cursor-pointer hover:bg-white">
                        <input type="checkbox" defaultChecked className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5" />
                        <span className="truncate">{item}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-6 text-xs text-slate-700">
          {/* Top 3-Stat KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Quoted Amount</span>
              <div className="text-base font-extrabold text-slate-900 mono-num mt-1">
                {formatMVR(job.quotedAmount)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Materials Used Cost</span>
              <div className="text-base font-extrabold text-rose-600 mono-num mt-1">
                {formatMVR(job.actualMaterialCost)}
              </div>
              <span className="text-[10px] text-slate-400">Est: {formatMVR(job.estimatedMaterialCost, false)}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Labor & Overhead</span>
              <div className="text-base font-extrabold text-slate-700 mono-num mt-1">
                {formatMVR(job.laborCostEstimate)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Estimated Job Profit</span>
              <div className="text-base font-extrabold text-emerald-700 mono-num mt-1">
                {formatMVR(job.actualProfit)}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold">{job.targetMarginPercentage}% Margin</span>
            </div>
          </div>

          {/* Vehicle & Service Specification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vehicle Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-blue-600" /> Vehicle Information
                </span>
                <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                  {job.vehicle.plateNumber}
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
              </div>
              <div className="text-slate-500">Color: {job.vehicle.color}</div>
              <div className="text-slate-500">Type: {job.vehicle.type}</div>
            </div>

            {/* Timeline & Assignee */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" /> Timeline & Technicians
                </span>
                <Badge size="sm" variant={job.priority === 'Urgent' ? 'danger' : 'neutral'}>
                  {job.priority} Priority
                </Badge>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Start Date:</span>
                <span className="font-semibold text-slate-800">{job.startDate}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Target Delivery:</span>
                <span className="font-semibold text-blue-700">{job.expectedCompletionDate}</span>
              </div>
              <div className="flex justify-between text-xs items-center pt-1">
                <span className="text-slate-500">Assigned Techs:</span>
                <div className="flex gap-1 flex-wrap">
                  {job.assignedStaff.map((s) => (
                    <span key={s.id} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px]">
                      {s.name} ({s.role})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Requested Work Description */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
              Scope of Work & Client Specifications
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">{job.requestedWork}</p>
            {job.specialInstructions && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                <span className="font-bold">Special Note: </span>
                {job.specialInstructions}
              </div>
            )}
          </div>

          {/* Materials Used Table with Instant "Add Material" button */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                  Materials & Paint Consumed ({job.materialsUsed.length})
                </h3>
              </div>

              <button
                onClick={() => setIsAddingMaterial(!isAddingMaterial)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Material Used</span>
              </button>
            </div>

            {/* Inline Add Material Form */}
            {isAddingMaterial && (
              <form
                onSubmit={handleAddMaterial}
                className="p-4 rounded-xl bg-slate-50 border border-blue-200 space-y-3 animate-in fade-in duration-150"
              >
                <div className="font-bold text-blue-700 text-xs">Deduct from Workshop Inventory:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-1">Select Material / Paint SKU</label>
                    <select
                      required
                      value={selectedInvId}
                      onChange={(e) => setSelectedInvId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Choose from available inventory --</option>
                      {inventory.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name} ({inv.quantityOnHand} {inv.unit} in stock) — MVR {inv.unitCost}/{inv.unit}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Quantity Used</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={materialQty}
                      onChange={(e) => setMaterialQty(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingMaterial(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-xs"
                  >
                    Confirm & Deduct Stock
                  </button>
                </div>
              </form>
            )}

            {/* Materials Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Material / Item Description</th>
                    <th className="py-2.5 px-4 text-center">Qty Used</th>
                    <th className="py-2.5 px-4 text-right">Unit Cost</th>
                    <th className="py-2.5 px-4 text-right">Total Cost</th>
                    <th className="py-2.5 px-4 text-right">Date Logged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {job.materialsUsed.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No materials logged yet for this work order.
                      </td>
                    </tr>
                  ) : (
                    job.materialsUsed.map((mat) => (
                      <tr key={mat.id}>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{mat.itemName}</td>
                        <td className="py-2.5 px-4 text-center font-mono">
                          {mat.quantity} {mat.unit}
                        </td>
                        <td className="py-2.5 px-4 text-right mono-num">{formatMVR(mat.unitCost)}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-rose-600 mono-num">
                          {formatMVR(mat.totalCost)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-500">{mat.addedAt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span>Advance Deposit:</span>
            <span className="font-mono font-bold text-emerald-600">{formatMVR(job.depositPaid)}</span>
            <span>• Balance Remaining:</span>
            <span className="font-mono font-bold text-rose-600">{formatMVR(job.balanceDue)}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSelectedJobId(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
