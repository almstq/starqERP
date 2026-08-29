# starqERP — ISO/IEC 27001:2022 Readiness & Security Management Gap Audit

**Document Status**: Authoritative Internal Gap Assessment (Not a Certification Claim)  
**Standard Evaluated**: ISO/IEC 27001:2022 (Information Security, Cybersecurity and Privacy Protection)  
**Guidance References**: ISO/IEC 27002:2022, ISO/IEC 27017:2015 (Cloud Security), ISO/IEC 27018:2019 (Cloud PII)  
**Evaluation Date**: 2026-08-27  
**Evaluator**: Lead Engineering & Security Agent  
**Target Organization**: Starq Technologies Pvt Ltd (Republic of Maldives)  
**Target Product**: starqERP (`v0.2.0-beta`)  

> [!IMPORTANT]
> **DISCLAIMER & TERMINOLOGY COMPLIANCE**:  
> Starq Technologies Pvt Ltd and starqERP are **NOT** ISO/IEC 27001 certified. This document is an internal readiness and gap assessment designed to evaluate architectural, technical, and operational posture against ISO/IEC 27001:2022 expectations. Approved terminology: *"ISO/IEC 27001-aligned"*, *"ISO readiness"*, *"certification-ready"*.

---

## 1. Executive Summary & Readiness Scores

An exhaustive evaluation of the starqERP codebase, database migrations (0001–0027), edge functions, CI pipelines, and governance documentation reveals a **strong technical security architecture** paired with an **early-stage formal Information Security Management System (ISMS)**.

The technical foundation (Row-Level Security, two-plane schema isolation, Google OIDC authentication, HMAC session signing, immutable audit trails, and automated CI gates) provides a solid bedrock. However, formal ISO 27001 compliance requires formal policy ownership, recurring review cycles, documented risk treatment, and external audit evidence that cannot be satisfied by code alone.

```
┌────────────────────────────────────────────────────────────────────────┐
│             ISO/IEC 27001:2022 Overall Readiness Score: 52%            │
├──────────────────────────────────┬─────────────────────────────────────┤
│ Dimension                        │ Readiness Range & Status            │
├──────────────────────────────────┼─────────────────────────────────────┤
│ 1. Technical Controls (Annex A.8)│ 74% — High (Solid architectural RLS)│
│ 2. Documented Evidence & SOPs    │ 48% — Moderate (Tech docs, no logs) │
│ 3. Organizational Controls (A.5) │ 45% — Developing (Policies pending) │
│ 4. Management System (Clauses 4–10) 38% — Early Stage (ISMS unchartered)│
│ 5. People & Physical (A.6, A.7)  │ 55% — Moderate (Cloud-native model) │
└──────────────────────────────────┴─────────────────────────────────────┘
```

---

## 2. Distinction: Technical Implementation vs. ISO Management Readiness

A critical principle of ISO/IEC 27001 auditing is that **technical capability in code does not constitute organizational compliance**:

| Capability Area | What Exists in Code (Technical Reality) | What ISO 27001 Requires (Management Reality) | Readiness Status |
| :--- | :--- | :--- | :---: |
| **Database Backups** | Supabase automated daily backups + WAL archiving | Documented backup policy, formal RTO/RPO targets, scheduled restoration test logs, management sign-off | **PARTIAL** |
| **Tenant Isolation** | PostgreSQL RLS (`organisation_id`), composite FKs | Documented multi-tenant threat model, periodic penetration test report, tenant breach notification SLA | **PARTIAL** |
| **Access Control** | RBAC, 5-tier entity scoping, Google OIDC | User access review policy, quarterly access recertification records, formal onboarding/offboarding SOP | **PARTIAL** |
| **CI/CD Gates** | GitHub Actions required status checks, linter, tests | Formal change management policy, peer review requirement documentation, release authorization sign-off | **PARTIAL** |
| **Encryption** | TLS in transit, AES-256 at rest (AWS Supabase) | Key management policy, cryptographic controls standard, formal encryption review | **PARTIAL** |

---

## 3. Evaluation of ISO/IEC 27001:2022 Management System Clauses (4–10)

### Clause 4: Context of the Organization
- **4.1 Understanding organizational context**: Defined. Maldivian SME SaaS provider operating in Male' / Hulhumale'.
- **4.2 Needs and expectations of interested parties**: Documented in terms of MIRA compliance, BML banking settlement, and customer data privacy.
- **4.3 Determining the scope of the ISMS**: Scope encompasses Starq Technologies cloud infrastructure (Vercel, Supabase, GitHub) and the starqERP SaaS platform.
- **Score: 60%** (Scope clear, formal ISMS charter pending).

