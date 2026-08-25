import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';

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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardView /> },

      { path: 'customers', element: <CustomersView /> },
      { path: 'customers/:id', element: <CustomerDetailView /> },

      { path: 'jobs', element: <JobsView /> },
      { path: 'jobs/:id', element: <JobDetailView /> },

      { path: 'invoices', element: <InvoicesView /> },
      { path: 'invoices/:id', element: <InvoiceDetailView /> },

      { path: 'payments', element: <PaymentsView /> },
      { path: 'payments/:id', element: <PaymentDetailView /> },

      { path: 'expenses', element: <ExpensesView /> },

      { path: 'inventory', element: <InventoryView /> },

      { path: 'purchasing', element: <PurchasingView /> },
      { path: 'purchasing/:id', element: <PODetailView /> },

      { path: 'suppliers', element: <SuppliersView /> },
      { path: 'suppliers/:id', element: <SupplierDetailView /> },

      { path: 'reports', element: <ReportsView /> },
      { path: 'audit', element: <AuditLogView /> },
      { path: 'settings', element: <SettingsView /> },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
