/**
 * SERP-304: Narrowed Product Catalog & SKU Master Data Bulk Import Domain
 *
 * Implements validation, parsing, template generation, and tenant-scoped import
 * for Products and SKUs against EXISTING schema columns:
 * - public.products: sku, kind ('service'|'stock'|'consumable'), name, income_account,
 *   cogs_account, inventory_account, active, sale_allowed.
 * - public.product_prices: amount (selling price), currency ('MVR').
 *
 * (Note: Barcode, UoM, reorder levels are tracked as a separate gap per #16008).
 */

import { parseDelimitedText, ValidationErrorItem } from './contactBulkImport';

export type ProductKind = 'service' | 'stock' | 'consumable';

export interface ProductImportRecord {
  sku: string;
  name: string;
  kind: ProductKind;
  sellingPrice: number;
  costPrice: number;
  incomeAccount?: string;
  cogsAccount?: string;
  inventoryAccount?: string;
  active: boolean;
  saleAllowed: boolean;
  category?: string;
  initialQuantity?: number;
}

export interface ProductValidationResult {
  valid: boolean;
  totalRecords: number;
  validRecords: ProductImportRecord[];
  errors: ValidationErrorItem[];
}

export interface ProductImportSummaryReport {
  totalProcessed: number;
  importedCount: number;
  skippedCount: number;
  errors: ValidationErrorItem[];
  importedRecords: ProductImportRecord[];
}

export interface ProductHeaderMapping {
  skuCol: number;
  nameCol: number;
  kindCol: number;
  sellingPriceCol: number;
  costPriceCol: number;
  incomeAccountCol: number;
  cogsAccountCol: number;
  inventoryAccountCol: number;
  activeCol: number;
  saleAllowedCol: number;
  categoryCol: number;
  quantityCol: number;
}

export function detectProductHeaderMapping(headers: string[]): ProductHeaderMapping {
  const findCol = (aliases: string[]): number => {
    // 1. Exact match
    const exactIdx = headers.findIndex((h) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return aliases.some((a) => clean === a.toLowerCase().replace(/[^a-z0-9]/g, ''));
    });
    if (exactIdx !== -1) return exactIdx;

    // 2. Substring match
    return headers.findIndex((h) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return aliases.some((a) => {
        const cleanA = a.toLowerCase().replace(/[^a-z0-9]/g, '');
        return clean.includes(cleanA) || cleanA.includes(clean);
      });
    });
  };

  return {
    skuCol: findCol(['sku', 'itemcode', 'productcode', 'partnumber', 'partno', 'code']),
    nameCol: findCol(['productname', 'itemname', 'name', 'description', 'title']),
    kindCol: findCol(['kind', 'producttype', 'itemtype', 'type']),
    sellingPriceCol: findCol(['sellingprice', 'saleprice', 'retailprice', 'price', 'unitprice', 'rate']),
    costPriceCol: findCol(['costprice', 'unitcost', 'purchasecost', 'buyprice', 'cost']),
    incomeAccountCol: findCol(['incomeaccount', 'salesaccount', 'revenueaccount']),
    cogsAccountCol: findCol(['cogsaccount', 'expenseaccount', 'costaccount']),
    inventoryAccountCol: findCol(['inventoryaccount', 'assetaccount', 'stockaccount']),
    activeCol: findCol(['active', 'isactive', 'status']),
    saleAllowedCol: findCol(['saleallowed', 'forsale', 'allowsale', 'canbesold']),
    categoryCol: findCol(['category', 'productcategory', 'group']),
    quantityCol: findCol(['quantity', 'openingstock', 'stock', 'initialquantity', 'qty']),
  };
}

