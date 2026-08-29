# Convergence — 30 August 2026

**Prepared by:** Elder (@claude) · **Scope:** every session, agent and repository in flight
**Purpose:** one picture, because at least four sessions have been writing to the same repositories
today and the board no longer matches the code.

---

## 1. The headline: PR #24 is not what its title says

`elder/2026-08-29-serp340-one-code-universe` — the branch behind **PR #24** — now carries **three
commits, and one of them is not mine and is not SERP-340**:

```
c556842  docs: Elder handoff for the converging session          (Elder)
24e3300  SERP-349/350: payment schema — RLS, composite            (ANOTHER SESSION)
         tenant-safe keys, and the constraints that make
         the guarantees real
cde2597  fix(SERP-340): one account-code universe                 (Elder)
```

**Anyone reviewing PR #24 for the Chart of Accounts change also silently approves a payments
schema with RLS policies.** That is exactly the shape of a bad merge: a reviewer signs off on the
part they understand and carries the rest.

**This is good news wrapped in a problem.** `24e3300` is the rescue of the 1,617 untracked lines I
flagged at `57c842ee` — migrations `0031`–`0034` are now committed and pushed. **That finding is
CLOSED.** Whoever acted on it acted correctly and fast. The only defect is *where* it landed.

**Recommended:** split before merging. `24e3300` belongs on a payments branch with its own review,
because it introduces new RLS surface (see §4).

---

## 2. Who has been writing today

| Session | What it did | Where it landed |
|---|---|---|
| **Elder** (this) | CoA audit preserved + reconciled, spec v1.0, SERP-339 split, SERP-340 implemented, SERP-300 closed, bus onboarding rebuilt | PRs #22, #23 merged; #24 open |
| **A payments session** | SERP-347 Money canonical, SERP-349/350 payment schema, migrations 0031–0034, BML/MIB onboarding pack | `24e3300` on PR #24's branch; `f9037ee` on an **unpushed** branch |
| **@vision** | SERP-300 live verification (PASS), SERP-358 gate probe draft | Verified evidence merged in #23; gate script **untracked** |
| **@vscode** | Bus onboarding, board cross-check, caught Elder's stale SERP-124 dispatch | Evidence file merged in #22. Out of credits 15:34 |
| **@openclaw** | Self-registered on the bus, board sync audit (visible vs canonical) | Identity committed `72e566e`. Never posted to the Room |
| **@antigravity** | 13 task claims 28 Aug (SERP-010–016, 315, 317–319, 323–324) | Out since — weekly quota 0% |

---

## 3. Work that still exists only on this machine

| Artefact | State | Risk |
|---|---|---|
| Branch `elder/serp-347-money-canonical` | **local only, never pushed** — carries `f9037ee` SERP-347 Money canonical | Dies with the working copy |
| `starqERP/scripts/serp358-gate2.mjs` | **untracked** — Vision's SERP-358 Gate 2 probe draft | Dies to `git clean` |

**Push the first, commit the second.** Today already produced one near-loss of 1,617 lines; the
lesson does not need repeating twice.

```bash
cd D:/StarqTech/starqERP
git push -u origin elder/serp-347-money-canonical
```

---

## 4. The board is behind the code

| Task | Board says | Reality |
|---|---|---|
| `SERP-347` | `planned` | **committed** — `f9037ee`, Money promoted to canonical, float removed from the statutory tax path |
| `SERP-349` | `planned` | **committed** — `24e3300`, schema + RLS + composite tenant-safe FKs |
| `SERP-350` | `planned` | **committed** — `24e3300`, uniqueness and idempotency constraints |
| `SERP-351` | `planned` | **committed** — `24e3300`, provider registry migration `0031` |
| `SERP-358` | `planned` | in progress — gate probe drafted, untracked |
| `SERP-359` | `planned` | **written** — 406-line BML/MIB onboarding pack, committed in `24e3300` |

Six of the fourteen Payment Core tasks have code or documents on disk while the board calls them
`planned`. **The board is the SSOT (DEC-082), so it is the board that is wrong**, and it should be
corrected by whoever did the work — not by me guessing at completion state.

**I have not touched these records.** Marking another worker's task done on their behalf is how a
board stops being trustworthy.

### A gate this opens

`SERP-300` was proven against **migrations 0001–0030**. Migrations **0031–0034 are new RLS surface
that no adversarial probe has ever run against.** Before the payments lane closes, the probe must be
re-run — `tests/run_serp_300_adversarial_probe.ps1` applies every migration in the folder, so it
picks them up automatically. Written-but-never-exercised RLS is this codebase's signature defect;
55 policies with zero tests is how SERP-124 started.

---

## 5. Resolved today — do not re-litigate

**The visible/canonical board delta has closed.** @openclaw's audit found visible `143/328` against
canonical `144/342`. Both now read **`144/342` = 42.11%**. The visible board was stale because
`src/data/*.generated.ts` had not been rebuilt; Elder's `PUBLIC_BUILD=1 npm run prebuild` runs
regenerated it as a side effect. **The audit was correct and is closed by regeneration, not by
argument.**

*Measurement note:* parse the `tasks` array, not a regex over the generated file — it also holds
`epics`, `bugs` and `improvements`, and a whole-file count yields a wrong `150/350`. Elder published
that wrong pair before catching it.

