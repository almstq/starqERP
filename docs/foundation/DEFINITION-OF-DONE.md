<!-- SUPERSEDED-2026-09-28-ERP-COURSE-CORRECTION -->
> ## ⚠️ STARQERP COURSE CORRECTION — 28 SEPTEMBER 2026
>
> **This document REMAINS VALID and is extended, not superseded, by the 28 Sep 2026 course correction.**
>
> v0.2 gate sequence stands and is NOT replaced. Extended with the process-level definition of done, which adds accounting consequence, prohibited direct posting, reconciliation and reversal dimensions on top. Follow the extension below where it touches StarqERP completion doctrine.
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

# SB-FND-004 — definition of done

Version: 0.2  
Status: controlled working baseline  
Effective date: 2026-08-20 (v0.2 adopted 2026-08-30 by DEC-107)

A task is done only when every applicable gate below is satisfied. “Works on my machine,” a screenshot, a build, a commit or an agent completion message is insufficient by itself.

## The completion sequence

Added v0.2, after an overnight run in which six separate features were found to be
written, tested, green — and not in effect. The gates below are necessary and were
not sufficient, because every one of them can be satisfied by code no user can reach.

A feature is not complete because code exists and tests pass. As applicable, it is:

**landed → reachable → wired → tenant-isolated → production-path exercised → adversarially tested → truthful with real data → independently reviewed.**

| stage | the question it answers | how it failed here |
|---|---|---|
| **landed** | is it on the branch people actually run? | three tasks marked done sat on branches never merged; one had never been pushed at all |
| **reachable** | can a user open it? | eleven feature views were referenced by nothing but their own test file |
| **wired** | does the real path call it, or only the test? | a period lock was imported and never called; a posting gate existed with four unrouted call sites |
| **tenant-isolated** | has another tenant tried to read it? | 55 RLS policies had zero tests |
| **production-path exercised** | has it run where it will run? | structured logs verified by static assertion, never observed from a deployed function |
| **adversarially tested** | has anything tried to break it? | five append-only triggers had never been attacked |
| **truthful with real data** | does it show the tenant's numbers, or somebody's? | a dashboard showed MVR 1.05m of invented trading as soon as a tenant had one invoice |
| **independently reviewed** | did someone other than the author accept it? | DEC-072 |

An inconclusive result is a FAILING result. A check that cannot be performed must
report red, never green: an untestable guarantee reporting success is the defect,
not the reporting of it.

**Deliberate HOLD and RETIRE classifications are governed exceptions** (DEC-103). A
capability explicitly held or retired is not an incomplete feature; it is a recorded
decision. Routing a screen with no table, no command and no endpoint in order to
satisfy the reachability stage is expressly forbidden — it converts a measurement
into a target and defeats the purpose of the stage.

## External security evidence

Aikido Security is connected to this repository and scans it daily for static
analysis findings, secrets in history, dependency vulnerabilities, licences and
infrastructure misconfiguration.

**Aikido is ADVISORY EVIDENCE under this doctrine, not an automatic release gate**
(DEC-100). It feeds triage and independent security review. It does not block a
release today, and a passing Aikido report does not satisfy any stage above.

Two boundaries, stated because both are easy to get wrong:

- **An Aikido notification is not production alerting.** Aikido rates OWASP A09 and
  ISO A.8.16 as satisfied on the evidence that it can email us when *it* finds
  something. That is not this application's denial path reaching an on-call
  destination, and it does not satisfy the production-path-exercised stage for
  security events.
- **Aikido cannot see tenant isolation.** It has no model of a tenant, no view of the
  seat matrix, and no ability to evaluate a row-level-security policy against a live
  database. A green access-control rating is silent on cross-tenant reads, not
  supportive of them.

Before Aikido may become an automatic gate, this document must first define
release-blocking thresholds, remediation SLAs by severity, exception authority, and
false-positive handling (DEC-100). Until then, findings are triaged by a reviewer who
did not write the affected code, and are never mass-dismissed.

