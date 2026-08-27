# starqERP & starq.mv — Authentication & Product Entry Flow Architecture

**Document Status**: Authoritative Public-to-App Authentication Gateway Specification  
**Date**: 2026-08-27  

---

## 1. End-to-End Visitor & Authentication Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Public Marketing Tier                                  │
│                                      (starq.mv)                                        │
│                                                                                        │
│   starq.mv/starqerp  ────────────►  "Sign In to starqERP"                              │
│                                             │                                          │
└─────────────────────────────────────────────┼──────────────────────────────────────────┘
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                Authentication Boundary                                 │
│                                                                                        │
│                          POST /api/auth/google (Google OIDC)                           │
│                          Edge Gateway (starq-api on Supabase)                          │
│                          Verifies Token Signature against JWKS                         │
│                          Issues HttpOnly Signed Session Cookie                         │
│                                             │                                          │
└─────────────────────────────────────────────┼──────────────────────────────────────────┘
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Authorization Routing Engine                             │
├─────────────────────────────────────┬──────────────────────────────────────────────────┤
│ User Identity State                 │ Application Destination & UX State               │
├─────────────────────────────────────┼──────────────────────────────────────────────────┤
│ 1. Active Tenant Membership         │ ➔ erp.starq.mv                                   │
│    (User belongs to ≥1 tenant org)  │    Direct entry to operational workspace         │
│                                     │    (Dashboard, Jobs, Invoices, GL, POS)          │
├─────────────────────────────────────┼──────────────────────────────────────────────────┤
│ 2. Valid Identity, No Membership    │ ➔ erp.starq.mv/onboarding                        │
│    (New applicant / external user)  │    Authoritative Business Application Modal      │
│                                     │    Submitted to platform.tenant_applications     │
├─────────────────────────────────────┼──────────────────────────────────────────────────┤
│ 3. Pending Application Review       │ ➔ erp.starq.mv/pending                           │
│    (Application awaiting review)    │    "Application Under Review by Starq HQ"        │
├─────────────────────────────────────┼──────────────────────────────────────────────────┤
│ 4. Platform Operator Entitlement    │ ➔ erp.starq.mv (Starq HQ Control Plane)          │
│    (session.platform_entitlement)   │    Fleet Registry, Review Queue, Provisioning    │
└─────────────────────────────────────┴──────────────────────────────────────────────────┘
```

---

## 2. Architectural Security Invariants

1. **Strict Origin Isolation**:
   - `starq.mv` hosts static marketing, corporate profiles, and public documentation. Zero transactional session tokens are processed on the static corporate host.
   - `erp.starq.mv` is the isolated SaaS runtime host with strict CORS, CSP, and `HttpOnly; Secure; SameSite=None` session cookie protection.
2. **Deterministic Pre-Auth Gateway**:
   - Clicking "Sign In" on `starq.mv/starqerp` opens the secure Google OAuth consent screen targeting the Supabase Edge Gateway.
   - Upon successful verification, the browser is redirected directly to `https://erp.starq.mv` with the session established.
3. **No Phantom Accounts**:
   - A verified Google identity without an active tenant membership cannot access any customer records or operational tools. They are routed strictly to the onboarding intake flow.
