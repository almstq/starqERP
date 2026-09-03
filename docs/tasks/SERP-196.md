# Task Execution Report: SERP-196

## Path length / backup exclusion / path-budget ruling

- **Phase:** Phase 2 — close path-budget + backup-exclusion ruling
- **Priority:** P1
- **Execution state:** Complete — documentation only
- **Date:** 2026-08-30
- **Accountable owner:** Vision, under Founder ruling
- **Authority:** Founder ruling (ROUND1_FOUNTAIN_RULINGS_2026-08-30.md) — SERP-196 approved

---

## Ruling

Founder ruling on 30 Aug 2026:

- Exclude `_backups` and `_recyclebin` from backup input.
- Adopt the 200-char live + 60-char wrapper path budget.
- No renaming.
- No deletion/consolidation of existing nested backup generations yet.

---

## What was actually changed

**Nothing in the repo was mutated.** This is a documentation-only execution because:

- The recon found no repo-owned canonical executable backup manifest/script in scope. The backup mechanism Elder described (`_backups` capturing previous backups) is an operational backup process, not a checked-in config the repo owns today.
- The ruling says "adopt" the budget and exclusion, and "if no canonical executable backup config exists, document the required change rather than manufacturing one." That is the path taken here.

So the deliverable for SERP-196 is the **policy document** recording the ruling, the measured path facts, the backup-exclusion requirement, and the path budget — not a config change (because there is no repo-owned config to change) and not a renaming.

---

## Measured path facts (from recon)

Measured across **237,645 files** under `D:\StarqTech`.

| Metric | Value |
|---|---|
| Absolute longest path | **330 characters** |
| Paths ≥ 260 (Windows MAX_PATH) | **3** |
| Paths ≥ 240 | 20 |
| Longest path in a LIVE working file | **240** — one file, under the limit |
| Live files ≥ 240 | **1** |

Every path over the Windows limit is inside `_backups`, and every one of them is a backup that captured a previous backup — i.e., `_backups` is capturing its own prior output and compounding.

The growth pattern is **compounding**, not linear: `_backups` is not excluded from its own backup, so each run wraps the prior run's output in a new ~45-character prefix.

The longest live path (240 chars) is a Club Ignition MIB company-profile PDF whose length comes from genuinely descriptive names. That file is easy to identify a year from now — which is the point of a vault. Renaming it would remove useful identifier length for no real gain.

---

## Backup exclusion requirement

**Required change (documented, not implemented):**

The backup process that produces `D:\StarqTech\_backups\` must be configured to **exclude `_backups/` and `_recyclebin/` from its input**. That single exclusion:

- removes all three over-limit paths,
- stops the compounding permanently.

Because the repo does not own the canonical executable backup config today, this is recorded as a required operational change, not as a repo commit. If/when a repo-owned backup manifest or script is identified, the exclusion should be expressed in that real canonical place rather than in an invented config format.

---

## Path budget (adopted)

> **Live working paths stay ≤ 200 characters. Any automated wrapper — backup, snapshot, export — must fit its prefix inside the remaining 60.**

Today 20 live files exceed 200 and the worst is 240, so this is a light-touch rule that flags the banking-application folder for shortening at leisure rather than a mass rename. The **60-character wrapper allowance is the actual control**: it makes a compounding prefix structurally impossible instead of merely discouraged.

---

## No renaming (explicit)

No files were renamed. The banking-application folder tree was **not** renamed. Those names are doing useful work (long-lived identifiability).

---

## No deletion/consolidation of existing nested backup generations (explicit)

No existing `_backups` nested generations were deleted or consolidated. The deeper copies are duplicates of a duplicate, not distinct history, but touching backups is a deletion question and the Founder ruling said **not yet**. Under the no-deletion rule the safe move is a deliberate consolidation into a dated archive with provenance retained, not `_recyclebin` — and that requires explicit Founder approval, which was not granted for this round.

---

## Non-goals (explicit)

- No repo mutation.
- No invented backup config format.
- No renaming.
- No deletion or consolidation of existing nested `_backups` generations.
- No assessment of the DEC-019 offsite drive beyond the restore-impact note in the recon.

---

## Windows restore impact (from recon, carried here for completeness)

- `git checkout` / `git clone` use the Win32 API and **fail at 260** unless long paths are enabled. Three files in `_backups` would fail a restore today.
- `core.longpaths=true` + `LongPathsEnabled` registry key raise the ceiling, but File Explorer, many installers and some Python/Node tooling still break. Relying on it means the vault restores only on a correctly configured machine — the wrong property for a disaster-recovery copy.
- The DEC-019 offsite drive is the real exposure: an encrypted external copy restored onto a fresh Windows machine is exactly the scenario where long-path support is *not* configured, and also where you least want a partial restore.

---

## Definition of done

- Path facts recorded.
- Backup-exclusion requirement documented as the required operational change.
- Path budget adopted and recorded.
- No renaming, no deletion/consolidation of existing nested generations, explicitly recorded.

---

## Files

- This record: `starqERP/docs/tasks/SERP-196.md`
- Recon source: `workspaces/vision/SERP-196_recon.md`

— Vision, SERP-196 documentation
