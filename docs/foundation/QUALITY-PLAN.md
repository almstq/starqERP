# SB-FND-003 — product quality plan

Version: 0.1  
Status: controlled working baseline  
Effective date: 2026-08-20

## Quality objective

Deliver a garage-usable the foundation engine pilot that preserves the permanent ERP kernel, protects company information, produces trustworthy records and can be operated, tested, restored and improved by people other than its original implementer.

## Quality characteristics and release evidence

| Characteristic | Day-0 objective | Minimum evidence |
|---|---|---|
| Functional suitability | The controlled garage path produces correct operational and accounting outcomes | Approved workflow requirements, automated scenario tests and founder acceptance |
| Performance efficiency | Routine actions remain responsive on the actual pilot devices and network | Measured response and screen timings for named workflows |
| Compatibility | Portal, API and Flutter use one versioned contract without duplicate business rules | API contract tests and supported-version record |
| Interaction capability | A garage user can complete the next legal action without ERP training | Observed task test, error-path test and WCAG 2.2 AA checklist |
| Reliability | Retries do not duplicate business events and failures preserve recoverable state | Idempotency, transaction, failure-injection and recovery tests |
| Security | Organisation and seat boundaries hold against direct requests, not only UI hiding | ASVS-based tests, threat model and access review |
| Maintainability | Modules, migrations and decisions are understandable and changeable without monolith growth | Architecture review, code review and complexity/dependency record |
| Flexibility | A future organisation or module is configuration and extension, not a fork | Org-isolation and configuration tests |
| Safety | The system prevents or clearly stops actions that can create financial, inventory or operational harm | Hazard/risk controls, blocked-action tests and exception handling |

## Mandatory engineering controls

### Data

- Relational constraints protect required relationships and organisation ownership.
- Money uses exact decimal representation with currency recorded.
- Time is stored consistently and presented in the declared business timezone.
- Issued records are immutable; corrections reference the original.
- Schema changes use ordered, testable and reversible migrations.
- Seed, fixture and live data are clearly separated.

### Workflow

- Legal state transitions are explicit.
- Authorization is checked for each transition on the server.
- Separation of duties is enforced and tested.
- Retries use idempotency controls.
- Exceptions have an owner, status and resolution trail.

### Security and privacy

- Secrets and live identity data stay outside source and Git.
- Least privilege applies to users, agents and services.
- Inputs, attachments and outputs are validated and safely handled.
- Security-relevant actions are logged without leaking secrets.
- Dependencies and releases have provenance and review.
- Incidents have a recorded triage and corrective-action route.

### Operations

- Each release has deployment, verification and rollback instructions.
- Backups are encrypted where appropriate and separated from the primary system.
- Restore tests prove recovery; successful backup creation alone is insufficient.
- Health, error and audit information is usable without exposing confidential content.
- Runtime configuration is versioned separately from secrets.

## Verification layers

1. Static and formatting checks.
2. Unit tests for domain rules.
3. Database constraint and migration tests.
4. API contract and authorization tests.
5. Integration tests across workflow, inventory and accounting proposal.
6. End-to-end golden-path and failure-path tests.
7. Accessibility and responsive visual review.
8. Pilot-device and pilot-network verification.
9. Backup restoration exercise.
10. Independent acceptance by someone other than the implementer.

## Nonconformity and corrective action

A failed control is recorded with:

- affected requirement and evidence;
- impact and immediate containment;
- root cause proportional to risk;
- corrective action and owner;
- regression test;
- verification of effectiveness.

Closing a ticket without effectiveness evidence does not close the nonconformity.

## Release decision

A release is either:

- **accepted** — every mandatory gate passes;
- **conditionally accepted** — founder records the bounded risk, expiry and treatment owner;
- **rejected** — a mandatory control or evidence item is absent.

Silence, a demo, a successful build or an agent recap is not release acceptance.
