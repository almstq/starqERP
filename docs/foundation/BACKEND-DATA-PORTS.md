# Backend data ports and adapter cutover

Status: proposed controlled baseline  
Effective date: 2026-08-20

## Purpose

Move the foundation engine from file-specific business logic to PostgreSQL without changing the portal or Flutter contract, duplicating domain rules or running unsafe dual writes.

## Boundary

HTTP handlers translate requests and responses only. Domain services own validation, authorization, state transitions and accounting consequences. Repositories persist and retrieve approved domain records; they do not decide whether an action is legal.

```text
HTTP handler
  -> authenticated request context
  -> domain command/query service
  -> unit of work
  -> repository ports
       -> current file adapters (temporary)
       -> PostgreSQL adapters (target)
```

## Required ports

| Port | Current adapter | Target adapter |
|---|---|---|
| OrganisationRepository | `ops/masters/organizations.json` + allowlist context | organisations, business_names, memberships and seats |
| PartyRepository | `ops/masters/contacts.json` | contacts |
| CatalogueRepository | product, inventory, tax and location JSON | products, prices, locations and inventory_items |
| GarageRepository | `ops/events.jsonl` + `ops/state.json` | garage_jobs and immutable job_events |
| StockRepository | inventory JSON + stock events | inventory_items and stock_movements |
| CommercialRepository | journal-outbox/document projections | commercial_documents and lines |
| JournalRepository | journal parser + plain-text journals | proposals plus posted journal entries/lines after DEC-008 cutover |
| AuditRepository | auth and ops event records | audit_events |
| AttachmentRepository | local artefact paths | attachment metadata + controlled object storage |
| IdempotencyRepository | absent/incomplete | idempotency_keys |

## Request context

Every command receives an immutable context containing:

- request ID;
- person ID;
- organisation ID;
- acting seat;
- idempotency key for a mutating command;
- request timestamp;
- authenticated source/client version.

The backend sets the matching transaction-local PostgreSQL context before repository calls. Client-supplied organisation or seat values are never trusted without server resolution.

## Unit of work

One business command uses one database transaction. The transaction contains:

1. idempotency acquisition;
2. authoritative read and concurrency check;
3. domain authorization and invariant validation;
4. state and append-only event writes;
5. audit/outbox write;
6. idempotency result;
7. commit.

External notifications occur from the outbox after commit. A webhook failure cannot roll back or duplicate the business fact.

## Cutover stages

1. **Extract ports:** place interfaces in front of existing file operations with behaviour unchanged.
2. **Characterize:** retain golden tests proving the current accepted behaviour and known limitations.
3. **Add PostgreSQL adapters:** test only against synthetic disposable data.
4. **Shadow read:** compare PostgreSQL projections with file results; serve file results only. Record differences.
5. **Rehearse import:** restore a disposable database, import a frozen source snapshot and reconcile.
6. **Pilot cutover:** stop writes, take final hashes/backups, import, reconcile and switch one bounded organisation/workflow.
7. **Rollback window:** if a gate fails, stop cloud writes and restore the pre-cutover file authority; reconcile any accepted cloud commands explicitly.
8. **Retire adapters:** only after the pilot evidence and founder approval; retain read-only migration evidence.

No uncontrolled dual-write mode is permitted.

## API compatibility

- Existing route meanings remain stable during adapter extraction.
- Schema changes do not leak raw table models into Flutter.
- Responses use versioned DTOs and explicit nullable/unknown states.
- New cloud failure states are additive and truthful: queued, accepted, rejected or unknown.
- Accounting posting behaviour remains unchanged until DEC-008 is explicitly superseded.

## Acceptance evidence

- Contract tests run against file and PostgreSQL adapters.
- Organisation-isolation tests attempt direct cross-tenant access.
- Retry tests prove one user intent creates at most one business result.
- Migration reset applies all migrations and synthetic seed from zero.
- Imported control totals and source hashes reconcile.
- Restore rehearsal recreates database and attachment metadata in a disposable environment.
- Runtime switch and rollback are documented and independently observed.
