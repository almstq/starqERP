# SERP-147 — BUG: jobs cannot advance past BOOKED

**Status:** done  
**Assignee:** Antigravity  
**Branch:** `main`  
**Date:** 25 Aug 2026

---

## What was delivered

1. **Eliminated Hardcoded Status Ladder**:
   - Replaced fixed status arrays in `JobDetailModal.tsx` with dynamic `workflowStages.map(s => s.name)` sourced from server-seeded stages.
   - Dynamic `nextStage` calculation enables sequential progression through all stages without command-name vs status-name mismatch errors.
2. **Dynamic Advance Action**:
   - Added `Advance to [nextStage.name]` quick-advance button naming the explicit destination stage.
3. **Automated Verification**:
   - Vitest test suite in `web/src/test/workflow_stages.test.ts` verifies full sequential step reachability.
