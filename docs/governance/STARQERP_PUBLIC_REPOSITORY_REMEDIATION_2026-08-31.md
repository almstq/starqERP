# starqERP-public remediation record — 31 August 2026

**Classification:** private governance record. Do not publish this file or its contents.

## Authority

- **DEC-114:** §10, private-main to stripped-public publication doctrine, Founder accepted and closed as doctrine.
- **Founder remediation ruling, 31 August 2026:** the contaminated public lineage is not a valid §10 publication base. Establish a fresh-history, positive-allowlist public derivative only after the required gates pass.

## Observed public lineage before remediation

- Repository: `https://github.com/almstq/starqERP-public` (`almstq/starqERP-public`)
- Observed at: `2026-08-31T01:14:53+05:00`
- Public HEAD: `1b041e35772789b887f31be04ad0f43cb1f9c3c4`
- Reachable history: 12 commits, including `1b041e3 sync: mirror private 6584e9d` and `cc72d6d sync: accounting suite, typecheck repair and payment fixes from private main`.
- Reconstructive content present in the public tree: `contracts/`, `docs/`, `supabase/`, `tests/`, and `web/`.

## Remediation boundary

The old public lineage must not be used as a publication base or preserved as a public archive. The replacement must start from a fresh Git history and a positive public-safe allowlist derived from verified private source `e04f7e3a98e76e7937a81cd8c1c62b657d35bcc8` without importing private or contaminated-public Git history.

## Required gate record

Before any fresh public push, record PASS for: bounded exposure assessment; history isolation; internal-path leakage; proprietary/reconstruction review; source-map/debug-artifact absence; public-safe inventory; and deployment-safe configuration. Vercel remains undeployed and may later connect only to `almstq/starqERP-public`.

## Bounded exposure assessment

Assessment of all 12 commits reachable from the contaminated public `main` completed on 31 August 2026 before replacement work. The current tree produced zero findings from `detect-secrets`. Token-pattern matches were limited to the contract-test fixture and package-manager lockfiles; the only committed PostgreSQL URLs were localhost test credentials (`test_user`) in a probe script. No actionable credential requiring rotation was identified in this bounded assessment.

The lineage does expose internal infrastructure references: Supabase project endpoints in source/configuration, including the current root `vercel.json`, and a tracked `web/.env.example`. No source maps or generated build artifacts were found. These findings reinforce replacement with a code-free derivative; they must not be carried forward.

## Prepared clean-room candidate

- Selected private source: `e04f7e3a98e76e7937a81cd8c1c62b657d35bcc8` (`origin/main`).
- Local candidate root commit: `e594a2afa098ccf9c96e6f05dbcce23d0264dc8d`.
- Candidate inventory: `.well-known/security.txt`, `LICENSE`, `README.md`, and `SECURITY.md` only.
- Gate results: zero `detect-secrets` findings; no `.env`, source maps, build/debug artifacts, internal paths, internal endpoints, Vercel configuration, or private Git history; four-file positive allowlist exact.
- History isolation: the candidate has one root commit and no object identity shared with the selected private source.

No remote deletion, recreation, force-push, or deployment has been performed. Reusing the existing public repository name safely requires a Founder-authorised irreversible GitHub replacement action.

## Completed public reset

Under the Founder remediation ruling, the contaminated public `almstq/starqERP-public` repository was deleted and recreated with the same name on 31 August 2026. The replacement repository has public `main` at `e594a2afa098ccf9c96e6f05dbcce23d0264dc8d`, a single root commit containing only the four allowlisted files above.

**Publication mapping:** `e04f7e3a98e76e7937a81cd8c1c62b657d35bcc8` private source → all listed clean-room gates PASS → `e594a2afa098ccf9c96e6f05dbcce23d0264dc8d` public derivative.

No private history, raw source, Vercel configuration, deployment, or automatic mirroring was introduced. Future public releases must regenerate a new stripped derivative from an explicitly selected verified private source commit and repeat the gate record before updating this repository.
