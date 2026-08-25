# Task Execution Report: SERP-182
## Concurrent idempotency replay and canonical JSONB digest

- **Phase:** Phase 2 — Close the security/domain gates
- **Priority:** P0
- **Execution state:** Implementation complete; independent review required
- **Implementation commit:** `2283db9`
- **Branch:** `codex/serp-182-idempotency`
- **Date:** 2026-08-25
- **Accountable owner:** Codex

## Outcome

`api_garage_command` now claims an idempotency key before any business mutation. A
concurrent request that loses the primary-key race catches `unique_violation`, reads
the winner's durable row, validates the command type and digest, and returns the same
accepted response. A conflicting payload returns `idempotency_key_conflict`; callers
never receive the raw primary-key violation.

Migration `202608250014_idempotency_replay.sql` deliberately leaves sequence `0013`
available for the live-row workflow migration reserved by SERP-162.

## Red-first evidence

Command:

```powershell
pwsh -NoProfile -File tests/run_idempotency_replay_probe.ps1 -WithoutFix
```

Against base `5cd1188`, two identical concurrent calls produced one accepted response
and one raw `idempotency_keys_pkey` violation. The database still contained exactly one
idempotency row, one job event, and one audit event. The probe exited non-zero.

## Green evidence

Command:

```powershell
pwsh -NoProfile -File tests/run_idempotency_replay_probe.ps1
```

Result:

- Two concurrent callers received the same accepted response.
- `idempotency_rows=1`, `distinct_responses=1`, `job_events=1`, `audit_events=1`.
- A different payload under the same key returned `idempotency_key_conflict`.
- No raw primary-key violation reached a caller.

## Audit correction: JSONB ordering was already canonical

The task said `command::text` changed with object key order. That premise was false for
this function because `command` is typed `jsonb`, not `json`. PostgreSQL normalized both
input objects to the same `jsonb::text`; their SHA-256 digests and replay responses were
identical before migration `0014`.

The migration adds `app_private.canonical_jsonb_sha256(jsonb)` to name and preserve the
existing invariant, and the real API probe covers reordered keys. This requirement could
not truthfully be shown red against the old implementation, so no red result is claimed.

## Regression evidence

- Settlement allocation probe: PASS, 16/16 plus serialized MVR 80 concurrency result.
- RLS isolation probe: PASS, 31 tables classified and 27 policies behaviorally exercised.
- Python seat matrix: PASS, 10/10.
- Python document numbering: PASS, 6/6.
- Deno command and numbering contracts: PASS, 50/50.

## Closure boundary

No production migration, live-row change, remote push, or self-acceptance occurred.
An independent reviewer must reproduce the dedicated red/green probe and inspect the
claim-before-mutation transaction boundary before SERP-182 can close.
