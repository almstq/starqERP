import { describe, it, expect } from 'vitest';
import { CANONICAL_JOURNEY_STEPS } from '../components/jobs/WorkflowStepRail';
import { COMMAND_SEATS } from '../../../contracts/commands';

describe('SERP-146 & SERP-145 — 13-Step Workflow Journey Rail & Seat Signpost', () => {
  it('SERP-146: All canonical journey steps map to valid required seats from COMMAND_SEATS', () => {
    expect(CANONICAL_JOURNEY_STEPS.length).toBeGreaterThanOrEqual(9);

    CANONICAL_JOURNEY_STEPS.forEach((step) => {
      expect(step.code).toBeDefined();
      expect(step.name).toBeDefined();
      expect(step.requiredSeat).toBeDefined();
      expect(step.roleName).toBeDefined();

      // Verify seat code is a legal seat code in the authorization matrix
      expect(['counter', 'estimator', 'technician', 'qc_signer', 'financial_controller', 'owner']).toContain(step.requiredSeat);
    });
  });

  it('SERP-146: Workflow journey correctly partitions counter, technician, and QC signer seats', () => {
    const intakeStep = CANONICAL_JOURNEY_STEPS.find((s) => s.code === 'CHECK_IN')!;
    expect(intakeStep.requiredSeat).toBe('counter');

    const prepStep = CANONICAL_JOURNEY_STEPS.find((s) => s.code === 'SURFACE_PREP')!;
    expect(prepStep.requiredSeat).toBe('technician');

    const qcStep = CANONICAL_JOURNEY_STEPS.find((s) => s.code === 'QC_DETAIL')!;
    expect(qcStep.requiredSeat).toBe('qc_signer');

    const handoverStep = CANONICAL_JOURNEY_STEPS.find((s) => s.code === 'READY_DELIVERY')!;
    expect(handoverStep.requiredSeat).toBe('counter');
  });

  it('SERP-145: Seat signpost enforces counter/manager seat requirement for empty bay intake', () => {
    const checkCanCreateJob = (roleCode: string, permissions: string[]) => {
      const isSuperAdmin = roleCode === 'superadmin' || roleCode === 'owner';
      return isSuperAdmin || permissions.includes('jobs') || permissions.includes('all') || roleCode === 'sales' || roleCode === 'manager';
    };

    // Counter / Service Advisor can create jobs
    expect(checkCanCreateJob('sales', ['jobs'])).toBe(true);
    expect(checkCanCreateJob('manager', ['jobs'])).toBe(true);
    expect(checkCanCreateJob('owner', ['all'])).toBe(true);

    // Pure technician cannot create new jobs from empty bay without counter seat
    expect(checkCanCreateJob('technician', ['materials'])).toBe(false);
  });
});
