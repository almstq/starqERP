import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Package,
  FileText,
  CreditCard,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export const SupplierDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { suppliers, purchaseOrders, inventory, formatMVR } = useERP();

  const supplier = suppliers.find((s) => s.id === id);

  if (!supplier) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/suppliers')} className="erp-btn-quiet flex items-center gap-2">
          <ArrowLeft size={16} />
          <span>Back to Suppliers</span>
        </button>
        <div className="erp-card p-12 text-center">
          <Truck size={40} className="erp-muted mx-auto mb-3" />
          <h2 className="erp-h1 text-xl">Supplier Record Not Found</h2>
          <p className="erp-muted mt-2 text-sm">No supplier matching ID "{id}" was found.</p>
          <button onClick={() => navigate('/suppliers')} className="erp-btn-primary mt-6">
            View All Suppliers
          </button>
        </div>
      </div>
    );
  }

  const supplierPOs = purchaseOrders.filter((p) => p.supplierId === supplier.id || p.supplierName === supplier.name);
  const suppliedItems = inventory.filter((item) => item.supplierId === supplier.id || item.supplierName === supplier.name);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/suppliers')}
          className="erp-btn-quiet p-2 rounded-xl flex items-center justify-center"
          title="Back to Suppliers"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="erp-h1 text-2xl">{supplier.name}</h1>
            <span className="erp-pill erp-pill-neutral text-xs">{supplier.category}</span>
          </div>
          <p className="erp-muted mt-0.5 text-xs">
            Contact: {supplier.contactPerson} • {supplier.phone} • {supplier.islandOrCountry}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Outstanding Payable</span>
          <div className={`erp-figure text-xl mt-1 ${supplier.outstandingPayable > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {formatMVR(supplier.outstandingPayable)}
          </div>
          <span className="text-[11px] erp-muted">Pending balance due to vendor</span>
        </div>

        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Total POs Placed</span>
          <div className="erp-figure text-xl mt-1" style={{ color: 'var(--accent)' }}>
            {supplierPOs.length} Orders
          </div>
          <span className="text-[11px] erp-muted">Lifetime purchase orders</span>
        </div>

        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Supplied Inventory SKUs</span>
          <div className="erp-figure text-xl mt-1">
            {suppliedItems.length} Materials
          </div>
          <span className="text-[11px] erp-muted">Catalog items sourced</span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): PO History & Catalog */}
        <div className="lg:col-span-8 space-y-6">
          {/* Purchase Order History */}
          <div className="erp-card p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">Purchase Order History</h2>
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>PO #</th>
                    <th>Order Date</th>
                    <th>Items</th>
                    <th className="text-right">Amount</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierPOs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center erp-muted py-6">
                        No purchase orders recorded for this supplier.
                      </td>
                    </tr>
                  ) : (
                    supplierPOs.map((po) => (
                      <tr key={po.id} data-clickable="true" onClick={() => navigate(`/purchasing/${po.id}`)}>
                        <td className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{po.poNumber}</td>
                        <td className="text-xs">{po.orderDate}</td>
                        <td className="text-xs font-semibold">{po.items.length} items</td>
                        <td className="text-right font-mono font-bold erp-money-out">{formatMVR(po.totalAmount)}</td>
                        <td className="text-center">
                          <span className={`erp-pill ${
                            po.status === 'Received & Stocked' ? 'erp-pill-positive' : 'erp-pill-warning'
                          } text-[11px]`}>
                            {po.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Supplied Inventory SKUs */}
          <div className="erp-card p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">Supplied Inventory SKUs</h2>
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Material Name</th>
                    <th>Stock Qty</th>
                    <th className="text-right">Unit Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliedItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center erp-muted py-6">
                        No catalog inventory items mapped to this supplier.
                      </td>
                    </tr>
                  ) : (
                    suppliedItems.map((item) => (
                      <tr key={item.id}>
                        <td className="font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>{item.sku}</td>
                        <td className="font-semibold text-xs">{item.name}</td>
                        <td className="font-mono text-xs">{item.quantityOnHand} {item.unit}</td>
                        <td className="text-right font-mono text-xs">{formatMVR(item.unitCost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Vendor Profile */}
        <div className="lg:col-span-4 space-y-6">
          <div className="erp-card p-5 space-y-4 text-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider">Vendor Profile</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="erp-muted">Contact Person:</span>
                <span className="font-semibold">{supplier.contactPerson}</span>
              </div>
              <div className="flex justify-between">
                <span className="erp-muted">Phone:</span>
                <span className="font-mono">{supplier.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="erp-muted">Email:</span>
                <span>{supplier.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="erp-muted">Lead Time:</span>
                <span>{supplier.leadTimeDays} days</span>
              </div>
              <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="erp-muted">Address:</span>
                <span className="font-semibold text-right">{supplier.address}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
