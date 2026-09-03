#!/usr/bin/env node
/**
 * CHECK DEPLOY DRIFT — assert production (Edge Function + database) actually
 * runs what git says it runs.
 *
 * Born from the night of 2026-09-03: the Supabase Edge Function ran code from
 * 27 Aug for a week while PRs kept merging against it, and 11 migrations
 * (including a security remediation) sat unapplied the whole time. Every
 * "verified" claim made from reading source during that week was checking
 * the wrong thing — git was never the question; production was.
 *
 * This is a LIVE check: it shells out to the Supabase CLI, which must
 * already be authenticated and linked (see README below). It intentionally
 * has no auto-fix path — drift gets reported for a human (or a CI step with
 * explicit deploy authority) to act on, never silently corrected here.
 *
 * Usage:
 *   node scripts/check-deploy-drift.mjs
 *   node scripts/check-deploy-drift.mjs --json
 *
 * Requires: `supabase login` done once on this machine, and this repo linked
 * (`supabase link --project-ref <ref>`) or STARQ_SUPABASE_PROJECT_REF set.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const PROJECT_REF = process.env.STARQ_SUPABASE_PROJECT_REF || 'wthabguvueewgtabjsdo';
const FUNCTION_NAME = 'starq-api';

function run(cmd, args, { shell = false } = {}) {
  try {
    // shell only for npm-global .cmd shims (e.g. `supabase` on Windows) --
    // NOT for git, since shell:true on Windows re-splits args on
    // whitespace and breaks anything like --format="%H %ad".
    return { ok: true, out: execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell }) };
  } catch (err) {
    return { ok: false, out: (err.stdout || '') + (err.stderr || ''), error: err.message };
  }
}
function runSupabase(args) {
  return run('supabase', args, { shell: true });
}

function gitLastCommitTouching(relPath) {
  const res = run('git', ['log', '-1', '--format=%H %ad', '--date=iso-strict', '--', relPath]);
  if (!res.ok || !res.out.trim()) return null;
  const [sha, ...dateParts] = res.out.trim().split(' ');
  return { sha, date: dateParts.join(' ') };
}

/**
 * The Edge Function is a single deployed artifact. A code change is only
 * "in production" once someone re-runs `supabase functions deploy`. There
 * is no timestamp comparison that proves content equality — only that a
 * deploy happened after the last relevant commit is checkable from outside
 * the function's own runtime, so that is what this reports.
 */
export function checkEdgeFunctionDeploy(opts = {}) {
  const NAME = 'Edge Function deploy — starq-api runtime matches last merged commit';
  const projectRef = opts.projectRef || PROJECT_REF;

  const lastCommit = opts.lastCommit || gitLastCommitTouching('supabase/functions/starq-api');
  if (!lastCommit) {
    return { state: 'SKIP', name: NAME, detail: 'no git history found for supabase/functions/starq-api' };
  }

  const listRes = opts.listResult || runSupabase(['functions', 'list', '--project-ref', projectRef]);
  if (!listRes.ok) {
    return { state: 'SKIP', name: NAME, detail: `could not reach Supabase (${listRes.error || 'not authenticated/linked'})` };
  }

  const row = listRes.out.split('\n').find((line) => line.includes(FUNCTION_NAME));
  if (!row) {
    return { state: 'FAIL', name: NAME, detail: `no deployed function named '${FUNCTION_NAME}' found on project ${projectRef}` };
  }

  const cols = row.split('|').map((c) => c.trim());
  const updatedAt = cols[cols.length - 1];
  const deployedAt = Date.parse(updatedAt.replace(' ', 'T') + 'Z');
  const commitAt = Date.parse(lastCommit.date);
  if (Number.isNaN(deployedAt) || Number.isNaN(commitAt)) {
    return { state: 'SKIP', name: NAME, detail: `could not parse timestamps (deployed='${updatedAt}', commit='${lastCommit.date}')` };
  }

  if (deployedAt < commitAt) {
    const staleDays = ((commitAt - deployedAt) / 86400000).toFixed(1);
    return {
      state: 'FAIL',
      name: NAME,
      detail: `deployed function is OLDER than the last commit touching it — last deploy ${updatedAt} UTC, last commit ${lastCommit.date} (commit ${lastCommit.sha.slice(0, 7)}), ~${staleDays} days stale. Run: supabase functions deploy ${FUNCTION_NAME} --project-ref ${projectRef}`,
    };
  }
  return { state: 'PASS', name: NAME, detail: `deployed ${updatedAt} UTC is at or after the last commit touching starq-api (${lastCommit.sha.slice(0, 7)}, ${lastCommit.date})` };
}

/**
 * Migrations are the one piece of this class of drift with a real source of
 * truth on both sides: `supabase migration list --linked` diffs the local
 * migrations/ directory against the remote schema_migrations table by
 * timestamp ID, so this just has to parse that table for any row where the
 * Local column is populated but Remote is not.
 */
export function checkMigrationDrift(opts = {}) {
  const NAME = 'Database migrations — every local migration is applied remotely';
  const projectRef = opts.projectRef || PROJECT_REF;

  const listRes = opts.listResult || runSupabase(['migration', 'list', '--linked']);
  if (!listRes.ok) {
    return { state: 'SKIP', name: NAME, detail: `could not reach Supabase (${listRes.error || 'not authenticated/linked'})` };
  }

  const lines = listRes.out.split('\n').filter((l) => /^\s*\d{12}\s*\|/.test(l));
  const pending = lines
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter(([local, remote]) => local && !remote);

  if (!lines.length) {
    return { state: 'SKIP', name: NAME, detail: 'could not parse migration list output (format may have changed)' };
  }
  if (pending.length) {
    return {
      state: 'FAIL',
      name: NAME,
      detail: `${pending.length} migration(s) applied locally but never pushed to project ${projectRef}: ${pending.map((r) => r[0]).join(', ')}. Run: supabase db push --linked`,
    };
  }
  return { state: 'PASS', name: NAME, detail: `all ${lines.length} local migrations are applied on project ${projectRef}` };
}

export function runAllChecks(opts = {}) {
  return [
    checkEdgeFunctionDeploy(opts),
    checkMigrationDrift(opts),
  ];
}

const isDirectRun = Boolean(
  process.argv[1] &&
  (path.resolve(process.argv[1]).toLowerCase() === path.resolve(__filename).toLowerCase() ||
   process.argv[1].toLowerCase().endsWith('check-deploy-drift.mjs'))
);
if (isDirectRun) {
  const results = runAllChecks();
  const asJson = process.argv.includes('--json');
  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    const width = Math.max(...results.map((r) => r.name.length));
    console.log('\nCHECK DEPLOY DRIFT — production vs git, not source vs source\n');
    for (const r of results) {
      console.log(`  ${r.state.padEnd(4)}  ${r.name.padEnd(width)}  ${r.detail}`);
    }
    const failed = results.filter((r) => r.state === 'FAIL');
    const skipped = results.filter((r) => r.state === 'SKIP');
    console.log(`\n  ${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped\n`);
    if (skipped.length) console.log('  A SKIP here usually means: run `supabase login` and `supabase link --project-ref <ref>` first.\n');
  }
  process.exit(results.some((r) => r.state === 'FAIL') ? 1 : 0);
}
