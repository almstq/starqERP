/**
 * SERP-302: Built-in Ingestion Target Schemas & Auto-Mapping Heuristics
 */

import { TargetSchema, IngestionTarget, ColumnMapping, RowValidationError } from './types';

// Maldivian Phone Number Validator:
// Mobile: 7xxxxxx or 9xxxxxx (7 digits)
// Landline: 3xxxxxx or 6xxxxxx (7 digits)
// Optional +960 or 00960 country code prefix
export function validateMaldivianPhone(value: any): string | null {
  if (!value || String(value).trim() === '') return null; // optional
  const clean = String(value).replace(/[\s\-\(\)]/g, '');
  const pattern = /^(?:\+?960|00960)?([3679]\d{6})$/;
  if (!pattern.test(clean)) {
    return 'Invalid Maldivian phone number (expected 7 digits starting with 7, 9, 3, or 6, or +960 prefix)';
  }
  return null;
}

// Maldivian MIRA TIN Validator:
// Typically 7 numeric digits (e.g. 1000001) or standard tax prefix (e.g. GST-1000001, G1000001, B1000001)
export function validateMiraTin(value: any): string | null {
  if (!value || String(value).trim() === '') return null; // optional
  const clean = String(value).trim().toUpperCase();
  const pattern = /^(?:[GBT]-?|GST-?)?\d{7}$/i;
  if (!pattern.test(clean)) {
    return 'Invalid MIRA TIN format (expected 7-digit tax identification number, e.g. 1023456 or G1023456)';
  }
  return null;
}

export function validateEmail(value: any): string | null {
  if (!value || String(value).trim() === '') return null;
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(String(value).trim())) {
    return 'Invalid email address format';
  }
  return null;
}

// Target Schema: Contacts (Customers & Suppliers)
export const CONTACTS_SCHEMA: TargetSchema = {
  target: 'contacts',
  label: 'Customers & Suppliers',
  description: 'Bulk import business clients, vendors, phone contacts, TINs, and credit terms.',
  fields: [
    {
      key: 'display_name',
      label: 'Contact Name',
      dataType: 'string',
      required: true,
      description: 'Full legal or business trading name',
      example: 'Male Watersports Pvt Ltd',
      aliases: ['name', 'customer name', 'vendor name', 'supplier name', 'client name', 'company', 'contact_name', 'business name'],
    },
    {
      key: 'kind',
      label: 'Contact Type',
      dataType: 'enum',
      required: false,
      defaultValue: 'customer',
      description: 'Type of relationship with the entity',
      example: 'customer',
      allowedValues: ['customer', 'supplier', 'both'],
      aliases: ['type', 'category', 'role', 'contact_type', 'entity_type'],
    },
    {
      key: 'phone',
      label: 'Phone Number',
      dataType: 'phone_mv',
      required: false,
      description: 'Maldivian mobile or landline number',
      example: '7991234',
      aliases: ['mobile', 'telephone', 'phone no', 'contact number', 'phone_number', 'cell', 'mobile_no'],
      validator: (val) => validateMaldivianPhone(val),
    },
    {
      key: 'email',
      label: 'Email Address',
      dataType: 'email',
      required: false,
      description: 'Primary commercial billing or contact email',
      example: 'billing@malewatersports.mv',
      aliases: ['e-mail', 'mail', 'email_address', 'contact_email'],
      validator: (val) => validateEmail(val),
    },
    {
      key: 'tax_identifier',
      label: 'MIRA TIN (Tax Number)',
      dataType: 'tin_mv',
      required: false,
      description: 'MIRA registered Taxpayer Identification Number',
      example: '1023456',
      aliases: ['tin', 'tax id', 'tax_number', 'gst no', 'gst number', 'mira tin', 'mira_tin'],
      validator: (val) => validateMiraTin(val),
    },
    {
      key: 'payment_terms_days',
      label: 'Payment Terms (Days)',
      dataType: 'number',
      required: false,
      defaultValue: 0,
      description: 'Credit payment duration in days',
      example: '30',
      aliases: ['terms', 'payment terms', 'credit days', 'terms_days', 'due_days'],
    },
    {
      key: 'credit_limit',
      label: 'Credit Limit',
      dataType: 'number',
      required: false,
      defaultValue: 0,
      description: 'Maximum permitted outstanding credit balance',
      example: '50000',
      aliases: ['limit', 'credit_limit', 'max credit'],
    },
    {
      key: 'status',
      label: 'Status',
      dataType: 'enum',
      required: false,
      defaultValue: 'active',
      description: 'Record active state',
      example: 'active',
      allowedValues: ['active', 'inactive'],
      aliases: ['state', 'is_active', 'active_status'],
    },
  ],
  uniqueKeys: [['display_name']],
  sampleCsvTemplate: `Contact Name,Contact Type,Phone Number,Email Address,MIRA TIN,Payment Terms (Days),Credit Limit
Island Express Logistics,customer,7912345,accounts@islandexpress.mv,1098765,30,25000
Dhiraagu Maldives,supplier,3321111,support@dhiraagu.com.mv,1000001,15,50000
Villa Trading Co,both,7788990,info@villatrading.com,1045678,45,100000`,
};