export function validateProductRows(
  headers: string[],
  rows: string[][],
  existingSkus: Set<string> = new Set()
): ProductValidationResult {
  const mapping = detectProductHeaderMapping(headers);
  const errors: ValidationErrorItem[] = [];
  const validRecords: ProductImportRecord[] = [];
  const seenSkusInBatch = new Map<string, number>();

  if (mapping.skuCol === -1 || mapping.nameCol === -1) {
    if (mapping.skuCol === -1) {
      errors.push({
        row: 1,
        field: 'sku',
        value: '',
        reason: 'Missing required header for SKU/Code (e.g. "SKU", "Item Code", "Product Code").',
      });
    }
    if (mapping.nameCol === -1) {
      errors.push({
        row: 1,
        field: 'name',
        value: '',
        reason: 'Missing required header for Product Name (e.g. "Name", "Product Name", "Description").',
      });
    }
    return {
      valid: false,
      totalRecords: rows.length,
      validRecords: [],
      errors,
    };
  }

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const rawSku = (row[mapping.skuCol] || '').trim();
    const rawName = (row[mapping.nameCol] || '').trim();

    // 1. SKU validation
    if (!rawSku) {
      errors.push({
        row: rowNum,
        field: 'sku',
        value: '',
        reason: 'SKU cannot be empty.',
      });
      return;
    }

    if (rawSku.length > 64) {
      errors.push({
        row: rowNum,
        field: 'sku',
        value: rawSku,
        reason: 'SKU exceeds 64 characters limit.',
      });
      return;
    }

    const skuUpper = rawSku.toUpperCase();
    if (seenSkusInBatch.has(skuUpper)) {
      errors.push({
        row: rowNum,
        field: 'sku',
        value: rawSku,
        reason: `Duplicate SKU "${rawSku}" in file; first seen on row ${seenSkusInBatch.get(skuUpper)}.`,
      });
      return;
    }
    seenSkusInBatch.set(skuUpper, rowNum);

    if (existingSkus.has(skuUpper)) {
      errors.push({
        row: rowNum,
        field: 'sku',
        value: rawSku,
        reason: `SKU "${rawSku}" already exists in the organization catalog.`,
      });
      return;
    }

    // 2. Name validation
    if (!rawName) {
      errors.push({
        row: rowNum,
        field: 'name',
        value: '',
        reason: 'Product name cannot be empty.',
      });
      return;
    }

    // 3. Kind validation ('service' | 'stock' | 'consumable')
    let kind: ProductKind = 'stock';
    if (mapping.kindCol !== -1 && row[mapping.kindCol]) {
      const rawKind = row[mapping.kindCol].toLowerCase().trim();
      if (['stock', 'goods', 'product', 'inventory'].includes(rawKind)) {
        kind = 'stock';
      } else if (['service', 'labor', 'labour'].includes(rawKind)) {
        kind = 'service';
      } else if (['consumable', 'supply', 'supplies'].includes(rawKind)) {
        kind = 'consumable';
      } else {
        errors.push({
          row: rowNum,
          field: 'kind',
          value: row[mapping.kindCol],
          reason: `Invalid product kind "${row[mapping.kindCol]}". Allowed values: stock, service, consumable.`,
        });
        return;
      }
    }

    // 4. Selling Price (public.product_prices)
    let sellingPrice = 0;
    if (mapping.sellingPriceCol !== -1 && row[mapping.sellingPriceCol]) {
      const rawPrice = row[mapping.sellingPriceCol].replace(/,/g, '').trim();
      const num = parseFloat(rawPrice);
      if (isNaN(num) || num < 0) {
        errors.push({
          row: rowNum,
          field: 'sellingPrice',
          value: row[mapping.sellingPriceCol],
          reason: 'Selling price must be a non-negative number.',
        });
        return;
      }
      sellingPrice = num;
    }

    // 5. Cost Price
    let costPrice = 0;
    if (mapping.costPriceCol !== -1 && row[mapping.costPriceCol]) {
      const rawCost = row[mapping.costPriceCol].replace(/,/g, '').trim();
      const num = parseFloat(rawCost);
      if (isNaN(num) || num < 0) {
        errors.push({
          row: rowNum,
          field: 'costPrice',
          value: row[mapping.costPriceCol],
          reason: 'Cost price must be a non-negative number.',
        });
        return;
      }
      costPrice = num;
    }

    // 6. Active flag
    let active = true;
    if (mapping.activeCol !== -1 && row[mapping.activeCol]) {
      const val = row[mapping.activeCol].toLowerCase().trim();
      if (['false', '0', 'no', 'inactive'].includes(val)) active = false;
    }

    // 7. Sale Allowed flag
    let saleAllowed = true;
    if (mapping.saleAllowedCol !== -1 && row[mapping.saleAllowedCol]) {
      const val = row[mapping.saleAllowedCol].toLowerCase().trim();
      if (['false', '0', 'no'].includes(val)) saleAllowed = false;
    }

    // Accounts
    const incomeAccount = mapping.incomeAccountCol !== -1 ? (row[mapping.incomeAccountCol] || '').trim() || undefined : undefined;
    const cogsAccount = mapping.cogsAccountCol !== -1 ? (row[mapping.cogsAccountCol] || '').trim() || undefined : undefined;
    const inventoryAccount = mapping.inventoryAccountCol !== -1 ? (row[mapping.inventoryAccountCol] || '').trim() || undefined : undefined;
    const category = mapping.categoryCol !== -1 ? (row[mapping.categoryCol] || '').trim() || undefined : undefined;

    let initialQuantity = 0;
    if (mapping.quantityCol !== -1 && row[mapping.quantityCol]) {
      const q = parseFloat(row[mapping.quantityCol].replace(/,/g, ''));
      if (!isNaN(q) && q >= 0) initialQuantity = q;
    }

    validRecords.push({
      sku: rawSku,
      name: rawName,
      kind,
      sellingPrice,
      costPrice,
      incomeAccount,
      cogsAccount,
      inventoryAccount,
      active,
      saleAllowed,
      category,
      initialQuantity,
    });
  });

  return {
    valid: errors.length === 0,
    totalRecords: rows.length,
    validRecords,
    errors,
  };
}

