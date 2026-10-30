import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { OpeningStockBulkImportModal } from '../../components/migration/OpeningStockBulkImportModal';
import { ERPProvider } from '../../context/ERPContext';

describe('SERP-305: OpeningStockBulkImportModal Component', () => {
  it('renders modal when isOpen is true', () => {
    render(
      <ERPProvider>
        <OpeningStockBulkImportModal
          isOpen={true}
          onClose={() => {}}
        />
      </ERPProvider>
    );

    expect(screen.getByText(/Bulk Import Opening Stock & Valuation/i)).toBeInTheDocument();
    expect(screen.getByText(/Download Template/i)).toBeInTheDocument();
    expect(screen.getByText(/Click to browse or drag and drop your opening stock count CSV/i)).toBeInTheDocument();
  });
});
