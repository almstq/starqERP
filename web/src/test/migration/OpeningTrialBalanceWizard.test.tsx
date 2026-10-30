import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { OpeningTrialBalanceWizard } from '../../components/migration/OpeningTrialBalanceWizard';
import { ERPProvider } from '../../context/ERPContext';

describe('SERP-306: OpeningTrialBalanceWizard Component', () => {
  it('renders modal when isOpen is true', () => {
    render(
      <ERPProvider>
        <OpeningTrialBalanceWizard isOpen={true} onClose={() => {}} />
      </ERPProvider>
    );

    expect(screen.getByText(/Opening Trial Balance & Financial Balances/i)).toBeInTheDocument();
    expect(screen.getByText(/Download Template/i)).toBeInTheDocument();
    expect(screen.getByText(/Click to browse or drag and drop your opening balances CSV/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ERPProvider>
        <OpeningTrialBalanceWizard isOpen={false} onClose={() => {}} />
      </ERPProvider>
    );

    expect(screen.queryByText(/Opening Trial Balance & Financial Balances/i)).not.toBeInTheDocument();
  });
});
