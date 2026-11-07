# W0-E / PR #192 — Vision Independent Verification Brief (2026-11-07)

**Role:** You are Vision, the independent verifier. You did NOT build this. Verify read-only against the GitHub REMOTE. Do NOT modify the repo, rotate credentials, or rewrite history. Return **PASS** or **CORRECTIONS-REQUIRED** + a merge recommendation.

## What this PR IS (and is NOT)
PR #192 is the **W0-E Procure-to-Pay acceptance-suite scaffold + L1 reachability gate** — incremental **test infrastructure**, explicitly **NOT** a passing acceptance suite. It is a DRAFT. Judge it as scaffold/infra, not as end-to-end P2P acceptance. Do not fail it for the acceptance scenarios being unproven — that is by design until later waves.

## Target
- PR: **https://github.com/almstq/starqERP/pull/192**
- Head SHA: **`db7591ebde7b3bc78d8148117047ee33ed0d0863`** (branch `claudewsl/erp454-acceptance-suite-20261106`). Confirm head via `gh api repos/almstq/starqERP/pulls/192 --jq .head.sha`; if drifted, report drift.
- Base `main`. Note `main` has since advanced to `26e73793` (ERP-540 B1 + ERP-541 B2 merged after this PR's base); the scaffold's reachability gate is contract-level and independent of those merges — base-staleness is not itself a defect for scaffold infra, but note it in your recommendation.
- Author: `Elder <a.musthaq@gmail.com>` — Standard A, zero `*.local` (confirm).
- 5 files (+295/-0): `scripts/acceptance-suites/procure-to-pay.test.mjs`, `scripts/acceptance-suites/lib/{contract-probe,p2p-fixtures,p2p-manifest}.mjs`, `.github/workflows/ci.yml`.

## Verification lanes
1. **Scaffold integrity** — the suite + lib modules load and run; `node --test procure-to-pay.test.mjs` structure is coherent (manifest → fixtures → contract-probe → scenarios).
2. **L1 reachability gate (the exit criterion)** — confirm the gate is honest and not always-red/always-green:
   - `PAY_SUPPLIER` FAILS the G1 reachability gate **by design** (absent from COMMANDS → real caller answers unknown_command/403). This expected-red is the required exit criterion, NOT a bug.
   - `need`/`quote`/`award`/`receive`/`match` PASS the gate (admitted by `authorizeCommand`) → proves the gate is not always-red.
3. **Informational CI configuration (D-W0E1)** — the new `P2P Acceptance Suite` CI job is `continue-on-error` / INFORMATIONAL: it shows RED conspicuously in checks but does **NOT** block the PR, and is **NOT** a branch-protection required check. It must remain non-required until **W4**. Confirm the overall run conclusion is SUCCESS despite the job being red.
4. **Zero-skip invariant** — the suite enforces **zero skipped / zero todo**; intentional reds fail honestly (not skipped, not masked green). Confirm the "zero skips / zero todo" step passes.
5. **No false-green / no scope creep** — the PR adds only scaffold + gate + CI config; no product/command code changed; no acceptance falsely claimed.
6. **Live CI at the head SHA** — on run `42300163339`: all required checks green (Backend/Contracts, Playwright SERP-328, RLS SERP-337, Payment Concurrency SERP-356, Web Frontend, Vercel); the informational P2P job RED (expected); overall conclusion SUCCESS.

## Reporting
- Return **PASS** or **CORRECTIONS-REQUIRED** with per-lane evidence and the SHA verified.
- Give an explicit **merge recommendation**: is this safe to merge as incremental test infrastructure with the acceptance job remaining informational/non-required until W4?
- State any lane you could not verify (Cloudroom-board — Elder covers that). Do not merge.
