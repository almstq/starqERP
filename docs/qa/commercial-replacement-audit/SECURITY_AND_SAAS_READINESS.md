# SECURITY, SAAS TENANCY & STAFF ACCESS AUDIT

**Document Status**: Authoritative Security, Multi-Tenancy & Access Governance Audit  
**Date**: 2026-08-27  
**Scope**: Authentication, Session Management, RLS Policies, Tenant & Book Isolation, Staff Invitation Workflows  

---

## 1. Security Architecture Evaluation

| Security Layer | Implemented Architecture | Commercial / Enterprise Verification |
| :--- | :--- | :---: |
| **Authentication** | Google OAuth 2.0 (`id_token` verification against Google API with audience enforcement per client kind). | **STRONG / PRODUCTION GRADE** |
| **Session Integrity** | Cryptographic HMAC-SHA256 session cookie (`sb_ops`), 8-hour rolling TTL, automatic eviction on 401. | **STRONG / PRODUCTION GRADE** |
| **Cross-Site Request Forgery (CSRF)** | Double-submit CSRF token validated on all mutating HTTP POST/RPC requests. | **STRONG / PRODUCTION GRADE** |
| **Idempotent Mutation Replay** | UUID `x-idempotency-key` header with 7-day database retention preventing duplicate charges or duplicate jobs. | **STRONG / PRODUCTION GRADE** |
| **Row Level Security (RLS)** | `app_private.current_organisation_id()` enforced on all PostgreSQL domain tables. | **STRONG (SCHEMA LEVEL)** |
| **Tenant Isolation Invariants** | Composite unique constraints `unique (organisation_id, id)` prevent cross-tenant foreign key references. | **EXCELLENT / MATHEMATICALLY ENFORCED** |
| **Zero Platform Privilege Bleed** | Starq HQ operator context (`acting_plane = 'platform'`) strictly separated from Tenant #0 and Tenant #1 execution planes. | **EXCELLENT (ARCHITECTURE & SWITCHER)** |
| **Immutable Audit Trail** | Append-only `audit_events` and `security_events` capturing actor person, seat, action, previous/new value. | **EXCELLENT / TAMPER-RESISTANT** |

---

## 2. The Critical SaaS & Staff Access Blocker: How Staff Are Added Today

### The Required Enterprise Workflow:
1. **Starq Technologies** approves a business owner and provisions their tenant.
2. **Tenant Owner / Admin** logs in, goes to `Settings → Users`, enters an employee's Google email (`technician@garage.mv`), assigns specific books (`Ignition Ink`), specific locations (`Hulhumale Garage`), and selects their operational role (`Technician`).
3. **Employee** receives an invitation email or link, logs in with their Google account (`technician@garage.mv`).
4. **Backend Gateway** automatically matches the pending invite, activates their membership, and grants access strictly to their assigned organization, books, and locations.

---

### The Current Reality in the Codebase:

```typescript
// From supabase/functions/starq-api/index.ts lines 406-412:
async function establishPerson(claims: { sub: string; email: string; name: string }): Promise<Session> {
  const entry = allowlist().find((person) =>
    person.status !== "disabled" && person.email?.trim().toLowerCase() === claims.email
  );
  if (!entry?.person_id) throw new Error("not_allowlisted");
  const seats = [...new Set((entry.seats ?? []).filter((seat) => ALLOWED_SEATS.has(seat)))];
  if (seats.length === 0) throw new Error("no_active_seat");
  ...
}
```

### Findings:
1. **Hardcoded Environment Allowlist**: All allowed users are currently hardcoded in the `STARQBOOKS_ALLOWLIST_JSON` environment variable deployed to the Supabase Edge Function.
2. **No Dynamic Self-Service Invites**:
   - A customer admin **cannot** add, invite, change roles for, or revoke access for their own employees from the UI.
   - If a customer hires a new cashier or mechanic, Starq developers must manually edit the environment JSON and redeploy the Edge Function.
3. **No Pending Invite State**: There is no database table for pending invitations (`public.invitations`), token expiration, or invite resend/revocation.

---

## 3. Recommended Remediation Architecture for Staff Invites

To achieve enterprise multi-tenancy readiness, implement `public.invitations`:

```sql
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  role_id text not null,
  book_ids uuid[] not null default '{}',
  location_ids uuid[] not null default '{}',
  invited_by uuid not null references public.persons(id),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (organisation_id, email, status)
);
```

### Dynamic Auth Resolver in `establishPerson`:
1. When a new Google identity logs in, if they are not in the platform operator list:
2. Query `public.invitations` where `email = claims.email` and `status = 'pending'` and `expires_at > now()`.
3. If an invite is found:
   - Create `public.persons` record for the new user.
   - Create `public.memberships` record for `organisation_id`.
   - Create `public.book_memberships` records for each `book_id` in `book_ids`.
   - Update `public.invitations` to `status = 'accepted'`.
4. If no invite and no existing membership: Reject with `unauthorized_invitation_required`.
