# Round 1 Foundation Remediation — Integration Map

**Date**: 2026-08-27  
**Scope**: Authoritative persistence, tenant isolation, auth/session, durable numbering, financial integrity, audit integrity  
**Constraint**: Reuse existing backend/database/contracts/migrations. Do not create parallel architecture.

---

## Executive Summary

The starqERP backend has a **solid foundation** with 22 migrations, ~35 tables, RLS on every table, tenant isolation via `has_organisation_access()`, an Edge Function with Google OAuth + session cookies + CSRF, idempotency infrastructure, audit infrastructure, and document sequences. However, the **web client is entirely client-side** with no backend calls, and several SERP-167 commands are stubs that don't persist.

**Round 1 Goal**: Wire the web client to the existing authoritative backend and fix the stub commands to actually persist data.

---

## Finding → Foundation → Integration → Proof Map

### 1. AUTHORITATIVE PERSISTENCE

| Finding | Existing Foundation | Chosen Integration | Acceptance Proof |
|---------|-------------------|-------------------|------------------|
| **Web client uses localStorage/React state for all domain data** (customers, jobs, invoices, payments, expenses, inventory, stock_movements, suppliers, POs, users, roles, workflow_stages, audit_logs) | **Tables exist**: `contacts` (customers/suppliers), `garage_jobs`, `commercial_documents` (invoices/expenses/POs), `inventory_items`, `stock_movements`, `settlement_allocations` (payments), `roles`, `role_permissions`, `workflow_templates`, `workflow_stages`, `audit_events` | **Wire web client to Edge Function**: Replace `apiGateway.ts` client-side dispatch with real `fetch()` to `/api/ops/event`. Update `ERPContext.tsx` CRUD actions to call backend commands (CUSTOMER, JOB_CARD, INVOICE, EXPENSE, PURCHASE, INVOICE_PAYMENT, MEMBER_INVITE, ROLE, WORKFLOW). Remove localStorage persistence for domain data (keep only for UI preferences like theme). | **Test**: Create customer via UI → refresh browser → customer still present. Create invoice → refresh → invoice still present. Verify data survives device/session change by checking Supabase dashboard. |
| **Document numbering uses array.length** (produces duplicates after refresh) | **`document_sequences` table** + `allocate_document_no()` function (SECURITY DEFINER, atomic increment) | **Use `allocate_document_no()`**: Edge Function commands (INVOICE, EXPENSE, JOB_CARD, PURCHASE) call `allocate_document_no(org_id, doc_type)` to get formatted number (e.g., `CI-INV-0001`). Web client receives number in response. | **Test**: Create 3 invoices → verify numbers are `CI-INV-0001`, `CI-INV-0002`, `CI-INV-0003`. Refresh → create another → verify `CI-INV-0004` (no duplicate). Concurrent creation test: two users create invoices simultaneously → both get unique numbers. |

### 2. REAL TENANT ISOLATION

| Finding | Existing Foundation | Chosen Integration | Acceptance Proof |
|---------|-------------------|-------------------|------------------|
| **Zero data isolation in web client** (all domain data is global React state, no tenantId filtering) | **RLS on every table** via `has_organisation_access(organisation_id)` or `organisation_id = app_private.current_organisation_id()`. Session sets `app.current_organisation_id()` from membership. | **Server-side enforcement**: Web client sends commands to Edge Function → Edge Function uses session's `current_organisation_id` → RLS policies enforce isolation. No client-side filtering needed (server is authoritative). | **Test**: Login as user in Org A → create customer → login as user in Org B → verify Org A customer not visible. SQL injection test: try to query Org A data from Org B session → RLS blocks. |
| **No tenant switcher UI** | **`/api/auth/seat` endpoint** switches acting seat (not tenant). Tenant switching requires re-authentication with different org membership. | **Implement tenant switcher**: Add dropdown in AppShell header listing user's org memberships (from `/api/me` response). On switch, call `/api/auth/switch-org` (new endpoint) or re-authenticate. | **Test**: User with memberships in 2 orgs → switch between orgs → verify data changes. Verify switching org changes `current_organisation_id` in session. |

### 3. AUTHENTICATION / SESSION / MFA

