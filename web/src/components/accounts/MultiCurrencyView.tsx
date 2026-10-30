import React, { useState } from 'react';
import {
  Scale,
  Building2,
  Globe,
  Coins,
  AlertTriangle
} from 'lucide-react';
import {
  DEFAULT_MMA_RATES,
  SupportedCurrency,
  calculateRealizedFxGainLoss,
  calculateUnrealizedRevaluation,
  FxSettlementResult,
  UnrealizedRevaluationResult,
} from '../../domain/multiCurrency';
import { JournalEntry } from '../../domain/journals';
import { PostingRejected } from '../../domain/postingControl';
import { AccountingPeriod, generateFiscalPeriods } from '../../domain/periods';
import { AccountRecord } from '../../domain/accounts';
import { DEFAULT_CHART_OF_ACCOUNTS } from '../../data/defaultChartOfAccounts';
import { useERP } from '../../context/ERPContext';
import { Badge, Surface, Button } from '../ui';

export const MultiCurrencyView: React.FC<{
  onAddJournalEntry?: (entry: JournalEntry) => void;
}> = ({ onAddJournalEntry }) => {
  const { formatMVR, currentTenant } = useERP();

  const [mmaRates, setMmaRates] = useState<Record<SupportedCurrency, number>>(DEFAULT_MMA_RATES);
  const [editingCurrency, setEditingCurrency] = useState<SupportedCurrency | null>(null);
  const [editRateValue, setEditRateValue] = useState<string>('');

  // Settlement Form State
  const [transType, setTransType] = useState<'AR_COLLECTION' | 'AP_DISBURSEMENT'>('AR_COLLECTION');
  const [refDoc, setRefDoc] = useState('INV-USD-2026-08');
  const [currency, setCurrency] = useState<SupportedCurrency>('USD');
  const [foreignAmt, setForeignAmt] = useState<number>(5000);
  const [originalRate, setOriginalRate] = useState<number>(15.42);
  const [settlementRate, setSettlementRate] = useState<number>(15.65);
  const [recentSettlements, setRecentSettlements] = useState<FxSettlementResult[]>([]);
  const [postingError, setPostingError] = useState<string | null>(null);

  // Shared with AccountsView/MultiWarehouseView (SERP-467): same localStorage
  // keys so a realized-FX journal is gated by the same periods/chart of
  // accounts the rest of the ledger uses.
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

  // Period End Revaluation State
  const [usdBankBalance, setUsdBankBalance] = useState<number>(25000);
  const [usdBookMvr, setUsdBookMvr] = useState<number>(385500); // 25,000 * 15.42

  const handleUpdateRate = (cur: SupportedCurrency) => {
    const num = parseFloat(editRateValue);
    if (!isNaN(num) && num > 0) {
      setMmaRates((prev) => ({ ...prev, [cur]: num }));
      setEditingCurrency(null);
    }
  };

  const handleCalculateSettlement = () => {
    setPostingError(null);
    let result: FxSettlementResult;
    try {
      result = calculateRealizedFxGainLoss({
        transactionType: transType,
        reference: refDoc,
        currency,
        foreignAmount: foreignAmt,
        originalRate,
        settlementRate,
        settlementDate: new Date().toISOString().slice(0, 10),
        tenantId: currentTenant.id || 'tenant-01',
        periods,
        accounts: chartOfAccounts,
      });
    } catch (err) {
      setPostingError(err instanceof PostingRejected ? err.message : (err as Error).message || 'Realized FX journal was rejected by posting control.');
      return;
    }

    setRecentSettlements([result, ...recentSettlements]);

    if (onAddJournalEntry) {
      onAddJournalEntry(result.journalEntry);
    }

    alert(`Realized FX Settlement recorded! Journal Entry #${result.journalEntry.entryNumber} posted.`);
  };

  const revalResult: UnrealizedRevaluationResult = calculateUnrealizedRevaluation({
    accountCode: '1112',
    accountName: 'Bank of Maldives (BML) USD Account',
    currency: 'USD',
    foreignBalance: usdBankBalance,
    bookMvrBalance: usdBookMvr,
    closingMmaRate: mmaRates.USD,
  });

  return (
    <div className="space-y-6 finance-light-compat" data-testid="multi-currency-view">
      {postingError && (
        <div
          role="alert"
          data-testid="posting-rejected"
          className="flex items-start gap-3 rounded-lg border border-[var(--md-sys-color-error)] bg-[var(--md-sys-color-error-container)] p-4 text-[var(--md-sys-color-on-error-container)]"
        >
          <span className="font-semibold shrink-0">Posting rejected</span>
          <span className="text-sm">{postingError}</span>
          <button
            type="button"
            onClick={() => setPostingError(null)}
            className="ml-auto text-sm underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Header & MMA Rates Board */}
      <Surface className="p-6 rounded-2xl border border-slate-800 bg-[#0a0f1d]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Globe size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white">Multi-Currency & MMA Exchange Rates</h2>
                <Badge variant="warning">DEMO / SAMPLE DATA</Badge>
                <Badge variant="neutral">Base Currency: MVR</Badge>
              </div>
              <p className="text-xs text-slate-400">
                Sample MMA-style rates, simulated balances, and a settlement calculator. Not live MMA quotes or production balances until a live source is connected.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3.5 rounded-xl border flex items-start gap-2.5 bg-[var(--warning-subtle)] border-[var(--warning)] text-[var(--warning)]">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-[11px] uppercase tracking-wide">DEMO / SAMPLE DATA — simulated defaults, not a live MMA or bank feed</span>
            <p className="text-[11px] leading-relaxed opacity-90">
              Exchange rates and foreign balances on this screen are seeded demo / sample data (for example USD 15.42, USD 25,000, book MVR 385,500). They are simulated placeholders until a live MMA rate source and live bank balances are integrated. Revalued balance and gain/loss use the same calculation as production; only the inputs are sample.
            </p>
          </div>
        </div>

        {/* Currency Rates Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-6">
          {(Object.keys(mmaRates) as SupportedCurrency[]).map((cur) => (
            <div
              key={cur}
              className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white font-mono">{cur}</span>
                <Badge variant="warning" size="sm">DEMO</Badge>
              </div>
              {editingCurrency === cur && cur !== 'MVR' ? (
                <div className="flex items-center gap-1 pt-1">
                  <input
                    type="number"
                    step="0.01"
                    value={editRateValue}
                    onChange={(e) => setEditRateValue(e.target.value)}
                    className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-amber-500 text-xs text-white font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateRate(cur)}
                    className="px-1.5 py-0.5 rounded bg-amber-500 text-black text-[10px] font-bold cursor-pointer"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (cur !== 'MVR') {
                      setEditingCurrency(cur);
                      setEditRateValue(mmaRates[cur].toString());
                    }
                  }}
                  className={`text-sm font-bold font-mono ${
                    cur === 'MVR' ? 'text-slate-400' : 'text-amber-400 hover:text-amber-300 cursor-pointer'
                  }`}
                  title={cur !== 'MVR' ? 'Click to edit spot rate' : undefined}
                >
                  {mmaRates[cur].toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">MVR</span>
                </div>
              )}
              <div className="text-[9px] text-slate-500">
                {cur === 'USD' ? 'DEMO · MMA peg sample' : cur === 'MVR' ? 'DEMO · Base Currency' : 'DEMO · sample spot'}
              </div>
            </div>
          ))}
        </div>
      </Surface>

      {/* Realized FX Settlement Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Surface className="p-6 rounded-2xl border border-slate-800 bg-[#0a0f1d] space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Coins size={18} className="text-sky-400" />
            <h3 className="text-sm font-bold text-white">Foreign Currency Settlement Simulator</h3>
            <Badge variant="warning" size="sm">SAMPLE DATA</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Calculate and book Realized FX Gain or Loss upon foreign invoice collection or supplier bill payment. Seeded amounts and rates below are sample defaults, not live balances.
          </p>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Transaction Type</label>
                <select
                  value={transType}
                  onChange={(e) => setTransType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="AR_COLLECTION">AR Customer Collection (Receipt)</option>
                  <option value="AP_DISBURSEMENT">AP Supplier Payment (Disbursement)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Reference Document</label>
                <input
                  type="text"
                  value={refDoc}
                  onChange={(e) => setRefDoc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => {
                    const c = e.target.value as SupportedCurrency;
                    setCurrency(c);
                    setOriginalRate(mmaRates[c]);
                    setSettlementRate(mmaRates[c]);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="SGD">SGD (S$)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Foreign Amount (SAMPLE)</label>
                <input
                  type="number"
                  value={foreignAmt}
                  onChange={(e) => setForeignAmt(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Original Rate (SAMPLE · 15.42)</label>
                <input
                  type="number"
                  step="0.01"
                  value={originalRate}
                  onChange={(e) => setOriginalRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Settlement Spot Rate (SAMPLE)</label>
              <input
                type="number"
                step="0.01"
                value={settlementRate}
                onChange={(e) => setSettlementRate(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            <Button
              variant="filled"
              size="sm"
              onClick={handleCalculateSettlement}
              icon={<Scale size={14} />}
              className="w-full mt-2"
            >
              <span>Record Settlement & Post FX Journal</span>
            </Button>
          </div>
        </Surface>

        {/* Period-End Foreign Currency Asset Revaluation */}
        <Surface className="p-6 rounded-2xl border border-slate-800 bg-[#0a0f1d] space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 size={18} className="text-purple-400" />
            <h3 className="text-sm font-bold text-white">Foreign Currency Balance Revaluation</h3>
            <Badge variant="warning" size="sm">DEMO / SAMPLE DATA</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Revalue foreign bank accounts and open AR/AP balances against closing MMA-style rates. USD 25,000 and book MVR 385,500 are simulated sample balances until live source integration exists.
          </p>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span>Account:</span>
              <span className="text-white font-bold">{revalResult.accountCode} - {revalResult.accountName}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Foreign Balance (SAMPLE):</span>
              <span className="text-white font-bold">${revalResult.foreignBalance.toLocaleString()} {revalResult.currency}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Book Balance (SAMPLE):</span>
              <span>{formatMVR(revalResult.bookMvrBalance)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Current MMA Rate (DEMO):</span>
              <span className="text-amber-400 font-bold">{revalResult.closingMmaRate.toFixed(2)} MVR</span>
            </div>
            <div className="flex items-center justify-between text-slate-300 pt-2 border-t border-slate-800">
              <span>Revalued Asset Balance:</span>
              <span className="text-purple-300 font-bold">{formatMVR(revalResult.revaluedMvrBalance)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span>Unrealized Gain / (Loss):</span>
              <span className={`font-bold text-sm ${
                revalResult.unrealizedGainLossMvr >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {formatMVR(revalResult.unrealizedGainLossMvr)}
              </span>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
};
