import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Layers,
  RefreshCw,
  Check,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button, Badge } from '../ui';
import {
  OpeningStockImportRecord,
  OpeningStockSummaryReport,
  validateOpeningStockRows,
  generateOpeningStockTemplateCsv,
  executeOpeningStockImport,
} from '../../domain/migration/openingStockBulkImport';
import { parseDelimitedText, ValidationErrorItem } from '../../domain/migration/contactBulkImport';
import { useERP } from '../../context/ERPContext';

interface OpeningStockBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (report: OpeningStockSummaryReport) => void;
}

type WizardStep = 'upload' | 'preview' | 'executing' | 'report';

export const OpeningStockBulkImportModal: React.FC<OpeningStockBulkImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const { currentTenant, inventory, receiveStock, addInventoryItem, formatMVR } = useERP();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [validRecords, setValidRecords] = useState<OpeningStockImportRecord[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);
  const [totalParsedRows, setTotalParsedRows] = useState<number>(0);
  const [totalValuationMvr, setTotalValuationMvr] = useState<number>(0);
  const [importMode, setImportMode] = useState<'skip_invalid' | 'abort_on_error'>('skip_invalid');
  const [summaryReport, setSummaryReport] = useState<OpeningStockSummaryReport | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setValidRecords([]);
    setValidationErrors([]);
    setTotalParsedRows(0);
    setTotalValuationMvr(0);
    setSummaryReport(null);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const csv = generateOpeningStockTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'opening-stock-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const processTextContent = (text: string, name: string) => {
    setFileName(name);

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
      setTotalValuationMvr(0);
      setStep('preview');
      return;
    }

    const validSkus = new Set(inventory.map((item) => item.sku.toUpperCase()));
    const validation = validateOpeningStockRows(parsed.headers, parsed.rows, validSkus);

    setTotalParsedRows(validation.totalRecords);
    setValidRecords(validation.validRecords);
    setValidationErrors(validation.errors);
    setTotalValuationMvr(validation.totalValuationMvr);
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
    setIsProcessing(true);
    setStep('executing');

    const tenantId = currentTenant?.id || 'demo-org-id';

    const inserter = async (rec: OpeningStockImportRecord) => {
      // Find matching item in catalog and update quantityOnHand via receiveStock or addInventoryItem
      const existing = inventory.find((item) => item.sku.toUpperCase() === rec.sku.toUpperCase());
      if (existing) {
        receiveStock(existing.id, rec.quantity, `Opening Count ${rec.locationCode}`, rec.unitCost > 0 ? rec.unitCost : undefined);
      } else {
        addInventoryItem({
          sku: rec.sku,
          name: rec.sku,
          category: 'General Parts',
          quantityOnHand: rec.quantity,
          unit: 'pcs',
          reorderLevel: 5,
          unitCost: rec.unitCost,
          sellingPrice: rec.unitCost * 1.3,
          supplierId: '',
          supplierName: '',
          locationInShop: rec.locationCode,
        });
      }
      return { success: true, id: `sm-open-${rec.sku}-${rec.locationCode}` };
    };

    const report = await executeOpeningStockImport({
      records: validRecords,
      tenantId,
      mode: importMode,
      validationErrors,
      inserter,
    });

    setSummaryReport(report);
    setIsProcessing(false);
    setStep('report');
    if (onImportComplete) {
      onImportComplete(report);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Import Opening Stock & Valuation"
      subtitle={`Upload opening quantities on hand and unit cost basis per warehouse location for ${currentTenant?.name || 'current organisation'}.`}
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
              Confirm & Post Opening Stock ({validRecords.length} lines)
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
            Validation & Valuation Preview
          </div>
          <ChevronRight size={14} />
          <div className={`flex items-center gap-1.5 ${step === 'report' ? 'font-bold text-[var(--md-sys-color-primary)]' : ''}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">3</span>
            Valuation Journal & Report
          </div>
        </div>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-4">
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
                  Click to browse or drag and drop your opening stock count CSV
                </p>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                  Columns: SKU, Location/Warehouse Code, Quantity on Hand, Unit Cost (MVR)
                </p>
              </div>
            </div>

            <div className="p-3 bg-[var(--md-sys-color-primary-container)]/60 rounded-xl border border-[var(--md-sys-color-primary)] flex items-start gap-3 text-xs text-[var(--md-sys-color-primary)]">
              <FileSpreadsheet size={16} className="text-[var(--md-sys-color-primary)] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Double-Entry Valuation: </span>
                Importing opening stock automatically generates <span className="font-mono">movement_type = 'opening'</span> records and posts an asset valuation journal entry (DR 1310 Merchandise Inventory, CR 3100 Owner Capital).
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[var(--md-sys-color-surface-container)] rounded-xl border border-[var(--md-sys-color-outline-variant)]">
                <div className="text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)]">Valid Stock Lines</div>
                <div className="text-lg font-bold text-[var(--md-sys-color-on-surface)]">{validRecords.length} / {totalParsedRows}</div>
              </div>
              <div className="p-3 bg-[var(--positive-subtle)] rounded-xl border border-[var(--positive)]">
                <div className="text-[11px] font-medium text-[var(--positive)]">Total Asset Valuation</div>
                <div className="text-lg font-bold text-[var(--positive)]">{formatMVR(totalValuationMvr)}</div>
              </div>
              <div className={`p-3 rounded-xl border ${validationErrors.length > 0 ? 'bg-[var(--warning-subtle)] border-[var(--warning)]' : 'bg-[var(--md-sys-color-surface-container)] border-[var(--md-sys-color-outline-variant)]'}`}>
                <div className={`text-[11px] font-medium ${validationErrors.length > 0 ? 'text-[var(--warning)]' : 'text-[var(--md-sys-color-on-surface-variant)]'}`}>Validation Issues</div>
                <div className={`text-lg font-bold ${validationErrors.length > 0 ? 'text-[var(--warning)]' : 'text-[var(--md-sys-color-on-surface)]'}`}>{validationErrors.length}</div>
              </div>
            </div>

            {/* Ingestion Mode */}
            {validationErrors.length > 0 && (
              <div className="p-3 bg-[var(--md-sys-color-surface-container)] rounded-xl border border-[var(--md-sys-color-outline-variant)] flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-[var(--md-sys-color-on-surface)]">Handling of invalid rows:</span>
                  <p className="text-[var(--md-sys-color-on-surface-variant)] text-[11px]">Choose whether to import valid stock or abort entirely.</p>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="openingStockMode"
                      checked={importMode === 'skip_invalid'}
                      onChange={() => setImportMode('skip_invalid')}
                      className="text-[var(--md-sys-color-primary)]"
                    />
                    <span>Skip invalid rows</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="openingStockMode"
                      checked={importMode === 'abort_on_error'}
                      onChange={() => setImportMode('abort_on_error')}
                      className="text-[var(--md-sys-color-primary)]"
                    />
                    <span>Abort on any error</span>
                  </label>
                </div>
              </div>
            )}

            {/* Errors */}
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
                        <span className="font-mono font-semibold text-[var(--warning)]">Row {err.row}</span> ({err.field}): {err.reason}
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

            {/* Valid Lines Preview */}
            {validRecords.length > 0 && (
              <div className="border border-[var(--md-sys-color-outline-variant)] rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-[var(--md-sys-color-surface-container)]/70 border-b border-[var(--md-sys-color-outline-variant)] flex items-center justify-between text-xs font-semibold text-[var(--md-sys-color-on-surface)]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[var(--positive)]" />
                    Valid Opening Stock Lines ({validRecords.length})
                  </div>
                  <span className="text-[11px] font-normal text-[var(--md-sys-color-on-surface-variant)]">Previewing first 5 lines</span>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-[var(--md-sys-color-outline-variant)] text-xs">
                  {validRecords.slice(0, 5).map((rec, i) => (
                    <div key={i} className="px-3 py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[var(--md-sys-color-on-surface)]">
                          <span className="font-mono text-[var(--md-sys-color-primary)] mr-2">{rec.sku}</span>
                          <span className="text-[var(--md-sys-color-on-surface-variant)] text-xs">@ {rec.locationCode}</span>
                        </div>
                        <div className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] flex items-center gap-3 mt-0.5">
                          <span>Qty: {rec.quantity}</span>
                          <span>Unit Cost: {formatMVR(rec.unitCost)}</span>
                          <span className="font-semibold text-[var(--md-sys-color-on-surface)]">Valuation: {formatMVR(rec.totalValuation)}</span>
                        </div>
                      </div>
                      <Badge variant="positive">Verified</Badge>
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
              <p className="text-base font-semibold text-[var(--md-sys-color-on-surface)]">Recording Opening Stock & Posting Valuation...</p>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                Creating stock movements and asserting asset valuation journal entry.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: REPORT */}
        {step === 'report' && summaryReport && (
          <div className="space-y-4">
            <div className="p-4 bg-[var(--positive-subtle)] rounded-2xl border border-[var(--positive)] flex items-start gap-3">
              <CheckCircle2 size={24} className="text-[var(--positive)] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-[var(--positive)]">Opening Stock Successfully Recorded</h4>
                <p className="text-xs text-[var(--positive)] mt-1">
                  Opening stock movements created and asset valuation journal posted into {currentTenant?.name || 'the organisation ledger'}.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[var(--md-sys-color-surface-container)] rounded-xl border border-[var(--md-sys-color-outline-variant)] text-center">
                <div className="text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)]">Stock Lines Imported</div>
                <div className="text-xl font-bold text-[var(--md-sys-color-on-surface)]">{summaryReport.importedCount}</div>
              </div>
              <div className="p-3 bg-[var(--positive-subtle)] rounded-xl border border-[var(--positive)] text-center">
                <div className="text-[11px] font-medium text-[var(--positive)]">Asset Valuation</div>
                <div className="text-xl font-bold text-[var(--positive)]">{formatMVR(summaryReport.totalValuationMvr)}</div>
              </div>
              <div className="p-3 bg-[var(--md-sys-color-primary-container)] rounded-xl border border-[var(--md-sys-color-primary)] text-center">
                <div className="text-[11px] font-medium text-[var(--md-sys-color-primary)]">Valuation Journal</div>
                <div className="text-xs font-mono font-bold text-[var(--md-sys-color-primary)] mt-1">
                  {summaryReport.valuationJournal?.entryNumber || 'JE-POSTED'}
                </div>
              </div>
            </div>

            {/* Valuation Journal Details */}
            {summaryReport.valuationJournal && (
              <div className="border border-[var(--md-sys-color-outline-variant)] rounded-xl overflow-hidden bg-[var(--md-sys-color-surface-container)]/50">
                <div className="px-3 py-2 bg-[var(--md-sys-color-surface-container)]/70 border-b border-[var(--md-sys-color-outline-variant)] text-xs font-semibold text-[var(--md-sys-color-on-surface)] flex items-center justify-between">
                  <span>General Ledger Valuation Postings</span>
                  <Badge variant="accent">Double-Entry Balance</Badge>
                </div>
                <div className="divide-y divide-[var(--md-sys-color-outline-variant)] text-xs">
                  {summaryReport.valuationJournal.lines.map((l, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[var(--md-sys-color-on-surface)]">{l.accountCode}</span>
                        <span className="text-[var(--md-sys-color-on-surface-variant)]">{l.accountName}</span>
                      </div>
                      <div className="font-mono font-medium">
                        {l.debit > 0 ? (
                          <span className="text-[var(--positive)]">DR {formatMVR(l.debit)}</span>
                        ) : (
                          <span className="text-[var(--md-sys-color-primary)]">CR {formatMVR(l.credit)}</span>
                        )}
                      </div>
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
