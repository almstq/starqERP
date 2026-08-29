# STARQ ERP Independent Architectural & State Audit

**Audit Date:** 2026-08-21  
**Auditor:** Independent Auditor (VS Code / Copilot Agent)  
**Target Repository:** `D:/!starq/starqERP/legacy/engine`  
**Audit conclusion:** **Not release-ready.** The architecture has credible foundations, but several “implemented” controls are only partially implemented or lack independent evidence. R0 should remain a preflight gate, not be promoted to pilot or production readiness.

---

## Audit Execution Transcript & Discovery Summary

I’ll anchor the audit in the named `legacy/engine` repository, then trace the security, ledger, migration, and roadmap contracts to their tests and call sites. I’ll produce findings first, with concrete file references and severity, and clearly separate verified behavior from documentation-only claims.

- Searched for files matching `**/legacy/engine/**`, 20 matches
- Searched for files matching `**/library/12_PROJECTS/*starq*`, 9 matches
- Searched for regex `the foundation engine|the foundation engine|OAuth|Supabase|RLS|append-only|outbox|idempot`, 475 results
- Searched for files matching `**/starqNexus/data/starq-erp-tasks.json`, 1 match
- Searched for files matching `StarqTech` · `legacy/engine/**`, 20 matches
- Searched for files matching `StarqTech` · `legacy/engine/starq-ops-app/**`, 20 matches
- Searched for files matching `StarqTech` · `legacy/engine/starq-ops-app/lib/**`, 14 matches
- Searched for files matching `StarqTech` · `legacy/engine/starq-ops-app/test/**`, 1 match
- Searched for files matching `StarqTech` · `legacy/engine/supabase/functions/**`, 3 matches
- Searched for regex `def |class |session|cookie|csrf|json.loads|parse_qs|authorize|check_sod|entity|tenant|html.escape|innerHTML|subprocess` (`**/legacy/engine/{auth.py,serve.py,ops.py,books.py,journal_outbox.py,*.py}`), 886 results
- Searched for regex `create policy|enable row level security|security definer|current_setting|auth.uid|organisation_id|tenant|idempot|append|immutable|outbox|unique` (`**/legacy/engine/supabase/migrations/**`), 219 results
- Searched for regex `clientId|serverClientId|STARQ|starq|Club|books|Group|entity|tenant|innerHtml|WebView|SharedPreferences|secure` (`**/legacy/engine/starq-ops-app/{lib,test,pubspec.yaml,android,web}/**`), 129 results
- Searched for regex `M0|M1|SERP-00[1-9]|security|tenant|RLS|idempot|outbox|recovery|sign|build|test` (`**/legacy/engine/docs/**`), 424 results
- Searched for regex `TODO|pass$|NotImplemented|assert|test|pytest|unittest|dart test|flutter test` (`**/legacy/engine/**`), 996 results
- Searched for regex `def do_|do_GET|do_POST|parse_qs|read_body|Content-Length|send_header|Set-Cookie|csrf|entity|next=|html.escape` (`**/legacy/engine/serve.py`), 810 results
- Searched for regex `class .*Handler|def do_GET|def do_POST|def _session|def _require|Set-Cookie|send_response` (`**/legacy/engine/serve.py`), 18 results
- Searched for regex `GoogleSignIn|Provider|Riverpod|ChangeNotifier|ListenableBuilder|StatefulWidget|ApiClient` (`**/legacy/engine/starq-ops-app/lib/**`), 31 results
- Searched for regex `def _read_post|def _read_form|MAX_|save_receipt_stub|_read_json` (`**/legacy/engine/serve.py`), 26 results
- Searched for regex `SERP-02[1-9]|SERP-03[0-9]|SERP-04[0-9]|M0|M1|reposition|repositioning` (`**/starqNexus/data/starq-erp-tasks.json`), 257 results
- Searched for regex `flutter_secure_storage|WebSecureSessionStore|HttpOnly|client_id|google|tenant_id|organization_id|RLS|append|idempot` (`**/legacy/engine/**`), 845 results

---

## Critical Findings

1. **Revoked seats can be reactivated during login.**  
   `establishPerson()` upserts allowlisted seats with `revoked_at: null`, undoing database revocations whenever the user logs in again.  
   `index.ts:259`

