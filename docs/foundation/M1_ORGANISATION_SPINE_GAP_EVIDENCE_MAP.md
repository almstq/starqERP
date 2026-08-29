# M1 Organisation Spine Gap-to-Patch Evidence Map

**Prepared by:** DP (WSL Hermes; bus ID `hermes`)  
**Date:** 2026-08-20  
**Scope:** SERP-040 through SERP-048 (M1 organisation spine)  
**Boundary:** Read-only evidence + proposed patch plan. No cloud deploy, secrets, production data, garage UI, board mutation, or financial workflows.

---

## 1. Current Code Evidence

### A. PostgreSQL Migrations

| Migration | M1-Relevant Structures |
|---|---|
| **0001_core_foundation** | `organisations` (id, slug, legal_name, registry_code, base_currency, business_timezone, status), `business_names` (org_id, registry_code, name, activity_code, status), `persons`, `memberships`, `seats`, `membership_seats`, `idempotency_keys`, `audit_events`, RLS policies, `app_private.has_organisation_access`, `reject_mutation` |
| **0004_pilot_security** | Seed: Starq Technologies (`29552026...`), Club Ignition (`30222026...`); business_names: Starq Dynamics (8211), Hoadhaa Network, Ignition Ink (4520); seats: owner, managing_director, director, counter, technician, qc_signer, financial_controller, payer; `document_sequences`, `allocate_document_no`; `security_events`, `automation_principals`, `automation_capability_grants`, `command_approvals` |
| **0005_garage_api** | `api_session_authority` RPC validates org-scoped membership + seat; `api_garage_command` enforces seat per event type (counter, technician, qc_signer, financial_controller, payer) |
| **0008_session_authority** | `api_session_authority` self-test: active seat, cross-tenant denial, revoked seat, suspended membership, rollback |

### B. Edge Function — `supabase/functions/starq-api/index.ts`

| Area | Status |
|---|---|
| **Organisation seed** | Hardcoded `CLUB_IGNITION_ID = "30222026-0000-4000-8000-000000000001"` (line 14); Starq Technologies not in Edge runtime |
| **Membership/seat resolution** | `establishPerson` → upserts `persons`, `memberships`, `membership_seats` for CI only (lines 234-282) |
| **Allowlist** | `STARQBOOKS_ALLOWLIST_JSON` env var; filters by `entities` includes "CI" (lines 207-238) |
| **Seat switching** | `/api/auth/seat` validates granted seat, reissues cookie with new `acting_as` (lines 355-363) |
| **Multi-tenant switch** | Not implemented in Edge; `api_session_authority` validates single org per session |
| **Legal/tax/currency config** | Not in Edge; `organisations` table has `base_currency`, `business_timezone`, `registry_code` (migration 0001) |

### C. Python Portal — `serve.py` / `ops.py`

| Area | Status |
|---|---|
| **Entity occupancy** | `B.ENTITIES = ["STARQ", "CI"]`; `A.is_ci_only`, `A.coerce_next`, `A.may_view_books` enforce occupancy scoping |
| **Google auth** | Single flow; occupancy (STARQ/CI) chosen at login via query param |
| **Seat/role** | Not exposed in Python portal; seat logic lives in Edge |
| **Tenant switch** | Not implemented; user bound to one entity per session |
| **Business names/registry** | Not in Python; only `organisations.json` local file (legacy) |

---

## 2. SERP-040–048 Acceptance vs. Evidence

