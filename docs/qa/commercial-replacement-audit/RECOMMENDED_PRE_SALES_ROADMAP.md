# RECOMMENDED PRE-SALES & COMMERCIAL REMEDIATION ROADMAP

**Document Status**: Authoritative Pre-Sales Strategic Execution Plan  
**Target Milestone**: "First Paid External ERP Replacement Customer"  
**Date**: 2026-08-27  

---

## 1. The Minimum Work Required to Win ONE Existing ERP Customer

To win our first real customer currently on Odoo or SAP, Starq Technologies must execute three focused phases:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: SELF-SERVICE SAAS & INGESTION (Week 1–2)                           │
│ • Self-Service Staff Invitation Workflow (public.invitations)               │
│ • Universal CSV/Excel Ingestion Tooling (Customers, Suppliers, SKUs, Stock) │
│ • Opening Balance Setup Wizard (Cash, Bank, AR, AP, Inventory Valuation)    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: CORE ACCOUNTING & AUDITOR TRUST (Week 3–4)                         │
│ • Live Double-Entry GL Posting UI & Account Ledger Drilldowns               │
│ • Trial Balance & 3-Statement Reporting (P&L, Balance Sheet, Cash Flow)     │
│ • BML / MIB CSV Bank Statement Parser & Reconciliation Screen               │
│ • 1-Click MIRA GST-201 Tax Return Export                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: MALDIVIAN COMPETITIVE MOAT (Week 5–6)                              │
│ • Multi-Warehouse Stock Transfer Orders                                     │
│ • Landed Cost Allocation for Container Imports                              │
│ • Bilingual Dhivehi (Thaana) / English Customer Invoicing                   │
│ • Route-based Code Splitting (< 300 kB initial bundle)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase-by-Phase Task Breakdown

### Phase 1: Self-Service SaaS & Ingestion
1. **Dynamic Staff Invitation System (`SERP-INV-01`)**:
   - Create `public.invitations` table.
   - Update `establishPerson` RPC to resolve pending invitations by Google OAuth email.
   - Build `Settings → Staff Management → Invite Staff` modal with multi-book and multi-location assignment.
2. **Data Migration Wizard (`SERP-MIG-01`)**:
   - Build Excel/CSV import parser for:
     - Customer master catalog
     - Supplier master catalog
     - Product & inventory catalog
     - Open unpaid customer invoices
     - Open unpaid supplier bills
3. **Opening Balance Wizard (`SERP-MIG-02`)**:
   - Guided onboarding step where the CFO enters opening asset/liability balances, automatically generating the balanced Opening Journal Entry.

---

### Phase 2: Accounting & General Ledger Surfacing
1. **Chart of Accounts & General Ledger Explorer (`SERP-ACC-01`)**:
   - Expose the underlying `journal_entries` and `journal_lines` in an intuitive accounting UI.
   - Add account ledger drilldown (clicking an account shows all historical debits/credits).
2. **Standard Financial Statements (`SERP-ACC-02`)**:
   - Generate standard 2-column Trial Balance.
   - Generate official Balance Sheet with Assets = Liabilities + Equity check.
   - Generate MIRA GST-201 compliant schedule.
3. **Bank Statement Reconciliation (`SERP-ACC-03`)**:
   - Upload BML / MIB CSV export.
   - Side-by-side matching of bank statement lines with recorded receipts/payments.

---

### Phase 3: Commercial Moat for the Maldives
1. **Landed Cost Calculator (`SERP-TRD-01`)**:
   - Allocate freight, clearance, and harbor transport over incoming PO lines.
2. **Multi-Warehouse Stock Transfers (`SERP-LOG-01`)**:
   - Dispatch stock from Main Warehouse to Branch / Workshop with transit tracking.
3. **Bilingual Dhivehi & BML QR Payments (`SERP-LOC-01`)**:
   - Embed Thaana font for invoice notes and print output.
   - Generate dynamic BML Favara QR codes on PDF invoices for instant customer mobile scanning.
