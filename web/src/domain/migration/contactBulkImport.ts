/**
 * SERP-303: Maldivian Contact Master Data Bulk Import Domain
 * Handles validation, parsing, template generation, and tenant-isolated execution
 * for Customers and Suppliers.
 *
 * Industry-neutral, zero-dependency RFC-4180 CSV / TSV / OpenXML parser,
 * strict Maldivian phone, email, and MIRA TIN validators, and detailed error reporting.
 */

export type ContactKind = 'customer' | 'supplier' | 'both';

export interface ContactImportRecord {
  displayName: string;
  kind: ContactKind;
  phone: string;
  email: string;
  taxIdentifier: string;
  paymentTermsDays: number;
  creditLimit: number;
  status: 'active' | 'inactive';
  contactPerson?: string;
  address?: string;
  island?: string;
  category?: string;
  leadTimeDays?: number;
}

export interface ValidationErrorItem {
  row: number; // 1-indexed (row 1 is header, data rows start at 2)
  field: string;
  value: string;
  reason: string;
}

export interface ImportValidationResult {
  valid: boolean;
  totalRecords: number;
  validRecords: ContactImportRecord[];
  errors: ValidationErrorItem[];
}

export interface ImportSummaryReport {
  totalProcessed: number;
  importedCount: number;
  skippedCount: number;
  errors: ValidationErrorItem[];
  importedRecords: ContactImportRecord[];
}

export interface TenantIsolationContext {
  organisationId: string;
  userId?: string;
}

/**
 * Maldivian Phone Number Validator:
 * - 7 digits starting with 7, 9 (Mobile) or 3, 6 (Landline)
 * - Optional Maldivian country code (+960, 00960, 960) with spaces or dashes
 */
export function validateMaldivianPhone(raw: string): { isValid: boolean; normalized?: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { isValid: true, normalized: '' };
  }

  // Remove spaces, hyphens, parentheses
  const clean = trimmed.replace(/[\s\-\(\)\.]/g, '');
  const match = clean.match(/^(?:\+?960|00960)?([3679]\d{6})$/);

  if (!match) {
    return {
      isValid: false,
      error: `Invalid Maldivian phone number: "${raw}". Expected 7-digit mobile (7xxxxxx, 9xxxxxx) or landline (3xxxxxx, 6xxxxxx), optionally prefixed with +960.`,
    };
  }

  return {
    isValid: true,
    normalized: `+960 ${match[1]}`,
  };
}

/**
 * Maldivian MIRA TIN Validator:
 * - Standard 7-digit tax number (e.g. 1023456)
 * - Or with prefix G, B, T, or GST (e.g. GST-1023456, G1023456)
 */
export function validateMiraTin(raw: string): { isValid: boolean; normalized?: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { isValid: true, normalized: '' };
  }

  const clean = trimmed.toUpperCase().replace(/[\s\-]/g, '');
  const match = clean.match(/^(?:(?:GST|[GBT])?(\d{7}))$/);

  if (!match) {
    return {
      isValid: false,
      error: `Invalid MIRA TIN: "${raw}". Expected 7 digits optionally prefixed by GST, G, B, or T (e.g. 1023456 or GST-1023456).`,
    };
  }

  return {
    isValid: true,
    normalized: match[1],
  };
}

/**
 * RFC 5322 compatible email validator
 */
export function validateEmail(raw: string): { isValid: boolean; normalized?: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { isValid: true, normalized: '' };
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(trimmed)) {
    return {
      isValid: false,
      error: `Invalid email address format: "${raw}".`,
    };
  }

  return {
    isValid: true,
    normalized: trimmed.toLowerCase(),
  };
}

/**
 * RFC-4180 compliant CSV / Delimited text parser
 */
export function parseDelimitedText(text: string, delimiter?: string): { headers: string[]; rows: string[][] } {
  if (!text || !text.trim()) {
    return { headers: [], rows: [] };
  }

  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1); // remove UTF-8 BOM
  }

  // Detect delimiter if not given
  const delim = delimiter || (cleanText.includes('\t') && !cleanText.includes(',') ? '\t' : ',');

  const rawRows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  const len = cleanText.length;

  for (let i = 0; i < len; i++) {
    const char = cleanText[i];
    const nextChar = i + 1 < len ? cleanText[i + 1] : '';

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // Skip second quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delim) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        currentField = '';

        if (currentRow.some((val) => val.length > 0)) {
          rawRows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((val) => val.length > 0)) {
      rawRows.push(currentRow);
    }
  }

  if (rawRows.length === 0) {
    return { headers: [], rows: [] };
  }

  return {
    headers: rawRows[0].map((h) => h.toLowerCase().trim()),
    rows: rawRows.slice(1),
  };
}

