# STARQ ERP foundation register

Document set: `SB-FND`  
Owner: Starq Technologies Pvt Ltd  
Product owner: Ali Musthaq  
Status: controlled working baseline  
Effective date: 2026-08-20  
Review trigger: material architecture, regulatory, security, workflow or standards change

## Purpose

This folder controls the day-0 engineering foundation for unified STARQ ERP. The `legacy/engine` repository name is transitional; it holds controlled evidence and the first implementation. STARQ ERP is the single product, beginning with Starq Technologies and Club Ignition as equal internal tenants.

The documents establish requirements and evidence expectations. They do not claim certification, regulatory approval or audit acceptance.

## Controlled position

Approved wording:

> the foundation engine uses ISO-aligned engineering and documented quality controls from day 0. Certification is a future independent assessment and is not claimed.

Prohibited wording unless independently established:

- ISO certified
- ISO approved
- ISO accredited
- fully ISO compliant
- certified secure

## Register

| ID | Document | Purpose | Status |
|---|---|---|---|
| SB-FND-001 | [Product charter](PRODUCT-CHARTER.md) | Product boundary, pilot and operating principles | Baseline |
| SB-FND-002 | [Standards position](STANDARDS-POSITION.md) | Standards profile and claims policy | Baseline |
| SB-FND-003 | [Quality plan](QUALITY-PLAN.md) | Quality objectives, controls and evidence | Baseline |
| SB-FND-004 | [Definition of done](DEFINITION-OF-DONE.md) | Mandatory release gate | Baseline |
| SB-FND-005 | [Requirements traceability](REQUIREMENTS-TRACEABILITY.csv) | Requirement-to-evidence index | Initial |
| SB-FND-006 | [Cloud data architecture](CLOUD-DATA-ARCHITECTURE.md) | Shared PostgreSQL authority, migration and client boundaries | Proposed baseline |
| SB-FND-007 | [Data authority inventory](DATA-AUTHORITY-INVENTORY.md) | Pre-cloud sources, reconciliation and import rules | Verified baseline |
| SB-FND-008 | [Backend data ports](BACKEND-DATA-PORTS.md) | Repository boundaries and controlled adapter cutover | Proposed baseline |
| SERP-BP-001 | [Unified STARQ ERP blueprint](STARQ-ERP-UNIFIED-BLUEPRINT.md) | Main base, module map, tenancy model and release slices | Authoritative product strategy |

## Authority order

For product-foundation questions:

1. Founder decision recorded in `decisions.json`.
2. `STARQ-ERP-UNIFIED-BLUEPRINT.md`.
3. This controlled foundation set.
4. `ERP-READY-CORE.md` and `README.md` as historical implementation evidence.
5. Module and interface specifications.
6. Implementation notes and agent messages.

Later documents cannot silently weaken a higher-level control. A conflict is recorded and resolved before implementation continues.

## Change control

Every controlled change records:

- reason and affected requirement IDs;
- approver;
- implementation and migration impact;
- tests and evidence affected;
- rollback or supersession route.

Version control is evidence of change, not evidence that a requirement is correct. Approval and verification remain separate activities.
