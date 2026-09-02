# SERP-393: Capability Screens Classification Report (Gate F4 / DEC-103)

**Task ID**: SERP-393  
**Title**: F4 — Classify the eight capability screens ROUTE SOON / HOLD / RETIRE from backend evidence  
**Author**: @antigravity  
**Reviewer Assigned**: @Elder  
**Date**: 2026-09-03  
**Status**: READY_FOR_REVIEW  
**Governing Decisions**: DEC-103 (Gate F4), DoD v0.2, DEC-067  
**Authority Rule**: *"No screen routed without a table, a command, and an endpoint. Classify from backend evidence, not from reachability optics."*

---

## 1. Executive Summary

During the 30 Aug 2026 audit, eleven web components had no import path from the application router (`KNOWN_DARK` in `tests/component_reachability.test.mjs`). One view was subsequently opened (`ReportsView`), leaving ten components: one superseded modal (`OrganisationSetupModal.tsx`) and **eight capability screens** that present rich user interfaces but lack live backend support.

Under **DEC-103**, converting reachability into a vanity target by wiring fixture-backed screens into live production routes is forbidden. This document provides the authoritative, evidence-grounded classification across all eight capability screens plus the superseded onboarding modal.

### Summary Classification Matrix

| Component | Path | Backend Table? | Command Handler? | API Endpoint? | DEC-103 Verdict | Disposition / Target Milestone |
|---|---|:---:|:---:|:---:|:---:|---|
| **PayrollManagementView** | `components/payroll/` | ❌ None | ❌ None | ❌ None | **HOLD** | Phase P7 / SERP-108 (Payroll consequence) |
| **MultiWarehouseView** | `components/inventory/` | ❌ None | ❌ None | ❌ None | **HOLD** | Phase P7 / SERP-109 (Warehouse transfers) |
| **ProductionOrderView** | `components/manufacturing/` | ❌ None | ❌ None | ❌ None | **HOLD** | Phase P7 / SERP-110 (Manufacturing BOM) |
| **JobCostingView** | `components/projects/` | ❌ None | ❌ None | ❌ None | **HOLD** | Phase P7 / SERP-092 (Job-costing dimensions) |
| **CreditDunningView** | `components/sales/` | ❌ None | ❌ None | ❌ None | **HOLD** | Phase P7 / SERP-062 (Collection follow-up) |
| **ConsolidatedReportingView** | `components/reports/` | ❌ None | ❌ None | ❌ None | **HOLD** | Phase P7 / SERP-096 (Multi-outlet consolidation) |
| **AiReconciliationView** | `components/banking/` | ❌ None | ❌ None | ❌ None | **HOLD** | Phase P7 / SERP-079 (Banking reconciliation) |
| **AgentRegistryView** | `components/admin/` | ⚠️ Platform only | ❌ None | ❌ None | **HOLD** | Platform Plane (`StarqHQShell` / SERP-099) |
| *OrganisationSetupModal* | `components/onboarding/` | ⚠️ Exists | ⚠️ Exists | ⚠️ Exists | **RETIRE** | Superseded duplicate of `RegisterOrganisationModal` |

---

## 2. Detailed Backend Evidence & Technical Findings

### 2.1 `PayrollManagementView.tsx`
- **File**: `web/src/components/payroll/PayrollManagementView.tsx` (349 lines)
- **UI Capability**: Employee roster, monthly salary calculations, Maldives Pension (8% employer / 7% employee), Ramadan bonus allowance, and pay run finalization.
- **Backend Evidence**:
  - **Database Tables**: No `employees`, `payroll_runs`, or `salary_structures` tables exist in `supabase/migrations/` (migrations 0001–0037).
  - **Commands/RPCs**: No command contract exists in Edge functions or PostgreSQL functions.
  - **State Implementation**: Hardcoded React state initialized via `useState<EmployeeProfile[]>([ ... ])`.
  - **Persistence Attempt**: When "Finalize Pay Run" is clicked, lines 112–115 attempt to post synthetic numbers to an inert bookkeeping method:
    ```typescript
    if (typeof (addJournalEntry as any) === 'function') {
      (addJournalEntry as any)(currentRun.journalEntry);
    }
    ```
- **Verdict**: **`HOLD`**. Wiring this screen into live navigation would display mock staff data and create false operational reliance without persistent personnel records.
- **Future Unblock**: Tracked under Phase P7, task **SERP-108** (*Time and payroll financial-consequence workflow*).

---

