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

PR #177 is the integration path for these corrections. Its exact-head CI result and the resulting canonical `main` SHA are recorded in the Room closeout; the base SHA above identifies the `main` tree against which this correction pass was reconciled.

## Third independent audit disposition — 2026-10-30

Reference: `D:\StarqTech\starqERP Final Audit.md`, reconciled against `main` at `2085014634481d7ac38e71d643cdd6e3bafba39b`. This section records this audit's findings without replacing the earlier cleanup history.

| Finding | Disposition | Correction or reason |
|---|---|---|
| N-01 | Corrected | Contact bulk import awaits each customer/supplier command and counts a row only after a positive backend response. Rejected commands remove their optimistic row and appear as errors. |
| N-02 | Corrected | Replaced timestamp-derived local entity IDs with `crypto.randomUUID()`. After persistence, customer and supplier state adopts the canonical ID returned by the database, so later rollback and local identity do not depend on colliding millisecond timestamps. |
| N-03 | Corrected | Import refuses to start without a selected organisation, checks that the selected organisation is unchanged before each row, and preserves blank email values instead of synthesizing contact data. |
| N-04 | Deferred | Warehouse capability/reachability requires a separate roadmap and held-module decision; no warehouse behavior or route was invented in this defect pass. |
| N-05 | Corrected | Loaded Noto Sans Thaana and applied an explicit Thaana font class and language metadata to invoice script content. |
| N-06 | Deferred | Unifying the competing typography systems is a design-system decision beyond loading the missing script font. |
| N-07 | Corrected | Replaced the frontend AI Studio scaffold README with current StarqERP setup and verification instructions. |
| N-08 | Corrected | Removed the two temporary Vercel preview origins from the default CORS allowlist; preview access remains explicit opt-in. |
| N-09 | Corrected | Updated command contract copies and Supabase function documentation to describe the retired Flutter client as historical. |
| N-10 | Deferred | Renaming the `STARQBOOKS_` deployment secrets requires a coordinated secret/configuration rollout; no live secret was rotated in a repository PR. |
| N-11 | Corrected | Removed unused direct packages and repaired the cross-platform clean script. Retained `tsx` because the now-runnable token generator uses it. Applied compatible dependency updates; npm audit reports zero vulnerabilities. |
| N-12 | Corrected | Fixed the Material Color Utilities import and API use; exposed the generator as `npm run generate:m3-tokens`. |
| N-13 | Deferred | Backend/frontend capability balance is a product and roadmap decision, not a mechanical audit correction. |
| N-14 | Deferred | Splitting the large ERP context is a broader architecture refactor and remains separate from the bounded import fix. |
| N-15 | Partially corrected; broader helper deferred | The affected customer/supplier mutations now await persistence and consistently roll back failed optimistic rows. A shared cross-entity mutation framework is a larger refactor and was not introduced here. Abort-on-error is explicitly reported as a partial import when earlier rows have committed; those independent commands cannot be rolled back atomically by the current API. |
| N-16 | Corrected | Added a tracked-document content guard to CI for stale AI Studio/Gemini and retired-client claims, with documented historical/evidence exclusions. |
| R2 row 2 / `web/vercel.json` | Deferred | The public Supabase route remains hardcoded because the static Vercel rewrite has no verified deployment-aware target in this checkout. Replacing it requires deployment configuration and production `/api` route verification. |
| R2 row 19 | Deferred | Machine-local script paths need a portable runner/configuration contract; changing the seven runners without that contract risks local audit behavior. |
| R2 row 20 | Corrected in CI | CI now runs all 20 Deno contract files, including the PostgreSQL-backed persistence contract after migrations. |
| R2 row 21 | Partially corrected; remainder deferred | CI now runs the additional Python concurrency, idempotency, numbering, and seat-matrix checks. The remaining standalone SQL probes are retained because their fixture and database prerequisites differ; wiring them needs a probe-specific disposable-database contract. |
| R2 row 29 | No change required | The linter orders full 12-digit migration versions; repeated four-digit suffixes are not duplicate full versions. Existing migration names and history remain unchanged. |

No held warehouse capability, existing applied migration, product-architecture decision, active branch, or worktree was changed as part of this correction pass. One new forward-only migration, `202610300500_call_idempotency_response_repair.sql`, was added after database CI exposed a legacy `CALL` response defect: successful calls returned SQL `NULL`, and replays could return only the generic accepted fallback. The migration patches one uniquely checked marker in the existing function definition so successful calls return and persist the canonical response; the mutation handler and existing migration history remain intact. SERP-176 now exercises the initial response and replay.

### Verification for the third audit branch

- Full frontend Vitest: PASS — 151 files, 991 passed, 1 skipped.
- TypeScript (`npm run lint`): PASS.
- Vite production build: PASS; existing large-chunk advisory remains.
- `npm audit`: PASS — zero known vulnerabilities after compatible lockfile updates.
- Migration linter: PASS — 63 migration files; documentation guard: PASS — 252 tracked documents/contracts.
- OAuth/origin checks: PASS. Pre-push secret scan: PASS — zero violations across 963 tracked files.
- Migration rehearsal, tenant hardcoding, security, support, legal, UI consistency/responsive, component reachability, strict reachability, reachability ratchet, and design-token gates: PASS.
- Python local suites: PASS — document numbering 6/6; seat matrix 11/11. Database-backed Python concurrency tests are assigned to the PostgreSQL CI job.
- Deno contracts: PASS locally for 19 non-database files — 420 passed; the optional SERP-447 live PostgreSQL check skipped because no local database was available. SERP-446's database-backed persistence file was not run locally; the PR CI job applies migrations and runs all 20 files against PostgreSQL.
- Token generator: PASS; generated output did not modify tracked files.
- Focused browser regression: PASS — Chromium SERP-328 commercial journey; related customer price-list and invoice Vitest tests PASS — 11/11.
- Exact-head GitHub CI on code head `90100d9023f727c801d64c16565806aaac288313` (run `40968017050`): PASS. Backend/governance gates; all 20 Deno contract files (425 passed); PostgreSQL RLS/tenant, SERP-314, SERP-460, SERP-443 probes; payment/settlement/idempotency/document-numbering concurrency; frontend TypeScript/design gates/full Vitest (151 files, 991 passed, 1 skipped)/production build; and Playwright acceptance (15 passed, 1 intentionally skipped). The E2E fixture now returns a persisted customer UUID; the job and invoice modals reconcile selection when the optimistic ID is replaced.
- Migration linter: PASS — 64 migration files, including the new forward-only CALL response repair; no existing applied migration was modified.
- Workflow YAML parse and `git diff --check`: PASS. PR #178 remains unmerged; a final complete CI rerun is required after the disposition update commit before GitHub integration.
