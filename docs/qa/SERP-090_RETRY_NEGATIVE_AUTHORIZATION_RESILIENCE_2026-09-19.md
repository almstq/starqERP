# SERP-090 — Counter Retry & Negative-Authorization Resilience (QA evidence)

Date: 2026-09-19  
Author: Antigravity, final M6 Counter POS milestone delivery.  
Scope: Server-authoritative online transaction enforcement, idempotency key replay & conflict resilience, in-flight timeout/retry safety, fail-closed negative authorization paths, negative-stock prevention, and authoritative resilience status reporting.  
Files:
- `supabase/migrations/202609192500_serp090_counter_retry_resilience.sql`
- `supabase/functions/starq-api/index.ts`
- `web/src/services/apiGateway.ts`
- `web/src/domain/counter.ts`
- `web/src/domain/counter.test.ts`
- `web/src/components/counter/CounterView.tsx`
- `tests/contract/serp_090_retry_resilience_test.ts`
- `tests/serp090_retry_resilience_probe.sql`
- `tests/run_serp090_retry_resilience_probe.ps1`

---

## Trigger & Scope Boundary

SERP-090 delivers the resilience, retry safety, and fail-closed negative-authorization guardrails completing the Counter POS epic (SERP-085, 086, 087, 088, 089, 438, 090):

1. **Strictly Online Server-Authoritative Architecture:**
   - Transactions require an active, authenticated connection. Offline transactional selling and local speculative ledger creation are strictly prohibited.
   - Counter UI actively tracks connection state (`navigator.onLine`, `online`/`offline` listeners), displaying a prominent warning banner and disabling transactional actions (Complete Sale, Hold Cart, Return/Void) when disconnected.
2. **Idempotent Command Replay & Payload Conflict Rejection:**
   - Submitting a command with the same `idempotency_key` and matching payload returns the committed result (`idempotent_replay: true`) with ZERO duplicate mutations (no double stock deductions, double refund legs, or duplicate cash sessions).
   - Reusing an existing `idempotency_key` with a conflicting payload (mismatched sale ID, location, or reversal type) fails closed with `idempotency_key_conflict` (HTTP 409).
3. **In-Flight Network Timeout & Retry Safety:**
   - In-flight transient failures (network errors, HTTP 502/503/504 gateway timeouts) preserve the active `idempotency_key` across retry attempts.
   - The web client surfaces an explicit idempotent retry action without generating a new UUID, ensuring the server identifies it as a replay and never executes duplicate mutations.
4. **Fail-Closed Negative Authorization (Auth-First):**
   - Unauthorized seats (`technician`, `viewer`) fail closed with `seat_not_authorized` (HTTP 403).
   - Cross-tenant requests fail closed with `sale_not_found` / `location_not_found` (HTTP 404).
   - Unapproved segregated returns fail closed with `reversal_approval_required` (HTTP 403).
   - Attempting to close a session when none is open fails closed with `no_open_session` (HTTP 409).
5. **Strict Prevention of Compensating Negative Stock:**
   - Requests exceeding live on-hand quantity fail closed (`stock_insufficient` / HTTP 400).
   - Server strictly aborts and rolls back without mutating inventory; negative stock balances are never invented to catch up later.
6. **Authoritative Status & Currency SSOT:**
   - RPC `public.api_counter_resilience_status` provides authoritative confirmation of online enforcement, currency resolution from `organisations.base_currency` (per commit `0c46cde`), and active till session state.

---

## Architecture & Implementation

### 1. Database Migration (`supabase/migrations/202609192500_serp090_counter_retry_resilience.sql`)
- **`public.api_counter_sale_reversal`:**
  - Enforces active seat check first.
  - Parses target sale ID and reversal type before checking existing key.
  - If key exists in `public.counter_returns`:
    - Compares target sale and reversal type. On mismatch, raises `idempotency_key_conflict`.
    - If payload matches, returns stored return record with `idempotent_replay: true`.
- **`public.api_counter_session_open`:**
  - If `p_command_key` exists in `public.counter_cash_sessions`:
    - Compares `location_id`. On mismatch, raises `idempotency_key_conflict`.
    - On match, returns stored session with `idempotent_replay: true`.
- **`public.api_counter_session_close`:**
  - If `p_command_key` exists in closed sessions:
    - Compares `location_id`. On mismatch, raises `idempotency_key_conflict`.
    - On match, returns closed session with `idempotent_replay: true`.
  - Strictly requires an active open session at the location; otherwise raises `no_open_session`.
- **`public.api_counter_resilience_status`:**
  - Security definer RPC verifying seat authorization.
  - Returns `server_authoritative: true`, `offline_trading_prohibited: true`, `compensating_negative_stock_prohibited: true`, dynamic `currency` from `organisations.base_currency`, and live session state.
- **Privileges:** All functions revoked from `public`, `anon`, `authenticated`; granted exclusively to `service_role`.

### 2. Edge API (`supabase/functions/starq-api/index.ts`)
- `GET /api/ops/counter/resilience`: calls `api_counter_resilience_status` with active seat.
- Forwarding `x-idempotency-key` header and body `command_key` across session open, session close, return, and void endpoints.
- Error code HTTP status mappings:
  - `idempotency_key_conflict` $\rightarrow$ 409
  - `no_open_session` $\rightarrow$ 409
  - `stock_insufficient` / `stock_line_quantity_exceeds_onhand` $\rightarrow$ 400
  - `seat_not_authorized` $\rightarrow$ 403
  - `reversal_approval_required` $\rightarrow$ 403
  - `reversal_approver_unauthorized` $\rightarrow$ 403
  - `sale_not_found` / `location_not_found` $\rightarrow$ 404

