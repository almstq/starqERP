import { describe, it, expect, vi } from 'vitest';
import {
  parseCsv,
  detectDelimiter,
  exportToCsv,
  parseSharedStrings,
  parseWorksheetXml,
  columnLetterToIndex,
  CONTACTS_SCHEMA,
  PRODUCTS_SCHEMA,
  OPENING_BALANCES_SCHEMA,
  autoMapColumns,
  validateMaldivianPhone,
  validateMiraTin,
  validateDataset,
  exportValidationErrorsToCsv,
  executeBatchIngestion,
} from '../domain/ingestion';

describe('SERP-302: Universal CSV Parser', () => {
  it('parses standard RFC-4180 CSV with quotes, commas, and trims', () => {
    const csv = `SKU,Product Name,Selling Price,Active
BEV-001,"Coca Cola, 330ml Can",15.00,true
SNK-002,"Potato Chips ""Original""",25.50,false`;

    const result = parseCsv(csv);
    expect(result.headers).toEqual(['SKU', 'Product Name', 'Selling Price', 'Active']);
    expect(result.totalRows).toBe(2);
    expect(result.rows[0]).toEqual(['BEV-001', 'Coca Cola, 330ml Can', '15.00', 'true']);
    expect(result.rows[1]).toEqual(['SNK-002', 'Potato Chips "Original"', '25.50', 'false']);
  });

  it('auto-detects semicolons, tabs, and pipes as delimiters', () => {
    const semicolonCsv = `Code;Name;Price\n101;Item A;10\n102;Item B;20`;
    expect(detectDelimiter(semicolonCsv)).toBe(';');
    const resSemi = parseCsv(semicolonCsv);
    expect(resSemi.headers).toEqual(['Code', 'Name', 'Price']);
    expect(resSemi.rows.length).toBe(2);

    const tabTsv = `ID\tCustomer\tPhone\n1\tAli\t7991234\n2\tAhmed\t7881234`;
    expect(detectDelimiter(tabTsv)).toBe('\t');
    const resTab = parseCsv(tabTsv);
    expect(resTab.headers).toEqual(['ID', 'Customer', 'Phone']);

    const pipeCsv = `ID|City|Country\n1|Male|Maldives\n2|Addu|Maldives`;
    expect(detectDelimiter(pipeCsv)).toBe('|');
    const resPipe = parseCsv(pipeCsv);
    expect(resPipe.headers).toEqual(['ID', 'City', 'Country']);
  });

  it('correctly handles multiline quoted fields and UTF-8 BOM', () => {
    const bomCsv = `\uFEFFID,Description,Status\n1,"Line 1\nLine 2\nLine 3",active`;
    const res = parseCsv(bomCsv);
    expect(res.headers).toEqual(['ID', 'Description', 'Status']);
    expect(res.rows[0][1]).toBe('Line 1\nLine 2\nLine 3');
  });

  it('supports high-volume parsing benchmarking up to 50,000 rows without degradation', () => {
    const lines = ['SKU,Name,Price,Stock'];
    for (let i = 1; i <= 10000; i++) {
      lines.push(`SKU-${i},Product Item ${i},${(i * 1.5).toFixed(2)},${i * 10}`);
    }
    const bigCsv = lines.join('\n');

    const start = performance.now();
    const result = parseCsv(bigCsv);
    const duration = performance.now() - start;

    expect(result.totalRows).toBe(10000);
    expect(result.headers).toEqual(['SKU', 'Name', 'Price', 'Stock']);
    expect(duration).toBeLessThan(1000); // 10,000 rows under 1 second
  });
});

