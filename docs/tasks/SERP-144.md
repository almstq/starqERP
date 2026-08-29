# Task Execution Report: SERP-144
## Customer, Vehicle & Phone Persistence on Job Card (DEC-054 / DEC-072)

- **Phase:** Phase 2 — Close the security/domain gates
- **Epic:** SERP-M0
- **Priority:** P1
- **Execution state:** Complete; ready for independent review
- **Implementation commit:** `74b0435`
- **Date:** 2026-08-25
- **Accountable owner:** Antigravity (`antigravity`)
- **Authority / Decisions:** DEC-054, DEC-072

---

## Scope & Implementation

Fixed the defect where customer name, vehicle registration, and phone number were concatenated into a single summary string or dropped completely on `CALL`, causing job card headers to display blank values and leaking placeholder text (`"Customer: Customer"`).

### 1. Schema & Migration ([`supabase/migrations/202608250019_job_customer_vehicle_phone.sql`](file:///d:/StarqTech/starqERP/supabase/migrations/202608250019_job_customer_vehicle_phone.sql))
- Added first-class columns to `public.garage_jobs`:
  - `customer_name text`
  - `vehicle_reg text`
  - `customer_phone text`
- Backfilled existing jobs from `summary` (`split_part(summary, ' - ', 1/2)`).
- Hardened `public.api_garage_command`:
  - On `CALL`, stores discrete `customer_name`, `vehicle_reg`, and `customer_phone`.
  - Echoes discrete fields in `response.event`.
- Hardened `public.api_garage_pulse`:
  - Returns `customer_name`, `vehicle_reg`, `customer_phone`, and `phone` on each job item in `jobs` aggregate.
  - Returns `customer_name`, `vehicle_reg`, `phone` in active `campaign` payload.

### 2. Client Job Card Rendering ([`starq-ops-app/lib/features/garage/`](file:///D:/!starq/starqERP/legacy/engine/starq-ops-app/lib/features/garage/))
- **`job_card_screen.dart`:**
  - Reads `customer_name`, `vehicle_reg`, and `customer_phone` / `phone`.
  - Fallback parses `summary` only if discrete fields are empty.
  - Replaced the leaking `"Customer"` placeholder with clean, honest fallback (`"No customer recorded"`).
  - Renders phone number alongside customer name (`$customer • $phone`).
- **`jobs_list_view.dart`:**
  - Updated `parseCustomerVehicle()` to preserve discrete customer, vehicle, and phone fields.

### 3. Contract & Conformance Tests ([`contracts/commands.ts`](file:///d:/StarqTech/starqERP/contracts/commands.ts), [`tests/contract/commands_test.ts`](file:///d:/StarqTech/starqERP/tests/contract/commands_test.ts))
- Defined `CallCommandPayload` interface and `validateCallCommandPayload` helper.
- Added 3 Deno contract tests:
  1. `validateCallCommandPayload` validates and preserves `customer_name`, `vehicle_reg`, and `phone`.
  2. Missing customer name, vehicle reg, or consent returns error.
  3. Migration 0019 verified for schema columns, pulse, and command hardening.

---

## Verification & Conformance Evidence

- **Contract Conformance (`deno test`):** **71/71 tests passed (100% PASS in 46ms)**.
- **Web Vitest Suite (`npm test` in `web/`):** **3 test files, 11 tests passed (100% PASS)**.
- **Python Seat Matrix Tests:** **10/10 passed**.
- **Python Document Numbering Tests:** **6/6 passed**.
- **RLS Table Protection Probe:** **31/31 public tables verified (27 RLS, 4 revoked grants, 0 unprotected)**.
