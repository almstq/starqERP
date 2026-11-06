<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document REMAINS VALID and is extended, not superseded, by the 28 Sep 2026 course correction.**
>
> Product README. Product description remains accurate; a doctrine banner has been added because the README is a natural cold-boot entry point. Follow the extension below where it touches StarqERP completion doctrine.
>
> **Current development SSOT:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](docs/governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
> **Current roadmap:** [`ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`](docs/roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md)
> **Supersession index:** [`SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md`](docs/governance/SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md)
>
> **What changed on 28 Sep 2026:** StarqERP development was stopped and the completion model
> was corrected from *complete the remaining modules* to *close the remaining business
> processes*. The five canonical ERP process chains are Order-to-Cash, Procure-to-Pay,
> Inventory-to-GL, Cash-to-Bank and Record-to-Report. This is **convergence, not rewrite** —
> all existing architecture, migrations, tests, evidence and completed tasks remain valid.
> **StarqERP implementation is ON HOLD** pending explicit Founder restart authorization.
>
> **Original content is preserved verbatim below.** Nothing was removed or rewritten.
>
---

# starqERP

> **Modern, Multi-Tenant SME Operating System & ERP for the Maldives**  
> Built on PostgreSQL Row-Level Security, Supabase Edge Functions, React 19, and Material 3 Design.

---

## Overview

### What It Is
**starqERP** is a full-stack, multi-tenant Enterprise Resource Planning (ERP) platform designed for small-to-medium enterprises (SMEs) operating in the Maldives. It unifies commercial operations, inventory control, job card and service workflow management, double-entry bookkeeping, and Maldives Inland Revenue Authority (MIRA) GST compliance into a cohesive, high-performance web experience.

### Why It Exists
Most legacy ERP systems deployed across the Maldives and developing island economies suffer from severe operational friction:
1. **Disconnected Systems**: Point-of-sale, workshop job cards, accounting, and tax filing operate in isolated silos, causing reconciliation errors and delayed reporting.
2. **Missing Local Compliance**: General-purpose international accounting packages lack native support for Maldivian BPT, TGST, and General GST tax period filings and currency rules.
3. **Rigid Organizational Models**: Traditional software struggles to accommodate modern island businesses where a single holding company operates multiple diverse business activities (e.g., an automotive workshop and a software consultancy) sharing physical facilities.

**starqERP** solves this by establishing a mathematically rigorous, zero-trust organizational spine with native multi-book architecture.

---

## Two-Plane Architecture Model

starqERP separates the SaaS platform into two strictly segregated operating planes:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      starqERP Architecture Model                       │
├──────────────────────────────────┬─────────────────────────────────────┤
│      Starq HQ Control Plane      │      Tenant ERP Execution Plane     │
│   (SaaS Operator Perspective)    │    (Business Owner Perspective)     │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • Tenant Lifecycle & Provisioning│ • Commercial Sales & Invoicing      │
│ • Subscription Plans & Billing   │ • Service Workflow & Job Cards      │
│ • Platform Usage & Telemetry     │ • Real-time Inventory Valuation     │
│ • Cross-Tenant Security Audit    │ • Double-Entry Journal Postings     │
│ • Verification & Onboarding      │ • Maldives MIRA GST Tax Filing      │
└──────────────────────────────────┴─────────────────────────────────────┘
```

- **Starq HQ Control Plane (`activePlane === 'platform'`)**: Accessible **strictly** via explicit platform operator entitlement (`session.platform_entitlement`). It provides the SaaS management tools required to provision, monitor, bill, and govern tenants across the cluster.
- **Tenant ERP Execution Plane (`activePlane === 'tenant'`)**: The operational day-to-day workspace where business owners, accountants, inventory clerks, and technicians run business operations within strictly isolated tenant boundaries.

---

## Organizational & Authority Hierarchy

starqERP implements a strict 5-tier entity spine:

$$\text{Identity} \longrightarrow \begin{matrix} \text{Platform Entitlement} \\ \text{and/or} \\ \text{Tenant Memberships} \end{matrix} \longrightarrow \text{Legal Entity} \longrightarrow \text{Business / Trading Name} \longrightarrow \text{Operating Book} \longrightarrow \text{Location / Facility}$$

1. **Identity & Principal**: Authenticated user identity (via verified Google Workspace account).
2. **Platform Entitlement & Tenant Memberships**: Determines whether the principal operates at the platform SaaS plane or within specific customer organizations.
3. **Legal Entity (`organisations`)**: The registered corporate entity holding legal liability, tax registration (TIN), and bank accounts.
4. **Business / Trading Names (`business_names`)**: Registered trading names operating under the legal entity.
5. **Operating Books (`books`)**: Discrete double-entry ledgers corresponding to specific commercial activities (e.g., *Automotive Workshop*, *General Retail*, *Software Engineering*).
6. **Locations & Facilities (`locations`, `book_locations`)**: Physical workshops, warehouses, and counters mapped to one or more operable books.

---

## Core Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Material 3 Adaptive Layout System, Lucide Icons, Vite.
- **Backend & API Gateway**: Supabase Edge Functions (Deno runtime), TypeScript Shared Command Contracts, HMAC Session Security.
- **Database & Storage**: PostgreSQL 15+ with strict Row-Level Security (RLS), Composite Foreign Keys, Immutable Append-Only Audit & Ledger Triggers.
- **Identity & Access**: Google Identity Services (OAuth 2.0 / OpenID Connect), Platform-Audience Verification, Cryptographic Session Boundaries, and Segregated Platform/Tenant Authorization.

---

## Implementation & Release Status

### Canonical Roadmap Snapshot
*Baseline Snapshot Date: 2026-09-10 | Release: v0.2.0-beta*

| Milestone Gate | Scope & Focus | Status |
| :--- | :--- | :--- |
| **Gate 1 (G1)** | **Commercial Pilot Readiness** — Dual-tenant spine, RLS isolation, session boundaries, inventory valuation, job workflows, invoice lifecycle. | **Active / Near Completion** |
| **Gate 2 (G2)** | **ERP Replacement Readiness** — Full double-entry general ledger, bank reconciliations, multi-currency purchasing, audit trail immutability. | **Active** — tenant-scoped cash-flow and bank reconciliation are on `main` (see recently merged PRs). Remaining Finance stacks (journals COGS mapping, credit-note CoA, migration collision remediation) are still Founder-gated and **not** merged. G2 is not closed; accountant review (SERP-346) is not claimed done. |
| **Gate 3 (G3)** | **Maldives Competitive Advantage** — Native MIRA GST filing integration, Dhivehi localization, BML payment gateway, offline sync resilience. | **Partially delivered** — GST-201, Dhivehi print and Favara QR merged; offline sync still planned |
| **Gate 4 (G4)** | **Enterprise Scale & Governance** — Multi-region replication, automated continuous compliance, high-availability tenancy failover. | **Planned** |

*Canonical Board Progress (snapshot, not live): **186 of 388 tasks completed (~47.9%)** as recorded in the Nexus board SSOT `starqNexus/data/starq-erp-tasks.json` (`updated_at` 2026-09-08). This README does not auto-refresh; treat the figure as accurate as of that board file, not as a real-time feed. This docs update does not mutate the board.*

### Recently merged on `main` (as of 2026-09-10)

`origin/main` at docs baseline: `e341e83429490122801b57caa06bf32071661467`.

| PR | What landed | Merge commit |
| :--- | :--- | :--- |
| [#123](https://github.com/almstq/starqERP/pull/123) | PACKET-3+4 bank/CoA tenant-scoping | `5049b30` |
| [#124](https://github.com/almstq/starqERP/pull/124) | PACKET-5 cash-flow + bank-reconciliation tenant isolation | `f040561` |
| [#122](https://github.com/almstq/starqERP/pull/122) | SERP-314 invoice price auto-resolve from customer tier | `e341e83` |

Candidate `bc6d5fc` is **not** marked retired in this file; that is a Finance-register decision after AG records it.

### Separate beta lane (not Finance kernel)

UI / data-provenance smoke-test findings (invoice default garage line item, missing supplier-create path, demo vs live distinction on Multi-Currency and Green Tax, generic wording, GL information styling) are a **separate beta cleanup lane**. They are not part of the Finance packet merges above and are not claimed fixed here.

---

## Security & Tenant Isolation Model

starqERP is built upon zero-trust architectural principles:

- **Row-Level Security (RLS)**: Every tenant-facing database table enforces RLS filtered on `organisation_id = auth.current_org()`.
- **Composite Tenant-Safe Foreign Keys**: Foreign keys across operating books and execution records enforce composite integrity `(organisation_id, id)`.
- **Immutable Append-Only Records**: Audit logs, security events, job event history, and general journal entries are guarded by PostgreSQL database triggers that reject `UPDATE` and `DELETE` mutations.
- **Session Cryptography & CSRF**: Authenticated sessions are HMAC-SHA256 signed, transmitted via `HttpOnly; Secure; SameSite=None` cookies, and validated on every state-changing mutation with cryptographic CSRF challenge tokens.
- **Segregation of Duties (SoD)**: 12 standardized system seats (e.g. `managing_director`, `financial_controller`, `quartermaster`, `technician`) enforce separation of privileges across purchasing, payment disbursement, and inventory issuance.

---

## Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ or v22+
- [npm](https://www.npmjs.com/) v10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) v2.100+
- [Docker Desktop](https://www.docker.com/) (for local database emulation)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/almstq/starqERP.git
cd starqERP
npm --prefix web install
```

### 2. Configure Environment Variables
Copy the example environment configuration:
```bash
cp web/.env.example web/.env.local
```
Update `web/.env.local` with your local development parameters:
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

### 3. Start Local Supabase Stack & Apply Migrations
```bash
supabase start
supabase db reset
```

### 4. Run Development Server
```bash
npm --prefix web run dev
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## Verification & Testing

starqERP maintains a comprehensive automated testing suite across frontend components, database policies, and API contracts:

```bash
# Run frontend unit & component regression tests (Vitest)
npm --prefix web test

# Run TypeScript typechecks and linter
npm --prefix web run lint

# Run database migration verification suites
node --test tests/migrations_0024_0025_verification.test.mjs

# Run responsive layout & viewport tests
node --test tests/ui_responsive_system.test.mjs

# Verify the production build compiles
npm --prefix web run build
```

---

## Repository Layout

```
starqERP/
├── contracts/               # Single-source-of-truth authorization & command schemas
├── docs/                    # Architecture, security, and developer documentation
│   ├── architecture/        # Domain, multi-tenancy, and accounting models
│   ├── development/         # Setup, testing, and migration guides
│   ├── security/            # Zero-trust, MFA, and RLS specifications
│   └── roadmap/             # Canonical public capability milestones
├── supabase/                # Database migrations, seed data, and Edge Functions
│   ├── functions/starq-api/ # Edge API gateway and session resolvers
│   └── migrations/          # Versioned PostgreSQL database migrations
├── tests/                   # Security probes, isolation fixtures, and contract tests
└── web/                     # React 19 / TypeScript / Material 3 web application
    └── src/
        ├── app/             # Application shell, router, and login surfaces
        ├── components/      # Domain views (Dashboard, Jobs, Invoicing, Platform HQ)
        ├── context/         # Auth, ERP workspace, and theme state providers
        ├── domain/          # Business archetypes and entity models
        ├── lib/             # Bookkeeping calculations and utilities
        ├── services/        # API gateway, telemetry, and auth clients
        └── test/            # Vitest unit and regression test specifications
```

---

## Contributing & License

### Contributing
Contributions and security vulnerability reports are welcome. Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`SECURITY.md`](./SECURITY.md) before submitting pull requests or vulnerability disclosures.

### License
Copyright © 2026 Starq Technologies Pvt Ltd. All rights reserved.  
Distributed under the terms specified in [`LICENSE`](./LICENSE).
