# M0 Server-Core Gap-to-Patch Evidence Map

**Prepared by:** DP (WSL Hermes; bus ID `hermes`)  
**Date:** 2026-08-20  
**Scope:** SERP-026 (Server identity/session), SERP-029 (Tenant-scoped PostgreSQL), SERP-031 (Versioned API/Idempotency)  
**Boundary:** Read-only evidence + proposed patch plan. No cloud deploy, secrets, production data, garage UI, board mutation, or financial workflows.

---

## 1. Current Code Evidence

### A. Edge Function — `D:\StarqTech\the foundation engine\supabase\functions\starq-api\index.ts`

| Area | Status | Evidence |
|---|---|---|
| **Session cookie** | Implemented | `sb_ops` cookie, HMAC-signed, HttpOnly, Secure, SameSite=Strict (lines 15-16, 92-106, 148-150) |
| **Session TTL** | Implemented | 8 hours (`SESSION_SECONDS = 8*60*60`, line 17) |
| **CSRF** | Implemented | Per-session `csrf` in session object; validated on POST `/api/auth/seat`, `/api/ops/event`, `/api/auth/logout` (lines 296-300, 355-363, 348-353) |
| **Idempotency key** | Implemented | Required on `/api/ops/event` via `X-Idempotency-Key` header; UUID v4 validated (lines 397-398) |
| **Server authority** | Implemented | `api_session_authority` RPC validates membership, seat, revocation, suspension (lines 108-121, 335-342) |
| **Tenant isolation** | Implemented | `api_session_authority` enforces org-scoped membership; Edge CORS restricts origins (lines 109-121, 123-137, 310) |
| **Rate limiting** | Implemented | Anonymous 20 req/min per source IP (lines 163-172, 312-315) |
| **Security events** | Implemented | Append-only `security_events` table with source hash, no credential disclosure (lines 174-195) |
| **Google auth** | Implemented | Tokeninfo verification, allowlist-gated, CI entity restriction (lines 213-282) |
| **Seat switching** | Implemented | `/api/auth/seat` with CSRF validation, reissues signed cookie (lines 355-363) |
| **Health/meta** | Implemented | `/api/meta` returns service=`legacy/engine` (line 323) — **legacy branding** |
| **Command dispatch** | Implemented | `/api/ops/event` → `api_garage_command` RPC with idempotency, audit (lines 394-413) |
| **Automation principals** | Schema exists, disabled | `automation_principals`, `automation_capability_grants`, `command_approvals` tables (migration 0004) |

**Missing / Gaps:**
- No automated contract test suite for session/CSRF/idempotency/replay
- `/api/meta` still returns `service: "the foundation engine"` — SERP-032 branding task
- No evidence of versioned API contract, error taxonomy, or replay semantics tests
- No independent non-owner RLS test execution evidence

### B. PostgreSQL Migrations

| Migration | Scope | Key Structures |
|---|---|---|
| **0001_core_foundation** | Organisations, persons, memberships, seats, idempotency, attachments, audit, RLS, `app_private` helpers | `organisations`, `business_names`, `persons`, `memberships`, `seats`, `membership_seats`, `idempotency_keys`, `attachments`, `audit_events`, RLS policies, `has_organisation_access`, `reject_mutation` trigger |
| **0002_garage_inventory** | Contacts, vehicles, catalogue, locations, stock, jobs, job_events | `contacts`, `vehicles`, `products`, `product_prices`, `locations`, `inventory_items`, `stock_movements`, `garage_jobs`, `job_events` |
| **0003_commercial_accounting** | Commercial docs, periods, journal proposals, posted journals | `documents`, `journal_proposals`, `journal_entries`, `journal_lines`, `periods` |
| **0004_pilot_security** | Seed orgs/business_names/seats; document sequences; security events; automation principals/capabilities/approvals | `document_sequences`, `security_events`, `automation_principals`, `automation_capability_grants`, `command_approvals`, `allocate_document_no` |
| **0005_garage_api** | `api_garage_command`, `api_garage_pulse`, `api_garage_purchases`, seat/state-machine/SoD enforcement, idempotency, audit | `api_garage_command` with 12 event types, state transitions, required seats, idempotency keys, audit events |
| **0006_garage_api_search_path** | Search path pin for `api_garage_command` | `SET search_path = public, app_private, pg_temp` |
| **0007_garage_api_self_test** | Rolled-back SQL self-test: authorization, command, idempotent replay, rollback verification | Tests active seat, cross-tenant denial, revoked seat, suspended membership, idempotency replay |
| **0008_session_authority** | `api_session_authority` RPC with self-test | Active seat, cross-tenant denial, revoked seat, suspended membership, rollback |

**Status:** Migrations 0001–0008 applied to Supabase project `wthabguvueewgtabjsdo` (per README). Lint passed. RLS behavior, reset, rollback, restore **unverified** (README lines 32-37).

### C. Python Portal (`D:\StarqTech\the foundation engine\serve.py`)

| Area | Status |
|---|---|
| CSRF on form POSTs | Implemented: `A.csrf_ok` validated on `/ops/event`, `/receipt`, `/expenses/bill`, `/sales/invoice`, `/ops/event` (form) |
| Session auth | Google OAuth callback, user binding, entity occupancy (STARQ/CI) |
| Ops event recording | Form-based `/ops/event` → `O.record_event` with CSRF |
| API routes | `/api/meta`, `/api/me`, `/api/ops/pulse`, `/api/ops/job`, `/api/ops/purchases`, `/api/ops/event` (JSON) |
| Tenant scoping | Entity guard `A.may_view_books`, `A.coerce_next`, occupancy parameter required |

