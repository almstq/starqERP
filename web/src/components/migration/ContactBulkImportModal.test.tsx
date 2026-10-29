import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContactBulkImportModal } from './ContactBulkImportModal';
import { ERPProvider } from '../../context/ERPContext';

describe('SERP-303: ContactBulkImportModal Component', () => {
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
});
