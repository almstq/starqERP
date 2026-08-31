# STARQ UI Stack V1 Final Micro-Polish Report

Date: 2026-08-31

## Baseline

- VS Code freeze verdict acknowledged: **FREEZE PASS WITH NON-BLOCKING DEBT**.
- Sacred baseline: `1295a8ac0f2bdc75472e241b95dd892769f5d6a5`.
- Scope: one warning-only micro-polish extension. No dependency, routing, navigation, product-semantic, or public-release change was made.

## Issues considered

| Item | User impact | Evidence | Decision |
| --- | --- | --- | --- |
| Duplicate legacy Badge switch cases | Repeated build/test warning obscured useful diagnostics; all legacy Badge renderings retained the same variant mapping. | The component had duplicated `positive` and `destructive` union/case entries; 27 callers import the legacy component. | Fix now. |
| Vite large-chunk advisory | Non-blocking build advisory with no isolated, behavior-preserving micro-fix established in this extension. | Build remains green and advisory remains after Badge cleanup. | Defer as non-blocking debt. |
| Other frozen UI surfaces | No independently demonstrable defect was found that could be corrected without reopening approved behavior. | Final freeze review and delta validation. | Do not change. |

## Executed delta

- Removed only the redundant `positive` and `destructive` entries from `web/src/components/common/Badge.tsx`.
- Preserved every accepted public prop, default, canonical Badge delegation, and variant mapping.
- Added `web/src/test/legacy_badge_variant_mapping.test.tsx`, an eight-case regression test for positive, destructive, warning, info, blue, purple, accent, and neutral mappings.
- No visual token, layout, responsive rule, focus behavior, routing surface, dependency, package manifest, or lockfile changed.

## Evidence

- Caller census: 27 legacy Badge importers; the shared component contract is unchanged.
- Variant regression test: **PASS** (8/8 cases).
- `npm run lint`: **PASS**.
- `npm test -- --run --reporter=dot`: **PASS** (83 files, 305 passed, 1 skipped).
- `npm run build`: **PASS** (2,386 modules transformed); the duplicate Badge warning is absent.
- `git diff --check`: no content errors in the extension. Existing governance-file line-ending notices are unrelated and unstaged.

## Interaction and visual preservation

- The corrected code maps to the same existing canonical Badge CSS variables, so light and dark rendering are preserved.
- No DOM structure, interactive handler, keyboard/focus affordance, width rule, or responsive class changed. Zoom and narrow-layout behavior therefore retain the frozen baseline behavior.
- There is no route or page-surface delta to re-test: the only production change removes unreachable duplicate switch branches. The new mapping test proves the rendered canonical variant token for every supported legacy variant.

## Final disposition

- Duplicate Badge warning: **FIXED**.
- Vite large-chunk advisory: **LEFT AS NON-BLOCKING DEBT**.
- No public deployment or push was performed.
- Focused commit: `fix(ui): remove redundant legacy Badge cases`.
- Rollback: revert this focused commit to return exactly to the `1295a8a` baseline.

Recommendation: **READY FOR DELTA FREEZE REVIEW**.
