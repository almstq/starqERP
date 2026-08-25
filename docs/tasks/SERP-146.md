# SERP-146 — The app never shows the journey — 13 steps navigated through one button

**Status:** done  
**Assignee:** Antigravity  
**Branch:** `main`  
**Date:** 25 Aug 2026

---

## What was delivered

1. **Exact 13-Step Canonical Workflow Journey Stepper Component (`WorkflowStepRail.tsx`)**:
   - Displays all 13 canonical operational garage steps in sequence:
     1. `CALL` (Customer Call & Inquiry)
     2. `BOOKING` (Bay & Slot Booking)
     3. `INTAKE` (Vehicle Intake & Inspection)
     4. `ESTIMATE` (Parts & Labor Estimation)
     5. `AUTHORISATION` (Customer Work Authorisation)
     6. `JOB_CARD` (Work Order / Job Card)
     7. `PARTS_PROCUREMENT` (Parts Allocation & Procurement)
     8. `WORK` (Workshop Execution & Paint)
     9. `QC` (Quality Control & Sign-Off)
     10. `HANDOVER` (Vehicle Handover & Gate Pass)
     11. `INVOICE` (MIRA Tax Invoice Generation)
     12. `INVOICE_PAYMENT` (Payment Receipt & Settlement)
     13. `CLOSE` (Final Job Closure & Archival)
   - Every step validates directly against `COMMAND_SEATS[step.code]` from `contracts/commands.ts`.
   - Clear seat signpost:
     - Distinguishes when active user holds the required seat (`✓ You Hold Required Seat: [seat]`) vs when a different role is required (`Seat Required: [seat] ([Role Label])`).
     - Dynamic `Advance to [nextStage.name]` button.
2. **Embedded Across Work Order Interfaces**:
   - Integrated into both `JobDetailView.tsx` and `JobDetailModal.tsx`.
3. **Automated Verification**:
   - Vitest test suite in `web/src/test/workflow_step_rail.test.ts` asserts **exactly 13 steps** and exact equality against `COMMAND_SEATS`.
