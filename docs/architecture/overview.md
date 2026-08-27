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
