> Historical reference — this dated session artifact is retained for provenance and is not current operating guidance.

# starqERP Engineering Session Ledger — 27 August 2026

**Date**: 2026-08-27  
**Author**: Lead Engineering Agent  
**Session Scope**: Architectural Realignment, Two-Plane SaaS Separation, Enterprise Multi-Tenancy, Authoritative Onboarding, Staff Lifecycle, Archetype Decoupling, Version SSOT, Corporate Identity, and ISO 27001 Readiness Gap Assessment  
**Private Main Commit Baseline**: `7c05723`  
**Live Staging Migration Ceiling**: `202608270027_staff_invitations.sql` (100% applied)  
**Quality Baseline**: 42 test files, 168+ automated Vitest tests passing, 0 TypeScript compilation errors  

---

## 1. Executive Summary of Today's Transformation

On 27 August 2026, starqERP underwent a fundamental transformation from an exploratory single-tenant garage prototype into an authoritative, enterprise-ready, two-plane multi-tenant SaaS commercial operating system tailored specifically for Maldivian enterprises.

All mock and browser-local authority models were permanently dismantled in favor of cryptographically verified Google OIDC edge routing, PostgreSQL stored procedures, and strict schema isolation between the **Starq HQ SaaS Control Plane** (`platform` schema) and the **Tenant ERP Execution Plane** (`public` schema).

---

## 2. Major Decisions & Technical Implementations

### A. Two-Plane SaaS Architecture & Starq HQ Control Plane
- **Decision**: Physically and logically segregate SaaS platform governance (fleet management, application intake, tenant provisioning, operator entitlement) from customer tenant operations.
- **Implementation**:
  - Established `platform` schema in PostgreSQL with tables: `platform.tenant_applications`, `platform.operator_principals`, and stored procedure `platform.provision_approved_application`.
  - Added `activePlane: 'tenant' | 'platform'` routing in client UI. When `activePlane === 'platform'`, `StarqHQShell` renders a dedicated operator console with real live metrics and application queues.
  - Required explicit `session.platform_entitlement` verified server-side at the Edge Function gateway (`starq-api`). Tenant `super_admin` or `managing_director` roles hold zero platform operator privileges.
- **Evidence**: Migration `0024_platform_schema.sql`, `web/src/components/platform/StarqHQShell.tsx`, `web/src/test/serp_284_platform_schema.test.tsx`.
- **Task/SERP**: `SERP-284`, `SERP-298`.
- **Runtime State**: Live on Staging Supabase (`wthabguvueewgtabjsdo`).

### B. 5-Tier Organizational Spine & Multi-Book Architecture
- **Decision**: Support complex corporate structures (e.g. single corporate group running multiple business lines or locations).
- **Implementation**:
  - Implemented 5-tier entity model: Identity (`auth.users`) $\rightarrow$ Entitlement / Memberships (`organisation_memberships`) $\rightarrow$ Legal Entity (`organisations`) $\rightarrow$ Trading Names (`business_names`) $\rightarrow$ Operating Books (`books`) $\rightarrow$ Locations (`locations`, `book_locations`).
  - Partitioned general ledgers, charts of accounts, and document numbering sequences by operating book (`book_id`).
- **Evidence**: Migration `0025_multi_book_schema.sql`, `web/src/domain/archetypes.ts`, `web/src/context/ERPContext.tsx`.
- **Task/SERP**: `SERP-284`, `SERP-285`.
- **Runtime State**: Applied on Staging; active book switching fully functional with live book badge.

### C. Server-Authoritative External Onboarding & Atomic Provisioning
- **Decision**: Terminate client-side fake registration and enforce server-authoritative application intake and atomic database provisioning.
- **Implementation**:
  - Created `platform.tenant_applications` queue with statuses: `pending`, `approved`, `rejected`, `info_requested`.
  - External applicant logs in via Google $\rightarrow$ submits legal entity, trading name, Tin, and archetype $\rightarrow$ stored in `platform.tenant_applications`.
  - Operator approves in Starq HQ $\rightarrow$ executes `platform.provision_approved_application(app_id, operator_id)` atomically generating the organisation, initial membership, default book, standard CoA, and seed journals.
- **Evidence**: Migration `0026_atomic_provisioning.sql`, `web/src/components/onboarding/RegisterOrganisationModal.tsx`, `web/src/test/serp_285_external_onboarding.test.tsx`.
- **Task/SERP**: `SERP-285`, `SERP-298`.
- **Runtime State**: Operational on Staging.

### D. Self-Service Tenant Staff Invitation & Lifecycle Workflow
- **Decision**: Replace hardcoded backend JSON allowlists with a database-backed, cryptographically signed staff invitation engine.
- **Implementation**:
  - Created table `public.invitations` with fields: `organisation_id`, `email`, `role_id`, `book_ids`, `location_ids`, `token`, `status`, `expires_at`.
  - Tenant administrators can invite new staff, inspect pending invitations, copy secure invitation links, resend invitations, or revoke tokens before acceptance.
- **Evidence**: Migration `0027_staff_invitations.sql`, `web/src/components/settings/UsersManagementTab.tsx`, `web/src/test/serp_286_staff_invitations.test.tsx`.
- **Task/SERP**: `SERP-286`.
- **Runtime State**: Applied on Staging; verified in Settings > Users & Staff.

