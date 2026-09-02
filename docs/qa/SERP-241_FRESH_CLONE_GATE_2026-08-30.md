# SERP-241 — fresh-clone exit gate

**Executed:** 30 August 2026, ~02:00 MVT · **By:** Elder
**Tree verified:** `e04f7e3` — `main` at the time of the run
**Result:** **PASS on execution.** Not closed — see §6.

> The task's own framing: *"Everything before it is preparation; this is the proof."* Every step a
> developer has to be told about verbally is a step missing from the repository. So this run used
> **only what is written in the README**, in a clean directory, with no inherited environment, no
> cached dependencies and no local tweak.

---

## 1. Method

```bash
mkdir D:/StarqTech/_tmp/serp241 && cd D:/StarqTech/_tmp/serp241
git clone --branch main https://github.com/almstq/starqERP.git starqERP-fresh
```

Empty directory on **D:** (Rule 0), fresh clone from the remote — not a copy of the working tree.
23 MB. Then every command from README §"Local Development Setup" and §"Verification & Testing",
in the order written, with nothing added.

---

## 2. Results — every documented command

| Step | Command, exactly as documented | Result |
|---|---|---|
| Clone | `git clone --branch main …` | **pass** — `e04f7e3`, 23 MB |
| 1 | `npm --prefix web install` | **pass** — 311 packages, 8s, **0 vulnerabilities** |
| 2 | `cp web/.env.example web/.env.local` | **pass** — `.env.example` is present and tracked |
| Test | `npm --prefix web test` | **pass** — 82 files, 295 tests, 1 skipped |
| Lint | `npm --prefix web run lint` | **pass** — `tsc --noEmit`, exit 0 |
| DB tests | `node --test tests/migrations_0024_0025_verification.test.mjs` | **pass** — 1/1 |
| UI tests | `node --test tests/ui_responsive_system.test.mjs` | **pass** — 4/4 |

**No undocumented step was required.** Nothing had to be fixed, guessed, or supplied from the
founder's machine to get from `git clone` to a green test run.

**One thing is missing from the README, and it is minor:** the production build. `npm --prefix web
run build` **passes** (12.4s), but it is not listed under Verification & Testing. A developer
verifying a release would have to know to run it. Worth one line.

---

## 3. Secrets scan — tree and history

**Working tree** — JWTs, `sk-`/`ghp_`/`AKIA` prefixed keys, PEM private keys, and any
`service_role` key assignment:

```
0 matches
```

**Full history** — the same patterns across **every blob ever committed**:

```bash
git grep -InE '<patterns>' $(git rev-list --all)
2831 objects scanned → 0 matches
```

**Env files ever committed:** one — `web/.env.e2e`, added 28 Aug in `4d1210c` (SERP-328 Playwright
suite) and since removed from the tree.

**Reviewed and benign, stated rather than glossed:**
- 6 lines. **Zero values match any credential pattern** — no JWT, no long opaque token.
- Every host is `127.0.0.1` or `localhost`. **No non-local host appears at all.**
- Its own header says: *"Offline, deterministic, no production traffic… Playwright route fixtures
  fulfill every `/api/*` call in-browser, so the real gateway is never hit."*
- The client id is the literal placeholder `e2e-c…`.

A scanner will flag it because it is an env file in history. **It is not a leak.** Recording it here
so the next person to run this gate does not have to re-derive that, and does not assume a breach.

---

## 4. Legacy reachability

Acceptance required that no legacy implementation path is reachable from a fresh clone.

- `legacy/` exists in the tree — `README.md`, `docs/`, `engine/`.
- **Nothing under `web/src` imports from it.** A grep for `legacy/` across every `.ts` and `.tsx`
  returns zero.

It is archived reference material, not a reachable code path. **Criterion met.**

---

## 5. What this gate did NOT exercise

Stated plainly, because a gate that implies more coverage than it has is worse than no gate.

- **The Supabase stack was not started.** README steps 3 and 4 need Docker Desktop and the Supabase
  CLI. The migrations themselves are separately proven — all 35 apply cleanly on a fresh Postgres
  cluster, verified under SERP-344 — but `supabase start && supabase db reset` was not run here.
- **The app was not driven in a browser.** It builds and serves, but it sits behind authentication
  and no session was available. Elder must not enter credentials.
- **Only `main` was tested.** The finance-kernel work in PR #25 and PR #26 is not in this tree.
  Once merged, this gate should be re-run — the acceptance is about the tree a developer actually
  clones.

---

## 6. Why this is not marked done

**Acceptance requires independent verification by @vscode, who did not perform the work (DEC-072).**
@vscode is out of credits. Elder executed this gate, so Elder cannot also be the one who accepts it.

The evidence is here to make that verification cheap: every command, its exact output, the scan
patterns, and the one finding with the reasoning that makes it benign. A second party needs to
re-run, not re-investigate.

**Recommendation:** re-run after PR #25 and PR #26 merge, and have @vscode or another party confirm.
Add the production build to the README's verification list while someone is in there.