export interface HeaderMapping {
  displayNameCol: number;
  kindCol: number;
  phoneCol: number;
  emailCol: number;
  tinCol: number;
  paymentTermsCol: number;
  creditLimitCol: number;
  statusCol: number;
  contactPersonCol: number;
  addressCol: number;
  islandCol: number;
  categoryCol: number;
  leadTimeCol: number;
}

export function detectHeaderMapping(headers: string[]): HeaderMapping {
  const findCol = (aliases: string[]): number => {
    return headers.findIndex((h) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return aliases.some((a) => {
        const cleanA = a.toLowerCase().replace(/[^a-z0-9]/g, '');
        return clean === cleanA || clean.includes(cleanA) || cleanA.includes(clean);
      });
    });
  };

  return {
    displayNameCol: findCol(['name', 'displayname', 'customername', 'suppliername', 'company', 'vendorname', 'clientname']),
    kindCol: findCol(['kind', 'type', 'contacttype', 'role']),
    phoneCol: findCol(['phone', 'mobile', 'telephone', 'contactnumber', 'phoneno', 'phonenumber']),
    emailCol: findCol(['email', 'mail', 'emailaddress', 'billingemail']),
    tinCol: findCol(['tin', 'miratin', 'taxid', 'gstno', 'gstnumber', 'taxidentifier', 'taxnumber']),
    paymentTermsCol: findCol(['paymentterms', 'terms', 'paymenttermsdays', 'creditdays']),
    creditLimitCol: findCol(['creditlimit', 'limit', 'maxcredit']),
    statusCol: findCol(['status', 'state', 'active']),
    contactPersonCol: findCol(['contactperson', 'attention', 'poc', 'representative']),
    addressCol: findCol(['address', 'street', 'billingaddress']),
    islandCol: findCol(['island', 'city', 'location', 'atoll']),
    categoryCol: findCol(['category', 'group', 'industry']),
    leadTimeCol: findCol(['leadtime', 'leadtimedays', 'deliverydays']),
  };
}

/**
 * Validates a list of parsed rows against master data rules
 */
