# SERP-001 — R0 Reproducible Acceptance Runbook and Evidence Manifest

**Board task:** SERP-022  
**Prepared by:** DP / Nexus context worker (`hermes` bus identity)  
**Technical acceptance owner:** Codex  
**Evidence producer:** Antigravity (AG)  
**Independent control reviewer:** Elder / Claude Code  
**Human acceptance action:** Founder  
**Status:** Draft only — this document does not authorize sign-in, cloud actions, mutations, deployment, release, or production use.

## 1. R0 scope

R0 is a **cloud-client connectivity preflight**, not an ERP or business release. It must use no real business records, claim no tenant onboarding or pilot operation, and enable no AI write principal.

R0 acceptance is limited to:

1. A frozen, reproducibly identified client/API candidate and acceptance environment.
2. Current native Flutter and Flutter web build/test evidence.
3. Secure native `sb_ops` persistence while Flutter web remains browser-managed HttpOnly.
4. Redacted real-owner sign-in evidence on the accepted client surfaces.
5. One synthetic, non-financial, non-destructive server-authorized action with idempotent replay proof.

R1 tenancy/SoD/audit implementation, SERP-020 recovery, and M8 AI-control-plane implementation remain separate later gates.

## 2. Candidate identity — fail closed

### Observed drafting baseline

| Field | Value |
|---|---|
| Repository | `D:\StarqTech\the foundation engine` |
| Branch observed while drafting | `main` |
| HEAD observed while drafting | `b6e745029947c9db5b8b6edddfdc247a531d77f3` |
| Working tree | Dirty; AG implementation is active. This is **not** an accepted candidate. |
| Flutter package | `D:\StarqTech\the foundation engine\starq-ops-app` |
| App version observed | `0.0.1+1` |
| Candidate revision | **UNKNOWN — acceptance blocked until Codex freezes it after AG evidence is complete.** |
| Acceptance environment | **UNKNOWN — acceptance blocked until Codex names the exact cloud environment and API origin.** |

A candidate is exact only when the evidence manifest records all of the following together:

- Git commit SHA.
- Branch.
- Clean/dirty status.
- SHA-256 of the scoped tracked diff when dirty.
- Sorted SHA-256 manifest of scoped untracked files.
- `pubspec.lock` SHA-256.
- Flutter and Dart versions.
- App version/build number.
- Cloud environment label and API origin, without credentials or query tokens.
- UTC start and finish times.

Run from WSL after Codex declares the candidate:

```bash
set +x
cd /mnt/d/StarqTech/the foundation engine
printf 'commit=%s\n' "$(git rev-parse HEAD)"
printf 'branch=%s\n' "$(git branch --show-current)"
git status --porcelain=v1 -- starq-ops-app docs/foundation
printf 'tracked_diff_sha256='
git diff --no-ext-diff -- starq-ops-app docs/foundation | sha256sum
printf 'pubspec_lock_sha256='
sha256sum starq-ops-app/pubspec.lock
flutter --version
dart --version
```

If the scoped working tree changes after evidence collection begins, the evidence is stale and the run restarts under a new candidate ID.

## 3. Secret-safe evidence location

Evidence root for a future authorized run:

```text
D:\StarqTech\_local-acceptance-evidence\STARQ-ERP\SERP-001\<candidate-id>\
```

WSL equivalent:

```text
/mnt/d/StarqTech/_local-acceptance-evidence/STARQ-ERP/SERP-001/<candidate-id>/
```

This location is outside both Git repositories and must not be ingested by Nexus/library generators. Before execution, Codex must verify that the root is not tracked, generated, synchronized, or published.

Required files:

```text
manifest.json
native/flutter-analyze.txt
native/flutter-test.txt
native/flutter-build-apk.txt
web/flutter-build-web.txt
boundary/forbidden-pattern-scan.txt
signin/native-owner-signin.redacted.json
signin/web-owner-signin.redacted.json
action/request.redacted.json
action/first-response.redacted.json
action/replay-response.redacted.json
action/idempotency-verdict.json
acceptance/codex-verdict.json
acceptance/elder-review.json
```

