# `legacy/` — the foundation engine, frozen

This directory holds the project that STARQ ERP grew out of. It was absorbed here
on **29 August 2026** by founder ruling, and the repository it came from was
closed the same day.

**It is frozen. Do not build on it, extend it, or wire anything to it.**

---

## Why it is kept rather than deleted

Two reasons, and only two.

**1. It is the only executable specification of the double-entry rules.**
The accounting behaviour STARQ ERP owes — posting, settlement, seat authority,
the purchase ladder — exists here as working, tested Python. The board still owes
that work in TypeScript against Postgres. Until every one of those rules has been
reimplemented and proved, deleting the reference means reimplementing from prose.

**2. Two live drift detectors read from it.**
These are not documentation; they fail the build:

| Gate | Reads | Proves |
|---|---|---|
| `scripts/check-reality.mjs` → *Portal vs contract* | `legacy/engine/auth.py` | one seat vocabulary across both runtimes |
| `scripts/check-reality.mjs` → *Required headers* | `legacy/engine/client/api_client.dart` | client, Edge and CORS agree |
| `tests/test_seat_matrix.py` | `legacy/engine/auth.py` | `SCM_STEP_SEATS` agrees with the SQL purchase matrix |

If you move or prune these files, those gates go to SKIP and the drift they catch
becomes invisible. Point `LEGACY_ENGINE_PATH` at the new location instead.

---

## What is here

```
legacy/
  engine/          the Python double-entry engine and its HTTP shell
    tests/         16 test files — the executable spec
    ops/           seat, catalog and master reference data (no live occupancy)
    scripts/       backup and offsite helpers
    assets/        brand marks used by the shell
    client/        api_client.dart — kept only as evidence for the header gate
  docs/            the original repository's own documents, unaltered
```

## What is deliberately NOT here

- **The ledger.** Journals, `books.db` and the journal backups are Tier 1 and live
  in the vault under `00_STARQ_HQ/operations/finance/ledger/`. They are accounting
  records, and this repository has a public mirror. They must never be in it.
- **Live occupancy** — sessions, users, events, state. Vault only.
- **Club Ignition's SOPs.** Those are a separate workstream and live under
  `00_STARQ_HQ/corporate/subsidiaries/club-ignition/`.
- **The parked mobile console.** Retired to `_recyclebin/` — source preserved,
  build artefacts dropped. Only `api_client.dart` was kept, for the gate above.

## A note on the rename

The old project name was removed from this repository on 29 August 2026, including
inside historical documents under `docs/`. That is a **rename, not a redaction** —
no finding, date, defect or conclusion was altered. The documents in
`legacy/docs/` are the untouched originals if you need to compare.

Three categories deliberately kept the old spelling:

1. **Deployed Edge environment variables** (`STARQBOOKS_SESSION_SECRET`,
   `STARQBOOKS_GOOGLE_CLIENT_ID`, `STARQBOOKS_ALLOWLIST_JSON`,
   `STARQBOOKS_ALLOWED_ORIGINS`, `STARQBOOKS_GOOGLE_ANDROID_CLIENT_ID`) and the
   `_secrets/` filenames they read. Renaming these in code without changing the
   deployed Supabase secrets in the same breath breaks production sign-in. That
   migration is tracked separately and must be done as one atomic change.
2. **Negative-test literals** in `web/src/test/serp_032_product_metadata.test.tsx`
   and `tests/contract/commands_test.ts`. Those tests assert the stale name is
   *rejected*. They are the mechanism that keeps it from coming back — removing
   the literal would delete the guard.
3. **`legacy/docs/`**, kept verbatim as the provenance record.

## Provenance

- Closure tag: `foundation-closed-2026-08-29`
- Prior rollback point: `pre-merge-2026-08-23` (the DEC-067 core separation)
- Full history preserved on the private remote; nothing was deleted. Rule 2 holds.
