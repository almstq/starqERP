# Remaining Findings — Round 1

**Date**: 2026-08-27
**Agent**: Qoder

---

## Findings Deferred to Later Rounds

These items were identified during Round 1 but are explicitly out of scope for this remediation. They belong to subsequent rounds.

### Round 2 Candidates

| # | Finding | Section | Rationale for Deferral |
|---|---------|---------|----------------------|
| R2-1 | Global search bar is UI-only (no backend search) | UI | Requires search index design; not a foundation issue |
| R2-2 | Bundle size 1.12 MB — needs code splitting | Performance | Optimization, not correctness |
| R2-3 | No Playwright E2E tests | Testing | Integration tests are a separate workstream |
| R2-4 | No service worker / offline support | PWA | Feature addition, not remediation |
| R2-5 | Charts use mock calculations | Reporting | Requires real financial data pipeline |

### Round 3+ Candidates

| # | Finding | Section | Rationale for Deferral |
|---|---------|---------|----------------------|
| R3-1 | No WebSocket/SSE for real-time updates | Architecture | Requires infrastructure design |
| R3-2 | Mobile responsive testing incomplete | UI | Device testing requires physical devices |
| R3-3 | Full WCAG accessibility audit not done | Accessibility | Specialized audit required |
| R3-4 | No load testing / performance benchmarks | Performance | Requires load testing infrastructure |
| R3-5 | starqAI UI is placeholder | Feature | AI integration is a separate epic |

---

## Partial Closures from Round 1

These Round 1 findings are structurally resolved but require live runtime verification:

| # | Finding | What's Done | What Remains |
|---|---------|-------------|--------------|
| P1 | RLS multi-tenant isolation | Policies correct in migration; query endpoints filter by org | Live test with multiple orgs in Supabase |
| P2 | Document numbering concurrency | `allocate_document_no()` is atomic with `FOR UPDATE` | Stress test with parallel writes |
| P3 | Settlement allocation triggers | Append-only trigger validates; overpayment rejected | Concurrent payment stress test |
| P4 | Idempotency replay detection | UUID keys; 7-day expiry; conflict returns error | Replay test with real Edge Function |
| P5 | Session expiry/eviction | 8-hour TTL; eviction cookie on 401 | Time-based expiry test |

---

## Known Limitations

1. **No live Supabase access**: All SQL probes, Python concurrency tests, and Deno contract tests require a running Supabase instance. These tests exist in the archived workspace (`D:\!starq\starqERP\tests\`) but cannot be executed locally.

2. **No Google Cloud credentials**: OAuth flow is production-shaped but cannot be tested end-to-end without configured `STARQBOOKS_GOOGLE_CLIENT_ID` and matching GCP credentials.

3. **No multi-tenant fixtures**: RLS testing requires at least 2 organisations with different users. These fixtures don't exist in the local development environment.

4. **GIS script SRI**: The Google Identity Services script is loaded without Subresource Integrity (SRI) hashing. This is intentional — Google updates the script frequently and doesn't publish stable SRI hashes. This is the official Google integration pattern.

---

## Items Explicitly NOT Findings

These were considered but determined to be working correctly:

- **Migration transaction safety**: Migration 0023 is wrapped in `begin;` / `commit;` — atomic application
- **CSRF dual delivery**: CSRF token sent via both `x-csrf-token` header AND `csrf` body property — Edge accepts either
- **Credential cookie scope**: `SameSite=None; Secure; HttpOnly` is correct for cross-origin cookie with Supabase Edge
- **Empty state initialization**: Starting with empty arrays (not mock data) is correct — prevents stale data from appearing before backend loads