## Release ratchets

Two conditions are intended to block a release outright. **Both are DECLARED and
NEITHER IS ENFORCEABLE YET**, because the executable check each depends on is not
present in the landed lineage. They are recorded here as the standard, and the gap
between the standard and the mainline is stated rather than hidden — which is the
behaviour this document exists to require.

**1 · No unreachable feature view ships.**
`node scripts/reachability-sweep.mjs --strict` must exit 0. A view that is neither
routed nor explicitly accounted for is either finished or classified under DEC-103 —
it does not wait in the tree accumulating tests.
> **NOT ENFORCEABLE ON main AS AT 2026-08-30.** `scripts/reachability-sweep.mjs` is
> absent from `main`; it exists on `elder/2026-08-30-serp356-payment-failure-modes`,
> which carries Founder changes-requested findings and must not be merged until they
> are corrected and independently rechecked. The reachability CI gate itself
> (`tests/component_reachability.test.mjs`) sits on the separate PR #28 branch.
> `--strict` must additionally stay out of CI until the DEC-102 and DEC-103
> dispositions have actually been applied, or it will red-build on views that are
> deliberately held.

**2 · The application chart of accounts and the database seed must not diverge.**
A code the application offers that no migration seeds posts into thin air; a code
seeded into every tenant and absent from the chart is invisible to the people who own
it. Six accounts sat in the second state undetected because nothing compared the two.
> **NOT ENFORCEABLE ON main AS AT 2026-08-30.** SERP-340 merged the *correction*
> (`e04f7e3`) but no coherence test was merged with it: there is no test on `main`
> comparing `web/src/data/defaultChartOfAccounts.ts` against the migration seed.
> `web/src/test/chart_of_accounts.test.tsx` does not perform this comparison. The
> ratchet that would prevent the defect recurring therefore does not exist on the
> landed lineage, and writing this ratchet is outstanding work.


## Requirement

- The requirement has a stable ID, owner and acceptance criteria.
- Scope, exclusions and affected organisations are explicit.
- Material security, financial, inventory, privacy and continuity risks are identified.
- Conflicts with controlled decisions or higher-authority documents are resolved.

## Design

- The change follows the approved module and trust boundaries.
- Data ownership, state transitions and failure behaviour are specified.
- Authorization is server-enforced.
- Migration, compatibility and rollback effects are addressed.
- User-facing work follows the Starq interaction and accessibility baseline.

## Implementation

- No secrets, live personal data or credentials enter source, logs, fixtures or screenshots.
- Financial values use exact types and defined rounding.
- Writes are transactional and retry-safe where duplication would cause harm.
- Issued records and audit history cannot be silently overwritten.
- Error states are actionable and do not expose confidential internals.
- Code is structured in the correct module; monolith growth requires explicit approval.

## Verification

- Relevant unit, integration, authorization and end-to-end tests pass.
- Negative and boundary cases are tested, not only the happy path.
- Organisation isolation and acting-seat rules are tested directly.
- Migrations are tested from the supported previous state.
- Visual changes are reviewed at supported sizes and against WCAG 2.2 AA.
- Security acceptance maps to the selected OWASP ASVS 5.0.0 controls.
- Evidence identifies the exact code/version tested.

## Operations

- Configuration and deployment instructions are current.
- Health verification and rollback steps exist.
- Backup and recovery impact is considered.
- Logging and audit evidence support investigation without revealing secrets.
- Known limitations have owners and review dates.

## Control

- Traceability links requirement, implementation, test and evidence.
- Documentation and the execution board reflect the verified state.
- The implementer provides evidence; a separate reviewer accepts or rejects it.
- Founder approval is recorded for any conditional acceptance or business-risk exception.

## Final language

Allowed completion statement:

> Implemented and internally verified against requirements SB-…, with evidence at …; no certification claim.

Not allowed:

> ISO passed.

> Fully compliant.

> Production ready.

unless the precise scope, criteria, evidence and approving authority are stated.
