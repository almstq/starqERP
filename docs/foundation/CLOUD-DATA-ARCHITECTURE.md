# SB-FND-006 — cloud data architecture

Version: 0.1  
Status: proposed controlled baseline  
Effective date: 2026-08-20  
Decision basis: DEC-014, DEC-015 and DEC-017

## Scope

“Cloud database for all” means one shared data authority for all the foundation engine ERP modules and authorised organisations. It does not automatically include unrelated Starq products, personal data stores or legacy repositories.

Initial live organisations remain:

- Starq Technologies Pvt Ltd as tenant zero;
- Club Ignition Pvt Ltd as the first garage pilot.

A third live organisation requires an explicit onboarding decision and verified isolation tests.

## Selected direction

- Managed PostgreSQL through Supabase, following DEC-015.
- Modular monolith backend remains the business-rule and authorization authority.
- Portal and Flutter use one versioned HTTPS API.
- Flutter does not connect directly to database tables in the first controlled release.
- PostgreSQL row-level security is defence in depth, not a replacement for server authorization.
- Schema is changed through ordered migration files only; remote dashboard edits are prohibited after migration control starts.
- Online-authoritative operation with a bounded idempotent client retry queue, following DEC-014.
- Realtime, webhooks, edge functions and direct Data API access are deferred until a measured use case requires them.

```text
Flutter field app ─┐
                   ├─ HTTPS API ─ domain services ─ PostgreSQL
Web portal ────────┘                 │                 │
                                     ├─ audit/outbox   ├─ RLS defence
                                     └─ documents ────┴─ object storage
```

No service-role key, database password or privileged connection string may exist in Flutter, web assets, source, logs, screenshots or the comms bus.

## Data domains

| Domain | Core records | Authority notes |
|---|---|---|
| Organisations | organisations, business_names, memberships, seats, role_assignments | Every business record belongs to an organisation; Group is a view, not a company |
| Parties | contacts, customers, suppliers, addresses, communication preferences | A party is reused across sales, purchasing and jobs without duplicate free-text identities |
| Catalogue | products, services, categories, prices, tax_profiles | Prices and tax classifications are versioned; transactions preserve snapshots |
| Locations and stock | locations, stock_items, stock_movements, counts | Quantity changes only through immutable movements; no silent overwrite |
| Garage | vehicles, calls, bookings, jobs, job_events, estimates, authorisations, QC, handovers | Legal transitions are server-controlled |
| Purchasing | requests, quotations, awards, purchase_orders, receipts, supplier_bills, matches, payments | Separation of duties and document issue states are explicit |
| Sales | estimates, quotations, invoices, receipts, credit_notes | Issued documents are immutable and corrections reference originals |
| Accounting | journal_proposals, journal_entries, journal_lines, periods | Proposal and posted entry are distinct; DEC-008 remains active |
| Control | audit_events, idempotency_keys, outbox, exceptions, attachments | Append-oriented evidence with retention and access controls |

## Mandatory database rules

- UUID primary identifiers plus controlled human document numbers where needed.
- `organisation_id` is mandatory on tenant-owned records and included in uniqueness constraints.
- Exact decimal money with explicit currency; no floating-point financial storage.
- UTC timestamps plus declared business timezone for presentation and period rules.
- Foreign keys, checks and unique constraints enforce invariants independently of UI code.
- Optimistic version or equivalent concurrency control on mutable operational aggregates.
- Append-only financial, inventory and audit events.
- Idempotency key uniqueness prevents duplicate command effects.
- Issued documents cannot be updated into a different commercial fact.
- Soft deletion is not used to hide financial or audit history.

## Identity and authorization

The first cloud release preserves the existing Google-person-to-server-session flow. A change to Supabase Auth is a separate architecture decision; it must not be introduced incidentally by a Flutter database package.

Authorization layers:

1. Google establishes person identity.
2. Backend resolves organisation membership and acting seat.
3. Domain service authorizes the requested command and separation-of-duties rule.
4. Database role and RLS limit the backend connection as defence in depth.
5. Audit records the actor, organisation, seat, request and result.

## Environments

| Environment | Data | Purpose |
|---|---|---|
| Local development | Synthetic only | Migration, domain and integration development |
| Test | Synthetic deterministic fixtures | Automated acceptance and security verification |
| Pilot | Minimum required real Starq/CI records | Controlled garage use |
| Production | Approved tenant data | Created only after pilot acceptance and operational readiness |

Real data must not be copied into local fixtures. Test evidence uses synthetic identities and transactions.

## Migration sequence

1. Inventory the current JSON, journal, SQLite and file authorities; do not merge competing facts.
2. Define the canonical relational model and data dictionary.
3. Write migration `0001` with constraints, roles and RLS; review before any remote application.
4. Load synthetic seed data and run domain, isolation and restore tests locally.
5. Build read/write repositories behind the existing backend API; keep Flutter contract stable.
6. Reconcile and import organisation, catalogue and opening-state data with hashes and counts.
7. Run a rehearsal cutover against a disposable environment.
8. Approve a bounded pilot cutover with rollback and reconciliation reports.
9. Enable production only after backup, restore, monitoring and access-review evidence exists.

No dual-write period is allowed without an explicit reconciliation design and owner.

## Client behaviour

- API base URL is environment configuration, never a source edit per environment.
- Commands carry an idempotency key generated once and retained through retry.
- Retry only on classified transient failures.
- The UI distinguishes queued, accepted, rejected and unknown outcomes.
- A timeout is not displayed as success.
- The client never invents stock, price, permission, workflow state or accounting results.
- Sensitive response data is not cached beyond the operational requirement.

## Backup and continuity

- Provider backups do not replace an independent logical export and restore exercise.
- Database backup and object-storage backup are treated separately.
- Recovery objectives, retention and responsible person are recorded before pilot cutover.
- Restore is rehearsed into a non-production environment and reconciled by counts and control totals.
- The disconnected external-drive task remains a separate Tier-1 continuity control.

## Gates before a cloud project is created

- Founder confirms monthly USD ceiling and project ownership.
- Data-region and contractual/privacy position are recorded.
- Canonical schema and RLS design pass review.
- Migration and rollback procedure exists.
- Secrets locations and rotation ownership are defined.
- Backup and restore plan is approved.

Creating a Supabase project, access token, OAuth integration or production database is an external control action and requires separate founder authorization at action time.

## Official implementation references

- https://supabase.com/docs/guides/database/secure-data
- https://supabase.com/docs/guides/deployment/database-migrations
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
