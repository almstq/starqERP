# ERP Roadmap Progress Feed — for Command consumption

**Endpoint:** `GET /api/platform/erp-roadmap-progress`
**Auth:** same as other `/api/platform/*` routes — requires `session.platform_entitlement`
(internal/operator access; this is not tenant data, so no `organisation_id` is required or used).
**Code:** `supabase/functions/_shared/erpRoadmapProgress.ts` (pure, unit-tested — see
`erpRoadmapProgress.test.ts`), routed from `supabase/functions/starq-api/index.ts`.

## Response shape

```json
{
  "ok": true,
  "implemented": 7,
  "partial": 24,
  "schema_only": 7,
  "absent": 11,
  "total": 49,
  "implemented_pct": 14.3,
  "source_path": "docs/roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md",
  "audit_revision": "roadmap-2026-09-28-v1",
  "audit_as_of": "2026-09-28",
  "generated_at": "<ISO timestamp of this response>",
  "reverified_since_audit": false,
  "note": "..."
}
```

## How to read it — the two fields Command must not confuse

- **`audit_as_of`** is the date the 49-stage tally was last hand-verified against the actual
  codebase (see `docs/roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md`'s five process-chain
  tables). This is the only date that means anything for "how complete is the ERP."
- **`generated_at`** is just when this HTTP response was produced. It changes on every request;
  it is **not** evidence that the audit is current. Do not display it as a freshness indicator
  for the percentage — display `audit_as_of` for that, and `reverified_since_audit: false` as an
  explicit staleness flag until someone re-runs the stage audit and bumps `audit_revision`.

## What counts toward `implemented_pct`

Per the StarqERP convergence doctrine's process-level definition of done, completion is binary —
a stage either runs as a real, verified end-to-end business operation (`implemented`) or it
doesn't. `partial`, `schema_only` and `absent` stages get **zero** fractional credit in the
percentage; they're reported separately so Command can show the full breakdown without implying
partial work is partial credit.

## What this is not

- Not a PR/merge-activity metric. PR counts (merged/closed/open) are a separate, unrelated number
  — don't blend them into this percentage. See `docs/roadmap/ERP_ROADMAP_STATUS_2026-10-30.md`
  for the distinction and the current PR-activity snapshot.
- Not live-queried from the markdown source at request time (Supabase Edge Functions only bundle
  their own directory). The counts are frozen constants, hand-verified against the doc; updating
  them requires a human to re-audit the source and bump `audit_revision` in code.