**Gaps:**
- Form-based CSRF is separate from Edge API CSRF; no shared contract test
- No idempotency key on form POSTs
- Legacy `service: "the foundation engine"` in `/api/meta`

---

## 2. SERP-026 / 029 / 031 Acceptance vs. Evidence

| Task | Acceptance | Current Evidence |
|---|---|---|
| **SERP-026** Server identity/session | Positive: server-derived identity, expiry, logout, revocation. Negative: fail-closed tenant/auth/replay. | Edge: HMAC session, 8h TTL, logout clears cookie, seat switch reissues, `api_session_authority` validates active membership/seat/revocation/suspension. Self-test in 0008 covers active/cross-tenant/revoked/suspended. **No automated contract test suite.** |
| **SERP-029** Tenant-scoped PostgreSQL | Positive: org constraints, non-owner cross-tenant denial. Negative: fail-closed. | Core schema: `has_organisation_access` + RLS on all tables. `api_session_authority` enforces org-scoped active membership. Self-test in 0008 covers cross-tenant denial. **No independent non-owner credential test run.** |
| **SERP-031** Versioned API / idempotency | Positive: accepted/rejected/unknown, same-key replay semantics. Negative: fail-closed. | Edge: `X-Idempotency-Key` required on `/api/ops/event`, UUID validated; idempotency keys table with `state` (processing/accepted/rejected/unknown), request_hash, response_body. Replay returns original `response_body` (line 58). `api_garage_command` self-test 0007 covers idempotent replay. **No versioned API contract, error taxonomy, or external contract test evidence.** |

---

## 3. Smallest Independent Slice — M0 Server-Core Contract Test Suite

**Objective:** Produce automated, CI-runnable contract tests that verify the existing server identity/session, tenant isolation, and idempotent API foundations — without cloud deployment, secret access, or production data.

### Proposed Slice: `supabase/functions/starq-api/_contract_tests/`

| Test File | Target | What It Proves |
|---|---|---|
| `session_lifecycle.test.ts` | `/api/auth/google`, `/api/auth/seat`, `/api/auth/logout` | Login → CSRF → seat switch → logout; cookie flags, HMAC, TTL, revocation |
| `idempotency_replay.test.ts` | `/api/ops/event` with `CALL` | First submit accepted; identical replay returns same event ID; changed payload with same key → conflict |
| `tenant_isolation.test.ts` | `api_session_authority`, `api_garage_command` | Cross-tenant membership denied; non-member cannot call; seat revocation/suspension blocks |
| `csrf_boundary.test.ts` | `/api/auth/seat`, `/api/ops/event` | Missing/invalid CSRF → 400; valid CSRF → accepted |
| `unauthenticated_rejected.test.ts` | All authenticated routes | Missing/invalid/expired session → 401, no data leak |
| `rate_limit.test.ts` | Anonymous endpoints | >20 req/min → 429 with `retry-after` |
| `meta_branding.test.ts` | `/api/meta` | Returns `service: "STARQ ERP"` (SERP-032) |

**Implementation notes:**
- Use Supabase local development or test project (not production `wthabguvueewgtabjsdo`)
- Synthetic allowlist, Google mock, seeded test org/person/seats
- Tests run via Deno `deno test --allow-net --allow-env --allow-read`
- No migration changes, no schema changes, no cloud deploy
- Results emitted as JUnit/TAP for CI ingestion

### Dependencies
- SERP-024 (board) — **done**
- SERP-001 (R0 preflight) — in progress, provides candidate/environment
- SERP-025 (Release candidate manifest) — planned, needed for exact test candidate
- SERP-032 (Metadata branding) — planned, coupled to `/api/meta` test

### Stop Conditions
- Any test requires production secret, live Google OAuth, or production database → **STOP**, mark blocked
- Test suite cannot run without a synthetic allowlist + mock Google endpoint → **STOP**, document missing fixture
- Migration or schema change required → **STOP**, escalate to Codex

---

## 4. Proposed Patch Plan (No Cloud Action)

1. **Create `_contract_tests/` directory** under `supabase/functions/starq-api/`
2. **Add test fixtures** (`test_allowlist.json`, `test_seeds.sql`) with synthetic data only
3. **Implement 7 test files** above using Deno native test runner
4. **Add `deno.jsonc`** with test permissions and optional CI step
5. **Run locally** with `deno test` — verify all pass
6. **Report** test names, pass/fail, coverage gaps to Codex

**No changes to:**
- Production Edge function
- Supabase project `wthabguvueewgtabjsdo`
- Migrations 0001–0008
- Python portal (`serve.py`, `ops.py`)
- Board state (except test documentation if Codex requests)

---

## 5. Report to Codex / Elder

**Deliverable:** This evidence map + proposed contract test directory structure + stop conditions.

**Next action on "go ahead":** Create the test files and fixtures locally, run `deno test`, report results. No cloud action.

---

**Integrity:** No secrets, production data, cloud mutations, or board changes in this map. All observations from local file reads only.