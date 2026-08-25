import React from 'react';
import {
  X,
  Truck,
  CheckCircle2,
  Calendar,
  DollarSign,
  Package,
  Building2,
  Clock,
  Printer
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Badge } from '../common/Badge';

export const PODetailModal: React.FC = () => {
  const {
    selectedPOId,
    setSelectedPOId,
    purchaseOrders,
    formatMVR,
    receivePurchaseOrder
  } = useERP();

  if (!selectedPOId) return null;

  const po = purchaseOrders.find((p) => p.id === selectedPOId || p.poNumber === selectedPOId);
  if (!po) return null;

  const handleReceiveStock = () => {
    receivePurchaseOrder(po.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={() => setSelectedPOId(null)}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-200 bg-slate-50">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xl font-extrabold text-blue-600 font-mono tracking-tight">
                {po.poNumber}
              </span>
              <Badge
                variant={
                  po.status === 'Received & Stocked'
                    ? 'success'
                    : po.status === 'Sent'
                    ? 'info'
                    : 'warning'
                }
              >
                {po.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Supplier: <span className="text-slate-900 font-semibold">{po.supplierName}</span> • Order Date: {po.orderDate}
            </p>
          </div>

          <button
            onClick={() => setSelectedPOId(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-700">
          {/* Status & Delivery Card */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Expected Delivery</span>
              <div className="font-semibold text-slate-900 mt-0.5">{po.expectedDeliveryDate}</div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Payment Status</span>
              <div className="mt-0.5">
                <Badge variant={po.paymentStatus === 'Paid' ? 'success' : 'danger'} size="sm">
                  {po.paymentStatus}
                </Badge>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
              Ordered Items & Quantities
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Item Name</th>
                    <th className="py-2.5 px-4 text-center">Qty</th>
                    <th className="py-2.5 px-4 text-right">Unit Cost</th>
                    <th className="py-2.5 px-4 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {po.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{item.itemName}</td>
                      <td className="py-2.5 px-4 text-center font-mono text-slate-700">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-4 text-right mono-num text-slate-700">{formatMVR(item.unitCost)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900 mono-num">
                        {formatMVR(item.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PO Notes */}
          {po.notes && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-semibold text-slate-500">Notes: </span>
              <span className="text-slate-700">{po.notes}</span>
            </div>
          )}

          {/* Financial Total */}
          <div className="flex justify-between items-center p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="font-bold text-slate-700">Total Purchase Order Cost:</span>
            <span className="text-lg font-extrabold text-blue-600 mono-num">
              {formatMVR(po.totalAmount)}
            </span>
          </div>
        </div>

        {/* Footer with Action */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div>
            {po.status !== 'Received & Stocked' ? (
              <button
                onClick={handleReceiveStock}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Received & Add to Stock</span>
              </button>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Stock received & incremented in inventory
              </span>
            )}
          </div>

          <button
            onClick={() => setSelectedPOId(null)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
