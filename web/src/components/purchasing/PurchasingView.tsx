import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Search,
  Plus,
  Filter,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Truck
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { CreatePOModal } from './CreatePOModal';

export const PurchasingView: React.FC = () => {
  const navigate = useNavigate();
  const {
    suppliers,
    purchaseOrders,
    setIsCreatePOOpen,
    formatMVR,
    totalAccountsPayable
  } = useERP();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredPOs = purchaseOrders.filter((po) => {
    const matchesSearch =
      po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.items.some((i) => i.itemName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="erp-h1 text-2xl">Purchasing & Material Procurement</h1>
            <span className="erp-pill erp-pill-neutral text-xs">
              {purchaseOrders.length} Orders
            </span>
          </div>
          <p className="erp-muted mt-0.5 text-xs">
            Purchase orders, material delivery receipts, and supplier accounts payable
          </p>
        </div>

        <button
          onClick={() => setIsCreatePOOpen(true)}
          className="erp-btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>New Purchase Order</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Total Accounts Payable</span>
          <div className={`erp-figure text-2xl font-bold mt-1 ${totalAccountsPayable > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {formatMVR(totalAccountsPayable, false)}
          </div>
          <span className="text-[11px] erp-muted">Unpaid supplier dues</span>
        </div>

        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Open Purchase Orders</span>
          <div className="erp-figure text-2xl font-bold mt-1" style={{ color: 'var(--accent)' }}>
            {purchaseOrders.filter((p) => p.status === 'Sent').length} Active
          </div>
          <span className="text-[11px] erp-muted">Awaiting delivery & check-in</span>
        </div>

        <div className="erp-card p-4">
          <span className="erp-muted block text-xs font-semibold">Approved Suppliers</span>
          <div className="erp-figure text-2xl font-bold mt-1">
            {suppliers.length} Vendors
          </div>
          <span className="text-[11px] erp-muted">Paints, vinyls, abrasives</span>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="erp-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="erp-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by PO #, supplier name, item..."
            className="erp-input w-full pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="erp-muted">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="erp-input py-1 text-xs"
          >
            <option value="All">All Statuses</option>
            <option value="Sent">Sent (In Transit)</option>
            <option value="Received & Stocked">Received & Stocked</option>
            <option value="Draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="erp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Supplier / Vendor</th>
                <th>Order Date</th>
                <th>Expected Delivery</th>
                <th>Items Ordered</th>
                <th className="text-right">Total Amount</th>
                <th className="text-center">Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center erp-muted py-8">
                    No purchase orders found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => (
                  <tr
                    key={po.id}
                    data-clickable="true"
                    onClick={() => navigate(`/purchasing/${po.id}`)}
                  >
                    <td>
                      <div className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{po.poNumber}</div>
                    </td>
                    <td>
                      <div className="font-bold text-xs">{po.supplierName}</div>
                    </td>
                    <td className="text-xs">{po.orderDate}</td>
                    <td className="text-xs erp-muted">{po.expectedDeliveryDate}</td>
                    <td className="text-xs">
                      <div className="font-semibold">{po.items.length} line items</div>
                      <div className="text-[11px] erp-muted truncate max-w-xs">
                        {po.items.map((i) => `${i.itemName} (${i.quantity})`).join(', ')}
                      </div>
                    </td>
                    <td className="text-right font-mono font-bold erp-money-out">
                      {formatMVR(po.totalAmount)}
                    </td>
                    <td className="text-center">
                      <span className={`erp-pill ${
                        po.status === 'Received & Stocked'
                          ? 'erp-pill-positive'
                          : po.status === 'Sent'
                          ? 'erp-pill-warning'
                          : 'erp-pill-neutral'
                      } text-[11px]`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                        Inspect →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreatePOModal />
    </div>
  );
};
