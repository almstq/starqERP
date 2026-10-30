import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildErpRoadmapProgressSnapshot,
  ERP_ROADMAP_AUDIT_AS_OF,
  ERP_ROADMAP_AUDIT_REVISION,
  ERP_ROADMAP_SOURCE_PATH,
} from './erpRoadmapProgress.ts';

Deno.test('buildErpRoadmapProgressSnapshot: counts match the hand-verified 28 Sep stage audit', () => {
  const snapshot = buildErpRoadmapProgressSnapshot(() => '2026-10-30T18:00:00.000Z');

  assertEquals(snapshot.implemented, 7);
  assertEquals(snapshot.partial, 24);
  assertEquals(snapshot.schema_only, 7);
  assertEquals(snapshot.absent, 11);
  assertEquals(snapshot.total, 49, 'total must equal the sum of all four classifications');
  assertEquals(
    snapshot.implemented + snapshot.partial + snapshot.schema_only + snapshot.absent,
    snapshot.total,
  );
});

Deno.test('buildErpRoadmapProgressSnapshot: implemented_pct is 14.3, not inflated by partial/schema-only states', () => {
  const snapshot = buildErpRoadmapProgressSnapshot();
  assertEquals(snapshot.implemented_pct, 14.3);
});

Deno.test('buildErpRoadmapProgressSnapshot: generated_at reflects the injected clock, not audit freshness', () => {
  const fixedTime = '2026-10-30T18:00:00.000Z';
  const snapshot = buildErpRoadmapProgressSnapshot(() => fixedTime);

  assertEquals(snapshot.generated_at, fixedTime);
  assertEquals(snapshot.audit_as_of, ERP_ROADMAP_AUDIT_AS_OF);
  assert(
    snapshot.generated_at !== snapshot.audit_as_of,
    'generated_at must never be presented as the audit date',
  );
  assertEquals(snapshot.reverified_since_audit, false);
});

Deno.test('buildErpRoadmapProgressSnapshot: carries a fixed source path and revision, not a live file hash', () => {
  const snapshot = buildErpRoadmapProgressSnapshot();
  assertEquals(snapshot.source_path, ERP_ROADMAP_SOURCE_PATH);
  assertEquals(snapshot.audit_revision, ERP_ROADMAP_AUDIT_REVISION);
});
