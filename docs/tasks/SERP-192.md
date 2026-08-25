# SERP-192 — Dead-code sweep and repository quality assurance

**Status:** done  
**Assignee:** Antigravity  
**Branch:** `main`  
**Date:** 25 Aug 2026

---

## What was delivered

Executed full dead-code sweep across `starqERP/web/src` and `agent-comms/tmp/` satisfying all acceptance criteria under DEC-077 and Rule 2 (never delete; preserve in `_recyclebin` with rationale):

1. **Web Component Sweep**:
   - Scanned all 53 TypeScript/React source files in `web/src`.
   - Verified that all active components are reachable from application routes.
   - Retired superseded legacy layout files (`Header.tsx`, `Sidebar.tsx`) to `_recyclebin/components_layout/` with explanatory README.
   - Confirmed `App.tsx` (superseded 10-view tab router) and `InvoiceDetailModal.tsx` (legacy modal with hardcoded statutory fields) were eliminated from active bundle and replaced by clean routes and statutory tax engine.
2. **Agent-Comms Temporary Scripts Sweep**:
   - Swept 15 one-off `send_*.mjs` scripts from `agent-comms/tmp/` to `agent-comms/_recyclebin/send_scripts/`.
3. **Automated Verification**:
   - Vitest suite: **18/18 PASS**.
   - Vite production build: Clean build in 11.18s.
   - Deno contract suite: **99/99 PASS**.
