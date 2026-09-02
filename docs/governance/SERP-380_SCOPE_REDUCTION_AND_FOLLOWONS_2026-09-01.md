# SERP-380 — Reduced Scope & Deferred Follow-ons (Founder Ruling, 2026-09-01)

**Status:** SERP-380 execution complete within this reduced, Founder-ruled scope.

## Founder ruling (2026-09-01, bus)
1. Preserve the completed archival of `StarqHQView.tsx`.
2. Do **not** archive `OrganisationSetupModal.tsx` in SERP-380 — its two associated test files
   (`web/src/test/serp_275_tenant_generalization.test.tsx`,
   `web/src/test/serp_276_onboarding_wizard.test.tsx`) exercise real standalone behavior
   (onboarding wizard step validation, anti-TIN/BML/GST-fabrication assertions). Deleting or
   neutering that coverage merely to complete this archival task is not acceptable.
3. Do **not** port those tests to `RegisterOrganisationModal` within SERP-380 — that is separate
   behavioral/test-migration work and would expand this bounded task.
4. `OrganisationSetupModal.tsx` archival is a **required follow-on task**, to be picked up only
   after its functional coverage has been deliberately migrated or retired by a dedicated task.
   This record does not create that task's canonical ID; Nexus/Alfred register it separately.
5. Canonical `KNOWN_DARK` / component-reachability register reconciliation is **deferred to
   SERP-234**, the still-unmerged branch (`elder/2026-08-30-serp234-reachability`) where the
   authoritative register (`tests/component_reachability.test.mjs`) currently lives. SERP-380 does
   not invent a replacement register on `main`.

## What SERP-380 delivers (final scope)
- `StarqHQView.tsx` archived to `legacy/retired-ui/platform/` via `git mv` (history preserved, no
  deletion). Zero external imports; no test/import repair required.
- No other file is moved, deleted, or behaviorally changed.

## What is explicitly out of SERP-380 (tracked here, not invented elsewhere)
- Follow-on: archive `web/src/components/onboarding/OrganisationSetupModal.tsx` to
  `legacy/retired-ui/onboarding/` — blocked on a prior, separate task to deliberately migrate or
  retire the functional coverage in `serp_275_tenant_generalization.test.tsx` and
  `serp_276_onboarding_wizard.test.tsx`.
- Deferred: KNOWN_DARK / component-reachability register reconciliation for both components —
  owned by SERP-234 once merged, not by SERP-380.
