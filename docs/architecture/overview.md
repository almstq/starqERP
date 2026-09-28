<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document REMAINS VALID and is extended, not superseded, by the 28 Sep 2026 course correction.**
>
> Zero-trust, two-plane, multi-book and append-only principles remain fully canonical. Now read together with the canonical transaction architecture. Follow the extension below where it touches StarqERP completion doctrine.
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

# starqERP — Architectural Overview

starqERP is designed from the ground up as a zero-trust, multi-tenant enterprise resource planning system tailored for modern businesses in the Maldives.

---

## 1. Architectural Principles

1. **Strict Zero-Trust Boundary**: No unauthenticated or cross-tenant query can ever execute without passing through cryptographic session validation and PostgreSQL Row-Level Security (RLS).
2. **Deterministic Multi-Book Spine**: A single legal entity can operate multiple distinct business activities (operating books), each maintaining its own independent chart of accounts, journals, and numbering sequences, while sharing physical locations and inventory.
3. **Two-Plane Segregation**: The platform SaaS management operations (Starq HQ Control Plane) are physically and logically segregated from customer business operations (Tenant ERP Execution Plane).
4. **Append-Only Immutability**: All financial journal entries, job lifecycle events, and audit logs are append-only. Database triggers prevent any `UPDATE` or `DELETE` mutations.

---

## 2. Core Subsystems

```
┌─────────────────────────────────────────────────────────────────┐
│                    starqERP Core Subsystems                     │
├───────────────────┬──────────────────────┬──────────────────────┤
│  Commercial & POS │  Workshop & Service  │  Inventory & Stores  │
│  • Sales Invoices │  • Service Job Cards │  • Moving Avg Cost   │
│  • Credit Notes   │  • Workflow Rail     │  • Stock Movements   │
│  • Cash Receipts  │  • Technician Seats  │  • Multiple Stores   │
├───────────────────┼──────────────────────┼──────────────────────┤
│  Ledger & Tax     │  Purchasing & POs    │  Platform Control    │
│  • Double-Entry GL│  • Vendor Bills      │  • Tenant Registry   │
│  • MIRA GST filing│  • 3-Way Matching    │  • Subscriptions     │
│  • Trial Balance  │  • AP Settlement     │  • Fleet Telemetry   │
└───────────────────┴──────────────────────┴──────────────────────┘
```

---

## 3. Technology Integration

- **Client Layer**: React 19 single-page application built with Vite and Tailwind CSS v4, adhering to Google Material 3 Adaptive Layout standards.
- **Edge Gateway**: Supabase Edge Functions running on Deno, validating incoming requests against the single-source-of-truth command contracts in `contracts/commands.ts`.
- **Database Layer**: PostgreSQL 15+ with custom schemas (`public` for tenant execution, `platform` for SaaS control-plane).