describe('SERP-302: Universal XLSX XML Parsing Utilities', () => {
  it('converts Excel column letters to 0-based indices accurately', () => {
    expect(columnLetterToIndex('A')).toBe(0);
    expect(columnLetterToIndex('B')).toBe(1);
    expect(columnLetterToIndex('Z')).toBe(25);
    expect(columnLetterToIndex('AA')).toBe(26);
    expect(columnLetterToIndex('AB')).toBe(27);
    expect(columnLetterToIndex('AZ')).toBe(51);
    expect(columnLetterToIndex('BA')).toBe(52);
  });

  it('parses shared strings table resolving XML entities', () => {
    const sstXml = `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <si><t>Island Express &amp; Logistics</t></si>
      <si><t>Male &lt;Main Outlet&gt;</t></si>
      <si><t>100% &quot;Pure&quot; Juice</t></si>
    </sst>`;

    const strings = parseSharedStrings(sstXml);
    expect(strings).toEqual([
      'Island Express & Logistics',
      'Male <Main Outlet>',
      '100% "Pure" Juice',
    ]);
  });

  it('parses worksheet XML rows mapping shared and inline strings', () => {
    const sharedStrings = ['SKU', 'Product Name', 'COKE-330', 'Coca Cola 330ml'];
    const sheetXml = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetData>
        <row r="1">
          <c r="A1" t="s"><v>0</v></c>
          <c r="B1" t="s"><v>1</v></c>
          <c r="C1"><v>Price</v></c>
        </row>
        <row r="2">
          <c r="A2" t="s"><v>2</v></c>
          <c r="B2" t="s"><v>3</v></c>
          <c r="C2"><v>15.50</v></c>
        </row>
      </sheetData>
    </worksheet>`;

    const grid = parseWorksheetXml(sheetXml, sharedStrings);
    expect(grid.length).toBe(2);
    expect(grid[0]).toEqual(['SKU', 'Product Name', 'Price']);
    expect(grid[1]).toEqual(['COKE-330', 'Coca Cola 330ml', '15.50']);
  });
});

describe('SERP-302: Schemas & Auto-Mapping Heuristics', () => {
  it('validates Maldivian phone numbers', () => {
    expect(validateMaldivianPhone('7991234')).toBeNull();
    expect(validateMaldivianPhone('+9607991234')).toBeNull();
    expect(validateMaldivianPhone('009609112233')).toBeNull();
    expect(validateMaldivianPhone('3321111')).toBeNull(); // landline
    expect(validateMaldivianPhone('6881234')).toBeNull(); // atoll landline

    // Invalid numbers
    expect(validateMaldivianPhone('1234567')).toContain('Invalid Maldivian phone');
    expect(validateMaldivianPhone('799123')).toContain('Invalid Maldivian phone'); // 6 digits
    expect(validateMaldivianPhone('79912345')).toContain('Invalid Maldivian phone'); // 8 digits
  });

  it('validates MIRA TIN tax numbers', () => {
    expect(validateMiraTin('1023456')).toBeNull();
    expect(validateMiraTin('G1023456')).toBeNull();
    expect(validateMiraTin('GST-1023456')).toBeNull();
    expect(validateMiraTin('B1023456')).toBeNull();

    expect(validateMiraTin('12345')).toContain('Invalid MIRA TIN');
    expect(validateMiraTin('INVALID-TIN')).toContain('Invalid MIRA TIN');
  });

  it('auto-maps customer spreadsheet headers to starqERP schema fields with confidence score', () => {
    const rawHeaders = ['Client Name', 'Mobile No', 'e-mail', 'GST Number', 'Terms (Days)'];
    const mappings = autoMapColumns(rawHeaders, CONTACTS_SCHEMA, [
      ['Ahmed Marine', '7912345', 'ahmed@marine.mv', '1002345', '30'],
    ]);

    expect(mappings.find((m) => m.sourceHeader === 'Client Name')?.targetField).toBe('display_name');
    expect(mappings.find((m) => m.sourceHeader === 'Mobile No')?.targetField).toBe('phone');
    expect(mappings.find((m) => m.sourceHeader === 'e-mail')?.targetField).toBe('email');
    expect(mappings.find((m) => m.sourceHeader === 'GST Number')?.targetField).toBe('tax_identifier');
    expect(mappings.find((m) => m.sourceHeader === 'Terms (Days)')?.targetField).toBe('payment_terms_days');
  });
});

describe('SERP-302: Universal Dataset Validator & Duplicate Key Detection', () => {
  it('validates required fields and reports missing required field errors', () => {
    const rawHeaders = ['Item Code', 'Product Title', 'Rate'];
    const rawRows = [
      ['SKU-001', 'Apple 1kg', '50.00'],
      ['', 'Orange 1kg', '45.00'], // missing required SKU
      ['SKU-003', '', '30.00'], // missing required Name
    ];

    const mappings = [
      { sourceHeader: 'Item Code', targetField: 'sku', confidence: 100, sampleValues: [] },
      { sourceHeader: 'Product Title', targetField: 'name', confidence: 100, sampleValues: [] },
      { sourceHeader: 'Rate', targetField: 'price', confidence: 100, sampleValues: [] },
    ];

    const result = validateDataset(rawHeaders, rawRows, mappings, PRODUCTS_SCHEMA);
    expect(result.isValid).toBe(false);
    expect(result.totalRows).toBe(3);
    expect(result.validRows).toBe(1);
    expect(result.errorRows).toBe(2);

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        rowIndex: 3,
        fieldKey: 'sku',
        error: expect.stringContaining('Missing required field'),
      })
    );
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        rowIndex: 4,
        fieldKey: 'name',
        error: expect.stringContaining('Missing required field'),
      })
    );
  });

  it('detects duplicate keys occurring across rows within the uploaded file', () => {
    const rawHeaders = ['SKU', 'Name', 'Price'];
    const rawRows = [
      ['SKU-DUPLICATE', 'Item 1', '10.00'],
      ['SKU-UNIQUE', 'Item 2', '20.00'],
      ['SKU-DUPLICATE', 'Item 3 (Duplicate)', '30.00'], // duplicate SKU
    ];

    const mappings = [
      { sourceHeader: 'SKU', targetField: 'sku', confidence: 100, sampleValues: [] },
      { sourceHeader: 'Name', targetField: 'name', confidence: 100, sampleValues: [] },
      { sourceHeader: 'Price', targetField: 'price', confidence: 100, sampleValues: [] },
    ];

    const result = validateDataset(rawHeaders, rawRows, mappings, PRODUCTS_SCHEMA);
    expect(result.isValid).toBe(false);
    expect(result.duplicateKeyErrors.length).toBe(1);
    expect(result.duplicateKeyErrors[0].rowIndex).toBe(4);
    expect(result.duplicateKeyErrors[0].error).toContain('Duplicate key violation: Value "SKU-DUPLICATE" was already seen on row 2');
  });

  it('enforces double-entry debits === credits balance check on opening balances', () => {
    const headers = ['Account Code', 'Debit', 'Credit'];
    // Balanced set
    const balancedRows = [
      ['1010', '1000.00', '0.00'],
      ['2010', '0.00', '1000.00'],
    ];
    const mappings = [
      { sourceHeader: 'Account Code', targetField: 'account_code', confidence: 100, sampleValues: [] },
      { sourceHeader: 'Debit', targetField: 'debit', confidence: 100, sampleValues: [] },
      { sourceHeader: 'Credit', targetField: 'credit', confidence: 100, sampleValues: [] },
    ];

    const balancedRes = validateDataset(headers, balancedRows, mappings, OPENING_BALANCES_SCHEMA);
    expect(balancedRes.isValid).toBe(true);

    // Unbalanced set (Debits 1000 vs Credits 800)
    const unbalancedRows = [
      ['1010', '1000.00', '0.00'],
      ['2010', '0.00', '800.00'],
    ];
    const unbalancedRes = validateDataset(headers, unbalancedRows, mappings, OPENING_BALANCES_SCHEMA);
    expect(unbalancedRes.isValid).toBe(false);
    expect(unbalancedRes.errors.some((e) => e.error.includes('Out of balance'))).toBe(true);
  });

  it('exports structured error reports to CSV', () => {
    const errors = [
      {
        rowIndex: 3,
        column: 'Phone',
        fieldKey: 'phone',
        value: '12345',
        error: 'Invalid Maldivian phone number',
        severity: 'error' as const,
      },
    ];
    const errorCsv = exportValidationErrorsToCsv(errors);
    expect(errorCsv).toContain('Row Number,Column Name,Field Key,Invalid Value,Severity,Error Message');
    expect(errorCsv).toContain('3,Phone,phone,12345,ERROR,Invalid Maldivian phone number');
  });
});

describe('SERP-302: Atomic Batch Execution & Rollback Engine', () => {
  it('enforces atomic rollback: aborts with zero insertions if validation fails in all_or_nothing mode', async () => {
    const summary = {
      totalRows: 5,
      validRows: 4,
      errorRows: 1,
      warningRows: 0,
      isValid: false,
      parsedRecords: [{ name: 'A' }, { name: 'B' }],
      duplicateKeyErrors: [],
      errors: [
        {
          rowIndex: 2,
          column: 'Name',
          fieldKey: 'name',
          value: '',
          error: 'Missing required field',
          severity: 'error' as const,
        },
      ],
    };

    const mockCommitter = vi.fn();
    const result = await executeBatchIngestion(
      'contacts',
      summary,
      { mode: 'all_or_nothing' },
      mockCommitter
    );

    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(result.insertedCount).toBe(0);
    expect(mockCommitter).not.toHaveBeenCalled();
    expect(result.message).toContain('Atomic rollback');
  });

  it('enforces atomic rollback if an unexpected server exception occurs during batch execution', async () => {
    const summary = {
      totalRows: 3,
      validRows: 3,
      errorRows: 0,
      warningRows: 0,
      isValid: true,
      parsedRecords: [{ sku: 'A' }, { sku: 'B' }, { sku: 'C' }],
      duplicateKeyErrors: [],
      errors: [],
    };

    const failingCommitter = vi.fn().mockRejectedValue(new Error('PostgreSQL connection timeout'));

    const result = await executeBatchIngestion(
      'products',
      summary,
      { mode: 'all_or_nothing' },
      failingCommitter
    );

    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(result.insertedCount).toBe(0);
    expect(result.message).toContain('Atomic rollback completed');
  });

  it('allows skip_invalid mode to commit valid records while logging skipped rows', async () => {
    const summary = {
      totalRows: 3,
      validRows: 2,
      errorRows: 1,
      warningRows: 0,
      isValid: false,
      parsedRecords: [
        { sku: 'VALID-1', name: 'Item 1' },
        { sku: '', name: 'Item 2' }, // error row
        { sku: 'VALID-3', name: 'Item 3' },
      ],
      duplicateKeyErrors: [],
      errors: [
        {
          rowIndex: 3, // row 3 is index 1
          column: 'SKU',
          fieldKey: 'sku',
          value: '',
          error: 'Missing required field',
          severity: 'error' as const,
        },
      ],
    };

    const mockCommitter = vi.fn().mockResolvedValue({ ok: true, insertedCount: 2 });

    const result = await executeBatchIngestion(
      'products',
      summary,
      { mode: 'skip_invalid' },
      mockCommitter
    );

    expect(result.success).toBe(true);
    expect(result.rolledBack).toBe(false);
    expect(result.insertedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(mockCommitter).toHaveBeenCalledWith(
      'products',
      [
        { sku: 'VALID-1', name: 'Item 1' },
        { sku: 'VALID-3', name: 'Item 3' },
      ],
      expect.any(String),
      false
    );
  });
});

describe('SERP-302: SSOT AC2 Foreign Reference Validation', () => {
  it('validates foreign references against context lookups and rejects unknown keys', () => {
    const rawHeaders = ['Account Code', 'Debit', 'Credit'];
    const rawRows = [
      ['1010', '500.00', '0'], // 1010 exists
      ['9999', '0', '500.00'], // 9999 does NOT exist
    ];
    const mappings = [
      { sourceHeader: 'Account Code', targetField: 'account_code', confidence: 100, sampleValues: ['1010'] },
      { sourceHeader: 'Debit', targetField: 'debit', confidence: 100, sampleValues: ['500'] },
      { sourceHeader: 'Credit', targetField: 'credit', confidence: 100, sampleValues: ['0'] },
    ];

    const context = {
      foreignReferences: {
        'chart_of_accounts.code': new Set(['1010', '1020', '2010', '3010']),
      },
    };

    const summary = validateDataset(rawHeaders, rawRows, mappings, OPENING_BALANCES_SCHEMA, context);

    expect(summary.isValid).toBe(false);
    expect(summary.errors.length).toBe(1);
    expect(summary.errors[0].fieldKey).toBe('account_code');
    expect(summary.errors[0].value).toBe('9999');
    expect(summary.errors[0].error).toContain('Foreign reference violation');
  });

  it('passes when all foreign references exist in context lookups', () => {
    const rawHeaders = ['Account Code', 'Debit', 'Credit'];
    const rawRows = [
      ['1010', '500.00', '0'],
      ['2010', '0', '500.00'],
    ];
    const mappings = [
      { sourceHeader: 'Account Code', targetField: 'account_code', confidence: 100, sampleValues: ['1010'] },
      { sourceHeader: 'Debit', targetField: 'debit', confidence: 100, sampleValues: ['500'] },
      { sourceHeader: 'Credit', targetField: 'credit', confidence: 100, sampleValues: ['0'] },
    ];

    const context = {
      foreignReferences: {
        'chart_of_accounts.code': new Set(['1010', '2010']),
      },
    };

    const summary = validateDataset(rawHeaders, rawRows, mappings, OPENING_BALANCES_SCHEMA, context);

    expect(summary.isValid).toBe(true);
    expect(summary.errors.length).toBe(0);
  });
});