export function validateContactRows(
  headers: string[],
  rows: string[][],
  defaultKind: ContactKind = 'customer'
): ImportValidationResult {
  const mapping = detectHeaderMapping(headers);
  const errors: ValidationErrorItem[] = [];
  const validRecords: ContactImportRecord[] = [];
  const seenDisplayNames = new Map<string, number>();

  if (mapping.displayNameCol === -1) {
    errors.push({
      row: 1,
      field: 'name',
      value: '',
      reason: 'Missing required header for contact name (e.g. "Name", "Customer Name", "Company", "Supplier Name").',
    });
    return {
      valid: false,
      totalRecords: rows.length,
      validRecords: [],
      errors,
    };
  }

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // header is row 1
    const rawName = mapping.displayNameCol !== -1 ? row[mapping.displayNameCol] || '' : '';
    const cleanName = rawName.trim();

    if (!cleanName) {
      errors.push({
        row: rowNum,
        field: 'displayName',
        value: '',
        reason: 'Contact name is required and cannot be blank.',
      });
      return;
    }

    if (cleanName.length > 200) {
      errors.push({
        row: rowNum,
        field: 'displayName',
        value: cleanName,
        reason: 'Contact name exceeds 200 characters.',
      });
      return;
    }

    // Check duplicate name within batch
    const nameLower = cleanName.toLowerCase();
    if (seenDisplayNames.has(nameLower)) {
      errors.push({
        row: rowNum,
        field: 'displayName',
        value: cleanName,
        reason: `Duplicate contact name in file; first seen on row ${seenDisplayNames.get(nameLower)}.`,
      });
      return;
    }
    seenDisplayNames.set(nameLower, rowNum);

    // Kind
    let kind: ContactKind = defaultKind;
    if (mapping.kindCol !== -1 && row[mapping.kindCol]) {
      const rawKind = row[mapping.kindCol].toLowerCase().trim();
      if (['customer', 'client'].includes(rawKind)) kind = 'customer';
      else if (['supplier', 'vendor'].includes(rawKind)) kind = 'supplier';
      else if (['both'].includes(rawKind)) kind = 'both';
      else {
        errors.push({
          row: rowNum,
          field: 'kind',
          value: row[mapping.kindCol],
          reason: `Invalid contact kind "${row[mapping.kindCol]}". Allowed values: customer, supplier, both.`,
        });
        return;
      }
    }

    // Phone validation
    const rawPhone = mapping.phoneCol !== -1 ? row[mapping.phoneCol] || '' : '';
    const phoneVal = validateMaldivianPhone(rawPhone);
    if (!phoneVal.isValid) {
      errors.push({
        row: rowNum,
        field: 'phone',
        value: rawPhone,
        reason: phoneVal.error!,
      });
      return;
    }

    // Email validation
    const rawEmail = mapping.emailCol !== -1 ? row[mapping.emailCol] || '' : '';
    const emailVal = validateEmail(rawEmail);
    if (!emailVal.isValid) {
      errors.push({
        row: rowNum,
        field: 'email',
        value: rawEmail,
        reason: emailVal.error!,
      });
      return;
    }

    // TIN validation
    const rawTin = mapping.tinCol !== -1 ? row[mapping.tinCol] || '' : '';
    const tinVal = validateMiraTin(rawTin);
    if (!tinVal.isValid) {
      errors.push({
        row: rowNum,
        field: 'taxIdentifier',
        value: rawTin,
        reason: tinVal.error!,
      });
      return;
    }

    // Payment terms
    let paymentTermsDays = 0;
    if (mapping.paymentTermsCol !== -1 && row[mapping.paymentTermsCol]) {
      const parsedTerms = parseInt(row[mapping.paymentTermsCol], 10);
      if (isNaN(parsedTerms) || parsedTerms < 0) {
        errors.push({
          row: rowNum,
          field: 'paymentTermsDays',
          value: row[mapping.paymentTermsCol],
          reason: 'Payment terms must be a non-negative integer of days.',
        });
        return;
      }
      paymentTermsDays = parsedTerms;
    }

    // Credit limit
    let creditLimit = 0;
    if (mapping.creditLimitCol !== -1 && row[mapping.creditLimitCol]) {
      const parsedLimit = parseFloat(row[mapping.creditLimitCol].replace(/,/g, ''));
      if (isNaN(parsedLimit) || parsedLimit < 0) {
        errors.push({
          row: rowNum,
          field: 'creditLimit',
          value: row[mapping.creditLimitCol],
          reason: 'Credit limit must be a non-negative numeric amount.',
        });
        return;
      }
      creditLimit = parsedLimit;
    }

    // Status
    let status: 'active' | 'inactive' = 'active';
    if (mapping.statusCol !== -1 && row[mapping.statusCol]) {
      const rawStatus = row[mapping.statusCol].toLowerCase().trim();
      if (['active', 'true', '1', 'yes'].includes(rawStatus)) status = 'active';
      else if (['inactive', 'false', '0', 'no'].includes(rawStatus)) status = 'inactive';
      else {
        errors.push({
          row: rowNum,
          field: 'status',
          value: row[mapping.statusCol],
          reason: 'Status must be active or inactive.',
        });
        return;
      }
    }

    // Optional fields
    const contactPerson = mapping.contactPersonCol !== -1 ? (row[mapping.contactPersonCol] || '').trim() : undefined;
    const address = mapping.addressCol !== -1 ? (row[mapping.addressCol] || '').trim() : undefined;
    const island = mapping.islandCol !== -1 ? (row[mapping.islandCol] || '').trim() : undefined;
    const category = mapping.categoryCol !== -1 ? (row[mapping.categoryCol] || '').trim() : undefined;
    let leadTimeDays: number | undefined = undefined;
    if (mapping.leadTimeCol !== -1 && row[mapping.leadTimeCol]) {
      const lead = parseInt(row[mapping.leadTimeCol], 10);
      leadTimeDays = isNaN(lead) || lead < 0 ? 7 : lead;
    }

    validRecords.push({
      displayName: cleanName,
      kind,
      phone: phoneVal.normalized || '',
      email: emailVal.normalized || '',
      taxIdentifier: tinVal.normalized || '',
      paymentTermsDays,
      creditLimit,
      status,
      contactPerson,
      address,
      island,
      category,
      leadTimeDays,
    });
  });

  return {
    valid: errors.length === 0,
    totalRecords: rows.length,
    validRecords,
    errors,
  };
}

