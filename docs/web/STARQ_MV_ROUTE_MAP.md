# starq.mv — Public Route Map & Page Specification

**Date**: 2026-08-27  
**Domain**: `https://starq.mv`  

---

## 1. Public Route Inventory

| Route | Page Title | Primary Brand Identity | Layout Template | Key Purpose & Primary Content | Primary CTA |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Starq Technologies · Built for Maldives | Starq Corporate Mark (`starq-logo.png`) | Corporate Portal | High-level company identity, Starq Technologies studio overview, Starq Dynamics service model, active products summary. | "Explore Studio" / "Work with Dynamics" |
| `/studio` | Starq Technologies · Software & R&D Studio | Starq Corporate Mark | Studio Showcase | Deep-dive into software engineering, research initiatives, public GitHub repositories, and DevOps culture. | "View starqERP" / "Review Roadmap" |
| `/starqerp` | starqERP · Maldives-First SME Operating System | starqERP Product Mark (Blue Lockup) | Product Landing | Product positioning, `v0.2.0-beta` status, architectural foundations, capability matrix, and sign-in gateway. | **"Sign In to starqERP"** $\rightarrow$ Auth Flow |
| `/studio/hoadhaa` | Hoadhaa · Commerce & Data Research | Starq Corporate Mark | Research Brief | Transparent R&D brief for future distributed commerce infrastructure. Labeled "Early-Stage / Research". | "Follow Progress" |
| `/dynamics` | Starq Dynamics · Professional Management Services | Starq Corporate Mark | Service Catalogue | Practical business support: finance administration, bookkeeping, HR, payroll, operations, and workflow setup. | "Request Service Scope" |
| `/progress` | Public Development Progress & Milestone Gates | Starq Corporate Mark | Roadmap Tracker | Authoritative milestone capability gates (G1 Pilot $\rightarrow$ G4 Enterprise), recently completed, currently building. | "View Public GitHub" |
| `/security` | Security Architecture & Assurance Targets | Starq Corporate Mark | Trust & Security | Zero-trust architecture, multi-tenant RLS, and ISO 27001 / 27017 / 27018 readiness programme targets. | "Review DPA" |
| `/privacy` | Privacy Policy | Starq Corporate Mark | Legal Document | Canonical Maldivian Data Protection compliant privacy policy; PII handling commitments. | None (Informational) |
| `/terms` | Website Terms of Service | Starq Corporate Mark | Legal Document | Canonical website terms of use and liability boundaries. | None (Informational) |
| `/legal` | Corporate Entity & Legal Jurisdiction | Starq Corporate Mark | Governance Brief | Starq Technologies Pvt Ltd registration facts (C29552026), Republic of Maldives statutory context. | None (Informational) |
| `/docs` | Public Technical Documentation | starqERP / Studio Mark | Docs Index | Clean-room architectural overviews, command contracts, and developer guides. | "GitHub Repository" |
| `/status` | System Status & Telemetry (Phase 2) | Starq Corporate Mark | Status Board | Live edge gateway health, database connectivity, and uptime metrics. | "Subscribe to Updates" |

---

## 2. Shared Global Shell Layout

### Masthead (Top Navigation)
- **Brand Lockup**: Official `starq-logo.png` + `Starq Technologies`
- **Primary Nav Links**:
  - `Studio` (`/studio`)
  - `starqERP` (`/starqerp`)
  - `Dynamics` (`/dynamics`)
  - `Progress` (`/progress`)
  - `Security` (`/security`)
- **Right Action Button**:
  - Secondary: `Contact` (`/dynamics#contact` or `/contact`)
  - Primary Accent: **"Sign In"** (routes to `/starqerp` $\rightarrow$ `erp.starq.mv`)

### Global Footer
- **Left Column**: Starq Technologies Corporate Identity + Malé, Republic of Maldives.
- **Column 1 (Software & R&D)**: `Starq Technologies`, `starqERP (v0.2.0-beta)`, `Hoadhaa (R&D)`, `Public GitHub`.
- **Column 2 (Commercial Services)**: `Starq Dynamics`, `Finance Administration`, `Bookkeeping Support`, `HR & Payroll`.
- **Column 3 (Trust & Governance)**: `Security & ISO Targets`, `Public Roadmap`, `Privacy Policy`, `Terms of Service`, `Legal Jurisdiction`.
- **Bottom Legal Line**: `© 2026 Starq Technologies Pvt Ltd. All rights reserved. Registered in the Republic of Maldives (C29552026).`