| Finding | Existing Foundation | Chosen Integration | Acceptance Proof |
|---------|-------------------|-------------------|------------------|
| **No login screen — app opens as Super Admin** | **Google OAuth** in Edge Function (`/api/auth/google`), session cookie (`sb_ops`), CSRF token, allowlist via `STARQBOOKS_ALLOWLIST_JSON` env var. | **Add login gate**: Web client checks for session cookie on load. If absent, redirect to `/login` page with "Sign in with Google" button. On auth success, store session cookie (HttpOnly, set by server). | **Test**: Open app without session → redirected to login. Sign in with Google → session cookie set → app loads. Logout → cookie cleared → redirected to login. |
| **No logout button** | **`/api/auth/logout` endpoint** destroys session. | **Add logout button**: AppShell header user menu → "Logout" → calls `/api/auth/logout` with CSRF → clears session → redirects to login. | **Test**: Click logout → session destroyed → redirected to login → cannot access app without re-auth. |
| **MFA is simulated** (hardcoded secret, accepts any 6-digit code) | **No MFA infrastructure exists** in backend. | **Mark MFA as simulation-only**: Remove "MFA" branding. Rename to "Demo PIN" or remove entirely. Add clear disclaimer: "This is a demo environment. MFA is not enabled." Do not present as security. | **Test**: UI shows disclaimer. No "MFA" text appears. If PIN challenge exists, it's labeled "Demo PIN" not "MFA". |

### 4. DURABLE NUMBERING / IDEMPOTENCY

| Finding | Existing Foundation | Chosen Integration | Acceptance Proof |
|---------|-------------------|-------------------|------------------|
| **Document numbering produces duplicates** (array.length-based) | **`document_sequences` table** + `allocate_document_no()` (atomic, per-org, per-type) | **Wire `allocate_document_no()`**: Edge Function commands call it. Web client receives number in response. Remove client-side numbering logic. | **Test**: Create invoice → verify number from backend. Refresh → create another → verify next number. Concurrent test: two users create invoices → both get unique numbers. |
| **Idempotency is client-side only** (in-memory Map) | **`idempotency_keys` table** (per-org, composite PK, 7-day expiry, request_hash validation) | **Wire idempotency**: Web client generates UUID idempotency key → sends in `x-idempotency-key` header → Edge Function checks `idempotency_keys` → returns stored response if replay. Client persists key in localStorage until response received. | **Test**: Create invoice with idempotency key → refresh → retry same request → verify same response (replay). Different payload with same key → verify 409 conflict. |

### 5. FINANCIAL INTEGRITY

| Finding | Existing Foundation | Chosen Integration | Acceptance Proof |
|---------|-------------------|-------------------|------------------|
| **CreateInvoiceModal hardcodes GST to zero** | **`tax_registrations` table** (per-org GST status + TIN), **`tax_rate_schedules`** (effective-dated rates) | **Read tenant GST status**: Edge Function reads `tax_registrations` for org → if registered, applies 8% GST from `tax_rate_schedules`. Web client displays GST line if registered. | **Test**: Org with GST registered → create invoice → verify GST calculated (8%). Org not registered → create invoice → verify no GST. Verify GST amount matches `tax_rate_schedules` effective rate. |
| **Overpayment silently accepted** | **`settlement_allocations` table** (payment-to-document allocation, append-only) | **Validate allocation**: Edge Function INVOICE_PAYMENT command checks `payment_amount <= document.unallocated_balance`. Rejects if overpayment. Web client shows error. | **Test**: Invoice balance 10,000 → try to record payment 15,000 → verify rejected with error. Record payment 10,000 → verify balance becomes 0. |
| **recordPayment doesn't update job status** | **`garage_jobs` table** has `status` column (13-state lifecycle). **`job_events`** append-only log. | **Update job status**: Edge Function INVOICE_PAYMENT command checks if invoice fully paid → updates linked job status to "Paid" → writes job_event. | **Test**: Create job → create invoice → record full payment → verify job status = "Paid" and job_event logged. |
| **receivePurchaseOrder marks PO as Paid without reducing supplier outstandingPayable** | **`commercial_documents`** has `allocated_total`, `unallocated_balance`. **`settlement_allocations`** tracks payments. | **Separate receipt from payment**: PURCHASE receive step marks PO as "Received" (not "Paid"). Separate PAY step creates settlement_allocation reducing `unallocated_balance` and updates supplier `outstanding_payable`. | **Test**: Create PO → receive goods → verify PO status = "Received", supplier outstanding unchanged. Record payment → verify supplier outstanding reduced. |
| **Supplier outstandingPayable inconsistent with PO totals** | **`contacts`** (suppliers) has `outstanding_payable` column. **`commercial_documents`** (POs) has `unallocated_balance`. | **Compute dynamically**: Supplier outstanding = SUM(PO.unallocated_balance) for that supplier. Edge Function computes on read. | **Test**: Create 2 POs for supplier (10k, 15k) → verify outstanding = 25k. Pay one PO (10k) → verify outstanding = 15k. |
| **Financial rounding** (generateJobInvoice produces unrounded fractional cents) | **`commercial_document_lines`** has `unit_price`, `quantity`, `line_total` (all numeric(18,2)). | **Round to 2 decimals**: Edge Function INVOICE command rounds `line_total = ROUND(unit_price * quantity, 2)`. `document_total = SUM(line_total) + GST`. | **Test**: Create invoice with line items → verify all amounts rounded to 2 decimals. Verify total = sum of lines + GST. |