### Clause 5: Leadership
- **5.1 Leadership and commitment**: Founder is actively enforcing zero-trust architecture and rigorous QA gates.
- **5.2 Information security policy**: High-level principles exist in `docs/security/security-model.md`; formal board-approved top-level ISMS policy needed.
- **5.3 Organizational roles, responsibilities and authorities**: Defined in engineering hierarchy (Founder / Elder / Lead Agent).
- **Score: 45%** (Leadership commitment demonstrated; formal policy artifacts needed).

### Clause 6: Planning
- **6.1 Actions to address risks and opportunities**: Threat analysis conducted in architectural decision records (ADRs).
- **6.2 Information security objectives and planning**: Objectives established across G1–G4 commercial readiness milestones.
- **Score: 35%** (Risk assessment methodology needs formal matrix and risk treatment plan).

### Clause 7: Support
- **7.1 to 7.5 Resources, Competence, Awareness, Communication, Documented Information**: Architecture and migration documentation is extensive. Centralized document control and policy review cycles need formalization.
- **Score: 40%**.

### Clause 8: Operation
- **8.1 to 8.3 Operational planning, risk assessment, risk treatment**: Executed via canonical SERP tasks, strict PR gates, and staging migrations.
- **Score: 50%**.

### Clause 9: Performance Evaluation
- **9.1 Monitoring, measurement, analysis and evaluation**: 42 Vitest test suites, linter gates, and telemetry event logging (`services/telemetry.ts`).
- **9.2 Internal audit**: Not yet formally established.
- **9.3 Management review**: Informal reviews occur at every milestone gate.
- **Score: 30%** (Automated monitoring high; formal internal audit cycle absent).

### Clause 10: Improvement
- **10.1 Continual improvement**: Active remediation passes and ADR amendments.
- **10.2 Nonconformity and corrective action**: Tracked via canonical SERP tickets and defect inventories.
- **Score: 45%**.

---

## 4. Annex A Control Group Audit (ISO/IEC 27002:2022 Baseline)

### Group 1: Organizational Controls (A.5 — 37 Controls)
- **A.5.1 Policies for information security**: `docs/security/security-model.md` and `docs/PRIVACY.md` exist. Formal annual review cycle pending.
- **A.5.2 to A.5.4 Information security roles & segregation of duties**: Segregation of Duties engine implemented in code (`authorizeCommand` in `contracts/commands.ts`).
- **A.5.8 Information security in project management**: Integrated into canonical task board and PR review gates.
- **A.5.15 Access control**: Strict 5-tier entity scoping, RBAC matrix, and Google OIDC authentication.
- **A.5.20 to A.5.23 Supplier relationships & cloud services**: Dependencies on Supabase (AWS), Vercel, and Google Workspace are documented. Formal vendor risk assessments pending.
- **A.5.24 to A.5.28 Incident management**: Escalation path defined in `docs/SUPPORT.md`; formal incident classification runbook needed.
- **Group 1 Readiness: 45%**

### Group 2: People Controls (A.6 — 8 Controls)
- **A.6.1 Screening**: Informal for early engineering team.
- **A.6.2 Terms and conditions of employment**: IP and confidentiality clauses in corporate documentation.
- **A.6.4 Disciplinary process**: Handled by executive leadership.
- **A.6.5 Responsibilities after termination**: Tenant staff invitation revocation and session invalidation implemented in code (`public.invitations`).
- **Group 2 Readiness: 55%**

### Group 3: Physical Controls (A.7 — 14 Controls)
- **A.7.1 to A.7.14 Physical security perimeters, entry, equipment**: 100% cloud-native architecture. Physical hosting is entirely outsourced to AWS / Supabase and Vercel data centers holding certified ISO 27001 / SOC 2 Type II attestations.
- **Group 3 Readiness: 85%** (Inherited via certified cloud tier).

### Group 4: Technological Controls (A.8 — 34 Controls)
- **A.8.1 User endpoint devices**: Workstation security practices applied.
- **A.8.2 Privileged access rights**: Starq HQ platform access strictly gated via `platform.operator_principals` and `session.platform_entitlement`.
- **A.8.3 Information access restriction**: Multi-tenant Row-Level Security (RLS) in PostgreSQL enforced on `organisation_id`.
- **A.8.5 Secure authentication**: Google OIDC verification against public JWKS; HMAC-SHA256 signed session cookies with CSRF nonces.
- **A.8.7 Protection against malware**: Managed cloud runtime; automated dependency scanning.
- **A.8.8 Management of technical vulnerabilities**: Automated npm audit and CI test suite.
- **A.8.9 Configuration management**: 27 versioned SQL migrations in Git; zero unversioned schema drift.
- **A.8.12 Data leakage prevention**: Public repository clean-room sanitized; zero secret disclosures.
- **A.8.20 Network security**: HTTPS/TLS 1.3 enforced on all edge endpoints.
- **A.8.24 Use of cryptography**: TLS in transit, AES-256 at rest, HMAC-SHA256 for session integrity.
- **A.8.25 Secure development life cycle**: Branch protection, required PR reviews, linting, and automated unit/integration tests.
- **A.8.31 Separation of development, test and production environments**: Local proxy $\rightarrow$ Supabase Staging (`wthabguvueewgtabjsdo`) $\rightarrow$ Production.
- **Group 4 Readiness: 74%**

