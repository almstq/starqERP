# Task Execution Report: SERP-030
## Role, Seat and Separation-of-Duties Policy Engine

- **Phase:** Phase 2 — Close the security/domain gates
- **Priority:** P0
- **Execution state:** Complete
- **Date:** 2026-08-26
- **Accountable owners:** Codex / Antigravity
- **Requirements:** CORE-001, CORE-002, RBAC-001, SOD-001

---

## 1. Scope & Architecture

Delivered the authoritative Role, Seat, and Separation-of-Duties (SoD) policy engine establishing strict separation between role visibility (what you SEE) and seat execution authority (what you DO), while providing honest solo-operator compensation and segregated capacity enforcement with temporary override auditing.

Key components:
1. **Role Visibility vs Seat Authority ([`contracts/commands.ts`](file:///d:/StarqTech/starqERP/contracts/commands.ts)):**
   * Implemented `evaluateRoleVisibility` mapping user roles (`owner`, `administrator`, `general_manager`, `accountant`, `workshop_manager`, `technician`, `counter`, `viewer`) to UI capability domains (reports, accounting ledger, commercial documents, inventory stock, audit logs, settings) per SERP-156.
   * Preserved seat execution gates (`seats gate what you DO` via `authorizeCommand` and `seatsForCommand`).
2. **SoD Policy & Operating Capacity Evaluation:**
   * Implemented `evaluateSodPolicy` evaluating:
     * **Segregated Capacity:** Automatically allows steps executed by distinct actors; strictly blocks same-person execution on conflict pairs (`quote` $\leftrightarrow$ `award`, `award` $\leftrightarrow$ `pay`, `receive` $\leftrightarrow$ `match`).
     * **Solo Capacity:** Honestly allows one-person workflows while recording an attributable compensating exception record (`disposition: 'exception_recorded'`).
     * **Temporary Overrides:** Supports approved temporary overrides requiring $\ge 12$ character justifications and enforcing active expiry windows (`expiresAt`).
3. **Attributable Audit Evidence:**
   * All policy evaluations produce structured audit records (`allowed_cleanly`, `exception_recorded`, `blocked_sod_violation`) with timestamps and actor attribution.

---

## 2. Automated Test Evidence

* **Web Vitest Suite (`web/src/test/serp_030_role_seat_sod_engine.test.tsx`):**
  * `✓ distinguishes role visibility (what you SEE) per role`
  * `✓ permits clean segregated execution when different actors perform pair steps`
  * `✓ compensates in solo capacity with recorded exception evidence`
  * `✓ blocks SoD conflict in segregated capacity when no override exists`
  * `✓ honors valid temporary override and rejects expired override`
  * Total web suite: `24 test files passed | 93 tests passed`.
* **Deno Contract Suite (`tests/contract/commands_test.ts`):**
  * Added 3 contract tests covering role visibility gating, solo capacity compensation, segregated blocking, and override expiry.
  * Total: `145 passed | 0 failed`.
* **Hardcoding Sweep:** `PASS (0 violations)`.
* **Migration 0021 Rehearsal Test:** `PASS (5/5 checks passed)`.
* **Vite Production Build:** Clean build with 0 errors.

---

## 3. Files Created & Modified

- `contracts/commands.ts` (Modified): Added `evaluateRoleVisibility`, `evaluateSodPolicy`, `AppRole`, `RoleVisibilityMatrix`, and `TemporarySodOverride`.
- `supabase/functions/_shared/commands.ts` (Modified): Synced from contracts.
- `web/src/test/serp_030_role_seat_sod_engine.test.tsx` (New): Vitest suite.
- `tests/contract/commands_test.ts` (Modified): 3 Deno contract tests.
- `docs/tasks/SERP-030.md` (New): Task report.
