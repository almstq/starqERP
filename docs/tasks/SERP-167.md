# SERP-167 — The endpoints the revision needs and starq-api does not have

**Status:** done  
**Assignee:** Antigravity  
**Branch:** `ag/serp-167-missing-endpoints`  
**Commit:** `cbf61cd` (starqERP)  
**Date:** 25 Aug 2026

---

## What was delivered

The missing server-backed command handlers and API endpoints mapped in SERP-166:

1. **INVOICE command (Statutory / DEC-068/A2)**:
   - Handles sales invoice creation and server-derived job invoice generation.
   - Computes subtotal and statutory GST server-side via `calculateLineTax` and the date-effective tax engine (SERP-122).
   - Allocates sequential invoice numbers (`INV-...`) and creates records in `public.commercial_documents`.
   - Transitions linked `garage_jobs` state to `invoiced`.

2. **EXPENSE command (Statutory)**:
   - Direct operating expense posting with sequential numbering (`EXP-...`).
   - Creates records in `public.commercial_documents` (type: `direct_expense`).

3. **CUSTOMER command**:
   - Registers customer contact master records in `public.contacts`.

4. **TENANT_CONFIG & TENANT_ONBOARD commands**:
   - Updates organization settings (name, island, TIN, GST status, bank accounts).

5. **WORKFLOW, MEMBERSHIP & ROLE commands**:
   - `WORKFLOW`, `MEMBER_INVITE`, `MEMBER_AUTHORIZE`, `MEMBER_SUSPEND`, `MEMBER_ROLE_UPDATE`, `ROLE` commands supported in `api_garage_command` and contract matrix.

6. **SQL Migration 202608250020_revision_missing_endpoints.sql**:
   - Extends `api_garage_command` to execute the new commands with strict seat checking (counter, financial_controller, director, owner).
   - Idempotency claims and audit logging enforced.

---

## Files Changed / Added

- `contracts/commands.ts`: Widened `COMMANDS`, `COMMAND_SEATS`, `SQL_PERMITTED_SEATS`; added payload validators; updated `MUTATION_SURFACE_MAP` wired status.
- `supabase/functions/_shared/commands.ts`: Generated sync copy.
- `supabase/migrations/202608250020_revision_missing_endpoints.sql`: Extended `api_garage_command` implementation.
- `tests/contract/commands_test.ts`: Added 7 SERP-167 test cases.

---

## Verification & Conformance

- **Deno contract & endpoint tests:** **94/94 PASS** (7 new tests, 0 failed).
- **Web client Vitest:** **11/11 PASS**.
- **Python / the foundation engine:** **5/5 AC PASS**.
