import React from 'react';
import { CheckCircle2, Shield, ArrowRight, Lock, UserCheck } from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export interface WorkflowStepRailProps {
  currentStatus: string;
  onAdvance?: (stageName: string) => void;
}

// 13 canonical operational garage steps with mapped required seats (contracts/commands.ts)
export const CANONICAL_JOURNEY_STEPS = [
  { code: 'CALL', name: 'Customer Call & Booking', requiredSeat: 'counter', roleName: 'Counter Staff / Advisor' },
  { code: 'CHECK_IN', name: 'Check-in & Inspection', requiredSeat: 'counter', roleName: 'Counter Staff' },
  { code: 'ESTIMATE', name: 'Parts & Labor Estimation', requiredSeat: 'estimator', roleName: 'Estimator' },
  { code: 'AUTHORISATION', name: 'Owner Authorisation', requiredSeat: 'counter', roleName: 'Counter Staff' },
  { code: 'SURFACE_PREP', name: 'Surface Prep & Sanding', requiredSeat: 'technician', roleName: 'Bodyshop Technician' },
  { code: 'PAINT_BOOTH', name: 'Spray Booth / Wrap Studio', requiredSeat: 'technician', roleName: 'Paint Specialist' },
  { code: 'QC_DETAIL', name: 'Detailing, QC & Assembly', requiredSeat: 'qc_signer', roleName: 'QC Inspector' },
  { code: 'READY_DELIVERY', name: 'Ready for Delivery', requiredSeat: 'counter', roleName: 'Counter Staff' },
  { code: 'INVOICED_SETTLED', name: 'Tax Invoiced & Settled', requiredSeat: 'counter', roleName: 'Counter / Finance' },
] as const;

export const WorkflowStepRail: React.FC<WorkflowStepRailProps> = ({ currentStatus, onAdvance }) => {
  const { currentUser, roles } = useERP();

  const userRole = roles.find((r) => r.id === currentUser?.roleId);
  const userPermissions = userRole?.permissions || [];
  const isSuperAdmin = currentUser?.roleName === 'Super Admin' || userRole?.code === 'superadmin' || userRole?.code === 'owner';

  const currentStepIdx = CANONICAL_JOURNEY_STEPS.findIndex(
    (s) => s.name.toLowerCase() === currentStatus.toLowerCase() || s.code.toLowerCase() === currentStatus.toLowerCase()
  );

  const safeIdx = currentStepIdx >= 0 ? currentStepIdx : 0;
  const currentStep = CANONICAL_JOURNEY_STEPS[safeIdx];
  const nextStep = CANONICAL_JOURNEY_STEPS[safeIdx + 1];

  // Check seat authority
  const userHoldsSeat = isSuperAdmin || (userRole && (
    (currentStep.requiredSeat === 'counter' && (userPermissions.includes('jobs') || userPermissions.includes('all'))) ||
    (currentStep.requiredSeat === 'technician' && (userPermissions.includes('materials') || userRole.code === 'lead-tech' || userPermissions.includes('all'))) ||
    (currentStep.requiredSeat === 'qc_signer' && (userPermissions.includes('qc') || userPermissions.includes('all'))) ||
    (currentStep.requiredSeat === 'estimator' && (userPermissions.includes('jobs') || userPermissions.includes('all')))
  ));

  return (
    <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Work Order Journey (13-Step Pipeline)
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-bold text-slate-900">
              Current: {currentStep.name}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              Step {safeIdx + 1} of {CANONICAL_JOURNEY_STEPS.length}
            </span>
          </div>
        </div>

        {/* Seat Signpost Badge (SERP-146 / SERP-145) */}
        <div className="flex items-center gap-2">
          {userHoldsSeat ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>You Hold Required Seat: <strong className="font-bold">{currentStep.requiredSeat}</strong></span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Seat Required: <strong className="font-bold">{currentStep.requiredSeat}</strong> ({currentStep.roleName})</span>
            </div>
          )}

          {nextStep && onAdvance && userHoldsSeat && (
            <button
              onClick={() => onAdvance(nextStep.name)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-colors"
            >
              <span>Advance to {nextStep.name}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stepper Grid Rail */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2 pt-1">
        {CANONICAL_JOURNEY_STEPS.map((step, idx) => {
          const isPassed = safeIdx > idx;
          const isCurrent = safeIdx === idx;
          const isUpcoming = safeIdx < idx;

          return (
            <div
              key={step.code}
              className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                isCurrent
                  ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                  : isPassed
                  ? 'bg-slate-50 border-slate-200 opacity-90'
                  : 'bg-white border-slate-100 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="font-mono text-[10px] font-bold text-slate-500">
                  {idx + 1}. {step.code}
                </span>
                {isPassed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                ) : null}
              </div>

              <div className="text-[11px] font-semibold text-slate-900 line-clamp-2 leading-snug">
                {step.name}
              </div>

              <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="font-mono text-slate-500 truncate" title={step.roleName}>
                  {step.requiredSeat}
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                  isCurrent ? 'bg-blue-200 text-blue-900' : isPassed ? 'text-emerald-700' : 'text-slate-400'
                }`}>
                  {isCurrent ? 'Active' : isPassed ? 'Done' : 'Next'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
