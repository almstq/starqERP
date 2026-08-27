# starqERP — Senior Engineering & Agent Start Here Guide

**Authoritative Baseline Date**: 2026-08-27  
**System Status**: Gate 1 (G1) Pre-Hosting Friend Onboarding Complete | Ready for Staging Acceptance  
**Canonical Board**: 318 Tasks (120 Done = 37.74%)

---

## 1. What Is Current & Authoritative?

| Area | Authoritative Source | Notes |
| :--- | :--- | :--- |
| **Product Architecture** | [`docs/architecture/overview.md`](./architecture/overview.md) | Zero-trust, two-plane SaaS model |
| **Organizational Spine** | [`docs/architecture/multi-tenancy.md`](./architecture/multi-tenancy.md) | 5-tier entity hierarchy: Identity → Entitlement/Memberships → Legal Entity → Trading Name → Operating Book → Location |
| **Control Plane** | [`docs/architecture/control-plane.md`](./architecture/control-plane.md) | Starq HQ SaaS console (`platform` schema) strictly segregated from tenant ERP (`public` schema) |
| **Canonical Roadmap** | [`docs/roadmap/COMMERCIAL_READINESS_MASTER_ROADMAP.md`](./roadmap/COMMERCIAL_READINESS_MASTER_ROADMAP.md) | G1 → G4 Milestone structure (318 tasks) |
| **Database Migrations** | [`supabase/migrations/`](../supabase/migrations/) | 26 versioned migrations (0001 through 0026), 100% applied on live staging Supabase |
| **API Gateway** | [`supabase/functions/starq-api/index.ts`](../supabase/functions/starq-api/index.ts) | Edge router validating command contracts, Google OIDC claims, and signed sessions |
| **Command Contracts** | [`contracts/commands.ts`](../contracts/commands.ts) | Single-source-of-truth authorization schemas & command signatures |
| **QA Baseline** | [`docs/qa/current/QA_SUITE_BASELINE.md`](./qa/current/QA_SUITE_BASELINE.md) | 40 test files / 161 tests passing cleanly |

---

## 2. What Should You Read First?

1. **Executive Brief**: [`docs/ELDER_RETURN_BRIEF_2026-08-28.md`](./ELDER_RETURN_BRIEF_2026-08-28.md) — Comprehensive 15-minute command orientation.
2. **Architecture**: [`docs/architecture/overview.md`](./architecture/overview.md), [`docs/architecture/multi-tenancy.md`](./architecture/multi-tenancy.md), and [`docs/architecture/control-plane.md`](./architecture/control-plane.md).
3. **UI Constitution**: [`docs/UI_CONSTITUTION.md`](./UI_CONSTITUTION.md) — Material 3 Design token system, typography, and density rules.
4. **Roadmap**: [`docs/roadmap/COMMERCIAL_READINESS_MASTER_ROADMAP.md`](./roadmap/COMMERCIAL_READINESS_MASTER_ROADMAP.md) — Current G1 execution board.

---

## 3. What Is Historical or Archived?

- **Historical Audits & Discovery Logs**: All superseded Qoder/AG audit logs, migration proposal drafts, and pre-reconciliation reports have been relocated to:
  `D:\StarqTech\_archive\starqERP\2026-08-27_pre-Elder-reset\`
- **Clean-Room Public Snapshot**: Located at `D:\StarqTech\starqERP-public` (pushed to `almstq/starqERP-public`). It is a frozen, sanitized technical preview and must **NOT** be used for internal development or receive internal audits.

---

## 4. What Must You NOT Touch or Regress?

1. **Do NOT revive browser `localStorage` authority**: Business applications, tenant provisioning, and command authorization are strictly server-authoritative.
2. **Do NOT conflate Starq HQ with Starq Technologies tenant**:
   - `Starq HQ` is the SaaS Control Plane (`activePlane === 'platform'`).
   - `Starq Technologies Pvt Ltd` is a customer legal entity / tenant (`activePlane === 'tenant'`).
   - `Club Ignition Pvt Ltd` is a customer legal entity / tenant (`activePlane === 'tenant'`).
3. **Do NOT grant platform access via tenant roles**: A tenant `managing_director` or `super_admin` role has zero authority in Starq HQ unless granted an explicit record in `platform.operator_principals`.
4. **Do NOT alter live applied migrations (0001–0026)**: Any new schema change requires migration `0027+`.

---

## 5. What Is Next?

1. **Vercel Staging Deployment**: Deploy the web app to the staging URL pointing to live Supabase Edge Function `starq-api`.
2. **Manual External-User Acceptance Test**:
   - Friend (Device A) logs in via Google → submits business application.
   - Founder (Device B) reviews in Starq HQ → approves.
   - Friend (Device A) refreshes → operates provisioned tenant with 100% isolation from other tenants.
3. **Canonical Board Tasks**:
   - **SERP-125**: Reserved for Elder.
   - **SERP-286**: Tenant-admin self-service staff invitation and lifecycle workflow (`public.invitations`).
   - **SERP-287**: Removal of hardcoded backend staff allowlist dependency.
