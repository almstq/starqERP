import React, { useState, useRef, useId } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Download,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Surface } from '../ui/Surface';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  IngestionTarget,
  TargetSchema,
  ColumnMapping,
  ValidationSummary,
  IngestionExecutionResult,
  IngestionMode,
  IngestionValidationContext,
  parseCsv,
  parseXlsx,
  SCHEMAS,
  autoMapColumns,
  validateDataset,
  exportValidationErrorsToCsv,
  executeBatchIngestion,
  BatchInsertFn,
} from '../../domain/ingestion';

interface DataIngestionWizardProps {
  initialTarget?: IngestionTarget;
  onComplete?: (result: IngestionExecutionResult) => void;
  committer?: BatchInsertFn;
  validationContext?: IngestionValidationContext;
}

export const DataIngestionWizard: React.FC<DataIngestionWizardProps> = ({
  initialTarget = 'contacts',
  onComplete,
  committer,
  validationContext,
}) => {
  const [target, setTarget] = useState<IngestionTarget>(initialTarget);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [delimiter, setDelimiter] = useState<string>(',');
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [executionMode, setExecutionMode] = useState<IngestionMode>('all_or_nothing');
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number; percent: number }>({
    processed: 0,
    total: 0,
    percent: 0,
  });
  const [executionResult, setExecutionResult] = useState<IngestionExecutionResult | null>(null);
  const [errorFilter, setErrorFilter] = useState<'all' | 'errors_only'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentSchema: TargetSchema = SCHEMAS[target];
  const fileInputId = useId();

  // Handle file selection (drag & drop or click)
  const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB maximum upload guard

  const handleFile = async (selectedFile: File) => {
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      alert(`File size exceeds 50MB limit (${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB). Please upload a smaller batch file.`);
      return;
    }

    setFile(selectedFile);
    setIsProcessingFile(true);

    try {
      const fileName = selectedFile.name.toLowerCase();

      if (fileName.endsWith('.xlsx')) {
        const buffer = await selectedFile.arrayBuffer();
        const parsed = await parseXlsx(buffer);
        setRawHeaders(parsed.headers);
        setRawRows(parsed.rows);
        setDelimiter(parsed.delimiter);

        const initialMappings = autoMapColumns(parsed.headers, currentSchema, parsed.rows);
        setMappings(initialMappings);
        setStep(2);
      } else {
        // Assume text CSV/TSV
        const text = await selectedFile.text();
        const parsed = parseCsv(text);
        setRawHeaders(parsed.headers);
        setRawRows(parsed.rows);
        setDelimiter(parsed.delimiter);

        const initialMappings = autoMapColumns(parsed.headers, currentSchema, parsed.rows);
        setMappings(initialMappings);
        setStep(2);
      }
    } catch (err: any) {
      alert(`Error reading spreadsheet: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleDownloadTemplate = () => {
    if (!currentSchema.sampleCsvTemplate) return;
    const blob = new Blob([currentSchema.sampleCsvTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${currentSchema.target}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadErrors = () => {
    if (!validationSummary || validationSummary.errors.length === 0) return;
    const csvContent = exportValidationErrorsToCsv(validationSummary.errors);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${currentSchema.target}_validation_errors.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleMappingChange = (sourceHeader: string, targetField: string | null) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.sourceHeader === sourceHeader
          ? {
              ...m,
              targetField,
              confidence: targetField ? 100 : 0,
            }
          : m
      )
    );
  };

  const defaultValidationContext: IngestionValidationContext = validationContext || {
    foreignReferences: {
      'chart_of_accounts.code': new Set(['1010', '1020', '1200', '1500', '2010', '2020', '3010', '4010', '5010']),
    },
  };

  const handleValidate = () => {
    const summary = validateDataset(rawHeaders, rawRows, mappings, currentSchema, defaultValidationContext);
    setValidationSummary(summary);
    setStep(3);
  };

  const handleExecute = async (dryRun = false) => {
    if (!validationSummary) return;
    setIsExecuting(true);
    setStep(4);
    setProgress({ processed: 0, total: validationSummary.totalRows, percent: 0 });

    try {
      const result = await executeBatchIngestion(
        target,
        validationSummary,
        {
          mode: executionMode,
          dryRun,
          batchSize: 200,
          onProgress: (p) => setProgress(p),
        },
        committer
      );

      setExecutionResult(result);
      if (onComplete) onComplete(result);
    } catch (err: any) {
      setExecutionResult({
        success: false,
        target,
        batchId: 'ERROR',
        totalProcessed: 0,
        insertedCount: 0,
        failedCount: validationSummary.totalRows,
        durationMs: 0,
        rolledBack: true,
        errors: [],
        message: err.message || 'Execution error',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setFile(null);
    setRawHeaders([]);
    setRawRows([]);
    setMappings([]);
    setValidationSummary(null);
    setExecutionResult(null);
    setProgress({ processed: 0, total: 0, percent: 0 });
  };

  // Missing required fields check
  const mappedFieldKeys = new Set(mappings.map((m) => m.targetField).filter(Boolean));
  const missingRequiredFields = currentSchema.fields.filter((f) => f.required && !mappedFieldKeys.has(f.key));

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header & Steps Indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--md-sys-color-outline-variant)]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
            <FileSpreadsheet className="text-[var(--primary)]" size={24} />
            <span>Universal Data Ingestion & Validator</span>
          </h1>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
            Bulk migrate contacts, products, and opening balances from CSV or Excel spreadsheets
          </p>
        </div>

        {/* Step Progress Pills */}
        <div className="flex items-center gap-1.5 text-xs">
          {[
            { num: 1, label: 'Upload' },
            { num: 2, label: 'Map Columns' },
            { num: 3, label: 'Validate' },
            { num: 4, label: 'Commit' },
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors ${
                step === s.num
                  ? 'bg-[var(--primary)] text-white'
                  : step > s.num
                  ? 'bg-[var(--md-sys-color-surface-container-high)] text-[var(--positive)]'
                  : 'bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)]'
              }`}
            >
              <span>{step > s.num ? '✓' : s.num}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: Upload Spreadsheet */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Target Select */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'contacts', title: 'Customers & Suppliers', desc: 'Clients, vendors, phone contacts & TINs' },
              { id: 'products', title: 'Product Catalogue', desc: 'SKUs, barcodes, tax rates & selling prices' },
              { id: 'opening_balances', title: 'Opening Balances', desc: 'Double-entry Chart of Accounts balances' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTarget(t.id as IngestionTarget);
                }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  target === t.id
                    ? 'border-[var(--primary)] bg-[var(--md-sys-color-primary-container)]/10 ring-1 ring-[var(--primary)]'
                    : 'border-[var(--md-sys-color-outline-variant)] hover:bg-[var(--md-sys-color-surface-container)]'
                }`}
              >
                <div className="font-bold text-sm text-[var(--md-sys-color-on-surface)]">{t.title}</div>
                <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">{t.desc}</div>
              </button>
            ))}
          </div>

          {/* Drag & Drop Upload Zone */}
          <Surface
            variant="elevated"
            level={1}
            className="p-8 border-2 border-dashed border-[var(--md-sys-color-outline)] rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-[var(--primary)] hover:bg-[var(--md-sys-color-surface-container)]/50 transition-all"
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.tsv,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />

            <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center mb-3">
              {isProcessingFile ? <RefreshCw className="animate-spin" size={28} /> : <Upload size={28} />}
            </div>

            <h3 className="font-bold text-base text-[var(--md-sys-color-on-surface)]">
              {isProcessingFile ? 'Reading and parsing spreadsheet...' : 'Choose a CSV or XLSX spreadsheet to upload'}
            </h3>
            <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] max-w-md mt-1 mb-4">
              Drag and drop your file here, or click to browse. Supports high-volume batches up to 50,000 rows.
            </p>

            <div className="flex items-center gap-2 text-xs">
              <Button
                variant="outlined"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadTemplate();
                }}
                icon={<Download size={14} />}
              >
                Download Sample {currentSchema.label} CSV Template
              </Button>
            </div>
          </Surface>
        </div>
      )}

      {/* STEP 2: Interactive Column Mapping */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl bg-[var(--md-sys-color-surface-container)] text-xs">
            <div>
              <span className="font-bold">File: </span>
              <span>{file?.name} </span>
              <span className="opacity-75">
                ({rawRows.length.toLocaleString()} rows detected • delimiter: "{delimiter}")
              </span>
            </div>
            {missingRequiredFields.length > 0 && (
              <div className="flex items-center gap-1.5 text-[var(--md-sys-color-error)] font-medium">
                <AlertTriangle size={14} />
                <span>
                  Missing required field mappings: {missingRequiredFields.map((f) => f.label).join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Mapping Table */}
          <Surface variant="elevated" level={1} className="rounded-xl overflow-hidden border border-[var(--md-sys-color-outline-variant)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)]">
                    <th className="py-2.5 px-4 font-semibold w-1/4">Spreadsheet Column Header</th>
                    <th className="py-2.5 px-4 font-semibold w-1/4">Sample Preview (Row 1-3)</th>
                    <th className="py-2.5 px-4 font-semibold w-1/3">Target starqERP Field</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
                  {mappings.map((mapping) => {
                    const matchedField = currentSchema.fields.find((f) => f.key === mapping.targetField);

                    return (
                      <tr key={mapping.sourceHeader} className="hover:bg-[var(--md-sys-color-surface-container)]/30">
                        <td className="py-2.5 px-4 font-bold text-[var(--md-sys-color-on-surface)]">
                          {mapping.sourceHeader}
                        </td>
                        <td className="py-2.5 px-4 text-[var(--md-sys-color-on-surface-variant)] truncate max-w-[200px]">
                          {mapping.sampleValues.join(', ') || <span className="opacity-40">Empty</span>}
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            aria-label={`Target field for ${mapping.sourceHeader}`}
                            value={mapping.targetField ?? ''}
                            onChange={(e) => handleMappingChange(mapping.sourceHeader, e.target.value || null)}
                            className="w-full h-8 px-2 rounded-lg border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface)] text-xs text-[var(--md-sys-color-on-surface)]"
                          >
                            <option value="">-- Ignore this column --</option>
                            {currentSchema.fields.map((field) => (
                              <option key={field.key} value={field.key}>
                                {field.label} {field.required ? '*(Required)' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {matchedField ? (
                            <Badge variant={matchedField.required ? 'accent' : 'neutral'}>
                              {mapping.confidence === 100 ? 'Auto-Matched' : 'Mapped'}
                            </Badge>
                          ) : (
                            <Badge variant="neutral">Ignored</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Surface>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outlined" size="sm" onClick={() => setStep(1)} icon={<ArrowLeft size={14} />}>
              Back
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={missingRequiredFields.length > 0}
              onClick={handleValidate}
              icon={<ArrowRight size={14} />}
            >
              Proceed to Validation
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Validate & Review */}
      {step === 3 && validationSummary && (
        <div className="space-y-5">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Surface variant="elevated" level={1} className="p-3.5 rounded-xl border border-[var(--md-sys-color-outline-variant)]">
              <div className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">Total Rows</div>
              <div className="text-xl font-bold mt-0.5">{validationSummary.totalRows.toLocaleString()}</div>
            </Surface>
            <Surface variant="elevated" level={1} className="p-3.5 rounded-xl border border-[var(--md-sys-color-outline-variant)]">
              <div className="text-[11px] text-[var(--positive)] font-medium">Valid Ready to Commit</div>
              <div className="text-xl font-bold text-[var(--positive)] mt-0.5">
                {validationSummary.validRows.toLocaleString()}
              </div>
            </Surface>
            <Surface variant="elevated" level={1} className="p-3.5 rounded-xl border border-[var(--md-sys-color-outline-variant)]">
              <div className="text-[11px] text-[var(--md-sys-color-error)] font-medium">Error Rows</div>
              <div className="text-xl font-bold text-[var(--md-sys-color-error)] mt-0.5">
                {validationSummary.errorRows.toLocaleString()}
              </div>
            </Surface>
            <Surface variant="elevated" level={1} className="p-3.5 rounded-xl border border-[var(--md-sys-color-outline-variant)]">
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Duplicate Keys</div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {validationSummary.duplicateKeyErrors.length}
              </div>
            </Surface>
          </div>

          {/* Validation Status Banner */}
          {validationSummary.isValid ? (
            <div className="p-3.5 rounded-xl bg-[var(--positive)]/10 border border-[var(--positive)] text-xs text-[var(--positive)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span className="font-semibold">
                  Dataset is 100% valid. All {validationSummary.totalRows.toLocaleString()} records passed schema constraints.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-[var(--md-sys-color-error)]/10 border border-[var(--md-sys-color-error)] text-xs text-[var(--md-sys-color-error)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>
                  Found <strong>{validationSummary.errorRows}</strong> rows with errors. Review below or download report.
                </span>
              </div>
              <Button variant="outlined" size="xs" onClick={handleDownloadErrors} icon={<Download size={12} />}>
                Download Error Report (.csv)
              </Button>
            </div>
          )}

          {/* Error Table if errors exist */}
          {validationSummary.errors.length > 0 && (
            <Surface variant="elevated" level={1} className="rounded-xl overflow-hidden border border-[var(--md-sys-color-outline-variant)]">
              <div className="p-3 bg-[var(--md-sys-color-surface-container)] flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] text-xs">
                <div className="font-bold flex items-center gap-2">
                  <span>Row-by-Row Validation Issues ({validationSummary.errors.length})</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setErrorFilter('all')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      errorFilter === 'all' ? 'bg-[var(--primary)] text-white' : 'hover:bg-black/5'
                    }`}
                  >
                    All ({validationSummary.errors.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setErrorFilter('errors_only')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      errorFilter === 'errors_only' ? 'bg-[var(--primary)] text-white' : 'hover:bg-black/5'
                    }`}
                  >
                    Fatal Errors ({validationSummary.errors.filter((e) => e.severity === 'error').length})
                  </button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)]">
                      <th className="py-2 px-3 font-semibold w-16">Row #</th>
                      <th className="py-2 px-3 font-semibold w-32">Column</th>
                      <th className="py-2 px-3 font-semibold w-36">Field Value</th>
                      <th className="py-2 px-3 font-semibold">Validation Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
                    {validationSummary.errors
                      .filter((e) => (errorFilter === 'errors_only' ? e.severity === 'error' : true))
                      .slice(0, 100)
                      .map((err, idx) => (
                        <tr key={idx} className="hover:bg-[var(--md-sys-color-surface-container)]/30">
                          <td className="py-2 px-3 font-mono font-bold text-[var(--md-sys-color-on-surface)]">
                            {err.rowIndex}
                          </td>
                          <td className="py-2 px-3 font-medium text-[var(--md-sys-color-on-surface-variant)]">
                            {err.column}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] truncate max-w-[150px]">
                            {typeof err.value === 'object' ? JSON.stringify(err.value) : String(err.value ?? '')}
                          </td>
                          <td className="py-2 px-3 text-[var(--md-sys-color-error)]">{err.error}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          )}

          {/* Mode Selector */}
          <div className="p-3.5 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-bold">Transaction Execution Mode</div>
              <div className="text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                {executionMode === 'all_or_nothing'
                  ? 'All-or-Nothing: Entire batch rolls back with zero inserts if any error is encountered.'
                  : 'Skip Invalid: Commits all valid records and logs invalid rows to downloadable report.'}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="xs"
                variant={executionMode === 'all_or_nothing' ? 'primary' : 'outlined'}
                onClick={() => setExecutionMode('all_or_nothing')}
              >
                All-or-Nothing
              </Button>
              <Button
                size="xs"
                variant={executionMode === 'skip_invalid' ? 'primary' : 'outlined'}
                onClick={() => setExecutionMode('skip_invalid')}
              >
                Skip Invalid Rows
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outlined" size="sm" onClick={() => setStep(2)} icon={<ArrowLeft size={14} />}>
              Back to Mapping
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outlined"
                size="sm"
                disabled={executionMode === 'all_or_nothing' && !validationSummary.isValid}
                onClick={() => handleExecute(true)}
              >
                Dry Run (Test)
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={executionMode === 'all_or_nothing' && !validationSummary.isValid}
                onClick={() => handleExecute(false)}
                icon={<Check size={14} />}
              >
                Commit Import Batch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Execution & Final Results */}
      {step === 4 && (
        <div className="space-y-6">
          {isExecuting ? (
            <Surface variant="elevated" level={1} className="p-8 rounded-2xl text-center space-y-4">
              <RefreshCw className="animate-spin text-[var(--primary)] mx-auto" size={36} />
              <h3 className="font-bold text-base">Processing Batch Ingestion...</h3>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                Inserting records in atomic transactions ({progress.processed.toLocaleString()} of{' '}
                {progress.total.toLocaleString()} rows processed)
              </p>
              <div className="w-full max-w-md mx-auto h-2 bg-[var(--md-sys-color-surface-container-high)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--primary)] transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </Surface>
          ) : executionResult ? (
            <Surface
              variant="elevated"
              level={1}
              className={`p-6 rounded-2xl border text-center space-y-4 ${
                executionResult.success
                  ? 'border-[var(--positive)] bg-[var(--positive)]/5'
                  : 'border-[var(--md-sys-color-error)] bg-[var(--md-sys-color-error)]/5'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
                  executionResult.success
                    ? 'bg-[var(--positive)]/10 text-[var(--positive)]'
                    : 'bg-[var(--md-sys-color-error)]/10 text-[var(--md-sys-color-error)]'
                }`}
              >
                {executionResult.success ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
              </div>

              <h2 className="text-lg font-bold text-[var(--md-sys-color-on-surface)]">
                {executionResult.success ? 'Import Completed Successfully' : 'Batch Ingestion Aborted'}
              </h2>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] max-w-lg mx-auto">
                {executionResult.message}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-md mx-auto text-left text-xs py-2">
                <div className="p-2.5 rounded-lg bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)]">
                  <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">Batch ID</div>
                  <div className="font-mono font-bold truncate">{executionResult.batchId}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)]">
                  <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">Inserted</div>
                  <div className="font-bold text-[var(--positive)]">{executionResult.insertedCount.toLocaleString()}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)]">
                  <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">Failed / Skipped</div>
                  <div className="font-bold text-[var(--md-sys-color-error)]">{executionResult.failedCount.toLocaleString()}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)]">
                  <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">Duration</div>
                  <div className="font-bold">{(executionResult.durationMs / 1000).toFixed(2)}s</div>
                </div>
              </div>

              <div className="pt-3 flex justify-center gap-2">
                <Button variant="primary" size="sm" onClick={resetWizard} icon={<RotateCcw size={14} />}>
                  Start Another Import
                </Button>
              </div>
            </Surface>
          ) : null}
        </div>
      )}
    </div>
  );
};
