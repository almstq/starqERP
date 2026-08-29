# starqERP — Private Exclusion Manifest (KEEP PRIVATE)
**Classification**: STRICTLY CONFIDENTIAL / INTERNAL REPOSITORY ONLY  
**Purpose**: Inventory of proprietary, commercial, operational, and historical files that must be excluded from any public release.

---

## 1. Internal Agent Handoffs & Completion Reports
The following documents contain internal LLM/Agent execution transcripts, prompt artifacts, and internal handoff commentary:
- `docs/qa/ag-final/AG_COMPLETION_REPORT.md`
- `docs/qa/ag-final/DESIGN_SYSTEM_FREEZE.md`
- `docs/qa/ag-final/M3_FINAL_ACCEPTANCE.md`
- `docs/qa/ag-final/MASTER_AUDIT_RECONCILIATION.md`
- `docs/qa/ag-final/NEXT_DEVELOPMENT_HANDOFF.md`
- `docs/qa/ag-final/REMAINING_DEBT.md`
- `docs/qa/qoder-round1-foundation/FOUNDATION_RECONCILIATION.md`
- `docs/qa/qoder-round1-foundation/NEXT_AGENT_HANDOFF.md`
- `docs/qa/qoder-round1-foundation/QODER_ROUND1_COMPLETION_REPORT.md`
- `docs/qa/qoder-round1-foundation/REMAINING_FINDINGS.md`
- `docs/QA_M3_INDEPENDENT_AUDIT.md`
- `docs/QA_M3_QODER_AUDIT_270826.txt`
- `docs/ROUND1_INTEGRATION_MAP.md`
- `docs/starqERP_Round1_Foundation_Remediation_Engineering_Record_2026-08-27.md`

---

## 2. Founder / Executive Strategy & Commercial Audits
The following files contain proprietary commercial analysis, market positioning, pre-sales strategy, and competitor gap teardowns:
- `docs/ELDER_RETURN_BRIEF_2026-08-28.md` — Private executive return brief
- `docs/qa/commercial-replacement-audit/ACCOUNTING_READINESS_AUDIT.md` — Internal readiness assessment
- `docs/qa/commercial-replacement-audit/EXECUTIVE_VERDICT.md` — Private commercial appraisal
- `docs/qa/commercial-replacement-audit/MALDIVES_LOCALIZATION_AUDIT.md` — Internal market localization audit
- `docs/qa/commercial-replacement-audit/MIGRATION_READINESS_AUDIT.md` — Internal migration readiness audit
- `docs/qa/commercial-replacement-audit/ODOO_SAP_REPLACEMENT_GAP_ANALYSIS.md` — Proprietary ERP competitor teardown
- `docs/qa/commercial-replacement-audit/RECOMMENDED_PRE_SALES_ROADMAP.md` — Private commercial sales plan
- `docs/qa/commercial-replacement-audit/SECURITY_AND_SAAS_READINESS.md` — Internal pre-commercial security review
- `docs/qa/commercial-replacement-audit/TOP_10_COMMERCIAL_BLOCKERS.md` — Proprietary product blocker backlog
- `docs/roadmap/BOARD_REPRIORITIZATION_2026-08-27.md` — Internal backlog prioritization memo
- `docs/qa/coa-accountant-audit-2026-08-29/README.md` — Internal CoA audit index
- `docs/qa/coa-accountant-audit-2026-08-29/ACCOUNTANT_REVIEW_REPORT.md` — External accountant review of the live ledger
- `docs/qa/coa-accountant-audit-2026-08-29/ELDER_RECONCILIATION.md` — Internal finance-kernel defect reconciliation

---

## 3. Internal Task Specifications (SERP 001–286+)
The internal task specifications in `docs/tasks/` contain historical pilot details, legacy ticket numbers, and developer annotations:
- `docs/tasks/SERP-*.md` (All ~60 task files under `docs/tasks/`)
- `docs/tasks/pilot-ci/*.md` (All legacy pilot tasks)

*Note: The canonical public roadmap is summarized in `docs/roadmap/public-roadmap.md`, while fine-grained task execution is tracked internally in `starqNexus`.*

---

## 4. Internal Architecture Proposals & Merge Records
- `docs/architecture/2026-08-23_STARQERP-MERGE-PROPOSAL-FOR-APPROVAL.md`
- `docs/architecture/2026-08-23_STARQERP-MERGE-PROPOSAL.html`
- `docs/architecture/2026-08-24_PHASE-1-CLOSEOUT-REPORT.md`
- `docs/architecture/2026-08-24_PHASE-2-EXECUTION-PLAN.md`
- `docs/architecture/2026-08-24_PRIVILEGED-PATH-SECURITY-DEFINER-INVENTORY.md`
- `docs/architecture/2026-08-25_BOARD-HYGIENE-AND-GOVERNANCE-STANDARD.md`
- `docs/architecture/2026-08-27_PLATFORM_REALIGNMENT.md`
- `docs/architecture/DEC-070-PAYMENT-EXPENSE-ALLOCATION-MAPPING.md`
- `docs/security/2026-08-26_PRIVILEGED_PATH_INVENTORY_SERP-268.md`

---

## 5. Sensitive Identity & Contact Data
Any instances of real personal developer emails, private client contact details, or staging infrastructure endpoints must be scrubbed:
- Developer personal emails (`a.musthaq@gmail.com`, `starq.sys@gmail.com`, `nashidh3566@gmail.com`, `naleeeez@gmail.com`)
- Real client contact records in `contracts/tenant_import_pipeline.ts` (`rauf.ahmed@outlook.com`, `shaan.ib@gmail.com`)
- Staging Supabase project references (`wthabguvueewgtabjsdo.supabase.co`) in developer notes (must be replaced with generic `<project-ref>.supabase.co`).