### 2.2 `MultiWarehouseView.tsx`
- **File**: `web/src/components/inventory/MultiWarehouseView.tsx` (339 lines)
- **UI Capability**: Multi-facility stock visibility across Malé Central, Hulhumalé Depot, and Thilafushi Yard; inter-warehouse stock transfer requisitions.
- **Backend Evidence**:
  - **Database Tables**: Current schema models a single `locations` table per tenant; no `warehouses`, `bins`, or `stock_transfers` tables exist.
  - **Commands/RPCs**: No stock transfer or transit mutation endpoints exist.
  - **State Implementation**: Initialized from hardcoded array `MALDIVES_DEFAULT_WAREHOUSES`.
  - **Persistence Attempt**: Transfer dispatch and receipt simulate bookkeeping effects by posting raw journals via `(addJournalEntry as any)(dispatched.dispatchJournal)` (lines 142 & 163).
- **Verdict**: **`HOLD`**. Genuinely needed for multi-site operations, but routing prior to schema landing violates DEC-103.
- **Future Unblock**: Tracked under Phase P7, task **SERP-109** (*Warehouse bins, transfers and replenishment*).

---

### 2.3 `ProductionOrderView.tsx`
- **File**: `web/src/components/manufacturing/ProductionOrderView.tsx` (244 lines)
- **UI Capability**: Bill of Materials (BOM) disassembly, raw material staging, work-in-progress (WIP) tracking, and finished goods capitalization.
- **Backend Evidence**:
  - **Database Tables**: No `production_orders`, `bill_of_materials`, or `manufacturing_stages` tables exist.
  - **Commands/RPCs**: No manufacturing dispatch command handlers.
  - **State Implementation**: Initialized with mock constant `SAMPLE_BOMS`.
  - **Persistence Attempt**: Dispatches synthetic journal entries for raw material issuance and capitalization to inventory accounts.
- **Verdict**: **`HOLD`**. Light manufacturing/assembly is on the extended roadmap, but zero database backing exists today.
- **Future Unblock**: Tracked under Phase P7, task **SERP-110** (*Manufacturing BOM, work-centre and quality control*).

---

### 2.4 `JobCostingView.tsx`
- **File**: `web/src/components/projects/JobCostingView.tsx` (256 lines)
- **UI Capability**: Job cost tracking, labor hour allocations, materials consumption, subcontractor expense tracking, and margin analysis.
- **Backend Evidence**:
  - **Database Tables**: Automotive jobs exist (`job_cards`), but generic multi-tenant project/job costing (`project_jobs`, `job_cost_sheets`) does not exist.
  - **Commands/RPCs**: No project-costing mutation commands.
  - **State Implementation**: Hardcoded `sampleJobParams` containing mock labor hours and parts consumption.
  - **Persistence Attempt**: Calls `(addJournalEntry as any)(completedSheet.completionJournal)` on completion.
- **Verdict**: **`HOLD`**. High-value commercial feature, but must be built on real project dimension schema.
- **Future Unblock**: Tracked under Phase P7, task **SERP-092** (*Project and job-costing dimensions*).

---

### 2.5 `CreditDunningView.tsx`
- **File**: `web/src/components/sales/CreditDunningView.tsx` (340 lines)
- **UI Capability**: Customer credit limit monitoring, overdue aging brackets (30/60/90 days), automated dunning letter generation, and credit hold simulation.
- **Backend Evidence**:
  - **Database Tables**: Customer party master exists, but no `customer_credit_profiles`, `dunning_runs`, or `collection_notices` tables exist.
  - **Commands/RPCs**: No dunning issue or credit limit override endpoints.
  - **State Implementation**: State populated from static mock array of 4 customer profiles (`cust-01` to `cust-04`).
- **Verdict**: **`HOLD`**.
- **Future Unblock**: Tracked under Phase P7, task **SERP-062** (*Customer history, follow-up and collection preparation*).

---

### 2.6 `ConsolidatedReportingView.tsx`
- **File**: `web/src/components/reports/ConsolidatedReportingView.tsx` (268 lines)
- **UI Capability**: Consolidated multi-branch P&L statements, branch comparison metrics, and inter-branch eliminations.
- **Backend Evidence**:
  - **Database Tables**: Current accounting kernel supports multi-book (`books`, `book_memberships`), but no branch dimension or inter-company consolidation ledger exists.
  - **Commands/RPCs**: No consolidation aggregation engine.
  - **State Implementation**: Uses static constant `STARQ_BUSINESS_BRANCHES` and local dummy numbers.
