import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  Upload,
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Surface, Button, Badge, DataTable, ColumnDef } from '../ui';
import { Supplier } from '../../types/erp';
import { Modal } from '../common/Modal';
import { ContactBulkImportModal } from '../migration/ContactBulkImportModal';

export const SuppliersView: React.FC = () => {
  const navigate = useNavigate();
  const { suppliers, formatMVR, createSupplier, updateSupplier, deactivateSupplier } = useERP();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState<Supplier | null>(null);
  const [draft, setDraft] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '', islandOrCountry: '', category: '', leadTimeDays: '7' });

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setDraft({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      islandOrCountry: supplier.islandOrCountry,
      category: supplier.category,
      leadTimeDays: String(supplier.leadTimeDays),
    });
  };

  const categories = ['All', ...Array.from(new Set(suppliers.map((s) => s.category)))];

  const filtered = suppliers.filter((s) => {
    const matchesSearch =
      searchQuery === '' ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery) ||
      s.islandOrCountry.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const submitSupplier = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    createSupplier({ ...draft, name: draft.name.trim(), leadTimeDays: Math.max(0, Number(draft.leadTimeDays) || 7) });
    setDraft({ name: '', contactPerson: '', phone: '', email: '', address: '', islandOrCountry: '', category: '', leadTimeDays: '7' });
    setIsCreateOpen(false);
  };

  const submitSupplierUpdate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingSupplier || !draft.name.trim()) return;
    updateSupplier({ ...editingSupplier, ...draft, name: draft.name.trim(), leadTimeDays: Math.max(0, Number(draft.leadTimeDays) || 7) });
    setEditingSupplier(null);
    setDraft({ name: '', contactPerson: '', phone: '', email: '', address: '', islandOrCountry: '', category: '', leadTimeDays: '7' });
  };

  const columns: ColumnDef<Supplier>[] = [
    {
      key: 'name',
      header: 'Vendor / Supplier',
      render: (s) => (
        <div>
          <div className="font-bold text-[var(--md-sys-color-on-surface)]">{s.name}</div>
          <div className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">{s.email}</div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (s) => <Badge variant="neutral" size="sm">{s.category}</Badge>,
    },
    {
      key: 'contactPerson',
      header: 'Contact Person',
      render: (s) => <span className="font-semibold text-xs text-[var(--md-sys-color-on-surface)]">{s.contactPerson}</span>,
    },
    {
      key: 'phone',
      header: 'Phone & Location',
      render: (s) => (
        <div className="text-xs">
          <div className="font-mono text-[var(--md-sys-color-on-surface)]">{s.phone}</div>
          <div className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">{s.islandOrCountry}</div>
        </div>
      ),
    },
    {
      key: 'leadTimeDays',
      header: 'Lead Time',
      render: (s) => <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{s.leadTimeDays}d lead time</span>,
    },
    {
      key: 'outstandingPayable',
      header: 'Outstanding Balance',
      align: 'right',
      render: (s) => (
        <span
          className={`font-mono font-bold mono-num ${
            s.outstandingPayable > 0
              ? 'text-[var(--md-sys-color-error)]'
              : 'text-[var(--md-sys-color-primary)]'
          }`}
        >
          {s.outstandingPayable > 0 ? formatMVR(s.outstandingPayable) : 'Settled'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <div className="flex justify-end gap-2">
          <Button variant="outlined" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(s); }}>
            Edit
          </Button>
          <Button variant="outlined" size="sm" onClick={(e) => { e.stopPropagation(); setConfirmingDeactivate(s); }}>
            Deactivate
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)]">
              Approved Suppliers & Vendors
            </h1>
            <Badge variant="info" size="sm">
              {suppliers.length} Registered
            </Badge>
          </div>
          <div className="flex gap-2 items-center">
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
            Manage supplier and vendor records, contacts, settlement accounts, and purchase relationships
          </p>
          <div className="flex gap-2">
            <Button variant="outlined" size="sm" onClick={() => setIsBulkImportOpen(true)} icon={<Upload size={14} />}>Bulk Import</Button>
            <Button variant="filled" size="sm" onClick={() => setIsCreateOpen(true)}><Plus size={14} /> Add supplier</Button>
          </div>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <Surface variant="outlined" padding="sm" className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="text-[var(--md-sys-color-on-surface-variant)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by vendor, contact, phone, location..."
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)',
              borderColor: 'var(--md-sys-color-outline-variant)',
              borderRadius: 'var(--md-sys-shape-corner-small)',
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs border outline-none focus:border-[var(--md-sys-color-primary)]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--md-sys-color-on-surface-variant)]">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)',
              borderColor: 'var(--md-sys-color-outline-variant)',
              borderRadius: 'var(--md-sys-shape-corner-small)',
            }}
            className="h-8 px-2.5 text-xs border outline-none cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </Surface>

      {/* Suppliers Table */}
      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(s) => s.id}
        onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
        emptyMessage="No suppliers found matching filter criteria."
      />
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add supplier" subtitle="Create a tenant-scoped supplier contact" maxWidth="lg" actions={<><Button variant="outlined" onClick={() => setIsCreateOpen(false)}>Cancel</Button><Button variant="filled" onClick={submitSupplier}>Save supplier</Button></>}>
        <form onSubmit={submitSupplier} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['name', 'contactPerson', 'phone', 'email', 'address', 'islandOrCountry', 'category', 'leadTimeDays'] as const).map((field) => <label key={field} className="text-xs font-semibold">{field === 'name' ? 'Supplier name *' : field.replace(/[A-Z]/g, (m) => ` ${m}`).replace(/^./, (m) => m.toUpperCase())}<input required={field === 'name'} value={draft[field]} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl border text-xs font-normal" /></label>)}
        </form>
      </Modal>
      <Modal isOpen={editingSupplier !== null} onClose={() => { setEditingSupplier(null); setDraft({ name: '', contactPerson: '', phone: '', email: '', address: '', islandOrCountry: '', category: '', leadTimeDays: '7' }); }} title="Edit supplier" subtitle="Update a tenant-scoped supplier contact" maxWidth="lg" actions={<><Button variant="outlined" onClick={() => { setEditingSupplier(null); setDraft({ name: '', contactPerson: '', phone: '', email: '', address: '', islandOrCountry: '', category: '', leadTimeDays: '7' }); }}>Cancel</Button><Button variant="filled" onClick={submitSupplierUpdate}>Save changes</Button></>}>
        <form onSubmit={submitSupplierUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['name', 'contactPerson', 'phone', 'email', 'address', 'islandOrCountry', 'category', 'leadTimeDays'] as const).map((field) => <label key={field} className="text-xs font-semibold">{field === 'name' ? 'Supplier name *' : field.replace(/[A-Z]/g, (m) => ` ${m}`).replace(/^./, (m) => m.toUpperCase())}<input required={field === 'name'} value={draft[field]} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl border text-xs font-normal" /></label>)}
        </form>
      </Modal>
      <Modal isOpen={confirmingDeactivate !== null} onClose={() => setConfirmingDeactivate(null)} title="Deactivate supplier" subtitle="Remove this supplier from the active supplier list. The record is kept and can be restored." maxWidth="sm" actions={<><Button variant="outlined" onClick={() => setConfirmingDeactivate(null)}>Cancel</Button><Button variant="filled" onClick={() => { if (confirmingDeactivate) deactivateSupplier(confirmingDeactivate.id); setConfirmingDeactivate(null); }}>Deactivate</Button></>}>
        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Are you sure you want to deactivate <span className="font-semibold">{(confirmingDeactivate ?? { name: '' }).name}</span>? It will no longer appear in the approved suppliers list.</p>
      </Modal>
      <ContactBulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        defaultKind="supplier"
      />
    </div>
  );
};
