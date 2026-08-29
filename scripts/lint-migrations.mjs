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

// Migrations numbered at or below this are historical counter-style names and are
// left exactly as they are — renaming applied migrations would make the files
// disagree with the database. Everything authored after it must use a real
// timestamp. See the COUNTER-STYLE FILENAME check below.
const TIMESTAMP_CONVENTION_FROM = 202608280031n;

let lastVersion = 0n;
let errors = 0;

// Canonical status registry
const MIGRATION_STATUS_MAP = {
  '202608200001_core_foundation.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608200002_garage_inventory.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608200003_commercial_accounting.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608200004_pilot_security.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608200005_garage_api.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608200006_garage_api_search_path.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608200007_garage_api_self_test.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608200008_session_authority.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608210009_seat_vocabulary.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608210010_purchase_seat_matrix.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608250012_settlement_allocations.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608250013_workflow_stages.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608250014_idempotency_replay.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608250015_roles_as_data.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608250016_sod_exceptions.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608250017_tax_regimes_and_periods.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608250018_bank_accounts_entities.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608250019_job_customer_vehicle_phone.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608250020_revision_missing_endpoints.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608270023_round1_foundation_remediation.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608270024_platform_control_plane.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608270025_books_and_operating_activities.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608270026_organisation_applications_and_provisioning.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
  '202608270027_staff_invitations_and_lifecycle.sql': {
    status: 'APPLIED',
    notes: 'Applied baseline. Source: docs/ELDER_RETURN_BRIEF_2026-08-28.md, which records migrations 0001-0027 applied 1:1 on the live Supabase project. Registered explicitly on 2026-08-29 when the linter default flipped to unapplied — an APPLIED status is now a deliberate claim, not a fallback.',
  },
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
    console.error(`  ✗ INVALID FILENAME: ${file} (Must follow YYYYMMDDHHMM_name.sql)`);
    errors++;
    continue;
  }

  const versionStr = match[1];
  const versionNum = BigInt(versionStr);
  const name = match[2];

  // 0. Filename convention — the last four digits must be a real HHMM.
  //
  // These used to be a global counter (0001, 0002, ...). That cannot work with
  // parallel agents: on 2026-08-28 four lanes independently took 0028 and 0029,
  // because each branch could only see its own files. Everyone checked; everyone
  // was right; they still collided.
  //
  // A wall-clock minute needs no coordination at all. Two authors collide only
  // by writing in the same minute, which is rare, obvious, and fixed by adding
  // one. This check exists so the convention cannot quietly revert to counters —
  // otherwise the same collision returns and someone repeats the renumbering
  // surgery we did on 2026-08-29.
  if (versionNum > TIMESTAMP_CONVENTION_FROM) {
    const hh = Number(versionStr.slice(8, 10));
    const mm = Number(versionStr.slice(10, 12));
    if (hh > 23 || mm > 59) {
      console.error(
        `  ✗ COUNTER-STYLE FILENAME: ${file}
` +
        `      The last four digits must be a wall-clock HHMM, not a sequence number.
` +
        `      Got ${versionStr.slice(8)} (hh=${hh}, mm=${mm}). Name it YYYYMMDDHHMM_description.sql,
` +
        `      e.g. ${new Date().toISOString().slice(0,10).replace(/-/g,'')}${String(new Date().getHours()).padStart(2,'0')}${String(new Date().getMinutes()).padStart(2,'0')}_your_change.sql`
      );
      errors++;
    }
  }

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
  // FAIL SAFE, NOT FAIL OPEN.
  //
  // This used to default to 'APPLIED', which meant an unregistered migration was
  // silently reported as already live in production. On 2026-08-29 two brand-new,
  // never-executed migrations (SERP-300 and SERP-037) were being counted in the
  // 'Applied Base Lineage' total for exactly that reason.
  //
  // An absent entry means nobody has claimed anything, so the safe reading is
  // 'not yet applied'. Registration now carries its real meaning: a deliberate
  // statement, by a human who checked, that something IS applied. We fail closed
  // on the claim, not on the absence of one — so no new CI gate and no extra step
  // for anyone writing a migration.
  const status = registered ? registered.status : 'UNAPPLIED_FORWARD_ONLY';
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