### 6. AUDIT INTEGRITY

| Finding | Existing Foundation | Chosen Integration | Acceptance Proof |
|---------|-------------------|-------------------|------------------|
| **Audit logs hardcode fake IP address** (`123.231.104.18`) | **`audit_events`** table has `actor_person_id`, `acting_seat`, `action`, `object_type`, `object_id`, `request_id`, `before_state`, `after_state`, `metadata`. No IP column. | **Remove IP field**: Edge Function writes audit_events without IP. Web client displays audit log without IP column. If IP needed, capture from request headers (X-Forwarded-For) at Edge Function boundary. | **Test**: Create invoice → verify audit_event logged with actor, action, object, timestamp. Verify no hardcoded IP. Query audit_events → verify all entries have real actor_person_id. |
| **Audit logs mix tenants** (no tenant filtering) | **`audit_events`** has `organisation_id` column. RLS policy enforces `organisation_id = app_private.current_organisation_id()`. | **Server-side filtering**: Edge Function queries audit_events with session's `current_organisation_id` → RLS enforces isolation. Web client displays only current org's audit events. | **Test**: Login as Org A user → create invoice → verify audit_event has org_id = Org A. Login as Org B user → verify Org A audit events not visible. |
| **Seeded audit logs are fabricated** | **`audit_events`** is append-only. Seed data should not exist. | **Remove seeded audit logs**: Delete `INITIAL_AUDIT_LOGS` from `mockData.ts`. Web client starts with empty audit log. Real audit events created by backend commands. | **Test**: Fresh install → verify audit log empty. Create customer → verify one audit event. Create invoice → verify two audit events. |

---

## Implementation Plan

### Phase 1: Fix Backend Stubs (Migration 0023)

1. **Fix column mismatches** in SERP-167 commands:
   - `INVOICE`: Use `document_no` not `document_number`. Add `allocated_total`, `unallocated_balance` columns to `commercial_documents` or use existing columns.
   - `EXPENSE`: Same as INVOICE.
   - `CUSTOMER`: Use `kind` not `type`. Remove `billing_address` reference.

2. **Wire journal posting** for INVOICE/EXPENSE:
   - INVOICE: Debit Accounts Receivable, Credit Revenue, Credit GST Output.
   - EXPENSE: Debit Expense, Credit Accounts Payable (or Bank if paid).
   - Use `journal_proposals` → `journal_entries` flow.

3. **Wire settlement allocations** for INVOICE_PAYMENT:
   - Create `settlement_allocations` row linking payment to invoice.
   - Update `commercial_documents.unallocated_balance`.
   - Update job status if invoice fully paid.

4. **Wire supplier payment**:
   - Add PAY_SUPPLIER command.
   - Create `settlement_allocations` row linking payment to PO.
   - Update `contacts.outstanding_payable`.

5. **Implement stub commands**:
   - `WORKFLOW`: Write to `workflow_templates` / `workflow_stages`.
   - `MEMBER_INVITE`: Write to `memberships` + send email (or stub).
   - `MEMBER_AUTHORIZE/SUSPEND/ROLE_UPDATE`: Update `memberships` / `membership_seats`.
   - `ROLE`: Write to `roles` / `role_permissions`.

6. **Add missing commands**:
   - `COUNTER_SALE`: Create invoice + payment + stock movements atomically.

### Phase 2: Wire Web Client to Backend

1. **Replace `apiGateway.ts`**:
   - Change `dispatchVersionedApiCommand` from client-side dispatch to real `fetch()` to `/api/ops/event`.
   - Add session cookie handling (HttpOnly, set by server).
   - Add CSRF token handling (read from cookie, send in header).
   - Add idempotency key generation and persistence.

