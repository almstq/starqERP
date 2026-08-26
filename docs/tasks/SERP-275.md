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

## 2. Hardcodings Removed

1. **Company Registration Numbers in Tenant UUIDs:**
   - Replaced all registration-number-embedding UUIDs (`29552026-...` and `30222026-...`) with deterministic synthetic tenant UUIDs:
     - Starq Technologies (`starq`): `10000000-0000-4000-8000-000000000001`
     - Starq Dynamics: `10000000-0000-4000-8000-000000000002`
     - Hoadhaa Network: `10000000-0000-4000-8000-000000000003`
     - Starq SCM Workflow Template: `10000000-0000-4000-8000-000000000802`
     - Club Ignition (`club-ignition`): `20000000-0000-4000-8000-000000000001`
     - Ignition Ink: `20000000-0000-4000-8000-000000000002`
     - Club Ignition Garage Workflow Template: `20000000-0000-4000-8000-000000000801`
   - Updated migrations: `202608200004_pilot_security.sql`, `202608200007_garage_api_self_test.sql`, `202608200008_session_authority.sql`, `202608250013_workflow_stages.sql`, `202608250015_roles_as_data.sql`, `202608250017_tax_regimes_and_periods.sql`, `202608250018_bank_accounts_entities.sql`.

2. **Edge API Hardcoding & Tenant Resolution (`supabase/functions/starq-api/index.ts`):**
   - Removed single-tenant fallback to `30222026-...`.
   - Removed hardcoded ternary `primaryEntity === "CI" ? "Club Ignition" : primaryEntity`.
   - Implemented dynamic tenant resolution by entity slug / legal name lookup, with clean error handling (`organisation_not_found`).
   - Cleaned sanitized error codes (`not_allowlisted_for_club_ignition` -> `not_allowlisted`, `organisation_not_found`).

3. **Web Onboarding Fallbacks & Admin Non-Lockout (`web/src/components/onboarding/OrganisationSetupModal.tsx`, `web/src/context/ERPContext.tsx`):**
   - Removed fabricated fallback BML account `7730000998811 (BML MVR Main)`.
   - Removed fallback phone (`+960 778-0000`) and fake email placeholders.
   - Guaranteed that creating a new organization assigns active Owner / Super Administrator privileges to the creator, preventing founder lockout (SERP-163).
   - Ensured industry workflow presets (automotive 12-stage, clinic 5-stage, marine 6-stage) are applied directly to the new tenant.

4. **Settings & Invoice Generation Generalization:**
   - Generalised settlement bank account field labels from BML-specific to primary settlement bank accounts.
   - Handled optional bank details and TIN cleanly during invoice generation without creating malformed bulleted strings.

---

## 3. Automated CI Sweep

Added `tests/tenant_hardcoding_sweep.test.mjs` to automatically assert:
- Zero occurrences of registration-embedding UUIDs (`29552026`, `30222026`).
- Zero occurrences of `const CLUB_IGNITION_ID`.
- Zero occurrences of fabricated fallback bank account numbers (`7730000998811`).
- Zero hardcoded tenant ternary lookups in Edge API functions.

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
