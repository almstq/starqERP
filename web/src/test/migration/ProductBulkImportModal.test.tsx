import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProductBulkImportModal } from '../../components/migration/ProductBulkImportModal';
import { ERPProvider } from '../../context/ERPContext';

describe('SERP-304: ProductBulkImportModal Component', () => {
  it('renders modal when isOpen is true', () => {
    render(
      <ERPProvider>
        <ProductBulkImportModal
          isOpen={true}
          onClose={() => {}}
        />
      </ERPProvider>
    );

    expect(screen.getByText(/Bulk Import Product Catalog & SKUs/i)).toBeInTheDocument();
    expect(screen.getByText(/Download Template/i)).toBeInTheDocument();
    expect(screen.getByText(/Click to browse or drag and drop your product catalog CSV/i)).toBeInTheDocument();
  });
});
