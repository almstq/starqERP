# SERP-287 — Removal of hardcoded backend staff allowlist dependency

**Status:** done  
**Branch:** `ag/serp-287-deprecate-allowlist`  
**Date:** 2026-09-05  

## Scope boundary
Replaced the `STARQBOOKS_ALLOWLIST_JSON` environment variable as the source of person authority in the Edge `establishPerson` and `refreshSessionAuthority` flows with dynamic queries against `public.persons`, `public.memberships`, and `public.membership_seats`.

## What changed
**Files:**
- `supabase/functions/starq-api/index.ts`
- `supabase/functions/README.md`

1. **Deprecated & removed `allowlist()` function** (was reading `STARQBOOKS_ALLOWLIST_JSON`).
2. **Removed `AllowPerson` type** (no longer referenced).
3. **Transitioned `establishPerson`**:
   - Dynamic identity lookup in `public.persons`: checks `external_subject == claims.sub`, falls back to checking `verified_email == normalizedEmail` to seamlessly bind pre-seeded pilot staff without conflict, and auto-provisions new authenticated Google accounts.
   - Preserved `platform.operator_principals` entitlement resolution.
   - Preserved auto-accept of pending staff invitations (`accept_staff_invitation` RPC per SERP-286).
   - Resolved active organizations directly from `public.memberships`.
   - Resolved active seats dynamically from `public.membership_seats` (checking `revoked_at IS NULL` and intersecting with `ALLOWED_SEATS`).
   - Removed legacy upsert of allowlist seats on login (eliminating the bug where sign-in re-granted revoked seats).
   - Set preferred acting seat to `seats[0] ?? ""`.
4. **Transitioned `refreshSessionAuthority`**:
   - Removed fallback to `allowlist()`; seats derive strictly from active database `membership_seats`.
5. **Updated documentation**:
   - Removed `STARQBOOKS_ALLOWLIST_JSON` requirement from `supabase/functions/README.md`.
   - Updated header comment in `index.ts` explaining that `ALLOWED_SEATS` is an intersection filter against `public.membership_seats`.

## Acceptance Evidence
- ✅ Edge function `establishPerson` and `refreshSessionAuthority` query database tables (`public.persons`, `public.memberships`, `membership_seats`, `organisations`) instead of environment JSON.
- ✅ Existing pilot accounts work seamlessly via database person/membership rows (no `STARQBOOKS_ALLOWLIST_JSON` needed at runtime).
- ✅ New organisations can onboard staff by inserting membership rows or accepting invitations; no backend env redeployment required.
- ✅ Server-side authority maintained via `ALLOWED_SEATS` intersection and `membership_seats` with `revoked_at IS NULL`.
- ✅ Revocations cannot be accidentally overridden by environment variables on subsequent logins.

## Verification Probes
- `deno check supabase/functions/starq-api/index.ts` → Clean (exit code 0).
- `node scripts/reachability-sweep.mjs` → 138 accounted for, 0 unreviewed orphans.
- `npm test` in `web/` → 111 test files passed, 658/658 tests passed (Duration: 53s).
