# starqERP — ISO/IEC 27001:2022 Control Implementation Matrix (Pre-SoA)

**Document Status**: Pre-Statement of Applicability (Pre-SoA) Working Matrix  
**Standard**: ISO/IEC 27001:2022 Annex A (93 Controls across 4 Categories)  
**Date**: 2026-08-27  
**Owner**: Founder & Lead Engineering Agent  

---

## 1. Matrix Overview

This working matrix provides an engineering and operational mapping of ISO/IEC 27001:2022 Annex A controls to the current starqERP implementation.

| Status Legend | Meaning |
| :--- | :--- |
| **IMPLEMENTED + EVIDENCED** | Control is active in code/architecture and verified by automated tests or audit artifacts. |
| **IMPLEMENTED (UNDOCUMENTED)** | Technical capability exists in runtime, but lacks formal written policy or periodic review logs. |
| **PARTIAL** | Core mechanism exists; edge cases, secondary workflows, or governance records are in progress. |
| **PLANNED** | Sequenced in the canonical SERP roadmap for upcoming milestone gates. |
| **NOT APPLICABLE (N/A)** | Control is outside the scope of Starq SaaS operations (justification documented). |

---

## 2. Annex A.5: Organizational Controls (37 Controls)

| Control | Name | Applicable | Current State | Evidence | Gap / Required Action | Owner | Priority | Related SERP |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| **A.5.1** | Policies for info security | YES | PARTIAL | `docs/security/security-model.md` | Formal top-level ISMS policy document & annual review cycle | Founder | P1 | SERP-339 |
| **A.5.2** | Info security roles & resp | YES | IMPLEMENTED (UNDOCUMENTED) | Founder / Elder / Lead Agent hierarchy | Formal RACI matrix in ISMS manual | Founder | P2 | SERP-339 |
| **A.5.3** | Segregation of duties | YES | IMPLEMENTED + EVIDENCED | `authorizeCommand` in `contracts/commands.ts` | Complete | Lead Agent | P0 | SERP-177 |
| **A.5.4** | Management responsibilities | YES | IMPLEMENTED (UNDOCUMENTED) | Executive engineering oversight | Documented security review minutes | Founder | P2 | SERP-339 |
| **A.5.8** | Info security in project mgmt | YES | IMPLEMENTED + EVIDENCED | Canonical SERP board, PR review gates | Complete | Lead Agent | P1 | SERP-283 |
| **A.5.9** | Inventory of info & assets | YES | PARTIAL | Database schema & repository structure | Formal Information Asset Register | Lead Agent | P1 | SERP-340 |
| **A.5.10** | Acceptable use of assets | YES | PARTIAL | `docs/TERMS.md` | Internal staff acceptable use policy | Founder | P2 | SERP-339 |
| **A.5.12** | Classification of info | YES | PARTIAL | Two-plane schema (`platform` vs `public`) | Formal data classification standard | Lead Agent | P1 | SERP-340 |
| **A.5.15** | Access control | YES | IMPLEMENTED + EVIDENCED | RBAC, 5-tier entity scoping, Google OIDC | Formal quarterly access recertification log | Lead Agent | P1 | SERP-341 |
| **A.5.19** | Info security in supplier rel | YES | PARTIAL | AWS, Supabase, Vercel dependencies | Formal Supplier Security Assessment & Register | Lead Agent | P1 | SERP-342 |
| **A.5.23** | Info security for cloud svcs | YES | IMPLEMENTED + EVIDENCED | Shared responsibility model defined | Cloud security checklist review | Lead Agent | P1 | SERP-342 |
| **A.5.24** | Incident mgmt planning | YES | PARTIAL | `docs/SUPPORT.md` escalation path | Step-by-step incident response runbook | Lead Agent | P1 | SERP-341 |
| **A.5.29** | Info security during disruption| YES | PARTIAL | Cloud-native multi-AZ resilience | Formal Business Continuity Plan (BCP) | Founder | P2 | SERP-343 |
| **A.5.31** | Legal, statutory requirements | YES | IMPLEMENTED + EVIDENCED | MIRA GST compliance, Republic of Maldives jurisdiction | Regulatory compliance register | Founder | P1 | SERP-164 |
| **A.5.34** | Privacy & protection of PII | YES | IMPLEMENTED + EVIDENCED | `docs/PRIVACY.md`, `docs/DPA.md` | Data Protection Impact Assessment (DPIA) | Founder | P1 | SERP-344 |

---

## 3. Annex A.6: People Controls (8 Controls)

| Control | Name | Applicable | Current State | Evidence | Gap / Required Action | Owner | Priority | Related SERP |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| **A.6.1** | Screening | YES | PARTIAL | Founder-led hiring checks | Documented background check SOP | Founder | P2 | SERP-339 |
| **A.6.2** | Terms & conditions of employ | YES | IMPLEMENTED (UNDOCUMENTED) | Standard corporate confidentiality | Formal security handbook acknowledgement | Founder | P2 | SERP-339 |
| **A.6.4** | Disciplinary process | YES | IMPLEMENTED (UNDOCUMENTED) | Executive governance | Written disciplinary policy | Founder | P2 | SERP-339 |
| **A.6.5** | Responsibilities post-employ | YES | IMPLEMENTED + EVIDENCED | Token revocation (`public.invitations`), OAuth seat removal | Written offboarding checklist | Lead Agent | P1 | SERP-286 |

