# Task Execution Report: SERP-143
## Fix Approvals Command Contract Alignment (DEC-054 / DEC-072)

- **Phase:** Phase 2 — Close the security/domain gates
- **Epic:** SERP-M0
- **Priority:** P0
- **Execution state:** Complete; ready for independent review
- **Implementation commit:** `1c266e9`
- **Date:** 2026-08-25
- **Accountable owner:** Antigravity (`antigravity`)
- **Authority / Decisions:** DEC-054, DEC-072

---

## Scope & Implementation

Fixed the defect where the client posted `{ sop: 'APPROVAL' }` — an unsupported command returning `unsupported_command` — instead of posting the contract-defined `PURCHASE` steps (`award` and `pay`) per `PURCHASE_STEP_SEATS`.

### 1. Contract Alignment & Invariants ([`contracts/commands.ts`](file:///d:/StarqTech/starqERP/contracts/commands.ts))
- Confirmed the frozen contract accepts exactly `CALL`, `BOOKING`, `INTAKE`, `ESTIMATE`, `AUTHORISATION`, `JOB_CARD`, `PARTS_PROCUREMENT`, `PURCHASE`, `WORK`, `QC`, `HANDOVER`, `INVOICE_PAYMENT`, `CLOSE`.
- `PURCHASE` is authorized per step:
  - `award`: Requires `financial_controller`
  - `pay`: Requires `payer`
- Refused `APPROVAL` command outright at the boundary without server pollution.

### 2. Client UI & Seat Guidance ([`ops_shell_screen.dart`](file:///d:/StarqTech/starqBooks/starq-ops-app/lib/features/garage/home/ops_shell_screen.dart))
- Updated `_buildApprovalsView` to clearly display the exact required seat for each approval step:
  - `FC MATCH`: `Seat: financial_controller`
  - `PAYER RELEASE`: `Seat: payer`
- Enhanced button styling to reflect the user's active acting seat (`mineFill` / `mineBorder`).
- Handlers post contract-valid payloads:
  - `_approveFC`: `{ 'sop': 'PURCHASE', 'action': 'award', 'po_id': poId }`
  - `_approvePayer`: `{ 'sop': 'PURCHASE', 'action': 'pay', 'po_id': poId }`

### 3. Automated Conformance Tests ([`tests/contract/commands_test.ts`](file:///d:/StarqTech/starqERP/tests/contract/commands_test.ts))
- Added 3 Deno contract tests:
  1. `APPROVAL` refused as `unknown_command`.
  2. `PURCHASE` with `step: award` authorized for `financial_controller` and refused for unauthorized seats (`counter`, `technician`, `payer`).
  3. `PURCHASE` with `step: pay` authorized for `payer` and refused for unauthorized seats (`financial_controller`, `counter`, `technician`).

---

## Verification & Conformance Evidence

- **Contract Tests (`deno test`):** **68/68 passed (100% PASS in 31ms)**.
- **Web Vitest Suite (`npm test` in `web/`):** **3 test files, 11 tests passed (100% PASS)**.
- **Python Seat Matrix Tests:** **10/10 passed**.
- **Python Document Numbering Tests:** **6/6 passed**.
- **RLS Table Protection Probe:** **31/31 public tables verified (27 protected by RLS policies, 4 protected by revoked grants, 0 unprotected)**.
