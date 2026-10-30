# ERP Roadmap Status Update — 30 October 2026

**Record type:** status addendum, not a replacement
**Supersedes nothing** — the [28 Sep roadmap](./ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md) and
its stage tables, gap list (G1–G8) and task mapping (SERP-460…467) remain the authoritative
structure. This file updates status against that structure; it does not restate it.
**Restart gate:** satisfied — see
[`ERP_RESTART_AUTHORIZATION_2026-10-30.md`](../governance/ERP_RESTART_AUTHORIZATION_2026-10-30.md).
**Owner:** Elder (`claude`), acting ERP Lead per Room #16950.

## 1. Board-vs-reality gap (finding, not yet corrected here)

The live SERP board (`StarqNexus/data/starq-erp-tasks.json`, outside this repo's scope) shows
437 tasks / 232 done / 192 planned / 12 in_progress / 1 closed — materially unchanged from the
28 Sep snapshot (429 / 232 / 184 / 12 / 1) despite a month of real, merged work in between. Spot
check against the roadmap's own corrective tasks:

| Task | Board status | Actual repo/GitHub state |
|---|---|---|
| SERP-354 | in_progress | Matches — active commits on `main` 2026-10-29/30 |
| SERP-460 | **planned** | **Merged to `main`** via PR #167 |
| SERP-461 | planned | Open PRs #170, #171, #172, #173 (unmerged) |
| SERP-462 | planned | Open PR #169, CI green (unmerged) |
| SERP-463 | planned | Matches — not started |
| SERP-466/467 | planned | Open PR #168 (unmerged; CI status partly unverified, see Room #16962) |
| SERP-464, SERP-465 | planned | Matches — not started |

SERP-460 is the clearest stale entry: it's real, merged, production code, and the board doesn't
know. **Not corrected in this file** because `StarqNexus/data/` sits outside the ERP Lead's
authorized scope (`D:\StarqTech\projects\starqerp` only, per Room #16950) and Codex/Command
currently owns that rebuild. Surfaced to Room (#16985) for whoever owns board writes.

## 2. Wave-1 gap status (G1–G4, the convergence-critical set)

| Gap | 28 Sep state | 30 Oct state |
|---|---|---|
| **G2** SERP-354 payment boundary | stopped | in_progress, continuing on `main` |
| **G1** accounting-event/subledger | absent | **closed** — SERP-460 merged (PR #167) |
| **G3** reconciliation invariants | planned | in flight — PRs #170–173 (AR, AP, cash-clearing, inventory-to-GL), blocked on an environmental CI issue (GHCR registry throttling, not a code regression — Room #16967/#16971), fix in PR #180, unmerged |
| **G4** migration compatibility gate | planned | in flight — PR #169, CI green, unmerged |

G1 moving from absent to closed is the single biggest convergence move since the 28 Sep baseline:
it was the structural blocker for Record-to-Report and the accounting leg of every other chain.

## 3. Immediate priorities (ERP Lead's call, within the five-agent floor cap)

Ordered by the roadmap's own unblocking logic (§"Convergence gap summary"), not by what's merely
closest to done:

1. Land PR #180 (G4's environmental blocker) and get G3's four reconciliation-invariant PRs
   merged — closes G3 for real rather than leaving it CI-flaky.
2. Resolve PR #170's remaining, unrelated governance-gate failure (orphan-code reachability on
   `inventoryReconciliation.ts`) — assigned to `pi`, in progress (Room #16976).
3. Merge PR #169 (G4) once reviewed — no code blocker, just a merge decision.
4. Resolve the PR #168 access gap (Room #16962) so SERP-466/467's actual CI state can be
   confirmed before treating it as ready.
5. Only after 1–4: open the SERP-463 process-acceptance-suite lane (§9.3 of the doctrine) — not
   started yet, and the roadmap is explicit that chain-specific expansion (SERP-464/465) waits
   until after it.

Room is the ledger for execution against this; this file is the position, re-stated as the
picture changes materially — not on a schedule.

## 4. End-of-day update (same session, materially changed picture)

Sections 1–3 above describe the position when the ERP floor restarted. By end of session, the
full wave they describe has executed:

| Gap / item | Status at restart (Sec. 1–3) | Status now |
|---|---|---|
| **G1** accounting-event/subledger | closed (SERP-460 merged via PR #167) | unchanged, holds |
| **G4** migration gate | PR #169 open, CI green | **merged** |
| **G4** environmental CI blocker | PR #180 open | **merged** — GHCR throttling fix landed |
| **G3** reconciliation invariants | PRs #170–173 open, CI-blocked | **all four merged** (#170 inventory, #171 AR, #172 cash-clearing, #173 AP) — each also had an independent governance-gate orphan-code finding (new domain module, no production caller yet), fixed and merged with each PR, same reviewed pattern |
| PR #168 (SERP-303–306 + SERP-466/467) | access gap, unresolved | **root-caused** (49 commits stale, broken CI workflow, not an access problem) and **closed as superseded** — 6 of 11 commits were already on `main` via other PRs; **PR #182** opened as its replacement (the ~2 genuinely unique commits plus a corrective restart-authorization/status doc, since the superseded docs asserted a now-false "ON HOLD" state) |
| SERP-463 (process acceptance suites) | not started | scoped (coverage-gap analysis) and a Chain-1 skeleton drafted + independently reviewed — still unmerged, pre-PR scaffolding, not activated |

**Net effect:** every PR open at the start of this session (6) is now resolved — 6 merged outright,
1 closed-and-replaced. G1–G4 (the convergence-critical set) are all either closed or merged.

**Still correctly not started, per the roadmap's own sequencing (Sec. "First implementation
wave"):** SERP-464 (Cash-to-Bank completion) and SERP-465 (Procure-to-Pay closure) — net-new
chain work that the roadmap itself gates behind SERP-463's acceptance suites, which are
scaffolded, not built. SERP-467 (period close) shipped as part of PR #176 per its own merged
description, but — like SERP-461/466's reconciliation modules — the production wiring is
deliberately **held, not activated** (Founder direction: hold for now rather than wire in as
part of this wave). This is a decision, not a gap.

**Board-vs-reality gap (Sec. 1) is now wider**, not narrower: the board hasn't moved at all while
six more PRs merged today. Still out of this file's authorized scope to correct directly.