---

## 5. Cloud & Privacy Extensions (ISO 27017 & ISO 27018 Relevance)

### ISO/IEC 27017:2015 (Cloud Security)
- **Relevance**: High for starqERP as a multi-tenant SaaS provider.
- **Existing Alignment**:
  - Clear segregation of tenant data in shared database via PostgreSQL RLS.
  - Complete customer isolation in operational workflows.
  - Cloud provider responsibility matrix (AWS/Supabase handles physical/hypervisor; Starq handles application/RLS/IAM).
- **Gaps**: Formal customer-facing Shared Responsibility Matrix document and tenant exit/data export self-service tooling.

### ISO/IEC 27018:2019 (Protection of PII in Public Clouds)
- **Relevance**: Critical for enterprise commercial trust and Maldivian Data Protection compliance.
- **Existing Alignment**:
  - Transparent Privacy Policy (`docs/PRIVACY.md`) and Data Processing Agreement (`docs/DPA.md`).
  - No customer PII used for marketing or unauthorized analytics.
  - Embedded AI (`starqAI`) operates on explicit tenant context without cross-tenant training data retention.
- **Gaps**: Formal Data Subject Access Request (DSAR) automation and granular audit logs for personal data access.

---

## 6. Existing Strengths, Gaps & Certification Blockers

### Existing Strengths
1. **Zero-Trust Multi-Tenancy**: Strict PostgreSQL RLS on `organisation_id` across all transactional tables.
2. **Two-Plane Schema Isolation**: Platform management (`platform`) physically separated from tenant data (`public`).
3. **Immutable Audit Trails**: Database-enforced append-only audit logging for all state-changing operational events.
4. **Deterministic Migrations**: 27 sequential SQL migrations managed in version control with zero manual DB edits.
5. **Clean Brand & Pre-Auth Boundaries**: Product version SSOT (`v0.2.0-beta`) and corporate identity strictly separated.

### Major Gaps (To be addressed in Phase 2/3)
1. **Formal ISMS Governance & Top-Level Security Policy**: Written Information Security Policy approved by management.
2. **Asset & Risk Register**: Formal inventory of information assets, risk scoring, and treatment plans.
3. **Documented Incident Response Runbook**: Step-by-step incident classification, containment, and notification procedures.
4. **Periodic Access Review Records**: Formal quarterly access recertification logs.

### Certification Blockers (Before Formal Stage 1 / Stage 2 Audit)
1. Minimum 3 months of operational ISMS records (internal audit report, management review minutes, access review logs).
2. Formal Statement of Applicability (SoA) signed off by executive leadership.
3. Comprehensive third-party penetration testing report on production infrastructure.

---

## 7. Practical 4-Stage ISO Certification Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Practical 4-Stage ISO Roadmap                        │
├─────────────────┬─────────────────┬──────────────────┬─────────────────┤
│ Stage A         │ Stage B         │ Stage C          │ Stage D         │
│ Secure SaaS     │ ISO-Aligned     │ Certification    │ External        │
│ Baseline        │ Discipline      │ Readiness        │ Audit           │
│ (CURRENT - G1)  │ (G2 / 2026-Q4)  │ (G3 / 2027-Q1)   │ (G4 / 2027-Q2)  │
├─────────────────┼─────────────────┼──────────────────┼─────────────────┤
│ • RLS isolation │ • Core policies │ • Formal ISMS    │ • Stage 1 Audit │
│ • Google OIDC   │ • Risk register │ • Internal audit │ • Stage 2 Audit │
│ • 0027 schema   │ • Incident SOP  │ • Mgmt review    │ • Formal Cert   │
│ • Unit tests    │ • Access review │ • Full SoA       │ • Accredited CB │
└─────────────────┴─────────────────┴──────────────────┴─────────────────┘
```

- **Stage A (Current Baseline — Gate 1)**: Technical security controls implemented in code. **Sufficient for controlled design-partner and friend staging onboarding**. ISO certification is **NOT** required before first pilot.
- **Stage B (Internal Discipline — Gate 2)**: Author policies, establish risk register, formalize incident runbooks and vendor reviews internally.
- **Stage C (Certification Preparation — Gate 3)**: Conduct internal audit, hold formal management review, mature SoA (internal + optional consultant).
- **Stage D (Accredited Certification — Gate 4)**: Engage accredited certification body (e.g. BSI, DNV, SGS, or TUV) for Stage 1 / Stage 2 audit.
