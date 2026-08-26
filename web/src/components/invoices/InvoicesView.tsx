import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Search,
  Plus,
  Filter,
  CreditCard,
  Printer,
  ChevronRight,
  Clock,
  AlertCircle,
  FileCheck,
  Building2,
  DollarSign
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { RecordPaymentModal } from '../payments/RecordPaymentModal';
import {
  Button,
  Input,
  Surface,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  ActionGroup,
  ResponsiveGrid,
  type BadgeVariant,
} from '../ui';

export const InvoicesView: React.FC = () => {
  const navigate = useNavigate();
  const {
    invoices,
    setIsCreateInvoiceOpen,
    setIsRecordPaymentOpen,
    setPrefilledInvoiceId,
    formatMVR,
    totalOutstandingInvoices
  } = useERP();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.linkedJobNumber && inv.linkedJobNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalInvoicedSum = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaidSum = invoices.reduce((sum, i) => sum + i.amountPaid, 0);

  const getStatusBadgeVariant = (status: string): BadgeVariant => {
    switch (status) {
      case 'Paid': return 'positive';
      case 'Overdue': return 'destructive';
      case 'Partially Paid': return 'warning';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] truncate">
              Commercial Invoices
            </h1>
            <Badge variant="neutral" size="sm">
              {invoices.length} Invoices
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-[var(--md-sys-color-on-surface-variant)] truncate">
            Track customer billings, payment settlements, and balances
          </p>
        </div>

        <ActionGroup align="right" className="shrink-0">
          <Button
            variant="filled"
            size="sm"
            onClick={() => setIsCreateInvoiceOpen(true)}
            icon={<Plus size={15} />}
          >
            <span>New Invoice</span>
          </Button>
        </ActionGroup>
      </div>

      {/* KPI Cards */}
      <ResponsiveGrid columns="auto" minItemWidth="200px" gap="sm">
        <Surface variant="filled" level={1} padding="sm" container className="space-y-1 min-w-0">
          <span className="block text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)] truncate">
            Total Invoiced (MTD)
          </span>
          <div className="text-base sm:text-lg font-bold mono-num text-[var(--md-sys-color-on-surface)] truncate">
            {formatMVR(totalInvoicedSum, false)}
          </div>
        </Surface>

        <Surface variant="filled" level={1} padding="sm" container className="space-y-1 min-w-0">
          <span className="block text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)] truncate">
            Outstanding Receivables
          </span>
          <div
            className="text-base sm:text-lg font-bold mono-num truncate"
            style={{ color: totalOutstandingInvoices > 0 ? 'var(--md-sys-color-error)' : 'var(--positive)' }}
          >
            {formatMVR(totalOutstandingInvoices, false)}
          </div>
        </Surface>

        <Surface variant="filled" level={1} padding="sm" container className="space-y-1 min-w-0">
          <span className="block text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)] truncate">
            Settled Collections
          </span>
          <div className="text-base sm:text-lg font-bold mono-num truncate" style={{ color: 'var(--positive)' }}>
            {formatMVR(totalPaidSum, false)}
          </div>
        </Surface>
      </ResponsiveGrid>

      {/* Toolbar & Search */}
      <Surface variant="filled" level={1} padding="sm" className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
        <div className="relative flex-1 w-full md:max-w-md min-w-0">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by invoice #, customer name, job ID…"
            icon={<Search size={14} />}
          />
        </div>

        <div className="flex items-center gap-2 text-xs shrink-0 min-w-0">
          <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            Status:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)',
              borderColor: 'var(--md-sys-color-outline-variant)',
              borderRadius: 'var(--md-sys-shape-corner-small)',
            }}
            className="h-8 sm:h-9 px-2.5 text-xs border outline-none cursor-pointer"
          >
            <option value="All">All Invoices</option>
            <option value="Paid">Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </Surface>

      {/* Invoices Table in Contained Scroll Region */}
      <Table>
        <TableHeader>
          <tr>
            <TableHead>Invoice #</TableHead>
            <TableHead>Customer & Job</TableHead>
            <TableHead className="hidden sm:table-cell">Date</TableHead>
            <TableHead className="hidden md:table-cell">Due Date</TableHead>
            <TableHead alignRight>Total</TableHead>
            <TableHead alignRight className="hidden sm:table-cell">Paid</TableHead>
            <TableHead alignRight>Balance Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead alignRight>Action</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {filteredInvoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                No commercial invoices matching filter criteria.
              </TableCell>
            </TableRow>
          ) : (
            filteredInvoices.map((inv) => (
              <TableRow
                key={inv.id}
                onClick={() => navigate(`/invoices/${inv.id}`)}
                className="cursor-pointer"
              >
                <TableCell className="font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>
                  <span className="mono-num">{inv.invoiceNumber}</span>
                </TableCell>
                <TableCell>
                  <div className="font-semibold text-xs text-[var(--md-sys-color-on-surface)] truncate max-w-[140px] sm:max-w-none">{inv.customerName}</div>
                  {inv.linkedJobNumber && (
                    <div className="text-[11px] mono-num truncate" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Job: {inv.linkedJobNumber}</div>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  {inv.date}
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  {inv.dueDate}
                </TableCell>
                <TableCell isNumeric className="font-bold text-[var(--md-sys-color-on-surface)]">
                  {formatMVR(inv.totalAmount)}
                </TableCell>
                <TableCell isNumeric className="hidden sm:table-cell" style={{ color: 'var(--positive)' }}>
                  {formatMVR(inv.amountPaid)}
                </TableCell>
                <TableCell isNumeric className="font-bold">
                  {inv.balanceDue > 0 ? (
                    <span style={{ color: 'var(--md-sys-color-error)' }}>{formatMVR(inv.balanceDue)}</span>
                  ) : (
                    <span style={{ color: 'var(--positive)' }}>0.00</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(inv.status)} size="sm">
                    {inv.status}
                  </Badge>
                </TableCell>
                <TableCell alignRight>
                  <span className="text-xs font-semibold hover:underline" style={{ color: 'var(--md-sys-color-primary)' }}>
                    Inspect →
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <CreateInvoiceModal />
      <RecordPaymentModal />
    </div>
  );
};