2. **Purchase authorization is overly permissive.**  
   `need`, `quote`, and `receive` authorize whichever active seat is supplied as `target_seat`. The server needs an explicit seat matrix rather than accepting the caller’s chosen seat.  
   `202608200005_garage_api.sql:63`

3. **Flutter and Edge command contracts have drifted.**  
   Flutter sends workflow forms that do not consistently match the Edge API’s accepted command envelope and state machine. Approval and receive flows can therefore fail or bypass expected workflow stages.  
   `ops_shell_screen.dart:350`

4. **The Python API lacks durable idempotency.**  
   Flutter’s keys are held only in memory. A process restart, retry, duplicate browser submission, or form POST can create duplicate operational effects.  
   `api_client.dart:115`  
   `ops.py:230`

5. **OAuth audiences are not platform-isolated.**  
   The Edge function accepts both web and Android client IDs through one combined allowlist. The `x-starq-client-kind` header is allowed but does not enforce audience selection. A web request can present an Android-audience token if otherwise valid.  
   `index.ts:6`  
   `index.ts:213`

---

## High-Risk Findings

6. **RLS is service-role dependent in the Edge path.**  
   The Edge function uses the Supabase service key, so tenant protection depends entirely on the correctness of RPC argument validation. No direct user-role RLS test has been demonstrated.  
   `index.ts:22`

7. **Cloud tenancy is not actually multi-tenant at runtime.**  
   The Edge function is hardcoded to Club Ignition. Starq Technologies is seeded in the database but is not selectable through the API. There is no tenant-switch endpoint, module-entitlement model, or tenant administration surface.  
   `index.ts:14`  
   `M1_ORGANISATION_SPINE_GAP_EVIDENCE_MAP.md`

8. **The durable outbox is missing from the cloud design.**  
   The blueprint names an outbox as a core capability, but the migrations provide idempotency and audit tables, not a transactional outbox with leases, retry state, delivery status, and reconciliation.  
   `STARQ-ERP-UNIFIED-BLUEPRINT.md:11`  
   `202608200001_core_foundation.sql:66`

9. **Python event recording is not concurrency-safe.**  
   State is loaded, counters are incremented, and JSON state is rewritten without a process or file lock. Concurrent requests can lose updates or allocate duplicate job/event numbers.  
   `ops.py:230`

10. **Receipt files are written before authorization completes.**  
    Unauthorized or malformed submissions can create files before event validation rejects the operation. Repeated uploads also create an unbounded disk-consumption risk.  
    `serve.py:4460`

11. **Malformed JSON handling is inconsistent.**  
    The Python parser converts malformed input into `{}` rather than returning a deterministic `400`. Some valid JSON shapes can then reach handlers expecting dictionaries and produce avoidable `500` responses.  
    `serve.py:3896`

12. **Accounting enforcement is incomplete at the proposal boundary.**  
    Posted journal entries and lines have useful append-only and balancing triggers. However, proposal lines have no chart-of-accounts foreign key or account validation, and there is no demonstrated enforcement for open periods, currency consistency, or controlled posting.  
    `202608200003_commercial_accounting.sql:64`

13. **RLS, recovery, rollback, and restore remain unproven.**  
    The SQL self-tests run inside rollback blocks. They do not replace tests using independent non-owner credentials, reset/restore rehearsals, or failure injection.  
    `CLOUD-DEPLOYMENT-RECORD.md`  
    `M0_SERVER_CORE_GAP_EVIDENCE_MAP.md:31`

---

## Flutter Client Assessment

- Native cookie persistence uses `flutter_secure_storage`; web persistence is intentionally a no-op and relies on browser-managed HttpOnly cookies. This is the correct boundary in principle.  
  `secure_session_store.dart:10`
- No Flutter Web token-theft vector was found through JavaScript-readable storage in the inspected code.
- The app is **not Riverpod-based**. `OpsShellScreen` owns API creation, session lifecycle, forms, workflow commands, navigation, and authorization presentation. This is a maintainability and testability risk, not currently a direct privilege escalation.  
  `ops_shell_screen.dart:10`
- UI capability presentation contains the brittle client-side check `person_id == 'ali'`. Server-derived capabilities should control visibility.  
  `ops_shell_screen.dart:108`
- Branding is inconsistent: Flutter says `STARQ ERP`, while API metadata still says `legacy/engine`. `Club Ignition` is also hardcoded in the shell rather than supplied as tenant context.  
  `app.dart:6`  
  `index.ts:321`