- **Verdict**: **`HOLD`**. Inter-book accounts schema landed in migration 0037, but reporting consolidation views require real ledger query aggregation.
- **Future Unblock**: Tracked under Phase P7, task **SERP-096** (*Multi-outlet and consolidation reporting*).

---

### 2.7 `AiReconciliationView.tsx`
- **File**: `web/src/components/banking/AiReconciliationView.tsx` (239 lines)
- **UI Capability**: Optical Character Recognition (OCR) receipt parsing, confidence scoring, automated transaction matching to bank feeds.
- **Backend Evidence**:
  - **Database Tables**: `bank_accounts` entities exist (SERP-165), but no uploaded statement feeds or OCR attachment stores exist.
  - **Commands/RPCs**: No OCR backend service, AI receipt parser endpoint, or automated matching engine.
  - **State Implementation**: Hardcoded raw receipt text literal (`"MALDIVES STATE ELECTRIC COMPANY..."`) and mock suggestions array.
- **Verdict**: **`HOLD`**. Highly misleading if routed, as OCR parsing appears functional but operates solely on a hardcoded string.
- **Future Unblock**: Tracked under Phase P7, task **SERP-079** (*Banking and reconciliation workflow*).

---

### 2.8 `AgentRegistryView.tsx`
- **File**: `web/src/components/admin/AgentRegistryView.tsx` (318 lines)
- **UI Capability**: Automation principal registration, autonomous agent kill-switches, capability grant inspection, and AI action proposal auditing.
- **Backend Evidence**:
  - **Database Tables**: `public.automation_principals` and `public.automation_capability_grants` **DO exist** in the database (`202608200004_pilot_security.sql`).
  - **Commands/RPCs**: Platform plane functions exist for automation grants.
  - **Component Disconnection**: Despite tables existing, `AgentRegistryView.tsx` does **NOT** query Supabase. It imports and renders `DEFAULT_AI_AGENTS` from `web/src/domain/agentRegistry.ts`.
  - **Architectural Placement**: In `AppShell.tsx`, platform-entitlement users are routed to `StarqHQShell` rather than standard tenant navigation. `AgentRegistryView` belongs to the platform administration console (StarqHQ), not tenant ERP.
- **Verdict**: **`HOLD` (Platform Plane)**. Keep dark in the tenant ERP router; rewire to platform control plane during platform console milestones.
- **Future Unblock**: Tracked under Phase P7, task **SERP-099** (*Automation-principal and agent registry*).

---

### 2.9 Duplicate Special Case: `OrganisationSetupModal.tsx`
- **File**: `web/src/components/onboarding/OrganisationSetupModal.tsx` (375 lines)
- **Analysis**:
  - `RegisterOrganisationModal.tsx` is already actively routed and rendered by `AppShell.tsx` for organization creation.
  - `OrganisationSetupModal.tsx` is a superseded rival implementation created during earlier onboarding passes.
  - Under `STARQERP_EXECUTION_BIBLE_FINAL_STRETCH.md` §7 and `SERP-380`, moving or deleting this file requires updating `serp_275` and `serp_276` test imports in the same commit.
- **Verdict**: **`RETIRE`**. Safely archive to `legacy/retired-ui/OrganisationSetupModal.tsx` in a dedicated cleanup pass while adjusting test imports.

---

## 3. Recommended Actions & Immediate Next Steps

1. **Governance & Ratchet Policy**:
   - Retain all 8 capability screens in `KNOWN_DARK` within [`tests/component_reachability.test.mjs`](file:///d:/StarqTech/starqERP/tests/component_reachability.test.mjs) under explicit `HOLD` status.
   - Do **NOT** route any of the 8 screens to satisfy reachability metrics.
   - Preserves 100% compliance with DEC-103.

2. **Unblocking Downstream Dependency SERP-392**:
   - Founder routing noted that `SERP-392` (Enforceable release ratchet 1) was gated on PR #27 landing and `SERP-393` classification.
   - With PR #27 merged and this written classification completed and evidenced, `SERP-392`'s reachability requirements are unblocked: `--strict` mode in `component_reachability.test.mjs` can treat `KNOWN_DARK` entries as explicitly frozen debt holding at baseline 8 capability screens + 1 superseded modal.

3. **Handoff for Independent Review**:
   - Independent Reviewer: `@Elder` (designated per continuous-flow protocol).
   - Review Command: `node tests/component_reachability.test.mjs`
