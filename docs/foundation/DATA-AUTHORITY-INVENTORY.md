# Data authority inventory — pre-cloud baseline

Status: verified from disk on 2026-08-20  
Purpose: prevent migration from merging incompatible authorities or inventing history

## Existing authorities

| Source | Current role | Cloud treatment |
|---|---|---|
| `journals/**/*.journal` | Financial source of truth | Reconcile and import only through a controlled opening/entry migration; remains authoritative while DEC-008 is active |
| `books.db` | Rebuildable SQLite projection of journals | Never migrated as an independent source; regenerate for comparison only |
| `ops/events.jsonl` | Append-only operational event feed | Import with stable source reference, organisation, actor/seat evidence and deduplication |
| `ops/state.json` | Derived operational state and job sequence | Rebuild from accepted events where possible; reconcile sequence separately |
| `ops/masters/*.json` | Current organisation, user, permission, contact, catalogue, inventory, tax and payroll masters | Map to canonical tables with explicit null/unknown handling and source hashes |
| `ops/catalog/*.json` | Workflow/catalogue/accountability configuration | Separate configuration from transactional records; version the imported configuration |
| `decisions.json` | Founder decisions and gates | Retain as controlled decision evidence; do not flatten into transaction tables |
| Files under `ops/artefacts/` | Operational evidence | Import metadata and hashes; store binary objects separately from database backup |

## Reconciliation rules

- `null`, missing and zero retain distinct meanings.
- An ops-derived name does not become a contact master automatically.
- A JSON `entity` code maps through an approved organisation crosswalk; it is not trusted as a foreign key by itself.
- SQLite rows never override journal facts.
- Duplicate operational events are resolved by source identity and content hash, not row order alone.
- Issued numbers and current sequence counters are reconciled before any cloud issue action is enabled.
- No live personal email is copied from the local allowlist into migration fixtures or Git.
- Every import produces counts, rejected rows, hashes and a rollback boundary.

## Required import stages

1. Freeze and hash the selected source snapshot.
2. Validate journals and export a financial control report.
3. Build organisation and person crosswalks without live credentials.
4. Import configuration and masters into a disposable database.
5. Import operational events and rebuild current job state.
6. Import accounting facts or approved opening balances under the chosen cutover method.
7. Compare organisation counts, document sequences, stock control totals and trial balance.
8. Record rejects and obtain founder disposition; never silently drop them.
9. Destroy the disposable environment or promote only through the approved cutover procedure.

## Not yet verified

- RLS behaviour under the future backend database role.
- Complete event-to-state replay for every existing event type.
- Exact cloud cutover accounting method.
- Object-storage inventory and recovery procedure.

## Cloud execution evidence

- The three controlled migrations executed successfully on the empty Starq
  Books Supabase project on 2026-08-20.
- The linked remote schema linter reported no schema errors.
- No seed or live authority data was imported.
- Execution success does not establish RLS correctness, rollback capability,
  restore capability or cutover readiness.
