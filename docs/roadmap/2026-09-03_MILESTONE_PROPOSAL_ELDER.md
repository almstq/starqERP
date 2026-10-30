<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document is SUPERSEDED and is retained as history only.**
>
> Prior milestone proposal. Do not use it to plan, implement, review or decide current StarqERP work.
>
> **Current development SSOT:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](../governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
> **Current roadmap:** [`ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`](ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md)
> **Supersession index:** [`SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md`](../governance/SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md)
>
> **What changed on 28 Sep 2026:** StarqERP development was stopped and the completion model
> was corrected from *complete the remaining modules* to *close the remaining business
> processes*. The five canonical ERP process chains are Order-to-Cash, Procure-to-Pay,
> Inventory-to-GL, Cash-to-Bank and Record-to-Report. This is **convergence, not rewrite** —
> all existing architecture, migrations, tests, evidence and completed tasks remain valid.
> **StarqERP implementation is ON HOLD** pending explicit Founder restart authorization.
>
> **Original content is preserved verbatim below.** Nothing was removed or rewritten.
>
---

# Milestone Proposal — Elder, 3 Sep 2026

**Requested by:** Founder, via Nexus bus seq #573 ("FOUNDER OPERATING RULE — PROGRESS PERCENTAGE + MEANINGFUL MILESTONES").
**Method:** Inspected the actual board (382 tasks), the locked strategy baseline, the Execution Bible, `decisions.json`, and the master vision arc before proposing anything. Full raw research is in the session record; this document is the synthesis.

**Governing instruction I'm following:** "Milestones must represent real capability or release readiness, not arbitrary task counts."

**Update, same day:** Founder approved (bus seq #581) proceeding with a dated SMART-goal calendar built on the four milestones below, using the approved planning-target windows from seq #581. That calendar is the "Dated SMART Calendar" section near the end of this document. Per the founder's own words: "These are now approved planning targets, not permission to bypass evidence, review, security, Founder, or deployment gates."

**Update, afternoon 03 Sep 2026 (per Cursor's independent review, bus seq #677):** everything named as still-open in Window 0 below has since closed on `origin/main`. SERP-241 re-certified PASS by VS Code (board commit `9f81a66`); SERP-351/394/395 merged (`c32cdf6`); SERP-382 Finding 1 merged and canonically closed (`04aaa0a`). Window 0 is done. Live board state as of this update: 162/382 done, 0 in_progress, 1 blocked (SERP-338, founder-only GCP action). The next canonical gates are SERP-339 and SERP-398, whatever Nexus routes from there. The body of this document below is left as written that morning — a dated snapshot, not silently rewritten — read the "Dated SMART Calendar" section's Window 0 against this update, not against its own original text.

---

## Zero — a fact that changes how to read this proposal

**The team does not need a new milestone vocabulary. It already has four, and they agree with each other.** The 24 Aug Final Blueprint's Phase 0–12 ladder (locked by DEC-073, made the sole phase vocabulary by DEC-074/083) is mirrored by the board's `phase`/`blueprint_phase` fields on every task. The 30 Aug Execution Bible's P0–P9 layer is explicitly a *sequencing* topology on top of the same phases, not a competing roadmap. The R0–R4 release-gate ladder and the Stage A–E certification ladder are both in the same locked document (§13/§14/§10 of the Final Blueprint). DEC-060 already defines the v1 ship line precisely.

So my job here isn't to invent milestones — it's to say, grounded in the actual board state today (156/382 done, 28 in_progress, 5 blocked), **which of the already-defined gates are next, in what order, and what's actually blocking them right now.**

**Two governance gaps found during this inspection, flagged before anything else, because they affect whether the milestones below can be trusted:**

1. **`00_STARQ_HQ/decisions.json` stops at DEC-094.** The board and the Execution Bible both cite decisions up to DEC-113 as binding — including DEC-103 (unreachable-feature classification authority) and DEC-111 (Elder disqualified from accepting own work), both of which are actively being relied on in this session's own conversations. 19 decisions are governing real work without being in the one file everyone is told is the SSOT for decisions. This needs founder attention independent of the milestone question.
2. **Minor board data hygiene**: "Phase 6" exists as two different literal strings (`"Phase 6 — Starq Switch Kit + external client #1"`, 11 tasks, and `"Phase 6 — External client #1"`, 1 task) — cosmetic, but worth a one-line fix so phase-based queries don't silently undercount.

---

## Milestone 1 — Clear the Review-Debt Backlog (P6, continuous gate)

**1. Name and purpose:** Close every task currently stalled on independent review/acceptance rather than on remaining work. This is not a phase in the roadmap sense — it's the standing DEC-072 gate ("no worker closes its own gate") applied to the current backlog, and it is the literal cause of every `blocked` task on the board today.

**2. Business/product outcome:** None directly — this milestone produces no new capability. Its value is that it is *actively load-bearing*: SERP-394 and SERP-395 (tenant-safe payment config identity, auditable activation evidence) cannot start until SERP-351 closes, and SERP-241 gates the entire Phase 11 release-candidate claim. Every day this sits open, downstream work queues behind it for no engineering reason.

**3. Task IDs and dependency order:**
- SERP-241 (Phase 11 exit gate — fresh clone build/test/scan) — **currently REJECTED** by VS Code's independent verification (7 test failures on current origin/main). PR #44 (the fix) is merged as of this session; VS Code's re-certification is the remaining step. No dependents.
- SERP-351 (payment provider registry/capability model) → gates SERP-394, SERP-395. PR #32 has my independent ACCEPT; rebase onto current main in progress (Vision); my re-review of the rebased head is the remaining step.
- SERP-300 third adversarial isolation run — referenced repeatedly in board `standing_rules` as still owed ("an inconclusive result is a failing result"); I don't have a task ID for the third run itself in the extracted list — Nexus should confirm whether this is tracked as its own task or folded into SERP-337 (RLS isolation taxonomy revalidation, currently in_progress).
- SERP-382 (Aikido independent triage, 6 High SAST findings) — Finding 1 (CI pin) still with Codex per earlier bus history; Findings 2–6 already ruled FALSE_POSITIVE by the founder.

**4. Entry criteria:** None — this work is already authorized and in flight. This milestone is a *closure* milestone, not a start-gate.

**5. Evidence/review/founder gates:** Each item already carries its own DEC-072 non-author-reviewer requirement (documented per-task in the board). No new gate needed — the ask here is sequencing discipline, not a new checklist.

**6. Exit criteria:** Zero tasks on the board in `blocked` status for review-debt reasons; SERP-241 re-certified green by VS Code; SERP-351/394/395 chain closed; SERP-382 fully dispositioned.

**7. Target board range:** This is small — 5 currently-blocked tasks plus their review overhead, not a range. Realistic to close within days given everything is already implemented and awaiting only review/merge cycles.

**8. Risk of pursuing out of order:** Low risk to skip *ahead* of this (nothing else structurally requires it to finish first), but every task queued behind SERP-351/241 stays stuck the longer it's deferred. This is a "clear the queue" milestone, not a "critical path" one — worth prioritizing for team throughput, not because later phases are blocked by it in aggregate.

---

## Milestone 2 — The v1 Ship Line (DEC-060)

**1. Name and purpose:** The first version of STARQ ERP that is actually usable as Starq's own bookkeeping system of record, per the founder's own re-cut of what "done" means (DEC-060, superseding DEC-057 same day).

**2. Business/product outcome:** This is literally "the first product" per DEC-031 ("what is Starq's first product and how do we know it's finished? — bookkeeping, as a module of the ERP"). It is the thing that makes STARQ ERP something other than a repository — a system a real business runs its books on.

**3. Task IDs and dependency order (from `milestones.v1` in the board, DEC-060's own line):**
- The five audit criticals — closed AND proven in effect **against the running system**, not just in the repository. (These map to the tasks tracked under the 30 Aug audit-remediation freeze, DEC-033.)
- The financial-control core: chart of accounts, double-entry ledger, AR/AP, GST, financial statements. On the board this is almost entirely **Stage 1 "Finance kernel"** (24 tasks) plus the finance-adjacent items currently `in_progress`: SERP-075 (tenant CoA/fiscal periods), SERP-077 (journal approval/posting/idempotency), SERP-309–311 (inventory valuation, landed cost, 3-way matching), SERP-316 (inter-book consolidation), SERP-341–346 (CoA taxonomy, statutory accounts, control validation, year-end close, finance-kernel acceptance gate — SERP-346 reads as the natural closing task for this whole cluster), SERP-339 (the UMBRELLA task explicitly named "finance-kernel integrity remediation," status `next`).
- Bookkeeping usable end-to-end for both tenants (Starq Technologies and Club Ignition) — this is a real, testable claim, not a feature list.
- Six weeks of Ignition Ink as system of record — explicitly **run on the Python portal, not blocked on the ERP rebuild** (the portal-coverage check already confirmed all ten counter-flow steps run there). This item does not block ERP engineering at all; it runs in parallel on different infrastructure.

**4. Entry criteria:** Milestone 1 substantially clear (a released financial core with open review debt on its own boundary work — SERP-351's payment config — undermines the "proven, not claimed" standard DEC-072 sets).

**5. Evidence/review/founder gates:** DEC-033's own standard applies — each of the five audit criticals needs a test proving it, not a statement. DEC-072's "claimed/committed/proven are different things" applies to the whole cluster. Founder sign-off is implied by DEC-060 itself as the authority that defines this line; no new founder gate needed beyond confirming the audit-criticals evidence when SERP-346 (finance-kernel acceptance gate) is ready to close.

**6. Exit criteria:** SERP-346 closes with the five audit criticals evidenced against the running system (not the repo), the Stage 1 finance-kernel cluster at zero open P0/P1 items, and a real month-end close demonstrated to tie out for at least one tenant (this is the Master Arc's own 2026 exit-line: *"something is applied to a database and proven in effect, then a month closes on the ERP"*).

**7. Target board range:** Stage 1 "Finance kernel" (24 tasks) + the ~13 finance-adjacent `in_progress`/`next` tasks named above — roughly 35–40 tasks is the realistic closure set for this milestone, not the full 382-task board.

**8. Risk of pursuing out of order:** High if skipped or rushed — this is the founder's own stated definition of "finished" for the first product (DEC-031/060). Shipping later phases (localization, AI, external clients) ahead of a proven financial core would put paying-customer trust on an unverified ledger. This is the actual critical path, not Phase-2's raw task count (107 tasks, but mostly security/domain gate closure already well underway, not the gating constraint DEC-060 names).

---

## Milestone 3 — Phase 5 Exit: 30-Day Real Internal Pilot (SERP-261)

**1. Name and purpose:** Prove STARQ ERP works as the system of record for a real, ongoing business — not a demo — for 30 *consecutive* days, with a successful restore drill.

**2. Business/product outcome:** This is the gate between "we built something" and "something works." It's also where the 24 Aug incident (a verified backup that failed to actually restore on Windows — `Filename too long`) gets closed out for real, not just documented.

**3. Task IDs and dependency order:** SERP-261 depends on SERP-254–260 (not expanded in this pass — Nexus/board should confirm their current status before this milestone is scheduled). Structurally sits after Milestone 2 (the financial core must exist and be trustworthy before a 30-day soak means anything).

**4. Entry criteria:** Milestone 2's exit criteria met — a month has already closed and tied out once under controlled conditions before attempting an uninterrupted 30-day run.

**5. Evidence/review/founder gates:** Per SERP-261's own acceptance criteria: a missing day resets the 30-day count (no partial credit); reconciliation checked at trial-balance, per-account, AND per-document level against the Python books (not just a topline match); the restore drill must be an actual restore, not a "verified" backup; cleared by someone other than the author (DEC-072 again); zero open money-touching item in the workaround register at close.

**6. Exit criteria:** Exactly as SERP-261 states it — 30 consecutive reconciled days plus a passed (not verified) restore drill, independently cleared.

**7. Target board range:** SERP-254–261 as a cluster (8 tasks by ID range), but the real "target" here is calendar time (30 consecutive days), not task count — this milestone cannot be accelerated by parallelizing engineering work.

**8. Risk of pursuing out of order:** Attempting this before Milestone 2 closes would produce a 30-day soak on an unproven ledger — the reconciliation would be meaningless. This is a hard sequential dependency, not a preference.

---

## Milestone 4 — Phase 6 Exit: First External Paying Client (SERP-272)

**1. Name and purpose:** The first customer who is not Club Ignition, pays, runs real production data, and survives a full billing cycle.

**2. Business/product outcome:** This is the actual "first sale" milestone — the Master Arc's own language: *"a business that is not Ignition Ink runs a month without Elder intervening."* This is also where SD's revenue thesis (starqNexus README/CLAUDE.md: ST builds, SD sells, CI proves) gets its second data point.

**3. Task IDs and dependency order:** SERP-272 depends on SERP-262–271 (not expanded in this pass). Structurally after Milestone 3 — a business shouldn't be onboarded onto a system that hasn't survived its own 30-day soak.

**4. Entry criteria:** Milestone 3 closed. Starq Switch Kit (Phase 6's other named deliverable, 11 tasks under the "Starq Switch Kit + external client #1" phase label) built and tested for onboarding a genuinely new tenant, not just Starq/CI's two existing configurations.

**5. Evidence/review/founder gates:** SERP-272's own acceptance criteria explicitly rule out three self-deceptions: "the friendly pilot that never invoices," "the client who kept using their old system for anything material," and "the demo that worked in week one." Requires an issued-and-paid invoice, no parallel legacy system in use, a closed period tying to the ledger, evidenced reconciliation, independent clearance.

**6. Exit criteria:** As SERP-272 states — invoice paid, full billing cycle survived, no parallel old system, independently cleared.

**7. Target board range:** SERP-262–272 cluster (11 tasks), plus the Switch Kit tasks under Phase 6 (11 tasks) — roughly 20 tasks, but real closure depends on finding and onboarding an actual paying customer, which is a commercial timeline, not an engineering one.

**8. Risk of pursuing out of order:** Very high — onboarding a second business before the first one (Starq itself, via Milestone 2/3) has proven the system trustworthy risks a real customer relationship on unproven ground, and directly contradicts the Master Arc's own sequencing.

---

## What runs in parallel vs. the critical path

**Critical path:** Milestone 1 (unblock the queue) → Milestone 2 (v1 ship line / financial core proven) → Milestone 3 (30-day soak) → Milestone 4 (first external client). Milestones 3 and 4 are hard-sequential by design (soak before sale); Milestone 2 must substantially precede both.

**Genuinely parallel, per the Execution Bible's own P2/P3/P5 structure:**
- Identity/tenant/command-boundary work (Starq Account, SERP-361–378 under SERP-E12) can run alongside Milestone 2's financial-core work — different subsystems, already flagged as parallel in the Bible.
- Security remediation (P5 — SERP-226 process, Aikido triage, the DEC-072-cited "F5 proof") is explicitly continuous and should not be treated as a phase to "finish" before others start.
- Phase 9's localization/module-breadth work (30 tasks) and Phase 10's controlled-AI work (10 tasks) are correctly held for 2027+ per the Master Arc's own gating language and should not be pulled forward regardless of available capacity — pulling them forward would violate the arc's stated entry gates (paying non-CI customer count, isolation proof) rather than accelerate anything real.

---

## Dated SMART Calendar (founder-approved planning targets, seq #581)

**All dates below are MVT (UTC+5). Planning targets, not authorized commitments — every gate below (evidence, independent review, Founder decision) still applies exactly as it does anywhere else in this document. A slipped date is information, not a violation.**

**Corrected against actual state as of this writing (13:44 MVT, 3 Sep 2026)** — the founder's suggested frame (seq #580/#581) was written before some of today's own closures landed. Noting the corrections inline rather than silently carrying stale status into a governance artifact.

### Window 0 — 03 Sep 2026: Control-Tower Reset

**Status note (added per GitHub Copilot review feedback, afternoon 03 Sep):** the exit-criteria bullets immediately below are a snapshot of what was true when this section was first drafted that morning, left unedited by design (see the "Update, afternoon 03 Sep 2026" note near the top of this document for why). By afternoon, all four items are closed. **Do not read the bullets below as current status — read the top-of-document update for that.**

- **Specific outcome:** One accurate snapshot of every active lane's owner, reviewer, and next evidence step; no stale Founder request sitting unanswered.
- **Measurable evidence / acceptance test:** A single message or doc listing, per active task, {owner, reviewer, next_action} with no gaps — this document plus the bus history from today's session already constitutes that evidence for the tasks it covers.
- **Accountable owner:** Elder (compiled this reset). **Independent reviewer:** Nexus (cross-checks against canonical SSOT — already doing this per seq #579).
- **Entry criteria:** None — this is where today started.
- **Exit criteria:** As of now, ALREADY MET for the four items the founder's suggested list named, corrected from what was still open when seq #580 was drafted:
  - PR #44 / SERP-241 exit certification — PR #44 **merged** (commit `9f81a66`), independently reviewed by Elder (ACCEPT) and reproduced independently (101/101 test files, 556/557 tests). **Remaining:** VS Code's post-merge clean-clone re-certification, still open — this is the one item from Window 0 that is NOT yet closed.
  - PR #32 / SERP-351 clean rebase/re-review — rebase in progress (Vision), Elder's rebased-head re-review is the next step once pushed. **Not yet closed.**
  - SERP-382 Finding 1 evidence — status not independently re-verified by me in this pass; last known state (earlier bus history) was with Codex for the CI-pin remediation. **Status needs a fresh confirmation from Codex, not assumed here.**
  - SERP-125 canonical persistence — **ALREADY DONE.** Merged (PR #43, commit `19afab6`, verified reachable on origin/main), board closed to `done` with `merge_commit: 19afab6`, closure pushed and verified on starqNexus `origin/master` (`5212e60`). Nothing further needed on this item.
- **Dependencies/parallel:** None of these four block each other; all four can close independently.
- **Recovery rule if slipped:** If VS Code's re-certification or Vision's rebase don't land by end of Window 1 (05 Sep), they roll into Window 1 rather than blocking Window 2's start — Window 2 (financial-control definition work) does not depend on either.

### Window 1 — 04–05 Sep 2026: Review-Debt Wave 1

- **Specific outcome:** Every currently review-ready or near-ready security/release gate closes without adding new feature scope.
- **Measurable evidence / acceptance test:** Per task — merged artifact + independent non-author acceptance + regenerated SSOT projection + verified remote persistence (the same four-part evidence standard already used today for PR #43/#44).
- **Accountable owner:** whoever authored each item (Vision for SERP-351/394/395, Codex for SERP-382 F1, AG/vscode for anything in their lanes). **Independent reviewer:** Elder, unless Elder authored the item, in which case a non-Elder reviewer per DEC-072 (this already happened correctly today with SERP-125/399, where AG reviewed Elder-adjacent work).
- **Entry criteria:** Window 0's open items (VS Code SERP-241 re-cert, Vision's PR #32 rebase) — this window is exactly where those two finish.
- **Exit criteria:** SERP-241 closed (VS Code independent PASS, not just PR #44 merged); SERP-351/394/395 chain closed; SERP-382 fully dispositioned (Finding 1 remediated + evidenced, Findings 2-6 already FALSE_POSITIVE per founder ruling); zero tasks in `blocked` status for review-debt reasons.
- **Dependencies/parallel:** SERP-394/395 are strictly sequential after SERP-351 (they depend on it). SERP-241 and SERP-382 are independent of the SERP-351 chain and of each other — all three lanes can run in parallel.
- **Founder gate:** None required unless a review surfaces a genuine design fork (as SERP-351's original scope note anticipated) — in that case, stop and escalate per standing practice, don't improvise.
- **Recovery rule if slipped:** If any one item isn't closed by end of 05 Sep, it does not block Window 2's *definition* work (which is planning/mapping, not implementation) but must close before Window 2's exit criteria (a founder-approved v1 checklist) can be considered final, since an open review-debt item on payment-provider tenant scoping is itself part of the financial-control surface.

### Window 2 — 06–12 Sep 2026: V1 Financial-Control Ship-Line Definition

- **Specific outcome:** A founder-approved checklist naming every task required to satisfy DEC-060's v1 line, with no item marked "implemented but unproven."
- **Measurable evidence / acceptance test:** The checklist itself, reviewed and approved by the founder, listing task IDs against each of DEC-060's four line items (five audit criticals / financial-control core / end-to-end bookkeeping for both tenants / Ignition Ink six-week soak status on the Python portal).
- **Accountable owner:** Elder (compiles the checklist, since this is a planning/mapping deliverable, not new implementation). **Independent reviewer:** Nexus (cross-checks the checklist against the live SSOT before it goes to the founder). **Founder gate:** yes — explicit approval of the checklist is the exit criterion itself, per DEC-060 being a founder-authored decision.
- **Entry criteria:** Window 1 substantially closed (see recovery rule above — an open payment-config review item is itself in-scope for this checklist, so it should be resolved or explicitly listed as a checklist line item if still open).
- **Exit criteria:** Founder signs off on the v1 checklist. This window does NOT require the underlying implementation work to be complete — only that every remaining task is identified, sequenced, and has no undocumented "believed done" status.
- **Dependencies/parallel:** Can start compiling in parallel with Window 1's tail end, since this is definition work, not a dependency of Window 1's closures. Identity/tenant-boundary work (Starq Account, SERP-E12) and continuous security remediation (P5) run in parallel with this whole window and do not block it.
- **Recovery rule if slipped:** If the checklist isn't founder-approved by 12 Sep, Window 3 (the actual proof run) does not start on schedule — this is a hard dependency, not a soft one, since starting a 30-day soak against an undefined v1 line would make the soak meaningless.

### Window 3 — 13 Sep 2026 onward: Phase 5 Proof-Run Entry (SERP-261)

- **Specific outcome:** 30 *consecutive* reconciled operating days plus one real (executed, not merely verified) restore drill.
- **Measurable evidence / acceptance test:** Per SERP-261's own acceptance criteria — trial-balance, per-account, AND per-document reconciliation against the Python books, every day; a missing day resets the count to zero; the restore drill must actually restore, not just report as verified (per the 24 Aug `Filename too long` incident); zero open money-touching item in the workaround register at close; cleared by someone other than the implementer.
- **Accountable owner:** whoever is operating the ERP day-to-day during the soak (likely Ali/founder for Starq Technologies' own books, per the "system of record" framing). **Independent reviewer:** a non-implementer per DEC-072 — Elder should not self-clear this given contribution history on the underlying finance-kernel tasks; AG, Vision, Codex, or vscode are eligible depending on who touched what.
- **Entry criteria:** Window 2's founder-approved v1 checklist fully implemented and closed — not just approved, *done*.
- **Exit criteria:** Exactly SERP-261's stated acceptance — 30 consecutive reconciled days, a passed restore drill, independent clearance.
- **Dependencies/parallel:** Strictly sequential after Window 2's implementation completes — this cannot be parallelized or accelerated by adding people, since it is a calendar-time soak, not an engineering task.
- **Founder gate:** Implicit — the founder is the one whose books are being soaked; any operational disruption during the 30 days is a founder-visible event by design.
- **Recovery rule if slipped:** A missing or unreconciled day resets the 30-day counter per SERP-261's own rule — this is not a "slip the date" situation, it's a "the clock restarts" situation, and that should be reported honestly rather than reframed as a schedule adjustment.

### Window 4 — After Phase 5 exit: Phase 6 Customer Pilot (SERP-272)

- **Specific outcome:** One external, non-Ignition-Ink paying client survives one complete billing cycle on STARQ ERP.
- **Measurable evidence / acceptance test:** Exactly SERP-272's stated criteria — an issued and paid invoice, no parallel legacy system in use for anything material, a closed period tying to the ledger, evidenced reconciliation, independent clearance. Explicitly excludes "the friendly pilot that never invoices," "the client who kept using their old system," and "the demo that worked in week one."
- **Accountable owner:** whoever owns commercial/customer-success responsibility (likely founder or Starq Dynamics, per the ST-builds/SD-sells model in CLAUDE.md) for sourcing and onboarding the client; engineering owner for the Switch Kit tasks (Phase 6, 11 tasks) is unassigned in the current board extract and should be named when this window opens.
- **Independent reviewer:** non-implementer per DEC-072, named when the window opens.
- **Entry criteria:** Window 3's exit criteria met (Phase 5 closed) — no external client onboarding before the system has proven itself on Starq's own books.
- **Exit criteria:** Exactly SERP-272's stated acceptance test above.
- **Dependencies/parallel:** Strictly sequential after Window 3. The Switch Kit build itself (11 tasks) can be built in parallel during Windows 2-3, since it's an onboarding-mechanism deliverable, not itself gated on the soak — only the act of onboarding a real client is gated.
- **Founder gate:** Yes — commercial terms, client selection, and pricing are founder/commercial decisions, not engineering ones.
- **Recovery rule if slipped:** This window has no fixed calendar target by design (the founder's own frame says "Phase 6 customer pilot only after Phase 5 exit," open-ended) — a slip here is a commercial-timeline fact, not an engineering failure, and should be reported as such.

---

## What I did not do

I did not invent a fifth vocabulary. I did not recompute the 40.8% figure — that's Nexus's job per the new operating rule, from the live SSOT, not from this document. I did not expand SERP-254–260 or SERP-262–271 in this pass (out of the requested scope, and better verified fresh by whoever schedules Milestones 3–4 rather than carried forward stale from this proposal). I did not resolve the DEC-095–113 gap — that's a founder-level SSOT question, flagged above, not mine to guess at.
