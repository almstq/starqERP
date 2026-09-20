# SERP-089 — Cash-session close and variance (QA evidence)

Date: 2026-09-19  
Author: Antigravity, under SERP-087 / commit 0c46cde authority & Founder ruling (Room seq 6186).  
Scope: `public.counter_cash_sessions`, `api_counter_session_open`, `api_counter_session_current`, `api_counter_session_close`, `api_counter_session_get`, `api_counter_session_list`.  
Files:
- `supabase/migrations/202609192200_serp089_cash_session_close_variance.sql`
- `supabase/functions/starq-api/index.ts`
- `web/src/domain/counter.ts`
- `web/src/domain/counter.test.ts`
- `web/src/components/counter/CounterView.tsx`
- `tests/contract/serp_089_cash_session_close_variance_test.ts`
- `tests/serp089_cash_session_probe.sql`
- `tests/run_serp089_cash_session_probe.ps1`

## Trigger

SERP-089 provides the cash-session close and variance recording mechanism for POS counter operations.
Following SERP-087's server-authoritative tender reconciliation and duplicate-proof receipts, till operations require an attributable shift/session close that compares expected cash (opening float + net cash sales) against physical counted cash, capturing any variance, operator attribution, notes, and timestamp.

Founder ruling (Room seq 6186):
- Record: expected cash, counted cash, variance, reason/note, operator, close timestamp.
- Auditable via audit events and transactional outbox.
- **NO automatic Cash Over/Short journal entry** unless an already-proven accounting path safely supports it; do not broaden scope to build one. This is a self-contained register write against the already-proven backend, not a new accounting subsystem.
- Currency must derive from `organisations.base_currency` per commit 0c46cde, never a hardcoded literal.

## Architecture & Implementation

### 1. Database Register (`public.counter_cash_sessions`)
- Columns: `id`, `organisation_id`, `location_id`, `session_number`, `currency`, `status` (`'open' | 'closed'`), `opened_at`, `opened_by`, `opened_seat`, `closed_at`, `closed_by`, `closed_seat`, `opening_float`, `cash_sales_amount`, `card_sales_amount`, `transfer_sales_amount`, `total_sales_amount`, `expected_cash`, `counted_cash`, `variance_amount`, `notes`, `transaction_count`, `idempotency_key`.
- Constraints:
  - `unique (organisation_id, id)` and `unique (organisation_id, session_number)`
  - Foreign key `(organisation_id, location_id) references public.locations(organisation_id, id)`
  - RLS / privileges: revoked from public/anon/authenticated, granted to `service_role`.

### 2. Stored Procedures
- `api_counter_session_open(target_org, target_person, target_seat, p_location_id, p_opening_float, p_command_key)`:
  - Serialized with advisory lock per location.
  - Rejects if an active open session already exists (`counter_session_already_open`).
  - Records opening float and mints sequential session number (`CS-XXXXX`).
- `api_counter_session_current(target_org, target_person, target_seat, p_location_id)`:
  - Real-time read-only projection aggregating sales from `counter_receipts`, `counter_tenders`, and `stock_movements`.
  - Calculates `cash_sales_amount` (cash tenders net of change refunded), card sales, transfer sales, and live `expected_cash`.
- `api_counter_session_close(target_org, target_person, target_seat, p_location_id, p_counted_cash, p_notes, p_command_key, p_opening_float)`:
  - Replay guard: returns stored session record if `idempotency_key` matches.
  - Serialized with advisory transaction lock.
  - Computes server-authoritative sales totals and derived expected cash.
  - Calculates `variance_amount = round(counted_cash - expected_cash, 2)`.
  - Records closed session, emits attributable audit event `erp.counter_session_close`, and appends `COUNTER_SESSION_CLOSE` outbox event.
- `api_counter_session_get(target_org, target_person, target_seat, p_session_id)`:
  - Tenant-scoped read-only session retrieval.

### 3. Edge API & Web UI
- Edge endpoints added in `supabase/functions/starq-api/index.ts`:
  - `GET /api/ops/counter/session/current`
  - `POST /api/ops/counter/session/open`
  - `POST /api/ops/counter/session/close`
  - `GET /api/ops/counter/session`
- Web UI added in `web/src/components/counter/CounterView.tsx`:
  - "Till Close" button in top action bar.
  - Interactive session close modal displaying live opening float, cash sales, expected cash in drawer, counted cash entry, real-time variance calculation with status formatting, and notes input.
  - Post-close confirmation displaying final variance and attributable session summary.

## Automated Evidence

### 1. Contract Suite (Deno, no DB)
`tests/contract/serp_089_cash_session_close_variance_test.ts` — **16/16 PASS** (28ms).
- Exact balanced close (variance = 0.00).
- Cash shortage close (variance < 0).
- Cash overage close (variance > 0).
- Net cash calculation (cash tendered minus change refunded; card/transfer excluded from expected cash).
- Replay idempotency (same command key returns identical record without duplicate).
- Non-MVR functional currency preserved across all fields.
- Fail-closed negatives: unauthorized seat (`technician`), invalid location, negative counted cash, negative opening float, double-opening.
- Source conformance: DDL definitions, constraints, seat aperture, audit/outbox events, zero hardcoded `'MVR'` in session logic, edge route wiring.

### 2. Full Contract Suite
`deno test --no-check --allow-read tests/contract/` → **348 passed | 0 failed**.

### 3. Edge Function Type Checking
`deno check supabase/functions/starq-api/index.ts` → **0 errors**.

### 4. Web Test Suite & Lint
- `web npm test`: **780 passed | 1 skipped** (129 test files) across the entire web application.
- `web/src/domain/counter.test.ts`: **33 passed** (including SERP-089 variance calculation tests).
- `web npm run lint` (`tsc --noEmit`): **0 errors** (clean).

## Synthetic Disposable-DB Probe
Delivered for independent live verification:
- `tests/serp089_cash_session_probe.sql`: single explicit transaction exercising session open, cash sales with change, card sales, expected cash derivation, shortage close with variance, replay idempotency, audit event presence, verification of ZERO automatic journal entries per Founder ruling, and negative fail-closed paths.
- `tests/run_serp089_cash_session_probe.ps1`: automated PowerShell runner for disposable PostgreSQL 17.6.1.155 container.

## Live Verification & Hardening (Seq 6191 & 6192)
1. **Stock Movement Schema Alignment (Seq 6191):**
   - Bug identified on live disposable Postgres: `column sm.commercial_document_id does not exist`.
   - Replaced both occurrences with `sm.source_type = 'COUNTER_SALE' and sm.source_id = cr.sale_id` per `202608200002_garage_inventory.sql`.
2. **Phantom Session Auto-Open Removal & no_open_session Guard (Seq 6192):**
   - Bug identified on live disposable Postgres: calling `api_counter_session_close` when no active open session exists at location implicitly fabricated a 0-float session and closed it on the spot.
   - Removed implicit-open `insert into public.counter_cash_sessions` path entirely from `api_counter_session_close`.
   - Added strict guard: `if not found then raise exception 'no_open_session'; end if;`.
   - `api_counter_session_close` strictly performs an `update` on the active open session, never an `insert`.
   - Contract test suite updated with both mirror and SQL conformance assertions: **19/19 PASS**.

## Explicit Non-Goals
Per Founder ruling: NO automatic Cash Over/Short journal entry. No replenishment, petty cash expense, or multi-currency cart features. Bounded strictly to server-authoritative cash-session register, expected vs counted variance, operator attribution, and auditability.
