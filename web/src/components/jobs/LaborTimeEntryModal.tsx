import React, { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { JobOrder, StaffMember } from '../../types/erp';
import { Button, Input, Select, Modal } from '../ui';

interface LaborTimeEntryModalProps {
  job: JobOrder;
  isOpen: boolean;
  onClose: () => void;
}

export const LaborTimeEntryModal: React.FC<LaborTimeEntryModalProps> = ({ job, isOpen, onClose }) => {
  const { staff, addLaborEntry, formatMVR } = useERP();

  // Technicians available to clock against this job card: the technicians
  // already assigned to the job, supplemented by org staff who carry an
  // hourly cost rate. Deduplicate by id so a technician is only offered once.
  const technicians = useMemo<StaffMember[]>(() => {
    const map = new Map<string, StaffMember>();
    [...job.assignedStaff, ...staff].forEach((s) => {
      if (!map.has(s.id)) map.set(s.id, s);
    });
    return Array.from(map.values()).filter((s) => (s.hourlyCostRateMvr ?? 0) > 0);
  }, [job.assignedStaff, staff]);

  const firstTech = technicians[0];
  const [technicianId, setTechnicianId] = useState(firstTech?.id ?? '');
  const [taskDescription, setTaskDescription] = useState('');
  const [hours, setHours] = useState('1');

  // When the job/technician list changes (modal reopened on a new job), reset
  // the selected technician to the first available.
  React.useEffect(() => {
    if (isOpen) {
      setTechnicianId(firstTech?.id ?? '');
      setTaskDescription('');
      setHours('1');
    }
  }, [isOpen, firstTech?.id]);

  const selectedTech = technicians.find((t) => t.id === technicianId);
  const rate = selectedTech?.hourlyCostRateMvr ?? 0;
  const hoursNum = Number(hours);
  const totalCost = Number.isFinite(hoursNum) && hoursNum > 0 ? Math.round(hoursNum * rate) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTech || !taskDescription.trim() || !(Number(hours) > 0)) return;
    addLaborEntry({
      jobId: job.id,
      technicianId: selectedTech.id,
      technicianName: selectedTech.name,
      hourlyCostRateMvr: selectedTech.hourlyCostRateMvr ?? 0,
      taskDescription: taskDescription.trim(),
      hoursWorked: Number(hours),
    });
    setTaskDescription('');
    setHours('1');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Clock Labor Hours"
      subtitle={`${job.jobId} • ${job.customerName}`}
      maxWidth="md"
      footer={
        <>
          <Button variant="text" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="filled" size="sm" type="submit" form="labor-entry-form" disabled={!selectedTech || !totalCost}>
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {totalCost > 0 ? `Confirm — ${formatMVR(totalCost)}` : 'Confirm'}
            </span>
          </Button>
        </>
      }
    >
      <form id="labor-entry-form" onSubmit={handleSubmit} className="space-y-4 min-w-0">
        {technicians.length === 0 ? (
          <div className="text-center py-6 text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            No technician with an hourly cost rate is assigned to this job card yet. Assign a technician with an
            hourly rate to clock labor hours.
          </div>
        ) : (
          <>
            <Select
              label="Technician"
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
            >
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.role} ({formatMVR(t.hourlyCostRateMvr ?? 0)}/hr)
                </option>
              ))}
            </Select>

            <Input
              label="Task Description *"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="e.g. Rear quarter panel prep & primer"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <div>
                <Input
                  label="Hours Worked *"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <div className="flex items-end pb-1">
                <div className="flex-1 rounded-[var(--md-sys-shape-corner-small)] px-3 py-2 text-xs min-w-0"
                  style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)', color: 'var(--md-sys-color-on-surface)' }}
                >
                  <div className="text-[var(--md-sys-color-on-surface-variant)]">Hourly Rate</div>
                  <div className="font-semibold mono-num">{formatMVR(rate)}/hr</div>
                </div>
              </div>
            </div>

            <div
              className="flex items-center justify-between rounded-[var(--md-sys-shape-corner-medium)] px-3.5 py-3 min-w-0"
              style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}
            >
              <span className="text-xs font-semibold">Selected Labor Cost</span>
              <span className="text-sm font-bold mono-num">{formatMVR(totalCost)}</span>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};
