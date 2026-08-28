# SERP-300 — Adversarial RLS and multi-tenant isolation suite

Status: Classification complete; security regressions red; patch not started  
Owner: Codex  
Branch: `codex/serp-300-adversarial-isolation`

## Fixtures

All fixtures are synthetic and created inside a rolled-back transaction.

| Actor/data | Identifier | Access |
|---|---|---|
| Tenant A | `30000000-0000-4000-8000-000000000001` | Attacker's only organisation |
| Tenant B | `30000000-0000-4000-8000-000000000002` | Must remain invisible and immutable |
| Attacker | `30000000-0000-4000-8000-000000000101` | Active Tenant A member, `counter` seat |
| Book A1 | `30000000-0000-4000-8000-000000000301` | Attacker is assigned |
| Book A2 | `30000000-0000-4000-8000-000000000302` | Same organisation, attacker is not assigned |
| Book B1 | `30000000-0000-4000-8000-000000000303` | Different organisation |

## Executable matrix

| Attack | Expected |
|---|---|
| Tenant A reads Tenant B row | Zero rows |
| Tenant A inserts Tenant B row | RLS rejection |
| Tenant A updates/deletes Tenant B row | Zero rows affected |
| Book A1 member reads Book A2 document | Zero rows |
| Book A1 member updates/deletes Book A2 document | Zero rows affected |
| Authenticated client invokes invitation RPC directly | EXECUTE denied |
| Service path accepts a valid invitation | Executes against canonical schema and writes an audit event |
| Non-admin calls invitation list/create/resend/revoke | HTTP 403 `invitation_admin_required` |
| Context switch supplies unassigned organisation/book | HTTP 403; no signed switched session |

## Evidence boundary

- `tests/serp_300_security_boundaries.test.mjs` is the red/green server-boundary regression suite.
- `tests/serp_300_adversarial_isolation_probe.sql` is the behavioral PostgreSQL probe.
- `tests/evidence/SERP-300/remote-db-lint-before.txt` is a read-only linked Alpha lint result.
- `tests/evidence/SERP-300/classification-2026-08-28.md` records the exact clean-room catalogue, role-execution, runtime, and schema-contract results at HEAD `fda71811cdb77dea5e0f39eac9d09231ee1845bf`.
- No live tenant rows are read and no live writes are performed by these local probes.

## Classification result — 2026-08-28

All migrations `0001–0027` replay successfully into a newly recreated synthetic PostgreSQL database. The replay then fails the adversarial probe on the security boundaries below.

| Finding | Classification | Exact evidence |
|---|---|---|
| Book A2 SELECT / UPDATE / DELETE by a member assigned only Book A1 | Confirmed defect | `1 Book A2 rows`; UPDATE `1 rows affected`; DELETE `1 rows affected`. `commercial_documents_current` checks organisation access only despite `0025` declaring granular book access. |
| Authenticated execution of `accept_staff_invitation` | Confirmed defect | Function is `SECURITY DEFINER`; ACL is null; `anon`, `authenticated`, and `service_role` all have EXECUTE. An invocation under `SET LOCAL ROLE authenticated` entered the function body. |
| Invitation RPC runtime against replayed and linked schemas | Confirmed defect | Both clean-room execution and preserved read-only remote lint return SQLSTATE `42703`: `memberships.role` does not exist. |
| `0027` function-to-schema contract | Schema drift | Seven referenced columns are absent: `memberships.role`, `memberships.updated_at`, `membership_seats.created_at`, `book_memberships.created_at`, `audit_events.person_id`, `audit_events.event_type`, `audit_events.details`. |
| Provisioning/live function-to-schema contract | Schema drift | Twelve referenced columns are absent; clean-room and remote lint stop first at SQLSTATE `42703` on `organisations.name`. |

`platform.provision_approved_application` is correctly constrained as `SECURITY DEFINER` with `anon=false`, `authenticated=false`, and `service_role=true`; its execution permissions are not defective. Its body is nevertheless unusable because it targets the drifted schema contract.

No listed finding is a false positive. The pre-existing SERP-124 catalogue-count failure in `legacy-rls-coverage-drift.txt` is a separate harness-maintenance artifact and does not affect the behavioral results.

Classification is complete, so patching is now safe to begin only within the implicated migration/RLS/RPC surfaces and with the red SERP-300 regressions as gates. The security freeze remains in force until those tests turn green; Gate 1 external-friend acceptance remains out of scope.
