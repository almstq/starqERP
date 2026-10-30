import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Check,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button, Surface, Badge } from '../ui';
import {
  OpeningBalanceLineInput,
  buildOpeningBalanceJournal,
  generateOpeningBalanceTemplateCsv,
} from '../../domain/migration/openingTrialBalanceWizard';
import { parseDelimitedText } from '../../domain/migration/contactBulkImport';
import { JournalEntry } from '../../domain/journals';
import { AccountingPeriod, generateFiscalPeriods } from '../../domain/periods';
import { AccountRecord } from '../../domain/accounts';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../../data/defaultChartOfAccounts';
import { useERP } from '../../context/ERPContext';

interface OpeningTrialBalanceWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** The caller owns where a posted journal entry actually goes (e.g. addJournalEntry). */
  onJournalPosted?: (entry: JournalEntry) => void;
}

type WizardStep = 'upload' | 'preview' | 'report';

export const OpeningTrialBalanceWizard: React.FC<OpeningTrialBalanceWizardProps> = ({
  isOpen,
  onClose,
  onJournalPosted,
}) => {
  const { currentTenant } = useERP();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read-only: the same localStorage keys AccountsView/MultiWarehouseView/
  // MultiCurrencyView already use. Never written here.
  const [periods] = useState<AccountingPeriod[]>(() => {
    const saved = localStorage.getItem('starq:accounting_periods:v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return generateFiscalPeriods(2026);
      }
    }
    return generateFiscalPeriods(2026);
  });
  const [chartOfAccounts] = useState<AccountRecord[]>(() => {
    const saved = localStorage.getItem('starq:chart_of_accounts:v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_CHART_OF_ACCOUNTS;
      }
    }
    return DEFAULT_CHART_OF_ACCOUNTS;
  });

  const [step, setStep] = useState<WizardStep>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [parsedLines, setParsedLines] = useState<OpeningBalanceLineInput[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [postedEntry, setPostedEntry] = useState<JournalEntry | null>(null);
  const [postingError, setPostingError] = useState<string | null>(null);

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setParsedLines([]);
    setParseErrors([]);
    setPostedEntry(null);
    setPostingError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const csv = generateOpeningBalanceTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'opening-trial-balance-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const processTextContent = (text: string, name: string) => {
    setFileName(name);
    const parsed = parseDelimitedText(text);

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setParseErrors(['Uploaded file is empty or does not contain recognizable tabular rows.']);
      setParsedLines([]);
      setStep('preview');
      return;
    }

    const codeIdx = parsed.headers.findIndex((h) => h.trim().toLowerCase() === 'account_code');
    const debitIdx = parsed.headers.findIndex((h) => h.trim().toLowerCase() === 'debit');
    const creditIdx = parsed.headers.findIndex((h) => h.trim().toLowerCase() === 'credit');

    if (codeIdx === -1 || debitIdx === -1 || creditIdx === -1) {
      setParseErrors(['Header row must contain account_code, debit and credit columns.']);
      setParsedLines([]);
      setStep('preview');
      return;
    }

    const lines: OpeningBalanceLineInput[] = [];
    const rowErrors: string[] = [];

    parsed.rows.forEach((row, idx) => {
      const accountCode = (row[codeIdx] || '').trim();
      const debit = Number(row[debitIdx] || 0);
      const credit = Number(row[creditIdx] || 0);

      if (!accountCode) {
        rowErrors.push(`Row ${idx + 2}: account_code is required.`);
        return;
      }
      if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
        rowErrors.push(`Row ${idx + 2} (${accountCode}): debit and credit must be numeric.`);
        return;
      }

      lines.push({ accountCode, debit, credit });
    });

    setParsedLines(lines);
    setParseErrors(rowErrors);
    setStep('preview');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') processTextContent(content, file.name);
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
      if (typeof content === 'string') processTextContent(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const buildResult = buildOpeningBalanceJournal({
    lines: parsedLines,
    accounts: chartOfAccounts,
    asOfDate,
    tenantId: currentTenant?.id || 'demo-org-id',
  });

  const handlePost = () => {
    setPostingError(null);
    try {
      const result = buildOpeningBalanceJournal({
        lines: parsedLines,
        accounts: chartOfAccounts,
        asOfDate,
        tenantId: currentTenant?.id || 'demo-org-id',
        periods,
      });
      if (!result.isValid || !result.journalEntry) {
        setPostingError(result.errors.join(' '));
        return;
      }
      setPostedEntry(result.journalEntry);
      if (onJournalPosted) onJournalPosted(result.journalEntry);
      setStep('report');
    } catch (err) {
      setPostingError((err as Error).message || 'Opening balance journal was rejected by posting control.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Opening Trial Balance & Financial Balances"
      subtitle={`Set up opening balances for ${currentTenant?.name || 'this organisation'} as of Go-Live.`}
      maxWidth="3xl"
      actions={
        step === 'upload' ? (
          <>
            <Button variant="outlined" onClick={handleClose}>Cancel</Button>
            <Button variant="filled" icon={<Download size={14} />} onClick={handleDownloadTemplate}>
              Download Template
            </Button>
          </>
        ) : step === 'preview' ? (
          <>
            <Button variant="outlined" onClick={() => setStep('upload')}>Back</Button>
            <Button
              variant="filled"
              icon={<Check size={14} />}
              disabled={parseErrors.length > 0 || parsedLines.length === 0 || !buildResult.isValid}
              onClick={handlePost}
            >
              Post Opening Balance
            </Button>
          </>
        ) : (
          <Button variant="filled" onClick={handleClose}>Done</Button>
        )
      }
    >
      <div className="space-y-6 py-2">
        <div className="flex items-center justify-between border-b pb-3 text-xs text-[var(--md-sys-color-on-surface-variant)]">
          <div className={`flex items-center gap-1.5 ${step === 'upload' ? 'font-bold text-[var(--md-sys-color-primary)]' : ''}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">1</span>
            Upload Balances
          </div>
          <ChevronRight size={14} />
          <div className={`flex items-center gap-1.5 ${step === 'preview' ? 'font-bold text-[var(--md-sys-color-primary)]' : ''}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">2</span>
            Validate Balance
          </div>
          <ChevronRight size={14} />
          <div className={`flex items-center gap-1.5 ${step === 'report' ? 'font-bold text-[var(--md-sys-color-primary)]' : ''}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">3</span>
            Posted
          </div>
        </div>

        {postingError && (
          <div
            role="alert"
            data-testid="posting-rejected"
            className="flex items-start gap-3 rounded-lg border border-[var(--md-sys-color-error)] bg-[var(--md-sys-color-error-container)] p-4 text-[var(--md-sys-color-on-error-container)]"
          >
            <span className="font-semibold shrink-0">Posting rejected</span>
            <span className="text-sm">{postingError}</span>
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">Go-Live Date</label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="border rounded-lg px-2 py-1 text-sm"
              />
            </div>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-outline-variant)] rounded-2xl p-8 text-center cursor-pointer bg-[var(--md-sys-color-surface-container)]/50 hover:bg-[var(--md-sys-color-surface-container)] transition-all flex flex-col items-center justify-center space-y-3"
            >
              <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFileUpload} />
              <div className="w-12 h-12 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-primary)] flex items-center justify-center">
                <Upload size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--md-sys-color-on-surface)]">Click to browse or drag and drop your opening balances CSV</p>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">account_code, debit, credit — one row per chart-of-accounts account</p>
              </div>
            </div>
            <div className="p-3 bg-[var(--md-sys-color-primary-container)]/60 rounded-xl border border-[var(--md-sys-color-primary)] flex items-start gap-3 text-xs text-[var(--md-sys-color-primary)]">
              <FileSpreadsheet size={16} className="text-[var(--md-sys-color-primary)] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Note: </span>
                Debits and credits across all lines must sum exactly. One immutable Opening Balance journal entry is posted.
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <Surface className="p-4 rounded-xl border">
              <div className="flex items-center justify-between text-sm">
                <span>File: {fileName}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={buildResult.isValid ? 'positive' : 'destructive'}>
                    {buildResult.isValid ? 'Balanced' : 'Unbalanced'}
                  </Badge>
                  <span>Debit {buildResult.totalDebit.toFixed(2)} / Credit {buildResult.totalCredit.toFixed(2)}</span>
                </div>
              </div>
            </Surface>

            {(parseErrors.length > 0 || buildResult.errors.length > 0) && (
              <div className="space-y-1">
                {[...parseErrors, ...buildResult.errors].map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[var(--md-sys-color-error)]">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            )}

            {parsedLines.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[var(--md-sys-color-on-surface-variant)]">
                    <th className="py-1">Account</th>
                    <th className="py-1 text-right">Debit</th>
                    <th className="py-1 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedLines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-1">{l.accountCode}</td>
                      <td className="py-1 text-right">{l.debit ? l.debit.toFixed(2) : ''}</td>
                      <td className="py-1 text-right">{l.credit ? l.credit.toFixed(2) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {step === 'report' && postedEntry && (
          <div className="space-y-3">
            <Badge variant="positive">Opening Balance Posted</Badge>
            <p className="text-sm">
              Journal entry <span className="font-mono">{postedEntry.entryNumber}</span> posted as of {postedEntry.date},{' '}
              {postedEntry.lines.length} lines, Debit {postedEntry.totalDebit.toFixed(2)} / Credit {postedEntry.totalCredit.toFixed(2)}.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
