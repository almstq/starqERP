import { describe, it, expect } from 'vitest';
import {
  validateMaldivianPhone,
  validateMiraTin,
  validateEmail,
  parseDelimitedText,
  validateContactRows,
  generateCustomerTemplateCsv,
  generateSupplierTemplateCsv,
  executeContactImport,
} from './contactBulkImport';

describe('SERP-303: Maldivian Contact Bulk Import Domain', () => {
  describe('Maldivian Phone Validation', () => {
    it('accepts 7-digit mobile numbers starting with 7 or 9', () => {
      expect(validateMaldivianPhone('7912345').isValid).toBe(true);
      expect(validateMaldivianPhone('7912345').normalized).toBe('+960 7912345');
      expect(validateMaldivianPhone('9998877').isValid).toBe(true);
      expect(validateMaldivianPhone('9998877').normalized).toBe('+960 9998877');
    });

    it('accepts 7-digit landline numbers starting with 3 or 6', () => {
      expect(validateMaldivianPhone('3321111').isValid).toBe(true);
      expect(validateMaldivianPhone('3321111').normalized).toBe('+960 3321111');
      expect(validateMaldivianPhone('6881234').isValid).toBe(true);
      expect(validateMaldivianPhone('6881234').normalized).toBe('+960 6881234');
    });

    it('handles +960 and 00960 country codes and punctuation', () => {
      expect(validateMaldivianPhone('+960 778-9900').isValid).toBe(true);
      expect(validateMaldivianPhone('+960 778-9900').normalized).toBe('+960 7789900');
      expect(validateMaldivianPhone('00960 3312345').isValid).toBe(true);
      expect(validateMaldivianPhone('00960 3312345').normalized).toBe('+960 3312345');
    });

    it('rejects invalid numbers', () => {
      expect(validateMaldivianPhone('1234567').isValid).toBe(false);
      expect(validateMaldivianPhone('778899').isValid).toBe(false); // 6 digits
      expect(validateMaldivianPhone('778899001').isValid).toBe(false); // 9 digits
      expect(validateMaldivianPhone('abcdefg').isValid).toBe(false);
    });

    it('accepts empty/whitespace as optional valid', () => {
      expect(validateMaldivianPhone('').isValid).toBe(true);
      expect(validateMaldivianPhone('   ').isValid).toBe(true);
    });
  });

  describe('MIRA TIN Validation', () => {
    it('accepts 7-digit numeric TIN', () => {
      expect(validateMiraTin('1023456').isValid).toBe(true);
      expect(validateMiraTin('1023456').normalized).toBe('1023456');
    });

    it('accepts GST, G, B, T prefixed TIN', () => {
      expect(validateMiraTin('GST-1023456').isValid).toBe(true);
      expect(validateMiraTin('GST-1023456').normalized).toBe('1023456');
      expect(validateMiraTin('G1000001').isValid).toBe(true);
      expect(validateMiraTin('G1000001').normalized).toBe('1000001');
      expect(validateMiraTin('B1004567').isValid).toBe(true);
      expect(validateMiraTin('B1004567').normalized).toBe('1004567');
    });

    it('rejects invalid TIN formats', () => {
      expect(validateMiraTin('12345').isValid).toBe(false); // only 5 digits
      expect(validateMiraTin('ABCDEF').isValid).toBe(false);
      expect(validateMiraTin('TAX1023456').isValid).toBe(false);
    });

    it('accepts empty/whitespace as optional valid', () => {
      expect(validateMiraTin('').isValid).toBe(true);
    });
  });

  describe('Email Validation', () => {
    it('accepts standard email addresses and lowercases them', () => {
      const res = validateEmail('Billing@MaleWatersports.mv');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('billing@malewatersports.mv');
    });

    it('rejects invalid emails', () => {
      expect(validateEmail('not-an-email').isValid).toBe(false);
      expect(validateEmail('@domain.com').isValid).toBe(false);
      expect(validateEmail('user@').isValid).toBe(false);
    });
  });

  describe('Delimited Text Parser', () => {
    it('correctly parses CSV with quoted fields containing commas', () => {
      const csv = 'Name,Phone,Address\n"Villa Trading, Co",7788990,"Boduthakurufaanu Magu, Male"';
      const parsed = parseDelimitedText(csv);
      expect(parsed.headers).toEqual(['name', 'phone', 'address']);
      expect(parsed.rows.length).toBe(1);
      expect(parsed.rows[0][0]).toBe('Villa Trading, Co');
      expect(parsed.rows[0][1]).toBe('7788990');
      expect(parsed.rows[0][2]).toBe('Boduthakurufaanu Magu, Male');
    });

    it('supports tab delimited data', () => {
      const tsv = 'Name\tPhone\tTIN\nSTELCO\t3320982\t1000002';
      const parsed = parseDelimitedText(tsv);
      expect(parsed.headers).toEqual(['name', 'phone', 'tin']);
      expect(parsed.rows[0][0]).toBe('STELCO');
    });
  });

  describe('validateContactRows', () => {
    it('passes a valid customer dataset and auto-maps headers', () => {
      const headers = ['Customer Name', 'Phone Number', 'Email Address', 'MIRA TIN', 'Payment Terms (Days)', 'Credit Limit (MVR)'];
      const rows = [
        ['Male Watersports Pvt Ltd', '7912345', 'accounts@malewatersports.mv', '1023456', '30', '50000'],
        ['Addu Dive Center', '+960 6881234', 'dive@addu.mv', 'GST-1045678', '15', '20000'],
      ];

      const res = validateContactRows(headers, rows, 'customer');
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);
      expect(res.validRecords.length).toBe(2);
      expect(res.validRecords[0].displayName).toBe('Male Watersports Pvt Ltd');
      expect(res.validRecords[0].phone).toBe('+960 7912345');
      expect(res.validRecords[0].taxIdentifier).toBe('1023456');
      expect(res.validRecords[0].paymentTermsDays).toBe(30);
      expect(res.validRecords[0].creditLimit).toBe(50000);
      expect(res.validRecords[1].phone).toBe('+960 6881234');
    });

    it('flags invalid phone, invalid TIN, missing required name, and duplicate names', () => {
      const headers = ['Name', 'Phone', 'TIN'];
      const rows = [
        ['', '7912345', '1023456'], // missing name
        ['Valid Corp', '99999', '1023456'], // invalid phone
        ['Another Corp', '7912345', 'BAD_TIN'], // invalid TIN
        ['Valid Corp', '7912345', '1023456'], // duplicate name in batch
      ];

      const res = validateContactRows(headers, rows);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBe(4);
      expect(res.errors.some((e) => e.field === 'displayName' && e.reason.includes('required'))).toBe(true);
      expect(res.errors.some((e) => e.field === 'phone' && e.reason.includes('Invalid Maldivian phone'))).toBe(true);
      expect(res.errors.some((e) => e.field === 'taxIdentifier' && e.reason.includes('Invalid MIRA TIN'))).toBe(true);
      expect(res.errors.some((e) => e.field === 'displayName' && e.reason.includes('Duplicate contact name'))).toBe(true);
    });
  });

  describe('Template Generators', () => {
    it('generates non-empty customer template with CSV headers', () => {
      const csv = generateCustomerTemplateCsv();
      expect(csv).toContain('Customer Name,Phone Number,Email Address,MIRA TIN');
      expect(csv).toContain('Male Watersports Pvt Ltd');
    });

    it('generates non-empty supplier template with CSV headers', () => {
      const csv = generateSupplierTemplateCsv();
      expect(csv).toContain('Supplier Name,Phone Number,Email Address,MIRA TIN,Category');
      expect(csv).toContain('Dhiraagu Plc');
    });
  });

  describe('executeContactImport', () => {
    it('imports records with tenant isolation and produces an accurate summary report', async () => {
      const validRecords = [
        {
          displayName: 'Client 1',
          kind: 'customer' as const,
          phone: '+960 7912345',
          email: 'c1@mv.mv',
          taxIdentifier: '1000001',
          paymentTermsDays: 30,
          creditLimit: 10000,
          status: 'active' as const,
        },
        {
          displayName: 'Client 2',
          kind: 'customer' as const,
          phone: '+960 7912346',
          email: 'c2@mv.mv',
          taxIdentifier: '1000002',
          paymentTermsDays: 15,
          creditLimit: 20000,
          status: 'active' as const,
        },
      ];

      const tenant = { organisationId: 'org-1234' };
      const persistedTenantIds: string[] = [];

      const mockInserter = async (rec: any, ctx: any) => {
        persistedTenantIds.push(ctx.organisationId);
        return { success: true, id: 'cont-' + rec.displayName };
      };

      const report = await executeContactImport(validRecords, tenant, 'skip_invalid', [], mockInserter);

      expect(report.importedCount).toBe(2);
      expect(report.skippedCount).toBe(0);
      expect(report.errors.length).toBe(0);
      expect(persistedTenantIds).toEqual(['org-1234', 'org-1234']);
    });

    it('handles failures gracefully in skip_invalid mode', async () => {
      const records = [
        {
          displayName: 'Client Success',
          kind: 'customer' as const,
          phone: '+960 7912345',
          email: 's@mv.mv',
          taxIdentifier: '1000001',
          paymentTermsDays: 0,
          creditLimit: 0,
          status: 'active' as const,
        },
        {
          displayName: 'Client Fail',
          kind: 'customer' as const,
          phone: '+960 7912346',
          email: 'f@mv.mv',
          taxIdentifier: '1000002',
          paymentTermsDays: 0,
          creditLimit: 0,
          status: 'active' as const,
        },
      ];

      const tenant = { organisationId: 'org-tenant-a' };
      const inserter = async (rec: any) => {
        if (rec.displayName === 'Client Fail') {
          return { success: false, error: 'Database conflict' };
        }
        return { success: true, id: 'ok' };
      };

      const report = await executeContactImport(records, tenant, 'skip_invalid', [], inserter);
      expect(report.importedCount).toBe(1);
      expect(report.skippedCount).toBe(1);
      expect(report.errors.length).toBe(1);
      expect(report.errors[0].reason).toBe('Database conflict');
    });

    it('stops after a persistence failure and reports earlier committed records as partial', async () => {
      const records = ['First', 'Fails', 'Not attempted'].map((displayName) => ({
        displayName,
        kind: 'customer' as const,
        phone: '',
        email: '',
        taxIdentifier: '',
        paymentTermsDays: 0,
        creditLimit: 0,
        status: 'active' as const,
      }));
      const attempted: string[] = [];
      const inserter = async (record: any) => {
        attempted.push(record.displayName);
        if (record.displayName === 'Fails') throw new Error('persistence_failed');
        return { success: true, id: `server-${record.displayName}` };
      };

      const report = await executeContactImport(records, { organisationId: 'org-tenant-a' }, 'abort_on_error', [], inserter);

      expect(attempted).toEqual(['First', 'Fails']);
      expect(report.importedCount).toBe(1);
      expect(report.skippedCount).toBe(2);
      expect(report.errors[0].reason).toBe('persistence_failed');
    });
  });
});