Never store cookies, tokens, OAuth client IDs, passwords, database/service-role keys, raw owner email, raw personal identifiers, browser storage dumps, or unredacted screenshots. Evidence records variable names, status codes, hashes, timestamps, redacted principal/tenant handles, and verdicts only.

## 4. Repeatable client commands

Run from `D:\StarqTech\the foundation engine\starq-ops-app` in a secure local shell with command tracing disabled. Values are supplied through the approved local environment and are never pasted into this runbook, logs, bus, source, or Git.

### Shared preparation and tests

```bash
set +x
cd /mnt/d/StarqTech/legacy/engine/starq-ops-app
flutter pub get
flutter analyze
flutter test
```

### Flutter web cloud build

```bash
flutter build web --release \
  --dart-define=STARQBOOKS_API_BASE_URL="$STARQBOOKS_API_BASE_URL" \
  --dart-define=GOOGLE_SERVER_CLIENT_ID="$GOOGLE_SERVER_CLIENT_ID"
```

Acceptance requires Flutter web to rely on browser-managed HttpOnly credentials. It must not read or persist cookies/tokens through JavaScript, `localStorage`, or `sessionStorage`.

### Native Android build

```bash
flutter build apk --debug \
  --dart-define=STARQBOOKS_API_BASE_URL="$STARQBOOKS_API_BASE_URL" \
  --dart-define=GOOGLE_SERVER_CLIENT_ID="$GOOGLE_SERVER_CLIENT_ID" \
  --dart-define=GOOGLE_ANDROID_CLIENT_ID="$GOOGLE_ANDROID_CLIENT_ID"
```

The debug APK is build evidence only, not a release artifact. Native acceptance additionally requires AG tests proving exact `sb_ops` save/load/clear, 401 clear, logout clear, and injectable session storage. Worker self-report is not acceptance.

### Boundary scan

Run a scoped tracked-source scan and review every hit:

```bash
git grep -n -E 'apps\.googleusercontent\.com|supabase_flutter|anonKey|service_role|document\.cookie|localStorage|sessionStorage|BrowserClient' -- starq-ops-app
```

Expected result:

- No literal OAuth client IDs.
- No Supabase SDK/direct database access or privileged key material.
- No JavaScript cookie access.
- No auth persistence in `localStorage` or `sessionStorage`.
- Any `BrowserClient` reference is isolated to the guarded web transport implementation and does not enter VM/test code.

A non-zero hit count is not automatically a failure; each hit must be classified in `boundary/forbidden-pattern-scan.txt`. An unexplained or prohibited hit is **FAIL**.

## 5. Redacted real-owner sign-in procedure

This section is procedural only. It must not be executed without the Founder present and Codex authorizing the exact candidate/environment.

For **native Android** and **Flutter web**, separately:

1. Confirm the displayed environment label and API origin match `manifest.json`.
2. Founder performs the sign-in personally. Agents do not type, view, copy, log, or transmit credentials.
3. Confirm the client receives an authenticated server response and server-resolved user/seat context.
4. Confirm no cookie/token value appears in UI, console, logs, screenshots, bus traffic, or evidence files.
5. Record only:
   - candidate ID;
   - platform;
   - UTC timestamp;
   - redacted principal handle hash;
   - redacted server-resolved seat/tenant handle;
   - HTTP/result status;
   - pass/fail/unknown;
   - evidence collector and reviewer.
6. Native restart check: terminate and reopen the app, then prove the exact server-issued `sb_ops` session resumes from OS-backed secure storage without exposing its value.
7. Web restart check: reload/reopen the browser surface and prove authentication remains browser-managed; Flutter code must not read or persist the credential.
8. Explicit logout and a forced/controlled 401 must clear native persisted session plus in-memory session, CSRF, and user state. No credential value is captured.

