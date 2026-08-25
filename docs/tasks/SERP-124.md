# Task Execution Report: SERP-124
## Exercise the RLS policies under a non-bypass role

- **Phase:** Phase 2 — Close the security/domain gates
- **Priority:** P0
- **Execution state:** Complete; independent review passed 2026-08-25
- **Implementation commits:** `04e0fd1`, strengthened behavioral coverage in `235543d`
- **Date:** 2026-08-24
- **Accountable owner:** Codex
- **Independent reviewer:** VS Code agent

## Scope

Added a repeatable, synthetic PostgreSQL probe for the checked-in migrations. It does not connect
to Supabase, use production rows, or assert that the deployed service-role path is tenant-safe.

The harness:

1. applies migrations `0001` through `0011` to a local disposable PostgreSQL runtime;
2. inserts two synthetic tenants and one synthetic person with membership in both;
3. inserts a Tenant A and Tenant B row through the complete foreign-key chain for every one of
   the 26 policy-bearing tables;
4. locks the expected 30-table and 26-policy catalogues;
5. classifies every public table as protected by RLS, protected by a revoked grant, or unprotected;
6. grants a dedicated probe role `SELECT` so revoked grants cannot masquerade as an RLS pass;
7. asserts the role is not superuser, does not have `BYPASSRLS`, owns no tested table, and has
   `row_security=on`;
8. proves every RLS-enabled table exposes zero rows without organisation/person claims; and
9. dynamically proves Tenant A sees its own fixture and zero Tenant B rows in all 26
   policy-bearing tables.

## Red-to-green evidence

The mutation run renamed `organisations_current` to `organisations_drifted`. The probe failed at
the policy catalogue gate with `SERP-124 RLS policy catalogue drifted`. This demonstrates that a
removed or renamed checked-in policy turns the test red.

The independent review found that the original fixture left most policy-bearing tables empty, so
changing `vehicles_current` to `USING (true)` still passed. Commit `235543d` adds adversarial rows
for all 26 policies and a repeatable `-SimulatePermissivePolicy` mutation. The same permissive
mutation now fails with `SERP-124 no-claim probe exposed rows from vehicles`.

The unmodified migration run passed with:

- asserted role: `serp124_rls_probe`;
- `superuser=false`;
- `bypass_rls=false`;
- `row_security=on`;
- 30 public tables classified;
- 26 `protected-by-RLS`;
- 4 `protected-by-revoked-grant`;
- 0 `NOT PROTECTED`;
- 26 policies behaviorally exercised with positive Tenant A and negative Tenant B controls;
- visible organisations under tenant A claim: 1;
- visible memberships under tenant A claim: 1; and
- tenant B organisation and membership rows: 0.

## Files

- `tests/run_rls_isolation_probe.ps1` — repeatable local harness; uses an already-present image,
  a read-only repository mount and a tmpfs database. It does not pull an image or remove a
  container.
- `tests/rls_isolation_fixture.sql` — synthetic-only tenant/person fixture.
- `tests/rls_isolation_probe.sql` — catalogue, role-attribute, no-claim and cross-tenant assertions.

## Other verification

- Deno contract tests: 50 passed, 0 failed.
- Python seat-matrix tests: 10 passed, 0 failed.
- Python document-numbering tests: 6 passed, 0 failed.
- TypeScript: `tsc --noEmit` passed.
- Web production build passed with the existing large-chunk warning.
- `git diff --check` passed.

`scripts/check-reality.mjs` continues to report two pre-existing failures outside this slice:
the Python portal lacks the `owner` seat and the configured web/Android OAuth projects disagree.
Neither was changed or reclassified by SERP-124.

## Evidence boundary and next gate

This implementation now supplies the missing direct-table RLS execution proof in the repository,
subject to reproduction by the named independent reviewer. It does **not** prove:

- the privileged service-role Edge/RPC path cannot cross tenants;
- storage object isolation;
- search, export or report isolation;
- AI/RAG isolation; or
- deployed production state.

Those remain in SERP-172 and the privileged-path review.

## Independent acceptance

On 2026-08-25 the VS Code agent independently inspected commit `235543d` and reproduced all three
required runs without modifying files or accessing production, cloud or live rows:

- baseline exited `0` with a non-superuser, `bypass_rls=false`, `row_security=on` and
  `policies_behaviorally_exercised=26`;
- `-SimulatePolicyDrift` exited nonzero with `SERP-124 RLS policy catalogue drifted`; and
- `-SimulatePermissivePolicy` exited nonzero with
  `SERP-124 no-claim probe exposed rows from vehicles`.

The reviewer found no vacuous-coverage, owner-bypass or grant/RLS confusion defect and returned
`PASS`. Codex recorded the independent verdict; it did not review or accept its own implementation.
