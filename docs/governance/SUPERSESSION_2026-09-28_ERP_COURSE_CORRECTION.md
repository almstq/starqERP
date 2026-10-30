# Supersession Record — StarqERP Course Correction, 28 September 2026

**Record type:** course-correction supersession index
**Effective:** 28 September 2026
**Governing doctrine:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](./STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
**Roadmap:** [`ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`](../roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md)
**Founder decision:** DEC-100 (`00_STARQ_HQ/decisions.json`)

**This document preserves history. Nothing was deleted, rewritten, reset or cleaned.**

---

## 1. What is superseded

The **pre-28-Sep completion trajectory** is superseded as the governing model of how
StarqERP completion is measured and organized.

Superseded model:

> Complete the remaining modules. Completion = task closed, migration applied, CI green.

Superseding model:

> Close the remaining business processes. Completion = a real business process runs end to
> end — operational truth, accounting consequence, audit, reconciliation, reporting — with
> the full process-level definition of done satisfied.

### What is NOT superseded

- Every completed SERP task. Completed work is not reopened mechanically.
- All existing architecture, migrations, tests and evidence. Convergence, not rewrite.
- All prior decisions DEC-001 … DEC-099. They stand; DEC-100 layers on top of them.
- The SERP board as task SSOT, with all original task IDs and history intact.
- All existing engineering controls protecting financial correctness, security, tenancy,
  data integrity, compliance, destructive operations, releases and merges.

---

## 2. Index of superseded / marked documents

Each entry below was annotated in place. The original text is **preserved verbatim**; only a
supersession header was added at the top of the file. **No historical content was removed.**

| # | Document | Status | Note |
|---|---|---|---|
| 1 | `docs/START_HERE.md` | **SUPERSEDED (partially)** | Was the cold-boot guide, baseline 2026-08-27/28, "338 tasks / 125 done", migration ceiling `0027`, and "What Is Next" = Vercel staging + manual acceptance + SERP-290..297. Replaced as the boot entry point by the Convergence Doctrine; retained as history. |
| 2 | `docs/EXECUTION_STATE.md` | **SUPERSEDED** | Written 30 Aug 2026; encodes "review-starved, not work-starved" as the principal fact and a board of 363 tasks. Still a true observation about the queue, but it is not the current development model. Historical. |
| 3 | `docs/CONVERGENCE_2026-08-30.md` | **HISTORICAL** | An unrelated, earlier "convergence" memo about branch/merge collisions on 30 Aug. **Name-collision hazard:** this is NOT the 28 Sep course correction. Retained as history. |
| 4 | `docs/roadmap/COMMERCIAL_READINESS_MASTER_ROADMAP.md` | **SUPERSEDED** | G1→G4 milestone roadmap, dated 2026-08-27, board "318 tasks / 120 done". Replaced for ERP completion sequencing by the ERP Process Closure Roadmap. Historical. |
| 5 | `docs/roadmap/BOARD_REPRIORITIZATION_2026-08-27.md` | **SUPERSEDED** | Prior reprioritization exercise. Historical. |
| 6 | `docs/roadmap/2026-09-03_MILESTONE_PROPOSAL_ELDER.md` | **SUPERSEDED** | Prior milestone proposal. Historical. |
| 7 | `docs/foundation/STARQ-ERP-OPERATING-PLAN.md` | **SUPERSEDED** | Pre-28-Sep operating plan. Historical. |
| 8 | `docs/foundation/STARQ-ERP-UNIFIED_BLUEPRINT.md` | **SUPERSEDED** | Pre-28-Sep blueprint. Historical. |
| 9 | `docs/architecture/overview.md` | **EXTENDED, not superseded** | The zero-trust / two-plane / append-only principles remain fully valid. Annotated with a pointer to the canonical transaction architecture. |
| 10 | `docs/architecture/accounting-model.md` | **EXTENDED, not superseded** | Double-entry invariant remains canonical. Annotated with the accounting-event layer requirement and the posting boundary. |
| 11 | `docs/development/testing.md` | **EXTENDED, not superseded** | Existing test architecture stands. Annotated with the process-acceptance requirement (scenario, negative, replay, concurrency, reversal, reconciliation). |
| 12 | `docs/development/migrations.md` | **EXTENDED, not superseded** | Migration discipline stands. Annotated with the three-part change rule (schema + consumer + fixture) and the canonical compatibility gate. |
| 13 | `docs/product/quality-gates.md` | **EXTENDED, not superseded** | L0–L3 gates stand. Annotated with the process-level completion standard as a higher gate. |
| 14 | `docs/product/principles/product-principles.md` | **CONFIRMED, not superseded** | Principle 1 "Accountant-Grade from Day One" is the founding statement of the corrected doctrine — accounting as the central consequence layer. Now governing. |
| 15 | `docs/product/requirements/requirement-registry.md` | **EXTENDED, not superseded** | Registry structure stands. Annotated that implementation status must be read through the process-chain roadmap. |
| 16 | `00_STARQ_HQ/operations/MASTER_CURSOR_PROMPT_BETA_EXECUTION_TOWER.md` | **SUPERSEDED on sequencing** | The role framework, seat mapping and governance maxims remain valid. The packet-sequencing model is superseded by the convergence doctrine: packets must serve process closure. |
| 17 | `00_STARQ_HQ/operations/ONBOARDING.md` | **EXTENDED** | Boot steps remain valid and are the universal entry point. **A new Step 0 was added** so every L1 discovers the 28 Sep correction before touching ERP work. |
| 18 | `00_STARQ_HQ/operations/MISSION_CONTROL_INDEX.md` | **EXTENDED** | New rows added pointing to the doctrine, roadmap and supersession record. |

---

## 3. The L1 discovery guarantee

The requirement was: *a fresh L1 booting any seat must discover the corrected doctrine
automatically, without the Founder explaining what happened.*

Three independent entry paths now lead to the correction:

1. **Universal agent onboarding** — `00_STARQ_HQ/operations/ONBOARDING.md` **Step 0** (added
   28 Sep 2026) states the hold and points to the doctrine, before any other step.
2. **Repo cold-boot** — `docs/START_HERE.md` and `docs/EXECUTION_STATE.md` both carry a
   supersession header naming the doctrine as the current entry point.
3. **Repo index** — `README.md` carries a doctrine banner, and
   `docs/governance/` and `docs/roadmap/` both contain the canonical files.

A fresh L1 following normal Dev Studio or StarqERP entry points encounters the corrected
doctrine at the first step, not by accident.

---

## 4. Preservation ledger — state that was NOT modified

- `main` and `origin/main` — unchanged (no rebase, no reset, no force).
- **SERP-354 stopped state** — all branches (`antigravity/serp-354-payment-commands`,
  `deadpool/serp354-payment-command-boundary`, `deadpool/serp354-serp356-ci`,
  `devin/serp354-payment-rls-regression`), commits, mappings, test work and Room evidence
  preserved. Board status left exactly as it was at the stop.
- All branches and worktrees, including dirty and prunable historical checkouts
  (`git worktree list` unchanged; nothing pruned).
- Devin's current payment-RLS work and **PR #166**.
- All existing decisions and evidence files.
- No history rewritten, no commits squashed, no cosmetic cleanup.

---

## 5. Unresolved contradictions

Found during validation, and **not** resolvable from repository evidence — surfaced rather
than guessed:

1. **DEC-107 is cited but not in the decision SSOT.** `docs/foundation/DEFINITION-OF-DONE.md`
   and `docs/governance/WAVE1_EXECUTION_RECORD_2026-08-30.md` both reference "DEC-107" as
   adopting the definition-of-done v0.2 on 2026-08-30. However
   `00_STARQ_HQ/decisions.json` contains only **DEC-001 … DEC-099**. Either DEC-100+ numbers
   are allocated in another store, or the citation is wrong. I did not invent a DEC-107
   record. DEC-100 was allocated for the course correction as the next free ID in the
   canonical store; if DEC-107 genuinely exists elsewhere, the numbering will need a
   Founder ruling.

2. **Multiple in-flight branches with overlapping SERP-354 intent** — four branches carry
   SERP-354 work, and the repo currently has a dirty working tree with modified CI and test
   files plus untracked SERP-088 test work. These were deliberately left untouched per the
   preservation directive. Which branch is the canonical continuation path is a Founder
   question, not a documentation one.

3. **`docs/START_HERE.md` migration ceiling is long stale** — it states the live ceiling is
   `0027`; the repo now has 61 migrations with the newest
   `202609271200_tenant_config_persistence.sql`. Annotated as historical rather than
   silently corrected, because the live staging ceiling is a live-environment fact this
   documentation round cannot verify.

---

**Room is the ledger.**
