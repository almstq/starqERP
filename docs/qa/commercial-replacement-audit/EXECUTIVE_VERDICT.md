# EXECUTIVE COMMERCIAL QA AUDIT VERDICT: CAN starqERP REPLACE ODOO / SAP FOR A MALDIVIAN BUSINESS TODAY?

**Document Status**: Authoritative Independent Commercial QA Audit  
**Date**: 2026-08-27  
**Audit Target**: `starqERP` (Repository commit `473d751`, branch `feat/platform-realignment`, PR #10)  
**Evaluator**: Antigravity Independent Commercial QA Assessment  

---

## 1. The Core Commercial Question

> **"Could Starq Technologies credibly sell the current starqERP to a Maldivian Odoo/SAP customer today?"**  
> **"Can a real business migrate its operations, accounting, and staff into this product and trust it enough to leave its existing ERP?"**

### The Cold Commercial Verdict:

# **VERDICT: [D] — NOT READY FOR AN EXTERNAL PAYING ERP REPLACEMENT CUSTOMER**
### *(Simultaneously: [C] — PILOT READY ONLY for 1 Controlled Design Partner: Club Ignition)*

---

## 2. Executive Summary & Commercial Reality

If Starq approached an established Maldivian trading company, hotel supplier, boatyard, or multi-branch enterprise currently running on **Odoo** or **SAP Business One**, and asked them to migrate their operational ledger, banking, inventory, and staff to starqERP today:

### **They would immediately fail in Week 1, for the following foundational reasons:**

1. **Zero Data Migration Tooling**: There is no CSV/Excel import pipeline for Chart of Accounts, opening trial balances, customer/vendor historical ledgers, opening stock valuation, or outstanding invoices. An established business cannot migrate without manual database scripts.
2. **Environment Variable Allowlist Gating (No Self-Service Staff Invitation)**: Staff cannot be invited by a customer's admin. Authentication is hardcoded to a backend environment variable JSON allowlist (`STARQBOOKS_ALLOWLIST_JSON`). A customer admin cannot add, invite, or assign roles to their own employees.
3. **Statutory & Accounting Ledger Gaps**:
   - The double-entry general ledger engine is structurally defined in SQL migrations (`journal_entries`, `journal_lines`), but the frontend client runs primarily on local React state and high-level summaries without live general ledger journal posting, automated bank statement feeds (BML/MIB MT940/CSV reconciliation), credit note allocation against specific invoices, or depreciation schedules.
   - Closing accounting periods, year-end roll-forward, and retained earnings calculations are not yet operationalized.
4. **Demo-Theater / Local Mock State Residue**: While top-level alerts and switchers have been cleared of fake incidents, major operational workflows (e.g. inventory adjustments, purchase orders, complex multi-line receipts) persist in local browser `localStorage`/memory rather than committing through transactional double-entry accounting APIs.
5. **No Mobile Offline / Low-Connectivity PWA Sync**: Maldivian outer-island boatyards and supply dhonis operate under intermittent 4G/LTE. starqERP currently requires an active online round-trip per command with no offline queuing or SQLite synchronization.

---

## 3. Buyer Scorecard (Cold Commercial Assessment: 0 – 10)

| Area | Score (0–10) | Commercial Assessment |
| :--- | :---: | :--- |
| **Core Accounting & GL** | **4.0 / 10** | Migrations define double-entry, but no live GL posting UI, bank feed reconciliation, or closing periods. |
| **Sales & Receivables (AR)** | **6.5 / 10** | Clean invoice creation and MIRA 8% calculation; lacks automated dunning, customer credit limits, and FX pricing. |
| **Purchasing & Payables (AP)**| **5.0 / 10** | PO creation exists; lacks 3-way matching (PO vs. GRN vs. Bill), landed-cost allocation, and import customs tracking. |
| **Inventory & Warehousing** | **5.5 / 10** | Single-location stock tracking; lacks multi-warehouse transfers, serial/batch tracking, and automated reorder rules. |
| **Jobs & Shop-Floor Ops** | **7.5 / 10** | Automotive workshop flow is mature, polished, and structured for Club Ignition. |
| **Multi-Company (Tenancy)** | **8.0 / 10** | Realigned two-plane architecture (Starq HQ vs. Tenant #0 vs. Tenant #1) is structurally sound. |
| **Multi-Book / Operating Activity** | **8.0 / 10** | Migration 0025 correctly models `public.books` and `public.business_names` without legal entity duplication. |
| **Staff Management & RBAC** | **3.0 / 10** | **BLOCKER**: 12 seats defined, but gated by hardcoded backend allowlist. No tenant-admin invite workflow. |
| **Financial & Tax Reporting** | **5.0 / 10** | GST calculation works; lacks full MIRA Output/Input tax return export, balance sheet drilldown, and cash flow statement. |
| **Maldives Localization** | **6.5 / 10** | MVR currency, TIN, island directories supported; lacks BML direct payment gateway, payroll MIRA/pension, and Dhivehi invoice notes. |
| **Data Migration Tooling** | **1.0 / 10** | **CRITICAL BLOCKER**: 0 CSV/Excel migration wizards or opening balance import tools. |
| **Security & Isolation** | **7.5 / 10** | Google OAuth token verification, RLS policies, CSRF tokens, HMAC session cookies, and idempotent execution. |
| **Reliability & Consistency**| **6.5 / 10** | Strong transactional migrations, but frontend relies heavily on in-memory mock fallback when backend RPCs are disconnected. |
| **Performance & Bundle** | **7.0 / 10** | Fast Vite compile, but single large bundle (`1.17 MB`); lacks code splitting and route lazy loading. |
| **UX & Mobile Ergonomics** | **8.5 / 10** | Polished Material 3 design system, responsive drawer/bottom nav, skip links, and zero horizontal table breakage. |
| **SaaS Administration** | **5.5 / 10** | Migration 0024 platform registry exists, but Starq HQ operator dashboard is not yet fully surfaced. |
| **Supportability & Audit** | **7.0 / 10** | Comprehensive immutable audit event structure and security logs. |
| **OVERALL COMMERCIAL AVERAGE**| **5.4 / 10** | **Strong Foundation & Workshop Niche; Unready for Broad ERP Replacement** |

---

## 4. Strategic Assessment

### Who Can We Sell To Today?
1. **Club Ignition Garage (Single Pilot Design Partner)**: Highly customized for automotive workshop operations, job card stages, vehicle lookups, and technician workflow.
2. **Very Small Greenfield Service Businesses (1–3 users)**: Where the founder personally operates the single ledger and does not need to migrate legacy historical data from SAP/Odoo.

### Who Must We NOT Sell To Yet?
1. **Existing Odoo or SAP Customers**: They will lose essential features (automated bank reconciliation, batch/serial tracking, landed cost calculation, customer credit limits, multi-currency purchasing, and self-service staff management).
2. **Wholesale / Import-Heavy Trading Companies**: They require multi-warehouse transfers, container freight allocation, sea-cargo customs clearing, and 3-way matching.
3. **Mid-Market Enterprises with > 10 Employees**: The lack of a self-service employee invitation and role assignment system makes onboarding impossible without Starq developer intervention.

---

## 5. What Would Make starqERP Materially Better for Maldives Than Odoo?

Odoo is a generic European enterprise suite with heavy local customization costs, complex configuration menus, and zero native Maldivian awareness. starqERP can decisively beat Odoo in the Maldives by delivering:

1. **Native MIRA & GST Compliance Out of the Box**: Zero-configuration 8% GST, automatic MIRA BML payment receipt generation, and 1-click MIRA GST-201 return export.
2. **Native Dhivehi & English Bilingual Invoicing**: Beautiful Maldivian invoice templates with English/Thaana typography and BML QR payment codes.
3. **Multi-Island Logistics & Cargo Tracking**: Native tracking of inter-island sea freight (Dhoni, Speedboat, Cargo Boat), harbor gate passes, and island branch inventory.
4. **10x Faster Lightweight Shop-Floor Workflow**: Unlike Odoo's bloated multi-click navigation, starqERP's Material 3 job cards and quick actions allow Maldivian mechanics, technicians, and counter staff to complete orders in seconds on mobile.
