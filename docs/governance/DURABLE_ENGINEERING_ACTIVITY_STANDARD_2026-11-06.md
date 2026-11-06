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
- Reference it from the agent onboarding entrypoint (`D:\StarqTech\AGENTS.md`) so new sessions inherit the requirement.
- Audit the active engineering floor for uncommitted work, missing GitHub evidence and attribution gaps; reconcile them without disrupting current assignments.
- Verify that the Starq Technologies organization repositories visibly reflect real engineering progress.
- Report the committed policy path, commit SHA and implementation evidence in Room.

## 4. Known reconciliation item at ratification (2026-11-06)

WP-R1 surfaced a concrete instance of the problem this standard addresses: the AR/AP/cash-clearing/inventory reconciliation modules were merged historically (PRs #169–#173, #176) but are **absent from current `main`** because `main` was rebuilt during the board-reconstruction chapter (merge `075da1fd` is not an ancestor of HEAD `e8af2fc`). The work survives only on feature branches (notably `wip/serp463-integration-base-20261030`). Recovering that work onto `main` via reviewed PR — subject to Founder merge authority — is the first application of this standard.

## 5. Enforcement

This is a standing requirement, not a one-time action. New or materially re-bound sessions inherit it via the onboarding entrypoint. Floor audits recur as the engineering floor changes. Independent review and Founder merge authority are preconditions, never bypassed by the visibility requirement.

---
*Ratified per Founder Room directive #18319. Operational history for this standard lives in Room; this document is its version-controlled, GitHub-visible source of record.*
