# StarqERP — Founder-Approved Business-Lifecycle Roadmap and Cloudroom Board Migration Mandate
**Date:** 2026-11-06
**Authority:** Founder-approved product trajectory, as stated in conversation on 2026-11-06.
**Scope:** StarqERP project `ERP` / Cloudroom project `proj_tbjw64z9ku`.
**Status:** FINAL PRODUCT DIRECTION; IMPLEMENTATION MAPPING REQUIRED.
**Important:** This document supersedes module-first planning as the *active roadmap organization*. It does not erase historical records, repeal security gates, or attest to uninspected task-level facts.

## 1. Non-negotiable product model
StarqERP is an industry-neutral, Maldives-first, multi-tenant business operating system. The immediate commercial core is inventory/stock ERP **with POS as an integrated module**, not a standalone POS product. Advanced manufacturing, WMS, TMS, HRM and other breadth are future modules unless needed for the core operating lifecycle.

**Roadmap unit of value = an executable business outcome, not a merged module, screen, schema, test file or GitHub PR.**

Five canonical and interconnected business lifecycles:
1. **O2C / Order-to-Cash:** customer and terms; quote/order or direct counter sale; price/discount/tax; availability/reservation; fulfilment; invoice/AR; stock issue and COGS; payment allocation; returns/refunds/credit notes; settlement; GL and reconciliation.
2. **P2P / Procure-to-Pay:** supplier and terms; requisition/authorization; PO; partial/full receipt and discrepancy; landed cost and valuation; invoice matching; AP; payment; supplier returns/adjustments; bank and GL reconciliation.
3. **I2GL / Inventory-to-General Ledger:** item/UOM/location/valuation; receive; reserve; transfer; issue; return; stock count/adjustment; COGS; inventory subledger; inventory-control GL reconciliation.
4. **C2B / Cash-to-Bank:** tender/payment initiation; capture and idempotent retries; settlement, fees, clearing; bank deposit/import and matching; failed payments, refunds, reversals and differences; bank/cash GL reconciliation.
5. **R2R / Record-to-Report:** operational events/subledger; accounting rules and journal proposals; approvals and posting; control-account reconciliation; trial balance; period adjustments; close/reopen safeguards; statements and statutory tax reporting.

**Shared foundation (not a sixth competing chain):** organization/tenant creation, identity and authorization, master data, CoA, fiscal calendars, tax setup/date-effective rates, opening balances, auditability, migration and data-integrity controls.

The chains are NOT five sequential development phases. They share transactions and accounting consequences. A direct POS sale is an O2C variant; procurement receipts feed I2GL; all financial events feed R2R. Track the handoffs explicitly.

## 2. Required Cloudroom task architecture
Implement the hierarchy logically using Cloudroom's supported project/task/parent/tag/metadata features; do not assume nested boards or unsupported fields.

- **L0 Product outcome:** useful, industry-neutral stock ERP + integrated POS.
- **L1 Process family:** FOUNDATION, O2C, P2P, I2GL, C2B, R2R; plus GOVERNANCE/QUALITY for work not owned by one process.
- **L2 Business activity:** independently meaningful user action and outcome (e.g. partial goods receipt; customer refund; period close).
- **L3 Scenario/acceptance:** happy path, partial, cancellation, reversal, failure, retry, concurrency, cross-tenant, audit and reconciliation as relevant.
- **L4 Engineering packet:** production caller, domain logic, schema/migration, UI/API, integration, tests and reviewer evidence.

Every active task must be traceable to a business activity or a shared control, have an explicit outcome, owner, acceptance evidence, and dependencies. Distinguish *engineering delivered*, *scenario accepted*, and *process closed*. Historical DONE must remain historically DONE even where acceptance is unverified; attach evidence-gap flags rather than inventing rejections or approvals.

## 3. Business process acceptance definition
For each L2/L3 activity specify:
- initiating actor, permissions and preconditions;
- input business documents/data and state transition;
- authoritative production execution path, including real caller;
- operational side effects, financial/subledger/GL effects, tax and inventory consequences as applicable;
- cross-chain handoffs and invariants;
- error/partial/reversal/retry/idempotency/concurrency scenarios;
- audit evidence and traceability;
- tenant isolation and Maldives-specific compliance;
- independent review and repeatable fresh-database test.

