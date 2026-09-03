# Task Execution Report: SERP-238

## Inventory of `starqERP/legacy/engine/` and disposition of its records

- **Phase:** Phase 2 — close stale-premise task cleanly
- **Priority:** P1
- **Execution state:** Complete — inventory only; no deletion
- **Date:** 2026-08-30
- **Accountable owner:** Vision (recon/execution), under Founder ruling
- **Authority:** Founder ruling (ROUND1_FOUNTAIN_RULINGS_2026-08-30.md) — SERP-238 approved re-scope; no deletion

---

## Ruling

SERP-238 was re-scoped by Founder ruling on 30 Aug 2026:

> Inventory `starqERP/legacy/engine/`. Identify existing ERP equivalents. Name anything with no equivalent as a gap. Identify records-value/provenance material, explicitly including `legacy/accounts.csv`. No deletion. Closure/inventory documentation is the deliverable.

The original premise — that the Python portal on `:51810` keeps running and acceptance could be demonstrated by "verified running after the change" — is false. The shell was closed 29 Aug 2026 (DEC-079). Nothing is listening on `:51810`. `web/src` has zero references to `:51810`, `legacy/engine`, or the foundation engine; the client traces the task described removing are already gone. What remains is the engine the task says not to touch.

---

## Inventory

`starqERP/legacy/engine/` is ~1.8 MB of Python and one CSV. The tree:

```
legacy/engine/
  auth.py                  43,445 B
  books.py                 24,661 B
  catalog.py                8,265 B
  journal_outbox.py       148,681 B
  masters.py               42,247 B
  ops.py                   63,651 B
  ops_guard.py              8,317 B
  pos.py                    8,317 B
  serve.py                247,987 B
  accounts.csv              5,843 B
  auth_allowlist.example.json
  env.example
  progress.json
  requirements.txt
  seats.json
  client/
  assets/
  ops/
  scripts/
  tests/
```

**What each file appears to be (functional reading, not execution):**

- `auth.py` — session/authority/auth allowlist logic for the legacy portal.
- `books.py` — the ledger/books representation; the file the DEC-051/DEC-068 architecture notes say holds the live garage books.
- `catalog.py` — item/catalog/stock master data.
- `journal_outbox.py` — journal outbox / posting outbox.
- `masters.py` — master data (organisations, persons, seats, etc.).
- `ops.py` + `ops_guard.py` — operational operations and their guard logic.
- `pos.py` — point-of-sale / counter operations.
- `serve.py` — the server/entry point; largest file; the running portal's entrypoint.
- `accounts.csv` — a CSV of accounts. Known candidate for records value; provenance not established here.
- `client/`, `assets/`, `ops/`, `scripts/`, `tests/` — supporting subtrees; not individually executed today.

---

## Existing ERP equivalents (read from the current starqERP product + SSOT)

The current product carries the canonical ERP equivalents of most of this surface, in the Postgres schema + TypeScript domain + contracts layer:

| Legacy surface | Canonical ERP equivalent | Notes |
|---|---|---|
| Ledger / journal posting | `contracts/commands.ts` + `supabase/migrations/*_settlement_allocations.sql` + `commercial_documents` + `journal_lines` | Double-entry, settlement allocations, posting via command envelope. The legacy engine's journal logic is **evidence**, not the active system. |
| Organisations / tenants | `public.organisations`, `public.organisations_applications`, platform tenant-control migrations | Multi-tenant spine; platform vs tenant planes. |
| Persons / seats / roles / memberships | `public.persons`, `public.memberships`, `public.membership_seats`, `public.roles`, `public.invitations` | Seat vocabulary unified under the ERP; legacy `auth.py` seats are legacy vocabulary. |
| Inventory / catalog | `public.goods`, inventory/valuation domain + `warehouse` surfaces | ERP carries warehouse/inventory surfaces; legacy `catalog.py` is the older shape. |
| Purchase orders / goods receipt / supplier bills | `commercial_documents` (PO/bill/receipt types) + three-way matching domain | ERP has the commercial doc model; legacy `ops.py`/`pos.py` are the older flow. |
| Payments / bank reconciliation | `payment_intents`, `payment_attempts`, `payment_refunds`, `payment_settlements`, `provider_events`, settlement_allocations, bank account migrations | ERP has the payments surface; legacy `pos.py` is the older counter/POS shape. |
| Reporting / P&L / trial balance | finance-kernel migrations + domain (`accounts.ts`, CoA spec, reporting) | ERP carries the finance kernel; legacy books are the older representation. |
| Session/authority | Supabase Auth + Edge functions + seat matrix + RLS | ERP carries the authority model; legacy `auth.py` is the older shape. |

**Bottom line:** the legacy engine is largely an **older implementation of surfaces the ERP now carries in a governed Postgres+TypeScript shape**. It is transitional implementation evidence (DEC-073/DEC-068 framing), not the active product.

---

## Gaps — things with no clear ERP equivalent yet

