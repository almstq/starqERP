/**
 * Read-only, source-backed ERP roadmap progress snapshot.
 *
 * The counts below are a hand-verified tally of every stage row in
 * docs/roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md's five process-chain
 * tables (Order-to-Cash, Procure-to-Pay, Inventory-to-GL, Cash-to-Bank,
 * Record-to-Report) -- 49 stages total, each classified implemented /
 * partial / schema-only / absent per that doc's own definitions. Per the
 * StarqERP convergence doctrine's process-level definition of done,
 * completion is binary: only "implemented" counts toward the numerator.
 * Partial/schema-only/absent are not given fractional credit.
 *
 * AUDIT_REVISION is a frozen identifier for this exact stage tally, not a
 * live hash -- updating it requires re-auditing the source doc by hand and
 * bumping the revision string, which is the point: a stale revision is
 * supposed to be visible, not silently refreshed by a generation timestamp.
 */

export const ERP_ROADMAP_SOURCE_PATH =
  'docs/roadmap/ERP_PROCESS_CLOSURE_ROADMAP_2026-09-28.md';

export const ERP_ROADMAP_AUDIT_REVISION = 'roadmap-2026-09-28-v1';

export const ERP_ROADMAP_AUDIT_AS_OF = '2026-09-28';

export interface ErpRoadmapProgressSnapshot {
  ok: true;
  implemented: number;
  partial: number;
  schema_only: number;
  absent: number;
  total: number;
  implemented_pct: number;
  source_path: string;
  audit_revision: string;
  audit_as_of: string;
  generated_at: string;
  reverified_since_audit: false;
  note: string;
}

const IMPLEMENTED = 7;
const PARTIAL = 24;
const SCHEMA_ONLY = 7;
const ABSENT = 11;
const TOTAL = IMPLEMENTED + PARTIAL + SCHEMA_ONLY + ABSENT;

export function buildErpRoadmapProgressSnapshot(
  now: () => string = () => new Date().toISOString(),
): ErpRoadmapProgressSnapshot {
  return {
    ok: true,
    implemented: IMPLEMENTED,
    partial: PARTIAL,
    schema_only: SCHEMA_ONLY,
    absent: ABSENT,
    total: TOTAL,
    implemented_pct: Math.round((IMPLEMENTED / TOTAL) * 1000) / 10,
    source_path: ERP_ROADMAP_SOURCE_PATH,
    audit_revision: ERP_ROADMAP_AUDIT_REVISION,
    audit_as_of: ERP_ROADMAP_AUDIT_AS_OF,
    generated_at: now(),
    reverified_since_audit: false,
    note:
      'implemented_pct reflects the audit_as_of stage-by-stage tally only. ' +
      'generated_at is when this response was produced, not when the ' +
      'underlying audit last ran -- do not treat it as freshness evidence. ' +
      'Merged PR activity since audit_as_of is not reflected here unless ' +
      'audit_revision has been bumped after a fresh re-audit.',
  };
}
