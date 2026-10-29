import { beforeEach, describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContactBulkImportModal } from '../../components/migration/ContactBulkImportModal';
import { ERPProvider, useERP } from '../../context/ERPContext';
import * as apiGateway from '../../services/apiGateway';

const CustomerIdProbe = () => {
  const { customers } = useERP();
  return <output data-testid="persisted-customer-id">{customers[0]?.id ?? ''}</output>;
};

const SupplierIdProbe = () => {
  const { suppliers } = useERP();
  return <output data-testid="persisted-supplier-id">{suppliers[0]?.id ?? ''}</output>;
};

describe('SERP-303: ContactBulkImportModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiGateway, 'apiGet').mockResolvedValue({ ok: true, customers: [], suppliers: [] } as any);
  });

  it('renders modal when isOpen is true', () => {
    render(
      <ERPProvider>
        <ContactBulkImportModal
          isOpen={true}
          onClose={() => {}}
          defaultKind="customer"
        />
      </ERPProvider>
    );

    expect(screen.getByText(/Bulk Import Customers/i)).toBeInTheDocument();
    expect(screen.getByText(/Download Template/i)).toBeInTheDocument();
    expect(screen.getByText(/Click to browse or drag and drop your CSV/i)).toBeInTheDocument();
  });

  it('allows switching between customer and supplier import types', () => {
    render(
      <ERPProvider>
        <ContactBulkImportModal
          isOpen={true}
          onClose={() => {}}
          defaultKind="customer"
        />
      </ERPProvider>
    );

    const suppliersBtn = screen.getByRole('button', { name: /Suppliers/i });
    fireEvent.click(suppliersBtn);

    expect(screen.getByText(/Bulk Import Suppliers/i)).toBeInTheDocument();
  });

  it('does not count rows as imported until the backend confirms persistence', async () => {
    const dispatch = vi.spyOn(apiGateway, 'dispatchCommand').mockRejectedValue(new apiGateway.ApiError(500, 'persistence_failed'));
    const { container } = render(
      <ERPProvider>
        <ContactBulkImportModal isOpen onClose={() => {}} defaultKind="customer" />
      </ERPProvider>
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: {
        files: [new File(['Name,Phone,Email\nNorthwind,+960 7781234,\n'], 'contacts.csv', { type: 'text/csv' })],
      },
    });

    await screen.findByText('Valid Records Ready to Import (1)');
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Import/ }));

    expect(await screen.findByText('No records were imported')).toBeInTheDocument();
    expect(screen.getByTestId('import-imported-count')).toHaveTextContent('0');
    expect(screen.getByTestId('import-skipped-count')).toHaveTextContent('1');
    expect(screen.getByText(/persistence_failed/)).toBeInTheDocument();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({ command: 'CUSTOMER', payload: { email: '' } });
  });

  it('waits for a positive API result before presenting the persisted count', async () => {
    let resolveCommand: ((value: { ok: boolean; customer: { customer_id: string } }) => void) | undefined;
    vi.spyOn(apiGateway, 'dispatchCommand').mockImplementation(() => new Promise((resolve) => {
      resolveCommand = resolve as (value: { ok: boolean }) => void;
    }) as any);
    const { container } = render(
      <ERPProvider>
        <CustomerIdProbe />
        <ContactBulkImportModal isOpen onClose={() => {}} defaultKind="customer" />
      </ERPProvider>
    );

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['Name,Phone,Email\nNorthwind,+960 7781234,\n'], 'contacts.csv', { type: 'text/csv' })] },
    });
    await screen.findByText('Valid Records Ready to Import (1)');
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Import/ }));

    expect(await screen.findByText('Importing Master Records...')).toBeInTheDocument();
    expect(screen.queryByText('Import persistence confirmed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('import-imported-count')).not.toBeInTheDocument();

    resolveCommand?.({ ok: true, customer: { customer_id: 'server-customer-uuid' } });
    expect(await screen.findByText('Import persistence confirmed')).toBeInTheDocument();
    expect(screen.getByTestId('import-imported-count')).toHaveTextContent('1');
    expect(screen.getByTestId('persisted-customer-id')).toHaveTextContent('server-customer-uuid');
  });

  it('uses the backend supplier ID after confirmed persistence', async () => {
    vi.spyOn(apiGateway, 'dispatchCommand').mockResolvedValue({
      ok: true,
      supplier: { id: 'server-supplier-uuid' },
    } as any);
    const { container } = render(
      <ERPProvider>
        <SupplierIdProbe />
        <ContactBulkImportModal isOpen onClose={() => {}} defaultKind="customer" />
      </ERPProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Suppliers/i }));
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['Supplier Name,Phone Number,Email Address\nNorthwind,+960 7781234,\n'], 'suppliers.csv', { type: 'text/csv' })] },
    });
    await screen.findByText('Valid Records Ready to Import (1)');
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Import/ }));

    expect(await screen.findByText('Import persistence confirmed')).toBeInTheDocument();
    expect(screen.getByTestId('persisted-supplier-id')).toHaveTextContent('server-supplier-uuid');
  });
});