2. **Update `ERPContext.tsx`**:
   - Replace all CRUD actions with backend command calls.
   - Remove localStorage persistence for domain data.
   - Add loading states for async backend calls.
   - Add error handling for backend failures.

3. **Add authentication**:
   - Add `/login` route with "Sign in with Google" button.
   - Add auth gate in `main.tsx` (check session cookie).
   - Add logout button in AppShell header.
   - Remove simulated MFA or relabel as "Demo PIN".

4. **Add tenant switcher**:
   - Add dropdown in AppShell header listing user's org memberships.
   - On switch, call `/api/auth/switch-org` (new endpoint) or re-authenticate.

5. **Update views**:
   - Remove client-side filtering by tenantId (server enforces).
   - Update document numbering to use backend-provided numbers.
   - Update financial calculations to use backend-computed values.

### Phase 3: Tests

1. **Persistence tests**:
   - Create customer → refresh → verify customer present.
   - Create invoice → refresh → verify invoice present.
   - Create payment → refresh → verify payment present.

2. **Tenant isolation tests**:
   - Login as Org A user → create customer → login as Org B user → verify customer not visible.
   - SQL injection test: try to query Org A data from Org B session → verify RLS blocks.

3. **Auth tests**:
   - Open app without session → verify redirected to login.
   - Sign in with Google → verify session cookie set.
   - Logout → verify session destroyed.

4. **Numbering tests**:
   - Create 3 invoices → verify numbers are sequential.
   - Refresh → create another → verify next number (no duplicate).
   - Concurrent test: two users create invoices → verify both get unique numbers.

5. **Financial integrity tests**:
   - Org with GST registered → create invoice → verify GST calculated.
   - Invoice balance 10,000 → try to record payment 15,000 → verify rejected.
   - Create job → create invoice → record full payment → verify job status = "Paid".
   - Create PO → receive goods → verify PO status = "Received". Record payment → verify supplier outstanding reduced.

6. **Audit integrity tests**:
   - Create invoice → verify audit_event logged with real actor, no hardcoded IP.
   - Login as Org A user → verify Org B audit events not visible.

---

## Remaining Blockers (Post-Round 1)

After Round 1, the following will remain for subsequent rounds:

1. **M3 visual cleanup** (CSS, typography, cosmetic polish) — deferred per user request.
2. **Dashboard "Sales Today" KPI** (permanently zero due to stale mock dates) — requires real data.
3. **Charts use static hardcoded data** — requires real data.
4. **GlobalSearchModal not mounted** — UI polish.
5. **StarqAICopilot not mounted** — UI polish.
6. **Focus trap in modals** — accessibility polish.
7. **Touch targets below 44px** — mobile polish.
8. **Dark mode coverage in some modals** — visual polish.
9. **NavigationRail icons no accessible text** — accessibility polish.
10. **Various hardcoded decorative numbers** — requires real data.

---

## Success Criteria

Round 1 is complete when:

1. ✅ All domain data persists across browser refresh (customers, jobs, invoices, payments, expenses, inventory, stock_movements, suppliers, POs, users, roles, workflow_stages).
2. ✅ Tenant isolation enforced server-side (Org A data not visible to Org B).
3. ✅ Real authentication (Google OAuth) with login/logout.
4. ✅ Document numbering is durable (no duplicates across refresh/concurrent users).
5. ✅ Financial integrity: GST calculated correctly, overpayment rejected, job status updated on payment, PO receipt ≠ payment, supplier outstanding accurate.
6. ✅ Audit integrity: no hardcoded IP, real actor/tenant/action logged, no fabricated audit data.
7. ✅ All tests pass (persistence, tenant isolation, auth, numbering, financial, audit).
8. ✅ No M3/CSS/typography changes (per user request).

---

## Next Steps

1. Review this map with user.
2. Implement Phase 1 (backend stubs) → Migration 0023.
3. Implement Phase 2 (web client wiring).
4. Implement Phase 3 (tests).
5. Run all gates (contract, migration, security, tenant, web, CI).
6. Create PR, merge to main.
7. Provide handoff doc with exact findings fixed, architecture used, migrations/backend changes, client changes, tests proving persistence and tenant isolation, auth/MFA truth state, financial integrity tests, remaining blockers, PR and merged main SHA.