- Android signing appears fail-closed when signing properties are absent. However, versioning and release hygiene remain prototype-level: `0.0.1+1`, default package description, no visible CI release workflow, and generated build artefacts in the workspace.  
  `pubspec.yaml:1`  
  `build.gradle.kts:8`

---

## Ledger and Outbox Assessment

**Positive controls:**
- Journal entries and lines are append-only.
- Deferred balancing checks require at least two lines and zero net balance.
- Tenant composite foreign keys are used extensively.
- Local Python tests cover several ledger, entity, inventory, and POS invariants.
- Operational events are kept separate from live journals; automatic GL posting is honestly not represented as complete.

**Remaining accounting risks:**
- Proposal validation is weaker than posted-entry validation.
- No complete, transactionally enforced proposal-to-post workflow was evidenced.
- No durable cloud outbox exists.
- File-backed local event sequencing is unsafe under concurrency.
- Reversal, period-close, currency, account validity, and duplicate-source behavior need contract tests.

---

## Repository Repositioning Review

The proposed structure is directionally sound, but execution is not yet safe.

**Required safeguards before restructuring:**
- Perform a repository-wide secret and personal-data scan.
- Treat Git history as sensitive; removing files from the working tree does not remove historical exposure.
- Replace company-seeded migrations and `seed.sql` with synthetic fixtures before any public/open-source positioning.
- Verify dependencies before removing `journal_outbox.py`, `masters.py`, `pos.py`, or runtime data; existing tests and code reference these areas.
- Do not delete internal material without an approved archive/export destination.
- Add CI, reproducible setup, security policy, migration validation, and clean-clone verification before publishing.
- Do not blindly ignore `pubspec.lock`; Flutter application lockfiles are normally useful for reproducible builds.
- The proposed MIT license is a governance decision, not merely a technical cleanup step.

**Restructuring Sequence (do not batch into single run):**
1. Evidence and secret inventory.
2. Synthetic fixture extraction.
3. Clean-copy validation.
4. Package/module moves.
5. CI and build verification.
6. Public documentation and licensing review.

---

## M0 and M1 Roadmap Assessment

The broad sequence is correct:  
`R0 preflight -> M0 server core -> M1 organisation spine -> controlled pilot`

However, the current acceptance labels overstate completion.

### M0 Missing Evidence
The proposed seven suites are appropriate, but must include:
- External non-owner RLS tests.
- Tenant substitution tests on every identifier, not only session claims.
- Same-key/different-payload replay tests.
- Crash recovery while idempotency is `processing`.
- CSRF tests across both Python and Edge paths.
- Restore and rollback rehearsals.
- Error taxonomy and API-version compatibility tests.

### M1 Missing Prerequisites
M1 cannot be accepted until these exist:
- Runtime support for both seeded organisations.
- Explicit tenant-switch API with audit records.
- Module and outlet entitlement tables.
- Membership administration and lifecycle operations.
- Hierarchy validation for legal organisation, business name, outlet, and location.
- Import-pack quarantine, validation, hashing, reconciliation, and rollback.
- Transaction snapshots for mutable masters.
- External onboarding controls.

The board’s dependency ordering is good, but the implementation should remain blocked at M0 until the independent contract and recovery evidence exists.  
`starq-erp-tasks.json:170`

---

## Verified Test Result

- **Flutter tests:** **12 passed**.
- **Python tests:** **not executed successfully**. `pytest` is not installed, and `unittest discover` found no tests.
- **No independent cloud, RLS, OAuth audience, replay, restore, or end-to-end contract suite was run.**

---

## Priority Actions

1. Stop revocation reactivation and make membership state database-authoritative.
2. Replace implicit purchase-seat authorization with an explicit server-side matrix.
3. Define one versioned command envelope shared by Flutter, Python, and Edge.
4. Add durable Python idempotency and a transactional cloud outbox.
5. Build external M0 contract tests before claiming server-core completion.
6. Add non-owner RLS and restore/recovery evidence.
7. Implement tenant switching and module entitlements before calling M1 functional.
8. Remove `person_id == 'ali'` authorization presentation logic.
9. Resolve `legacy/engine` versus `STARQ ERP` naming and make tenant branding server-driven.
10. Refactor workflow commands out of `OpsShellScreen` into tested repositories/controllers.

**Final disposition:** Continue development, but classify the system as **R0 preflight / controlled engineering candidate**, not a pilot-ready or production ERP.
