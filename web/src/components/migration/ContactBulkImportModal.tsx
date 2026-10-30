import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  Users,
  Building2,
  RefreshCw,
  FileText,
  Check,
  ChevronRight,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button, Surface, Badge } from '../ui';
import {
  ContactKind,
  ContactImportRecord,
  ValidationErrorItem,
  ImportSummaryReport,
  parseDelimitedText,
  validateContactRows,
  generateCustomerTemplateCsv,
  generateSupplierTemplateCsv,
  executeContactImport,
} from '../../domain/migration/contactBulkImport';
import { useERP } from '../../context/ERPContext';

interface ContactBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultKind: ContactKind;
  onImportComplete?: (report: ImportSummaryReport) => void;
}

type WizardStep = 'upload' | 'preview' | 'executing' | 'report';

export const ContactBulkImportModal: React.FC<ContactBulkImportModalProps> = ({
  isOpen,
  onClose,
  defaultKind,
  onImportComplete,
}) => {
  const { currentTenant, createCustomer, createSupplier } = useERP();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeOrganisationId = useRef(currentTenant?.id);
  activeOrganisationId.current = currentTenant?.id;

  const [step, setStep] = useState<WizardStep>('upload');
  const [kind, setKind] = useState<ContactKind>(defaultKind);
  const [fileName, setFileName] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [validRecords, setValidRecords] = useState<ContactImportRecord[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);
  const [totalParsedRows, setTotalParsedRows] = useState<number>(0);
  const [importMode, setImportMode] = useState<'skip_invalid' | 'abort_on_error'>('skip_invalid');
  const [summaryReport, setSummaryReport] = useState<ImportSummaryReport | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [blockingError, setBlockingError] = useState<string | null>(null);

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setRawText('');
    setValidRecords([]);
    setValidationErrors([]);
    setTotalParsedRows(0);
    setSummaryReport(null);
    setIsProcessing(false);
    setBlockingError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const csv = kind === 'supplier' ? generateSupplierTemplateCsv() : generateCustomerTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${kind}-master-template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const processTextContent = (text: string, name: string) => {
    setFileName(name);
    setRawText(text);

    const parsed = parseDelimitedText(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setValidationErrors([
        {
          row: 1,
          field: 'file',
          value: name,
          reason: 'Uploaded file is empty or does not contain recognizable tabular rows.',
        },
      ]);
      setTotalParsedRows(0);
      setValidRecords([]);
      setStep('preview');
      return;
    }

    const validation = validateContactRows(parsed.headers, parsed.rows, kind);
    setTotalParsedRows(validation.totalRecords);
    setValidRecords(validation.validRecords);
    setValidationErrors(validation.errors);
    setStep('preview');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        processTextContent(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        processTextContent(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleExecuteImport = async () => {
    const organisationId = currentTenant?.id;
    if (!organisationId) {
      setBlockingError('Select an organisation before importing contacts. No records were imported.');
      return;
    }

    setBlockingError(null);
    setIsProcessing(true);
    setStep('executing');

    const tenantContext = { organisationId };

    const inserter = async (rec: ContactImportRecord, tenant: { organisationId: string }) => {
      if (tenant.organisationId !== organisationId || activeOrganisationId.current !== organisationId) {
        return { success: false, error: 'Organisation context changed before persistence.' };
      }

      if (rec.kind === 'supplier') {
        const supplier = await createSupplier({
          name: rec.displayName,
          contactPerson: rec.contactPerson || '',
          phone: rec.phone,
          email: rec.email || '',
          address: rec.address || '',
          islandOrCountry: rec.island || 'Male',
          category: rec.category || 'General',
          leadTimeDays: rec.leadTimeDays || 7,
        });
        return { success: true, id: supplier.id };
      } else {
        const customer = await createCustomer({
          name: rec.displayName,
          phone: rec.phone,
          email: rec.email || '',
          type: 'Corporate',
          vehicles: [],
          island: rec.island || 'Male',
          notes: rec.taxIdentifier ? `MIRA TIN: ${rec.taxIdentifier}` : '',
        });
        return { success: true, id: customer.id };
      }
    };

    const report = await executeContactImport(
      validRecords,
      tenantContext,
      importMode,
      validationErrors,
      inserter
    );

    setSummaryReport(report);
    setIsProcessing(false);
    setStep('report');
    if (onImportComplete) {
      onImportComplete(report);
    }
  };

  const isSupplier = kind === 'supplier';
  const title = `Bulk Import ${isSupplier ? 'Suppliers' : 'Customers'}`;
  const subtitle = `Import contact records, Maldivian phone numbers, and MIRA TINs from CSV/Excel into ${currentTenant?.name || 'current organisation'}.`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      maxWidth="3xl"
      actions={
        step === 'upload' ? (
          <>
            <Button variant="outlined" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="filled"
              icon={<Download size={14} />}
              onClick={handleDownloadTemplate}
            >
              Download Template
            </Button>
          </>
        ) : step === 'preview' ? (
          <>
            <Button variant="outlined" onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button
              variant="filled"
              icon={<Check size={14} />}
              disabled={validRecords.length === 0 || (importMode === 'abort_on_error' && validationErrors.length > 0)}
              onClick={handleExecuteImport}
            >
              Confirm & Import ({validRecords.length} records)
            </Button>
          </>
        ) : step === 'report' ? (
          <Button variant="filled" onClick={handleClose}>
            Done
          </Button>
        ) : null
      }
    >
      <div className="space-y-6 py-2">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b pb-3 text-xs text-[var(--md-sys-color-on-surface-variant)]">
          <div className={`flex items-center gap-1.5 ${step === 'upload' ? 'font-bold text-[var(--md-sys-color-primary)]' : ''}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">1</span>
            Upload File
          </div>
          <ChevronRight size={14} />
          <div className={`flex items-center gap-1.5 ${step === 'preview' ? 'font-bold text-[var(--md-sys-color-primary)]' : ''}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">2</span>
            Validation & Preview
          </div>
          <ChevronRight size={14} />
          <div className={`flex items-center gap-1.5 ${step === 'report' ? 'font-bold text-[var(--md-sys-color-primary)]' : ''}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">3</span>
            Import Summary
          </div>
        </div>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Kind Selector */}
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-[var(--md-sys-color-on-surface)]">Master Type:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setKind('customer')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    kind === 'customer'
                      ? 'bg-[var(--md-sys-color-primary-container)] border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary-container)]'
                      : 'border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container)]'
                  }`}
                >
                  <Users size={14} />
                  Customers
                </button>
                <button
                  type="button"
                  onClick={() => setKind('supplier')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    kind === 'supplier'
                      ? 'bg-[var(--md-sys-color-primary-container)] border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary-container)]'
                      : 'border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container)]'
                  }`}
                >
                  <Building2 size={14} />
                  Suppliers
                </button>
              </div>
            </div>

            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-outline-variant)] rounded-2xl p-8 text-center cursor-pointer bg-[var(--md-sys-color-surface-container)]/50 hover:bg-[var(--md-sys-color-surface-container)] transition-all flex flex-col items-center justify-center space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="w-12 h-12 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-primary)] flex items-center justify-center">
                <Upload size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--md-sys-color-on-surface)]">
                  Click to browse or drag and drop your CSV / Excel export
                </p>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                  Supports .csv and text formats with Maldivian phone numbers and MIRA TINs
                </p>
              </div>
            </div>

            <div className="p-3 bg-[var(--md-sys-color-primary-container)]/60 rounded-xl border border-[var(--md-sys-color-primary)] flex items-start gap-3 text-xs text-[var(--md-sys-color-primary)]">
              <FileSpreadsheet size={16} className="text-[var(--md-sys-color-primary)] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Tip: </span>
                Download our standard template above to ensure your columns match (Name, Maldivian Phone, Email, MIRA TIN, Terms). Tenant isolation is strictly enforced.
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & VALIDATION */}
        {step === 'preview' && (
          <div className="space-y-4">
            {blockingError && <p role="alert" className="rounded-lg border border-[var(--negative)] bg-[var(--negative-subtle)] px-3 py-2 text-xs text-[var(--negative)]">{blockingError}</p>}
            {/* Summary Metrics Banner */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[var(--md-sys-color-surface-container)] rounded-xl border border-[var(--md-sys-color-outline-variant)]">
                <div className="text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)]">Total Rows Found</div>
                <div className="text-lg font-bold text-[var(--md-sys-color-on-surface)]">{totalParsedRows}</div>
              </div>
              <div className="p-3 bg-[var(--positive-subtle)] rounded-xl border border-[var(--positive)]">
                <div className="text-[11px] font-medium text-[var(--positive)]">Valid Records</div>
                <div className="text-lg font-bold text-[var(--positive)]">{validRecords.length}</div>
              </div>
              <div className={`p-3 rounded-xl border ${validationErrors.length > 0 ? 'bg-[var(--warning-subtle)] border-[var(--warning)]' : 'bg-[var(--md-sys-color-surface-container)] border-[var(--md-sys-color-outline-variant)]'}`}>
                <div className={`text-[11px] font-medium ${validationErrors.length > 0 ? 'text-[var(--warning)]' : 'text-[var(--md-sys-color-on-surface-variant)]'}`}>Validation Issues</div>
                <div className={`text-lg font-bold ${validationErrors.length > 0 ? 'text-[var(--warning)]' : 'text-[var(--md-sys-color-on-surface)]'}`}>{validationErrors.length}</div>
              </div>
            </div>

            {/* Ingestion Mode Option */}
            {validationErrors.length > 0 && (
              <div className="p-3 bg-[var(--md-sys-color-surface-container)] rounded-xl border border-[var(--md-sys-color-outline-variant)] flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-[var(--md-sys-color-on-surface)]">Handling of invalid rows:</span>
                  <p className="text-[var(--md-sys-color-on-surface-variant)] text-[11px]">Choose whether to import valid records or abort entirely.</p>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'skip_invalid'}
                      onChange={() => setImportMode('skip_invalid')}
                      className="text-[var(--md-sys-color-primary)]"
                    />
                    <span>Skip invalid rows</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'abort_on_error'}
                      onChange={() => setImportMode('abort_on_error')}
                      className="text-[var(--md-sys-color-primary)]"
                    />
                    <span>Stop at first import error</span>
                  </label>
                </div>
              </div>
            )}

            {/* Validation Errors Table */}
            {validationErrors.length > 0 && (
              <div className="border border-[var(--warning)] rounded-xl overflow-hidden bg-[var(--warning-subtle)]/30">
                <div className="px-3 py-2 bg-[var(--warning-subtle)]/60 border-b border-[var(--warning)] flex items-center gap-2 text-xs font-semibold text-[var(--warning)]">
                  <AlertCircle size={14} className="text-[var(--warning)]" />
                  Validation Issues ({validationErrors.length})
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-[var(--warning)] text-xs">
                  {validationErrors.map((err, i) => (
                    <div key={i} className="px-3 py-2 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-semibold text-[var(--warning)]">Row {err.row}</span>: {err.reason}
                      </div>
                      {err.value && (
                        <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-[var(--warning)] text-[var(--md-sys-color-on-surface)]">
                          {err.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Valid Records Preview Table */}
            {validRecords.length > 0 && (
              <div className="border border-[var(--md-sys-color-outline-variant)] rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-[var(--md-sys-color-surface-container)]/70 border-b border-[var(--md-sys-color-outline-variant)] flex items-center justify-between text-xs font-semibold text-[var(--md-sys-color-on-surface)]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[var(--positive)]" />
                    Valid Records Ready to Import ({validRecords.length})
                  </div>
                  <span className="text-[11px] font-normal text-[var(--md-sys-color-on-surface-variant)]">Previewing first 5 records</span>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-[var(--md-sys-color-outline-variant)] text-xs">
                  {validRecords.slice(0, 5).map((rec, i) => (
                    <div key={i} className="px-3 py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[var(--md-sys-color-on-surface)]">{rec.displayName}</div>
                        <div className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] flex items-center gap-3 mt-0.5">
                          {rec.phone && <span>Phone: {rec.phone}</span>}
                          {rec.email && <span>Email: {rec.email}</span>}
                          {rec.taxIdentifier && <span>TIN: {rec.taxIdentifier}</span>}
                        </div>
                      </div>
                      <Badge variant="positive">Ready</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: EXECUTING */}
        {step === 'executing' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <RefreshCw size={36} className="text-[var(--md-sys-color-primary)] animate-spin" />
            <div>
              <p className="text-base font-semibold text-[var(--md-sys-color-on-surface)]">Importing Master Records...</p>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                Persisting into tenant workspace with Maldivian compliance validation.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: IMPORT SUMMARY REPORT */}
        {step === 'report' && summaryReport && (
          <div className="space-y-4">
            {summaryReport.importedCount > 0 ? (
              <div className="p-4 bg-[var(--positive-subtle)] rounded-2xl border border-[var(--positive)] flex items-start gap-3">
                <CheckCircle2 size={24} className="text-[var(--positive)] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-[var(--positive)]">
                    {summaryReport.skippedCount > 0 ? 'Partial import persisted' : 'Import persistence confirmed'}
                  </h4>
                  <p className="text-xs text-[var(--positive)] mt-1">
                    {summaryReport.importedCount} contact{summaryReport.importedCount === 1 ? '' : 's'} were confirmed by the backend for {currentTenant?.name || 'the selected organisation'}.
                    {summaryReport.skippedCount > 0 && ' Processing stopped with errors; confirmed records remain saved.'}
                  </p>
                </div>
              </div>
            ) : (
              <div role="alert" className="p-4 bg-[var(--negative-subtle)] rounded-2xl border border-[var(--negative)] flex items-start gap-3">
                <AlertCircle size={24} className="text-[var(--negative)] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-[var(--negative)]">No records were imported</h4>
                  <p className="text-xs text-[var(--negative)] mt-1">The backend did not confirm persistence for any contact. Review the row errors below before retrying.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[var(--md-sys-color-surface-container)] rounded-xl border border-[var(--md-sys-color-outline-variant)] text-center">
                <div className="text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)]">Total Processed</div>
                <div data-testid="import-total-processed" className="text-xl font-bold text-[var(--md-sys-color-on-surface)]">{summaryReport.totalProcessed}</div>
              </div>
              <div className="p-3 bg-[var(--positive-subtle)] rounded-xl border border-[var(--positive)] text-center">
                <div className="text-[11px] font-medium text-[var(--positive)]">Successfully Imported</div>
                <div data-testid="import-imported-count" className="text-xl font-bold text-[var(--positive)]">{summaryReport.importedCount}</div>
              </div>
              <div className="p-3 bg-[var(--warning-subtle)] rounded-xl border border-[var(--warning)] text-center">
                <div className="text-[11px] font-medium text-[var(--warning)]">Skipped Records</div>
                <div data-testid="import-skipped-count" className="text-xl font-bold text-[var(--warning)]">{summaryReport.skippedCount}</div>
              </div>
            </div>

            {summaryReport.errors.length > 0 && (
              <div className="border border-[var(--md-sys-color-outline-variant)] rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-[var(--md-sys-color-surface-container)]/70 border-b border-[var(--md-sys-color-outline-variant)] text-xs font-semibold text-[var(--md-sys-color-on-surface)] flex items-center justify-between">
                  <span>Report of Skipped Records & Error Reasons</span>
                  <Badge variant="warning">{summaryReport.errors.length} items</Badge>
                </div>
                <div className="max-h-44 overflow-y-auto divide-y divide-[var(--md-sys-color-outline-variant)] text-xs">
                  {summaryReport.errors.map((err, i) => (
                    <div key={i} className="px-3 py-2 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-semibold text-[var(--md-sys-color-on-surface)]">Row {err.row}</span> ({err.field}): {err.reason}
                      </div>
                      {err.value && (
                        <span className="text-[10px] font-mono bg-[var(--md-sys-color-surface-container)] px-1.5 py-0.5 rounded text-[var(--md-sys-color-on-surface-variant)]">
                          {err.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
