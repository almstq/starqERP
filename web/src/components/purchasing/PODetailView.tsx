import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingCart,
  Truck,
  Calendar,
  DollarSign,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export const PODetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { purchaseOrders, suppliers, formatMVR, receivePurchaseOrder } = useERP();

  const po = purchaseOrders.find((p) => p.id === id || p.poNumber.toLowerCase() === id?.toLowerCase());

  if (!po) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/purchasing')} className="erp-btn-quiet flex items-center gap-2">
          <ArrowLeft size={16} />
          <span>Back to Purchasing</span>
        </button>
        <div className="erp-card p-12 text-center">
          <ShoppingCart size={40} className="erp-muted mx-auto mb-3" />
          <h2 className="erp-h1 text-xl">Purchase Order Not Found</h2>
          <p className="erp-muted mt-2 text-sm">No purchase order matching ID "{id}" was found.</p>
          <button onClick={() => navigate('/purchasing')} className="erp-btn-primary mt-6">
            View All Purchase Orders
          </button>
        </div>
      </div>
    );
  }

  const supplier = suppliers.find((s) => s.id === po.supplierId || s.name === po.supplierName);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/purchasing')}
            className="erp-btn-quiet p-2 rounded-xl flex items-center justify-center"
            title="Back to Purchasing"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="erp-h1 text-2xl">{po.poNumber}</h1>
              <span className={`erp-pill ${
                po.status === 'Received & Stocked'
                  ? 'erp-pill-positive'
                  : po.status === 'Sent'
                  ? 'erp-pill-warning'
                  : 'erp-pill-neutral'
              }`}>
                {po.status}
              </span>
            </div>
            <p className="erp-muted mt-0.5 text-xs">
              Ordered: {po.orderDate} • Expected: {po.expectedDeliveryDate}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {po.status !== 'Received & Stocked' && (
            <button
              onClick={() => receivePurchaseOrder(po.id)}
              className="erp-btn-primary flex items-center gap-1.5"
            >
              <Package size={14} />
              <span>Receive & Stock Items</span>
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="erp-btn-quiet p-2"
            title="Print PO"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left (8 cols): Ordered Items & Receiving Log */}
        <div className="lg:col-span-8 space-y-6">
          {/* Supplier Details */}
          <div className="erp-card p-5 space-y-2 text-xs">
            <span className="erp-muted block text-[11px]">Vendor / Supplier:</span>
            <div className="flex items-center justify-between">
              {supplier ? (
                <Link
                  to={`/suppliers/${supplier.id}`}
                  className="font-bold text-sm hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  {po.supplierName} →
                </Link>
              ) : (
                <span className="font-bold text-sm">{po.supplierName}</span>
              )}
              {supplier && (
                <span className="erp-muted">{supplier.phone} • {supplier.islandOrCountry}</span>
              )}
            </div>
          </div>

          {/* Ordered Line Items Table */}
          <div className="erp-card p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">Ordered Items & Quantities</h2>
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th className="text-center">Ordered Qty</th>
                    <th className="text-right">Unit Cost</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item) => (
                    <tr key={item.id}>
                      <td className="font-semibold">{item.itemName}</td>
                      <td className="text-center font-mono">{item.quantity} {item.unit}</td>
                      <td className="text-right font-mono">{formatMVR(item.unitCost)}</td>
                      <td className="text-right font-mono font-bold">{formatMVR(item.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-4 border-t text-sm font-bold" style={{ borderColor: 'var(--border)' }}>
              <span>Total Purchase Value:</span>
              <span className="font-mono erp-money-out">{formatMVR(po.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Right (4 cols): Order Status & Procurement Chain */}
        <div className="lg:col-span-4 space-y-6">
          <div className="erp-card p-5 space-y-4 text-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider">Procurement Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="erp-muted">Order Date:</span>
                <span className="font-mono">{po.orderDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="erp-muted">Expected Delivery:</span>
                <span className="font-mono">{po.expectedDeliveryDate}</span>
              </div>
              <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Receipt Status:</span>
                <span className={`erp-pill ${po.status === 'Received & Stocked' ? 'erp-pill-positive' : 'erp-pill-warning'}`}>
                  {po.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