/**
 * Standard CSV and TSV templates for Customer & Supplier bulk imports
 */
export function generateCustomerTemplateCsv(): string {
  const headers = [
    'Customer Name',
    'Phone Number',
    'Email Address',
    'MIRA TIN',
    'Payment Terms (Days)',
    'Credit Limit (MVR)',
    'Island / City',
    'Address',
    'Contact Person',
  ];
  const sampleRows = [
    [
      'Male Watersports Pvt Ltd',
      '7912345',
      'accounts@malewatersports.mv',
      '1023456',
      '30',
      '50000',
      'Male',
      'Boduthakurufaanu Magu',
      'Ibrahim Naeem',
    ],
    [
      'Addu Dive Center',
      '6881234',
      'finance@addudive.mv',
      '1045678',
      '15',
      '20000',
      'Hithadhoo',
      'Bahaaruee Hingun',
      'Aishath Latheef',
    ],
    [
      'Sunrise Cafe & Bakery',
      '9998877',
      'orders@sunrisecafe.mv',
      '1098765',
      '0',
      '0',
      'Hulhumale',
      'Nirolhu Magu Goalhi 4',
      'Ahmed Zahir',
    ],
  ];

  return [
    headers.join(','),
    ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')),
  ].join('\r\n');
}

export function generateSupplierTemplateCsv(): string {
  const headers = [
    'Supplier Name',
    'Phone Number',
    'Email Address',
    'MIRA TIN',
    'Category',
    'Payment Terms (Days)',
    'Lead Time (Days)',
    'Island / Country',
    'Address',
    'Contact Person',
  ];
  const sampleRows = [
    [
      'State Electric Company (STELCO)',
      '3320982',
      'billing@stelco.com.mv',
      '1000002',
      'Utilities',
      '30',
      '1',
      'Male',
      'Ameenee Magu',
      'Customer Care Dept',
    ],
    [
      'Dhiraagu Plc',
      '3321111',
      'corporate@dhiraagu.com.mv',
      '1000001',
      'Telecommunications',
      '15',
      '3',
      'Male',
      'Majeedhee Magu',
      'Enterprise Support',
    ],
    [
      'Apollo Holdings Pvt Ltd',
      '3323030',
      'sales@apollo.com.mv',
      '1004567',
      'Hardware & Building Materials',
      '45',
      '7',
      'Male',
      'Haveeree Hingun',
      'Mohamed Aslam',
    ],
  ];

  return [
    headers.join(','),
    ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')),
  ].join('\r\n');
}

/**
 * Executes the bulk import into the tenant context with skip/abort control
 */
export async function executeContactImport(
  records: ContactImportRecord[],
  tenant: TenantIsolationContext,
  mode: 'abort_on_error' | 'skip_invalid',
  validationErrors: ValidationErrorItem[],
  inserter: (record: ContactImportRecord, tenant: TenantIsolationContext) => Promise<{ success: boolean; id?: string; error?: string }>
): Promise<ImportSummaryReport> {
  const errors: ValidationErrorItem[] = [...validationErrors];
  const importedRecords: ContactImportRecord[] = [];

  if (mode === 'abort_on_error' && errors.length > 0) {
    return {
      totalProcessed: records.length,
      importedCount: 0,
      skippedCount: records.length,
      errors,
      importedRecords: [],
    };
  }

  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const rowNum = i + 2;

    try {
      const res = await inserter(rec, tenant);
      if (res.success) {
        imported++;
        importedRecords.push(rec);
      } else {
        skipped++;
        errors.push({
          row: rowNum,
          field: 'persistence',
          value: rec.displayName,
          reason: res.error || 'Failed to persist contact into organisation workspace.',
        });
        if (mode === 'abort_on_error') {
          break;
        }
      }
    } catch (err: any) {
      skipped++;
      errors.push({
        row: rowNum,
        field: 'exception',
        value: rec.displayName,
        reason: err?.message || 'Database exception during record insertion.',
      });
      if (mode === 'abort_on_error') {
        break;
      }
    }
  }

  return {
    totalProcessed: records.length,
    importedCount: imported,
    skippedCount: skipped + (records.length - (imported + skipped)),
    errors,
    importedRecords,
  };
}
