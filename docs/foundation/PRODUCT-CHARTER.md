# SERP-FND-001 — STARQ ERP product charter

Version: 0.1  
Status: controlled working baseline  
Effective date: 2026-08-20

## Product intent

starqERP is AI-native and automation-first. Agents observe, prepare, reconcile,
forecast and propose the next legal action across the ERP. Deterministic domain,
permission, accounting and approval controls remain authoritative; model output
is never a financial fact merely because an agent produced it. See
`AI-NATIVE-ERP-ARCHITECTURE.md` and `AI-AND-API-THREAT-MODEL.md`.

STARQ ERP is one modular, multi-tenant product. Starq Technologies is the first rollout tenant and Club Ignition is the second internal pilot tenant. Starq Dynamics is an operating activity inside Starq Technologies; Ignition Ink is a Club Ignition workshop outlet. `legacy/engine` is a transitional repository/evidence label, not a separate product. Counter/POS capability is an ERP module, not a separate product track. The authoritative module map and delivery sequence are in `STARQ-ERP-UNIFIED-BLUEPRINT.md`.

The pilot must prove the permanent foundations rather than create garage-specific shortcuts that later require a rebuild.

## Day-0 principles

1. **Truth before convenience.** Financial, inventory and workflow records must represent what actually happened.
2. **One authority per fact.** A record has one system of record and controlled projections, never competing truth stores.
3. **Server-enforced control.** A hidden button is not authorization. Organisation, role and separation-of-duties rules are enforced by the backend.
4. **Accounting is consequence, not decoration.** Operational actions create traceable accounting proposals. Automatic posting remains gated until explicitly approved.
5. **Immutable history.** Issued documents and completed events are corrected through controlled follow-up records, not silent edits.
6. **Configuration over forks.** Organisations, business names, tax profiles, services and permissions are data, not separate applications.
7. **Usable under pressure.** The next legal action is obvious. Routine garage work must not require understanding accounting or ERP terminology.
8. **Secure by default.** Least privilege, secrets isolation, input validation, audit and recovery are built into the normal path.
9. **Evidence over claims.** A feature is complete only when requirements, tests and verification evidence agree.
10. **Improve without losing control.** Small releases, migrations, rollback paths and corrective actions are normal operating practice.

## Pilot boundary

### In scope

- person authentication, organisation membership and acting seat;
- customer, supplier, contact and vehicle masters;
- products, services, prices, tax classification and locations;
- call, booking, intake, estimate and customer authorization;
- job card, parts request, purchasing, receiving and stock movement;
- work, independent quality control, handover, invoice, payment and close;
- accounting proposal, founder review and controlled manual posting;
- audit, exceptions, attachments, backup and recovery;
- Ali portal and Club Ignition field experience.

### Not yet in scope

- unrestricted activity outside a tenant's legitimate business profile;
- a separate STARQ POS product;
- public signup or a third live organisation;
- manufacturing, advanced CRM or full HR;
- automatic general-ledger posting before the existing founder gate is lifted;
- ISO certification claims.

## Pilot success condition

One real Club Ignition job can travel from recorded call to balanced accounting proposal with:

- no invented customer, amount, stock, tax or approval data;
- every state transition authorized and timestamped;
- inventory unable to oversell silently;
- issued commercial documents reproducible and versioned;
- accounting remaining balanced and organisation-correct;
- an audit trail understandable by someone who did not write the code;
- a tested restore path for the information required to continue operations.

## Product surfaces

| Surface | User purpose | Boundary |
|---|---|---|
| Web ERP | Tenant-branded command, configuration and controlled approvals | Shows only authorised tenant/outlet/modules |
| Flutter field app | Tenant-branded point-of-action work | Service/workshop flow first; same tenant boundary as web |
| Accounting engine | Validate and report financial consequences | No operational UI authority and no silent posting |
| API | One controlled contract for portal and Flutter | Server is authoritative for organisation, permission and state |

## Governance

- Founder owns business and risk-acceptance decisions.
- Architecture owner controls module boundaries, data contracts and technical acceptance.
- Implementer cannot approve their own completion evidence.
- Quality review can reject a completion claim without rewriting the business requirement.
- Every unresolved material risk has an owner and disposition.
