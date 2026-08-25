# StarqERP — Phase 2 Execution & Architecture Plan

**Date**: 24 August 2026  
**Author**: Antigravity (Frontend & Client Lead)  
**Authority**: DEC-072, DEC-073, DEC-082, DEC-089  
**Status**: IN PROGRESS (Phase 2)  
**SSOT Taskboard**: `starqNexus/data/starq-erp-tasks.json` (51 done of 262)

---

## 1. Executive Summary & Goals

Phase 2 focuses on **Authorization, Multi-Tenant Session Hardening, and Core API Foundations**.
Following the successful completion of the truthful surface (Phase 1) and the generalization of Edge security boundaries (**SERP-161**, **SERP-178**, **SERP-023**), Phase 2 wires the hardened client surface to authenticated API endpoints while maintaining strict separation of duties and multi-tenant isolation.

---

## 2. Completed Phase 2 Milestones

| Task ID | Priority | Title | Commit | Summary |
| :--- | :---: | :--- | :---: | :--- |
| **SERP-161** | **P0** | **Generalise Security Boundary** | `4631dc8` | Removed static `CLUB_IGNITION_ID` constant; dynamic session organization resolution wired in Edge API. |
| **SERP-178** | **P0** | **Privileged Path Inventory** | `d9aa599` | Audited all 7 `SECURITY DEFINER` functions; verified RPC functions restricted to `service_role` only. |
| **SERP-023** | **P1** | **STARQ ERP Brand Baseline** | `4631dc8` | Standardized application chrome to **StarqERP** with dynamic workspace title rendering. |

---

## 3. Standing Phase 2 Work Streams & Game Plan

### Stream A: Core Security & Session Persistence
1. **SERP-001 (P0)** — *Cloud-client connectivity preflight & session health*:
   * Implement automated preflight connection checks between web client and Edge Gateway (`/health`, `/api/meta`).
   * Verify HTTPS-only cookie exchange with `SameSite=Lax` / `SameSite=Strict` and CSRF token binding.
2. **SERP-026 (P0)** — *Server identity & secure session boundary*:
   * Ensure session rotation upon privilege elevation (e.g. switching between `counter` and `financial_controller` seats).
   * Enforce idle session expiration (8-hour maximum lifetime).
3. **SERP-027 (P0)** — *Client secure session persistence*:
   * Verify session token resilience across page reloads and browser tab closures without writing sensitive tokens to `localStorage`.

### Stream B: Tenant-Scoped Database Foundation
1. **SERP-002 (P0)** — *Dual-tenant organisation, outlet, and module schema*:
   * Verify database seed isolation between **Club Ignition** (Automotive Tint/Wrap/Bodywork) and **Starq Marine / Starq Tech** tenants.
2. **SERP-029 (P0)** — *Tenant-scoped PostgreSQL foundation*:
   * Audit all database queries and ensure `organisation_id` filtering is strictly enforced via RLS and function parameters.
3. **SERP-030 (P0)** — *Role, seat, and separation-of-duties policy engine*:
   * Enforce the 12-seat matrix and illegal SoD pairings in PostgreSQL triggers and business logic (e.g. self-approval prevention on invoices and purchase orders).

### Stream C: Versioned API, Error Handling & Idempotency
1. **SERP-031 (P0)** — *Versioned API & idempotency contract*:
   * Verify atomic replay of identical requests using `idempotency_key` without duplicate document creation.
   * Reject conflicting payloads sharing an existing idempotency key with `409 Conflict`.
2. **SERP-034 (P0)** — *Append-only audit & outbox foundation*:
   * Ensure every state change (job creation, stock adjustment, invoice issuance, payment recording) produces an immutable audit record.

---

## 4. Verification & Testing Protocol

Every completed task in Phase 2 must adhere to **DEC-072** (*Claimed, Committed, and Proven*):
1. **Contract Tests**: Pass all Deno contract tests (`deno test --allow-read tests/contract/`).
2. **Database Seat Matrix Tests**: Pass Python SQL parser tests (`python tests/test_seat_matrix.py`).
3. **Concurrency Tests**: Pass 100-thread document numbering concurrency suite (`python tests/test_document_numbering.py`).
4. **Compiler Cleanliness**: `npx tsc --noEmit` must remain at **0 errors**.
5. **Taskboard Update**: Update `starqNexus/data/starq-erp-tasks.json` with commit hash and completion proof.
