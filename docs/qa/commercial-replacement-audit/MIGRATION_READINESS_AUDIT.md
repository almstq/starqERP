# DATA MIGRATION & SWITCHING READINESS AUDIT

**Document Status**: Authoritative Pre-Sales Ingestion Audit  
**Date**: 2026-08-27  
**Core Question**: *"How would a prospective Maldivian enterprise migrate its existing Odoo or SAP data into starqERP today?"*  

---

## 1. The Direct Answer

# **MIGRATION READINESS SCORE: 1.0 / 10**
# **VERDICT: ZERO INGESTION TOOLING EXISTS TODAY.**

An established ERP customer cannot start from an empty screen. They have years of operational data, thousands of SKUs, open balances, and active supplier liabilities. 

Currently, **starqERP has zero user-facing or admin-facing data import capabilities (no CSV importers, no Excel templates, no REST ingestion pipelines, no Data Migration Wizard).**

---

## 2. Ingestion Feasibility Matrix (Odoo / SAP → starqERP)

| Data Category | Required Fields & Formats | starqERP Import Tooling | Current Ingestion Feasibility |
| :--- | :--- | :---: | :--- |
| **Customer Master Data** | Name, Phone, Email, TIN, Island, Address, Credit Limit | **NONE** | **MANUAL SQL ONLY**: Requires developer running manual insert statements. |
| **Supplier Master Data** | Supplier Name, Contact, Phone, Bank Details, Currency | **NONE** | **MANUAL SQL ONLY**. |
| **Chart of Accounts** | Account Code, Name, Type, Opening Debit/Credit | **NONE** | **BLOCKED**: No UI or API endpoint exists to upload a custom COA. |
| **Opening Trial Balance** | Account Balances as of Go-Live Date | **NONE** | **BLOCKED**: No opening journal entry upload tool. |
| **Product / Inventory Master** | SKU, Name, Category, Unit, Cost Price, Sell Price, Reorder Level | **NONE** | **MANUAL SQL ONLY**: Counter staff cannot upload a 2,000-SKU Excel catalog. |
| **Opening Stock Valuation** | Location, SKU, Quantity on Hand, Unit Cost Basis | **NONE** | **BLOCKED**: No bulk opening stock adjustment wizard. |
| **Open Customer Invoices (AR)** | Invoice No, Customer, Issue Date, Due Date, Total, Balance Due | **NONE** | **MANUAL ENTRY ONLY**: Must re-type every unpaid invoice by hand. |
| **Open Supplier Bills (AP)** | Bill No, Supplier, Date, Due Date, Total, Amount Owed | **NONE** | **MANUAL ENTRY ONLY**: Must re-type all unpaid supplier bills by hand. |
| **Historical Transactions** | Past 3–5 years of sales, payments, and general ledger history | **NONE** | **OUT OF SCOPE / IMPOSSIBLE TODAY**. |
| **Staff & User Access** | Email, Name, Role, Phone, Assigned Books/Locations | **NONE** | **HARDCODED ALLOWLIST**: Requires backend developer editing JSON in Deno env. |

---

## 3. What Happens If We Try to Onboard an Odoo Customer Tomorrow?

1. **Catastrophic Onboarding Friction**:
   - The customer exports their 3,500 inventory items, 450 customers, and 80 suppliers from Odoo as standard CSV files.
   - They look for an "Import" button in starqERP and find none.
   - Starq engineering would have to spend 2–3 weeks writing custom Python/PostgreSQL migration scripts, mapping column headers, converting foreign keys, and debugging data type mismatches manually.
2. **Opening Balance Reconciliation Breakdown**:
   - Because there is no opening journal entry interface, the customer's opening bank balance (e.g. `MVR 1,450,200` in BML) and opening Accounts Receivable cannot be posted without manual database intervention.
   - Day 1 financial reports will show unbalanced ledgers.

---

## 4. Minimum Required Tooling Before Commercial Pre-Sales

Before Starq can credibly pitch starqERP to any established business, the platform **MUST** provide a **Standard Data Migration Kit**:

1. **Standardized CSV/Excel Ingestion Templates**:
   - `starq_template_customers.xlsx`
   - `starq_template_suppliers.xlsx`
   - `starq_template_inventory_catalog.xlsx`
   - `starq_template_opening_stock.xlsx`
   - `starq_template_unpaid_invoices.xlsx`
   - `starq_template_unpaid_bills.xlsx`
2. **In-Browser CSV Validator & Preview**:
   - Drag-and-drop file upload in Settings → Data Management.
   - Real-time row validation (detecting duplicate SKUs, missing phone numbers, invalid TIN formats).
   - Atomic batch insert via backend Edge Function.
3. **Opening Balance Lock Wizard**:
   - A guided 3-step setup wizard where the business owner enters opening cash, bank balances, accounts receivable, accounts payable, and inventory valuation, automatically creating the balanced Opening Journal Entry (`DR/CR`) with offsetting Equity.
