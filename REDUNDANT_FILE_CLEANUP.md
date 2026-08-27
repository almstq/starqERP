# starqERP — Redundant & Temporary File Cleanup Manifest
**Purpose**: Inventory of obsolete, duplicate, temporary, or superseded artifacts to delete before clean publication.

---

## 1. Compiled Cache & Test Output Artifacts
The following files are generated build/test caches and should not be tracked:
- `tests/__pycache__/*` (All compiled Python `.pyc` bytecode files)
- `web/bun.lock` (Duplicate lockfile; repository standard is `package-lock.json` with npm)
- `web/dist/*` (Build output, if present)

---

## 2. Temporary Audit & Helper Scripts
- `scripts/audit_repo_secrets.mjs` (Audit script created for release readiness check)
- `scripts/lint-migrations.mjs` (Replaced by CI test suite)
- `docs/QA_M3_QODER_AUDIT_270826.txt` (Raw text debug log from Qoder agent)

---

## 3. Superseded & Redundant Documentation Fragments
- `docs/architecture/2026-08-23_STARQERP-MERGE-PROPOSAL.html` (Raw HTML artifact superseded by markdown docs)
- `docs/ARCHIVE_CONVENTION.md` (Superseded by standard Git workflow documentation)
- `docs/UI_CONSTITUTION.md` (Consolidated into `docs/architecture/overview.md` and design system documentation)

---

## 4. Unused Large Media & Draft Brand Assets
Under `brand/v1.0/starqERP_brand_kit/`:
- `starqERP_Brand_Identity_System_v1.0.pptx` (6.2 MB PowerPoint presentation; not required for code repository)
- `logo_montage.png`, `presentation-preview.png` (Large raster previews)
- Redundant raw mockups under `previews/` and `ui/`

*Recommended Action*: Keep vector SVG brand assets in `web/public/` and `brand/v1.0/starqERP_brand_kit/logos/`, archive presentation slide decks to company storage.
