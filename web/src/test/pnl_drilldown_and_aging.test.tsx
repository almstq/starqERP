import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReportsView } from '../components/reports/ReportsView';
import { ERPProvider } from '../context/ERPContext';
import { AuthProvider } from '../context/AuthContext';

const renderReportsView = () => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ERPProvider>
          <ReportsView />
        </ERPProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('SERP-293: Authoritative P&L Drilldowns & AR/AP Aging Matrices', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders P&L statement and opens Drilldown Drawer on line click', async () => {
    renderReportsView();

    expect(screen.getByTestId('reports-view')).toBeInTheDocument();
    expect(screen.getByTestId('profit-and-loss-section')).toBeInTheDocument();

    // Verify P&L section headers & items
    expect(screen.getByText('Statement of Profit & Loss (P&L)')).toBeInTheDocument();
    expect(screen.getByText('Operating Revenue')).toBeInTheDocument();
    expect(screen.getByText('Less: Cost of Goods Sold (COGS)')).toBeInTheDocument();
    expect(screen.getByText('Gross Operating Profit')).toBeInTheDocument();
    expect(screen.getByText('Net Operating Income')).toBeInTheDocument();

    // Click Operating Revenue line item
    const revenueLine = screen.getByTestId('pnl-line-revenue');
    fireEvent.click(revenueLine);

    // Verify Drilldown Drawer opens
    expect(screen.getByTestId('pnl-drilldown-drawer')).toBeInTheDocument();
    expect(screen.getByText('Operating & Service Revenue')).toBeInTheDocument();
    expect(screen.getByText(/Itemized General Ledger journal postings/i)).toBeInTheDocument();
    expect(screen.getByText('Total Credits')).toBeInTheDocument();

    // Close Drawer
    const closeBtn = screen.getByRole('button', { name: /Close Drilldown/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('pnl-drilldown-drawer')).not.toBeInTheDocument();
    });
  });

  it('switches to AR / AP Aging tab and displays aging matrices and bucket breakdowns', () => {
    renderReportsView();

    // Switch to AR / AP Aging tab
    const agingTab = screen.getByRole('button', { name: /AR \/ AP Aging/i });
    fireEvent.click(agingTab);

    // Verify Aging Matrices View rendered
    expect(screen.getByTestId('aging-matrices-view')).toBeInTheDocument();
    expect(screen.getByTestId('ar-aging-table')).toBeInTheDocument();
    expect(screen.getByText('Accounts Receivable Aging Matrix (Customer Debtors)')).toBeInTheDocument();
    expect(screen.getByText('Total Receivables (AR)')).toBeInTheDocument();
    expect(screen.getByText('Total Payables (AP)')).toBeInTheDocument();

    // Switch to AP tab
    const apTabBtn = screen.getByTestId('ap-tab-btn');
    fireEvent.click(apTabBtn);

    expect(screen.getByTestId('ap-aging-table')).toBeInTheDocument();
    expect(screen.getByText('Accounts Payable Aging Matrix (Supplier Creditors)')).toBeInTheDocument();
  });
});