Do not mark L1 complete until realistic end-to-end transactions run through production paths, reconcile and close with evidence. Keep task completion, scenario coverage and process maturity as separate progress measures.

## 4. Exact disposition of legacy tasks
The Cloudroom session MUST enumerate every imported SERP row and produce a lossless mapping before mutating the board:
- **KEEP** when correctly scoped.
- **RENAME** to a business-outcome title when original title hides intent; retain original title/ID in provenance.
- **SPLIT** when one task contains independently verifiable outcomes; retain original as umbrella/historical parent and create child tasks with lineage.
- **CONSOLIDATE** when several tasks represent one indivisible outcome; create one acceptance umbrella, link all historical tasks and preserve each ID/status/evidence.
- **CONVERT** obsolete customer/garage-specific requirements into neutral reusable capabilities when justified.
- **DEFER** future product breadth; do not delete.
- **SUPERSEDE** replaced or duplicate requirements, with replacement links and historical record preserved.
- **ADD** missing business activity, exception, handoff, acceptance or shared control, only after searching for equivalent existing work.
No bulk deletion, fabricated completion, overwritten historical IDs, or duplicate work. A smaller ACTIVE set, not a smaller historical register.

For each original row record: source ID, title, original state, target family/activity/scenario, treatment, replacement/child IDs, reason, evidence, dependency changes, status/acceptance distinction, rollback reference.

## 5. Initial targeted restructuring hypotheses (verify against live board)
- **SERP-354:** retain original and CP2 HOLD #12690; organize capture, refund, settlement and payment-command boundary as independently accepted scenarios; no implementation against unclassified garage dispatch architecture.
- **SERP-460:** shared durable accounting-event/subledger foundation; distinguish merged schema/abstraction from production caller integration.
- **SERP-461:** umbrella for separately accepted inventory, AR, AP, cash-clearing and tax reconciliation invariants; merged orphan modules do not count as process closure.
- **SERP-462:** cross-cutting migration/fresh-DB CI enforcement, not a fictitious sequential successor of SERP-461.
- **SERP-463:** umbrella for five process-level acceptance suites, with real assertions and production paths; skipped tests do not count.
- **SERP-464:** Cash-to-Bank business activity closure (fees, clearing, deposit, exceptions), split by meaningful outcomes.
- **SERP-465:** Procure-to-Pay business activity closure (landed cost, valuation, AP, payment), split by meaningful outcomes.
- **SERP-466:** Inventory-to-GL reservation/transfer/valuation reconciliation; preserve original Founder business-rule holds, including sales-order wiring.
- **SERP-467:** Record-to-Report close and closed-period enforcement; separate posting controls from financial reporting acceptance.
- **SERP-003 / 009 and related Club Ignition-specific rows:** use the disposition register and issue #186; retain reusable industry-neutral requirements, remove obsolete named-pilot gates from active core.
- **SERP-379:** release-level isolation evidence gate remains open pending proper scope coverage; do not auto-close from narrower SERP-443.
- **GST-201 date-effective TGST defect:** independent compliance fix and test, do not silently change historical tax rates.

These are mapping directions, NOT assertions that all listed changes have already been applied.

## 6. Dependencies: replace false linearity
Reject `354 → 460 → 461 → 462 → 463 → {464,465,466,467}` as a universal chain.
Use a typed DAG:
- **Business prerequisite:** e.g. goods receipt before receipt valuation; accounting events before reconciliation acceptance.
- **Technical prerequisite:** e.g. payment handler before payment-capture assertions.
- **Control/gate:** CI migration enforcement before eligible integration/merge; tenant isolation before release.
- **Founder HOLD:** CP2 payment-command/dispatch, sales-order business rule, or other expressly retained holds.
- **Acceptance dependency:** downstream process closure requires verified cross-chain financial handoff.
Avoid an edge when tasks can proceed independently; never clear a HOLD by changing a status or renaming a task. Show parallel lanes separately from release-critical dependencies.