These are flagged as gaps, not quietly dropped. Some are explicitly deferred by architecture rulings; some are genuinely absent from the current product.

- **Live garage books persistence** — `books.py` + the ledger data it holds are the live garage books. The architecture says accounting remains in Python until the ERP has demonstrably held garage operations (DEC-051). A full equivalent is therefore not yet in the ERP by design, not by absence. This is a state/sequencing question, not a missing module.
- **Legacy seat vocabulary** — `auth.py` carries a seat vocabulary that the ERP seat matrix explicitly says is split three ways and incomplete. The ERP has unified the vocabulary under the matrix; the legacy file is the older, inconsistent set. The gap is **historical vocabulary consistency**, not a missing seat feature.
- **Legacy allowlist / session-upgrade behavior** — `auth.py` + `auth_allowlist.example.json` carry the old allowlist/session-upgrade behavior that the ERP's DEC-072-era work has been remediating. The gap is **legacy authorization-act-pattern history**, now largely superseded.
- **`progress.json`, `seats.json`, `env.example`** — operational/seed/config artifacts of the legacy portal. Their ERP equivalent is the ERP's seed/data/migration layer; whether there is a one-to-one mapping for each is a provenance question, not a defect.
- **`accounts.csv` contents and provenance** — the file exists; whether its contents correspond to the ERP chart of accounts, the legacy engine's internal accounts, or something else is a provenance question that requires reading the file rather than assuming. See records-value section.

---

## Records-value / provenance material

- **`legacy/accounts.csv`** — explicitly identified by Founder order as potential historical accounting data from the former authoritative engine until provenance is established. Preserved, untouched. **Not deleted, not moved, not interpreted as canonical.** Disposition: `preserved-as-historical-evidence; provenance-undetermined`.
- **`books.py`, `journal_outbox.py`, `ops.py`, `auth.py`** — executable specification of the legacy accounting/authority behavior. The architecture treats the legacy engine as transitional implementation evidence; these files are therefore **evidence worth preserving**, not trash. Disposition: `preserved-as-implementation-evidence`.
- **`serve.py`** — the largest file; the legacy portal's entrypoint. Evidence of what the closed shell was. Disposition: `preserved-as-implementation-evidence`.
- **`client/`, `assets/`, `ops/`, `scripts/`, `tests/`** — supporting artifacts of the legacy portal. Disposition: `preserved-as-legacy-portal-evidence; individual inventory deferred unless a Founder decision asks for it`.

---

## Explicit disposition status

**No files were deleted, moved, renamed, or cleaned.** All of `starqERP/legacy/engine/` is untouched, including `legacy/accounts.csv`.

| Artifact | Disposition | Reason |
|---|---|---|
| `legacy/accounts.csv` | Preserved-as-historical-evidence; provenance-undetermined | Founder order; potential historical accounting data |
| `legacy/engine/*.py` (auth, books, catalog, journal_outbox, masters, ops, ops_guard, pos, serve) | Preserved-as-implementation-evidence | Transitional implementation evidence per DEC-073/DEC-068 framing |
| `legacy/engine/auth_allowlist.example.json` | Preserved-as-legacy-portal-evidence | Historical allowlist shape |
| `legacy/engine/env.example`, `progress.json`, `seats.json`, `requirements.txt` | Preserved-as-legacy-portal-evidence | Operational/seed artifacts; provenance not asserted |
| `legacy/engine/client/`, `assets/`, `ops/`, `scripts/`, `tests/` | Preserved-as-legacy-portal-evidence; individual inventory deferred | Supporting subtrees; not individually inventoried today unless asked |

---

## Non-goals (explicit)

- No deletion of anything under `legacy/`.
- No move of `accounts.csv`.
- No interpretation of `accounts.csv` contents as canonical accounting data.
- No re-activation of the legacy shell.
- No claim that the legacy engine is the active system.
- No assessment of the DEC-019 offsite backup or any backup-restore run.

---

## Definition of done

- Inventory of `starqERP/legacy/engine/` recorded.
- Existing ERP equivalents identified where they exist.
- Gaps named rather than silently dropped.
- Records-value/provenance material identified, explicitly including `legacy/accounts.csv`.
- Explicit disposition status recorded for each artifact class.
- No deletion performed.

---

## Evidence boundary

This record is an inventory and disposition note. It does **not** prove:

- the exact current contents of `accounts.csv` (that requires reading the file and is a provenance step, not a deletion step);
- that every legacy surface has a 1:1 ERP equivalent today;
- that the legacy engine's behavior matches the ERP's behavior in any specific case.

---

## Independent acceptance

This task is inventory/documentation under a Founder ruling. It does not close a security or correctness gate that requires independent reproduction. No independent reviewer is required for the inventory itself; the ruling's "no deletion" boundary is the control.

---

## Files

- This record: `starqERP/docs/tasks/SERP-238.md`
- Preserved artifact: `starqERP/legacy/accounts.csv`
- Preserved artifact tree: `starqERP/legacy/engine/`

— Vision, SERP-238 inventory
