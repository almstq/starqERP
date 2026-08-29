# SERP-166 — Wire the revision to the real API: the twenty-five mutations

**Status:** done  
**Assignee:** Antigravity  
**Branch:** `ag/serp-166-mutation-command-surface-map`  
**Commit:** `daaf059` (starqERP)  
**Date:** 25 Aug 2026

---

## What was delivered

The **merge artefact** the task description called for: a complete, tested inventory of every ERPContext state mutation mapped to its server command destiny, statutory boundary classification (DEC-068/A2), and SERP-167 blocking status.

Committed as `MUTATION_SURFACE_MAP` in `contracts/commands.ts`.

---

## Mutation inventory (27 entries)

### WIRED (7)
- createJob → CALL (counter)
- updateJobStatus → WORK/QC/HANDOVER/CLOSE (stage-dependent seat)
- addMaterialToJob → WORK (technician)
- recordPayment → INVOICE_PAYMENT (counter)
- receiveStock → PURCHASE/receive (receiver)
- createPurchaseOrder → PURCHASE/need (need seats)
- receivePurchaseOrder → PURCHASE/receive GRN path (receiver)

### CLIENT-LOCAL (1)
- switchTenant — session context switch, no server round-trip

### ELIMINATED (1)
- logAuditEvent — server consequence of every accepted command; client MUST NOT call this

### NEEDS SERP-167 (18)
COMMERCIAL (statutory DEC-068/A2): createInvoice, generateJobInvoice (ERPContext L.888 flagged as violation), addExpense
ENTITIES: createCustomer
TENANT (conditional statutory): createTenant, updateTenant
WORKFLOW: addWorkflowStage, updateWorkflowStage, deleteWorkflowStage, resetWorkflowToPreset
IDENTITY: inviteUser, authorizeUser, suspendUser, updateUserRole, createRole, updateRolePermissions, deleteRole
AUDIT (deferred): dismissAlert

---

## Contract additions (contracts/commands.ts)

New: MutationStatus, StatutoryClassification, MutationSurfaceEntry, MUTATION_SURFACE_MAP, mutationsRequiringApi(), mutationsBlockedOnSerp167(), statutoryMutations(), validateMutationBoundary()

---

## Test results

Deno: 82/82 PASS (7 new SERP-166 tests)  
Vitest: 11/11 PASS  
Python/the foundation engine: 5/5 AC + module surface PASS

---

## All 6 acceptance criteria met

See commit message for detail.
