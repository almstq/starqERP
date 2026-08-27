# Security Model & Threat Boundary

starqERP is built on zero-trust principles, enforcing cryptographic authentication, granular role-based access control, and strict session integrity.

---

## 1. Authentication Architecture

- **Identity Verification**: All users authenticate via Google Identity Services (OAuth 2.0 / OpenID Connect).
- **Platform Audience Validation**: The API Gateway verifies token audience (`aud`) against strict per-platform policies (`web`, `android`), preventing cross-client token injection.
- **Session Tokens**: Authenticated sessions are HMAC-SHA256 signed tokens transmitted via `HttpOnly; Secure; SameSite=None` cookies (`sb_ops`).
- **CSRF Defense**: State-mutating routes (`/api/ops/event`, `/api/auth/seat`, `/api/auth/context`) require an `x-csrf-token` header matching the session payload.

---

## 2. Segregation of Duties (SoD)

starqERP defines 12 standardized system seats:
- `managing_director` — Full operational governance
- `director` — Executive oversight & financial authorizer
- `general_manager` — Operations coordinator
- `financial_controller` — Accounting, banking, and tax authority
- `purchasing_agent` — Purchase order creator
- `receiver` — Goods receipt & delivery inspector
- `quartermaster` — Inventory manager & parts issuer
- `stores` — Warehouse & storage clerk
- `technician` — Workshop service executor
- `qc_signer` — Quality control inspection sign-off
- `counter` — Point-of-sale invoicing & cash receipting
- `ledger_poster` — Journal entry reviewer & posting clerk

Conflicting roles (e.g. creating a purchase order and approving payment to the same vendor) are strictly blocked by the Segregation of Duties matrix in `contracts/commands.ts`.