**The untracked payments work is rescued** — `24e3300`. Finding `57c842ee` is closed.

**`SERP-124` and `SERP-172` are done** (25 Aug, Codex) and were never reopened. A stale brief in an
inbox said otherwise; @vscode checked the board and caught it.

**`SERP-300` is closed, PASS**, independently re-verified with the role assertion proven at runtime.

---

## 6. Open and needing a human

| # | Item | Who |
|---|---|---|
| 1 | **PR #24 carries an unrelated payments schema.** Split it, or merge knowing what is inside | Founder |
| 2 | **PR #24 needs a reviewer** — DEC-072, Elder wrote it and cannot close its own gate | Founder / Vision |
| 3 | **Push `elder/serp-347-money-canonical`** before it is lost | Payments session |
| 4 | **Commit `scripts/serp358-gate2.mjs`** | @vision |
| 5 | **Correct the board** for SERP-347/349/350/351/359 | Whoever did the work |
| 6 | **Re-run the adversarial probe** once 0031–0034 settle | Not the author — DEC-072 |
| 7 | **`git clean` is safe again in starqERP** now that the payments work is committed — but item 4 is still exposed | — |

---

## 7. Capacity, so nobody is waited on

| Agent | State |
|---|---|
| `codex` | **OUT until 4 Sept 00:30** |
| `antigravity` | **OUT** — weekly quota 0% both pools; Gemini ~4d, Claude/GPT ~3d |
| `vscode` | **OUT** — credits exhausted 15:34 on 29 Aug |
| `vision` | available — **prompt-driven via Telegram**, acts only when messaged |
| `openclaw` | available — registered, briefed, has never posted to the Room |
| `claude` (Elder) | available |

---

## 8. What the finance kernel actually looks like now

`docs/specs/CHART_OF_ACCOUNTS_SPECIFICATION.md` **v1.0 is the authority.** If the software disagrees
with it, the software is wrong.

| | Before 29 Aug | Now |
|---|---|---|
| Accounts in the chart | 39 | **49** |
| Codes where chart and ledger agree | **5** | **22** |
| Collisions | 5 | **0** |
| Orphans | 14 | **0** |

Payroll no longer debits Workshop Rent and Electricity. 82 test files, 295 tests pass.

**Next on the chain:** `SERP-341` taxonomy → `SERP-342` tourism GST by time of supply. `343` and
`344` run alongside. `346` gates the umbrella.

**Do not fix SERP-342 by swapping `0.16` to `0.17`** — adjudication
`docs/adjudications/2026-08-22_TGST-RATE-16-vs-17.md` explains why that reproduces the same defect
backwards.

---

## 9. Addendum — wider sweep, 30 Aug

PR #24 **merged** as `e04f7e3`. It carried one more artefact than catalogued in §1:
`tests/probes/serp349_payment_schema_probe.sql`. The payments lane therefore shipped a schema, a
bank onboarding pack **and** its own probe.

Swept every git repository on `D:` — 25 of them. Findings that matter:

### `starqERP-public` — safe, but 19 commits stale

Last synced `6584e9d`; private `main` is **19 commits ahead**. Nothing from today is mirrored: the
CoA specification, SERP-340, the SERP-300 evidence, the payments schema.

**No leak risk.** `scripts/sync-public.mjs` is **allowlist-based and fails closed** — its own header
records that on 29 Aug a naive mirror would have published an ISO 27001 readiness gap audit, "a map
of where our controls are weakest." Confirmed on disk: `docs/qa/`, the handoff and this convergence
file are all absent from the public tree. The design is right.

The only exposure is reputational: the public repo advertises a v0.2.0-beta capability set that is
now 19 commits behind what exists. **Whether to re-sync is a founder call**, not a defect.

### In-flight work in other repositories

| Repo | Uncommitted | Assessment |
|---|---|---|
| `BuzzLab` | 17 | **Stale, not active** — newest artefacts are 17–19 Aug. Includes two ELDER rulings, a RIVET document inventory, an Ignition Ink touchpoint map and a Starq roster authority matrix. Real analysis sitting untracked for eleven days |
| `projects/antrac-erp` | 12 | The founder's personal app. WLI fleet registers, cost lists and a Thilafushi photo audit dating to April. Untracked, on branch `codex/antrac-mvp-access-reports` |
| `projects/wc2026-nexus` | 4 | Live-state JSON, the WC2026 view, CSS, and an untracked `wc2026-watchdog.mjs` |
| `03_PROJECTS/hoadha` | 2 | A resumption-trigger proposal from 17 Aug |
| `AgentRuntimes/Hermes/hermes-agent` | 3 | Includes an untracked file literally named `nul` — a botched `> nul` redirect on Windows. Harmless, but delete-safe only by a human under the never-delete rule |

**None of it is mine and I have touched none of it.** The BuzzLab and antrac-erp material is the
largest exposure — genuine written analysis that has never been committed, in the same class as the
1,617 payments lines that nearly went today.

### What this changes

Nothing urgent in the ERP lane. The value of the sweep is knowing that **untracked work is a
pattern here, not an incident.** Five repositories are carrying uncommitted analysis right now.
The payments rescue was luck plus a timely finding; the rest is still exposed.
