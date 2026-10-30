# StarqERP --- Founder Product Direction and Development Objective

**Date:** 24 October 2026\
**Status:** Founder direction for Chief Engineer planning; not
implementation authorization\
**Related Room records:** #12690, #12693, #12696, #12700, #12701

## 1. Product and market

StarqERP is Starq Technologies' **industry-neutral, modular enterprise
resource planning platform**, initially designed for the **Maldivian
market**. It must support the real operating needs of Maldivian
businesses without inheriting a garage/workshop business model.

**StarqBooks** was the original POS project, initially developed around
a garage/workshop use case. That history is not StarqERP's current
product specification. Reuse sound engineering and business
functionality; isolate or generalize genuinely garage-specific
dependencies.

SAP and Microsoft Dynamics are **references for ERP principles,
integrated workflows, and modularity**, not targets for product size,
global feature parity, or multinational complexity. StarqERP should be
lean and locally relevant while delivering complete, correct
functionality within its own approved scope.

## 2. Permanent architectural requirement

**StarqERP is the platform; POS is its first commercial module.** The
core must not depend on POS or any single industry workflow. It should
provide the shared enterprise foundations required by the approved
scope, with clear boundaries and versioned integration contracts for
additional modules.

When resources permit, we intend to add capabilities such as **WMS, TMS,
CRM, HRM/payroll, manufacturing, asset management, and other business
modules**. These are future development directions, **not current
implementation assignments**. The architecture should permit a new
module to be developed and integrated without fundamentally rebuilding
the ERP engine. Normal governed schema, interface, and core evolution
remains acceptable.

Do **not** build speculative future modules or overengineer for
global-scale requirements today. Establish practical extensibility and
deliver the current scope.

## 3. Immediate development objective

Complete the **ERP core and integrated POS**, together with the business
functions and integrations needed to operate them correctly. Reconcile
exact coverage against the approved requirements and existing code,
rather than treating this note as a replacement specification.

The working system should support a realistic hypothetical Maldivian
company: organization and branch setup; roles and permissions; product
and inventory records; supplier purchasing and stock receipt; customer
sales and POS checkout; payments, returns, and refunds; appropriate
financial postings, reconciliation, and operational/financial reporting.

**100% development completion** means all functionality in the *agreed
current ERP/POS scope* is implemented, integrated, verified, and
accepted internally. I must be able to exercise end-to-end business
transactions and assess their correctness using my ERP, accounting,
procurement, and enterprise-planning expertise. This is not a request
for disconnected demo screens or mock behavior.

Vendor pilots, external assessments/certification, and commercial
release are separate later stages. Future enterprise modules are also
outside the present completion gate.

## 4. Resources and delivery approach

Use **today's available Development Studio workforce, provider
allowances, subscriptions, tools, and infrastructure**. Maximum-tier L1
plans and fully paid API capacity for all workers are not funded.
Limited resources affect sequencing and delivery time, **not the
intended functional quality or modular direction**.

Preserve existing implementation, accepted milestones, tests, and
engineering evidence. My approximate **50% completion** estimate is a
working impression, not a verified metric; establish actual completion
and remaining work from evidence. Prefer bounded, coordinated
implementation packages and independent verification rather than
restarting the ERP.

## 5. Chief Engineer deliverables

Codex should incorporate this direction into his **existing staffing and
execution plan (#12701)** and report:

1.  The verified current ERP/POS functional baseline and remaining gaps,
    informed by Antigravity's architectural assessment (#12700) and
    Claude's independent review.
2.  The smallest necessary architectural corrections to separate legacy
    garage assumptions while preserving reusable ERP functionality and
    future module extensibility.
3.  The critical path and parallel work packages to complete the agreed
    current ERP/POS scope.
4.  **Named staff assignments:** who owns architecture, implementation,
    integration, tests, independent review, and coordination;
    distinguish ready staff from proposed or blocked capacity.
5.  Measurable internal acceptance scenarios for a hypothetical company,
    and realistic milestones under current funding.

Codex owns routine engineering decisions, staffing and sequencing;
Claude supports deputy coordination and independent review. Escalate
only matters reserved for Founder authority.

## 6. Current authorization boundary

This document clarifies product direction and requests a reviewed plan.
It **does not lift the CP2 implementation hold**, approve schema or
database changes, authorize destructive refactoring, or permit
deployment/release. Complete and independently review the current
read-only architectural assessment, then recommend the controlled next
sequence through Room.

**Founder's outcome:** A lean, fully functioning **Maldives-first
StarqERP core with integrated POS**, designed to accept additional
enterprise modules later without fundamental reconstruction.
