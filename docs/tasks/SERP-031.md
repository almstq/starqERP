# Task Execution Report: SERP-031
## Versioned API, Error & Idempotency Contract

- **Phase:** Phase 2 — Close the security/domain gates
- **Priority:** P0
- **Execution state:** Complete
- **Date:** 2026-08-26
- **Accountable owners:** Codex / Antigravity
- **Requirements:** CORE-001, CORE-002, API-001, IDEMP-001

---

## 1. Scope & Architecture

Delivered the versioned API envelope, canonical error taxonomy, and durable idempotency execution engine establishing the contract and runtime boundary for server-authoritative command dispatch.

Key components:
1. **Versioned Request/Response Envelope ([`contracts/commands.ts`](file:///d:/StarqTech/starqERP/contracts/commands.ts)):**
   * Defined `ApiRequestEnvelope<T>` and `ApiResponseEnvelope<T>` supporting explicit API versions (`v1`, `0.1.0`), client request IDs, durable idempotency keys, command names, and structured error envelopes (`code`, `message`, `details`).
2. **Canonical Error Taxonomy:**
   * Standardized stable error codes across Edge/Web runtimes including `contract_version_unsupported`, `idempotency_key_required`, `idempotency_key_conflict`, `tenant_not_found`, `insufficient_seat_authority`, `validation_failed`, `unauthorized`, and `seat_revoked`.
3. **Durable Idempotency & Replay Semantics:**
   * Implemented `executeVersionedApiCommand` and `computeRequestHash`:
     * Same Key + Same Request Hash $\rightarrow$ returns cached execution outcome (`disposition: 'replayed'`) without re-executing command handlers or creating double business side-effects.
     * Same Key + Different Request Hash $\rightarrow$ strictly rejected as `idempotency_key_conflict`.
     * Missing key or unsupported version $\rightarrow$ fails closed with attributable error envelope.
4. **Client API Gateway Service ([`web/src/services/apiGateway.ts`](file:///d:/StarqTech/starqERP/web/src/services/apiGateway.ts)):**
   * Implemented `buildVersionedRequestEnvelope` and `dispatchVersionedApiCommand` wiring client command dispatch into the versioned contract.

---

## 2. Automated Test Evidence

* **Web Vitest Suite (`web/src/test/serp_031_versioned_api_idempotency.test.tsx`):**
  * `✓ builds standard v1 request envelope with request ID and idempotency key`
  * `✓ dispatches command and returns applied response`
  * `✓ replays same cached response when exact same key and payload is dispatched`
  * `✓ detects and rejects idempotency key conflicts when payload is changed`
  * Total web suite: `22 test files passed | 84 tests passed`.
* **Deno Contract Suite (`tests/contract/commands_test.ts`):**
  * Added 4 contract tests covering v1 command execution, same-key replay cache hits, payload conflict rejections, and unsupported version gating.
  * Total: `140 passed | 0 failed`.
* **Hardcoding Sweep:** `PASS (0 violations)`.
* **Migration 0021 Rehearsal Test:** `PASS (5/5 checks passed)`.
* **Vite Production Build:** Clean build with 0 errors.

---

## 3. Files Created & Modified

- `contracts/commands.ts` (Modified): Added `SUPPORTED_API_VERSIONS`, `ApiRequestEnvelope`, `ApiResponseEnvelope`, `computeRequestHash`, and `executeVersionedApiCommand`.
- `supabase/functions/_shared/commands.ts` (Modified): Synced from contracts.
- `web/src/services/apiGateway.ts` (New): Client-side API gateway service.
- `web/src/test/serp_031_versioned_api_idempotency.test.tsx` (New): Vitest suite.
- `tests/contract/commands_test.ts` (Modified): 4 Deno contract tests.
- `docs/tasks/SERP-031.md` (New): Task report.