---

## 4. Annex A.7: Physical Controls (14 Controls)

| Control | Name | Applicable | Current State | Evidence | Gap / Required Action | Owner | Priority | Related SERP |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| **A.7.1–A.7.14** | Physical security controls | N/A (Outsourced) | IMPLEMENTED + EVIDENCED | 100% Cloud-native (AWS / Supabase, Vercel) | Retain annual SOC 2 Type II / ISO 27001 certificates of cloud vendors | Lead Agent | P2 | SERP-342 |

---

## 5. Annex A.8: Technological Controls (34 Controls)

| Control | Name | Applicable | Current State | Evidence | Gap / Required Action | Owner | Priority | Related SERP |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| **A.8.2** | Privileged access rights | YES | IMPLEMENTED + EVIDENCED | `platform.operator_principals`, `session.platform_entitlement` | Complete | Lead Agent | P0 | SERP-284 |
| **A.8.3** | Info access restriction | YES | IMPLEMENTED + EVIDENCED | PostgreSQL Row-Level Security (`organisation_id`) | Complete | Lead Agent | P0 | SERP-124 |
| **A.8.5** | Secure authentication | YES | IMPLEMENTED + EVIDENCED | Google OIDC JWKS verification, HMAC-SHA256 cookies, CSRF nonces | Complete | Lead Agent | P0 | SERP-285 |
| **A.8.7** | Protection against malware | YES | IMPLEMENTED + EVIDENCED | Managed serverless Edge runtime (Deno) | Periodic npm audit automated CI check | Lead Agent | P1 | SERP-301 |
| **A.8.8** | Mgmt of tech vulnerabilities | YES | IMPLEMENTED + EVIDENCED | GitHub Dependabot, 42 Vitest test suites | Third-party penetration testing | Lead Agent | P1 | SERP-300 |
| **A.8.9** | Configuration management | YES | IMPLEMENTED + EVIDENCED | 27 versioned SQL migrations in Git | Migration rollback drill runbook | Lead Agent | P1 | SERP-284 |
| **A.8.12** | Data leakage prevention | YES | IMPLEMENTED + EVIDENCED | Clean-room public repository, 0 secret disclosures | Automated secret scanner in CI | Lead Agent | P0 | SERP-023 |
| **A.8.13** | Information backup | YES | PARTIAL | Supabase daily backups & WAL archiving | Documented restore drill report | Lead Agent | P0 | SERP-345 |
| **A.8.15** | Logging | YES | IMPLEMENTED + EVIDENCED | `services/telemetry.ts`, database audit logs | Centralized log retention & alerting | Lead Agent | P0 | SERP-301 |
| **A.8.20** | Network security | YES | IMPLEMENTED + EVIDENCED | Edge TLS 1.3 enforced, CORS origin restriction | Complete | Lead Agent | P0 | SERP-285 |
| **A.8.24** | Use of cryptography | YES | IMPLEMENTED + EVIDENCED | TLS in transit, AES-256 at rest, HMAC session signing | Key rotation policy | Lead Agent | P1 | SERP-346 |
| **A.8.25** | Secure development lifecycle | YES | IMPLEMENTED + EVIDENCED | PR gates, lint checks, 168+ automated unit/integration tests | Formal secure coding standard document | Lead Agent | P1 | SERP-339 |
| **A.8.31** | Separation of environments | YES | IMPLEMENTED + EVIDENCED | Local dev proxy $\rightarrow$ Supabase Staging $\rightarrow$ Production | Complete | Lead Agent | P0 | SERP-284 |
| **A.8.32** | Change management | YES | PARTIAL | Versioned PRs and migrations | Formal release sign-off documentation | Lead Agent | P1 | SERP-339 |

---

## 6. Gap-to-Roadmap SERP Mapping

To maintain strict WIP discipline, real ISO management gaps have been mapped into canonical SERP tasks:

- **`SERP-339` (P1)**: ISO/IEC 27001 Top-Level Information Security Policy & Governance Manual
- **`SERP-340` (P1)**: Information Asset Inventory, Data Classification Standard & Risk Register
- **`SERP-341` (P1)**: Security Incident Response Runbook & Quarterly Access Review SOP
- **`SERP-342` (P1)**: Cloud & SaaS Supplier Security Review Matrix (AWS, Supabase, Vercel, Google)
- **`SERP-343` (P2)**: Business Continuity Plan (BCP) & Disaster Recovery Runbook
- **`SERP-344` (P1)**: Privacy & Data Protection Compliance Dossier (Maldives DPA / ISO 27018)
- **`SERP-345` (P0)**: Automated Database Backup Verification & Point-in-Time Recovery Drill Report
- **`SERP-346` (P1)**: Cryptographic Key Management & Secret Rotation Standard
