# SERP-088 — Controlled return, refund and void (QA evidence)

Date: 2026-09-19  
Author: Antigravity, under SERP-087 (accepted) and SERP-030 (done) authority.  
Scope: Server-authoritative counter sale reversals (`return`, `void`, `refund`), positive stock restoration, credit note commercial document, SoD approval controls, register tables (`counter_returns`, `counter_refund_tenders`), and cash session reconciliation.  
Files:
- `supabase/migrations/202609192359_serp088_counter_return_refund_void.sql`
- `supabase/functions/starq-api/index.ts`
- `web/src/domain/counter.ts`
- `web/src/domain/counter.test.ts`
- `web/src/components/counter/CounterView.tsx`
- `tests/contract/serp_088_counter_return_void_test.ts`
- `tests/serp088_counter_return_void_probe.sql`
- `tests/run_serp088_counter_return_void_probe.ps1`

## Trigger & Scope Boundary

SERP-088 delivers the controlled return, refund, and void subsystem for POS counter operations:
- **Server-Authoritative Reversal:** Linked directly to an original counter sale (`commercial_documents` where `document_type = 'sales_invoice'` and `counter_sale = true`). Cross-tenant references fail closed (`sale_not_found`).
- **Inventory Restoration:** Writes positive stock movements (`movement_type = 'return'`, `quantity > 0`) to `public.stock_movements`, immediately updating canonical derived on-hand (`stock_movements_derived_onhand`) live without trigger or cache drift.
- **Financial & Document Consequence:** Mints an attributable, settled Credit Note (`commercial_documents` where `document_type = 'credit_note'`) and records itemized refund tender legs (`counter_refund_tenders`).
- **Separation of Duties (SoD) & Approval Gate (SERP-030):**
  - Managerial seats (`owner`, `managing_director`, `director`) have direct execution authority (`approval_mode: 'manager_seat'`). (Note: Strictly conforms to `public.seats(code)` as verified in Room seq 6200).
  - Counter operators in segregated capacity require an active managerial approver (`approver_person_id` in same tenant holding `owner`, `managing_director`, or `director` seat), executing with `approval_mode: 'supervisor_override'`. Unapproved attempts fail closed (`reversal_approval_required`); unauthorized approvers fail closed (`reversal_approver_unauthorized`).
  - Counter operators in solo capacity compensate honestly per SERP-030 with recorded exception audit trails (`approval_mode: 'solo_capacity'`).
  - Unauthorized seats (`technician`, `viewer`) fail closed (`seat_not_authorized`).
- **Boundary Guards:**
  - Cannot void an already-voided sale (`sale_already_voided`).
  - Cannot void a partially returned sale (`cannot_void_partially_returned_sale`).
  - Return item quantities cannot exceed sold quantities minus prior returns (`return_quantity_exceeds_sale`).
  - Returned products must belong to the original sale (`product_not_on_sale`).
  - Refund tenders must match server refund total (`reversal_refund_mismatch`).
- **Cash Session Integration (SERP-089):** Cash refunds issued during the active till session window are deducted from net cash sales, ensuring exact expected cash reconciliation.
- **Currency SSOT:** Org base currency derived dynamically from `organisations.base_currency` per commit `0c46cde`, zero hardcoded literals.

## Architecture & Implementation

### 1. Database Schema (`supabase/migrations/202609192359_serp088_counter_return_refund_void.sql`)
- Document sequences: initializes `credit_note` (`CRN-`) and `counter_return` (`RET-`).
- `public.counter_returns`: register table recording `id`, `organisation_id`, `return_number`, `original_sale_id`, `credit_note_id`, `location_id`, `reversal_type`, `currency`, `subtotal`, `tax_total`, `total_refund_amount`, `items`, `refund_tenders`, `reason`, `approval_mode`, `approver_person_id`, `approver_seat`, `idempotency_key`, `created_at`, `created_by`, `created_seat`.
- `public.counter_refund_tenders`: register table recording `id`, `organisation_id`, `return_id`, `payment_method` (`cash`, `card`, `transfer`, `store_credit`), `amount`, `currency`.
- Privileges: revoked from public/anon/authenticated; granted to `service_role`.

### 2. Stored Procedures
- `public.api_counter_sale_reversal`:
  - Enforces seat gate and SoD policy.
  - Locks original sale with `pg_advisory_xact_lock(hashtext(target_org::text || v_original_sale_id::text)::bigint)` to serialize concurrent reversals.
  - Calculates pro-rata line net, tax, and gross.
  - Inserts positive stock return movements.
  - Mints settled Credit Note and lines in `commercial_documents`.
  - Inserts return register and refund tender records.
  - Emits attributable `audit_events` (`erp.counter_return` or `erp.counter_void`) and transactional outbox event.
- `public.api_counter_return_get`: tenant-scoped read-only projection of a return record and linked documents.
- `public.api_counter_return_list`: tenant-scoped query of returns for a sale or location.
- Updated `api_counter_session_current` and `api_counter_session_close`: subtracts `cash_refunds` from cash sales to compute exact `expected_cash`.

