import React, { useState } from 'react';
import {
  QrCode,
  Download,
  Copy,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Building2,
  X,
  Smartphone,
  Sparkles
} from 'lucide-react';
import {
  generateFavaraPaymentPayload,
  GeneratedFavaraQr,
} from '../../domain/favaraQr';
import { useERP } from '../../context/ERPContext';
import { Badge, Button } from '../ui';

export interface FavaraPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoiceNumber: string;
    customerName?: string;
    totalAmount: number;
    currency?: 'MVR' | 'USD';
    status?: string;
  };
  onPaymentReceived?: (invoiceId: string, amount: number) => void;
}

export const FavaraPaymentModal: React.FC<FavaraPaymentModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onPaymentReceived,
}) => {
  const { currentTenant, formatMVR } = useERP();
  const [copied, setCopied] = useState(false);
  const [isSimulatingSettlement, setIsSimulatingSettlement] = useState(false);

  if (!isOpen) return null;

  const qrConfig = {
    merchantName: currentTenant.name || 'Starq Marine & Tech',
    merchantCity: 'Male',
    accountNumber: currentTenant.bmlAccount || '7701192837101',
    bankName: ('BML') as any,
    currency: invoice.currency || 'MVR',
    amount: invoice.totalAmount,
    invoiceNumber: invoice.invoiceNumber,
  };

  const favaraData: GeneratedFavaraQr = generateFavaraPaymentPayload(qrConfig);

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(favaraData.rawPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulatePayment = () => {
    setIsSimulatingSettlement(true);
    setTimeout(() => {
      setIsSimulatingSettlement(false);
      if (onPaymentReceived) {
        onPaymentReceived(invoice.id, invoice.totalAmount);
      }
      alert(`MMA Favara Instant Payment Verified! MVR ${invoice.totalAmount.toLocaleString()} credited to Bank Account.`);
      onClose();
    }, 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="favara-payment-modal"
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <QrCode size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">MMA Favara Instant Pay</h3>
                <Badge variant="positive">Interoperable</Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                Scan with BML Mobile Banking, MIB FaisaMobile, or any Favara App
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* QR Display Card */}
        <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <div className="w-52 h-52 bg-white p-3 rounded-2xl shadow-xl flex items-center justify-center border-4 border-sky-500/20">
            <img
              src={favaraData.qrSvgDataUri}
              alt="MMA Favara QR Code"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="text-center space-y-1">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {favaraData.displayAmount}
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Invoice #{invoice.invoiceNumber}
            </div>
          </div>
        </div>

        {/* Merchant & Account Details */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between text-slate-400">
            <span>Payee Merchant:</span>
            <span className="text-white font-sans font-medium">{favaraData.merchantName}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Favara ID:</span>
            <span className="text-sky-400">{qrConfig.accountNumber}@{qrConfig.bankName}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>CRC16 Checksum:</span>
            <span className="text-emerald-400">{favaraData.checksum} (Verified)</span>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleCopyPayload}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Copy size={13} />
            <span>{copied ? 'Copied Payload!' : 'Copy EMV Payload'}</span>
          </button>

          <button
            type="button"
            disabled={isSimulatingSettlement}
            onClick={handleSimulatePayment}
            className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
          >
            <Sparkles size={13} />
            <span>{isSimulatingSettlement ? 'Verifying...' : 'Simulate Settlement'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
