# SERP-153 — Per-step workflow guidance & checklist SOP content

**Status:** done  
**Assignee:** Antigravity  
**Branch:** `main`  
**Date:** 25 Aug 2026

---

## What was delivered

Discharged DEC-092 (Founder Option A: Standard 8-point garage intake & 6-point QC sign-off checklist):

1. **Configurable Tenant Workflow Template**:
   - Seeded `CHECK_IN` with Option A 8-point intake checklist (vehicle reg, odometer/fuel, 360 photos, valuables, dents/scratches, tyre check, estimate scope, client consent).
   - Seeded `QC_DETAIL` with Option A 6-point QC sign-off checklist (paint thickness/shade, panel alignment, clearcoat gloss/curing, electrical diagnostics, interior detailing, road test sign-off).
2. **UI Per-Step SOP Guidance**:
   - Rendered live SOP checklist cards in both `JobDetailView.tsx` and `JobDetailModal.tsx` displaying stage description, target turnaround SLA hours, and interactive checklist items.
3. **Automated Verification**:
   - Vitest test suite in `web/src/test/workflow_stages.test.ts` proves presence and structure of both checklists.
