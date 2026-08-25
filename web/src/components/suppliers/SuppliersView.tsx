import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Building2,
  Package,
  DollarSign,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export const SuppliersView: React.FC = () => {
  const navigate = useNavigate();
  const { suppliers, formatMVR } = useERP();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const filtered = suppliers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery) ||
      s.islandOrCountry.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...new Set(suppliers.map((s) => s.category))];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="erp-h1 text-2xl">Approved Suppliers & Vendors</h1>
            <span className="erp-pill erp-pill-neutral text-xs">{suppliers.length} Registered</span>
          </div>
          <p className="erp-muted mt-0.5 text-xs">
            Direct vendors for automotive basecoats, primers, clearcoats, wrap films, and garage consumables.
          </p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="erp-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="erp-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by vendor, contact, phone, location..."
            className="erp-input w-full pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="erp-muted">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="erp-input py-1 text-xs"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="erp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Vendor / Supplier</th>
                <th>Category</th>
                <th>Contact Person</th>
                <th>Phone & Location</th>
                <th>Lead Time</th>
                <th className="text-right">Outstanding Balance</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center erp-muted py-8">
                    No suppliers found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((supplier) => (
                  <tr
                    key={supplier.id}
                    data-clickable="true"
                    onClick={() => navigate(`/suppliers/${supplier.id}`)}
                  >
                    <td>
                      <div className="font-bold">{supplier.name}</div>
                      <div className="text-[11px] erp-muted">{supplier.email}</div>
                    </td>
                    <td>
                      <span className="erp-pill erp-pill-neutral text-[11px]">{supplier.category}</span>
                    </td>
                    <td className="font-semibold text-xs">{supplier.contactPerson}</td>
                    <td className="text-xs">
                      <div>{supplier.phone}</div>
                      <div className="erp-muted text-[11px]">{supplier.islandOrCountry}</div>
                    </td>
                    <td className="text-xs erp-muted">{supplier.leadTimeDays}d lead time</td>
                    <td className="text-right font-mono font-bold">
                      {supplier.outstandingPayable > 0 ? (
                        <span className="erp-money-out">{formatMVR(supplier.outstandingPayable)}</span>
                      ) : (
                        <span className="text-emerald-400 font-semibold">Settled</span>
                      )}
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
    </div>
  );
};
