import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Car,
  ChevronRight,
  Filter,
  DollarSign,
  Receipt,
  Wrench,
  Sparkles
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { NewCustomerModal } from './NewCustomerModal';

export const CustomersView: React.FC = () => {
  const navigate = useNavigate();
  const {
    customers,
    setIsNewCustomerOpen,
    formatMVR
  } = useERP();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterIsland, setFilterIsland] = useState<string>('All');

  const filtered = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.vehicles.some(
        (v) =>
          v.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.model.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesType = filterType === 'All' || c.type === filterType;
    const matchesIsland = filterIsland === 'All' || c.island.includes(filterIsland);
    return matchesSearch && matchesType && matchesIsland;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="erp-h1 text-2xl">Customer Accounts & Fleets</h1>
            <span className="erp-pill erp-pill-neutral text-xs">
              {customers.length} Profiles
            </span>
          </div>
          <p className="erp-muted mt-0.5 text-xs">
            Client directory, registered vehicles/vessels, job histories, and outstanding receivables
          </p>
        </div>

        <button
          onClick={() => setIsNewCustomerOpen(true)}
          className="erp-btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Add Customer & Vehicle</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="erp-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="erp-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, plate # or model..."
            className="erp-input w-full pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="erp-muted">Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="erp-input py-1 text-xs"
            >
              <option value="All">All Types</option>
              <option value="Individual">Individual</option>
              <option value="VIP">VIP</option>
              <option value="Fleet">Fleet</option>
              <option value="Corporate">Corporate</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="erp-muted">Island:</span>
            <select
              value={filterIsland}
              onChange={(e) => setFilterIsland(e.target.value)}
              className="erp-input py-1 text-xs"
            >
              <option value="All">All Islands</option>
              <option value="Male">Male' City</option>
              <option value="Hulhumale">Hulhumale'</option>
              <option value="Villimale">Villimale'</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer Table */}
      <div className="erp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Customer Name & Contact</th>
                <th>Type & Location</th>
                <th>Registered Vehicles</th>
                <th className="text-center">Active Jobs</th>
                <th className="text-right">Total Invoiced</th>
                <th className="text-right">Balance Due</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center erp-muted py-8">
                    No customers found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    data-clickable="true"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    <td>
                      <div className="font-bold text-xs">{customer.name}</div>
                      <div className="text-[11px] erp-muted font-mono">{customer.phone} • {customer.email}</div>
                    </td>
                    <td>
                      <span className={`erp-pill ${
                        customer.type === 'VIP' ? 'erp-pill-warning' : customer.type === 'Fleet' ? 'erp-pill-info' : 'erp-pill-neutral'
                      } text-[10px]`}>
                        {customer.type}
                      </span>
                      <div className="text-[11px] erp-muted mt-0.5">{customer.island}</div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {customer.vehicles.map((v, i) => (
                          <span
                            key={i}
                            className="erp-pill erp-pill-neutral text-[10px] font-mono"
                          >
                            {v.plateNumber} ({v.model})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-center">
                      {customer.activeJobsCount > 0 ? (
                        <span className="erp-pill erp-pill-info text-[10px]">
                          {customer.activeJobsCount} Active
                        </span>
                      ) : (
                        <span className="erp-muted text-[11px]">0</span>
                      )}
                    </td>
                    <td className="text-right font-mono font-bold">
                      {formatMVR(customer.totalInvoiced, false)}
                    </td>
                    <td className="text-right font-mono font-bold">
                      {customer.outstandingBalance > 0 ? (
                        <span className="text-rose-400">{formatMVR(customer.outstandingBalance, false)}</span>
                      ) : (
                        <span className="text-emerald-400">0.00</span>
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

      <NewCustomerModal />
    </div>
  );
};
