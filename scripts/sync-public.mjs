#!/usr/bin/env node
/**
 * starqERP — public snapshot sync
 *
 * Mirrors the private repository into the public one (almstq/starqERP-public),
 * which is a real deployment target, not a showcase.
 *
 * ─── THE RULE THIS ENFORCES ────────────────────────────────────────────────
 * ALLOWLIST, NEVER AN EXCLUSION LIST.
 *
 * An exclusion list fails OPEN: every new private file is public by default
 * until somebody remembers to exclude it. On 2026-08-29 a naive mirror would
 * have published 82 internal documents, including:
 *   - docs/ELDER_RETURN_BRIEF_2026-08-28.md, named in PRIVATE_EXCLUSION_MANIFEST
 *   - docs/qa/current/ISO_27001_READINESS_GAP_AUDIT_*.md — a map of where our
 *     controls are NOT yet in place, which is a genuine security disclosure
 *   - 62 internal docs/tasks/SERP-*.md completion reports
 *
 * An allowlist fails CLOSED. That is the correct direction when the cost of
 * being wrong is permanent: a public repository is cloned, cached and indexed
 * within minutes, so there is no meaningful undo.
 *
 * WHAT GETS PUBLISHED
 *   1. Any path ALREADY public — refreshed. Publishing a newer version of an
 *      already-public file discloses nothing new.
 *   2. NEW paths, but only under CODE_PREFIXES — the code required to build and
 *      deploy. A new file anywhere else is NOT added, and is reported so the
 *      omission is visible rather than silent.
 *
 * The public README is generated from README_PUBLIC_DRAFT.md, per
 * PUBLIC_RELEASE_CHECKLIST.md. The private README is never published.
 *
 * ─── USAGE ─────────────────────────────────────────────────────────────────
 *   node scripts/sync-public.mjs              # dry run. Shows every change. Writes nothing.
 *   node scripts/sync-public.mjs --apply      # writes files into the public working tree
 *   node scripts/sync-public.mjs --apply --commit
 *
 * Dry run is the default ON PURPOSE. Review the file list before publishing.
 * After --apply, verify in the public tree before pushing:
 *   cd ../starqERP-public/web && npx tsc --noEmit && npm run build
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PRIVATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = process.env.STARQ_PUBLIC_REPO || path.resolve(PRIVATE, '..', 'starqERP-public');

/** New files may only be introduced under these prefixes. Everything else must already be public. */
const CODE_PREFIXES = ['web/', 'supabase/', 'contracts/', 'tests/', '.well-known/'];

/** Generated public file <- private source. */
const RENAMES = { 'README.md': 'README_PUBLIC_DRAFT.md' };

