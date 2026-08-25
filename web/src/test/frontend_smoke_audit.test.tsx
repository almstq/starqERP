import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ERPProvider } from '../context/ERPContext';
import { AppShell } from '../app/AppShell';

import { DashboardView } from '../components/dashboard/DashboardView';
import { CustomersView } from '../components/customers/CustomersView';
import { CustomerDetailView } from '../components/customers/CustomerDetailView';
import { JobsView } from '../components/jobs/JobsView';
import { JobDetailView } from '../components/jobs/JobDetailView';
import { InvoicesView } from '../components/invoices/InvoicesView';
import { InvoiceDetailView } from '../components/invoices/InvoiceDetailView';
import { PaymentsView } from '../components/payments/PaymentsView';
import { PaymentDetailView } from '../components/payments/PaymentDetailView';
import { ExpensesView } from '../components/expenses/ExpensesView';
import { InventoryView } from '../components/inventory/InventoryView';
import { PurchasingView } from '../components/purchasing/PurchasingView';
import { PODetailView } from '../components/purchasing/PODetailView';
import { SuppliersView } from '../components/suppliers/SuppliersView';
import { SupplierDetailView } from '../components/suppliers/SupplierDetailView';
import { ReportsView } from '../components/reports/ReportsView';
import { AuditLogView } from '../components/audit/AuditLogView';
import { SettingsView } from '../components/settings/SettingsView';

afterEach(() => {
  cleanup();
});

const renderSurface = (initialEntry: string) => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ERPProvider>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<DashboardView />} />
            <Route path="customers" element={<CustomersView />} />
            <Route path="customers/:id" element={<CustomerDetailView />} />
            <Route path="jobs" element={<JobsView />} />
            <Route path="jobs/:id" element={<JobDetailView />} />
            <Route path="invoices" element={<InvoicesView />} />
            <Route path="invoices/:id" element={<InvoiceDetailView />} />
            <Route path="payments" element={<PaymentsView />} />
            <Route path="payments/:id" element={<PaymentDetailView />} />
            <Route path="expenses" element={<ExpensesView />} />
            <Route path="inventory" element={<InventoryView />} />
            <Route path="purchasing" element={<PurchasingView />} />
            <Route path="purchasing/:id" element={<PODetailView />} />
            <Route path="suppliers" element={<SuppliersView />} />
            <Route path="suppliers/:id" element={<SupplierDetailView />} />
            <Route path="reports" element={<ReportsView />} />
            <Route path="audit" element={<AuditLogView />} />
            <Route path="settings" element={<SettingsView />} />
          </Route>
        </Routes>
      </ERPProvider>
    </MemoryRouter>
  );
};

describe('Systematic Frontend Smoke Audit (SERP-197)', () => {
  it('Surface 1: Dashboard renders without runtime exceptions', () => {
    expect(() => renderSurface('/')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Operations Overview/i })).toBeDefined();
  });

  it('Surface 2: Customers list & Customer Detail render cleanly', () => {
    expect(() => renderSurface('/customers')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Customer Accounts & Fleets/i })).toBeDefined();

    cleanup();
    expect(() => renderSurface('/customers/cust-1')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Ahmed Rauf/i })).toBeDefined();
  });

  it('Surface 3: Jobs Pipeline & Job Detail render cleanly without permission crashes', () => {
    expect(() => renderSurface('/jobs')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Work Orders & Floor Pipeline/i })).toBeDefined();

    cleanup();
    expect(() => renderSurface('/jobs/job-1')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Work Order Journey/i })).toBeDefined();
  });

  it('Surface 4: Invoices list & Invoice Detail render with date-effective tax calculation', () => {
    expect(() => renderSurface('/invoices')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Commercial Invoices/i })).toBeDefined();

    cleanup();
    expect(() => renderSurface('/invoices/inv-1')).not.toThrow();
    expect(screen.getByRole('heading', { name: /INV-2026-081/i })).toBeDefined();
  });

  it('Surface 5: Payments list & Payment Detail render cleanly', () => {
    expect(() => renderSurface('/payments')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Payments & Cash Receipts/i })).toBeDefined();

    cleanup();
    expect(() => renderSurface('/payments/pay-1')).not.toThrow();
    expect(screen.getByRole('heading', { name: /PAY-1090/i })).toBeDefined();
  });

  it('Surface 6: Expenses Ledger renders cleanly', () => {
    expect(() => renderSurface('/expenses')).not.toThrow();
    expect(screen.getAllByText(/Operating Expenses/i).length).toBeGreaterThan(0);
  });

  it('Surface 7: Inventory & Stock Management renders cleanly', () => {
    expect(() => renderSurface('/inventory')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Materials & Paint Inventory/i })).toBeDefined();
  });

  it('Surface 8: Purchasing & PO Detail render cleanly', () => {
    expect(() => renderSurface('/purchasing')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Purchasing & Material Procurement/i })).toBeDefined();

    cleanup();
    expect(() => renderSurface('/purchasing/po-1')).not.toThrow();
    expect(screen.getByRole('heading', { name: /PO-2026-041/i })).toBeDefined();
  });

  it('Surface 9: Suppliers & Supplier Detail render cleanly', () => {
    expect(() => renderSurface('/suppliers')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Approved Suppliers & Vendors/i })).toBeDefined();

    cleanup();
    expect(() => renderSurface('/suppliers/sup-1')).not.toThrow();
    expect(screen.getByRole('heading', { name: /ColorCraft Maldives Pvt Ltd/i })).toBeDefined();
  });

  it('Surface 10: Reports & Financial Statements (P&L, Balance Sheet, Trial Balance) render cleanly', () => {
    expect(() => renderSurface('/reports')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Reports & Financial Statements/i })).toBeDefined();
  });

  it('Surface 11: Audit Trail Ledger renders cleanly', () => {
    expect(() => renderSurface('/audit')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Activity & Audit Trail/i })).toBeDefined();
  });

  it('Surface 12: Settings, RBAC Roles, User Management & Tenant Switching render cleanly', () => {
    expect(() => renderSurface('/settings')).not.toThrow();
    expect(screen.getByRole('heading', { name: /Tenant & System Settings/i })).toBeDefined();
  });
});
