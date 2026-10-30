# starqERP Platform Realignment & Enterprise Operating Hierarchy

**Status:** Authoritative Architectural Specification (Two-Plane & Operating Hierarchy Model)  
**Date:** 2026-08-27  

---

## 1. Core Operating Hierarchy (Identity ≠ Tenant)

A human identity authenticates once (via Google OAuth) and accesses services based on explicit platform entitlements and tenant memberships.

```
Identity (Google Auth / Person)
   │
   ├─► [Platform Entitlement] ──► Starq HQ Control Plane (Platform Admin / Support)
   │
   └─► [Tenant Memberships] ────► Legal Entity / Tenant (Owns Legal Identity, MIRA TIN, Subscription, Consolidated P&L)
                                      │
                                      ▼
                                   Business Activity / Book (Operable commercial context: Sales, Purchasing, Inventory, Workflows)
                                      │
                                      ▼
                                   Location / Branch (Physical site, workshop bay, retail counter)
```

> [!IMPORTANT]
> **Starq HQ Control Plane ≠ Starq Technologies Tenant**  
> **Starq HQ** is the platform-operator control plane. **Starq Technologies Pvt Ltd (Tenant #0)** is a normal execution-plane tenant subject to standard RLS, tenant memberships, book-level accounting, and audit boundaries. There is zero hidden platform-tenant bypass.

---

## 2. Authoritative Persona Models

### Case A: Normal Employee
- Belongs to 1 legal entity.
- Assigned to 1 or more designated books/branches under specific operational seats (e.g., technician at *Club Ignition Pvt Ltd → Ignition Ink*).
- `platform_entitlement` is `null` (never sees Starq HQ).

### Case B: Entrepreneur / Multi-Company Owner
- Belongs to multiple legal entities (`Company A Pvt Ltd`, `Company B Pvt Ltd`, `Company C Pvt Ltd`), each running one or more business activities/books.
- `platform_entitlement` is `null` (never sees Starq HQ).

### Case C: Platform Founder / Operator (Authoritative Reference)
```
Ali Mushthaq (Google Identity)
│
├── PLATFORM ENTITLEMENT
│   └── Starq HQ
│       └── starqERP Platform Administration & Governance
│
└── MY ORGANISATIONS
    ├── Tenant #0 — Starq Technologies Pvt Ltd
    │   ├── Book: Starq Technologies (Software / R&D operations)
    │   └── Book: Starq Dynamics (Professional Management Services)
    │
    └── Tenant #1 — Club Ignition Pvt Ltd
        └── Book: Ignition Ink (Automotive / Workshop operations)
```

---

## 3. Four-Tier Entity & Relational Operating Model

```
Legal Entity / Tenant (`public.organisations`)
  │  • Statutory MIRA TIN & GST registration
  │  • Subscription contract & membership boundary
  │  • Consolidated statutory reporting & balance sheet
  │
  ├── Business Name / Trading Name (`public.business_names`) [Optional, 1..N]
  │     • Registered commercial trading brand (e.g. Starq Dynamics, Ignition Ink)
  │     • Ministry / MED registry code & trademark identity
  │     • Customer-facing invoice header brand
  │
  └── Book / Operating Activity (`public.books`) [1..N]
        │  • Operating accounting ledger, daybook, and margins
        │  • Document sequences, inventory items, and job workflows
        │  • Optional composite FK to `business_names` (`business_name_id`)
        │  • Industry archetype configuration (`archetype_id`)
        │
        └── Location / Branch (`public.locations` via `public.book_locations`) [1..N]
              • Physical workshop bay, retail counter, or warehouse
              • Island, physical address, and site coordinates
```

| Tier | Entity Name | Database Table | Key Invariants & Guarantees |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **Identity** | `public.persons` | External Google OAuth subject, email, name, platform operator entitlement. |
| **Tier 2** | **Tenant / Legal Entity** | `public.organisations` | Legal registration, MIRA TIN, consolidated balance sheet & single statutory tax return. |
| **Tier 2.5** | **Business / Trading Name** | `public.business_names` | Commercial registered trading brands under the company. Enforces `unique (organisation_id, id)`. |
| **Tier 3** | **Operating Book** | `public.books` | Operational accounting partition. Enforces `unique(organisation_id, code)`, single default active book per org via partial unique index, and tenant-safe composite FK to `business_names`. |
| **Tier 3.5** | **Book Memberships** | `public.book_memberships` | Authorizes which specific books a tenant member is allowed to enter/operate. |
| **Tier 4** | **Location / Branch** | `public.locations` & `public.book_locations` | Physical sites shared across books via M:N junction without row duplication. |

---

## 4. Authorization Graph & Active Operating Context

### A. Authorization Graph (`POST /api/auth/google`)
When the founder authenticates, the gateway returns their full authorization graph:

```json
{
  "person_id": "uuid-ali",
  "name": "Ali Musthaq",
  "email": "founder@example.com",
  "platform_entitlement": {
    "operator_role": "platform_admin",
    "mfa_verified": true
  },
  "organisations": [
    {
      "id": "uuid-tenant-0-starq",
      "slug": "starq-technologies",
      "legal_name": "Starq Technologies Private Limited",
      "tin": "1009988GST001",
      "books": [
        {
          "id": "uuid-book-starq-tech",
          "code": "STQ",
          "name": "Starq Technologies",
          "archetype": "general_business",
          "is_default": true
        },
        {
          "id": "uuid-book-starq-dyn",
          "code": "DYN",
          "name": "Starq Dynamics",
          "archetype": "general_business",
          "is_default": false
        }
      ],
      "seats": ["managing_director", "financial_controller"]
    },
    {
      "id": "uuid-tenant-1-ignition",
      "slug": "club-ignition",
      "legal_name": "Club Ignition Private Limited",
      "tin": "1004829GST001",
      "books": [
        {
          "id": "uuid-book-ignition-ink",
          "code": "INK",
          "name": "Ignition Ink",
          "archetype": "automotive_workshop",
          "is_default": true
        }
      ],
      "seats": ["director", "super_admin"]
    }
  ],
  "active_context": {
    "plane": "tenant",
    "tenant_id": "uuid-tenant-0-starq",
    "book_id": "uuid-book-starq-tech",
    "location_id": null,
    "acting_as": "managing_director"
  }
}
```

### B. Active-Context Switching Matrix

| Selected Context | `acting_plane` | `tenant_id` | `book_id` | Role & Authority |
| :--- | :--- | :--- | :--- | :--- |
| **Starq HQ** | `'platform'` | `null` | `null` | `platform_admin` (Platform registry & health only; zero ambient customer ledger access) |
| **Starq Technologies → Starq Technologies** | `'tenant'` | `uuid-tenant-0-starq` | `uuid-book-starq-tech` | Managing Director (Software / R&D operational ledger) |
| **Starq Technologies → Starq Dynamics** | `'tenant'` | `uuid-tenant-0-starq` | `uuid-book-starq-dyn` | Managing Director (Professional Management Services ledger) |
| **Club Ignition → Ignition Ink** | `'tenant'` | `uuid-tenant-1-ignition` | `uuid-book-ignition-ink` | Director (Automotive & Workshop operational ledger) |

---

## 5. Security & Accounting Boundaries

1. **Zero Privilege Bleed**: Being a Starq HQ operator grants zero ambient access to transact within customer books or Starq Technologies tenant books.
2. **Book-Level Accounting**: `Starq Technologies` and `Starq Dynamics` maintain independent operating ledgers, expense journals, and job workflows.
3. **Consolidated Legal-Entity Reporting**: Starq Technologies Pvt Ltd produces consolidated financial statements and a single MIRA GST return rolling up all of its books.
4. **Hierarchical Auditing**: All mutations log `acting_plane`, `organisation_id`, `book_id`, `actor_person_id`, and `acting_seat`.
