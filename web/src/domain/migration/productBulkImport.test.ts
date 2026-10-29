import { describe, it, expect } from 'vitest';
import {
  detectProductHeaderMapping,
  validateProductRows,
  generateProductTemplateCsv,
  executeProductImport,
} from './productBulkImport';
import { parseDelimitedText } from './contactBulkImport';

describe('SERP-304: Product Catalog & SKU Master Data Bulk Import Domain', () => {
  describe('Header Mapping', () => {
    it('accurately identifies SKU, name, kind, prices and accounts', () => {
      const headers = ['SKU', 'Product Name', 'Kind', 'Selling Price (MVR)', 'Cost Price', 'Category'];
      const mapping = detectProductHeaderMapping(headers);

      expect(mapping.skuCol).toBe(0);
      expect(mapping.nameCol).toBe(1);
      expect(mapping.kindCol).toBe(2);
      expect(mapping.sellingPriceCol).toBe(3);
      expect(mapping.costPriceCol).toBe(4);
      expect(mapping.categoryCol).toBe(5);
    });
  });

  describe('Validation & Parsing', () => {
    it('validates a correct product list', () => {
      const headers = ['SKU', 'Product Name', 'Kind', 'Price', 'Cost', 'Category', 'Quantity'];
      const rows = [
        ['OIL-001', 'Synthetic 5W30', 'stock', '150.00', '90.00', 'Lubricants', '20'],
        ['SRV-001', 'Oil Change Labor', 'service', '100.00', '0.00', 'Services', '0'],
      ];

      const res = validateProductRows(headers, rows);
      expect(res.valid).toBe(true);
      expect(res.validRecords.length).toBe(2);
      expect(res.validRecords[0].sku).toBe('OIL-001');
      expect(res.validRecords[0].kind).toBe('stock');
      expect(res.validRecords[0].sellingPrice).toBe(150);
      expect(res.validRecords[0].costPrice).toBe(90);
      expect(res.validRecords[1].kind).toBe('service');
    });

    it('flags missing SKU, missing Name, duplicate SKU in file, and existing SKU', () => {
      const headers = ['SKU', 'Name', 'Price'];
      const rows = [
        ['', 'Item No Sku', '10'], // missing sku
        ['SKU-1', '', '10'], // missing name
        ['SKU-1', 'Duplicate In File', '10'], // duplicate in file
        ['EXISTING-SKU', 'Already Exists', '10'], // already in org catalog
      ];

      const existingSkus = new Set(['EXISTING-SKU']);
      const res = validateProductRows(headers, rows, existingSkus);

      expect(res.valid).toBe(false);
      expect(res.errors.length).toBe(4);
      expect(res.errors.some((e) => e.field === 'sku' && e.reason.includes('cannot be empty'))).toBe(true);
      expect(res.errors.some((e) => e.field === 'name' && e.reason.includes('cannot be empty'))).toBe(true);
      expect(res.errors.some((e) => e.field === 'sku' && e.reason.includes('Duplicate SKU'))).toBe(true);
      expect(res.errors.some((e) => e.field === 'sku' && e.reason.includes('already exists in the organization catalog'))).toBe(true);
    });

    it('rejects invalid product kind', () => {
      const headers = ['SKU', 'Name', 'Kind'];
      const rows = [['SKU-X', 'Invalid Kind Item', 'invalid_kind']];
      const res = validateProductRows(headers, rows);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.field === 'kind' && e.reason.includes('Invalid product kind'))).toBe(true);
    });

    it('rejects non-numeric prices', () => {
      const headers = ['SKU', 'Name', 'Price'];
      const rows = [['SKU-Y', 'Bad Price Item', 'one-hundred']];
      const res = validateProductRows(headers, rows);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.field === 'sellingPrice' && e.reason.includes('non-negative number'))).toBe(true);
    });
  });

  describe('Template Generator', () => {
    it('generates valid CSV template containing standard column headers', () => {
      const csv = generateProductTemplateCsv();
      expect(csv).toContain('SKU,Product Name,Kind,Category,Selling Price (MVR)');
      const parsed = parseDelimitedText(csv);
      expect(parsed.headers.length).toBeGreaterThanOrEqual(10);
      expect(parsed.rows.length).toBeGreaterThan(0);
    });
  });

  describe('executeProductImport', () => {
    it('imports records with tenant scoping', async () => {
      const records = [
        {
          sku: 'SKU-A',
          name: 'Item A',
          kind: 'stock' as const,
          sellingPrice: 100,
          costPrice: 50,
          active: true,
          saleAllowed: true,
        },
      ];

      const tenant = { organisationId: 'org-test' };
      const persisted: any[] = [];
      const inserter = async (rec: any, ctx: any) => {
        persisted.push({ rec, ctx });
        return { success: true, id: 'prod-1' };
      };

      const res = await executeProductImport(records, tenant, 'skip_invalid', [], inserter);
      expect(res.importedCount).toBe(1);
      expect(res.skippedCount).toBe(0);
      expect(persisted[0].ctx.organisationId).toBe('org-test');
    });
  });
});
