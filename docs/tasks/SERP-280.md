# Task Execution Report: SERP-280
## Product Analytics that Collect NOTHING Sensitive

- **Phase:** Phase 7 — External client #2 + productisation
- **Priority:** P2
- **Execution state:** Complete
- **Date:** 2026-08-26
- **Accountable owners:** Claude & Codex / Antigravity
- **Decisions:** DEC-073 §10, DEC-083

---

## 1. Scope & Core Architecture

Delivered a strict, privacy-preserving client telemetry framework that instruments product performance and feature utilization without collecting customer commercial data or PII.

Key architectural controls:
1. **Permitted Signals Allowlist:**
   - Explicitly restricted to 10 operational events: `screen_viewed`, `modal_opened`, `tab_switched`, `theme_toggled`, `workflow_step_advanced`, `document_created_count`, `search_executed`, `error_occurred`, `mfa_challenge_prompted`, `mfa_challenge_completed`.
   - Payload properties are restricted to aggregate counts, durations, and system route strings.
2. **Disallowed Sensitive Fields & Fail-Closed Gating:**
   - Active blocklist checks reject any payload containing `customer_name`, `email`, `phone`, `plate_number`, `tinNumber`, `bmlAccount`, `amount`, `subtotal`, `total`, `price`, `prompt`, `search_query`, `notes`, `details`, `password`, `secret`, `token`, `rawError`, or `stack`.
   - String values are scanned for email, phone, and Maldivian Rufiyaa/USD currency signatures, and lengths > 64 chars are rejected.
3. **Source-Side Tenant Anonymization:**
   - All events hash the tenant UUID deterministically at the client source (`anon_tenant_<hex>`) prior to buffer entry, preventing raw tenant identifiers or database keys from exiting the client.
4. **Privacy Notice & Specification Alignment:**
   - Updated `docs/PRIVACY.md` Section 6 to document telemetry boundaries transparently.
   - Authored formal schema specification in `docs/specs/PRODUCT_ANALYTICS_SCHEMA.md`.

---

## 2. Automated Test Evidence

* **Web Vitest Suite (`web/src/test/serp_280_product_analytics.test.tsx`):**
  * `✓ anonymizes tenant ID at source with anon_ prefix and deterministic hash`
  * `✓ accepts permitted operational events with count and timing properties`
  * `✓ refuses unpermitted arbitrary event names (fails closed)`
  * `✓ strictly rejects any payload carrying known customer or financial sensitive keys`
  * `✓ detects and rejects sensitive patterns in property values (email, phone, currency)`
  * `✓ rejects excessive free-text strings > 64 chars`
  * Total web suite: `14 test files passed | 58 tests passed`.
* **Deno Negative Conformance Suite (`tests/contract/commands_test.ts`):**
  * Added 6 contract tests covering source hashing, allowlist gating, raw tenant rejection, sensitive key rejection, and sensitive value pattern rejection.
  * Total: `112 passed | 0 failed`.
* **Hardcoding Sweep:** `PASS (0 violations)`.
* **Migration 0021 Rehearsal Test:** `PASS (5/5 checks passed)`.
* **Vite Production Build:** Clean build with 0 errors.

---

## 3. Files Created & Modified

- `contracts/commands.ts` (Modified): Added telemetry schema types, allowlist, sensitive blocklist, and `validateAnalyticsEvent`.
- `supabase/functions/_shared/commands.ts` (Modified): Synced from contracts.
- `web/src/services/telemetry.ts` (New): Client-side privacy-preserving telemetry client.
- `web/src/context/ERPContext.tsx` (Modified): Integrated telemetry tracking for theme, tenant, and document counts.
- `docs/PRIVACY.md` (Modified): Added Section 6 Product Telemetry & Usage Analytics.
- `docs/specs/PRODUCT_ANALYTICS_SCHEMA.md` (New): Technical specification for product analytics.
- `web/src/test/serp_280_product_analytics.test.tsx` (New): Vitest telemetry test suite.
- `tests/contract/commands_test.ts` (Modified): 6 Deno contract tests.
- `docs/tasks/SERP-280.md` (New): Task report.
