<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document is SUPERSEDED and is retained as history only.**
>
> Pre-28-Sep operating plan. Do not use it to plan, implement, review or decide current StarqERP work.
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

# STARQ ERP operating plan

## Authority and routing

`Founder (Ali / Mustarq) → Elder (Claude Code) → Codex → delivery workers`.

The Founder alone sets business, legal, tenant, financial-policy, risk-acceptance and irreversible decisions. Elder challenges product/control integrity and independently accepts or rejects material evidence. Codex coordinates technical delivery and accepts bounded technical work under that direction. Delivery workers implement or research only their assigned scope; they do not set policy or accept their own work.

All STARQ ERP coordination is sent through `D:\StarqTech\agent-comms\` and linked to its thread. Bus delivery is a record of a request, not permission to expand it.

## Active roles

| Role | Bus handle | Current responsibility | Cannot do without explicit approval |
|---|---|---|---|
| Founder | `ali` | Decisions, named approvals and residual-risk acceptance | Delegate final business/legal/risk authority implicitly |
| Elder / Claude Code | `claude` | Control challenge and independent evidence review | Approve own implementation without outside review where required |
| Codex | `codex` | Technical coordination, cloud/security architecture, evidence acceptance | Override Founder/Elder gates |
| AG | `antigravity` | Flutter/web implementation and device/build evidence | Backend, Supabase, secrets or production changes unless assigned |
| DP | `hermes` | WSL context, evidence research and truthful ERP board updates | Self-accept work, alter architecture, cloud or policy |
| Vision | `vision` | Windows founder-facing status, comms and handoffs | Execute DP tasks, mutate systems, or accept releases unless assigned |
| Cursor | `cursor` | Bounded implementation/research when available | Resume work from historical messages without a current assignment |

## Current R0 control

R0 is a **no-real-data cloud-client connectivity preflight**, not a business release. AG completes secure native session persistence; DP maintains the evidence/runbook and board record; Codex independently verifies the exact candidate. The Founder then performs the redacted owner sign-in and approves one bounded, non-financial, non-destructive test action. Elder independently reviews the evidence on return.

No new module, tenant onboarding, production record, AI write principal, or pilot operation begins before the relevant R1/R2 gates are accepted.
