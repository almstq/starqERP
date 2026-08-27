# Foundation Reconciliation — Round 1

**Date**: 2026-08-27
**Agent**: Qoder
**Scope**: Reconcile Round 1 integration map findings with implemented changes

---

## Source Documents

1. **Integration Map**: `docs/ROUND1_INTEGRATION_MAP.md` — 6 sections, 23 findings
2. **AG OAuth Handoff**: `docs/auth/GOOGLE_OAUTH_SETUP.md` — 8 sections, 5 integration contracts
3. **Engineering Record**: `docs/starqERP_Round1_Foundation_Remediation_Engineering_Record_2026-08-27.md`

---

## Reconciliation Matrix

### Section 1: Authoritative Persistence

| Finding | Status | Implementation |
|---------|--------|----------------|
| Client 100% mock data | **CLOSED** | `apiGateway.ts` rewritten with real `fetch()`; `ERPContext.tsx` loads from 8 backend endpoints |
| No backend CRUD calls | **CLOSED** | All CRUD actions dispatch to `/api/ops/event` via `dispatchCommand()` |
| Document numbers don't survive refresh | **CLOSED** | Server-side `allocate_document_no()` with client reconciliation |

### Section 2: Tenant Isolation

| Finding | Status | Implementation |
|---------|--------|----------------|
| Column mismatches in migration 0020 | **CLOSED** | Migration 0023 fixes `document_number`→`document_no`, `type`→`kind`, removes `billing_address` |
| Command handlers reference wrong columns | **CLOSED** | `api_garage_command` rewritten with correct column references |
| RLS not verified end-to-end | **PARTIAL** | RLS structurally correct; live multi-org testing requires Supabase runtime |

### Section 3: Auth/Session/MFA

| Finding | Status | Implementation |
|---------|--------|----------------|
| No real authentication | **CLOSED** | Google OAuth via GIS; token validated at Edge; session cookie set |
| MFA presented as real | **CLOSED** | Relabeled "Demo PIN" with simulation disclaimer on all UI surfaces |
| No logout flow | **CLOSED** | `POST /api/auth/logout` with CSRF; cookie cleared; client redirects to `/login` |
| Missing `x-starq-client-kind` header | **CLOSED** | Added to `loginWithGoogle()` per AG contract |
| Wrong payload property (`token` vs `credential`) | **CLOSED** | Changed to `{ credential }` per AG contract |
| CSRF from HttpOnly cookie impossible | **CLOSED** | CSRF passed from `session.csrf` in React state, not from `document.cookie` |
| GIS script missing from `index.html` | **CLOSED** | Added `<script src="https://accounts.google.com/gsi/client">` |
| No Vite dev proxy | **CLOSED** | Added proxy config for `/api` → Edge Function |

### Section 4: Durable Numbering/Idempotency

| Finding | Status | Implementation |
|---------|--------|----------------|
| Client-side ID generation | **CLOSED** | Server-side `allocate_document_no()`; client reconciles after command success |
| No idempotency keys | **CLOSED** | UUID keys via `crypto.randomUUID()`; `x-idempotency-key` header; 7-day expiry |
| Idempotency format mismatch | **CLOSED** | Changed from `idemp_<ts>_<rand>` to UUID format required by Edge |

### Section 5: Financial Integrity

| Finding | Status | Implementation |
|---------|--------|----------------|
| GST not rounded | **CLOSED** | `Math.round(... * 100) / 100` in `generateJobInvoice` |
| Overpayment accepted | **CLOSED** | `INVOICE_PAYMENT` validates `amount <= unallocated_balance` |
| PO receipt = payment | **CLOSED** | `receivePurchaseOrder` marks "Received & Stocked"; payment status separate |
| No settlement allocation tracking | **CLOSED** | Added `allocated_total`, `unallocated_balance` columns; backfilled existing rows |

### Section 6: Audit Integrity

| Finding | Status | Implementation |
|---------|--------|----------------|
| Hardcoded IP `123.231.104.18` | **CLOSED** | Removed from `logAuditEvent`; IP field set to empty string |
| Fabricated audit entries | **CLOSED** | `INITIAL_AUDIT_LOGS` replaced with empty array; real events from `audit_events` table |
| Audit data not from backend | **CLOSED** | `/api/ops/audit` endpoint queries `audit_events` with org scoping |

---

## Summary

| Section | Findings | Closed | Partial | Open |
|---------|----------|--------|---------|------|
| 1. Authoritative Persistence | 3 | 3 | 0 | 0 |
| 2. Tenant Isolation | 3 | 2 | 1 | 0 |
| 3. Auth/Session/MFA | 8 | 8 | 0 | 0 |
| 4. Numbering/Idempotency | 3 | 3 | 0 | 0 |
| 5. Financial Integrity | 4 | 4 | 0 | 0 |
| 6. Audit Integrity | 3 | 3 | 0 | 0 |
| **Total** | **24** | **23** | **1** | **0** |

**Closure Rate**: 96% (23/24 fully closed, 1 partial — live RLS testing deferred to Supabase deployment)

---

## AG Contract Compliance

All 5 integration contracts from `docs/auth/GOOGLE_OAUTH_SETUP.md` Section 8 are satisfied:

1. **Payload property**: `{ credential }` ✓
2. **Client-kind header**: `x-starq-client-kind: web` ✓
3. **GIS script**: Added to `index.html` ✓
4. **CSRF source**: From `session.csrf`, not `document.cookie` ✓
5. **Vite proxy**: Configured for `/api` → Edge Function ✓

---

## External Configuration Required

The following must be configured before live OAuth works:

| Variable | Location | Purpose |
|----------|----------|---------|
| `VITE_GOOGLE_CLIENT_ID` | `web/.env.local` | GIS button client ID |
| `STARQBOOKS_GOOGLE_CLIENT_ID` | Supabase Edge secrets | Token audience validation |
| `STARQBOOKS_SESSION_SECRET` | Supabase Edge secrets | HMAC session signing |
| `STARQBOOKS_ALLOWLIST_JSON` | Supabase Edge secrets | Authorized users/seats/tenants |
| `STARQBOOKS_ALLOWED_ORIGINS` | Supabase Edge secrets | CORS allowed origins |
| Google Cloud Console | GCP | Authorized JS origins + redirect URIs |

No secrets are committed. No fake credentials are present.
