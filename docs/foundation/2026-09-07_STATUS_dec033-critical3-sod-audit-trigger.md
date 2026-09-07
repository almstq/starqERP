# Status — DEC-033 CRITICAL-3: purchase SoD exceptions were never wired to the event stream

**Status: MERGED TO MAIN, NOT YET CONFIRMED LIVE IN PRODUCTION.** Per the lesson already recorded
in `2026-08-23_PROOF_audit-critical-1-revocation.md` — a fix that is merged is not the same as a
control that is proven running — this document tracks what is actually confirmed versus what
remains open, rather than writing "closed" on the strength of a merge alone.

## What the defect was

Migration `202608250016_sod_exceptions.sql` built the Segregation-of-Duties exception
infrastructure (`sod_exceptions`, `sod_exception_dispositions`, `evaluate_segregation_capacity()`,
`record_sod_exception()`) — but nothing ever called it. Confirmed by grep: zero call sites
anywhere in the codebase outside that migration itself, per the DEC-033 readiness packet posted
to the Operations Room on 2026-09-06. A solo operator (or anyone) doing both halves of a forbidden
purchase pair (award+pay, quote+award, receive+match) generated no audit record at all.

## The fix

PR #102 (`elder/critical3-sod-audit-trigger`, merged `9cda822`, 7 Sep 2026) adds
`app_private.check_purchase_sod_pair()` — an `AFTER INSERT` trigger on `public.job_events` that
detects the three forbidden pairs and calls the existing `record_sod_exception()` when the same
person performs both halves. Per explicit Founder ruling recorded in the migration's own header:
this is an audit-recording trigger, not a hard block — it never rejects the purchase event it
observes, matching `202608250016`'s own stated design intent ("resolves the solo operator reality
by recording immutable audit exceptions rather than hard-blocking or silent pass-throughs").

Two real bugs were found and fixed during review, both self-caught before merge:
1. The original draft's self-test used `ROLLBACK` inside a `DO` block — invalid PostgreSQL,
   would have blocked every apply.
2. Fixing the syntax alone would not have been enough: the self-test inserted a row into
   `sod_exceptions`, which `202608250016` already made immutable (blocks `UPDATE`/`DELETE`). The
   self-test was moved to a standalone probe (`tests/dec033_critical3_sod_audit_trigger.probe.sql`)
   that wraps its own `begin;`/`rollback;` at the top level, matching the existing
   `tests/sod_exceptions_probe.sql` pattern — verified self-contained after independent review by
   Codex found the first version only documented that requirement instead of enforcing it.

## What is confirmed

- Migration is on `main` as of merge `9cda822`.
- Independently reviewed twice: Codex (scoped transaction-safety pass) and Vision (full trace of
  the probe SQL, confirmed transaction-safe, confirmed the migration/probe diff touches only the
  expected files).
- CI required gates (Backend/Contracts & Governance Gates, Web Frontend Build & Test Suite) both
  passed on the merge commit.
- Migration lint (`scripts/lint-migrations.mjs`) clean against the full 40-migration lineage.

## What is NOT yet confirmed

- Whether this migration has actually been **applied** to the live Supabase project (`supabase
  migration list --linked` was the method used earlier tonight to confirm CRITICAL-2's live
  status — the same check has not yet been run for this migration).
- A real observed exception: no one has yet performed a real award+pay pair as the same person on
  a live/staging tenant and confirmed a `sod_exceptions` row was actually written by the trigger,
  the way critical #1's proof procedure required an actual sign-in/sign-out cycle rather than
  trusting the code.

**Next step to fully close this the way critical #1 was closed**: run `supabase migration list
--linked` to confirm live application, then perform one real award+pay (or quote+award, or
receive+match) pair as the same person against a non-production tenant and confirm the resulting
`sod_exceptions` row, before this is recorded as anything stronger than "merged and reviewed."
