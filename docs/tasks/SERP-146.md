# SERP-146 — The app never shows the journey — 13 steps navigated through one button

**Status:** done  
**Assignee:** Antigravity  
**Branch:** `main`  
**Date:** 25 Aug 2026

---

## What was delivered

1. **13-Step Workflow Journey Stepper Component (`WorkflowStepRail.tsx`)**:
   - Displays all canonical garage pipeline steps with current position clearly marked (Done, Active pulsating, Next).
   - Annotates each step with its authoritative required seat (e.g. `counter`, `estimator`, `technician`, `qc_signer`).
   - Provides clear seat signpost:
     - Distinguishes when the active user holds the required seat (`✓ You Hold Required Seat: [seat]`) vs when a different role is required (`Seat Required: [seat] ([Role Name])`).
     - Provides dynamic `Advance to [nextStage.name]` button.
2. **Embedded Across Work Order Interfaces**:
   - Integrated into both `JobDetailView.tsx` and `JobDetailModal.tsx`.
3. **Automated Verification**:
   - Vitest test suite in `web/src/test/workflow_step_rail.test.ts` verifies all step seat mappings against `COMMAND_SEATS`.
