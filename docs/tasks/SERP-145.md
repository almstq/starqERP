# SERP-145 — UX — the seat signpost exists on job cards and is missing on the empty bay

**Status:** done  
**Assignee:** Antigravity  
**Branch:** `main`  
**Date:** 25 Aug 2026

---

## What was delivered

1. **Empty-Bay Intake Seat Signpost**:
   - Updated `CreateJobModal.tsx` to check active user role permissions before allowing job creation.
   - If user does not hold the required seat (`counter`, `sales`, `manager`, or `owner`), displays amber signpost: `⚠️ Bay Intake Locked: Required seat is counter (or Service Advisor / Managing Director). Switch acting-as seat to proceed.`
   - Disables submit button with clear feedback.
2. **Automated Verification**:
   - Vitest suite in `web/src/test/workflow_step_rail.test.ts` tests and asserts seat gating.
