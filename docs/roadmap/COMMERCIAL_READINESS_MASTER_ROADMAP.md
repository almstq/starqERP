# COMMERCIAL READINESS MASTER ROADMAP (G1 → G4)

**Document Status**: Authoritative Commercial Milestone Roadmap  
**Date**: 2026-08-27  
**SSOT Board Tasks**: 318 Canonical Tasks (120 Done = 37.74%)  

---

## Milestone Architecture Overview

```
               [G1: Commercial Pilot Readiness]
                     (SERP-283 → SERP-301)
                               │
                               ▼
               [G2: ERP Replacement Readiness]
                     (SERP-302 → SERP-322)
                               │
                               ▼
               [G3: Maldives Competitive Moat]
                     (SERP-323 → SERP-327)
                               │
                               ▼
               [G4: Scale & Enterprise Maturity]
                     (SERP-328 → SERP-336)
```

---

## 1. Group 1 (G1): Commercial Pilot Readiness (Expedite Now)

**Objective**: Ensure the first external paying client (Club Ignition & initial design partner) can operate with 100% data safety, real double-entry accounting, self-service staff invitation, and zero demo contamination.

* **`SERP-283`** [P0 / DONE]: Platform realignment PR #10 CI resolution and branch merge.
* **`SERP-284`** [P0 / DONE]: Live database deployment and verification of Migrations 0024 & 0025.
* **`SERP-285`** [P0 / DONE]: Gateway full authorization graph resolution on Google sign-in.
* **`SERP-286`** [P0 / IN PROGRESS]: Tenant-admin self-service staff invitation and lifecycle workflow (`public.invitations`).
* **`SERP-287`** [P0]: Removal of hardcoded backend staff allowlist dependency.
* **`SERP-288`** [P0]: Clean production workspace hygiene and zero demo data contamination.
* **`SERP-289`** [P0]: Removal of browser/mock business authority & pure Edge RPC routing.
* **`SERP-290`** [P0]: Chart of Accounts management and account hierarchy UI.
* **`SERP-291`** [P0]: Live double-entry journal posting UI and General Ledger explorer.
* **`SERP-292`** [P0]: Standard Trial Balance and authoritative Balance Sheet reporting.
* **`SERP-293`** [P0]: Authoritative P&L statement with drilldowns and AR/AP aging matrices.
* **`SERP-294`** [P0]: Credit notes, customer advance deposits, and settlement allocation.
* **`SERP-295`** [P0]: Accounting period lock, month-end close, and year-end roll-forward.
* **`SERP-296`** [P0]: Bank & cash ledger with BML/MIB CSV statement reconciliation.
* **`SERP-297`** [P0]: MIRA GST-201 formal tax return schedule and export.
* **`SERP-298`** [P0]: Starq HQ platform control plane console for tenant management.
* **`SERP-299`** [P0]: Production domain, Google OAuth verified origins, and secrets verification.
* **`SERP-300`** [P0]: Live multi-tenant RLS isolation & book isolation automated test suite.
* **`SERP-301`** [P0]: Production observability, structured error logging, and alerts.

---

## 2. Group 2 (G2): ERP Replacement Readiness (Mandatory After G1)

**Objective**: Equip starqERP with the data ingestion, landed cost, 3-way matching, multi-warehouse, and financial tooling required to credibly replace Odoo or SAP Business One.

* **`SERP-302`** [P1]: Universal CSV/XLSX data ingestion framework and validator.
* **`SERP-303`** [P1]: Customer and supplier master data bulk import tool.
* **`SERP-304`** [P1]: Product catalog & SKU master data bulk import tool.
* **`SERP-305`** [P1]: Opening stock quantity & valuation migration wizard.
* **`SERP-306`** [P1]: Opening trial balance & financial balances onboarding wizard.
* **`SERP-307`** [P1]: Unpaid customer invoices (AR) & supplier bills (AP) migration wizard.
* **`SERP-308`** [P1]: Odoo & SAP cutover migration runbook and reconciliation validator.
* **`SERP-309`** [P1]: Perpetual inventory valuation engine and automated COGS posting.
* **`SERP-310`** [P1]: Landed cost allocation for container imports (freight, customs, port handling).
* **`SERP-311`** [P1]: 3-Way matching for procurement (Purchase Order vs GRN vs Supplier Bill).
* **`SERP-312`** [P1]: Multi-warehouse stock transfer orders and transit tracking.
* **`SERP-313`** [P1]: Batch and serial number tracking lifecycle.
* **`SERP-314`** [P1]: Tiered customer price lists (Retail, Wholesale, Resort, VIP).
* **`SERP-315`** [P1]: Customer credit limit enforcement and automated dunning reminders.
* **`SERP-316`** [P1]: Inter-book journal transfers and consolidated balance sheet elimination.
* **`SERP-317`** [P1]: Direct and indirect Cash Flow Statement reporting.
* **`SERP-318`** [P1]: Multi-currency purchasing, dynamic MMA exchange rates, and FX gain/loss.
* **`SERP-319`** [P1]: MIRA Tourism Goods and Services Tax (16% TGSTA) and Green Tax support.
* **`SERP-320`** [P1]: Staged and progress billing against contract milestones.
* **`SERP-321`** [P1]: Technician timesheets and job labor costing.
* **`SERP-322`** [P1]: Subcontractor retention money & MIRA Non-Resident Withholding Tax (WHT).

---

## 3. Group 3 (G3): Maldives Competitive Advantage (Moat)

**Objective**: Native localization features that international ERPs cannot match without expensive custom development.

* **`SERP-323`** [P2]: Bilingual Dhivehi (Thaana) / English document templates and print engine.
* **`SERP-324`** [P2]: Verified MMA Favara / BML instant QR payment generation on invoices.
* **`SERP-325`** [P2]: Multi-island sea-cargo, dhoni dispatch, and harbor gate pass tracking.
* **`SERP-326`** [P2]: Maldives-specific operational defaults & Island Council directory.
* **`SERP-327`** [P2]: Maldives Pension Administration Office (MPAO) statutory deduction module.

---

## 4. Group 4 (G4): Scale & Enterprise Maturity

**Objective**: Performance, offline reliability, enterprise SLA guarantees, and public API ecosystems.

* **`SERP-328`** [P3]: Playwright automated end-to-end (E2E) browser test suite.
* **`SERP-329`** [P3]: Route-based code splitting and performance budget optimization.
* **`SERP-330`** [P3]: Low-connectivity offline caching and PWA service worker sync.
* **`SERP-331`** [P3]: High-concurrency load testing and database connection pool tuning.
* **`SERP-332`** [P3]: Specialized WCAG 2.1 AAA accessibility and multi-device physical lab audit.
* **`SERP-333`** [P3]: Public REST API gateway and Webhooks subscription infrastructure.
* **`SERP-334`** [P3]: Multi-region automated disaster recovery and warm standby failover.
* **`SERP-335`** [P3]: Starq HQ platform tenant telemetry, active usage, and billing automation.
* **`SERP-336`** [P3]: Advanced operational diagnostics, tracing & health telemetry.
