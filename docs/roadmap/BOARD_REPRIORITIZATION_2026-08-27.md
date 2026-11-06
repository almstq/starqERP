<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document is SUPERSEDED and is retained as history only.**
>
> Prior reprioritization exercise. Do not use it to plan, implement, review or decide current StarqERP work.
>
> **Current development SSOT:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](../governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
> **Current roadmap:** [`ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`](ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md)
> **Supersession index:** [`SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md`](../governance/SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md)
>
> **What changed on 28 Sep 2026:** StarqERP development was stopped and the completion model
> was corrected from *complete the remaining modules* to *close the remaining business
> processes*. The five canonical ERP process chains are Order-to-Cash, Procure-to-Pay,
> Inventory-to-GL, Cash-to-Bank and Record-to-Report. This is **convergence, not rewrite** —
> all existing architecture, migrations, tests, evidence and completed tasks remain valid.
> **StarqERP implementation is ON HOLD** pending explicit Founder restart authorization.
>
> **Original content is preserved verbatim below.** Nothing was removed or rewritten.
>
---

# CANONICAL PROJECT BOARD RECONCILIATION & REPRIORITIZATION

**Document Status**: Authoritative SSOT Reconciliation & Roadmap Baseline  
**Date**: 2026-08-27  
**Canonical Board SSOT**: `D:\StarqTech\starqNexus\data\starq-erp-tasks.json`  

---

## 1. Executive Board Truth Metrics

| Dimension | Previous Baseline | Reconciled Post-Audit Truth | Variance / Rationale |
| :--- | :---: | :---: | :--- |
| **Total Canonical Tasks** | **264** | **318** | **+54 New Tasks** added to capture full commercial ERP replacement requirements. |
| **Completed Tasks (Done)** | **117** | **117** | **0 Modified**: Historical completion proofs strictly preserved. |
| **Work in Progress (WIP / Next)** | **1** (`SERP-028` blocked) | **2** (`SERP-283` Next, `SERP-028` Blocked) | `SERP-283` is the active unblocked execution gate. |
| **Planned Tasks** | **146** | **199** | Complete commercial replacement backlog sequenced. |
| **Completion Percentage** | **44.31%** | **36.79%** | Denominator expanded truthfully to reflect real enterprise readiness. |

---

## 2. Requirement-to-Board Reconciliation Matrix

| Commercial Audit Requirement | Canonical Task ID | Status / Priority | Action Taken |
| :--- | :---: | :---: | :--- |
| **Platform Realignment PR #10 CI & Merge** | `SERP-283` | `next` (P0) | Created new canonical task; immediate execution gate. |
| **Live Database Migrations 0024 & 0025** | `SERP-284` | `planned` (P0) | Created new canonical task; deploy platform & books schema. |
| **Gateway Full Authorization Graph** | `SERP-285` | `planned` (P0) | Created new canonical task; resolve full entity/book hierarchy. |
| **Self-Service Staff Invitation Workflow** | `SERP-286` | `planned` (P0) | **CRITICAL CANONICAL TASK**: `public.invitations`, token expiry, role assignment. |
| **Removal of Staff Allowlist Dependency** | `SERP-287` | `planned` (P0) | Created new canonical task; eliminate hardcoded backend JSON. |
| **Clean Workspace & Zero Demo Contamination**| `SERP-288` | `planned` (P0) | Created new canonical task; enforce calm truthful empty states. |
| **Removal of Browser/Mock Authority** | `SERP-289` | `planned` (P0) | Created new canonical task; pure signed Edge RPC routing. |
| **Chart of Accounts Hierarchy UI** | `SERP-290` | `planned` (P0) | Legitimate canonical assignment; COA management view. |
| **Live Double-Entry General Ledger Explorer**| `SERP-291` | `planned` (P0) | Real-time balanced journal posting & GL explorer. |
| **Standard Trial Balance & Balance Sheet** | `SERP-292` | `planned` (P0) | 2-column Trial Balance and balanced Balance Sheet. |
| **P&L Drilldown & 30/60/90+ AR/AP Aging** | `SERP-293` | `planned` (P0) | Authoritative P&L with ledger drilldown and aging matrices. |
| **Credit Notes & Customer Advance Deposits** | `SERP-294` | `planned` (P0) | Formal credit note issuance and settlement allocations. |
| **Accounting Period Lock & Year-End Close** | `SERP-295` | `planned` (P0) | Period lock and year-end Retained Earnings roll-forward. |
| **Bank Ledger & BML/MIB CSV Reconciliation** | `SERP-296` | `planned` (P0) | BML/MIB statement upload and side-by-side reconciliation. |
| **MIRA GST-201 Formal Tax Return Export** | `SERP-297` | `planned` (P0) | Exact box-by-box MIRA GST-201 export schedule. |
| **Starq HQ Platform Operator Console** | `SERP-298` | `planned` (P0) | Tenant registry, seat limits, and operator management. |
| **Production Domain, OAuth & Secrets** | `SERP-299` | `planned` (P0) | DNS, Google OAuth verification, and Supabase secrets. |
| **Live Multi-Tenant RLS Adversarial Suite** | `SERP-300` | `planned` (P0) | Database isolation test suite against live Supabase. |
| **Production Observability & Alerts** | `SERP-301` | `planned` (P0) | Telemetry, structured logs, and security alert events. |
| **Universal CSV/XLSX Ingestion Framework** | `SERP-302` | `planned` (P1) | Core client/server bulk migration pipeline. |
| **Customer & Supplier Master Data Import** | `SERP-303` | `planned` (P1) | Customer/vendor Excel migration wizard. |
| **Product & SKU Catalog Bulk Import Tool** | `SERP-304` | `planned` (P1) | 5,000+ SKU inventory catalog uploader. |
| **Opening Stock Quantity & Valuation Wizard**| `SERP-305` | `planned` (P1) | Initial stock count and inventory valuation wizard. |
| **Opening Trial Balance Onboarding Wizard** | `SERP-306` | `planned` (P1) | CFO opening balance wizard generating Opening Journal. |
| **Unpaid Invoices (AR) & Bills (AP) Import** | `SERP-307` | `planned` (P1) | Unpaid historical documents migration tool. |
| **Odoo/SAP Cutover Runbook & Validator** | `SERP-308` | `planned` (P1) | Automated post-migration reconciliation validator. |
| **Perpetual Inventory Valuation & COGS** | `SERP-309` | `planned` (P1) | Moving average valuation & automated COGS posting. |
| **Landed Cost Allocation (Container Imports)**| `SERP-310` | `planned` (P1) | Freight/duty/port fee allocation over item cost. |
| **3-Way Matching Procurement Engine** | `SERP-311` | `planned` (P1) | PO vs GRN vs Supplier Bill validation. |
| **Multi-Warehouse Stock Transfer Orders** | `SERP-312` | `planned` (P1) | Inter-branch transit orders and dispatch tracking. |
| **Batch & Serial Number Tracking** | `SERP-313` | `planned` (P1) | Full serial/batch lifecycle for parts and consumables. |
| **Tiered Customer Price Lists** | `SERP-314` | `planned` (P1) | Retail vs Wholesale vs Resort tiered price lists. |
| **Credit Limits & Automated Dunning** | `SERP-315` | `planned` (P1) | Credit limit enforcement and WhatsApp/PDF statements. |
| **Inter-Book Transfers & Consolidation** | `SERP-316` | `planned` (P1) | Inter-book journal transfers and balance elimination. |
| **Direct & Indirect Cash Flow Statement** | `SERP-317` | `planned` (P1) | Operating, Investing, and Financing cash movements. |
| **Multi-Currency (USD) & MMA FX Rates** | `SERP-318` | `planned` (P1) | Dynamic MMA exchange rates and FX gain/loss. |
| **MIRA 16% Tourism Tax & Green Tax** | `SERP-319` | `planned` (P1) | TGSTA and Green Tax schedules. |
| **Staged & Milestone Progress Billing** | `SERP-320` | `planned` (P1) | Percentage-of-completion billing for marine refits. |
| **Technician Timesheets & Labor Costing** | `SERP-321` | `planned` (P1) | Hourly labor tracking on job cards. |
| **Subcontractor Retention & 10% WHT** | `SERP-322` | `planned` (P1) | Retention holding and Non-Resident Withholding Tax. |
| **Bilingual Dhivehi (Thaana) / English Docs**| `SERP-323` | `planned` (P2) | Native Thaana typography print templates. |
| **Verified MMA Favara / BML QR Payments** | `SERP-324` | `planned` (P2) | Dynamic payment QR codes on invoices. |
| **Multi-Island Sea-Cargo Logistics** | `SERP-325` | `planned` (P2) | Dhoni dispatch and harbor gate pass tracking. |
| **Maldives Operational Geographic Directory**| `SERP-326` | `planned` (P2) | Atoll/Island master and local operating calendars. |
| **Maldives Pension (MPAO Koshaaru) Module** | `SERP-327` | `planned` (P2) | 7% employee + 7% employer pension deductions. |
| **Playwright Automated E2E Test Suite** | `SERP-328` | `planned` (P3) | Browser automation across desktop/mobile. |
| **Route Code Splitting (< 300 kB Bundle)** | `SERP-329` | `planned` (P3) | React lazy loading and bundle optimization. |
| **Low-Connectivity Offline PWA Sync** | `SERP-330` | `planned` (P3) | Service worker caching and IndexedDB offline queue. |
| **High-Concurrency Load Testing (500 Users)**| `SERP-331` | `planned` (P3) | Synthetic concurrency test and pool tuning. |
| **Specialized WCAG 2.1 AAA Accessibility** | `SERP-332` | `planned` (P3) | Formal accessibility and physical device lab test. |
| **Public REST API & Webhooks Gateway** | `SERP-333` | `planned` (P3) | External API keys and outgoing webhook events. |
| **Multi-Region Automated Disaster Recovery** | `SERP-334` | `planned` (P3) | Encrypted PITR replication and failover runbook. |
| **Starq HQ Tenant Billing Automation** | `SERP-335` | `planned` (P3) | Metered seat billing and platform usage invoices. |
| **Advanced Operational Tracing & Telemetry** | `SERP-336` | `planned` (P3) | OpenTelemetry tracing and real-time health monitors. |

---

## 3. Work Breakdown by Roadmap Group

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ GROUP 1 (G1): COMMERCIAL PILOT READINESS / EXPEDITE NOW (19 Tasks)          │
│ SERP-283 → SERP-301                                                         │
│ Goal: First paying external business safely operational.                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ GROUP 2 (G2): ERP REPLACEMENT READINESS (21 Tasks)                          │
│ SERP-302 → SERP-322                                                         │
│ Goal: First credible Odoo / SAP Business One replacement customer.          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ GROUP 3 (G3): MALDIVES COMPETITIVE ADVANTAGE / MOAT (5 Tasks)               │
│ SERP-323 → SERP-327                                                         │
│ Goal: Deep Maldives localization (Thaana, Favara QR, Sea-Cargo, Pension).  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ GROUP 4 (G4): SCALE & ENTERPRISE READINESS (9 Tasks)                        │
│ SERP-328 → SERP-336                                                         │
│ Goal: Performance, offline sync, E2E automation, public APIs, disaster DR.  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Next Actionable Implementation Task

* **Task ID**: **`SERP-283`**
* **Title**: `Platform realignment PR #10 CI resolution and branch merge`
* **Status**: `next` (P0)
* **Goal**: Merge `feat/platform-realignment` into `main` with all 37 test files green, 0 linter errors, and verified production build.
