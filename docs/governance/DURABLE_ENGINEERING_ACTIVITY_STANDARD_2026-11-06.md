# Durable Engineering Activity — Standing Operating Standard

**Status:** RATIFIED — Standing Operating Requirement
**Owner:** @claude (Elder), StarqERP Engineering Lead / Floor Orchestrator
**Authority:** Founder / Managing Director, Starq Technologies Pvt Ltd — Room directive #18319 (2026-11-06)
**Scope:** StarqERP, Hoadhaa, and internal engineering infrastructure (all engineering environments and agents)

## 1. Intent

Every engineering environment must produce a **visible, traceable record of its actual work**. When the Founder opens the Starq Technologies GitHub organization, the engineering workforce must be visibly developing software through genuine commits, branches, pull requests, reviews, checks and integration history.

Three durable records, kept distinct:

| Record | System | Holds |
|---|---|---|
| **Operation** | Room (broker ledger) | assignments, ACKs, progress, blockers, reviews, decisions, completion receipts — with individual session attribution |
| **Output** | GitHub (Starq org repos) | genuine repository changes: code, tests, documentation, tooling, infrastructure |
| **Progress** | Cloudroom Tasks | project/task state, aligned to independently verified evidence |

## 2. Operating requirements

1. **Room is the operational ledger.** Every agent/environment records material assignments, acknowledgements, progress, blockers, reviews, decisions and completion receipts in Room, under its own canonical identity and session attribution.
2. **Repository-affecting work must reach GitHub.** Substantial engineering work must not remain indefinitely invisible in local worktrees. Reflect it through meaningful commits, branches and PRs as appropriate.
3. **Attribution and linkage.** GitHub contributions identify the actual contributor and, wherever practical, link to the relevant Room events and Cloudroom tasks (reference the Room sequence / task ID in the commit or PR body).
4. **Review and merge authority unchanged.** Independent verification, PR review, and Founder-controlled merge/release authority remain exactly as before. **Publishing a branch or opening a PR does not authorize merging.** Merges to a protected/default branch are a Founder (Class-3) decision.
5. **No manufactured activity.** Do not manufacture commits, inflate activity, misattribute authorship, or open unnecessary PRs merely to generate visible activity. Visibility must track *genuine* work.
6. **Right record for the right thing.** Operational-only activity belongs in Room. GitHub records genuine repository changes only.

## 3. Durability obligations (owner: @claude)

- Preserve this directive in version-controlled Starq governance documentation (this file).
- Reference it from the agent onboarding entrypoint — `D:\StarqTech\AGENTS.md`, which lives **outside this repository** and is therefore not part of this repo or its PR diffs — so new sessions inherit the requirement.
- Audit the active engineering floor for uncommitted work, missing GitHub evidence and attribution gaps; reconcile them without disrupting current assignments.
- Verify that the Starq Technologies organization repositories visibly reflect real engineering progress.
- Report the committed policy path, commit SHA and implementation evidence in Room.

## 4. Reconciliation status (updated 2026-11-06)

WP-R1 surfaced a concrete instance of the problem this standard addresses: during the board-reconstruction chapter, reviewed reconciliation work (AR/AP/cash-clearing/inventory modules and the supporting migration-compatibility gate; PRs #169–#173, #176) had been dropped from the `main` reconstructed at that time. That gap has since been reconciled:

- The four reconciliation modules and their unit tests (`web/src/domain/{ap,ar,cashClearing,inventory}Reconciliation.ts[.test.ts]`) and `scripts/migration-compatibility-gate.mjs` are now **present on current `main`**, byte-identical to the integration base `wip/serp463-integration-base-20261030` (`fd9b73b`).
- The net-missing artifact — the DEC-100 acceptance suite `scripts/acceptance-suites/inventory-to-gl.test.mjs` — is recovered via reviewed **PR #189** (Copilot independent PASS + Elder reconciliation PASS; Founder-accepted for merge), which adds that suite, the gate modularization it consumes, and the reachability-sweep registration.
- Outstanding follow-up: wire the migration gate + DEC-100 suite into CI (tracked separately).

This recovery — executed under builder/reviewer separation and independent review, with Founder merge authority — is the first application of this standard.

## 5. Operating model & roles (Founder decision #18372, 2026-11-06)

Engineering runs on a recurring cycle; the companion [`CLOUDROOM_HERDR_HANDOFF_CONTRACT`](./CLOUDROOM_HERDR_HANDOFF_CONTRACT_2026-11-06.md) holds the phase and handover detail.

```
Cloudroom (plan) → Herdr (execute) → Cloudroom (verify/accept) → repeat
```

| Role | Environment | Responsibility |
|---|---|---|
| **Cloudroom** | Planning / PM | Authoritative project-planning and task-management environment and Kanban; prepares bounded engineering execution packages. |
| **Herdr — Elder (@claude)** | Engineering execution | Receives the package, coordinates engineering agents, supervises implementation/testing/GitHub delivery, returns an evidence-backed completion receipt. |
| **Vision** | Cloudroom PM / verifier | Windows Hermes Project Manager operating within Cloudroom; the normal delivery verifier (evidence vs acceptance criteria, Kanban updates, Founder reporting). Serves StarqERP and Hoadhaa. **No Herdr pane, and does not need one.** |
| **Copilot** | Risk-based specialist assurance | Deeper independent technical review (via Herdr or GitHub) for security-sensitive, architectural, migration or other high-risk changes. **Not** mandatory for routine packages; routine verification stays in Cloudroom. |
| **Room** | Operational ledger | Communication: assignments, ACKs, progress, blockers, reviews, decisions, receipts — with session attribution. |
| **GitHub** | Source + evidence | Genuine repository changes and the engineering-evidence record. |

The Founder retains final merge, release and acceptance authority. Future sessions inherit this model via the onboarding entrypoint (which references this standard and the companion contract); it is not carried by any live conversation.

## 6. Enforcement

This is a standing requirement, not a one-time action. New or materially re-bound sessions inherit it via the onboarding entrypoint. Floor audits recur as the engineering floor changes. Independent review and Founder merge authority are preconditions, never bypassed by the visibility requirement.

---
*Ratified per Founder Room directive #18319. Operational history for this standard lives in Room; this document is its version-controlled, GitHub-visible source of record.*
