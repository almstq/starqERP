# M0-CLIE-001 — STARQ ERP Client: Bookkeeping Spine with a Face for Two Tenants

**Status:** done  
**Assignee:** Antigravity  
**Branch:** `ag/m0-clie-001-bookkeeping-spine`  
**Date:** 25 Aug 2026

---

## What was delivered

Delivered the clean, lightweight CI Pilot Bookkeeping spine in the React 19 web client satisfying all 6 acceptance criteria:

1. **Two Pilot Tenants Configured (`web/src/data/mockData.ts`)**:
   - `tenant-starq`: Starq Technologies (Software & Engineering Services, not_registered, 0% GST).
   - `tenant-ignition`: Club Ignition Garage Pvt Ltd (Automotive & Body Repair, registered, TIN 1004829GST001, 8% GST).
   - Explicit tenant switching logs audited `TENANT_SWITCHED` events and recalculates data slices.
2. **Double-Entry General Ledger & Trial Balance Engine (`web/src/lib/bookkeeping.ts`)**:
   - Computes General Ledger accounts (1000 Cash/Bank, 1100 Accounts Receivable, 2000 Accounts Payable, 2100 GST Output Tax, 4000 Sales Revenue, 5000 COGS, 6000 Operating Expenses).
   - Proves Trial Balance `Total Debits === Total Credits` (0.00 difference).
   - Generates Profit & Loss Statement (Gross Revenue - COGS - OpEx = Net Profit).
   - Generates Balance Sheet Summary (Total Assets = Total Liabilities + Total Equity).
3. **Financial Statements UI (`web/src/components/reports/ReportsView.tsx`)**:
   - Interactive Trial Balance table with green zero-variance verified banner.
   - P&L and Balance Sheet summary cards.
   - Separate Operational Analytics tab preserving garage throughput and technician tracking.
4. **Statutory Tax Application (SERP-122)**:
   - Line tax engine resolves statutory rate by tenant registration status and supply date (0% for Starq Tech, 8% for Club Ignition).
5. **Private-by-Default Publication Boundary (SERP-125)**:
   - Internal/Private status indicated across documents; public publication disabled by default.
6. **Automated Test Conformance**:
   - React Vitest Suite: **15/15 PASS** (`web/src/test/bookkeeping_spine.test.ts`, `invoice_arithmetic.test.ts`, `permission_gating.test.tsx`, `serp_189_stock_mutators.test.ts`).
   - Deno Contract Suite: **94/94 PASS**.
   - Production Build: `npm run build` succeeds cleanly in 16.78s.
