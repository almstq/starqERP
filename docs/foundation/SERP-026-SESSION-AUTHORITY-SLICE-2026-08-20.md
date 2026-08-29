# SERP-026 preparation — live session authority slice

**Status:** Local review candidate only. Not deployed, not accepted, and not a SERP-026 completion claim.

## Gap closed locally

The Edge API previously verified the signed `sb_ops` cookie and expiry but did not re-check live database authority on each authenticated request. A membership suspension or seat revocation could therefore remain effective only after the existing cookie expired.

This slice adds a service-role-only database function that derives current session authority from:

- active legal organisation;
- active person;
- active, in-date organisation membership;
- active, non-revoked seats; and
- the currently acting seat.

The Edge API now refreshes authority after cookie verification and before any authenticated route. A rejected or unavailable authority check returns `401`, records a rejected session event and expires the browser/native cookie.

## Changed files

- `supabase/migrations/202608200008_session_authority.sql`
- `supabase/functions/starq-api/index.ts`
- `scripts/check-cloud-schema.ps1`

The migration includes transactional synthetic checks for:

- active membership and seat acceptance;
- cross-tenant denial;
- revoked-seat denial;
- suspended-membership denial; and
- complete rollback of synthetic fixtures.

## Verification completed

- `deno check supabase/functions/starq-api/index.ts` — PASS.
- `scripts/check-cloud-schema.ps1` — PASS: 8 migrations, 30 tables, 29 RLS tables and 26 policies.
- `git diff --check` on the changed slice — PASS.
- Secret/live-identity values were not added.

## Verification not completed

- Migration execution against a disposable/local PostgreSQL instance — NOT RUN; Docker/PostgreSQL test runtime is unavailable on this workstation.
- Remote migration or Edge deployment — NOT RUN and not authorised by this slice.
- Live membership-revocation acceptance — NOT RUN.

## Required review/deployment order

1. Elder/Codex review the SQL authority semantics and negative tests.
2. Execute migration `202608200008` in an authorised disposable/controlled database and confirm its transactional self-test.
3. Deploy the Edge change only after the migration exists; otherwise authenticated requests fail closed because the authority RPC is unavailable.
4. Verify active session, revoked seat, suspended membership and cookie-expiry behaviour with redacted evidence.

