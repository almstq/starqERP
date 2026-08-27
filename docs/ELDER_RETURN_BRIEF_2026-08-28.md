# starqERP — Elder Command Return Brief (28 August 2026)

**Audience**: Elder (Senior Engineering Reviewer / Command)  
**Author**: Lead Engineering Agent  
**Baseline Date**: 2026-08-27 / 2026-08-28  
**System State**: Pre-Hosting Friend Onboarding Vertical Slice Complete | Ready for Staging Acceptance  
**Private Canonical Repository**: `almstq/starqERP` (`main` @ `4ad2f5a`)  
**Public Technical Preview**: `almstq/starqERP-public` (`v0.2.0-beta`)

---

## 1. Executive Situation

starqERP has completed its architectural realignment from an exploratory single-tenant garage tool into a true **two-plane multi-tenant SaaS ERP platform** designed for the Maldives. 

The system now features:
- **Logical & physical two-plane separation**: Starq HQ Platform Control Plane (`platform` schema) vs Tenant ERP Execution Plane (`public` schema).
- **5-tier organizational spine**: Identity → Platform Entitlement / Tenant Memberships → Legal Entities (`organisations`) → Trading Names (`business_names`) → Operating Books (`books`) → Locations (`locations`).
- **Server-authoritative external onboarding**: Real Google OAuth applicant sign-in, server persistence (`platform.tenant_applications`), Starq HQ operator review queue, and atomic database provisioning procedure `platform.provision_approved_application`.
- **Live staging migrations**: 26 versioned SQL migrations (0001 through 0026) applied 1:1 on live Supabase project `wthabguvueewgtabjsdo`.
- **Clean-room public snapshot**: Published at [`almstq/starqERP-public`](https://github.com/almstq/starqERP-public) with 0 high-confidence secret disclosures, fresh Git history, and zero internal/private governance documents.

---

## 2. What Changed Since Elder Left

1. **Elimination of Mock/Browser Authority**: Local browser `localStorage` authority for business registration, application intake, and tenant creation was completely removed and replaced with PostgreSQL stored procedures.
2. **True Two-Plane Operating Experience**: Starq HQ is rendered as a standalone SaaS control plane console when `activePlane === 'platform'`, completely isolated from customer tenant ERP operations.
3. **Multi-Book Segregation**: Migrations `0024`, `0025`, and `0026` unified the identity model, established the `platform` schema, implemented multi-book accounting partitioning, and deployed the atomic provisioning engine.
4. **Canonical Task Re-alignment**: Tasks were consolidated into a canonical 318-task baseline across four commercial milestone gates (G1–G4). Progress stands at **120 Done (37.74%)**.
5. **Quality Gate Baseline**: Expanded automated test suite to **40 test files / 161 tests** passing cleanly with 0 TypeScript compilation errors.

---

## 3. Current Product Architecture

starqERP operates as a zero-trust, cloud-native ERP platform:
- **Client**: React 19 single-page application with Tailwind CSS v4, Material 3 Adaptive Layout System, and dynamic API routing supporting local proxy and staging/production edge endpoints.
- **Edge Gateway**: Supabase Edge Function `starq-api` (Deno runtime) enforcing single-source-of-truth authorization contracts (`contracts/commands.ts`), Google OIDC JWT verification, and HMAC-SHA256 session signatures.
- **Database Engine**: PostgreSQL 15+ with strict Row-Level Security (RLS) on `organisation_id = auth.current_org()`, composite foreign keys, and immutable append-only triggers on financial ledgers and audit trails.

---

## 4. Two-Plane SaaS Model

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

## 5. Tenant / Book / Location Model

The 5-tier entity spine is structured as follows:

$$\text{Identity} \longrightarrow \begin{matrix} \text{Platform Entitlement} \\ \text{and/or} \\ \text{Tenant Memberships} \end{matrix} \longrightarrow \text{Legal Entity} \longrightarrow \text{Business Name} \longrightarrow \text{Operating Book} \longrightarrow \text{Location / Facility}$$

- **Legal Entity (`organisations`)**: Registered corporate company holding TIN, bank accounts, and statutory liability.
- **Business Names (`business_names`)**: Registered trading brands operating under the legal entity.
- **Operating Books (`books`)**: Discrete double-entry ledgers with dedicated archetype (`general_business`, `automotive_workshop`, `marine_service`, `retail_commerce`), chart of accounts, and document sequences.
- **Locations (`locations`, `book_locations`)**: Physical workshops, counters, and warehouses mapped to one or more operable books.

---

## 6. Auth & Authorization Truth

1. **Identity & Tokens**: Users sign in via Google Workspace OAuth 2.0 / OpenID Connect. `starq-api` verifies token signatures against Google public JWKS.
2. **Session Cookie**: Issues an `HttpOnly; Secure; SameSite=None` HMAC-SHA256 signed session cookie (`sb_ops_session`) with embedded CSRF nonce.
3. **Edge Flag Rationale (`--no-verify-jwt`)**: Required because the gateway authenticates Google OIDC claims and custom HMAC cookies rather than Supabase GoTrue JWTs. Internal verification ensures zero unauthenticated access.
4. **Boundary Authorization**: State-changing operations dispatch via `POST /api/ops/event` where `authorizeCommand(principal, intent)` enforces strict Segregation of Duties before invoking database RPCs.

---

## 7. Live Staging Infrastructure

- **Supabase Staging Project**: `wthabguvueewgtabjsdo` (hosted in AWS `ap-southeast-1` Singapore).
- **Edge API Gateway**: `starq-api` deployed live.
- **Live Database Migrations**: 26 migrations applied through `202608270026`.

---

## 8. Migration State through 0026

| Migration Version | Exact Filename | Status | Description |
| :--- | :--- | :--- | :--- |
| **0024** | `202608270024_platform_control_plane.sql` | **APPLIED** | Schema `platform`, `tenant_registry`, `operator_principals`, `usage_daily`, `provisioning_runs` |
| **0025** | `202608270025_books_and_operating_activities.sql` | **APPLIED** | Multi-book ledger architecture, `book_locations`, `book_memberships`, operating activities |
| **0026** | `202608270026_organisation_applications_and_provisioning.sql` | **APPLIED** | Table `platform.tenant_applications` & atomic procedure `platform.provision_approved_application` |

---

## 9. External Business Onboarding Flow

1. **Applicant Login**: External user signs in with Google → `establishPerson()` resolves `organisations: []` and returns a clean applicant session.
2. **Application Submission**: Applicant submits business details via `POST /api/onboarding/apply`. Stored in `platform.tenant_applications` with status `pending`.
3. **Queue Inspection**: Starq HQ operator inspects queue via `GET /api/platform/applications`.
4. **Atomic Provisioning**: Operator calls `POST /api/platform/applications/:id/approve` → executes procedure `platform.provision_approved_application`:
   - Creates `organisations`, `business_names`, `locations`, `books`, `book_locations`.
   - Creates owner `memberships` (`role: managing_director`, `status: active`) bound to applicant's verified `person_id`.
   - Creates `membership_seats` and `book_memberships`.
   - Instantiates workflow stages from archetype template.
   - Registers tenant in `platform.tenant_registry`.
   - Marks application `approved`.
5. **Tenant Access**: Applicant logs in/refreshes → sees newly provisioned tenant/book with 100% isolation from other tenants.

---

## 10. Starq HQ Control Plane

Navigational structure:
1. **Overview**: Key platform performance indicators, active tenant counts, MRR metrics, and system telemetry.
2. **Applications**: Incoming business registration intake queue and document verification.
3. **Tenants / Customers**: Tenant fleet management, suspension, and domain bindings.
4. **Provisioning**: Automated blueprint execution for new tenant workspaces.
5. **Subscriptions & Plans**: Plan configurations (labeled as Draft configuration / Pricing not finalized).
6. **Billing**: Invoicing and payment reconciliation for SaaS fees.
7. **Usage & Health**: System latency, database query performance, and active user concurrency.
8. **Support & Operations**: Support tickets, audit log inspection, and operational assistance.
9. **Platform Audit & Security**: Cross-tenant security incident telemetry and access audits.
10. **Platform Settings**: Cluster origins, OAuth policy, and platform configuration.

---

## 11. Commercial Readiness Reset

The commercial roadmap has been refactored into four clear milestone gates:
- **Gate 1 (G1)**: Commercial Pilot Readiness (Tasks SERP-283 → SERP-301) — *Active Focus*.
- **Gate 2 (G2)**: ERP Replacement Readiness (Tasks SERP-302 → SERP-322) — *Odoo/SAP Parity*.
- **Gate 3 (G3)**: Maldives Competitive Advantage (Tasks SERP-323 → SERP-327) — *Dhivehi/Favara/Council Moat*.
- **Gate 4 (G4)**: Enterprise Scale & Maturity (Tasks SERP-328 → SERP-336).

---

## 12. Public Repository / Developer Preview

- **Public Destination**: [`almstq/starqERP-public`](https://github.com/almstq/starqERP-public)
- **Tag**: `v0.2.0-beta`
- **Integrity**: Clean-room 1-commit repository with zero private/internal docs, no hardcoded secrets, and clear evaluation licensing.
- **Rule for Engineering**: The private repository (`almstq/starqERP`) is the sole authoritative engineering SSOT. Do not push internal refactors or drafts to the public repository.

---

## 13. Testing & CI Truth

- **Vitest Suite**: 40 test files / 161 tests passing.
- **TypeScript**: `tsc --noEmit` passing with 0 errors.
- **Automated Regression**: Multi-session test suite [`cross_device_onboarding_and_provisioning.test.ts`](file:///D:/StarqTech/starqERP/web/src/test/cross_device_onboarding_and_provisioning.test.ts) validates application intake, approval, provisioning, and isolation.

---

## 14. Canonical Board State

- **Total Tasks**: 318
- **Done**: 120 (37.74%)
- **In Progress (WIP)**: SERP-286 (Tenant-admin staff invitation and lifecycle workflow)
- **Next**: SERP-125 (Reserved for Elder)
- **Blocked**: SERP-028 (Flutter web credential boundary verification)
- **Todo**: SERP-196 (Windows MAX_PATH vault issue)
- **Planned**: 194

---

## 15. Known Risks / Remaining Gaps

1. **Staff Invitations (`SERP-286`)**: Invitation lifecycle (`public.invitations`) is in progress and required to remove the legacy allowlist fallback entirely (`SERP-287`).
2. **Financial Reporting UI (`SERP-290`–`SERP-293`)**: Database double-entry journal engine is live; general ledger explorer and balance sheet drilldown UI are next in G1.
3. **Manual Cross-Device Acceptance**: A human cross-device acceptance test with external design-partner on staging URL is required prior to broader pilot usage.

---

## 16. What Elder Owns / Reviews Next

1. **Reserved Task**: **`SERP-125`** (*Permissioned publication boundary — private by default, merchant-controlled*) remains exclusively reserved for Elder.
2. **Review Ownership**:
   - Review migration `0026` atomic provisioning procedure (`platform.provision_approved_application`).
   - Review two-plane authorization separation in `starq-api`.
   - Oversee staging deployment to Vercel and execute the friend/manual onboarding acceptance test.
   - Continue with `SERP-286` (Staff invitation lifecycle) and `SERP-287` (Allowlist removal).
