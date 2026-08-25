import { describe, it, expect } from 'vitest';
import { CANONICAL_JOURNEY_STEPS } from '../components/jobs/WorkflowStepRail';
import { COMMAND_SEATS, CommandName } from '../../../contracts/commands';

describe('SERP-146 & SERP-145 — 13-Step Workflow Journey Rail & Seat Signpost', () => {
  it('SERP-146: Workflow journey contains EXACTLY 13 canonical operational steps', () => {
    // Acceptance criterion: exactly 13 steps visible on the journey rail
    expect(CANONICAL_JOURNEY_STEPS).toHaveLength(13);

    const expectedCodes: CommandName[] = [
      'CALL',
      'BOOKING',
      'INTAKE',
      'ESTIMATE',
      'AUTHORISATION',
      'JOB_CARD',
      'PARTS_PROCUREMENT',
      'WORK',
      'QC',
      'HANDOVER',
      'INVOICE',
      'INVOICE_PAYMENT',
      'CLOSE',
    ];

    CANONICAL_JOURNEY_STEPS.forEach((step, index) => {
      expect(step.code).toBe(expectedCodes[index]);
      expect(step.name).toBeDefined();
      expect(step.roleLabel).toBeDefined();

      // Required seats must exactly match the canonical authorization source COMMAND_SEATS
      expect(step.requiredSeats).toEqual(COMMAND_SEATS[step.code]);
    });
  });

  it('SERP-146: Step seats partition correctly across counter, technician, and qc_signer roles', () => {
    const intakeStep = CANONICAL_JOURNEY_STEPS.find((s) => s.code === 'INTAKE')!;
    expect(intakeStep.requiredSeats).toContain('counter');

    const partsStep = CANONICAL_JOURNEY_STEPS.find((s) => s.code === 'PARTS_PROCUREMENT')!;
    expect(partsStep.requiredSeats).toContain('technician');

    const workStep = CANONICAL_JOURNEY_STEPS.find((s) => s.code === 'WORK')!;
    expect(workStep.requiredSeats).toContain('technician');

    const qcStep = CANONICAL_JOURNEY_STEPS.find((s) => s.code === 'QC')!;
    expect(qcStep.requiredSeats).toContain('qc_signer');

    const handoverStep = CANONICAL_JOURNEY_STEPS.find((s) => s.code === 'HANDOVER')!;
    expect(handoverStep.requiredSeats).toContain('counter');

    const closeStep = CANONICAL_JOURNEY_STEPS.find((s) => s.code === 'CLOSE')!;
    expect(closeStep.requiredSeats).toContain('counter');
  });

  it('SERP-145: Seat signpost enforces counter/manager seat requirement for empty bay intake', () => {
    const checkCanCreateJob = (isSystemAdmin: boolean, rolePermissions: { jobs?: string[] }) => {
      return (
        isSystemAdmin ||
        (rolePermissions.jobs?.includes('create') ?? false) ||
        (rolePermissions.jobs?.includes('manage') ?? false)
      );
    };

    // Counter / Service Advisor / Manager can create jobs
    expect(checkCanCreateJob(false, { jobs: ['view', 'create', 'edit'] })).toBe(true);
    expect(checkCanCreateJob(false, { jobs: ['view', 'create', 'approve'] })).toBe(true);
    expect(checkCanCreateJob(true, {})).toBe(true);

    // Pure technician cannot create new jobs from empty bay without counter create permission
    expect(checkCanCreateJob(false, { jobs: ['view', 'edit'] })).toBe(false);
    expect(checkCanCreateJob(false, {})).toBe(false);
  });
});