/** Belt and braces: never publish these even if a prefix would allow them. */
const NEVER = [/(^|\/)\.env($|\.)/i, /_secrets?\//i, /PRIVATE_/, /ELDER_RETURN_BRIEF/, /_dream\//];

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const doCommit = args.includes('--commit');

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' });

console.log('=== starqERP public snapshot sync ===\n');
console.log(`  private : ${PRIVATE}`);
console.log(`  public  : ${PUBLIC}`);
console.log(`  mode    : ${apply ? 'APPLY' : 'DRY RUN (writes nothing)'}\n`);

if (!fs.existsSync(path.join(PUBLIC, '.git'))) {
  console.error(`  ✗ public repository not found at ${PUBLIC}`);
  console.error('    Clone it, or set STARQ_PUBLIC_REPO.');
  process.exit(1);
}

const privFiles = new Set(git(PRIVATE, 'ls-files').split('\n').filter(Boolean));
const pubFiles = new Set(git(PUBLIC, 'ls-files').split('\n').filter(Boolean));

const blocked = (f) => NEVER.some((re) => re.test(f));
const isCode = (f) => CODE_PREFIXES.some((p) => f.startsWith(p));

const refresh = [];   // already public
const added = [];     // new, code only
const withheld = [];  // new, not code -> deliberately not published

for (const f of privFiles) {
  if (blocked(f)) { withheld.push(`${f}  (blocked by NEVER rule)`); continue; }
  if (pubFiles.has(f)) refresh.push(f);
  else if (isCode(f)) added.push(f);
  else withheld.push(f);
}

const orphaned = [...pubFiles].filter((f) => !privFiles.has(f) && !Object.keys(RENAMES).includes(f));

console.log(`  refresh (already public) : ${refresh.length}`);
console.log(`  add     (new code)       : ${added.length}`);
console.log(`  WITHHELD (not published) : ${withheld.length}`);
console.log(`  in public, gone private  : ${orphaned.length}\n`);

if (added.length) {
  console.log('  NEW FILES THAT WOULD BECOME PUBLIC — review these:');
  for (const f of added.slice(0, 40)) console.log(`      + ${f}`);
  if (added.length > 40) console.log(`      ... and ${added.length - 40} more`);
  console.log('');
}

if (withheld.length) {
  console.log('  WITHHELD (new, outside code paths — intentionally private):');
  const byDir = {};
  for (const f of withheld) { const d = f.split('/')[0]; byDir[d] = (byDir[d] || 0) + 1; }
  for (const [d, n] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(4)}  ${d}/`);
  console.log('');
}

if (orphaned.length) {
  console.log('  PRESENT IN PUBLIC, ABSENT FROM PRIVATE — not removed automatically:');
  for (const f of orphaned.slice(0, 20)) console.log(`      ? ${f}`);
  console.log('      Deleting published files is a deliberate act; do it by hand.\n');
}

if (!apply) {
  console.log('  Dry run. Re-run with --apply to write these into the public tree.\n');
  process.exit(0);
}

let written = 0;
for (const f of [...refresh, ...added]) {
  const src = path.join(PRIVATE, f);
  const dst = path.join(PUBLIC, f);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  written++;
}

for (const [pub, priv] of Object.entries(RENAMES)) {
  const src = path.join(PRIVATE, priv);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(PUBLIC, pub));
    console.log(`  ${pub} <- ${priv}  (sanitized front page)`);
    written++;
  }
}

console.log(`\n  files written: ${written}`);

// Secret sweep the RESULT, not the source. What matters is what is about to be public.
const PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, 'JWT-shaped token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY/, 'private key'],
  [/\bsk_live_(?!12345)[A-Za-z0-9]{8,}/, 'live secret key'],
  [/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^"']{20,}/, 'service role key value'],
];
let hits = 0;
for (const f of [...refresh, ...added]) {
  const p = path.join(PUBLIC, f);
  if (!fs.existsSync(p)) continue;
  let text;
  try { text = fs.readFileSync(p, 'utf8'); } catch { continue; }
  for (const [re, label] of PATTERNS) {
    if (re.test(text)) { console.error(`  ✗ POSSIBLE SECRET (${label}): ${f}`); hits++; }
  }
}
console.log(hits === 0 ? '\n  ✓ secret sweep clean on the published result' : `\n  ✗ ${hits} potential secret(s) — DO NOT PUSH`);
if (hits > 0) process.exit(1);

if (doCommit) {
  git(PUBLIC, 'add', '-A');
  const status = git(PUBLIC, 'status', '--porcelain').trim();
  if (!status) { console.log('\n  nothing to commit — public is already current'); process.exit(0); }
  const head = git(PRIVATE, 'rev-parse', '--short', 'HEAD').trim();
  git(PUBLIC, 'commit', '-q', '-m',
    `sync: mirror private ${head}\n\n` +
    `Generated by scripts/sync-public.mjs (allowlist-based).\n` +
    `Refreshed ${refresh.length}, added ${added.length}, withheld ${withheld.length} private files.\n` +
    `Secret sweep on the published result: clean.`);
  console.log(`\n  committed in public repo. Verify the build, then push:`);
  console.log(`    cd ${PUBLIC}/web && npx tsc --noEmit && npm run build`);
  console.log(`    cd ${PUBLIC} && git push origin main`);
}

console.log('');
