# StarqERP Board Hygiene & Multi-Agent Operating Standard

**Date:** 25 August 2026  
**Authority:** Founder & Managing Director Directive  
**Status:** CANONICAL OPERATING STANDARD (MANDATORY FOR ALL AGENTS & COLLABORATORS)  
**Applicability:** Antigravity, Elder (Claude), Codex, Cursor, Hermes, VS Code, Human Engineers

---

## The 10 Board Governance & Hygiene Rules

1. **One accountable owner per active task.**  
   Agent capability tags are not ownership. Any task in `in_progress` must identify the agent currently responsible for closing it.

2. **Control WIP.**  
   Do not keep opening tasks while existing work remains unfinished. Aim for a small active set; close/review work before pulling more.

3. **Maintain `Next Up`.**  
   It should contain a deliberately prioritised shortlist of the next few tasks, not sit at zero while hundreds remain in To Do. Agents should pull from this queue rather than freely choosing from the backlog unless a dependency/defect requires otherwise.

4. **Status must mean exactly what it says:**  
   - `todo` = accepted backlog, not started  
   - `next_up` = prioritised and ready  
   - `in_progress` = actively owned and being worked  
   - `blocked` = cannot proceed; blocker/dependency must be recorded  
   - `done` = implementation complete with required tests/evidence and no known unresolved acceptance issue  

5. **Do not mark work Done merely because code was written.**  
   Record branch/commit, tests/probes, acceptance evidence, and whether independent review is still pending. If review is mandatory, make that state visible rather than calling it fully complete.

6. **Never silently overwrite another agent's task state, priority, scope or ownership.**  
   Reconcile conflicting changes and preserve provenance.

7. **Avoid duplicate tasks.**  
   Search the board before creating a new one; update/link the existing task where appropriate.

8. **Keep dependencies explicit.**  
   Parent/child relationships, prerequisites and blockers should be recorded so agents do not execute tasks out of sequence.

9. **Keep task notes factual.**  
   Separate implemented, tested, reviewed, merged and deployed states. No promotional language or inflated claims in evidence/status notes.

10. **Founder priorities override autonomous queue selection.**  
    If the founder redirects work, reflect that on the board immediately so every other agent sees the same operating reality.

---

## Dedicated Milestone: CI Pilot Readiness

In addition to programme-wide progress across the full 263-task horizon, the StarqNexus board exposes a dedicated **CI Pilot Readiness** view tracking the minimum safe vertical path required to put Club Ignition / Ignition Ink live at H. Kiev.
