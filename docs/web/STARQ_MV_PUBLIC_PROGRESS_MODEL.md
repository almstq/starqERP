# starq.mv — Public Progress & Capability Milestone Model

**Document Status**: Authoritative Public Roadmap & Progress Specification  
**Public Route**: `https://starq.mv/progress`  
**Date**: 2026-08-27  

---

## 1. Public Capability Gates Framework

The public progress tracker presents starqERP and Starq Technologies engineering maturity through structured capability gates rather than internal ticket numbers.

```
┌────────────────────────────────────────────────────────────────────────┐
│             starqERP Commercial Capability Roadmap (G1–G4)             │
├───────────────┬───────────────┬────────────────┬───────────────────────┤
│ Gate 1 (G1)   │ Gate 2 (G2)   │ Gate 3 (G3)    │ Gate 4 (G4)           │
│ Commercial    │ ERP           │ Maldives       │ Scale &               │
│ Pilot Ready   │ Replacement   │ Advantage      │ Enterprise            │
├───────────────┼───────────────┼────────────────┼───────────────────────┤
│ Progress: 92% │ Progress: 35% │ Progress: 10%  │ Progress: 0%          │
│ Status: Active│ Status: Next  │ Status: Planned│ Status: Future        │
└───────────────┴───────────────┴────────────────┴───────────────────────┘
```

---

## 2. Gate Definitions & Authoritative Criteria

### Gate 1 (G1): Commercial Pilot Readiness (Current Milestone — 92% Complete)
- **Target Outcome**: Controlled design-partner and friend staging onboarding with absolute tenant isolation.
- **Key Capabilities**:
  - [x] Multi-tenant PostgreSQL Row-Level Security (`organisation_id`)
  - [x] Two-plane schema separation (Starq HQ Control Plane vs Tenant ERP)
  - [x] 5-tier entity spine & multi-book double-entry architecture
  - [x] Server-authoritative business application intake & atomic provisioning
  - [x] Database-backed tenant staff invitation lifecycle (`public.invitations`)
  - [x] Industry archetype decoupling (6 standard operational archetypes)
  - [x] Canonical product version single source of truth (`v0.2.0-beta`)
  - [ ] Staging end-to-end multi-device onboarding verification (In Final Verification)

### Gate 2 (G2): Complete ERP Replacement Readiness (35% Complete)
- **Target Outcome**: Full operational replacement of legacy systems (Odoo, QuickBooks, spreadsheets) for Maldivian trading and service businesses.
- **Key Capabilities**:
  - [x] Basic sales invoicing & customer ledger
  - [ ] Double-entry general ledger explorer & balanced journal posting (`SERP-291`)
  - [ ] Real-time standard Trial Balance & Balance Sheet (`SERP-292`)
  - [ ] P&L drilldown & 30/60/90+ day AR/AP aging matrices (`SERP-293`)
  - [ ] Formal credit note issuance & customer deposit allocations (`SERP-294`)
  - [ ] Bank statement CSV reconciliation (BML & MIB formats) (`SERP-296`)
  - [ ] Box-by-box MIRA GST-201 formal tax return export (`SERP-297`)

### Gate 3 (G3): Maldives Competitive Advantage (10% Complete)
- **Target Outcome**: Specialized capabilities optimized for the Maldivian geographic and commercial reality.
- **Key Capabilities**:
  - [ ] Landed cost allocation for sea-freight container imports (`SERP-310`)
  - [ ] 3-way matching procurement engine (PO vs GRN vs Supplier Bill) (`SERP-311`)
  - [ ] Inter-island multi-warehouse transfer orders (`SERP-312`)
  - [ ] Tiered customer price lists (Retail, Wholesale, Resort) (`SERP-314`)
  - [ ] MMA daily exchange rates & multi-currency USD valuation (`SERP-318`)

### Gate 4 (G4): Scale & Enterprise (Planned)
- **Target Outcome**: High-throughput multi-entity consolidation, automated dunning, and enterprise governance.

---

## 3. Product & Studio Portfolio Progress

| Product / Service | Category | Public Status | Current Progress | Public Host / Link |
| :--- | :--- | :--- | :---: | :--- |
| **starqERP** | Multi-Tenant Commercial OS | **ACTIVE DEVELOPMENT (v0.2.0-beta)** | **Gate 1: 92%** / Overall: 37% | `starq.mv/starqerp` $\rightarrow$ `erp.starq.mv` |
| **Hoadhaa** | Commercial Graph of Maldives | **EARLY-STAGE / RESEARCH** | **Phase 0: R&D & Modeling** | `hoadhaa.starq.mv` |
| **Starq Dynamics** | Professional Management Services | **AVAILABLE NOW (Scoped Engagements)** | **Operational Service** | `starq.mv/dynamics` |

---

## 4. Public Progress Transparency Rules

1. **No Raw Ticket Dumps**: Internal SERP ticket numbers (e.g., `SERP-284`) and internal engineering jargon are translated into clean, capability-driven milestone cards.
2. **Mathematical Accuracy**: Progress bars are calculated strictly from internal completed tasks divided by total milestone gate scope. No arbitrary marketing percentages.
3. **Continuous Synchronization**: Updates to the public progress page reflect merged PRs on `main` and verified staging database migrations.