### E. Industry Archetype Decoupling & Dynamic Workflows
- **Decision**: Purge automotive workshop hardcoding from non-automotive tenants; support diverse SME operational workflows cleanly.
- **Implementation**:
  - Created 6 canonical industry archetypes in `web/src/domain/archetypes.ts`: `software_technology`, `general_business`, `professional_services`, `automotive_workshop`, `medical_clinic`, and `marine_service`.
  - Dynamic 5-stage workflow pipelines configurable per book.
  - Removed shop-floor and bay scheduling terminology from software/general business books.
- **Evidence**: `web/src/domain/archetypes.ts`, `web/src/components/settings/WorkflowsConfigTab.tsx`, `web/src/test/serp_288_archetype_decoupling.test.tsx`.
- **Task/SERP**: `SERP-288`.
- **Runtime State**: Operational across all tenant views.

### F. Product Version Single Source of Truth (SSOT)
- **Decision**: Establish strict version truth. "Enterprise-ready SaaS" is a capability posture, not a version number. SemVer `v1.0.0` is strictly reserved for true General Availability (GA).
- **Implementation**:
  - `STARQ_ERP_CANONICAL_METADATA` in `contracts/commands.ts` set to `version: '0.2.0'`, `releaseTrack: 'beta'`.
  - Exported `getFormattedProductVersion()` deriving canonical `v0.2.0-beta`.
  - Purged hardcoded `v1.0` and stale `0.0.0` from `LoginPage.tsx`, `AppShell.tsx`, `AboutTab.tsx`, and `web/package.json`.
  - Injected build commit SHA (`7c05723`) and environment into About tab diagnostics.
- **Evidence**: `contracts/commands.ts`, `web/src/test/serp_032_product_metadata.test.tsx`.
- **Task/SERP**: `SERP-032`, `SERP-338`.
- **Runtime State**: Unified `v0.2.0-beta` rendered consistently across all UI surfaces.

### G. Corporate vs. Product Brand Hierarchy
- **Decision**: Disentangle `starqERP` (the multi-tenant product) from `Starq Technologies Pvt Ltd` (the company/builder/software studio).
- **Implementation**:
  - `<StarqERPBrand />`: Blue product container mark + `starq` + `ERP` badge (used on product headers, app shells, login hero).
  - `<StarqCorporateBrand />`: Official corporate logo asset (`starq-logo.png`) representing Starq Technologies (used on login footer, copyright notices, and About Corporate Entity card).
- **Evidence**: `web/src/components/brand/StarqLogo.tsx`, `web/src/app/LoginPage.tsx`, `web/src/components/settings/AboutTab.tsx`.
- **Task/SERP**: `SERP-338`.
- **Runtime State**: Clean corporate identity treatment in production UI.

### H. Dashboard Personalized Welcome Banner
- **Decision**: Render an authoritative, compact personalized welcome banner directly in the dashboard hero.
- **Implementation**:
  - Greeting: Dynamic time-of-day greeting (`Good morning`, `Good afternoon`, `Good evening`).
  - User: Given name from authenticated user session (`session.name` $\rightarrow$ `currentUser.name`).
  - Company & Book: `currentTenant.legalName` · `currentBook.code` (e.g. `Starq Technologies Private Limited · STQ`).
  - Attention State: Dynamic count from live `alerts.length` (truthful zero-state: `"No items require your attention right now."`).
- **Evidence**: `web/src/components/dashboard/DashboardView.tsx`, `web/src/test/serp_338_dashboard_welcome.test.tsx`.
- **Task/SERP**: `SERP-338`.
- **Runtime State**: Live on dashboard hero.

---

## 3. Evidence, Tests, PRs, and Migration Matrix

| Artifact / Area | Commit / Identifier | State | Verification Method |
| :--- | :--- | :---: | :--- |
| **PR #10 (Platform Realignment)** | `7c05723` | Merged into main | All CI gates green |
| **Migration 0024 (Platform Schema)** | `202608270024_platform_schema.sql` | Applied on Staging | Staging Supabase DB verified |
| **Migration 0025 (Multi-Book Schema)** | `202608270025_multi_book_schema.sql` | Applied on Staging | Staging Supabase DB verified |
| **Migration 0026 (Atomic Provisioning)** | `202608270026_atomic_provisioning.sql` | Applied on Staging | Staging Supabase DB verified |
| **Migration 0027 (Staff Invitations)** | `202608270027_staff_invitations.sql` | Applied on Staging | Staging Supabase DB verified |
| **Public Snapshot Clean-Room** | `almstq/starqERP-public` | Released (`v0.2.0-beta`) | Sanitized git history, 0 secret leaks |
| **Automated Test Suite** | Vitest (`web/src/test/`) | 42 files, 168+ passed | `npx vitest run` |
| **Typecheck & Linter** | `tsc --noEmit` | 0 errors | `npm --prefix web run lint` |

---

## 4. Remaining Work & Next Milestones

1. **Vercel Staging Deployment**: Update environment variables on Vercel pointing to Supabase Edge Function `starq-api`.
2. **First External Friend Onboarding E2E**: Perform live cross-device validation of applicant intake $\rightarrow$ operator approval $\rightarrow$ workspace provisioning.
3. **Canonical Board Execution (G1 Milestone)**:
   - `SERP-125`: Reserved for Elder.
   - `SERP-290` through `SERP-297`: Core double-entry accounting engine & MIRA GST-201 export schedule.
