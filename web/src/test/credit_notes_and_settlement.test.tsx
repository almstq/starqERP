import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InvoicesView } from '../components/invoices/InvoicesView';
import { ERPProvider } from '../context/ERPContext';
import { AuthProvider } from '../context/AuthContext';

const renderInvoicesView = () => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ERPProvider>
          <InvoicesView />
        </ERPProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('SERP-294: Credit Notes & Settlement Allocation UI', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders InvoicesView with Credit Notes and Settlement actions', () => {
    renderInvoicesView();

    expect(screen.getByTestId('invoices-view')).toBeInTheDocument();
    expect(screen.getByTestId('open-credit-note-modal-btn')).toBeInTheDocument();
    expect(screen.getByTestId('open-settlement-modal-btn')).toBeInTheDocument();

    expect(screen.getByText('Commercial Invoices & Credit Notes')).toBeInTheDocument();
    expect(screen.getByText('Total Credit Notes Issued')).toBeInTheDocument();
    expect(screen.getByText('Unallocated Customer Funds')).toBeInTheDocument();
  });

  it('opens Credit Note Modal and allows issuing a credit note', async () => {
    renderInvoicesView();

    const openBtn = screen.getByTestId('open-credit-note-modal-btn');
    fireEvent.click(openBtn);

    expect(screen.getByTestId('credit-note-modal')).toBeInTheDocument();
    expect(screen.getByText('Issue Authoritative Credit Note')).toBeInTheDocument();
    expect(screen.getByText(/Automatic Accounting Effect:/i)).toBeInTheDocument();

    // Close modal
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('credit-note-modal')).not.toBeInTheDocument();
    });
  });

  it('switches between Invoices, Credit Notes & Advances, and Settlement Allocations tabs', () => {
    renderInvoicesView();

    // Switch to Credit Notes & Advances tab
    const creditsTab = screen.getByTestId('credits-advances-tab-btn');
    fireEvent.click(creditsTab);

    expect(screen.getByTestId('credits-advances-table')).toBeInTheDocument();
    expect(screen.getByText('Credit Notes & Customer Advance Deposits')).toBeInTheDocument();

    // Switch to Settlement Allocations tab
    const allocTab = screen.getByTestId('allocations-tab-btn');
    fireEvent.click(allocTab);

    expect(screen.getByTestId('allocations-table')).toBeInTheDocument();
    expect(screen.getByText('Settlement Allocations Ledger')).toBeInTheDocument();
  });
});
