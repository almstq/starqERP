import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FavaraPaymentModal } from '../components/invoices/FavaraPaymentModal';
import { ERPProvider } from '../context/ERPContext';
import { AuthProvider } from '../context/AuthContext';

describe('SERP-324: MMA Favara Instant QR Payment Interface', () => {
  const sampleInvoice = {
    id: 'inv-9921',
    invoiceNumber: 'INV-2026-089',
    customerName: 'Island Express Ferry',
    totalAmount: 14500,
    currency: 'MVR' as const,
    status: 'unpaid',
  };

  it('renders official MMA Favara QR modal, amount, and merchant details', () => {
    render(
      <AuthProvider>
        <ERPProvider>
          <FavaraPaymentModal
            isOpen={true}
            onClose={() => {}}
            invoice={sampleInvoice}
          />
        </ERPProvider>
      </AuthProvider>
    );

    expect(screen.getByText('MMA Favara Instant Pay')).toBeDefined();
    expect(screen.getByText('MVR 14500.00')).toBeDefined();
    expect(screen.getByText('Invoice #INV-2026-089')).toBeDefined();
    expect(screen.getByText(/7701192837101@BML/)).toBeDefined();
    expect(screen.getByText('Copy EMV Payload')).toBeDefined();
  });

  it('handles instant payment simulation and triggers callback', () => {
    vi.useFakeTimers();
    const onPaymentMock = vi.fn();
    window.alert = vi.fn();

    render(
      <AuthProvider>
        <ERPProvider>
          <FavaraPaymentModal
            isOpen={true}
            onClose={() => {}}
            invoice={sampleInvoice}
            onPaymentReceived={onPaymentMock}
          />
        </ERPProvider>
      </AuthProvider>
    );

    const simBtn = screen.getByText('Simulate Settlement');
    fireEvent.click(simBtn);

    vi.advanceTimersByTime(1100);

    expect(onPaymentMock).toHaveBeenCalledWith('inv-9921', 14500);
    vi.useRealTimers();
  });
});
