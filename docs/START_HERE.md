# starqERP — Senior Engineering & Agent Start Here Guide

**Authoritative Baseline Date**: 2026-08-27 / 2026-08-28  
**System Status**: Gate 1 (G1) Pre-Hosting Friend Onboarding Complete | Ready for Staging Acceptance  
**Canonical Board**: 338 Tasks (125 Done = 36.98%)  
**Private Main Commit**: `7c05723`  
**Live Staging Migration Ceiling**: `202608270027_staff_invitations.sql` (100% applied)  
**Detailed 27 Aug Ledger**: [`docs/CHANGELOG_2026-08-27.md`](./CHANGELOG_2026-08-27.md)  

---

## 💥 WHAT CHANGED SINCE ELDER LAST SAW THIS WORKSPACE

Elder should review this section first to understand today's transformation without digging through raw chat transcripts:

1. **Two-Plane SaaS Separation**:
   - `Starq HQ` is the SaaS Control Plane (`platform` schema) strictly segregated from tenant ERP execution (`public` schema).
   - Starq HQ operator console requires `session.platform_entitlement`. A customer tenant admin has zero authority in Starq HQ.
2. **5-Tier Entity & Multi-Book Spine**:
   - Entity model: Identity $\rightarrow$ Entitlements/Memberships $\rightarrow$ Legal Entity (`organisations`) $\rightarrow$ Trading Names (`business_names`) $\rightarrow$ Operating Books (`books`) $\rightarrow$ Locations (`locations`).
   - General ledgers, CoA, and document numbering are partitioned by operating book (`book_id`).
3. **Server-Authoritative External Onboarding**:
   - Browser `localStorage` mock authority was permanently eliminated.
   - Real Google OAuth applicant intake $\rightarrow$ stored in `platform.tenant_applications` $\rightarrow$ Starq HQ operator review queue $\rightarrow$ atomic stored procedure `platform.provision_approved_application`.
4. **Self-Service Staff Invitation Workflow**:
   - Table `public.invitations` deployed in migration `0027`.
   - Tenant administrators invite staff by email/role, inspect pending invitations, copy secure tokens, and revoke/resend access without manual backend intervention.
5. **Archetype Decoupling & Workflows Engine**:
   - Automotive workshop hardcoding was completely decoupled from generic tenants.
   - 6 canonical archetypes (`software_technology`, `general_business`, `professional_services`, `automotive_workshop`, `medical_clinic`, `marine_service`) with dynamic 5-stage workflows.
6. **Product Version SSOT & Corporate Brand Separation**:
   - Canonical product version SSOT established at `v0.2.0-beta` across all UI surfaces and diagnostics. `v1.0.0` is strictly reserved for GA.
   - Brand layers separated: `<StarqERPBrand />` (blue product mark) vs `<StarqCorporateBrand />` (official `starq-logo.png` for Starq Technologies).
7. **Personalized Dashboard Welcome**:
   - Compact dynamic greeting (`Good morning/afternoon/evening, <name>`), `Company · Book`, and real zero-state vs non-zero attention messaging.
8. **Clean-Room Public Snapshot**:
   - Published at [`almstq/starqERP-public`](https://github.com/almstq/starqERP-public) with fresh history, zero private docs, and zero secrets.

---

## 1. What Is Current & Authoritative?

| Area | Authoritative Source | Notes |
| :--- | :--- | :--- |
| **Session Changelog** | [`docs/CHANGELOG_2026-08-27.md`](./CHANGELOG_2026-08-27.md) | Technical ledger of all 27 Aug implementations |
| **Elder Command Brief** | [`docs/ELDER_RETURN_BRIEF_2026-08-28.md`](./ELDER_RETURN_BRIEF_2026-08-28.md) | Comprehensive 15-minute command orientation |
| **Product Architecture** | [`docs/architecture/overview.md`](./architecture/overview.md) | Zero-trust, two-plane SaaS model |
| **Organizational Spine** | [`docs/architecture/multi-tenancy.md`](./architecture/multi-tenancy.md) | 5-tier entity hierarchy |
| **Control Plane** | [`docs/architecture/control-plane.md`](./architecture/control-plane.md) | Starq HQ SaaS console (`platform` schema) |
| **ISO 27001 Readiness** | [`docs/qa/current/ISO_27001_READINESS_GAP_AUDIT_2026-08-27.md`](./qa/current/ISO_27001_READINESS_GAP_AUDIT_2026-08-27.md) | Comprehensive ISO/IEC 27001:2022 gap assessment |
| **Pre-SoA Matrix** | [`docs/security/ISO_27001_CONTROL_MATRIX.md`](./security/ISO_27001_CONTROL_MATRIX.md) | Annex A control implementation baseline |
| **Database Migrations** | [`supabase/migrations/`](../supabase/migrations/) | 27 versioned migrations (0001 through 0027), 100% applied on live staging |
| **Command Contracts** | [`contracts/commands.ts`](../contracts/commands.ts) | Canonical authorization contracts & version metadata (`v0.2.0-beta`) |
| **QA Baseline** | Vitest (`web/src/test/`) | 42 test files / 168+ automated tests passing cleanly |

---

## 2. What Must You NOT Touch or Regress?

1. **Do NOT revive browser `localStorage` authority**: Business applications, tenant provisioning, and command authorization are strictly server-authoritative.
2. **Do NOT conflate Starq HQ with Starq Technologies tenant**:
   - `Starq HQ` is the SaaS Control Plane (`activePlane === 'platform'`).
   - `Starq Technologies Pvt Ltd` is a customer legal entity / tenant (`activePlane === 'tenant'`).
3. **Do NOT grant platform access via tenant roles**: A tenant `managing_director` or `super_admin` role has zero authority in Starq HQ unless granted an explicit record in `platform.operator_principals`.
4. **Do NOT alter live applied migrations (0001–0027)**: Any new schema change requires migration `0028+`.
5. **Do NOT mix product and corporate branding**: `starqERP` is the product; `Starq Technologies Pvt Ltd` is the corporate builder.

---

## 3. What Is Next?

1. **Vercel Staging Deployment**: Update staging environment pointing to live Supabase Edge Function `starq-api`.
2. **Manual External-User Acceptance Test**:
   - Friend (Device A) logs in via Google $\rightarrow$ submits business application.
   - Founder (Device B) reviews in Starq HQ $\rightarrow$ approves.
   - Friend (Device A) refreshes $\rightarrow$ operates provisioned tenant with 100% isolation.
3. **Canonical Board Tasks**:
   - **SERP-125**: Reserved for Elder.
   - **SERP-290** through **SERP-297**: Core double-entry accounting engine & MIRA GST-201 export schedule.
