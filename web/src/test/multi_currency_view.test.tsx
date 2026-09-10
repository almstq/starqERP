import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiCurrencyView } from '../components/accounts/MultiCurrencyView';
import { ERPProvider } from '../context/ERPContext';
import { AuthProvider } from '../context/AuthContext';

describe('SERP-318: Multi-Currency & MMA Exchange Rates Interface', () => {
  it('renders MMA rates strip, settlement simulator, and revaluation panel', () => {
    render(
      <AuthProvider>
        <ERPProvider>
          <MultiCurrencyView />
        </ERPProvider>
      </AuthProvider>
    );

    expect(screen.getByText('Multi-Currency & MMA Exchange Rates')).toBeDefined();
    expect(screen.getByText('Foreign Currency Settlement Simulator')).toBeDefined();
    expect(screen.getByText('Foreign Currency Balance Revaluation')).toBeDefined();
    expect(screen.getAllByText(/15\.42/).length).toBeGreaterThan(0); // USD rate (and sample-data copy)
    expect(screen.getAllByText('DEMO / SAMPLE DATA').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/simulated placeholders until a live MMA rate source and live bank balances are integrated/i)
    ).toBeDefined();
    expect(
      screen.getByText(/USD 25,000 and book MVR 385,500 are simulated sample balances until live source integration exists/i)
    ).toBeDefined();
  });

  it('records foreign settlement and dispatches Realized FX double-entry journal', () => {
    const onAddJournalMock = vi.fn();
    window.alert = vi.fn();

    render(
      <AuthProvider>
        <ERPProvider>
          <MultiCurrencyView onAddJournalEntry={onAddJournalMock} />
        </ERPProvider>
      </AuthProvider>
    );

    const recordBtn = screen.getByText('Record Settlement & Post FX Journal');
    fireEvent.click(recordBtn);

    expect(onAddJournalMock).toHaveBeenCalled();
    const createdJe = onAddJournalMock.mock.calls[0][0];
    expect(createdJe.isBalanced).toBe(true);
    expect(createdJe.source).toBe('FX_REALIZATION');
  });
});