export function generateProductTemplateCsv(): string {
  const headers = [
    'SKU',
    'Product Name',
    'Kind',
    'Category',
    'Selling Price (MVR)',
    'Cost Price (MVR)',
    'Initial Quantity',
    'Income Account',
    'COGS Account',
    'Inventory Account',
    'Active',
    'Sale Allowed',
  ];

  const sampleRows = [
    [
      'OIL-5W30-1L',
      'Synthetic Motor Oil 5W-30 (1L)',
      'stock',
      'Lubricants',
      '185.00',
      '110.00',
      '48',
      '4010',
      '5010',
      '1300',
      'true',
      'true',
    ],
    [
      'FLT-OIL-TY01',
      'Engine Oil Filter Toyota',
      'stock',
      'Filters',
      '95.00',
      '45.00',
      '25',
      '4010',
      '5010',
      '1300',
      'true',
      'true',
    ],
    [
      'SRV-DIAG-01',
      'Comprehensive OBD-II Diagnostic Scan',
      'service',
      'Services',
      '350.00',
      '0.00',
      '0',
      '4020',
      '5020',
      '',
      'true',
      'true',
    ],
  ];

  return [
    headers.join(','),
    ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')),
  ].join('\r\n');
}

export async function executeProductImport(
  records: ProductImportRecord[],
  tenant: { organisationId: string },
  mode: 'abort_on_error' | 'skip_invalid',
  validationErrors: ValidationErrorItem[],
  inserter: (record: ProductImportRecord, tenant: { organisationId: string }) => Promise<{ success: boolean; id?: string; error?: string }>
): Promise<ProductImportSummaryReport> {
  const errors: ValidationErrorItem[] = [...validationErrors];
  const importedRecords: ProductImportRecord[] = [];

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
          value: rec.sku,
          reason: res.error || 'Failed to insert product record.',
        });
        if (mode === 'abort_on_error') break;
      }
    } catch (err: any) {
      skipped++;
      errors.push({
        row: rowNum,
        field: 'exception',
        value: rec.sku,
        reason: err?.message || 'Database exception during product insertion.',
      });
      if (mode === 'abort_on_error') break;
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