| Task | Acceptance | Current Evidence |
|---|---|---|
| **SERP-040** Legal-tenant registry | Positive: equal controlled tenants, configurable legal/tax/currency/fiscal. Negative: fail-closed. | Migration 0001: `organisations` table has all fields. Migration 0004 seeds Starq Tech + Club Ignition as equal orgs. **No runtime config UI, no Edge exposure of Starq Tech org, no config validation tests.** |
| **SERP-041** Activity/brand/outlet/location hierarchy | Positive: correct subordinate hierarchy, no accidental ledger tenants. Negative: fail-closed. | Migration 0004: `business_names` seeds Starq Dynamics, Hoadhaa Network, Ignition Ink under correct orgs. `locations` table exists (0002). **No hierarchy validation tests, no API to manage hierarchy, Edge only knows CI.** |
| **SERP-042** Membership/seat/lifecycle | Positive: audited activation, expiry, revocation. Negative: fail-closed. | Migration 0001: `memberships` (valid_from, valid_to, status), `membership_seats` (revoked_at). Migration 0004 seeds seats. Edge: `api_session_authority` checks active membership, seat, revocation, suspension (0008 self-test). **No admin UI for membership lifecycle, no automated tests beyond 0008 self-test.** |
| **SERP-043** Role/module-entitlement config | Positive: server-enforced module enablement per tenant/outlet. Negative: fail-closed. | Migration 0004: seats table with active flag. **No module-entitlement table, no tenant/outlet capability switches, no admin UI, no tests.** |
| **SERP-044** Explicit audited tenant switching | Positive: only eligible multi-tenant members switch with audit. Negative: fail-closed. | Edge: session locked to single org (`api_session_authority` enforces org match). Python: occupancy chosen at login, no switch. **No tenant switch API, no audit event for switch, no multi-tenant user support.** |
| **SERP-045** Common masters contract | Positive: tenant-scoped masters, immutable transaction snapshots. Negative: fail-closed. | Migration 0002: `contacts`, `products`, `product_prices`, `locations` all have `organisation_id`. **No versioned transaction snapshots, no master change audit, no config UI.** |
| **SERP-046** Tenant import pack validation | Positive: quarantine, schema validation, hashes, counts, rollback. Negative: fail-closed. | Migration 0004: `document_sequences` with allocation. **No import pack schema, no quarantine table, no validation pipeline, no rollback evidence.** |
| **SERP-047** External legal-profile onboarding | Positive: configurable company/partnership/sole-proprietor intake after controls. Negative: fail-closed. | Migration 0001: `organisations` supports configurable legal/tax/currency. **No onboarding API, no validation pipeline, no isolation/restore/support gates, no founder approval flow.** |
| **SERP-048** R1 dual-tenant acceptance gate | Positive: independently reviewed tenant, hierarchy, membership, entitlement, import evidence. Negative: fail-closed. | **Aggregates 040–046.** None of the prerequisite evidence is complete. |

---

## 3. Critical Gaps Summary

| Area | Missing Implementation | Missing Evidence |
|---|---|---|
| **Starq Technologies in Edge** | Org not seeded/known to Edge runtime; only CI hardcoded | No test showing Starq Tech org resolves in `api_session_authority` |
| **Module entitlements** | No capability table, no tenant/outlet feature flags | No tests for feature enablement/gating |
| **Tenant switch API** | No `/api/auth/switch` endpoint; no audit event for switch | No switch test, no audit log for switch |
| **Import pack pipeline** | No quarantine, schema validation, hash/count reconciliation, rollback | No test fixtures, no validation evidence |
| **External onboarding** | No API, no approval flow, no isolation/restore gates | No evidence |
| **Membership admin** | No admin UI/API for invite/suspend/revoke/expire | No lifecycle tests beyond 0008 self-test |
| **Automated test suite** | No contract tests for org/membership/seat/hierarchy/switch | No test files, no CI integration |

---

## 4. Smallest Independent Slice — M1 Org Contract Test Suite

**Proposed location:** `supabase/functions/starq-api/_contract_tests/org/`

| Test File | Target | Proves |
|---|---|---|
| `org_seed.test.ts` | `organisations` + `business_names` seed | Both orgs load; slugs unique; legal/tax/currency fields present |
| `hierarchy.test.ts` | `business_names` + `locations` | Subordinate units resolve under correct org; no cross-org hierarchy |
| `membership_lifecycle.test.ts` | `memberships`, `membership_seats`, `api_session_authority` | Activation, expiry, revocation, suspension all block access; audit events |
| `seat_entitlement.test.ts` | `seats`, `membership_seats`, `api_garage_command` | Only granted seats pass `assert_active_seat`; ungranted seats fail |
| `tenant_switch.test.ts` | (proposed `/api/auth/switch`) | Multi-tenant user can switch; audit event recorded; single-tenant user cannot switch |
| `import_pack_validation.test.ts` | (proposed import API) | Quarantine → validate → hash/count → rollback on failure |
| `external_onboarding.test.ts` | (proposed onboarding API) | Configurable legal profiles; isolation/restore gates block until approved |

**Dependencies:** SERP-039 (M0 gate), SERP-024 (board) — done. SERP-025 (candidate manifest) — planned.  
**Stop conditions:** Production DB, secret access, migration/schema changes → block.

---

## 5. Report to Codex / Elder

**Deliverable:** This evidence map.

**Next action on "go ahead":** Create M1 org contract test directory structure + fixtures locally. No cloud action.

---

**Integrity:** Read-only local file reads. No secrets, production data, cloud mutations, or board changes.