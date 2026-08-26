# Task Execution Report: SERP-163
## Roles as Data Over Seats & Precedence Invariant (Amendment A8)

- **Phase:** Phase 2 — Close the security/domain gates
- **Epic:** SERP-E10
- **Priority:** P0
- **Execution state:** Complete; ready for independent review
- **Implementation commit:** `e1cccd7`
- **Date:** 2026-08-25
- **Accountable owner:** Antigravity (`antigravity`)
- **Authority / Decisions:** DEC-065, DEC-067, DEC-068, DEC-072

---

## Scope & Implementation

Resolved Amendment A8 by decoupling administrative/UI module roles from the immutable seat authorization and segregation-of-duties matrix. Roles now manage UI visibility and permissions, while seats strictly govern command execution.

### 1. Schema & Migration ([`202608250015_roles_as_data.sql`](file:///d:/StarqTech/starqERP/supabase/migrations/202608250015_roles_as_data.sql))
- Updated `memberships.status` check constraint to support `'pending'` alongside `'active'`, `'suspended'`, `'ended'`.
- Created `public.roles` table (with organisation scoping, unique code per org, and composite foreign key support).
- Created `public.role_permissions` table (scoping permissions by module $\times$ action, e.g. `garage:admin`, `finance:view`).
- Added `role_id` to `public.memberships` referencing `public.roles(organisation_id, id)`.
- Implemented `app_private.seed_default_organisation_roles(target_org)` to seed the **10 Standard Base Roles**:
  1. `owner` (Full organisation ownership and administration)
  2. `admin` (System administration and user management)
  3. `financial_controller` (General ledger, statutory accounting, approvals)
  4. `counter_operator` (Customer intake, estimate delivery, billing)
  5. `technician` (Workshop job cards, repair work, parts consumption)
  6. `quality_inspector` (QC inspection, testing, final sign-off)
  7. `quartermaster` (Procurement, vendor quotations, RFQs)
  8. `receiver` (Goods receipt, inventory intake, warehouse checks)
  9. `payer` (Treasury, supplier payment disbursements, settlement)
  10. `auditor` (Read-only compliance, audit log inspection, statutory reporting)
- Seeded default roles for **Club Ignition** (`20000000-0000-4000-8000-000000000001`) and **Starq Technologies** (`10000000-0000-4000-8000-000000000001`).
- Enforced Row-Level Security on `roles` and `role_permissions`.

### 2. Invariant & Contract ([`contracts/commands.ts`](file:///d:/StarqTech/starqERP/contracts/commands.ts))
- Exported the verbatim Amendment A8 Precedence Invariant:
  > *"A role may make an action visible or generally available. A role can NEVER suppress, alter, back-date, delete or silently self-dispose a segregation-of-duties exception, and a role can NEVER determine whether a pair blocks or records — that follows from the organisation’s segregation capacity, not from permission."*
- Exported `MEMBERSHIP_STATUSES`, `STANDARD_ROLE_CODES`, `RoleRecord`, `RolePermissionRecord`, `MembershipRecord`.
- Implemented `validateRoleActionVisibility(membership, permissions, module, action)` to ensure pending memberships and unauthorized roles cannot access modules.

---

## Verification & Conformance Evidence

- **SQL Test Probe ([`tests/roles_as_data_probe.sql`](file:///d:/StarqTech/starqERP/tests/roles_as_data_probe.sql)):** Verified 10 seeded base roles per tenant, `memberships.status` accepting `'pending'`, and role permissions linking.
- **Deno Contract Test Suite (`tests/contract/commands_test.ts`):** **57/57 passed**.
- **Python Seat Matrix Tests:** **10/10 passed**.
- **Python Document Numbering Tests:** **6/6 passed**.
