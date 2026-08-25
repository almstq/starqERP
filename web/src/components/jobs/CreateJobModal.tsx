import React, { useState, useEffect } from 'react';
import { useERP } from '../../context/ERPContext';
import { Modal } from '../common/Modal';
import { ServiceType, JobStatus, Vehicle, StaffMember } from '../../types/erp';

export const CreateJobModal: React.FC = () => {
  const {
    isCreateJobOpen,
    setIsCreateJobOpen,
    customers,
    staff,
    createJob,
    prefilledCustomerId,
    setPrefilledCustomerId,
    setSelectedJobId,
    currentUser,
    roles
  } = useERP();

  const userRole = roles.find((r) => r.id === currentUser?.roleId);
  const isSuperAdmin = currentUser?.roleName === 'Super Admin' || userRole?.code === 'superadmin' || userRole?.code === 'owner';
  const canCreateJob = isSuperAdmin || userRole?.permissions.includes('jobs') || userRole?.permissions.includes('all') || userRole?.code === 'sales' || userRole?.code === 'manager';

  const [customerId, setCustomerId] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('Full Body Repaint');
  const [requestedWork, setRequestedWork] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [quotedAmount, setQuotedAmount] = useState<number>(35000);
  const [depositPaid, setDepositPaid] = useState<number>(15000);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(['st-1']);
  const [priority, setPriority] = useState<'Normal' | 'High' | 'Urgent'>('Normal');
  const [bayNumber, setBayNumber] = useState('Spray Booth Bay 1 (Bake Oven)');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedCompletionDate, setExpectedCompletionDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );

  // Vehicle manual input or selected from customer
  const [plateNumber, setPlateNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('2022');
  const [color, setColor] = useState('');

  useEffect(() => {
    if (prefilledCustomerId) {
      setCustomerId(prefilledCustomerId);
    } else if (customers.length > 0 && !customerId) {
      setCustomerId(customers[0].id);
    }
  }, [prefilledCustomerId, customers]);

  // When customer changes, auto-fill first vehicle
  useEffect(() => {
    const cust = customers.find((c) => c.id === customerId);
    if (cust && cust.vehicles.length > 0) {
      const v = cust.vehicles[0];
      setPlateNumber(v.plateNumber);
      setMake(v.make);
      setModel(v.model);
      setYear(String(v.year));
      setColor(v.color);
    }
  }, [customerId, customers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;

    const vehicle: Vehicle = {
      plateNumber: plateNumber || 'TBD-0000',
      make: make || 'Custom',
      model: model || 'Model',
      year: Number(year) || 2022,
      color: color || 'Standard',
      type: 'Car'
    };

    const assignedStaffMembers = staff.filter((s) => selectedStaffIds.includes(s.id));
    const laborEstimate = quotedAmount * 0.35;
    const estMaterial = quotedAmount * 0.22;

    const newJob = createJob({
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      vehicle,
      serviceType,
      requestedWork,
      specialInstructions,
      quotedAmount: Number(quotedAmount),
      depositPaid: Number(depositPaid),
      balanceDue: Number(quotedAmount) - Number(depositPaid),
      assignedStaff: assignedStaffMembers,
      status: 'In Progress',
      priority,
      startDate,
      expectedCompletionDate,
      estimatedMaterialCost: estMaterial,
      laborCostEstimate: laborEstimate,
      targetMarginPercentage: Math.round(((quotedAmount - (estMaterial + laborEstimate)) / quotedAmount) * 100),
      bayNumber
    });

    setIsCreateJobOpen(false);
    setPrefilledCustomerId(undefined);
    setSelectedJobId(newJob.id);
  };

  const toggleStaff = (id: string) => {
    if (selectedStaffIds.includes(id)) {
      if (selectedStaffIds.length > 1) {
        setSelectedStaffIds(selectedStaffIds.filter((sid) => sid !== id));
      }
    } else {
      setSelectedStaffIds([...selectedStaffIds, id]);
    }
  };

  return (
    <Modal
      isOpen={isCreateJobOpen}
      onClose={() => {
        setIsCreateJobOpen(false);
        setPrefilledCustomerId(undefined);
      }}
      title="Create New Job Order / Work Ticket"
      subtitle="Issue a new automotive paint, wrap, or detailing work order"
      maxWidth="3xl"
      actions={
        <>
          <button
            type="button"
            onClick={() => setIsCreateJobOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canCreateJob}
            className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs ${
              canCreateJob ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-400 cursor-not-allowed'
            }`}
          >
            Create & Assign to Bay
          </button>
        </>
      }
    >
      {!canCreateJob && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2 font-medium">
          <span>⚠️ <strong>Bay Intake Locked:</strong> Required seat is <strong>counter</strong> (or Service Advisor / Managing Director). Switch acting-as seat to proceed.</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer & Service Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Fleet *</label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type}) — {c.phone}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Service Type *</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as ServiceType)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="Full Body Repaint">Full Body Repaint</option>
              <option value="Vinyl Wrap Installation">Vinyl Wrap Installation</option>
              <option value="Ceramic & Detailing">Ceramic & Detailing Package</option>
              <option value="Panel Repaint">Panel & Spot Repaint</option>
              <option value="PPF Protection Film">PPF Paint Protection Film</option>
              <option value="Custom Paint">Custom Candy/Pearl Paint (Jetski / Marine)</option>
              <option value="Caliper & Wheel Custom">Caliper & Wheel Custom Painting</option>
            </select>
          </div>
        </div>

        {/* Vehicle Information */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Vehicle / Asset Info
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Plate Number</label>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                placeholder="AB1-8842"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-blue-600 font-mono font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Make</label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="Toyota / Audi"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Prado TX / Supra"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Color / Finish</label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Pearl White"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Scope of Work */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Requested Scope of Work *</label>
          <textarea
            required
            rows={2}
            value={requestedWork}
            onChange={(e) => setRequestedWork(e.target.value)}
            placeholder="Detailed description of paint preparation, disassembly, layers of clearcoat, wrap coverage..."
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Financials & Quotes (MVR) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Quoted Price (MVR) *</label>
            <input
              type="number"
              required
              min="0"
              value={quotedAmount}
              onChange={(e) => setQuotedAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Advance Deposit Received (MVR)</label>
            <input
              type="number"
              min="0"
              value={depositPaid}
              onChange={(e) => setDepositPaid(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-emerald-600 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Bay & Priority & Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assigned Garage Bay</label>
            <select
              value={bayNumber}
              onChange={(e) => setBayNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
            >
              <option value="Spray Booth Bay 1 (Bake Oven)">Spray Booth Bay 1 (Bake Oven)</option>
              <option value="Clean Wrap Studio Bay 1">Clean Wrap Studio Bay 1</option>
              <option value="Detailing Bay A (LED Tunnel)">Detailing Bay A (LED Tunnel)</option>
              <option value="Prep Bay 2 (Sanding)">Prep Bay 2 (Sanding)</option>
              <option value="Body Pull Bay 3">Body Pull Bay 3</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Job Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
            >
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent / Rush</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target Completion</label>
            <input
              type="date"
              required
              value={expectedCompletionDate}
              onChange={(e) => setExpectedCompletionDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Assigned Staff */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assign Technicians & Specialists</label>
          <div className="flex flex-wrap gap-2">
            {staff.map((s) => {
              const isSelected = selectedStaffIds.includes(s.id);
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => toggleStaff(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {s.name} ({s.role})
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
};
