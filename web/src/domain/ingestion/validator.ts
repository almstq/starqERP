/**
 * SERP-302: Universal Row-by-Row Ingestion Validator & Duplicate Key Detector
 */

import {
  TargetSchema,
  ColumnMapping,
  RowValidationError,
  ValidationSummary,
  IngestionValidationContext,
} from './types';
import { exportToCsv } from './csvParser';

/**
 * Validates parsed raw tabular rows against the target schema and active column mappings.
 */
export function validateDataset(
  rawHeaders: string[],
  rawRows: string[][],
  mappings: ColumnMapping[],
  schema: TargetSchema,
  context: IngestionValidationContext = {}
): ValidationSummary {
  const errors: RowValidationError[] = [];
  const duplicateKeyErrors: RowValidationError[] = [];
  const parsedRecords: Record<string, any>[] = [];

  // Build mapping lookup: colIndex -> FieldDefinition
  const colToFieldMap = new Map<number, (typeof schema.fields)[0]>();
  const activeFields = new Set<string>();

  mappings.forEach((mapping) => {
    if (!mapping.targetField) return;
    const colIdx = rawHeaders.indexOf(mapping.sourceHeader);
    if (colIdx === -1) return;

    const fieldDef = schema.fields.find((f) => f.key === mapping.targetField);
    if (fieldDef) {
      colToFieldMap.set(colIdx, fieldDef);
      activeFields.add(fieldDef.key);
    }
  });

  // Check if all required fields are mapped
  schema.fields.forEach((field) => {
    if (field.required && !activeFields.has(field.key)) {
      errors.push({
        rowIndex: 1, // Header level
        column: 'Headers',
        fieldKey: field.key,
        value: null,
        error: `Required schema field "${field.label}" (${field.key}) is not mapped to any column.`,
        severity: 'error',
      });
    }
  });

  // Unique keys tracking within the dataset
  // key: uniqueKeyName -> Map<serializedValue, firstRowIndex>
  const uniqueTrackers = new Map<string, Map<string, number>>();
  if (schema.uniqueKeys) {
    schema.uniqueKeys.forEach((keyGroup) => {
      const groupName = keyGroup.join('+');
      uniqueTrackers.set(groupName, new Map<string, number>());
    });
  }

  // Row-by-row validation (rows are 1-indexed for user display, +1 for header = rowIndex + 2)
  rawRows.forEach((row, rowIdx) => {
    const displayRowIndex = rowIdx + 2; // Row 1 is header
    const record: Record<string, any> = {};
    let rowHasError = false;

    colToFieldMap.forEach((fieldDef, colIdx) => {
      const rawValue = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
      const colHeader = rawHeaders[colIdx] || `Column ${colIdx + 1}`;

      // 1. Required Check
      if (fieldDef.required && rawValue === '') {
        errors.push({
          rowIndex: displayRowIndex,
          column: colHeader,
          fieldKey: fieldDef.key,
          value: '',
          error: `Missing required field: "${fieldDef.label}" cannot be empty.`,
          severity: 'error',
        });
        rowHasError = true;
        record[fieldDef.key] = null;
        return;
      }

      // If empty and optional, assign default value or null
      if (rawValue === '') {
        record[fieldDef.key] = fieldDef.defaultValue !== undefined ? fieldDef.defaultValue : null;
        return;
      }

      // 2. Data Type Coercion & Validation
      let parsedValue: any = rawValue;

      switch (fieldDef.dataType) {
        case 'number':
        case 'currency': {
          const num = parseFloat(rawValue.replace(/,/g, ''));
          if (isNaN(num)) {
            errors.push({
              rowIndex: displayRowIndex,
              column: colHeader,
              fieldKey: fieldDef.key,
              value: rawValue,
              error: `Invalid number: "${rawValue}" cannot be parsed as a numeric value.`,
              severity: 'error',
            });
            rowHasError = true;
          } else {
            parsedValue = num;
          }
          break;
        }

        case 'boolean': {
          const lower = rawValue.toLowerCase();
          if (['true', '1', 'yes', 'y', 't'].includes(lower)) {
            parsedValue = true;
          } else if (['false', '0', 'no', 'n', 'f'].includes(lower)) {
            parsedValue = false;
          } else {
            errors.push({
              rowIndex: displayRowIndex,
              column: colHeader,
              fieldKey: fieldDef.key,
              value: rawValue,
              error: `Invalid boolean: "${rawValue}" must be Yes/No or True/False.`,
              severity: 'error',
            });
            rowHasError = true;
          }
          break;
        }

        case 'enum': {
          const normVal = rawValue.toLowerCase().replace(/[\s\-_]+/g, '_');
          if (fieldDef.allowedValues && !fieldDef.allowedValues.includes(normVal)) {
            errors.push({
              rowIndex: displayRowIndex,
              column: colHeader,
              fieldKey: fieldDef.key,
              value: rawValue,
              error: `Invalid option "${rawValue}". Allowed values: ${fieldDef.allowedValues.join(', ')}.`,
              severity: 'error',
            });
            rowHasError = true;
          } else {
            parsedValue = normVal;
          }
          break;
        }

        case 'date': {
          const d = new Date(rawValue);
          if (isNaN(d.getTime())) {
            errors.push({
              rowIndex: displayRowIndex,
              column: colHeader,
              fieldKey: fieldDef.key,
              value: rawValue,
              error: `Invalid date: "${rawValue}" is not a recognizable date format.`,
              severity: 'error',
            });
            rowHasError = true;
          } else {
            parsedValue = d.toISOString().split('T')[0];
          }
          break;
        }

        default:
          parsedValue = rawValue;
      }

      // 3. Custom Field Validator (e.g. phone_mv, tin_mv, email)
      if (fieldDef.validator && !rowHasError) {
        const valError = fieldDef.validator(parsedValue, record, context);
        if (valError) {
          errors.push({
            rowIndex: displayRowIndex,
            column: colHeader,
            fieldKey: fieldDef.key,
            value: rawValue,
            error: valError,
            severity: 'error',
          });
          rowHasError = true;
        }
      }

      // 3b. Foreign Reference Validation (SSOT AC2)
      if (fieldDef.foreignReference && !rowHasError && parsedValue !== null && parsedValue !== '') {
        const refKey = `${fieldDef.foreignReference.targetTable}.${fieldDef.foreignReference.targetField}`;
        const allowedRefs =
          context.foreignReferences?.[refKey] ||
          context.foreignReferences?.[fieldDef.foreignReference.targetTable];

        if (allowedRefs && allowedRefs.size > 0) {
          const valStr = String(parsedValue).trim();
          if (!allowedRefs.has(valStr)) {
            errors.push({
              rowIndex: displayRowIndex,
              column: colHeader,
              fieldKey: fieldDef.key,
              value: rawValue,
              error: `Foreign reference violation: Value "${rawValue}" does not exist in ${fieldDef.foreignReference.targetTable} (${fieldDef.foreignReference.targetField}).`,
              severity: 'error',
            });
            rowHasError = true;
          }
        }
      }

      record[fieldDef.key] = parsedValue;
    });

    // 4. Duplicate Key Check within this file
    if (schema.uniqueKeys && !rowHasError) {
      schema.uniqueKeys.forEach((keyGroup) => {
        const groupName = keyGroup.join('+');
        const tracker = uniqueTrackers.get(groupName);
        if (!tracker) return;

        const compositeVal = keyGroup.map((k) => String(record[k] ?? '')).join('|');
        if (compositeVal && !compositeVal.includes('null') && compositeVal.trim() !== '') {
          if (tracker.has(compositeVal)) {
            const firstSeenRow = tracker.get(compositeVal)!;
            const dupErr: RowValidationError = {
              rowIndex: displayRowIndex,
              column: keyGroup.join(', '),
              fieldKey: groupName,
              value: compositeVal,
              error: `Duplicate key violation: Value "${compositeVal}" was already seen on row ${firstSeenRow}.`,
              severity: 'error',
            };
            errors.push(dupErr);
            duplicateKeyErrors.push(dupErr);
            rowHasError = true;
          } else {
            tracker.set(compositeVal, displayRowIndex);
          }
        }
      });
    }

    parsedRecords.push(record);
  });

  // 5. Schema-Level Record Set Validation (e.g. Debits === Credits balance)
  if (schema.validateRecordSet) {
    const setErrors = schema.validateRecordSet(parsedRecords, context);
    errors.push(...setErrors);
  }

  // Count error rows uniquely
  const errorRowIndices = new Set(errors.filter((e) => e.severity === 'error').map((e) => e.rowIndex));
  const warningRowIndices = new Set(errors.filter((e) => e.severity === 'warning').map((e) => e.rowIndex));

  const totalRows = rawRows.length;
  const errorRows = errorRowIndices.size;
  const validRows = Math.max(0, totalRows - errorRows);

  return {
    totalRows,
    validRows,
    errorRows,
    warningRows: warningRowIndices.size,
    errors,
    duplicateKeyErrors,
    isValid: errors.filter((e) => e.severity === 'error').length === 0,
    parsedRecords,
  };
}

/**
 * Exports validation errors to an easily readable CSV file for user download.
 */
export function exportValidationErrorsToCsv(errors: RowValidationError[]): string {
  const headers = ['Row Number', 'Column Name', 'Field Key', 'Invalid Value', 'Severity', 'Error Message'];
  const rows = errors.map((err) => [
    err.rowIndex,
    err.column,
    err.fieldKey,
    typeof err.value === 'object' ? JSON.stringify(err.value) : String(err.value ?? ''),
    err.severity.toUpperCase(),
    err.error,
  ]);
  return exportToCsv(headers, rows);
}
