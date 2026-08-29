# starqERP — Elder Command Return Brief (28 August 2026)

**Audience**: Elder (Senior Engineering Reviewer / Command)  
**Author**: Lead Engineering Agent  
**Baseline Date**: 2026-08-27 / 2026-08-28  
**System State**: Pre-Hosting Friend Onboarding Vertical Slice Complete | Ready for Staging Acceptance  
**Private Canonical Repository**: `almstq/starqERP` (`main` @ `7c05723`)  
**Public Technical Preview**: `almstq/starqERP-public` (`v0.2.0-beta`)  
**Session Changelog**: [`docs/CHANGELOG_2026-08-27.md`](./CHANGELOG_2026-08-27.md)  
**ISO 27001 Readiness Audit**: [`docs/qa/current/ISO_27001_READINESS_GAP_AUDIT_2026-08-27.md`](./qa/current/ISO_27001_READINESS_GAP_AUDIT_2026-08-27.md)  

---

## 💥 WHAT CHANGED SINCE ELDER LAST SAW THIS WORKSPACE

Elder should review this section first to understand the full transformation executed on 27 August 2026:

1. **Elimination of Mock/Browser Authority**:
   - Local browser `localStorage` authority for business registration, application intake, and tenant creation was completely removed and replaced with PostgreSQL stored procedures.
2. **Two-Plane SaaS Architecture**:
   - Starq HQ Platform Control Plane (`platform` schema) is physically and logically segregated from Tenant ERP Execution (`public` schema).
   - Starq HQ operator console requires `session.platform_entitlement`. A customer tenant admin has zero authority in Starq HQ.
3. **5-Tier Entity & Multi-Book Architecture**:
   - Migrations `0024`, `0025`, `0026`, and `0027` unified the identity model, established the `platform` schema, implemented multi-book accounting partitioning, deployed the atomic provisioning engine, and provided secure tenant staff invitations (`public.invitations`).
4. **Self-Service Staff Invitation Workflow (SERP-286)**:
   - Built database-backed staff invitation lifecycle (`public.invitations`). Tenant admins can invite staff by email/role, inspect pending invitations, copy secure tokens, and revoke/resend access.
5. **Archetype Decoupling & Workflows Engine (SERP-288)**:
   - Automotive workshop hardcoding was completely purged from generic tenants.
   - 6 canonical archetypes (`software_technology`, `general_business`, `professional_services`, `automotive_workshop`, `medical_clinic`, `marine_service`) with dynamic 5-stage workflows.
6. **Product Version SSOT & Corporate Brand Separation (SERP-032 / SERP-338)**:
   - Canonical product version SSOT established at `v0.2.0-beta` across all UI surfaces and diagnostics. `v1.0.0` is strictly reserved for GA.
   - Brand layers separated: `<StarqERPBrand />` (blue product mark) vs `<StarqCorporateBrand />` (official `starq-logo.png` for Starq Technologies).
7. **Personalized Dashboard Welcome Banner (SERP-338)**:
   - Compact dynamic greeting (`Good morning/afternoon/evening, <name>`), `Company · Book`, and real zero-state vs non-zero attention messaging.
8. **Canonical Board Re-alignment**:
   - Tasks consolidated into a canonical 338-task baseline across four commercial milestone gates (G1–G4). Progress stands at **125 Done (36.98%)**.
9. **Quality Gate Baseline**:
   - Expanded automated test suite to **42 test files / 168+ tests** passing cleanly with 0 TypeScript compilation errors.
10. **Clean-Room Public Snapshot**:
    - Published at [`almstq/starqERP-public`](https://github.com/almstq/starqERP-public) with fresh history, zero private docs, and zero secrets.

---

## 1. Executive Situation

starqERP has completed its architectural realignment from an exploratory single-tenant garage tool into a true **two-plane multi-tenant SaaS ERP platform** designed for the Maldives. 

The system now features:
- **Logical & physical two-plane separation**: Starq HQ Platform Control Plane (`platform` schema) vs Tenant ERP Execution Plane (`public` schema).
- **5-tier organizational spine**: Identity $\rightarrow$ Platform Entitlement / Tenant Memberships $\rightarrow$ Legal Entities (`organisations`) $\rightarrow$ Trading Names (`business_names`) $\rightarrow$ Operating Books (`books`) $\rightarrow$ Locations (`locations`).
- **Server-authoritative external onboarding**: Real Google OAuth applicant sign-in, server persistence (`platform.tenant_applications`), Starq HQ operator review queue, and atomic database provisioning procedure `platform.provision_approved_application`.
- **Live staging migrations**: 27 versioned SQL migrations (0001 through 0027) applied 1:1 on live Supabase project `wthabguvueewgtabjsdo`.
- **Clean-room public snapshot**: Published at [`almstq/starqERP-public`](https://github.com/almstq/starqERP-public) with 0 high-confidence secret disclosures, fresh Git history, and zero internal/private governance documents.

---

## 2. Two-Plane SaaS Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Two-Plane SaaS Topology                         │
├──────────────────────────────────┬─────────────────────────────────────┤
│      Starq HQ Control Plane      │      Tenant ERP Execution Plane     │
│   (SaaS Operator Perspective)    │    (Business Owner Perspective)     │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • platform schema access         │ • public schema tenant execution    │
│ • Tenant fleet & registry        │ • Commercial POS & Sales Invoices   │
│ • Business application review    │ • Job cards & service workflows     │
│ • Atomic workspace provisioning  │ • Inventory valuation & movements   │
│ • Telemetry & billing metrics    │ • Double-entry General Ledger       │
│ • Requires platform_entitlement  │ • MIRA GST filing compliance        │
└──────────────────────────────────┴─────────────────────────────────────┘
```

- **Starq HQ (`platform` schema)**: Requires explicit platform operator entitlement (`session.platform_entitlement`). A customer tenant's `managing_director` or `super_admin` role has zero authority in Starq HQ.
- **Tenant Plane (`public` schema)**: Day-to-day operations for business entities (e.g. *Club Ignition Pvt Ltd*, *Starq Technologies Pvt Ltd*, or external client tenants).

---

## 3. Migration State through 0027

| Migration Version | Exact Filename | Status | Description |
| :--- | :--- | :---: | :--- |
| `202608240001` to `202608260023` | Migrations 0001–0023 | Applied | Core schema, RLS, audit logs, and accounting foundations |
| `202608270024` | `202608270024_platform_schema.sql` | Applied | `platform` schema, operator entitlement, application queue |
| `202608270025` | `202608270025_multi_book_schema.sql` | Applied | 5-tier entity hierarchy, `books`, `book_locations` |
| `202608270026` | `202608270026_atomic_provisioning.sql` | Applied | Stored procedure `platform.provision_approved_application` |
| `202608270027` | `202608270027_staff_invitations.sql` | Applied | Tenant staff invitations table `public.invitations` |

---

## 4. Immediate Handover Next Steps

1. **Vercel Staging Deployment**: Ensure Vercel environment variables point to live Supabase Edge Function `starq-api`.
2. **Manual External-User Acceptance Test**:
   - Friend (Device A) logs in via Google $\rightarrow$ submits business application.
   - Founder (Device B) reviews in Starq HQ $\rightarrow$ approves.
   - Friend (Device A) refreshes $\rightarrow$ operates provisioned tenant with 100% isolation.
3. **Canonical Board Tasks**:
   - **SERP-125**: Reserved for Elder.
   - **SERP-290** through **SERP-297**: Core double-entry accounting engine & MIRA GST-201 export schedule.
