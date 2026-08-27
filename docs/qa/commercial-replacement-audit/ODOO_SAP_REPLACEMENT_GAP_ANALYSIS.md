# ODOO 17/18 & SAP BUSINESS ONE REPLACEMENT GAP ANALYSIS

**Document Status**: Authoritative Technical & Commercial Feature Gap Analysis  
**Date**: 2026-08-27  
**Benchmark Reference**: Odoo Enterprise v17/18 & SAP Business One 10.0 FP2305  

---

## 1. Feature Matrix: starqERP vs. Odoo vs. SAP Business One

| Capability / Module | Odoo 17/18 Enterprise | SAP Business One (HANA) | starqERP (Current 2026-08) | Commercial Replacement Gap |
| :--- | :---: | :---: | :---: | :--- |
| **Double-Entry General Ledger** | Native Real-time Posting | Strict Financial Engine | Migration Schema Defined | **High Gap**: starqERP lacks live GL posting UI, manual journal creator, and ledger line drilldowns. |
| **Bank Feeds & Reconciliation** | Automated Bank Sync & AI Matching | Electronic Banking & Manual Matching | Manual Single Payment Entry | **Critical Gap**: No MT940 / CSV bank statement parser or reconciliation screen. |
| **Accounts Receivable (AR)** | Aging, Automated Dunning, Credit Limits | Credit Management & Dunning Wizard | Invoice Listing, Balance Due | **Moderate Gap**: Lacks customer credit limits and automated reminder statements. |
| **Accounts Payable (AP)** | 3-Way Matching, Landed Costs, Bill OCR | 3-Way Matching, Landed Costs | Purchase Order & Supplier Bills | **High Gap**: Lacks landed cost allocation (freight/customs over item cost) and 3-way matching. |
| **Inventory Valuation** | Automated FIFO / AVCO / Standard | Real-Time Perpetual / Moving Avg | Periodic / Manual Count | **High Gap**: No automated COGS posting on delivery or standard/FIFO valuation engine. |
| **Warehousing & Locations** | Multi-Warehouse, Bins, Routing | Multi-Warehouse, Bin Locations | Multi-Location Schema (M:N) | **Moderate Gap**: Schema exists; UI lacks inter-warehouse transfer requests and bin management. |
| **Batch / Serial Number Tracking**| Native Tracking & Traceability | Full Serial / Batch Lifecycle | Not Implemented | **Blocking for Medical / Auto Parts Distribution**. |
| **Sales & Quotations** | Multi-Tier Pricing, Customer Portal | Flexible Price Lists, Special Prices | Standard Price, Quote/Invoice | **Moderate Gap**: Lacks tiered wholesale price lists and customer self-service portal. |
| **Shop-Floor / Job Cards** | Manufacturing / Field Service Apps | Production Orders & Routing | Highly Specialized Workshop Flow | **PARITY / ADVANTAGE**: starqERP workshop workflow is faster and more ergonomic for mechanics. |
| **Multi-Company & Tenancy** | Multi-Company with Intercompany Txns| Multi-Branch & Intercompany | 2-Plane Control/Tenant + Books | **PARITY**: starqERP model is structurally clean, but lacks automated inter-book journal elimination. |
| **User Roles & RBAC** | Granular Group-Based ACLs | Matrix Authorization by Object | 12 Hardcoded Seats in Code | **High Gap**: Lacks tenant-admin UI for creating custom roles and inviting staff dynamically. |
| **Data Migration Wizards** | Universal CSV/Excel Importer | Data Transfer Workbench (DTW) | 0 Import Wizards | **CRITICAL BLOCKER**: Cannot ingest legacy ERP data without database engineering. |
| **Document Customization & Print** | QWeb Report Builder | Crystal Reports / Print Layout | Standard Web & Print CSS | **Moderate Gap**: Clean `@media print`, but cannot customize logos, bank details, or terms per book. |
| **Mobile App & Offline** | Mobile PWA & Native Apps | Native iOS / Android Mobile Apps | Responsive Material 3 Web | **Moderate Gap**: Responsive UI is excellent; lacks offline caching and service worker sync. |
| **API & Extensibility** | JSON-RPC / REST External APIs | Service Layer OData / REST | Deno Edge Function API Gateway | **PARITY**: Strong foundational RPC structure, but lacks public webhook integrations. |

---

## 2. Deep Dive by Maldivian Business Persona

### Persona A: Wholesale & Import Trading (e.g. Hardware, Food & Beverage, Resort Supplies)
* **What They Have in Odoo/SAP**:
  - Container-level procurement: allocating ocean freight, customs duty, and harbor handling across 500 SKUs.
  - Multi-tier wholesale pricing (Cash price, Resort price, Credit 30-day price).
  - Multi-warehouse stock (Male' central warehouse, Hulhumale store, Thilafushi bulk yard).
  - Credit limits: blocking sales orders if customer is 45 days overdue.
* **What Breaks in starqERP Today**:
  - Cannot allocate landed freight costs to inventory cost basis.
  - Cannot maintain separate price books per customer category.
  - No inter-warehouse transfer workflow.
  - **Verdict for Persona A**: **CANNOT REPLACE ODOO/SAP TODAY**.

---

### Persona B: Automotive & Service Workshop (e.g. Garage, PPF Wrap, Detailing, Marine Outboard Service)
* **What They Have in Odoo/SAP**:
  - Heavy, slow, generic work order modules requiring 12 clicks per repair task.
* **What They Get in starqERP Today**:
  - Specialized 8-stage repair rail (`Intake → Estimate → Parts → Work → QC → Handover → Invoicing`).
  - Vehicle registration lookups and customer vehicle history.
  - One-click job-to-invoice conversion.
* **Verdict for Persona B**: **READY AS A SPECIALIZED PILOT (Design Partner Club Ignition)**.

---

### Persona C: Marine Boatyard & Slipway Services
* **What They Have in Odoo/SAP**:
  - Project milestone billing (Drydock fee, hull blasting, fiberglass layup, antifouling paint, engine overhaul).
  - Marine engine parts catalog and labor hours per technician.
* **What Breaks in starqERP Today**:
  - Lacks staged progress billing against contract milestones.
  - Lacks timesheet tracking per marine technician.
* **Verdict for Persona C**: **REQUIRES STAGED BILLING & TIMESHEET EXTENSION**.

---

### Persona D: Construction & MEP Contracting
* **What They Have in Odoo/SAP**:
  - Job costing, retention money tracking, subcontractor billing, MIRA Withholding Tax (WHT).
* **What Breaks in starqERP Today**:
  - No retention billing or subcontractor withholding tax tracking.
* **Verdict for Persona D**: **NOT READY**.

---

### Persona E: Multi-Activity Corporate Group (e.g. Holding Company with Trading, Workshop, & Real Estate)
* **What They Have in Odoo/SAP**:
  - Multiple company databases rolling up to consolidated group balance sheets.
* **What starqERP Offers**:
  - Migration 0025 correctly establishes the 4-tier hierarchy: `Legal Entity → Trading Names → Operating Books → Locations`.
  - **Remaining Gap**: Lacks automated inter-book journal elimination and consolidated trial balance generation.
* **Verdict for Persona E**: **ARCHITECTURALLY READY; AWAITING REPORTING ENGINES**.
