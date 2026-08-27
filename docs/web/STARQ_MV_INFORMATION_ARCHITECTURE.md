# starq.mv — Corporate & Product Domain Information Architecture

**Authoritative Specification**: Public Web Presence & Domain Architecture  
**Organization**: Starq Technologies Private Limited (Republic of Maldives)  
**Date**: 2026-08-27  

---

## 1. Corporate Identity & Organization Hierarchy

```
Starq Technologies Private Limited
(Corporate Legal Entity · Republic of Maldives)
│
├── Starq Technologies
│   (Software Engineering & R&D Studio · Uses Corporate Mark)
│   │
│   ├── starqERP
│   │   └── Status: ACTIVE DEVELOPMENT (v0.2.0-beta)
│   │   └── Brand: starqERP Product Logo (Blue Badge Lockup)
│   │   └── Target: Multi-tenant Commercial Operating System
│   │
│   └── Hoadhaa
│       └── Status: EARLY-STAGE / RESEARCH
│       └── Brand: Starq Technologies Studio R&D Mark
│       └── Target: Distributed Commerce & Data Infrastructure
│
└── Starq Dynamics
    (Professional Management Services · Uses Corporate Mark)
    └── Services: Finance, Bookkeeping, HR, Payroll, Operations Support
    └── Engagements: Scoped, Quotation-Based Commercial Deliverables
```

### Brand Hierarchy Rules
1. **Starq Technologies Pvt Ltd**: Corporate legal entity. Represented by official Starq corporate logo (`starq-logo.png`).
2. **Starq Technologies**: Software & R&D studio. Uses Starq corporate logo.
3. **Starq Dynamics**: Professional management services line. Uses Starq corporate logo.
4. **starqERP**: Multi-tenant software product. Uses dedicated **starqERP product logo** (blue brand container + "starq" + "ERP" badge).

---

## 2. Domain & Subdomain Topology

```
┌────────────────────────────────────────┬────────────────────────────────────────┐
│               starq.mv                 │              erp.starq.mv              │
│       (Public Corporate & Web)         │        (SaaS Application Runtime)      │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ • Public corporate identity            │ • Authenticated multi-tenant ERP       │
│ • Software studio & R&D showcase       │ • Starq HQ platform control plane      │
│ • Starq Dynamics services              │ • Commercial POS, Invoicing, Jobs, GL  │
│ • Public capability roadmaps           │ • Requires valid Google OAuth session  │
│ • ISO & assurance targets              │ • Server-enforced PostgreSQL RLS       │
│ • Canonical legal & privacy policies   │ • Edge API Gateway integration         │
└────────────────────────────────────────┴────────────────────────────────────────┘
```

---

## 3. Site Navigation & Information Hierarchy

```
starq.mv/
├── /                     → Corporate Homepage (Starq Technologies Pvt Ltd)
├── /studio               → Software Studio & R&D Showcase
│   ├── /starqerp         → starqERP Product Page (or alias /starqerp)
│   └── /hoadhaa          → Hoadhaa Research Initiative
├── /dynamics             → Starq Dynamics Professional Services
├── /starqerp             → Canonical starqERP Product Landing & Sign-in Gateway
├── /progress             → Public Capability Progress (G1–G4 Milestones)
├── /security             → Security Architecture & ISO Readiness Targets
├── /privacy              → Canonical Privacy Policy
├── /terms                → Canonical Terms of Service
├── /legal                → Corporate Registration & Maldivian Jurisdiction
├── /docs                 → Public Technical Documentation & Architecture
└── /status               → System Health, Uptime & Telemetry (Phase 2)
```

---

## 4. Key Architectural Guarantees

1. **No Operational Contamination**: The public corporate website (`starq.mv`) contains zero live tenant business data, mock demo records, or transactional application state.
2. **Deterministic Routing**: Visitors wanting to access the ERP product are routed to `starq.mv/starqerp` and authenticated before transitioning to `erp.starq.mv`.
3. **Canonical Legal SSOT**: All legal references in the ERP application and public code repositories point canonically to `starq.mv/privacy`, `starq.mv/terms`, and `starq.mv/legal`.
