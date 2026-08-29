# starqERP AI-native architecture

Status: founder product doctrine  
Effective date: 2026-08-20

## Product position

This architecture applies to the unified STARQ ERP described in
`STARQ-ERP-UNIFIED-BLUEPRINT.md`: one multi-tenant product with a common base
and internally developed modules, not separate the foundation engine and POS products.

starqERP is not traditional ERP software with an AI chat box added on top. It
is an AI-native operational platform in which agents continuously observe,
prepare, reconcile, forecast and propose the next legal action. Humans spend
less time navigating modules and re-entering facts; the system brings the next
decision and its evidence to them.

The commercial advantage is speed, automation and intelligence without losing
accounting integrity, tenant isolation, auditability or human authority.

## Runtime model

```text
Business facts and events
        |
        v
Deterministic ERP core ----> Accounting consequence engine
        |                              |
        v                              v
Agent observation plane         Proposals / journals / controls
        |
        v
Typed proposed command + evidence + confidence
        |
        v
Policy engine -> approval gate -> idempotent command executor -> audit
```

Agents can reason about the business, but they never become the database,
ledger, permission system or workflow authority.

## Agent-native capabilities

- Continuous exception detection and next-play prioritisation.
- Receipt/document extraction into quarantined proposals.
- Bookkeeping and journal proposals with explanation and evidence.
- Inventory demand, shortage and anomaly forecasts.
- Supplier comparison, lead-time and price intelligence.
- Customer follow-up and cash-collection preparation.
- Job costing, delay and margin warnings.
- Cash-flow forecasting and management explanations.
- Automated reconciliation and duplicate detection.
- Bounded workflow execution for low-risk, explicitly granted commands.

## Four planes

1. **System of record:** PostgreSQL facts, immutable events, issued documents,
   journal proposals and posted journals.
2. **Deterministic control:** identity, tenant, seat, SoD, state machines,
   accounting rules, idempotency, limits and approvals.
3. **Agent intelligence:** models, tools, retrieval, planners, evaluators and
   specialist agents. This plane has no implicit write authority.
4. **Evidence and oversight:** provenance, confidence, policy decision, human
   approval, model/tool versions, audit, rollback and incident review.

## Automation levels

| Level | Behaviour | Pilot position |
|---|---|---|
| A0 | Observe and explain only | Enabled where data is authorised |
| A1 | Draft/propose with evidence | Target for first AI features |
| A2 | Execute reversible low-risk command within a grant | Disabled until tested |
| A3 | Execute consequential command after human approval | Disabled until approval workflow passes |
| A4 | Fully autonomous consequential operation | Prohibited |

Automation level is assigned per capability, not per agent. An agent may be A2
for tagging a receipt and A0 for payments or permissions.

## Non-negotiable controls

- Typed command schemas; no natural-language execution.
- Separate automation identities; never borrow a human session.
- Organisation, capability, amount, time and tool limits on every grant.
- Human approval for payments, journals, permissions, identity, bulk export,
  deletion and external representation.
- Idempotency and an accepted/rejected/unknown state for every command.
- Evidence/provenance attached to every material proposal.
- Model output and retrieved content are untrusted until validated.
- No model or vendor receives unrestricted ERP data.
- Emergency automation kill switch and write freeze.
- Independent monitoring and recovery that do not depend on the agent being
  monitored.

## Product promise

starqERP should feel faster than traditional software because users act on a
ranked next play rather than hunt through screens. It should be safer because
every automated action is bounded, explainable, attributable and reversible
where the business fact permits. The product may be described as AI-native and
automation-first. It must not be described as infallible, autonomous without
limits, hack-proof or ISO certified.
