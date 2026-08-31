# Wave 1 execution record — governance made real

**Date:** 30 August 2026
**Authority:** Founder execution release, 30 Aug 2026, against
`04_RECONCILIATION_AND_EXECUTION_PROGRAMME.md` §3 Wave 1.
**Rulings applied:** DEC-100 (Aikido advisory), DEC-102 (retire duplicates),
DEC-103 (ROUTE/HOLD/RETIRE), DEC-107 (Definition of Done v0.2), DEC-112 (F5 alert
destination), DEC-113 (repository archival to `legacy/retired-ui/`).

Nothing in this record closes an independent gate, merges a branch, or changes a task
status. Where a Wave 1 item could not be executed safely, it says so and why.

---

## 1 · Definition of Done v0.2 — ADOPTED

`docs/foundation/DEFINITION-OF-DONE.md` moves from v0.1 to v0.2 under DEC-107.

Added: the completion sequence (landed → reachable → wired → tenant-isolated →
production-path exercised → adversarially tested → truthful with real data →
independently reviewed), the rule that an inconclusive result is a failing result, the
DEC-103 carve-out making deliberate HOLD and RETIRE governed exceptions, an external
security evidence section recording Aikido's advisory status under DEC-100, and the
two release ratchets.

### 1.1 Both release ratchets are DECLARED but NOT ENFORCEABLE — and this is deliberate

The proposed patch named two executable checks. **Neither exists in the landed
lineage.** Adopting them as live gates would have written a standard whose own
enforcement commands do not run — the precise failure the standard exists to prevent,
and a breach of the Founder's standing constraint that branch-only implementation must
not be represented as landed.

| Ratchet | Named check | Verified state on `origin/main` (`e04f7e3`) |
|---|---|---|
| 1 · no unreachable view ships | `node scripts/reachability-sweep.mjs --strict` | **ABSENT from main.** Added by `0e7fe4f`, present only on `elder/2026-08-30-serp356-payment-failure-modes` (PR #27, changes-requested). The reachability CI gate `tests/component_reachability.test.mjs` is on the separate PR #28 branch. |
| 2 · chart and DB seed must not diverge | a chart/migration coherence test | **DOES NOT EXIST ANYWHERE.** SERP-340 merged the correction at `e04f7e3` but no coherence test came with it. `web/src/test/chart_of_accounts.test.tsx` does not compare the chart against the migration seed. |

Both are therefore written into the standard with an explicit non-enforceable notice
naming the exact missing artefact. Neither was wired into CI.

### 1.2 New finding raised by this work — SERP-340's ratchet does not exist

Founder Action Register row 08 records SERP-340 as *"CLOSED — MERGED TO MAIN … Coherence
ratchet added"*. The correction merged; **the ratchet did not.** Verified by inspecting
every test file on `main` for any comparison between `web/src/data/defaultChartOfAccounts.ts`
and the migration seed — there is none.

The defect is fixed and nothing prevents it recurring. **No task status was changed.**
This is recorded as a finding for independent confirmation and for a follow-up task,
not actioned unilaterally, because SERP-340 is a closed row and reopening it is not
Elder's call.

---

## 2 · `scripts/serp358-gate2.mjs` — RESOLVED as "stays out of the repository"

E1 required this be committed or its untracked status recorded, and explicitly forbade
deleting it to obtain a clean tree.

**Inspected before deciding.** The file is a 16-line draft that prints a checklist
string to stdout and exits. It performs no build-output check, no RLS assertion and no
bus-cursor read — the three things its own header claims it verifies. Its final line
states it is a draft awaiting Elder review and live Gate 2 execution.

**Decision: it is NOT committed to `scripts/`.** A file named `serp358-gate2.mjs`
sitting among real gate scripts, which prints a checklist and exits 0, is a gate-shaped
object that verifies nothing. Anyone who later runs it and sees no failure would have
evidence of exactly nothing, and would reasonably believe otherwise. That is the false-
completion pattern DEC-107 was adopted to stop, and planting it in the product
repository would be a self-inflicted instance of it.

**Preserved, not deleted**, byte-identical (MD5 `59c39e56bfb896205d777e2ae4d0bf07`) at:
`D:\StarqTech\workspaces\elder\preserved\serp358-gate2.mjs.DRAFT-not-committed`

If SERP-358 Gate 2 is to have a probe, it should be written to actually execute the
three checks and then committed. The draft is retained as the specification of intent.

---

## 3 · Commit `8f64cec` reword — NOT EXECUTED, and the reason matters

Item E2 asked for the subject of `8f64cec` to be reworded: it reads
`feat(payments): SERP-351 per-tenant payment provider config (Round-1, independent review)`
while its own body reads `DO NOT MERGE — independent review gate pending (DEC-072). Status: BLOCKED.`
The subject invites the merge the body forbids. The finding is correct.

**It cannot be executed safely by Elder.** The commit is the tip of
`origin/vision/starqerp-round1-serp-351-clean`, which is **PR #32** — a branch under
independent review carrying Founder changes-requested findings. Rewording the subject
requires either:

- amending the commit and force-pushing a branch that is under review, which rewrites
  history a reviewer is mid-way through and is destructive in the sense the standing
  constraints prohibit; or
- editing the pull-request title in GitHub, which Elder does not do — under the standing
  rule that D: is the record, GitHub is not called.

Adding a fresh commit to correct the wording is also wrong here: PR #32 must not acquire
unrelated commits, which is the defect that killed PR #31.

**Correct sequencing:** the reword happens when PR #32's changes-requested findings are
addressed and the branch legitimately takes new work. Recorded so it is not lost, and so
the next person does not force-push a branch under review to tidy a commit message.

---

## 4 · Board vocabulary defect (E9 / D11) — CANNOT BE ACTIONED, evidence missing

E9 says *"Resolve the board-vocabulary defect (planned vs declared todo) — D11."*

**D11 is not defined anywhere in the Founder Action Register.** The register defines
discrepancies D1 through D9 in section 9. Sections 11–15 reference D11 and D13, but
neither is written out in the document. The only appearance of "D11" is the E9 line that
cites it.

Elder will not reconstruct a discrepancy from its label and act on the reconstruction.
The board's own status vocabulary was verified this pass — `planned`, `done`,
`in_progress`, `blocked`, `next`, with no `todo` value present in any of the 363 task
records — so whatever D11 records, it is not a stray `todo` status on the starqERP board.

**Raised as a documentation gap in the register**, to be resolved by whoever wrote
sections 11–15, or dropped if D11 and D13 were drafting artefacts.

---

## What Wave 1 changed

- `docs/foundation/DEFINITION-OF-DONE.md` — v0.1 → v0.2
- `docs/governance/WAVE1_EXECUTION_RECORD_2026-08-30.md` — this file
- `scripts/serp358-gate2.mjs` — preserved to the Elder workspace, deliberately not committed

## What Wave 1 did not touch

No task status. No board. No branch other than this one. No pull request. No merge. No
independent gate. No credential. The `!starq` 560-file deletion set is untouched.
