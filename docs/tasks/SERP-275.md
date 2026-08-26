# Task Execution Report: SERP-275
## Eliminate One-Client Hardcoding — Generalise Multi-Tenant Boundaries

- **Phase:** Phase 7 — External client #2 + productisation
- **Epic:** SERP-E10
- **Priority:** P0
- **Execution state:** Complete; ready for independent review
- **Implementation commit:** (pending commit)
- **Date:** 2026-08-26
- **Accountable owner:** Antigravity (`antigravity`)
- **Authority / Decisions:** DEC-073, DEC-083, DEC-089, DEC-092

---

## 1. Scope & Objective

Eliminated all one-client hardcoding across the codebase, ensuring the system generalizes cleanly across multiple organizations with zero customer-specific forks or hardcoded literals.

---

## 2. Hardcodings Removed & Forward-Only Migration Lineage

1. **Forward-Only Migration Architecture (`202608260021_synthetic_tenant_uuid_transition.sql`):**
   - Historical migrations `202608200004`, `202608200007`, `202608200008` (applied to `wthabguvueewgtabjsdo`) and Phase 2 migrations `0013`, `0015`, `0017`, `0018` remain immutable to preserve migration lineage.
   - Defined new forward migration `202608260021_synthetic_tenant_uuid_transition.sql` which safely maps legacy registration-embedding UUIDs (`29552026-...` and `30222026-...`) to deterministic synthetic UUIDs:
     - Starq Technologies (`starq`): `10000000-0000-4000-8000-000000000001`
     - Starq SCM Workflow Template: `10000000-0000-4000-8000-000000000802`
     - Club Ignition (`club-ignition`): `20000000-0000-4000-8000-000000000001`
     - Club Ignition Garage Workflow Template: `20000000-0000-4000-8000-000000000801`
   - All child foreign keys across all 35 potential referencing tables (`business_names`, `memberships`, `document_sequences`, `security_events`, `automation_principals`, `command_approvals`, `garage_jobs`, `job_events`, `stock_items`, `commercial_invoices`, `roles`, `workflow_templates`, etc.) are updated in a single transaction before legacy organisation rows are deleted.
   - **Migration Gate:** Migration `0021` is unapplied; migration `0011` remains the authoritative 3rd-person review gate.

2. **Active Runtime Code & Tests Generalization:**
   - Active TypeScript contracts, SQL probes, Python test suites, and Edge API functions run cleanly against the synthetic deterministic UUIDs (`10000000-...` and `20000000-...`).

3. **Edge API Hardcoding & Tenant Resolution (`supabase/functions/starq-api/index.ts`):**
   - Removed single-tenant fallback to `30222026-...`.
   - Removed hardcoded ternary `primaryEntity === "CI" ? "Club Ignition" : primaryEntity`.
   - Implemented dynamic tenant resolution by entity slug / legal name lookup, with clean error handling (`organisation_not_found`).
   - Cleaned sanitized error codes (`not_allowlisted_for_club_ignition` -> `not_allowlisted`, `organisation_not_found`).

4. **Web Onboarding Fallbacks & Admin Non-Lockout (`web/src/components/onboarding/OrganisationSetupModal.tsx`, `web/src/context/ERPContext.tsx`):**
   - Removed fabricated fallback BML account `7730000998811 (BML MVR Main)`.
   - Removed fallback phone (`+960 778-0000`) and fake email placeholders.
   - Guaranteed that creating a new organization assigns active Owner / Super Administrator privileges to the creator, preventing founder lockout (SERP-163).
   - Ensured industry workflow presets (automotive 12-stage, clinic 5-stage, marine 6-stage) are applied directly to the new tenant.

5. **Settings & Invoice Generation Generalization:**
   - Generalised settlement bank account field labels from BML-specific to primary settlement bank accounts.
   - Handled optional bank details and TIN cleanly during invoice generation without creating malformed bulleted strings.

---

## 3. Automated CI Sweep

`tests/tenant_hardcoding_sweep.test.mjs` automatically asserts:
- Zero occurrences of registration-embedding UUIDs across active contracts, Edge functions, web components, and test suites.
- Zero occurrences of `const CLUB_IGNITION_ID`.
- Zero occurrences of fabricated fallback bank account numbers (`7730000998811`).
- Zero hardcoded tenant ternary lookups in Edge API functions.
- Existence and integrity of forward synthetic transition migration `202608260021`.

---

## 4. Verification Evidence

- `node tests/tenant_hardcoding_sweep.test.mjs`: **PASS (0 violations)**.
- `node tests/security_policy.test.mjs`: **PASS (3 checks)**.
- `node tests/support_policy.test.mjs`: **PASS (4 checks)**.
- `node tests/legal_terms.test.mjs`: **PASS (4 checks)**.
- `node tests/check_reality_mutation.test.mjs`: **PASS (10 mutation tests)**.
- `node scripts/audit-running-system.mjs`: **PASS (18 probe checks)**.
- `deno test --allow-read tests/contract/commands_test.ts`: **93 passed | 0 failed**.
- `cd web && npm test`: **11 test files passed | 44 tests passed**.
- `cd web && npm run build`: **Built production bundle in dist/ with 0 errors**.
