# StarqERP cleanup disposition — 2026-10-30

Scope: Founder Review Register `D:\StarqTech\starqERP Audit Register.md` (42 rows), reconciled against this checkout before changes. The register's evidence target was `almstq/starqERP` `main` at `53b8c8d`; this checkout was `docs/serp-erp-course-correction-2026-09-28` at `39702631659d0fa87d69c2c2e6f43d128096c164`, tracking its origin branch. The audit is therefore a comparison baseline, not a current-state manifest.

Archive: `D:\StarqTech\archives\starqERP-cleanup-20261030\` (outside the repository). `SHA256-MANIFEST.json` records 46 preserved files and verifies their archived hashes (4,737,931 bytes total, including the duplicate logo retained in the final correction pass). Git history was not rewritten. Existing `_tmp/` remains untouched because it contains untracked prior work; linked worktrees and CP2 were not altered.

| # | Disposition | Current-tree result |
|---:|---|---|
| 1 | Corrected in final pass | Replaced the six residual personal webmail fixture literals and `accounts@ignitionink.mv` with `example.com` fixtures; exact-value and webmail scans rerun. No broad email-pattern CI gate was added because legitimate support/contact addresses require an allowlist. |
| 2 | Partial; deployment route deferred | Removed the live OAuth client ID from the example, login fallback, settings display, and mutation-test fixture; local Supabase/API examples are empty and the Vite proxy reads `VITE_SUPABASE_URL`. Public OAuth/Supabase identifiers remain in the deployed Vercel route, Supabase project config, historical evidence, and operational runbooks where required. Replacing the deployment route is deferred to a deployment-aware routing change. |
| 3 | Corrected in final pass | Deleted 63 remote refs proven ancestors of current `main` and absent from every open PR head and linked worktree. GitHub now lists 113 branches: 16 merged refs remain (all `main`, open-PR, or worktree-attached); 97 refs are not ancestors of `main`. Active/WIP branches, all six open PR branches, all 40 worktree-attached branch refs, and every worktree were retained. |
| 4 | Preserved | No unmerged branch pruning or retagging. Active/WIP branches and linked worktrees remain untouched. |
| 5 | Archived and removed | Verified `starq-corporate-logo.png` is byte-identical to the referenced `web/public/starq-logo.png` (SHA-256 `3091A7F8CE67980066C4381C4FC68E6C7027DD606DB0B897C408CED9DFAAEA4B`), copied it into the external archive and added its hash to the archive manifest, then removed the unused duplicate. |
| 6 | Archived | `web/bun.lock` moved to the external archive; npm lockfile remains. |
| 7 | Archived | Broken `scripts/scan_unreferenced.cjs` moved to the external archive; `scripts/reachability-sweep.mjs` remains. Historical governance references remain as evidence. |
| 8 | Archived | `web/metadata.json` moved to the external archive; its remaining task-document reference now identifies it as archived. |
| 9 | Preserved | `web/src/components/ui/Table.tsx` remains because `web/src/components/ui/index.ts` exports it as public barrel API, despite no direct in-repo consumer. |
| 10 | Archived | Four tracked `_dream/` orchestration files moved outside the ERP repo. |
| 11 | Archived | One-off `OPENCODE_BRIEFING.md` moved outside the repo. |
| 12 | Archived | 26 PNG/JPEG/PPTX brand previews and raster assets moved outside the repo (3,144,291 bytes); SVG and HTML sources remain. |
| 13 | Archived | Two DOCX files with same-title/date Markdown twins moved outside the repo. |
| 14 | Preserved | Four DOCX review documents without Markdown twins remain in `docs/governance/VISION_INDEPENDENT_REVIEWS/`; retained for review. |
| 15 | Preserved | `legacy/engine/**` remains because the active CI audit gate cites `legacy/engine/auth.py`. |
| 16 | Archived | Seven `_*.txt` telecom/domain/Nexus correspondence files moved outside the repo; the audit counted six. |
| 17 | Preserved | `legacy/retired-ui/StarqHQView.tsx` remains classified as archived history. |
| 18 | Completed | Removed the stale `platform/StarqHQView.tsx` baseline entry from `scripts/lint-design-tokens.mjs`; the file is outside that script's scan root. |
| 19 | Deferred | Five Node scripts (including one QA draft) and three PowerShell probe runners still contain `D:/StarqTech` paths; the running-system audit also reads machine-local `_secrets`. Path/config changes require a bounded runner contract and local-path validation. |
| 20 | Implemented on current workflow | The current GitHub Actions run includes the Deno contract suite (169 tests); it passed on PR #177. The earlier audit's statement that CI only runs `commands_test.ts` is stale. Local Deno tests were not run during this pass. |
| 21 | Preserved | All PowerShell probe runners remain; no SQL probe invocation surface was removed or ported without per-runner parity verification. |
| 22 | Completed | All 12 retained files moved from `tests/evidence/` to `docs/evidence/`; task/handoff references were updated. |
| 23 | Preserved | `OrganisationSetupModal.tsx` remains because active SERP-275/SERP-276 tests import it. |
| 24 | Deferred | Badge implementations remain pending behavior/variant parity and migration of 31 import sites. |
| 25 | Deferred | Modal implementations remain pending focus/accessibility parity and migration of 15 import sites. |
| 26 | Preserved | `web/src/data/mockData.ts` remains while current tests import its tenant/staff/workflow fixtures. |
| 27 | Preserved | `contracts/` and generated `_shared/` duplication remains governed by sync and byte-identity checks. |
| 28 | Preserved | `README.md` / public draft generation remains governed by `scripts/sync-public.mjs`; source path was updated for `docs/release/`. |
| 29 | Preserved; linter verified | Applied migration names were not changed. The linter checks monotonic full-version order and timestamp naming; repeated short suffixes `0029`/`0030` are not duplicate full versions. The current migration-linter run passes. |
| 30 | Deferred | Garage RPC/schema renaming remains a product/architecture decision; no compatibility or applied migration changes were made. |
| 31 | Deferred | Core currency, BML and vehicle type generalization remains a product/architecture decision. |
| 32 | Preserved | Isolated statutory/jurisdiction modules and their tests remain. |
| 33 | Partial; product asset retained | The `accounts@ignitionink.mv` fixture is now `accounts@example.com`. `club-ignition-logo.png` remains because the current Settings UI and demo fixture reference it; removing or neutralizing client branding is a separate product decision. |
| 34 | Preserved | Applied HoAdha provisioning migration remains in history. |
| 35 | Completed | Seven release/publication documents moved to `docs/release/`; the one-off briefing and superseded cleanup draft were archived externally. `scripts/sync-public.mjs` now reads the moved README draft. |
| 36 | Superseded | The contradictory `REDUNDANT_FILE_CLEANUP.md` was archived. This disposition is its replacement; active migration/security gates were retained. |
| 37 | Completed | Five dated docs-root session artifacts moved to `docs/history/` and labeled historical, not current guidance; the final pass added the missing header to `CONVERGENCE_2026-08-30.md`. |
| 38 | Completed | `docs/governance/external research/` renamed to `docs/governance/external-research/`; references were updated. |
| 39 | Preserved | `docs/tasks/**` remains because durable external authority was not confirmed. |
| 40 | Preserved | Held-but-built capability screens/modules remain backlog assets; no held capability was deleted. |
| 41 | Preserved; status corrected | The accounting event domain module and its focused tests remain development work. Current `main` also contains the subledger migration and payment-side event producer path; the domain module's UI reachability remains a separate Convergence integration question. |
| 42 | Deferred | Large-file refactors remain separate engineering work to avoid broad conflicts with active ERP lanes. |

## Verification and sync

Deferred rows are explicit; no product decision, branch deletion, migration renumbering, history rewrite, deployment secret rotation or live-service change was made.

### Earlier branch-local verification (not evidence for `main`)

The checks below were executed on the cleanup feature branch before PR #174. They do not describe the tree that merged to `main` and are retained here as historical execution evidence only.

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

The full Vitest, TypeScript, migration-linter and design-ratchet failures above were not reproduced on merged `main` in the independent re-audit; they were branch-local results and must not be presented as current main failures.

### Final correction-pass verification against `main`

The correction branch was based on `main` `7c29272decab9330e6d6c2a304b684790f190140` after PR #176. Its checks describe that base plus only the corrections in this branch:

- TypeScript (`npm run lint -- --pretty false`): PASS.
- Full Vitest: PASS — 151 files, 987 passed, 1 skipped.
- Production build: PASS; Vite reports the existing large-chunk advisory.
- Migration linter: PASS — all 63 migration files.
- Design-token ratchet: PASS — 1,701 raw palette usages against the 1,702 baseline; no file grew.
- Strict reachability: PASS — 178 unreachable files accounted for, zero unreviewed.
- Focused login surface: PASS — 7 tests, including missing-client-ID behavior. GitHub CI is the final post-merge integration gate.
- Focused Python tests: NOT RUN (`pytest` is not installed). The Deno contract suite was not run locally in this pass; GitHub CI ran all 169 contract tests successfully on PR #177.
- Residual webmail scan: no Gmail/Yahoo/Hotmail/Outlook addresses remain in web tests, legacy engine tests, or demo fixtures. Generic domain rules and the setup guide's explanation of tenant allowlists remain.
- Duplicate logo: archived copy matches the removed file's SHA-256 and is recorded in the 46-entry archive manifest.
- Branch hygiene: 63 merged, unused GitHub refs removed; 113 remain. No active PR branch, worktree-attached branch ref, unmerged ref, worktree, or commit was removed.
- `club-ignition-logo.png` remains because Settings UI and demo fixtures reference it; brand neutralization remains a product decision.

After this correction branch merges, replace the provisional base SHA above with the verified merged `main` SHA and record the PR number and CI result here.
