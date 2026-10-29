# StarqERP cleanup disposition — 2026-10-30

Scope: Founder Review Register `D:\StarqTech\starqERP Audit Register.md` (42 rows), reconciled against this checkout before changes. The register's evidence target was `almstq/starqERP` `main` at `53b8c8d`; this checkout was `docs/serp-erp-course-correction-2026-09-28` at `39702631659d0fa87d69c2c2e6f43d128096c164`, tracking its origin branch. The audit is therefore a comparison baseline, not a current-state manifest.

Archive: `D:\StarqTech\archives\starqERP-cleanup-20261030\` (outside the repository). `SHA256-MANIFEST.json` records 45 preserved files and verifies their archived hashes. Approximately 3.36 MB was moved. Git history was not rewritten. Existing `_tmp/` remains untouched because it contains untracked prior work; linked worktrees and CP2 were not altered.

| # | Disposition | Current-tree result |
|---:|---|---|
| 1 | Partial | Replaced identified personal/client email literals in tracked source, fixtures, tests and docs with `example.com` addresses; scanned for all exact listed values and found none. Did not add a broad email-pattern CI gate because legitimate support/contact addresses require an allowlist. |
| 2 | Deferred | Current endpoint and OAuth values also feed Vercel/deploy configuration and developer docs. No deployment-safe parameter source was established in this checkout; changing only the example file would leave the committed endpoint active. |
| 3 | Deferred | No remote branch deletion. Audit refs are stale and numerous linked worktrees exist; branch protection, PR state and worktree custody were not reconciled. |
| 4 | Preserved | No unmerged branch pruning or retagging. Active/WIP branches and linked worktrees remain untouched. |
| 5 | Deferred | `web/public/assets/brand/starq-corporate-logo.png` exists, but the audit's alleged `starq-logo.png` comparison file is absent at that path. Duplicate identity was not established. |
| 6 | Archived | `web/bun.lock` moved to the external archive; npm lockfile remains. |
| 7 | Archived | Broken `scripts/scan_unreferenced.cjs` moved to the external archive; `scripts/reachability-sweep.mjs` remains. Historical governance references remain as evidence. |
| 8 | Archived | `web/metadata.json` moved to the external archive; its remaining task-document reference now identifies it as archived. |
| 9 | Preserved | `web/src/components/ui/Table.tsx` remains because `web/src/components/ui/index.ts` exports it as public barrel API, despite no direct in-repo consumer. |
| 10 | Archived | Four tracked `_dream/` orchestration files moved outside the ERP repo. |
| 11 | Archived | One-off `OPENCODE_BRIEFING.md` moved outside the repo. |
| 12 | Archived | 26 PNG/JPEG/PPTX brand previews and raster assets moved outside the repo (3,144,291 bytes); SVG and HTML sources remain. |
| 13 | Archived | Two DOCX files with same-title/date Markdown twins moved outside the repo. |
| 14 | Preserved | DOCX files without a Markdown twin remain for review; current tree has one confirmed no-twin review document, not four as stated by the older audit. |
| 15 | Preserved | `legacy/engine/**` remains because the active CI audit gate cites `legacy/engine/auth.py`. |
| 16 | Archived | Seven `_*.txt` telecom/domain/Nexus correspondence files moved outside the repo; the audit counted six. |
| 17 | Preserved | `legacy/retired-ui/StarqHQView.tsx` remains classified as archived history. |
| 18 | Completed | Removed the stale `platform/StarqHQView.tsx` baseline entry from `scripts/lint-design-tokens.mjs`; the file is outside that script's scan root. |
| 19 | Deferred | Six machine-local scripts and three probe runners need bounded path/config changes and targeted harness validation; no broad refactor was made during this cleanup. |
| 20 | Deferred | Deno tests were not wired into CI because the audit could not install/run Deno (proxy 403); current toolchain availability and runtime results remain unverified. |
| 21 | Preserved | All PowerShell probe runners remain; no SQL probe invocation surface was removed or ported without per-runner parity verification. |
| 22 | Completed | All 12 retained files moved from `tests/evidence/` to `docs/evidence/`; task/handoff references were updated. |
| 23 | Preserved | `OrganisationSetupModal.tsx` remains because active SERP-275/SERP-276 tests import it. |
| 24 | Deferred | Badge implementations remain pending behavior/variant parity and migration of 31 import sites. |
| 25 | Deferred | Modal implementations remain pending focus/accessibility parity and migration of 15 import sites. |
| 26 | Preserved | `web/src/data/mockData.ts` remains while current tests import its tenant/staff/workflow fixtures. |
| 27 | Preserved | `contracts/` and generated `_shared/` duplication remains governed by sync and byte-identity checks. |
| 28 | Preserved | `README.md` / public draft generation remains governed by `scripts/sync-public.mjs`; source path was updated for `docs/release/`. |
| 29 | Preserved | Applied migration names were not changed. The current linter already checks monotonic full-version order and timestamp naming; repeated `0029`/`0030` suffixes are not identical full versions. |
| 30 | Deferred | Garage RPC/schema renaming remains a product/architecture decision; no compatibility or applied migration changes were made. |
| 31 | Deferred | Core currency, BML and vehicle type generalization remains a product/architecture decision. |
| 32 | Preserved | Isolated statutory/jurisdiction modules and their tests remain. |
| 33 | Deferred | Client-specific logo/fixtures remain because current UI and fixture references exist; no client-facing behavior or assets were removed on the stale audit alone. |
| 34 | Preserved | Applied HoAdha provisioning migration remains in history. |
| 35 | Completed | Seven release/publication documents moved to `docs/release/`; the one-off briefing and superseded cleanup draft were archived externally. `scripts/sync-public.mjs` now reads the moved README draft. |
| 36 | Superseded | The contradictory `REDUNDANT_FILE_CLEANUP.md` was archived. This disposition is its replacement; active migration/security gates were retained. |
| 37 | Completed | Five dated docs-root session artifacts moved to `docs/history/` and labeled historical, not current guidance; inbound references were updated. |
| 38 | Completed | `docs/governance/external research/` renamed to `docs/governance/external-research/`; references were updated. |
| 39 | Preserved | `docs/tasks/**` remains because durable external authority was not confirmed. |
| 40 | Preserved | Held-but-built capability screens/modules remain backlog assets; no held capability was deleted. |
| 41 | Preserved | `accountingEvents.ts` and its unfinished integration remain development work, not cleanup. |
| 42 | Deferred | Large-file refactors remain separate engineering work to avoid broad conflicts with active ERP lanes. |

## Verification and sync

Deferred rows are explicit; no product decision, branch deletion, migration renumbering, history rewrite, deployment secret rotation or live-service change was made.

## Verification executed

- Production build: PASS (Vite completed; existing large-chunk warning remains).
- Focused changed-source tests: PASS — 3 files, 12 tests.
- Full Vitest: 909 passed, 1 skipped; process failed on 1 unhandled existing CSV-download error (`URL.createObjectURL` in `ConsolidatedReportingView.tsx:109`).
- TypeScript: FAIL at existing `web/src/context/ERPContext.tsx:587` (`OrganisationApplication.entityType` missing in a state-update branch).\n- Legacy Python tests: NOT RUN — `pytest` is not installed in this environment.
- Migration linter: FAIL on active `202610260400_serp460_accounting_event_subledger.sql` (missing transaction wrapper); migration was preserved unchanged.
- Design-token ratchet: FAIL on four existing files without baselines (`migration/ContactBulkImportModal.tsx`, `OpeningStockBulkImportModal.tsx`, `ProductBulkImportModal.tsx`, `OpeningTrialBalanceWizard.tsx`). The stale StarqHQView baseline entry was removed.
- Reachability sweep: PASS — 169 unreachable files accounted for, zero unreviewed.
- Moved-document relative links: PASS; `git diff --check`: PASS.
- Archive manifest: PASS — all 45 archived copies match their recorded SHA-256.
- Exact email literals named in row 1: no longer present in the tracked working tree. The staging Supabase project reference remains under deferred row 2.

GitHub sync is recorded in the Room closeout with the resulting branch head. The full Vitest, TypeScript, migration-linter and design-ratchet failures are existing issues outside this cleanup's safe scope and remain visible for follow-up.