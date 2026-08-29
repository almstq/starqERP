# starq.mv — Public Security & ISO Readiness Progress Model

**Document Status**: Authoritative Public Security Surface & Assurance Roadmap Specification  
**Public Route**: `https://starq.mv/security`  
**Date**: 2026-08-27  

---

## 1. Governance & Public Wording Standard

> [!IMPORTANT]
> **MANDATORY LEGAL & COMPLIANCE WORDING**:  
> All public presentations of security standards on `starq.mv/security` must explicitly use the following disclaimers:
> - *"Target / Readiness Programme — Not Currently Certified"*
> - *"Starq Technologies Pvt Ltd is actively executing an internal Information Security Management System (ISMS) aligned with ISO/IEC 27001:2022 standards. Formal external certification is an active engineering milestone."*

---

## 2. Assurance Standards & Target Progress Table

The progress percentages below derive strictly from the internal readiness gap assessment ([`docs/qa/current/ISO_27001_READINESS_GAP_AUDIT_2026-08-27.md`](../qa/current/ISO_27001_READINESS_GAP_AUDIT_2026-08-27.md)) and pre-SoA control matrix ([`docs/security/ISO_27001_CONTROL_MATRIX.md`](../security/ISO_27001_CONTROL_MATRIX.md)):

| Standard / Framework | Category | Public Status | Current Readiness | Focus & Architectural Evidence | Target Gate |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **ISO/IEC 27001:2022** | Info Security Management | **Target / Readiness Programme** *(Not Certified)* | **52%** | PostgreSQL RLS, two-plane schema isolation, Google OIDC JWKS authentication, immutable audit trails. (Technical: 74%, ISMS: 38%). | Gate 3 (2027-Q1) |
| **ISO/IEC 27017:2015** | Cloud Security Controls | **Target / Readiness Programme** *(Not Certified)* | **65%** | Virtual tenant data segregation, cloud shared responsibility matrix, zero-trust Edge gateway API routing. | Gate 3 (2027-Q1) |
| **ISO/IEC 27018:2019** | Cloud PII & Privacy | **Target / Readiness Programme** *(Not Certified)* | **58%** | Maldivian Data Protection compliant Privacy Policy (`/privacy`), DPA (`/legal/dpa`), zero training on customer data in starqAI. | Gate 3 (2027-Q1) |
| **SOC 2 Type II** | Trust Services Criteria | **Future Target** *(Not Certified)* | **Planned** | Security, Availability, and Confidentiality criteria scheduled for post-ISO Phase 4 enterprise scaling. | Gate 4 (2027-Q3) |

---

## 3. Public Technical Security Pillars

Visitors to `starq.mv/security` are presented with 4 transparent architectural pillars:

### Pillar 1: Zero-Trust Database Multi-Tenancy
- Multi-tenancy is enforced at the database kernel via PostgreSQL Row-Level Security (RLS) policies keyed to `organisation_id`.
- Composite foreign keys and schema separation make cross-tenant data leaks architecturally impossible.

### Pillar 2: Cryptographic Identity & Session Integrity
- Authentication uses Google Workspace OpenID Connect verified against public Google JWKS endpoints.
- Sessions are issued as `HttpOnly; Secure; SameSite=None` HMAC-SHA256 signed cookies containing embedded CSRF nonces.

### Pillar 3: Immutable Financial & Operational Audit Trails
- All state-changing operations produce append-only audit log records enforced by PostgreSQL database triggers.
- Once recorded, financial journals and operational logs cannot be updated or deleted by any user or administrator.

### Pillar 4: Two-Plane Schema Isolation
- Platform fleet governance and SaaS operator tools exist entirely within the `platform` schema.
- Customer business operations exist in the `public` schema. A tenant administrator has zero visibility or authority in the Starq HQ control plane.

---

## 4. Public Vulnerability Disclosure Policy (VDP)

`starq.mv/security` includes a clear, responsible disclosure policy:
- **Security Contact**: `security@starq.mv` (or `ops@starq.mv`)
- **PGP Key**: Published public key for encrypted vulnerability reports.
- **Safe Harbor**: Starq Technologies pledges not to pursue legal action against researchers acting in good faith according to responsible disclosure guidelines.
