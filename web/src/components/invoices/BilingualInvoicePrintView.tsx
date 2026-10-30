import React, { useState } from 'react';
import {
  Printer,
  Globe,
  FileText,
  Building2,
  Calendar,
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Download
} from 'lucide-react';
import {
  DHIVEHI_COMMERCE_DICTIONARY,
  formatDhivehiDate,
} from '../../domain/dhivehiLocalization';
import { generateFavaraPaymentPayload } from '../../domain/favaraQr';
import { useERP } from '../../context/ERPContext';
import { Badge, Surface, Button } from '../ui';
import { DEMO_INVOICE_PRINT_DATA } from '../../data/demoFixtures';

export interface InvoicePrintData {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  customerName: string;
  customerTin?: string;
  items: Array<{
    id: string;
    description: string;
    descriptionDhivehi?: string;
    quantity: number;
    unitPrice: number;
    gstRate: number;
    amount: number;
  }>;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: 'MVR' | 'USD';
  status: string;
}

export const BilingualInvoicePrintView: React.FC<{
  invoice?: InvoicePrintData;
}> = ({ invoice }) => {
  const { currentTenant, formatMVR } = useERP();

  const [languageMode, setLanguageMode] = useState<'bilingual' | 'dhivehi' | 'english'>('bilingual');

  const defaultInvoice: InvoicePrintData = DEMO_INVOICE_PRINT_DATA;

  const inv = invoice || defaultInvoice;
  const d = DHIVEHI_COMMERCE_DICTIONARY;

  const favaraAccountNumber = currentTenant.bmlAccount?.match(/\d{13}/)?.[0] || null;
  const favaraPayload = favaraAccountNumber
    ? generateFavaraPaymentPayload({
        merchantName: currentTenant.name || 'Starq Marine Services',
        merchantCity: 'Male',
        accountNumber: favaraAccountNumber,
        bankName: ('BML') as any,
        currency: inv.currency,
        amount: inv.totalAmount,
        invoiceNumber: inv.invoiceNumber,
      })
    : null;

  return (
    <div className="space-y-6" data-testid="bilingual-invoice-print-view">
      {/* Control Strip */}
      <Surface className="p-4 rounded-2xl border border-slate-800 bg-[#0a0f1d] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-sky-400" />
          <span className="text-xs font-bold text-white">Document Language:</span>
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setLanguageMode('bilingual')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                languageMode === 'bilingual' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Bilingual (ދެބަހުން)
            </button>
            <button
              type="button"
              onClick={() => setLanguageMode('dhivehi')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                languageMode === 'dhivehi' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="thaana-text" lang="dv">ދިވެހި</span> (Thaana)
            </button>
            <button
              type="button"
              onClick={() => setLanguageMode('english')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                languageMode === 'english' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              English
            </button>
          </div>
        </div>

        <Button
          variant="filled"
          size="sm"
          onClick={() => window.print()}
          icon={<Printer size={14} />}
        >
          <span>Print Tax Invoice</span>
        </Button>
      </Surface>

      {/* Printable Tax Invoice Paper (A4 Style) */}
      <div className="bg-white text-slate-900 p-8 sm:p-12 rounded-3xl shadow-2xl border border-slate-300 max-w-4xl mx-auto space-y-8 font-sans">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-slate-900 pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
              {languageMode !== 'dhivehi' && 'TAX INVOICE'}
              {languageMode === 'bilingual' && ' / '}
              {languageMode !== 'english' && <span className="thaana-text font-bold text-xl" lang="dv">{d.taxInvoice}</span>}
            </h1>
            <div className="text-xs font-bold text-slate-700">
              {currentTenant.name || 'STARQ MARINE & COMMERCIAL SERVICES PVT LTD'}
            </div>
            <div className="text-[11px] text-slate-600">
              H. Starq Tower, Boduthakurufaanu Magu, Male 20026, Maldives
            </div>
            <div className="text-[11px] font-mono font-bold text-slate-800">
              TIN / ޓީ.އައި.އެން: {currentTenant.tinNumber || '—'}
            </div>
          </div>

          <div className="text-right space-y-1 font-mono text-xs">
            <div className="text-base font-black text-slate-900">
              #{inv.invoiceNumber}
            </div>
            <div className="text-slate-600">
              Date / <span className="thaana-text" lang="dv">{d.date}</span> <span className="font-bold text-slate-900">{inv.issueDate}</span>
              {languageMode !== 'english' && <span className="thaana-text" lang="dv"> ({formatDhivehiDate(inv.issueDate)})</span>}
            </div>
            <div className="text-slate-600">
              Due / <span className="thaana-text" lang="dv">{d.dueDate}</span> <span className="font-bold text-slate-900">{inv.dueDate}</span>
            </div>
          </div>
        </div>

        {/* Bill To Customer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Billed To / <span className="thaana-text" lang="dv">{d.customerName}</span>
            </span>
            <div className="font-bold text-sm text-slate-900">{inv.customerName}</div>
            {inv.customerTin && (
              <div className="font-mono text-[11px] text-slate-600">
                Customer TIN: {inv.customerTin}
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 text-[11px] font-bold text-slate-800 uppercase">
                <th className="py-2.5 px-2">#</th>
                <th className="py-2.5 px-2">
                  {languageMode !== 'dhivehi' && 'Description'}
                  {languageMode === 'bilingual' && ' / '}
                  {languageMode !== 'english' && <span className="thaana-text" lang="dv">{d.itemDescription}</span>}
                </th>
                <th className="py-2.5 px-2 text-right">
                  {languageMode !== 'dhivehi' && 'Qty'}
                  {languageMode === 'bilingual' && ' / '}
                  {languageMode !== 'english' && <span className="thaana-text" lang="dv">{d.quantity}</span>}
                </th>
                <th className="py-2.5 px-2 text-right">
                  {languageMode !== 'dhivehi' && 'Unit Price'}
                  {languageMode === 'bilingual' && ' / '}
                  {languageMode !== 'english' && <span className="thaana-text" lang="dv">{d.unitPrice}</span>}
                </th>
                <th className="py-2.5 px-2 text-right">
                  {languageMode !== 'dhivehi' && 'GST (8%)'}
                  {languageMode === 'bilingual' && ' / '}
                  {languageMode !== 'english' && <span className="thaana-text" lang="dv">{d.gst8Percent}</span>}
                </th>
                <th className="py-2.5 px-2 text-right">
                  {languageMode !== 'dhivehi' && 'Amount (MVR)'}
                  {languageMode === 'bilingual' && ' / '}
                  {languageMode !== 'english' && <span className="thaana-text" lang="dv">{d.subtotal}</span>}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {inv.items.map((item, idx) => (
                <tr key={item.id} className="text-slate-800">
                  <td className="py-3 px-2 font-mono">{idx + 1}</td>
                  <td className="py-3 px-2">
                    {languageMode !== 'dhivehi' && <div className="font-semibold">{item.description}</div>}
                    {languageMode !== 'english' && item.descriptionDhivehi && (
                      <div className="thaana-text text-[11px] text-slate-600 pt-0.5" dir="rtl" lang="dv">
                        {item.descriptionDhivehi}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right font-mono font-bold">{item.quantity}</td>
                  <td className="py-3 px-2 text-right font-mono">{formatMVR(item.unitPrice)}</td>
                  <td className="py-3 px-2 text-right font-mono text-slate-600">
                    {formatMVR(item.amount * item.gstRate)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono font-bold">
                    {formatMVR(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Favara QR Payment Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t-2 border-slate-900">
          {/* Favara Instant QR Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-300 flex items-center gap-4">
            <div className="w-24 h-24 bg-white p-1.5 rounded-xl border border-slate-300 shadow-sm shrink-0">
              {favaraPayload ? (
                <img
                  src={favaraPayload.qrSvgDataUri}
                  alt="Favara Instant Pay QR"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div
                  data-testid="favara-qr-not-configured"
                  className="w-full h-full flex items-center justify-center text-center text-[10px] font-bold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Not configured
                </div>
              )}
            </div>
            <div className="space-y-1 text-xs">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="thaana-text" lang="dv">{d.favaraInstantPay}</span>
              </div>
              <div className="text-[11px] text-slate-600">
                Scan with BML Mobile Banking or any Favara app to pay instantly.
              </div>
              <div className="font-mono text-[10px] text-slate-500">
                Favara ID: {favaraAccountNumber ? `${favaraAccountNumber}@BML` : 'Not configured'}
              </div>
            </div>
          </div>

          {/* Numerical Totals */}
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 text-slate-600 border-b border-slate-200">
              <span>Subtotal / <span className="thaana-text" lang="dv">{d.subtotal}</span>:</span>
              <span>{formatMVR(inv.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600 border-b border-slate-200">
              <span>MIRA GST (8%) / <span className="thaana-text" lang="dv">{d.gst8Percent}</span>:</span>
              <span>{formatMVR(inv.taxAmount)}</span>
            </div>
            <div className="flex justify-between py-2 text-base font-black text-slate-900 border-b-2 border-slate-900">
              <span>Total Payable / <span className="thaana-text" lang="dv">{d.totalAmountDue}</span>:</span>
              <span>{formatMVR(inv.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center pt-4 border-t border-slate-200 space-y-1 text-xs text-slate-500">
          <div className="thaana-text font-bold text-slate-700" dir="rtl" lang="dv">
            {d.thankYouMessage}
          </div>
          <div className="text-[10px]">
            This is a computer-generated tax invoice issued in accordance with Maldives Inland Revenue Authority regulations.
          </div>
        </div>
      </div>
    </div>
  );
};