## 7. New execution trajectory (outcome-gated, not date-gated)
**Gate 0 — Preserve:** snapshot and hash the uncommitted 437-row source, prior 407-row HEAD, live Cloudroom export, and decision register. Preserve reversible mapping.
**Gate 1 — Authority repair:** resolve conflicting DEC-1xx numbering with crosswalk; establish Cloudroom board write authority; retain October 30 restart authorization; apply Founder-approved product direction as a new governance record without falsely claiming historical decisions vanished.
**Gate 2 — Lifecycle coverage and migration design:** enumerate all 437 imported tasks, classify them, identify missing activities and exceptions, build proposed L1-L4 hierarchy and typed dependency DAG, report split/consolidate/add/defer counts and all affected IDs. Validate no task is lost and no duplicate outcome created.
**Gate 3 — Reversible board migration:** apply the Founder-approved lifecycle restructuring to Cloudroom's live ERP board, using supported APIs; preserve IDs/provenance, checkpoint and diff every mutation, verify totals and dependency consistency, and report before/after. User has approved the *product trajectory and reorganization*, but destructive record loss, release of specific architectural HOLDs and changes to unrelated project governance are not implied.
**Gate 4 — Business foundation and controls:** CI migration/fresh-DB gate, tenant isolation, tax accuracy, accounting event wiring, reconciliation contracts, stable process acceptance framework.
**Gate 5 — Core operating scenarios:** demonstrate usable tenant setup, stock receipt, direct POS sale, inventory valuation/COGS, invoicing, tender and GL posting with actual production callers. If CP2 prevents payment command paths, work independently on unblocked scenarios and keep those paths explicitly gated.
**Gate 6 — Full chain closure:** O2C, P2P, I2GL, C2B, R2R accepted through cross-chain tests, negative paths and reconciliation.
**Gate 7 — Internal operating acceptance:** real-world business cycle, period close, tax reporting, recovery, independent review and audit. This is internal product readiness, not a claim of public launch.

Within each gate, parallelize genuinely independent work. Do not force all five chains into serial development. Re-evaluate PR #185 by its actual P2P dependency and readiness, not merely its green CI.

## 8. Required Cloudroom outputs and implementation protocol
1. `LIFECYCLE_COVERAGE_MATRIX`: L1/L2/L3 business scenarios, current proof, missing behavior, responsible SERP IDs, cross-chain consequences.
2. `SERP_437_DISPOSITION_REGISTER`: exact per-ID KEEP/RENAME/SPLIT/CONSOLIDATE/CONVERT/DEFER/SUPERSEDE and new-task lineage.
3. `LIFECYCLE_DEPENDENCY_DAG`: typed edges and separate hard holds.
4. `MIGRATION_DIFF_AND_ROLLBACK`: original and new records, snapshots/hashes, every task/edge change and recovery instructions.
5. `BUSINESS_ACCEPTANCE_SCORECARD`: per chain, scenarios accepted vs total, independent evidence, cross-chain closure.
6. `EXECUTION_WAVES`: available parallel packets with owners and acceptance gates; no fictitious deadlines.
7. `UNRESOLVED_AUTHORITY`: only actual unresolved Founder business rules or conflicts; do not re-litigate the already-approved product trajectory.

**Execution instruction:** The Founder has approved the lifecycle-first restructuring. Cloudroom should implement the supported reversible task-board changes after preservation and authority checks, rather than stop at another abstract plan. If the live board lacks an API for a proposed hierarchy, implement with supported parent/metadata/labels and document the mapping. Never edit the preserved source snapshot to make history appear different. Publish a concise completion receipt with counts and links.

## 9. Handover boundary
This GitHub file is the authoritative **Founder-approved design mandate** for the new trajectory. It is not a direct read of Cloudroom's live board. The local Cloudroom agent owns verification of all 437 records, exact per-ID mapping, and safe execution of board mutations. This document intentionally contains no speculative per-row classification beyond verified examples and named hypotheses.
