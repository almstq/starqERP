# Task Execution Report: SERP-276
## Standardise the Onboarding Wizard and Configuration

- **Phase:** Phase 7 — External client #2 + productisation
- **Priority:** P1
- **Execution state:** Complete
- **Date:** 2026-08-26
- **Accountable owners:** Antigravity & Claude
- **Decisions:** DEC-073 §10, DEC-083

---

## 1. Scope & Objectives

Delivered a standardized, zero-SQL self-service onboarding wizard for external tenants, strictly separating client-settable parameters from product-fixed governance invariants.

Key deliverables:
1. **End-to-End Self-Service Multi-Tenant Onboarding:**
   - 3-step setup modal (`OrganisationSetupModal.tsx`) allowing complete configuration of organization identity, legal entity name, industry workflow archetype, base operating currency (`MVR` or `USD`), MIRA GST tax status, custom document prefixes (`JOB-`, `INV-`), location, and bank accounts.
   - Automatically provisions industry workflows (Automotive spray/paint stages, Marine slipway hauling/outboard stages, Clinic patient triage/consultation stages) and document numbering sequences.
2. **Defect Remediation — Zero Invented Values for Blank Fields:**
   - Addressed previous defect where skipping TIN registration synthesized a fabricated MIRA TIN.
   - Blank TIN is now explicitly recorded as `tinNumber = ''` and `gstStatus = 'not_registered'`.
   - Blank banking details are recorded as empty without generating synthetic account numbers.
   - Missing required fields (such as Organization Display Name) strictly refuse progression and display actionable validation error feedback.
3. **Explicit Boundary: Client-Settable vs Product-Fixed Invariants:**
   - **Client-Settable:** Display/legal name, currency, GST registration, document prefixes, contact info, banking settlement details.
   - **Product-Fixed Invariants:** Locked and non-editable across all paths:
     1. Single source of financial truth (DEC-068/A2 statutory engine reconciliation).
     2. Segregation of Duties (Separation of Award and Pay steps; DEC-073 §10).
     3. Row-Level Security tenant boundary isolation.
     4. Append-only immutable audit ledger.
     5. No second posting authority.
4. **Contract & Negative Conformance Tests:**
   - `validateTenantOnboardingPayload` and `PRODUCT_FIXED_INVARIANTS` in `contracts/commands.ts` and Edge runtime.

---

## 2. Automated Test Verification

* **Web Vitest Suite (`web/src/test/serp_276_onboarding_wizard.test.tsx`):**
  - `✓ refuses to proceed past Step 1 when organization display name is empty`
  - `✓ completes end-to-end self-service onboarding for an unregistered SME with zero invented TIN or account numbers`
  - `✓ completes onboarding for registered tenant with valid MIRA TIN and bank account`
  - Total web suite: `13 test files passed | 52 tests passed`.
* **Deno Contract Suite (`tests/contract/commands_test.ts`):**
  - Added 4 contract tests covering validation of required fields, blank field fidelity, prefix customization, and invariant locking.
  - Total: `106 passed | 0 failed`.
* **Hardcoding Sweep:** `PASS (0 violations)`.
* **Migration 0021 Rehearsal Test:** `PASS`.
* **Vite Production Build:** Clean build with 0 errors.

---

## 3. Files Created & Modified

- `contracts/commands.ts` (Modified): Added `TenantOnboardingPayload`, `PRODUCT_FIXED_INVARIANTS`, and `validateTenantOnboardingPayload`.
- `supabase/functions/_shared/commands.ts` (Modified): Synced from contracts.
- `web/src/components/onboarding/OrganisationSetupModal.tsx` (Modified): Enhanced 3-step wizard with validation, custom prefixes, non-invented blank field handling, and governance summary.
- `web/src/test/serp_276_onboarding_wizard.test.tsx` (New): 3 comprehensive Vitest tests.
- `tests/contract/commands_test.ts` (Modified): 4 Deno contract tests.
- `docs/tasks/SERP-276.md` (New): Task report.
