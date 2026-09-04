# SERP-401 morning retest kit

**Purpose:** one-shot close of SERP-401. This doc exists so the founder's job on waking is: retry apply → paste the request_id → someone runs one query → fix or close. No re-deriving context, no re-explaining what's already known.

**Prepared:** 2026-09-04, overnight shift (Elder + Antigravity). Do not re-litigate anything below without new evidence — the whole point of this doc is that it doesn't need re-verifying from scratch.

---

## What's already confirmed fixed (do not re-test these, they're done)

All independently verified end-to-end tonight, not guessed:

1. **Mock staff leak** across tenants — PR #52.
2. **Archetype-ID mismatch** between frontend and DB constraint — PR #52.
3. **Zero-org applicant session gate** (readSession/refreshSessionAuthority) — PR #53.
4. **Cross-origin API calls** — the deployed frontend was calling Supabase directly instead of through the existing same-origin Vercel proxy — PR #58.
5. **Edge Function was 7 days stale** — hadn't been deployed since 27 Aug despite today's merged PRs. Deployed, now on **v25**.
6. **Database was 7 days stale** — 11 migrations since 28 Aug, including a security remediation (SERP-300), had never been applied to production. Applied.
7. **`/api/ops/*` routes crashed instead of rejecting cleanly** for zero-org sessions — PR #60.
8. **`security_events.request_id` was never actually stored** despite the code trying to — PR #61. **This means the query below only works reliably from this point forward** (v25+); anything before that, correlate by `path` + timestamp instead.

**Login is confirmed working end-to-end** — real accounts loading their real org dashboards, verified live, not from a screenshot.

## What's still open — this is the actual blocker

**Apply itself still fails** with `application_submission_failed` for at least one real external tester (founder's own retest, reference `ea9af9d9-8c82-4939-ae82-c00acd1ef3f9`, before v25). Root cause not yet found. Every hypothesis tried tonight before finding the real causes above (WhatsApp webview, Safari ITP, generic cross-origin cookie) was wrong — don't re-propose those from memory, let the data below speak.

## The one-shot retest procedure

1. **Retry the apply flow** on `https://starq-erp.vercel.app` with any zero-org or fresh account.
2. **If it succeeds:** SERP-401 is done. Ping the team, Nexus closes the board record.
3. **If it fails:** the red error banner now shows a real reference UUID (thanks to PR #55's error-surfacing fix). Copy that UUID.
4. **Run this exact query** in Supabase Studio → SQL Editor (production project):

   ```sql
   select event_type, outcome, metadata, occurred_at
   from security_events
   where request_id = '<paste-the-uuid-here>'
   order by occurred_at desc;
   ```

   This is now a **direct indexed lookup** (PR #61) — no more path+time correlation guessing. If it returns the `api.error` row, `metadata.internal_code` has the real, unsanitized reason (the sanitized `error` field the user sees is deliberately generic; the internal one isn't).

5. **Paste the result rows back to the team.** Whoever's awake (Elder, AG, or by then possibly Nexus/Vision) reads the `internal_code`, checks the corresponding code path, and either fixes it or reports back why it needs a founder call.

## If the query comes back empty

That itself is a finding — it means the failure isn't reaching the outer error handler at all (e.g., a network-level failure, a Vercel-level error before the request reaches the function, or a CORS/preflight issue). In that case, the next-best evidence is the browser's own Network tab: open DevTools before retrying, find the failed `/api/onboarding/apply` request, and check:
- Did a request actually go out? (rules out a client-side JS crash before fetch)
- What status code came back?
- Is a `Cookie` header present on the request?

## Standing rule for tonight's whole class of bug (now enforced, not just remembered)

- **A backend merge is not live until `node scripts/check-deploy-drift.mjs` says so** (PR #62, pending review — read-only, checks Edge Function deploy timestamp and migration state against git).
- **A schema change is not live until the same script confirms it.**
- Don't infer production state from reading source. Ever again, on this project.
