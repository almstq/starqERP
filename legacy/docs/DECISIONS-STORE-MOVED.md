# The decision store is not here any more

**`decisions.json` moved to `00_STARQ_HQ/decisions.json` (in the vault) on 22 August 2026.**
Authority: **`DEC-058`**, answered by the founder.

Do not re-create it here. `starqNexus/scripts/check-single-store.mjs` fails the build if a second
copy appears anywhere outside `_recyclebin` / `_backups`, and that check runs in `prebuild`.

## Why it moved

It was tracked by **no repository at all**:

| | |
|---|---|
| vault `.gitignore:72` | ignores `starqBooks/` wholesale — "it is committed there, not here" |
| starqBooks `.gitignore:8` | ignores `decisions.json` |

Both rules are **correct**. This repo has a GitHub remote (`almstq/starq-ops`) and these records
carry names, amounts and registration numbers — Tier 1 must never reach GitHub. But "must not go
to GitHub" is not "has no backup", and together the two rules meant 58 founder decisions existed
as a single file, on a single disk, with no history and no copy.

It was consequently **absent from the 22 August offsite bundles**, and the `decisions.json` inside
the 17 August zip is the *retired decoy lineage* — so the newest usable copy anywhere was five days
old and held the wrong answers.

Found by accident: `git add` refused to stage it, and the refusal was followed rather than worked
around.

## Why it could not simply be tracked in place

A nested `.git` is a hard boundary. `git add -f starqBooks/decisions.json` from the vault stages
**nothing** and reports **no error** — it silently does nothing. Moving it out was the only route
to version history.

## What now reads it

- `starqNexus/scripts/build-decisions-board.mjs` — resolves it, and exports `DECISIONS_PATH`
- `starqNexus/vite.config.ts` — the dev-only read/write API, via that export
- `starqBooks/serve.py` — `DECISIONS_FILE`, with **no fallback, deliberately**

`serve.py` has no fallback on purpose. It previously preferred
`00_STARQ_HQ/operations/finance/starqBooks/decisions.json` — the decoy retired on 22 Aug — and only
worked by *falling through* to the local sibling. Had anyone re-created that path, the portal would
have silently preferred a stale store over the live one. A standalone starqBooks checkout now has
no decision store, which is correct: founder decisions are not answerable from a detached copy.

## History that is worth keeping

- **21 Aug** — two stores consolidated into one, after they had drifted by 17 records.
- **22 Aug 09:03** — the nested decoy tree retired to `_recyclebin`. Correct, but the cleanup kept
  the *wrong survivor*: 12 answers reverted to `open`, `DEC-054` vanished, `DEC-018` flipped to its
  opposite. Recovered the same day. Nothing was lost, and only because of the never-delete rule.
- **22 Aug** — `check-single-store.mjs` written, so staying single is tested rather than merely
  intended.
- **22 Aug** — `DEC-058`: moved into the vault repo. Interim verified copy at
  `E:\STARQ-TIER1\decisions-store-20260822-0953\`.
