# SERP-300 — Adversarial RLS and multi-tenant isolation suite

Status: Remediation checkpoint green; independent review pending
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
- `docs/evidence/SERP-300/remote-db-lint-before.txt` is a read-only linked Alpha lint result.
- `docs/evidence/SERP-300/classification-2026-08-28.md` records the exact clean-room catalogue, role-execution, runtime, and schema-contract results at HEAD `fda71811cdb77dea5e0f39eac9d09231ee1845bf`.
- `docs/evidence/SERP-300/green-static-boundaries.txt` records the eight focused Edge/RPC boundary tests passing after remediation.
- `docs/evidence/SERP-300/green-postgres-boundaries.txt` records the clean 0001–0028 replay and all sixteen adversarial/runtime checks passing after remediation.
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

Classification constrained remediation to the implicated migration/RLS/RPC surfaces and preserved the original red regressions as executable gates. Gate 1 external-friend acceptance remains out of scope.

## Remediation checkpoint — 2026-08-28

Migration `202608280028_serp_300_security_boundary_remediation.sql` and the Edge API changes repair the classified boundaries without modifying the historical 0001–0027 chain:

- `commercial_documents` now requires active book membership, not only organisation membership.
- the invitation RPC is service-role-only, binds acceptance to the persisted verified identity, validates role/book/location scope, and writes canonical membership/book/audit rows.
- the provisioning RPC now targets the canonical organisation, role, location, workflow, registry, and audit schema.
- context switching and operational reads enforce the active organisation/book assignment.
- invitation administration requires the `managing_director` seat and rejects foreign scope identifiers.
- removal of the empty-seat managing-director fallback prevents database seat revocation from becoming elevated authority.

Current executable evidence:

| Gate | Result |
|---|---|
| Focused static boundary suite | 8/8 pass |
| Clean PostgreSQL migration replay | 0001–0028 pass |
| Tenant A vs Tenant B read/write/delete/insert probes | pass |
| Book A1 member vs unassigned Book A2 probes | pass |
| Authenticated direct RPC execution denial | pass |
| Valid invitation runtime and identity-mismatch red case | pass |
| Canonical tenant provisioning runtime | pass |
| Deno type check for `starq-api/index.ts` | pass |
| Full frontend Vitest suite after rebase | 75 files / 272 tests pass |
| Vite production build after rebase | pass |
| Frontend TypeScript check after rebase | red on inherited active-head model/UI errors; no SERP-300 file appears in the diagnostics |

This is a tested implementation checkpoint, not independent acceptance. The security freeze and SERP-286 dependency remain in force until a separate reviewer reproduces the evidence and records acceptance.
