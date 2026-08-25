import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ERPProvider, useERP } from '../context/ERPContext';
import { CreateJobModal } from '../components/jobs/CreateJobModal';
import { WorkflowStepRail } from '../components/jobs/WorkflowStepRail';
import { JobsView } from '../components/jobs/JobsView';

// Helper component that opens CreateJobModal programmatically for testing
const TestModalHarness: React.FC = () => {
  const { setIsCreateJobOpen } = useERP();
  React.useEffect(() => {
    setIsCreateJobOpen(true);
  }, [setIsCreateJobOpen]);

  return <CreateJobModal />;
};

describe('SERP-197 / SERP-145: Jobs Runtime & CreateJobModal Permission Contract Regression', () => {
  it('mounts and renders JobsView without throwing TypeError: permissions.includes is not a function', () => {
    expect(() => {
      render(
        <MemoryRouter>
          <ERPProvider>
            <JobsView />
          </ERPProvider>
        </MemoryRouter>
      );
    }).not.toThrow();

    // Verify key elements render
    expect(screen.getByText(/Work Orders & Floor Pipeline/i)).toBeDefined();
    expect(screen.getByText(/Dynamic pipeline stages/i)).toBeDefined();
  });

  it('renders WorkflowStepRail for all 13 canonical steps without data-shape errors', () => {
    expect(() => {
      render(
        <MemoryRouter>
          <ERPProvider>
            <WorkflowStepRail currentStatus="Vehicle Intake & Inspection" />
          </ERPProvider>
        </MemoryRouter>
      );
    }).not.toThrow();

    expect(screen.getByText(/Work Order Journey \(13-Step Pipeline\)/i)).toBeDefined();
  });

  it('opens CreateJobModal and correctly renders action buttons with active admin credentials', () => {
    render(
      <MemoryRouter>
        <ERPProvider>
          <TestModalHarness />
        </ERPProvider>
      </MemoryRouter>
    );

    // Modal title should be present
    expect(screen.getByText(/Create New Job Order \/ Work Ticket/i)).toBeDefined();
    
    // Create & Assign to Bay button should be enabled for active admin
    const submitBtn = screen.getByText(/Create & Assign to Bay/i);
    expect(submitBtn).toBeDefined();
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
  });
});
