/**
 * SERP-302: Universal CSV/XLSX Data Ingestion Framework & Validator
 * Domain Types and Interfaces
 */

export type IngestionTarget = 'contacts' | 'products' | 'price_lists' | 'opening_balances';

export type FieldDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'email'
  | 'phone_mv'
  | 'tin_mv'
  | 'enum'
  | 'currency';

export interface FieldDefinition {
  key: string;
  label: string;
  dataType: FieldDataType;
  required: boolean;
  description: string;
  example: string;
  allowedValues?: string[];
  aliases?: string[];
  defaultValue?: any;
  validator?: (value: any, row: Record<string, any>, context: IngestionValidationContext) => string | null;
  foreignReference?: {
    targetTable: string;
    targetField: string;
    description?: string;
  };
}

export interface TargetSchema {
  target: IngestionTarget;
  label: string;
  description: string;
  fields: FieldDefinition[];
  uniqueKeys?: string[][]; // Single or compound unique keys within upload file
  sampleCsvTemplate?: string;
  validateRecordSet?: (records: Record<string, any>[], context: IngestionValidationContext) => RowValidationError[];
}

export interface IngestionValidationContext {
  organisationId?: string;
  currency?: string;
  existingKeys?: Set<string>;
  foreignReferences?: Record<string, Set<string>>; // keyed by "table.field" or "table"
}

export interface ColumnMapping {
  sourceHeader: string;
  targetField: string | null; // null means ignored
  confidence: number; // 0 to 100
  sampleValues: string[];
}

export type ErrorSeverity = 'error' | 'warning';

export interface RowValidationError {
  rowIndex: number; // 1-indexed (spreadsheet row)
  column: string;
  fieldKey: string;
  value: any;
  error: string;
  severity: ErrorSeverity;
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  errors: RowValidationError[];
  duplicateKeyErrors: RowValidationError[];
  isValid: boolean;
  parsedRecords: Record<string, any>[];
}

export type IngestionMode = 'all_or_nothing' | 'skip_invalid';

export interface IngestionExecutionOptions {
  mode: IngestionMode;
  batchSize?: number;
  dryRun?: boolean;
  onProgress?: (progress: { processed: number; total: number; percent: number }) => void;
}

export interface IngestionExecutionResult {
  success: boolean;
  target: IngestionTarget;
  batchId: string;
  totalProcessed: number;
  insertedCount: number;
  failedCount: number;
  durationMs: number;
  rolledBack: boolean;
  errors: RowValidationError[];
  message: string;
}