// Target Schema: Products (Catalogue & Stock Items)
export const PRODUCTS_SCHEMA: TargetSchema = {
  target: 'products',
  label: 'Product Catalogue',
  description: 'Bulk import sellable products, services, barcodes, tax classifications, and prices.',
  fields: [
    {
      key: 'sku',
      label: 'SKU (Item Code)',
      dataType: 'string',
      required: true,
      description: 'Unique internal Stock Keeping Unit code',
      example: 'BEV-COKE-330',
      aliases: ['item code', 'product code', 'part number', 'item_no', 'code', 'product_id', 'sku_code'],
    },
    {
      key: 'name',
      label: 'Product Name',
      dataType: 'string',
      required: true,
      description: 'Commercial title or description of item',
      example: 'Coca Cola 330ml Can',
      aliases: ['product_name', 'item name', 'description', 'title', 'item_description'],
    },
    {
      key: 'kind',
      label: 'Product Kind',
      dataType: 'enum',
      required: false,
      defaultValue: 'stock',
      description: 'Category of item tracking',
      example: 'stock',
      allowedValues: ['stock', 'service', 'consumable'],
      aliases: ['item type', 'product type', 'type', 'kind'],
    },
    {
      key: 'barcode',
      label: 'Barcode (EAN/UPC)',
      dataType: 'string',
      required: false,
      description: 'Scannable manufacturer barcode',
      example: '5449000000996',
      aliases: ['ean', 'upc', 'barcode_number', 'gtin', 'scan_code'],
    },
    {
      key: 'tax_classification',
      label: 'Tax Classification',
      dataType: 'enum',
      required: false,
      defaultValue: 'standard_rated',
      description: 'MIRA GST classification',
      example: 'standard_rated',
      allowedValues: ['standard_rated', 'zero_rated', 'exempt'],
      aliases: ['tax', 'gst', 'tax rate', 'tax_mode', 'tax_type', 'gst_rate'],
    },
    {
      key: 'price',
      label: 'Selling Price (MVR)',
      dataType: 'number',
      required: false,
      defaultValue: 0,
      description: 'Default retail selling price excluding or including tax',
      example: '15.00',
      aliases: ['sales price', 'unit price', 'rate', 'retail price', 'selling_price', 'mvr price'],
    },
    {
      key: 'cost',
      label: 'Purchase Cost (MVR)',
      dataType: 'number',
      required: false,
      defaultValue: 0,
      description: 'Standard purchase or acquisition cost',
      example: '8.50',
      aliases: ['purchase price', 'unit cost', 'standard cost', 'buying price', 'cost_price'],
    },
    {
      key: 'reorder_threshold',
      label: 'Reorder Level',
      dataType: 'number',
      required: false,
      defaultValue: 0,
      description: 'Minimum stock quantity before alert',
      example: '10',
      aliases: ['min stock', 'reorder level', 'minimum quantity', 'safety stock'],
    },
    {
      key: 'sale_allowed',
      label: 'Sale Allowed',
      dataType: 'boolean',
      required: false,
      defaultValue: true,
      description: 'Whether item is active on POS terminal',
      example: 'true',
      aliases: ['can sell', 'active for sale', 'pos active', 'for sale'],
    },
  ],
  uniqueKeys: [['sku']],
  sampleCsvTemplate: `SKU,Product Name,Product Kind,Barcode,Tax Classification,Selling Price (MVR),Purchase Cost (MVR),Reorder Level
BEV-COKE-330,Coca Cola 330ml,stock,5449000000996,standard_rated,15.00,8.50,24
SRV-AC-CLEAN,AC Full Chemical Cleaning,service,,standard_rated,850.00,200.00,0
STN-A4-PAPER,A4 Copy Paper 80GSM,stock,8901234567890,zero_rated,75.00,50.00,10`,
};

