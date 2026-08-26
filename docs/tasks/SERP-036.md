# Task Execution Report: SERP-036
## Observability, Rate-Limit and Alerting Baseline

- **Phase:** Phase 2 — Close the security/domain gates
- **Priority:** P0
- **Execution state:** Complete
- **Date:** 2026-08-26
- **Accountable owners:** Codex / Antigravity
- **Requirements:** CORE-001, CORE-002, OBS-001, RATE-001

---

## 1. Scope & Architecture

Delivered the structured server-side observability, sliding window rate-limiting, and security alert evaluation engine providing tenant-safe telemetry with zero PII/business payload leakage.

Key components:
1. **Sliding Window Rate Limiting ([`contracts/commands.ts`](file:///d:/StarqTech/starqERP/contracts/commands.ts)):**
   * Implemented `evaluateRateLimit` tracking sliding window request timestamps per key (IP, client kind, tenant) and calculating precise `retryAfterSeconds` when limits are exceeded (failing closed with `rate_limited`).
2. **Secret-Safe Structured Logging & PII Sanitization:**
   * Implemented `StructuredLogEntry` and `sanitizeLogMetadata` scrubbing sensitive credentials, tokens, customer phone numbers, TINs, and bank account numbers (`[REDACTED_SENSITIVE_PAYLOAD]`) before log serialization.
3. **Security Anomaly Alert Evaluation:**
   * Implemented `evaluateSystemAlertSignals` evaluating runtime telemetry against actionable thresholds:
     * `AUTH_BRUTE_FORCE` (SEV2_HIGH): $\ge 5$ failed authentications in window.
     * `CROSS_TENANT_ATTACK` (SEV1_CRITICAL): $\ge 1$ cross-tenant access violation attempts.
     * `OUTBOX_DEAD_LETTER` (SEV2_HIGH): $\ge 1$ transactional outbox dead-letter events.
     * `SOD_OVERRIDE_SURGE` (SEV3_MEDIUM): $\ge 3$ segregation-of-duties overrides in window.

---

## 2. Automated Test Evidence

* **Web Vitest Suite (`web/src/test/serp_036_observability_rate_limiting.test.tsx`):**
  * `✓ enforces sliding window rate limit and fails closed when threshold exceeded`
  * `✓ scrubs sensitive credentials, tokens, customer phone and bank accounts from logs`
  * `✓ triggers structured anomaly alerts when metrics exceed thresholds`
  * Total web suite: `26 test files passed | 99 tests passed`.
* **Deno Contract Suite (`tests/contract/commands_test.ts`):**
  * Added 3 contract tests covering sliding window rate limiting, log sanitization, and alert signal evaluation.
  * Total: `151 passed | 0 failed`.
* **Hardcoding Sweep:** `PASS (0 violations)`.
* **Migration 0021 Rehearsal Test:** `PASS (5/5 checks passed)`.
* **Vite Production Build:** Clean build with 0 errors.

---

## 3. Files Created & Modified

- `contracts/commands.ts` (Modified): Added `evaluateRateLimit`, `sanitizeLogMetadata`, `StructuredLogEntry`, `AlertSignal`, and `evaluateSystemAlertSignals`.
- `supabase/functions/_shared/commands.ts` (Modified): Synced from contracts.
- `web/src/test/serp_036_observability_rate_limiting.test.tsx` (New): Vitest suite.
- `tests/contract/commands_test.ts` (Modified): 3 Deno contract tests.
- `docs/tasks/SERP-036.md` (New): Task report.
