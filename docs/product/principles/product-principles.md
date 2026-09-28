<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document is CONFIRMED as governing by the 28 Sep 2026 course correction.**
>
> CONFIRMED as governing, not superseded. Principle 1 ('Accountant-Grade from Day One' - accounting as the central consequence layer) is the founding statement of the 28 Sep doctrine. Its principles are now the founding statement of the current doctrine.
>
> **Current development SSOT:** [`STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md`](../../governance/STARQERP_CONVERGENCE_DOCTRINE_2026-09-28.md)
> **Current roadmap:** [`ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`](../../roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md)
> **Supersession index:** [`SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md`](../../governance/SUPERSESSION_2026-09-28_ERP_COURSE_CORRECTION.md)
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

# StarqERP Product Principles

These principles guide all product decisions, architecture, and development for StarqERP. They are derived from the competitive research, market needs, and the founder's vision.

## 1. Accountant-Grade from Day One
**Principle**: Accounting is not a module; it is the financial spine and central consequence layer of the system.  
**Why**: Competitors like Ewity rely on external accounting (QuickBooks/Xero), creating a gap for true ERP. StarqERP must provide native double-entry accounting, MIRA-compliant tax engine, and immutable audit trail from the very first usable release.  
**Implementation**: Stage 1 delivers the finance kernel (GL, AR, AP, Banking, Reporting) with AI-assisted reconciliation and OCR. Every transaction posts itself; the cashier sees simplicity, the accountant sees traceability.

## 2. Maldives-Native First, Not Localization Sticker
**Principle**: Maldives-specific workflows (MVR/USD, date-effective tax rules, inter-island supply chain, TIN, customer/supplier credit, landed costing, Dhoni/cargo manifests, WhatsApp workflows) are first-class architecture, not optional add-ons.  
**Why**: Competitors either lack depth (Ewity) or treat localization as an afterthought via partners (Odoo). StarqERP builds these into the core domain model.  
**Implementation**: Tax engine uses date-effective rules; inventory model includes in-transit stock and discrepancy/damage workflow; payment engine supports local integrations (M-Faisaa, BML transfer); audit layer records business events with Maldives-specific context.

## 3. AI-Native, Not AI-Bolted-On
**Principle**: The AI control plane (scoped agents, typed proposals, grants, kill switch) is a first-class architectural layer that works *with* the deterministic ERP core, not as a chatbot add-on.  
**Why**: Competitors treat AI as a feature (EVETS markets AI services but appears bolt-on). StarqERP's advantage is agents performing routine ERP work while humans retain authority over consequential decisions.  
**Implementation**: A0 (Observe) and A1 (Propose) agents start in R4; A2 (Execute Bounded) for low-risk reversible actions; A3 (Governed Autonomy) requires explicit budgets/rules/authority. AI never bypasses validation, approval, SoD, or idempotency.

## 4. Simplicity Through Progressive Disclosure
**Principle**: A Maldivian business should be able to start with the foundation engine (accounting/core) cheaply, activate POS or inventory when needed, and eventually become a sophisticated StarqERP customer without leaving the platform or migrating data.  
**Why**: Competing on Ewity's simplicity requires low friction; competing on Odoo's breadth requires modularity. StarqERP does both via progressive feature activation and modular subscriptions.  
**Implementation**: Module entitlements in M0/M1; zero-config defaults; feature flags; the onboarding flow guides users from "sign up → add product → sell → print receipt" to unlocking inventory, purchasing, payroll, etc., as needed.

## 5. Modularity is Non-Negotiable
**Principle**: Speed of development (aided by AI agents) must never destroy modularity. Modules depend on stable contracts/events, not direct coupling.  
**Why**: Rapid module creation (e.g., a new vertical in days) must be safe and repeatable without destabilizing the core.  
**Implementation**: Stable domain contracts; event bus; versioned APIs; schema boundaries; capability flags; module manifests; configurable permissions; migration discipline; automated tests; shared UI/design system; shared accounting posting interface; shared audit interface; shared AI tools/actions.

## 6. Price and Local Adoption Are Core Product Requirements
**Principle**: StarqERP must be a better product at a cheaper price, with the long-term goal of getting as many Maldivian businesses as possible onto a locally built solution.  
**Why**: We are not building an expensive consultant-led ERP; we are democratizing ERP capability locally.  
**Implementation**: Optimize for very low SaaS operating cost per tenant; fast self-service onboarding; minimal implementation/consulting requirement; modular subscriptions; no forced migration; affordable entry point for micro/SMEs; enough depth for larger businesses; Maldives-native support; easy import from spreadsheets/competitor systems; easy migration from standalone POS/accounting; low training burden.

## 7. Deterministic Truth, Probabilistic Reasoning
**Principle**: AI reasons; the ERP engine validates; the workflow engine authorizes; the audit layer records.  
**Why**: Accounting, inventory, and tax truth must not be probabilistic. AI provides insights and proposals, but the deterministic base verifies before commit.  
**Implementation**: A0/A1 agents observe and propose with evidence; deterministic base validates tenant, permission, state, amount, SoD, idempotency, approval before committing anything; workflow engine authorizes based on policies and limits.

## 8. Business Events Are the Spine; Accounting Is the Financial Truth Layer
**Principle**: Model the platform as: Business Entity → Business Event → Operational Consequence → Financial Consequence (where applicable) → Ledger.  
**Why**: Not every ERP event has a financial posting (e.g., quotation, RFQ, stock transfer, CRM opportunity). The ledger remains authoritative for financial truth, but the system tracks the full lifecycle.  
**Implementation**: Workflow engine processes business events; operational consequences update inventory, POS, CRM, etc.; financial consequences (invoices, payments, expenses) post to the General Ledger via approved journal/proposal boundary.

## 9. Quality Gates Over Calendar Promises
**Principle**: Speed must never compromise correctness. Use quality gates, not arbitrary dates, to decide readiness for production.  
**Why**: AI may let us build modules unusually fast, but correctness remains mandatory.  
**Implementation**: Define quality gates such as: "Inventory cannot enter production until tenant isolation, financial invariants, tax tests, audit tests, backup/restore, and accounting posting tests pass." Gate each stage before proceeding.

## 10. Competitive Integrity in Intelligence
**Principle**: Competitive intelligence distinguishes Confirmed, Publicly Documented, Not Publicly Documented, Inferred, Unknown. Avoid unsupported absolutes.  
**Why**: To maintain trust and accuracy in product decisions.  
**Implementation**: When referencing competitors, specify the evidence level: e.g., "EVETS public Maldives material reviewed in Aug 2026 continued to state 16% TGST although MIRA’s applicable tourism GST rate has been 17% since 1 July 2025. We have not verified the tax configuration of deployed EVETS installations."

---
*These principles are the living specification for StarqERP. They inform the requirement registry, architecture decisions, roadmap, and task graph.*