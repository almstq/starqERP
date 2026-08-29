# SB-FND-004 — definition of done

Version: 0.1  
Status: controlled working baseline  
Effective date: 2026-08-20

A task is done only when every applicable gate below is satisfied. “Works on my machine,” a screenshot, a build, a commit or an agent completion message is insufficient by itself.

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