### 3. Frontend Architecture (`web/src/`)
- **API Gateway (`web/src/services/apiGateway.ts`):**
  - `ApiCommandParams` accepts optional `idempotencyKey?: string`.
  - `dispatchCommand` and `apiPost` propagate `'x-idempotency-key'` header in requests.
- **Pure Domain Helpers (`web/src/domain/counter.ts`):**
  - `canTransact(isOnline)`: boolean gate requiring online connectivity.
  - `isRetryableError(error)`: identifies network disconnects, timeouts, and 502/503/504 errors.
  - `formatResilienceErrorMessage(errorCode)`: human-readable explanations for all negative auth and resilience codes.
  - `createRetryContext`, `incrementRetry`: manages retry attempts while preserving the original idempotency key.
- **POS UI (`web/src/components/counter/CounterView.tsx`):**
  - Monitors `navigator.onLine` with window `online`/`offline` event listeners.
  - Displays red banner when offline: *"Counter POS is Online-Only — Transactions cannot be processed while offline"*.
  - Disables Complete Sale, Hold Cart, and Reversal action buttons when offline.
  - Preserves `activeSaleKey` and `activeReversalKey` on network failure.
  - Renders *"Retry sale (idempotent)"* button for safe retries without double charging or duplicate mutations.

---

## Verification Evidence

### 1. Contract Tests (`tests/contract/serp_090_retry_resilience_test.ts`)
Executed via `deno test --allow-read tests/contract/serp_090_retry_resilience_test.ts`:
```
running 14 tests from ./tests/contract/serp_090_retry_resilience_test.ts
SERP-090 behavior: offline transactional selling is strictly rejected ... ok
SERP-090 behavior: identical sale replay returns stored result with zero duplicate mutations ... ok
SERP-090 behavior: reusing command key with conflicting payload fails closed ... ok
SERP-090 behavior: negative stock invention strictly rejected on oversell ... ok
SERP-090 behavior: unauthorized seat fails closed for sales and reversals ... ok
SERP-090 behavior: cross-tenant reversal fails closed with sale_not_found ... ok
SERP-090 behavior: unapproved segregated reversal fails closed ... ok
SERP-090 behavior: till session open/close replay and conflict detection ... ok
SERP-090 conformance: migration defines idempotency conflict guards on reversals and sessions ... ok
SERP-090 conformance: api_counter_resilience_status enforces server-authoritative online invariant ... ok
SERP-090 conformance: starq-api wires resilience route and error mappings ... ok
SERP-090 conformance: apiGateway propagates idempotencyKey header in web requests ... ok
SERP-090 conformance: CounterView enforces online banner, disables transactions offline, and preserves retry keys ... ok
SERP-090 conformance: counter domain pure resilience functions declared ... ok

ok | 14 passed | 0 failed (14ms)
```

Full contract suite verification:
```
deno test --no-check --allow-read tests/contract/
ok | 401 passed | 0 failed (2s)
```

### 2. Frontend Unit Tests (`web/src/domain/counter.test.ts`)
Executed via `npm test -- --run`:
```
Test Files  129 passed (129)
Tests       800 passed | 1 skipped (801)
  ✓ src/domain/counter.test.ts (48 tests)
```

### 3. Static Type Check
Executed via `npm run lint` (`tsc --noEmit`):
```
0 errors
```

### 4. Live Disposable PostgreSQL Verification (`tests/serp090_retry_resilience_probe.sql`)
Executed via `powershell -ExecutionPolicy Bypass -File ./tests/run_serp090_retry_resilience_probe.ps1` against disposable PostgreSQL 15 on Docker:
```
NOTICE: ALL SERP-090 RESILIENCE PROBE CHECKS PASSED SUCCESSFULLY.
DO
ROLLBACK
SERP-090 retry & negative-authorization resilience probe: PASS
```

#### Bug Fixes & Hardening Applied:
1. **Probe Setup `stock_movements` Schema Fix:**
   - Corrected insert column from `created_by` to `recorded_by`.
   - Supplied non-null `idempotency_key` on setup stock movements.
   - Added GST registration (`gst_general` @ 8%) to `v_org` setup.
2. **`counter_refund_tenders` NOT NULL Constraints:**
   - Populated `recorded_by` (`target_person`) and `recorded_seat` (`target_seat`) in `api_counter_sale_reversal` Step 13.
3. **Tax-Mode Agnostic Pro-Rata Refund Math:**
   - Replaced flawed `1 / (1 + tax_rate)` assumption with direct pro-rating from original stored line:
     - `v_line_net := round(v_orig_line.net_amount * (v_return_qty / v_orig_line.quantity), 2)`
     - `v_line_tax := round(v_orig_line.tax_amount * (v_return_qty / v_orig_line.quantity), 2)`
   - Added verified exclusive-tax return subtest to TEST 3 (4 units sold @ 100 MVR + 8% GST = 432 gross; returning 1 unit pro-rates to 100 net + 8 tax = 108 gross refund).
4. **Sequence & Audit Event Corrections:**
   - Added `perform app_private.ensure_return_sequences(target_org)` before allocating document number in `api_counter_sale_reversal`.
   - Removed UUID value passed into `audit_events.id` (which is a `bigint GENERATED ALWAYS AS IDENTITY`).
   - Corrected sequence allocation in `api_counter_session_open` to use `'cash_session'` (prefix `CS-`) with sequence seeding.
   - Fixed `api_counter_resilience_status` when called without `p_location_id` to use a scalar `v_session_id uuid := null` avoiding unassigned record access errors.

