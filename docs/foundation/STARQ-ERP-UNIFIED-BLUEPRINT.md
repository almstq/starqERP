<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document is SUPERSEDED and is retained as history only.**
>
> Pre-28-Sep blueprint. Do not use it to plan, implement, review or decide current StarqERP work.
>
> **Current development SSOT:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](../governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
> **Current roadmap:** [`ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`](../roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md)
> **Supersession index:** [`SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md`](../governance/SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md)
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

# SERP-BP-001 — Unified STARQ ERP blueprint

Version: 1.0  
Status: founder-directed working baseline  
Effective date: 2026-08-20

## Product decision

STARQ ERP is one AI-native, multi-tenant business operating system. `legacy/engine` is a transitional repository and evidence label, not a second product. `STARQ POS` is retired as a separate product track; counter sales become an optional ERP capability. Existing code, tests, journals and pilot evidence are preserved and mapped into the unified ERP.

## Main base (M0)

```text
STARQ ERP Base
├─ Legal-tenant registry and configuration
├─ Operating units, outlets, brands and locations
├─ Identity, memberships, roles, seats and module entitlements
├─ Server-authoritative API, sessions, CSRF and idempotency
├─ Tenant isolation, policy checks, approvals and SoD
├─ Audit/event history, documents, notifications and search
├─ Common masters: contacts, catalog, tax, currency and units
├─ Accounting-consequence contracts and reporting dimensions
├─ Migration, backup, restore, observability and security controls
└─ AI control plane: scoped agents, typed proposals, grants and kill switch
```

All applications, integrations and agents use this base through one controlled API. No module owns its own identity, tenant checks, database connection, audit system or approval engine.

## Organisation model

| Layer | Meaning | Examples |
|---|---|---|
| Legal tenant | Own books, tax profile, memberships and data boundary | Starq Technologies, Club Ignition, future sole proprietor/partnership/company |
| Operating unit/activity | Business activity inside a legal tenant | Starq Dynamics administration/services; Starq coding activity |
| Outlet/trading operation | Site or trading identity below the tenant | Ignition Ink workshop; future branches |
| Module entitlement | Capability switched on for that tenant/outlet | Service, stock, finance, counter, projects |

Starq Technologies is rollout tenant one, not a privileged bypass. Club Ignition is tenant two. Both pass the same tenant-isolation controls. Future tenants may use a legitimate company, partnership or sole-proprietor legal profile; registration and tax details are configuration, never hardcoded assumptions.

## Internal modules

| Order | Module | Responsibility |
|---|---|---|
| M0 | Main base | Tenancy, security, audit, workflow, API and recovery |
| M1 | Organisation setup | Legal profile, activities, brands, outlets, roles and module switches |
| M2 | Service operations | Calls, bookings, assets/vehicles, estimates, jobs, labour, QC and handover |
| M3 | Commercial | Contacts, catalog, quotations, invoices, payments and CRM |
| M4 | Purchasing and stock | Requisition, supplier, PO, receipt, bills, movements and counts |
| M5 | Finance | Chart, proposals, expenses, receivables/payables, bank, tax and reports |
| M6 | Counter | Cart, barcode, tender, cash session, receipts and refunds |
| M7 | Management | Job costing, projects, analytics, budgets, assets and consolidation |
| M8 | AI control plane | Extraction, forecasting, reconciliation, next-play and approved automation |
| M9 | Extended ERP | HR/payroll, warehouse, manufacturing and external integrations |

## Part-by-part development rule

We build every ERP part, but never as one big-bang rewrite. A stage becomes usable, tested, documented, tenant-safe and recoverable before its next stage depends on it. New work extends the same base and reuses the same masters, workflow, audit and accounting-consequence contracts.

| Development stage | Module slice | What becomes usable |
|---|---|---|
| 0 | M0/M1 base | Organisation, user, outlet, role, branding and security boundary |
| 1 | M5 finance kernel | Chart, journals/proposals, expenses, receivables/payables and basic reports |
| 2 | M4 inventory | Items, locations, stock movement, count and valuation foundation |
| 3 | M6 counter | Sale, tender, receipt, cash session and controlled return/refund |
| 4 | M3 commercial + purchasing | Quote, order, invoice, supplier, PO, receipt and bill |
| 5 | M3 CRM | Lead, opportunity, follow-up and customer history |
| 6 | M1/M7 multi-branch | Branch/outlet stock, staff and consolidated tenant reporting |
| 7 | M9 HR/payroll | Employee, time, payroll and controlled financial consequence |
| 8 | M7 projects/job costing | Margin, cost allocation, service and project control |
| 9 | M9 warehouse | Bins, transfers, reservations, pick/pack and replenishment |
| 10 | M9 manufacturing/service depth | BOM, work centres, production/service costing and quality |
| 11 | Full ERP platform | Mature module composition, integrations and governed AI leverage |

The garage needs a usable workflow now, so M2 service operations is the cross-cutting pilot slice alongside stages 0-3. It proves tenant boundaries, contacts, services, stock, labour, approvals and financial consequences on real work without waiting for every accounting or warehouse feature.

## Runtime rule

After login, the server resolves the permitted tenant. STARQ ERP loads that tenant's brand, outlets, modules, roles and next legal action. A person with one tenant sees no organisation picker. A person with more than one makes an explicit, audited switch. Client-supplied tenant IDs are never trusted.

For Ignition Ink, M2 supports call -> booking -> intake -> estimate -> approval -> job -> parts/labour -> QC -> invoice -> payment -> close. For Starq Technologies, the same base supports service work, administration, projects and finance control without a different application.

## AI-native rule

Agents observe, extract, reconcile, forecast and propose. The deterministic base verifies tenant, permission, state, amount, segregation of duties, idempotency and approval before committing anything. Natural-language output is never executable authority.

Automation begins with A0/A1: observe and propose with evidence. Reversible low-risk automation requires a tested scoped grant. Payments, journals, permissions, external representation, bulk export and deletion always require explicit human approval. Fully autonomous consequential operation is prohibited.

## Release slices

1. **R0 — cloud-client connectivity preflight:** Finish R2.2 secure native session persistence, cloud acceptance and real owner sign-in. This proves a bounded client/API path only: no real business records, tenant onboarding, pilot operation, or enabled AI write principal. A preview is not a release.
2. **R1 — dual-tenant spine:** Build M0/M1 across schema, API, web and Flutter; seed Starq Technologies and Club Ignition; prove cross-tenant denial, server-side SoD and attributable audit foundations automatically.
3. **R2 — measured internal pilot:** Only after R1 and a successful encrypted backup/scratch-restore rehearsal, use M2/M3/M4 for controlled Starq Dynamics and Ignition Ink activity.
4. **R3 — financial consequence:** Build M5 proposals, reconciliation, tax rules and reports from pilot evidence; auto-posting remains founder-gated.
5. **R4 — AI operating leverage:** Enable M8 A0/A1 capabilities with provenance, evaluation, monitoring and revocation.
6. **R5 — external onboarding:** Add a tenant only after isolation, restore, support and security gates pass.
7. **R6+ — breadth:** Add counter, projects, CRM, HR/payroll, warehouse, manufacturing and integrations only as evidence proves the need.

## Transition rules

1. Stop new product planning under separate `legacy/engine` or `STARQ POS` tracks.
2. Preserve their code and evidence; map useful work into M0-M9 instead of rewriting it.
3. Rename public branding, package IDs, OAuth clients and repositories only in a dedicated migration.
4. STARQ ERP is the only active delivery roadmap in StarqNexus. Historical boards become read-only evidence and link here.
5. STARQ ERP is ISO-aligned in engineering approach; it is never described as ISO certified, infallible or hack-proof.

## Multi-agent delivery council

This is a large ERP programme. No single implementation agent approves its own work, and Codex plus AG are not the whole delivery team.

| Role | Standing responsibility |
|---|---|
| Founder | Business policy, legal/tax decisions, tenant facts, risk acceptance and irreversible approval |
| Elder / Claude Code | Product integrity, accounting/control doctrine, risk challenge, roadmap coherence and independent module acceptance |
| Codex | Day-to-day technical coordinator under Founder/Elder direction; main-base architecture, cloud/security boundaries, tenancy, integration contracts, evidence and technical acceptance |
| Antigravity (AG) | Flutter/web client delivery, device UX, transport boundaries and client test/build evidence |
| DP (WSL; bus `hermes`) | Context/evidence research and STARQ ERP board stewardship; no self-acceptance or unapproved infrastructure work |
| Vision (Windows; bus `vision`) | Founder-facing comms, concise verified status and durable handoffs; no technical implementation or release acceptance unless explicitly assigned |
| Cursor | Bounded implementation/research when available; historical messages do not create new authority |
| Future specialist agents | Bounded module work only, under a named owner and an independent acceptance gate |

Every Kanban task has a named owner, a dependency, an acceptance condition and an independent reviewer where the work is material. Authority flows Founder → Elder / Claude Code → Codex → delivery workers. The founder resolves business policy; Elder / Claude Code and Codex may reject implementation evidence within their respective control domains.

## Success condition

Starq Technologies and Club Ignition operate in their own branded tenants with no data or action crossing the boundary. Every module composes through M0, recovery works, financial consequences are traceable and AI removes routine work without bypassing controls.
