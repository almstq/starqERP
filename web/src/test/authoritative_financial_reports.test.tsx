import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReportsView } from '../components/reports/ReportsView';
import { ERPProvider } from '../context/ERPContext';
import { AuthProvider } from '../context/AuthContext';

const renderReportsView = (entry = '/reports') => {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <ERPProvider>
          <ReportsView />
        </ERPProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('SERP-292: Authoritative Trial Balance & Balance Sheet Reporting', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the Standard 2-column Trial Balance with verified zero variance', () => {
    renderReportsView();

    expect(screen.getByTestId('reports-view')).toBeInTheDocument();
    expect(screen.getByTestId('trial-balance-section')).toBeInTheDocument();

    // Verify Trial Balance table headers
    expect(screen.getByText('Standard General Ledger Trial Balance')).toBeInTheDocument();
    expect(screen.getByText('Totals (Σ Debits = Σ Credits)')).toBeInTheDocument();

    // Verify Zero Variance Pass badge
    expect(screen.getByText(/0.00 Variance/i)).toBeInTheDocument();
    expect(screen.getByText(/Trial Balance Verified & In Balance/i)).toBeInTheDocument();
  });

  it('renders the Authoritative Balance Sheet with strict Assets = Liabilities + Equity integrity', () => {
    renderReportsView();

    expect(screen.getByTestId('balance-sheet-section')).toBeInTheDocument();
    expect(screen.getByText('Authoritative Balance Sheet')).toBeInTheDocument();
    expect(screen.getByText('Total Assets')).toBeInTheDocument();
    expect(screen.getByText('Total Liabilities')).toBeInTheDocument();
    expect(screen.getByText('Partner & Owner Equity')).toBeInTheDocument();
    expect(screen.getByText('Total Liabilities & Equity')).toBeInTheDocument();

    // Verify Balanced Badge
    expect(screen.getByText('Balanced (Δ MVR 0.00)')).toBeInTheDocument();
  });

  it('renders the requested persistent report section from a deep link', () => {
    renderReportsView('/reports?tab=analytics');

    expect(screen.getByText('Monthly Revenue vs Expenses (MVR)')).toBeInTheDocument();
    expect(screen.getByText('Labor & Service Value Breakdown')).toBeInTheDocument();

    expect(screen.queryByTestId('trial-balance-section')).not.toBeInTheDocument();
  });
});
