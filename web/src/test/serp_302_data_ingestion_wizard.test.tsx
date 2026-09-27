import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataIngestionWizard } from '../components/ingestion/DataIngestionWizard';

describe('SERP-302: Data Ingestion Wizard Component', () => {
  it('renders target selector and template download affordance in Step 1', () => {
    render(<DataIngestionWizard initialTarget="contacts" />);

    expect(screen.getByText('Universal Data Ingestion & Validator')).toBeInTheDocument();
    expect(screen.getByText('Customers & Suppliers')).toBeInTheDocument();
    expect(screen.getByText('Product Catalogue')).toBeInTheDocument();
    expect(screen.getByText('Opening Balances')).toBeInTheDocument();
    expect(screen.getByText('Download Sample Customers & Suppliers CSV Template')).toBeInTheDocument();
  });

  it('progresses to Step 2 upon CSV file upload with auto-mapped columns', async () => {
    render(<DataIngestionWizard initialTarget="contacts" />);

    const sampleCsv = `Client Name,Mobile,Email,GST No\nAhmed Marine,7991234,ahmed@marine.mv,1023456\nVilla Trading,7995555,info@villa.mv,1099887`;
    const file = new File([sampleCsv], 'contacts.csv', { type: 'text/csv' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Spreadsheet Column Header')).toBeInTheDocument();
    });

    expect(screen.getByText('Client Name')).toBeInTheDocument();
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.getByText('GST No')).toBeInTheDocument();
    expect(screen.getByText('Proceed to Validation')).toBeInTheDocument();
  });

  it('runs validation in Step 3 and executes atomic batch commit in Step 4', async () => {
    const mockCommitter = vi.fn().mockResolvedValue({ ok: true, insertedCount: 2 });
    render(<DataIngestionWizard initialTarget="contacts" committer={mockCommitter} />);

    const sampleCsv = `display_name,phone,email,tax_identifier\nIsland Express,7991234,island@exp.mv,1023456\nMale Retail,7995555,male@retail.mv,1099887`;
    const file = new File([sampleCsv], 'valid_contacts.csv', { type: 'text/csv' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Proceed to Validation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Proceed to Validation'));

    await waitFor(() => {
      expect(screen.getByText('Valid Ready to Commit')).toBeInTheDocument();
    });

    expect(screen.getByText('Commit Import Batch')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Commit Import Batch'));

    await waitFor(() => {
      expect(screen.getByText('Import Completed Successfully')).toBeInTheDocument();
    });

    expect(mockCommitter).toHaveBeenCalledTimes(1);
    expect(mockCommitter).toHaveBeenCalledWith('contacts', expect.any(Array), expect.any(String), false);
  });

  it('displays validation errors and blocks commit in all_or_nothing mode if errors exist', async () => {
    render(<DataIngestionWizard initialTarget="products" />);

    // Row 2 is missing SKU and Row 3 has duplicate SKU
    const invalidCsv = `sku,name,price\nSKU-1,Item One,10.00\n,Item Two,20.00\nSKU-1,Duplicate Item One,30.00`;
    const file = new File([invalidCsv], 'products_with_errors.csv', { type: 'text/csv' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Proceed to Validation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Proceed to Validation'));

    await waitFor(() => {
      expect(screen.getByText('Error Rows')).toBeInTheDocument();
    });

    // Commit button should be disabled in all_or_nothing mode when errors exist
    const commitBtn = screen.getByText('Commit Import Batch');
    expect(commitBtn.closest('button')).toBeDisabled();
    expect(screen.getByText('Download Error Report (.csv)')).toBeInTheDocument();
  });
});
