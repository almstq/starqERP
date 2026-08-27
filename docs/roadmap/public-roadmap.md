# starqERP — Public Capability Roadmap
**Release Baseline**: v0.2.0-beta  
**Canonical Scope**: 4 Milestone Gates (G1 – G4)  

---

## Overview

The starqERP development roadmap is structured into four sequential milestone gates designed to deliver commercial readiness, complete legacy ERP replacement capability, deep Maldives market localization, and enterprise-grade reliability.

```
  [ G1: Commercial Pilot ]  ──►  [ G2: ERP Replacement ]  ──►  [ G3: Maldives Localization ]  ──►  [ G4: Enterprise Scale ]
  • Multi-Tenancy Spine          • Double-Entry General Ledger    • MIRA GST / BPT Engine          • Multi-Region HA
  • Zero-Trust RLS & Audit       • Bank Reconciliations           • BML Payment Gateway            • Continuous Compliance
  • Job Cards & Workflows        • Multi-Currency Purchasing      • Dhivehi RTL Localization       • Open Developer APIs
  • Counter Invoicing            • Role & Permission Engine       • Offline Network Resilience     • Fleet Provisioning
```

---

### Gate 1 (G1) — Commercial Pilot Readiness
- **Multi-Tenant Spine & Multi-Book Architecture**: Complete isolation of distinct business activities (automotive workshop, general retail, professional services) sharing physical locations.
- **Zero-Trust Security & Audit Immutability**: PostgreSQL Row-Level Security (RLS) enforcement, database-level append-only audit triggers, and HMAC-signed session cookies.
- **Material 3 Adaptive UI System**: Fully responsive interface tailored for desktop workstations, tablets, and mobile smartphones across light, dark, and high-contrast modes.
- **Core Operations Lifecycle**:
  - Service job orders and technician workflow step rails
  - Point-of-sale counter invoicing and customer management
  - Real-time inventory valuation and stock movement tracking
  - Purchasing lifecycle and supplier order management
- **Identity & Staff Management**: Google Workspace single sign-on, tenant staff invitation workflows, and 12-seat Segregation of Duties (SoD) enforcement.

---

### Gate 2 (G2) — ERP Replacement Readiness
- **Full Double-Entry General Ledger**: Automated journal posting on all commercial transactions with live balance sheets, profit & loss, and trial balance reports.
- **Automated Bank Reconciliation**: Multi-currency bank statement import, rule-based matching, and payment clearing reconciliation.
- **Advanced Procurement & 3-Way Matching**: Purchase order, goods received note (GRN), and vendor bill matching with variance tolerances.
- **Flexible Workflow & Roles-as-Data**: Dynamic stage builder for custom approval chains, role permissions editor, and emergency SoD override dispositions.

---

### Gate 3 (G3) — Maldives Localization & Market Advantage
- **MIRA Tax Engine**: Native generation and automated reconciliation of Maldives Inland Revenue Authority General GST, Tourism GST (TGST), and Business Profit Tax (BPT) returns.
- **Bank of Maldives (BML) Integration**: Direct merchant gateway integration for BML Gateway payments, payment link generation, and automated settlement reconciliation.
- **Dhivehi Language & Thaana Typography**: Full bilingual interface support with right-to-left (RTL) layout switching and localized numeral formatting.
- **Offline Resilience & Sync**: Local-first caching for island environments with intermittent internet connectivity, with conflict-free background synchronization.

---

### Gate 4 (G4) — Enterprise Scale & Governance
- **High Availability & Disaster Recovery**: Automated cross-region PostgreSQL replication, zero-downtime point-in-time recovery drills, and RPO/RTO validation.
- **Continuous Compliance & Audit Engine**: SOC2 / ISO27001 automated compliance telemetry, structured SIEM export, and real-time security alerting.
- **Platform Control Plane & Fleet Telemetry**: Starq HQ automated tenant provisioning, multi-tenant usage metering, and billing automation.
- **Open Developer API & Webhooks**: Public REST API and HMAC-signed webhook delivery for custom external integrations.
