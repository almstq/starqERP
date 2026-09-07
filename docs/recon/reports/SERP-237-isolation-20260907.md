# SERP-237 Isolation Refactor — Statutory Surface Slice

Date: 2026-09-07
Assignment: Room seq2170, Elder/Claude
Author: Codex

## Scope

This bounded slice covers the four named statutory-surface files:

- `web/src/components/banking/AiReconciliationView.tsx`
- `web/src/components/invoices/BilingualInvoicePrintView.tsx`
- `web/src/components/settings/SettingsView.tsx`
- `web/src/data/mockData.ts`

Test fixtures were not broadened beyond the two direct assertions made stale by
this slice, after scope was confirmed at room seq2184.

## Changes

- Moved the demo/seed catalogue implementation to
  `web/src/data/demoFixtures.ts`, the named production boundary and single
  entry point.
- Kept `web/src/data/mockData.ts` as a compatibility re-export for existing
  test/integration imports; production imports use `demoFixtures`.
- Moved the AI reconciliation OCR sample, match suggestions, and invoice print
  sample behind the same boundary.
- Replaced plausible statutory/bank identifiers in those samples with explicit
  demo/absence markers. Missing tenant settlement configuration now stays
  unconfigured; the invoice QR path no longer invents an account number.
- Removed realistic TIN and bank-account examples from Settings placeholders.
- Updated only the two directly affected tests to assert the corrected demo and
  absence behavior.

## Evidence

- `npm run lint`: PASS (`tsc --noEmit`).
- `npm test`: PASS — 117 test files, 681 passed, 1 skipped (682 total).
- `npm run build`: PASS — 2,401 modules transformed; Vite production build
  completed successfully.
- `git diff --check`: PASS.
- Targeted source scan: removed target literals are absent from the four named
  surfaces and the named demo boundary uses explicit `DEMO-*` markers.
- Production artifact scan: removed target TIN literals are absent. The built
  artifact still contains BML-shaped literals from out-of-scope statutory-surface
  files in the remaining inventory; this slice does not claim the full 23-file
  isolation refactor.

## Review boundary

Codex authored this slice and cannot self-review or self-accept it under
DEC-072. The broader acceptance item requiring production-build reachability
verification across the full inventory remains a follow-up beyond this bounded
four-file slice. Independent non-author review is required before acceptance.
