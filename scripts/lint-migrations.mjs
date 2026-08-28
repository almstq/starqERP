import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

console.log('=== SERP-038: PostgreSQL Migration Lineage & Compatibility Linter ===\n');

if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.error(`ERROR: Migrations directory not found at ${MIGRATIONS_DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

console.log(`Found ${files.length} migration files in sequence:\n`);

let lastVersion = 0n;
let errors = 0;

// Canonical status registry
const MIGRATION_STATUS_MAP = {
  '202608220011_wire_purchase_seat_matrix.sql': {
    status: 'REVIEWER_GATED',
    notes: 'Written and peer-reviewed (APPROVE), but held by 3rd-person reviewer gate per audit critical #2',
  },
  '202608260021_synthetic_tenant_uuid_transition.sql': {
    status: 'UNAPPLIED_FORWARD_ONLY',
    notes: 'Forward synthetic tenant UUID transition migration (SERP-275), verified via disposable rehearsal',
  },
  '202608260022_transactional_outbox_and_audit.sql': {
    status: 'UNAPPLIED_FORWARD_ONLY',
    notes: 'Transactional outbox and immutable audit foundation migration (SERP-034)',
  },
  '202608280029_fix_accept_staff_invitation.sql': {
    status: 'UNAPPLIED_FORWARD_ONLY',
    notes: 'Fix accept_staff_invitation function defects (SERP-286): role column, granted_at, audit_event columns, semantic mapping',
  },
};

const classifications = {
  APPLIED: [],
  REVIEWER_GATED: [],
  UNAPPLIED_FORWARD_ONLY: [],
};

for (const file of files) {
  const match = file.match(/^(\d{12})_(.+)\.sql$/);
  if (!match) {
    console.error(`  ✗ INVALID FILENAME: ${file} (Must follow YYYYMMDDNNNN_name.sql)`);
    errors++;
    continue;
  }

  const versionStr = match[1];
  const versionNum = BigInt(versionStr);
  const name = match[2];

  // 1. Monotonic ordering check
  if (versionNum <= lastVersion) {
    console.error(`  ✗ OUT-OF-ORDER / DUPLICATE VERSION: ${file} (version ${versionStr} <= ${lastVersion})`);
    errors++;
  }
  lastVersion = versionNum;

  // 2. Transaction wrapper check
  const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8').trim();
  const lower = content.toLowerCase();
  const hasBegin = lower.startsWith('begin;') || lower.includes('\nbegin;');
  const hasCommit = lower.endsWith('commit;') || lower.includes('\ncommit;');

  if (!hasBegin || !hasCommit) {
    console.error(`  ✗ MISSING TRANSACTION BOUNDARY: ${file} (Must be wrapped in begin; ... commit;)`);
    errors++;
  }

  // 3. Dangerous irreversible pattern check
  if (lower.includes('drop database') || lower.includes('drop extension')) {
    console.error(`  ✗ DANGEROUS IRREVERSIBLE OPERATION: ${file} contains DROP DATABASE or DROP EXTENSION`);
    errors++;
  }

  const registered = MIGRATION_STATUS_MAP[file];
  const status = registered ? registered.status : 'APPLIED';
  classifications[status].push(file);

  const statusBadge = status === 'APPLIED' ? '✓ APPLIED' : status === 'REVIEWER_GATED' ? '⚠ GATED' : '○ UNAPPLIED';
  console.log(`  ${statusBadge.padEnd(12)} ${file} (${registered?.notes || 'Historically applied base'})`);
}

console.log('\n======================================================');
console.log(`Total Migrations Analysed: ${files.length}`);
console.log(`- Applied Base Lineage   : ${classifications.APPLIED.length}`);
console.log(`- Reviewer Gated (0011)  : ${classifications.REVIEWER_GATED.length}`);
console.log(`- Unapplied Forward Only : ${classifications.UNAPPLIED_FORWARD_ONLY.length}`);
console.log('======================================================');

if (errors > 0) {
  console.error(`\n❌ Migration lint failed with ${errors} violation(s).`);
  process.exit(1);
} else {
  console.log('\n✓ ALL MIGRATION LINT CHECKS PASSED CLEANLY.');
  process.exit(0);
}
