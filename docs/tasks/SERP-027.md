# Task Execution Report: SERP-027
## Native Secure-Session Persistence Verification

- **Phase:** Phase 2 — Close the security/domain gates
- **Priority:** P0
- **Execution state:** Complete
- **Date:** 2026-08-27
- **Accountable owners:** Codex / Antigravity
- **Requirements:** CORE-001, CORE-002, SESS-001, COOKIE-001

---

## 1. Scope & Implementation

Verified and contractually bound the native secure-session persistence lifecycle around the server-authoritative `sb_ops` cookie.

Key behaviors verified:
1. **Cookie Format & Flags:**
   * `sb_ops=<token>; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=None`.
   * Secure, HttpOnly, and SameSite=None prevent cross-site leakage, script access, and plaintext transport while enabling authorized cross-site requests to Supabase Edge endpoints.
2. **Reload & Parsing:**
   * Request cookies are parsed to extract the HMAC-signed `sb_ops` session token.
3. **401 Unauthenticated Eviction:**
   * When session authority validation fails or seat is revoked, Edge boundary returns 401 with `Set-Cookie: sb_ops=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None` destroying stale client cookies.
4. **CSRF-Gated Logout Eviction:**
   * Logout `/api/auth/logout` requires matching CSRF token before clearing `sb_ops` (`Max-Age=0`).

---

## 2. Automated Test Evidence

* **Web Vitest Suite (`web/src/test/serp_027_secure_session_persistence.test.tsx`):**
  * `✓ formats sb_ops cookie with HttpOnly, Secure, and SameSite=None`
  * `✓ correctly extracts sb_ops token from multi-cookie header`
  * `✓ evicts sb_ops cookie on unauthenticated 401 responses (Max-Age=0)`
  * `✓ evicts sb_ops cookie on valid logout with CSRF verification`
  * Total web suite: `29 test files passed | 114 tests passed`.
* **Deno Contract Suite (`tests/contract/commands_test.ts`):**
  * Added 2 contract tests covering cookie formatting, parsing, 401 eviction, and CSRF-gated logout clearing.
  * Total: `160 passed | 0 failed`.
* **Hardcoding Sweep:** `PASS (0 violations)`.
* **Migration 0021 Rehearsal Test:** `PASS (5/5 checks passed)`.
* **Vite Production Build:** Clean build with 0 errors.

---

## 3. Files Created & Modified

- `contracts/commands.ts` (Modified): Added `formatSessionCookie`, `parseSessionCookie`, and `validateSessionCookieLifecycle`.
- `supabase/functions/_shared/commands.ts` (Modified): Synced from contracts.
- `web/src/test/serp_027_secure_session_persistence.test.tsx` (New): Vitest suite.
- `tests/contract/commands_test.ts` (Modified): 2 Deno contract tests.
- `docs/tasks/SERP-027.md` (New): Task report.