// Target Schema: Opening Balances (General Ledger Migration)
export const OPENING_BALANCES_SCHEMA: TargetSchema = {
  target: 'opening_balances',
  label: 'Chart of Accounts Opening Balances',
  description: 'Import initial account balances with strict debits === credits double-entry balance check.',
  fields: [
    {
      key: 'account_code',
      label: 'Account Code',
      dataType: 'string',
      required: true,
      description: 'Standard General Ledger Account Code',
      example: '1010',
      aliases: ['code', 'account no', 'gl code', 'account_number', 'gl_account'],
      foreignReference: {
        targetTable: 'chart_of_accounts',
        targetField: 'code',
        description: 'Account code must exist in the active chart of accounts',
      },
    },
    {
      key: 'account_name',
      label: 'Account Name',
      dataType: 'string',
      required: false,
      description: 'Descriptive title of ledger account',
      example: 'Cash at Bank - BML MVR',
      aliases: ['name', 'description', 'account title', 'account_description'],
    },
    {
      key: 'debit',
      label: 'Debit Amount (MVR)',
      dataType: 'number',
      required: false,
      defaultValue: 0,
      description: 'Opening debit balance',
      example: '125000.00',
      aliases: ['dr', 'debit', 'debit_amount', 'dr_amount'],
    },
    {
      key: 'credit',
      label: 'Credit Amount (MVR)',
      dataType: 'number',
      required: false,
      defaultValue: 0,
      description: 'Opening credit balance',
      example: '0.00',
      aliases: ['cr', 'credit', 'credit_amount', 'cr_amount'],
    },
  ],
  uniqueKeys: [['account_code']],
  validateRecordSet: (records) => {
    const errors: RowValidationError[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    records.forEach((rec, idx) => {
      const dr = parseFloat(rec.debit) || 0;
      const cr = parseFloat(rec.credit) || 0;
      totalDebit += dr;
      totalCredit += cr;

      if (dr < 0 || cr < 0) {
        errors.push({
          rowIndex: idx + 2,
          column: dr < 0 ? 'debit' : 'credit',
          fieldKey: dr < 0 ? 'debit' : 'credit',
          value: dr < 0 ? dr : cr,
          error: 'Negative balances are prohibited in double-entry opening balances',
          severity: 'error',
        });
      }
    });

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.005) {
      errors.push({
        rowIndex: 1,
        column: 'debit/credit',
        fieldKey: 'balance',
        value: { totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2), difference: diff.toFixed(2) },
        error: `Out of balance: Total Debits (${totalDebit.toFixed(2)}) must equal Total Credits (${totalCredit.toFixed(2)}). Discrepancy: ${diff.toFixed(2)} MVR`,
        severity: 'error',
      });
    }

    return errors;
  },
  sampleCsvTemplate: `Account Code,Account Name,Debit Amount (MVR),Credit Amount (MVR)
1010,Cash on Hand,15000.00,0.00
1020,Bank of Maldives MVR,245000.00,0.00
1200,Accounts Receivable,68500.00,0.00
2010,Accounts Payable,0.00,42500.00
3010,Owner Capital,0.00,286000.00`,
};

export const SCHEMAS: Record<IngestionTarget, TargetSchema> = {
  contacts: CONTACTS_SCHEMA,
  products: PRODUCTS_SCHEMA,
  opening_balances: OPENING_BALANCES_SCHEMA,
  price_lists: PRODUCTS_SCHEMA, // reuses product schema with pricing focus
};

/**
 * Heuristic auto-mapping engine matching uploaded headers to schema fields.
 */
export function autoMapColumns(headers: string[], schema: TargetSchema, sampleRows: string[][] = []): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const assignedFields = new Set<string>();

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const rawHeader = headers[colIdx];
    const cleanHeader = rawHeader.toLowerCase().trim();
    const normHeader = cleanHeader.replace(/[^a-z0-9]+/g, ' ').trim();
    const samples = sampleRows.slice(0, 3).map((r) => r[colIdx] ?? '').filter((v) => v !== '');

    let bestMatch: string | null = null;
    let highestConfidence = 0;

    for (const field of schema.fields) {
      if (assignedFields.has(field.key)) continue;

      const normFieldKey = field.key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const normFieldLabel = field.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

      // 1. Exact match on key or label
      if (normHeader === normFieldKey || normHeader === normFieldLabel) {
        bestMatch = field.key;
        highestConfidence = 100;
        break;
      }

      // 2. Exact match on an alias
      if (field.aliases) {
        for (const alias of field.aliases) {
          const normAlias = alias.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
          if (normHeader === normAlias) {
            bestMatch = field.key;
            highestConfidence = 95;
            break;
          }
          if (normHeader.includes(normAlias) || normAlias.includes(normHeader)) {
            if (highestConfidence < 85) {
              bestMatch = field.key;
              highestConfidence = 85;
            }
          }
        }
      }
      if (highestConfidence >= 95) break;

      // 3. Substring / partial match on key or label
      if (normHeader.includes(normFieldKey) || normFieldKey.includes(normHeader) || normFieldLabel.includes(normHeader)) {
        if (highestConfidence < 80) {
          bestMatch = field.key;
          highestConfidence = 80;
        }
      }
    }

    if (bestMatch && highestConfidence >= 70) {
      assignedFields.add(bestMatch);
      mappings.push({
        sourceHeader: rawHeader,
        targetField: bestMatch,
        confidence: highestConfidence,
        sampleValues: samples,
      });
    } else {
      mappings.push({
        sourceHeader: rawHeader,
        targetField: null,
        confidence: 0,
        sampleValues: samples,
      });
    }
  }

  return mappings;
}
