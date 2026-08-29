# starq.mv — Source Mockup Reuse & Disposition Audit

**Audit Date**: 2026-08-27  
**Source Directory**: `D:\StarqTech\mockups`  
**Evaluator**: Lead Engineering Agent  
**Standard**: Authoritative Corporate Identity & Two-Plane Domain Architecture  

---

## 1. Executive Disposition Matrix

| Source File / Directory | Category | Disposition | Rationale & Reuse Plan |
| :--- | :--- | :---: | :--- |
| `starq_technologies/index.html` | Corporate Home | **REVISE** | Clean typographic baseline. Revise to distinctly present Starq Technologies Pvt Ltd, Starq Technologies (R&D Studio), Starq Dynamics (Management Services), and products without looking like a pure starqERP landing page. |
| `starq_technologies/dynamics.html` | Starq Dynamics | **REVISE** | Excellent service structure. Revise to present professional management services (finance, bookkeeping, HR, payroll, operations) using the Starq corporate logo. |
| `starq_technologies/erp.html` | Product Page | **REVISE** | Solid truthful posture. Update to `v0.2.0-beta`, link to `erp.starq.mv` authentication gateway, and align with starqERP product branding. |
| `starq_technologies/company.html` | About / Corporate | **MERGE** | Merge corporate registration and Maldivian legal jurisdiction facts into `starq.mv/legal` and corporate home. |
| `starq_technologies/contact.html` | Contact | **REVISE** | Retain clean quotation/inquiry form structure; route inquiries to Starq Dynamics vs. starqERP design partner tracks. |
| `starq_technologies/starqbooks.html` | Legacy Branding | **RETIRE** | Stale single-tenant naming (`starqBooks`); superseded by `starq.mv/starqerp`. |
| `starq_technologies/legal/privacy.html` | Legal / Privacy | **REVISE** | Revise to mirror canonical `docs/PRIVACY.md` under `starq.mv/privacy`. |
| `starq_technologies/legal/website-terms.html` | Legal / Terms | **REVISE** | Revise to mirror canonical `docs/TERMS.md` under `starq.mv/terms`. |
| `redesigns/starq_web_architecture_redesign.html` | Redesign Draft | **REVISE** | Modern layout components and CSS tokens; extract grid and hero patterns for `starq.mv`. |
| `redesigns/index(3).html` | Duplicate Redesign | **RETIRE** | Duplicate of `starq_web_architecture_redesign.html`. |
| `COMMERCIAL_SERVICE_CATALOGUE.md` | Dynamics Specs | **REUSE** | Direct content source for `starq.mv/dynamics` scope, inclusions, and contract gates. |
| `PUBLIC_CLAIMS_REGISTER.md` | Claims Governance | **REUSE** | Authoritative guardrails for public capability claims and availability boundaries. |
| `STARQERP_PUBLIC_CAPABILITY_MATRIX.md` | Capability Truth | **REUSE** | Direct content source for `starq.mv/starqerp` capability breakdown. |
| `public-site-facts.json` | Metadata JSON | **REVISE** | Update product version to `0.2.0-beta`, verify corporate facts, and bind to `contracts/commands.ts`. |
| `assets/starq-launch.css` / `starq.css` | Stylesheet Assets | **REVISE** | Align color tokens with Material 3 design tokens and official corporate mark. |
| `ignition_ink/*` & `ci-mark.png` | Club Ignition Assets | **IGNORE** | Customer/tenant assets; strictly excluded from Starq corporate website. |

---

## 2. Key Synthesis & Modernization Rules

1. **Brand Separation**: Replace all starqERP blue product icons on corporate surfaces with the official `starq-logo.png` corporate mark.
2. **SaaS Boundary**: Ensure no ERP runtime application screens, demo dashboards, or tenant data exist on `starq.mv`. All app interactions route to `erp.starq.mv`.
3. **No Fake Claims**: Preserve the rigorous "Truth-in-Advertising" posture established in the mockups. Present in-development features as active R&D, not generally available commercial claims.