Any prompt for an agent to handle a credential, any unredacted identifier, or any mismatch between candidate/environment and the manifest is **FAIL**.

## 6. Permitted idempotent action and replay proof

### Exact action

Use the server-authoritative HTTPS command route **`POST /api/ops/event`** with command type **`CALL`** against a Codex-approved **synthetic-only R0 acceptance organisation/person/seat**. The accepted API origin is recorded in the candidate manifest; the Edge function maps this route to `public.api_garage_command(...)` server-side. The client never invokes that database routine directly.

Synthetic payload shape:

```json
{
  "type": "CALL",
  "customer_name": "R0 SYNTHETIC CUSTOMER",
  "vehicle_reg": "R0-TEST",
  "consent": true
}
```

Constraints:

- No amount, payment, journal, stock, invoice, real customer, real vehicle, or production tenant.
- Acting seat: `counter`.
- One newly generated UUID idempotency key reused unchanged for the replay.
- The Edge API generates a request identifier per attempt; evidence records its redacted response reference where available.
- Direct database/dashboard invocation is prohibited for R0 client acceptance.

### Expected proof

1. First request returns an accepted server response for the synthetic command.
2. Replay sends the same command and the same idempotency key.
3. Replay returns the equivalent accepted outcome and does not create a second event.
4. Evidence records redacted request/response bodies, status, timestamps, request hash, idempotency key hash—not the raw key—and the server audit/event reference.
5. A separate mismatch probe using the same key with a changed payload is permitted only if Codex explicitly includes it; expected result is fail-closed conflict.

The repository self-test migration `202608200007_garage_api_self_test.sql` demonstrates the intended rolled-back SQL-level behavior, but it does **not** substitute for the required client/API replay proof.

No action is executed while drafting this runbook.

## 7. Outcomes and stop rules

| Outcome | Meaning | Release effect |
|---|---|---|
| **PASS** | Required artifact exists, applies to the exact frozen candidate/environment, contains no prohibited data, and the named reviewer accepts it. | May proceed to Codex aggregate verdict. |
| **FAIL** | A command/test fails, a boundary is violated, replay duplicates, sign-in is not server-authorized, evidence leaks data, or reviewer rejects it. | R0 blocked. Fix under a new or explicitly amended candidate and rerun affected evidence. |
| **UNKNOWN** | Artifact absent/stale, environment or revision not exact, command outcome timed out, response state is uncertain, reviewer unavailable, or redaction cannot be verified. | R0 blocked. Unknown never counts as pass and is never retried blindly. Reconcile state first. |
| **NOT RUN** | Human/cloud authorization was not granted or procedure intentionally remained unexecuted. | R0 blocked; accurately reported as not run. |

A timeout after a mutating request is **UNKNOWN**, not failure and not permission to retry. Reconcile by idempotency key through the accepted API before any retry.

## 8. Acceptance and separation of duties

- **AG** produces client implementation/build/test evidence and reports limitations.
- **DP** reflects truthful board/evidence status and maintains this runbook; DP does not accept AG implementation.
- **Codex** is the technical acceptance owner for SERP-001 and issues the aggregate pass/fail/unknown verdict.
- **Elder / Claude Code** independently reviews control completeness and may reject evidence.
- **Founder** performs the real-owner sign-in and approves any consequential or irreversible human action. Founder participation does not replace technical evidence.

SERP-001 remains `in_progress` until Codex explicitly accepts the implementation and all four R0 evidence areas. Worker completion or green local tests alone never changes the task to `done`.

## 9. Current ambiguities

1. The exact acceptance candidate revision is not frozen because AG-FL-R2.2 is still in implementation.
2. The exact cloud acceptance environment/API origin is not named in the bounded assignment.
3. The current test tree does not yet expose separate named tests for native store save/load/clear, web no-persistence, 401 clear, and logout clear; AG must provide the final paths/results.
4. Evidence-root containment against every Nexus/library generator must be verified before an authorized run creates evidence files.

These ambiguities are blockers, not invitations to infer values or run cloud actions.