### 3. Edge API (`supabase/functions/starq-api/index.ts`)
- `POST /api/ops/counter/return`: invokes `api_counter_sale_reversal` with type `return`.
- `POST /api/ops/counter/void`: invokes `api_counter_sale_reversal` with type `void`.
- `GET /api/ops/counter/return`: query param `return_id`, invokes `api_counter_return_get`.
- `GET /api/ops/counter/returns`: query params `original_sale_id`, `location_id`, `limit`, invokes `api_counter_return_list`.
- Error mapping: 403 for seat and approval failures, 404 for sale/location not found, 409 for duplicate/invalid void states, 400 for boundary violations.
- Verified with `deno check` $\rightarrow$ **0 errors**.

### 4. Web Domain & Counter POS UI (`web/`)
- `web/src/domain/counter.ts`:
  - Added types `ReversalType`, `RefundMethod`, `ApprovalMode`, `CounterReturn`, `CounterReturnItem`, `CounterRefundTender`.
  - Added pure domain predicates: `canReturnItem`, `remainingReturnableQty`, `calculateRefundTotals`, `formatReversalLabel`.
- `web/src/domain/counter.test.ts`:
  - Added 4 unit tests covering remaining returnable quantity, boundary validation, refund tender totals, and label formatting (**43/43 PASS**).
- `web/src/components/counter/CounterView.tsx`:
  - Added "Return / Void" action button in top toolbar with `RotateCcw` icon.
  - Added modal dialog supporting both Itemized Return and Void Entire Sale workflows.
  - Supports item and quantity selection, refund method and amount, reason specification, and SERP-030 operating capacity toggle (Segregated with supervisor approver UUID vs Solo Operator).
  - Verified with `npm run lint` (`tsc --noEmit`) $\rightarrow$ **0 errors**.

## Automated Evidence

### 1. Contract Suite (Deno)
`tests/contract/serp_088_counter_return_void_test.ts` — **20/20 PASS** (37ms):
- Itemized return calculates pro-rata refund and positive stock movement.
- Full void reverses 100% of lines and gross total.
- Partial return allows subsequent return of remaining quantity.
- Returning more than sold quantity fails closed with `return_quantity_exceeds_sale`.
- Returning product not on original sale fails closed with `product_not_on_sale`.
- Attempting to void an already-voided sale fails closed with `sale_already_voided`.
- Attempting to void a partially returned sale fails closed with `cannot_void_partially_returned_sale`.
- Refund tenders amount mismatch fails closed with `reversal_refund_mismatch`.
- Cross-tenant original sale reference fails closed with `sale_not_found`.
- Counter seat in segregated capacity requires manager supervisor approval.
- Unauthorized seat rejected with `seat_not_authorized`.
- Replay idempotency returns stored return record with `idempotent_replay: true`.
- Migration `202609192400` defines tables, constraints, foreign keys, and RLS.
- RPC defined with seat gate, `search_path`, and `service_role` permissions.
- Stock movements insert type is `return` with positive quantity.
- Audit event and outbox event emitted on reversal.
- Cash session close reconciles cash refunds.
- Currency derived from `organisations.base_currency` (commit `0c46cde`).
- Edge API wires return, void, and returns query routes.
- Full void auto-tender-mirror builds `jsonb_build_object` preventing scalar-to-jsonb cast exception.

### 2. Full Contract Suite
`deno test --no-check --allow-read tests/contract/` — **387 passed | 0 failed** (2s).

### 3. Web Unit Tests & Typecheck
- `web/src/domain/counter.test.ts` — **43 passed | 0 failed** (2.36s).
- Full web test suite: 129 test files, 795 passed (50.85s).
- `web npm run lint` (`tsc --noEmit`) — **0 errors** (clean).

## Synthetic Disposable-DB Probe
Delivered for independent live verification on disposable PostgreSQL 17.6.1.155 runtime:
- `tests/serp088_counter_return_void_probe.sql`:
  - Extracts `COUNTER_SALE` invoice ID via `(v_res->'counter_sale'->>'invoice_id')::uuid`.
  - Executes real `COUNTER_SALE`;
  - Performs itemized return in solo capacity, proving live stock restoration (+1 on-hand);
  - Tests replay idempotency;
  - Performs second return with supervisor override (manager approval);
  - Verifies boundary rejection on excess return;
  - Executes real full void on second sale, proving complete stock restoration and rejection of double void;
  - Auto-mirrors original tenders via `jsonb_build_object('payment_method', ct.payment_method, 'amount_tendered', ct.amount_tendered)`;
  - Verifies negative fail-closed paths (unauthorized seat, unapproved segregated return, non-manager approver, cross-tenant sale, unsold product);
  - Proves cash session integration (opening float + sales - cash refunds = exact till close);
  - Clean transaction rollback.
- `tests/run_serp088_counter_return_void_probe.ps1`: automated runner.
