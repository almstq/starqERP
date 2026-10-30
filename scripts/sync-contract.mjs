#!/usr/bin/env node
/**
 * Copy the canonical contract into the Edge function bundle, and verify it.
 *
 * WHY THIS EXISTS
 * Supabase bundles only what lives under `supabase/functions/`. The canonical
 * contract lives at repo-root `contracts/commands.ts` as the canonical source
 * for boundary tests, compatibility fixtures, and tooling —
 * so a relative import from the Edge function reaches outside the bundle and
 * cannot be relied on to deploy.
 *
 * Rather than move the contract somewhere inconvenient, or keep two hand-edited
 * copies (which is the exact drift that produced three different seat
 * vocabularies), the Edge gets a GENERATED copy under `_shared/` and a test
 * asserts the two are byte-identical.
 *
 *   node scripts/sync-contract.mjs          copy canonical -> _shared
 *   node scripts/sync-contract.mjs --check  verify they match; exit 1 if not
 *
 * The --check form belongs in CI and in the contract test run. If it ever
 * fails, someone edited the generated copy: the fix is to edit the canonical
 * file and re-sync, never to patch _shared.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const CANONICAL = join(root, 'contracts', 'commands.ts');
const GENERATED = join(root, 'supabase', 'functions', '_shared', 'commands.ts');

const BANNER = `// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — DO NOT EDIT.
//
// Copied verbatim from contracts/commands.ts by scripts/sync-contract.mjs so
// that Supabase bundles it with the Edge function. Editing this file instead of
// the canonical one recreates the drift the contract exists to eliminate.
//
// Edit:  contracts/commands.ts
// Then:  node scripts/sync-contract.mjs
// ─────────────────────────────────────────────────────────────────────────────

`;

function build() {
  if (!existsSync(CANONICAL)) {
    console.error(`canonical contract not found: ${CANONICAL}`);
    process.exit(1);
  }
  return BANNER + readFileSync(CANONICAL, 'utf8');
}

const check = process.argv.includes('--check');
const expected = build();

if (check) {
  if (!existsSync(GENERATED)) {
    console.error('✗ Edge copy missing. Run: node scripts/sync-contract.mjs');
    process.exit(1);
  }
  const actual = readFileSync(GENERATED, 'utf8');
  if (actual !== expected) {
    console.error('✗ Edge copy has drifted from contracts/commands.ts.');
    console.error('  Fix the canonical file, then: node scripts/sync-contract.mjs');
    process.exit(1);
  }
  console.log('✓ Edge contract copy matches the canonical contract');
} else {
  mkdirSync(dirname(GENERATED), { recursive: true });
  writeFileSync(GENERATED, expected);
  console.log(`✓ contracts/commands.ts → supabase/functions/_shared/commands.ts`);
}
