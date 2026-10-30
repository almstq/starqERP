import { describe, it, expect } from 'vitest';
import {
  detectOpeningStockHeaderMapping,
  validateOpeningStockRows,
  generateOpeningStockTemplateCsv,
  createOpeningInventoryValuationJournal,
  executeOpeningStockImport,
} from './openingStockBulkImport';
import { parseDelimitedText } from './contactBulkImport';
import { AccountingPeriod } from '../periods';
import { AccountRecord } from '../accounts';

describe('SERP-305: Opening Stock Quantity & Asset Valuation Migration Domain', () => {
  describe('Header Mapping', () => {
    it('detects SKU, location, quantity, and unit cost columns accurately', () => {
      const headers = ['SKU', 'Warehouse Code', 'Opening Qty', 'Unit Cost Basis'];
      const mapping = detectOpeningStockHeaderMapping(headers);

      expect(mapping.skuCol).toBe(0);
      expect(mapping.locationCol).toBe(1);
      expect(mapping.quantityCol).toBe(2);
      expect(mapping.unitCostCol).toBe(3);
    });
  });

  describe('Validation & Parsing', () => {
    it('validates a correct opening stock dataset and computes total valuation', () => {
      const headers = ['SKU', 'Location', 'Quantity', 'Unit Cost'];
      const rows = [
        ['OIL-5W30', 'WH-MAIN', '100', '110.00'],
        ['FLT-001', 'WH-MAIN', '50', '40.00'],
      ];

      const res = validateOpeningStockRows(headers, rows);
      expect(res.valid).toBe(true);
      expect(res.validRecords.length).toBe(2);
      expect(res.validRecords[0].quantity).toBe(100);
      expect(res.validRecords[0].unitCost).toBe(110);
      expect(res.validRecords[0].totalValuation).toBe(11000);
      expect(res.validRecords[1].totalValuation).toBe(2000);
      expect(res.totalValuationMvr).toBe(13000);
    });

    it('flags missing SKU, non-positive quantity, and duplicate SKU+Location pairing', () => {
      const headers = ['SKU', 'Location', 'Quantity', 'Unit Cost'];
      const rows = [
        ['', 'WH-MAIN', '10', '50'], // missing SKU
        ['SKU-1', 'WH-MAIN', '-5', '50'], // negative quantity
        ['SKU-1', 'WH-MAIN', '0', '50'], // zero quantity
        ['SKU-2', 'WH-MAIN', '10', '50'],
        ['SKU-2', 'WH-MAIN', '20', '50'], // duplicate pairing
      ];

      const res = validateOpeningStockRows(headers, rows);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBe(4);
      expect(res.errors.some((e) => e.field === 'sku' && e.reason.includes('cannot be empty'))).toBe(true);
      expect(res.errors.some((e) => e.field === 'quantity' && e.reason.includes('positive number'))).toBe(true);
      expect(res.errors.some((e) => e.field === 'sku' && e.reason.includes('Duplicate SKU + Location entry'))).toBe(true);
    });

    it('rejects unrecognized SKUs when catalog set is provided', () => {
      const headers = ['SKU', 'Location', 'Quantity'];
      const rows = [['UNKNOWN-SKU', 'WH-MAIN', '10']];
      const validSkus = new Set(['OIL-5W30', 'FLT-001']);

      const res = validateOpeningStockRows(headers, rows, validSkus);
      expect(res.valid).toBe(false);
      expect(res.errors[0].reason).toContain('does not exist in the organization catalog');
    });
  });

  describe('Template Generator', () => {
    it('generates valid opening stock CSV template', () => {
      const csv = generateOpeningStockTemplateCsv();
      expect(csv).toContain('SKU,Location Code,Quantity,Unit Cost (MVR)');
      const parsed = parseDelimitedText(csv);
      expect(parsed.headers.length).toBe(4);
      expect(parsed.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Valuation Journal Entry & assertJournalPostable', () => {
    const mockAccounts: AccountRecord[] = [
      { id: 'acc-1310', code: '1310', name: 'Merchandise Inventory', accountClass: 'ASSET', subtype: 'INVENTORY', level: 3, parentId: 'acc-1300', currency: 'MVR', status: 'ACTIVE', balance: 0, isSystem: false },
      { id: 'acc-3100', code: '3100', name: "Owner's Capital", accountClass: 'EQUITY', subtype: 'OWNERS_EQUITY', level: 1, parentId: 'acc-3000', currency: 'MVR', status: 'ACTIVE', balance: 0, isSystem: false },
    ];

    const mockOpenPeriods: AccountingPeriod[] = [
      { id: 'p1', periodName: 'October 2026', month: 10, startDate: '2026-10-01', endDate: '2026-10-31', status: 'OPEN', fiscalYear: 2026 },
    ];

    it('generates a balanced double-entry journal (DR 1310, CR 3100)', () => {
      const journal = createOpeningInventoryValuationJournal({
        totalValuationMvr: 25000,
        tenantId: 'tenant-test',
        effectiveDate: '2026-10-20',
        periods: mockOpenPeriods,
        accounts: mockAccounts,
      });

      expect(journal.totalDebit).toBe(25000);
      expect(journal.totalCredit).toBe(25000);
      expect(journal.lines.length).toBe(2);
      expect(journal.lines[0].accountCode).toBe('1310');
      expect(journal.lines[0].debit).toBe(25000);
      expect(journal.lines[1].accountCode).toBe('3100');
      expect(journal.lines[1].credit).toBe(25000);
    });

    it('rejects posting into a closed accounting period', () => {
      const mockClosedPeriods: AccountingPeriod[] = [
        { id: 'p1', periodName: 'September 2026', month: 9, startDate: '2026-09-01', endDate: '2026-09-30', status: 'CLOSED', fiscalYear: 2026 },
      ];

      expect(() => {
        createOpeningInventoryValuationJournal({
          totalValuationMvr: 10000,
          tenantId: 'tenant-test',
          effectiveDate: '2026-09-15',
          periods: mockClosedPeriods,
          accounts: mockAccounts,
        });
      }).toThrow();
    });
  });

  describe('executeOpeningStockImport', () => {
    it('creates opening stock movements and produces the asset valuation journal', async () => {
      const records = [
        { sku: 'OIL-1', locationCode: 'WH-MAIN', quantity: 10, unitCost: 100, totalValuation: 1000 },
        { sku: 'OIL-2', locationCode: 'WH-MAIN', quantity: 20, unitCost: 50, totalValuation: 1000 },
      ];

      const movementsCreated: any[] = [];
      const inserter = async (rec: any, tenantId: string) => {
        movementsCreated.push({ rec, tenantId });
        return { success: true, id: `sm-${rec.sku}` };
      };

      const result = await executeOpeningStockImport({
        records,
        tenantId: 'tenant-abc',
        mode: 'skip_invalid',
        validationErrors: [],
        inserter,
      });

      expect(result.importedCount).toBe(2);
      expect(result.totalValuationMvr).toBe(2000);
      expect(result.valuationJournal).toBeDefined();
      expect(result.valuationJournal?.totalDebit).toBe(2000);
      expect(movementsCreated.length).toBe(2);
      expect(movementsCreated[0].tenantId).toBe('tenant-abc');
    });
  });
});
