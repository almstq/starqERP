#!/usr/bin/env node

/**
 * STARQ ERP — Migration Compatibility Gate (SERP-462)
 *
 * Implements a canonical all-from-zero migration compatibility gate.
 * Validates that the entire sequence of SQL migration files in supabase/migrations/*.sql
 * (or a specified target directory) applies cleanly in sorted order against a fresh,
 * disposable PostgreSQL container.
 *
 * Requirements (Room #16573 / #16574 / #16599):
 * 1. Starts a disposable local PostgreSQL container via `docker run` using the pinned image:
 *    public.ecr.aws/supabase/postgres:17.6.1.155 (exact SHA matches CI: 3866d94d8426927e8db3f1c5d790752292bfbe27b5f1f46e199ae1b7d3c1710b).
 *    Ephemeral tmpfs / no persistent volume.
 * 2. Dynamic credentials: Uses a per-run cryptographically random password (C1).
 * 3. Container lifecycle safety: Registers container for teardown immediately upon creation (C3),
 *    preventing leaks even if container start fails.
 * 4. Two-phase connection readiness: Confirms initial connection via psql 'SELECT 1', then sleeps 5 seconds
 *    and verifies connection stability with a second consecutive 'SELECT 1', exactly mirroring ci.yml:119-134 (A3).
 * 5. Applies every .sql file in sorted order via containerized psql with ON_ERROR_STOP=1,
 *    stopping and reporting the exact failing file and error message on first failure.
 * 6. Ensures container teardown on both success and failure (process exit / signal trap).
 * 7. Exits 0 on full success; exits non-zero naming the failing migration on failure.
 *
 * Usage:
 *   node scripts/migration-compatibility-gate.mjs [--migrations-dir <path>]
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(__dirname, '..');
const DEFAULT_MIGRATIONS_DIR = resolve(REPO_ROOT, 'supabase', 'migrations');
const POSTGRES_IMAGE = 'public.ecr.aws/supabase/postgres:17.6.1.155';

function parseArgs() {
  const args = process.argv.slice(2);
  let migrationsDir = DEFAULT_MIGRATIONS_DIR;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--migrations-dir' && args[i + 1]) {
      migrationsDir = resolve(REPO_ROOT, args[i + 1]);
      i++;
    }
  }
  return { migrationsDir };
}

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    ...options,
  });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reusable ephemeral-container lifecycle (exported for SERP-463 acceptance suites).
 * Behaviour is identical to the CLI path below; the CLI is a thin wrapper over these.
 * Cleanup is registered the moment `docker create` succeeds (C3).
 */
export function createGateContainer({ log = console.log } = {}) {
  const postgresPassword = crypto.randomBytes(16).toString('hex'); // C1
  const containerName = `starqerp-migration-gate-${crypto.randomBytes(4).toString('hex')}`;
  const state = { containerName, created: false };

  const teardown = () => {
    if (state.created) {
      log(`\nTearing down ephemeral container ${containerName}...`);
      runCommand('docker', ['rm', '-f', containerName]);
      state.created = false;
      log('Container teardown complete.');
    }
  };

  log(`\nCreating ephemeral PostgreSQL container (${containerName})...`);
  const createResult = runCommand('docker', [
    'create',
    '--name', containerName,
    '--mount', `type=bind,source=${REPO_ROOT},target=/workspace,readonly`,
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=1g',
    '--env', `POSTGRES_PASSWORD=${postgresPassword}`,
    '--env', 'POSTGRES_DB=postgres',
    POSTGRES_IMAGE,
  ]);
  if (createResult.status !== 0) {
    throw new Error(`Failed to create docker container: ${createResult.stderr || createResult.stdout}`);
  }
  state.created = true; // C3

  return { containerName, teardown, isCreated: () => state.created };
}

export function startGateContainer(container, { log = console.log } = {}) {
  log(`Starting ephemeral PostgreSQL container (${container.containerName})...`);
  const startResult = runCommand('docker', ['start', container.containerName]);
  if (startResult.status !== 0) {
    throw new Error(`Failed to start docker container: ${startResult.stderr || startResult.stdout}`);
  }
}

const psqlBase = (containerName) => [
  'exec', containerName, 'psql', '-U', 'postgres', '-d', 'postgres', '--set', 'ON_ERROR_STOP=1',
];

/** Two-phase readiness (A3), mirroring ci.yml:119-134. */
export async function waitForStableDb(container, { log = console.log } = {}) {
  const { containerName } = container;
  log('Waiting for PostgreSQL container to become healthy and stable...');
  for (let attempt = 1; attempt <= 90; attempt++) {
    const statusText = (runCommand('docker', [
      'inspect', '--format', '{{.State.Status}} {{.State.Health.Status}}', containerName,
    ]).stdout || '').trim();

    if (statusText === 'running healthy') {
      if (runCommand('docker', [...psqlBase(containerName), '-c', 'SELECT 1;']).status === 0) {
        log(`Connected on attempt ${attempt}; confirming stability after 5s window (ci.yml:121-124)...`);
        await sleep(5000);
        if (runCommand('docker', [...psqlBase(containerName), '-c', 'SELECT 1;']).status === 0) {
          log('PostgreSQL connection stability confirmed.');
          return;
        }
        log('Connection dropped during post-bootstrap restart; resuming poll...');
      }
    }
    if (statusText.startsWith('exited')) {
      throw new Error(`PostgreSQL container exited unexpectedly during bootstrap: ${statusText}`);
    }
    await sleep(1000);
  }
  throw new Error('PostgreSQL container failed to achieve stable readiness within wait window.');
}

/** Apply one migration file; returns the spawn result (status 0 = success). */
export function applyMigrationFile(container, migrationsDir, file) {
  const fullPath = join(migrationsDir, file);
  const relativeToRepo = fullPath.startsWith(REPO_ROOT)
    ? fullPath.slice(REPO_ROOT.length).replace(/^[\\\/]/, '').replace(/\\/g, '/')
    : null;
  if (relativeToRepo) {
    return runCommand('docker', [...psqlBase(container.containerName), '-f', `/workspace/${relativeToRepo}`]);
  }
  return runCommand('docker', ['exec', '-i', container.containerName, 'psql', '-U', 'postgres', '-d', 'postgres', '--set', 'ON_ERROR_STOP=1'], {
    input: readFileSync(fullPath, 'utf8'),
  });
}

/** Run arbitrary SQL against the migrated DB (stdin). Returns spawn result. */
export function runSql(container, sql, extraPsqlArgs = []) {
  return runCommand('docker', ['exec', '-i', container.containerName, 'psql', '-U', 'postgres', '-d', 'postgres', '--set', 'ON_ERROR_STOP=1', ...extraPsqlArgs], { input: sql });
}

/** Apply every migration in sorted order. Returns { applied, total, failedFile, failure }. */
export function applyAllMigrations(container, migrationsDir = DEFAULT_MIGRATIONS_DIR, { log = console.log, write = (s) => process.stdout.write(s) } = {}) {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  let applied = 0;
  for (const file of files) {
    write(`  [${applied + 1}/${files.length}] Applying ${file}... `);
    const r = applyMigrationFile(container, migrationsDir, file);
    if (r.status !== 0) {
      write('FAILED!\n\n');
      return { applied, total: files.length, failedFile: file, failure: r.stderr || r.stdout };
    }
    write('OK\n');
    applied++;
  }
  return { applied, total: files.length, failedFile: null, failure: null };
}

export { REPO_ROOT, DEFAULT_MIGRATIONS_DIR, POSTGRES_IMAGE };

async function main() {
  const startTime = Date.now();
  const { migrationsDir } = parseArgs();

  console.log('====================================================');
  console.log('STARQ ERP — SERP-462 Migration Compatibility Gate');
  console.log('====================================================');
  console.log(`Repository root : ${REPO_ROOT}`);
  console.log(`Migrations path : ${migrationsDir}`);
  console.log(`PostgreSQL image: ${POSTGRES_IMAGE}`);

  if (!existsSync(migrationsDir)) {
    console.error(`Error: Migrations directory does not exist: ${migrationsDir}`);
    process.exit(1);
  }
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.error(`Error: No .sql migration files found in ${migrationsDir}`);
    process.exit(1);
  }
  console.log(`Found ${files.length} migration files in sorted order.`);

  let container = null;
  const cleanup = () => { if (container) container.teardown(); };
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
  process.on('exit', cleanup);

  try {
    container = createGateContainer();
    startGateContainer(container);
    await waitForStableDb(container);

    console.log('\nApplying migrations in filename-sorted order...');
    const result = applyAllMigrations(container, migrationsDir);
    if (result.failedFile) {
      console.error('====================================================');
      console.error(`MIGRATION FAILURE DETECTED ON FILE: ${result.failedFile}`);
      console.error('====================================================');
      console.error(result.failure);
      console.error('====================================================\n');
      cleanup();
      process.exit(1);
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n====================================================');
    console.log(`ALL MIGRATIONS APPLIED CLEANLY (${result.applied}/${result.total})`);
    console.log(`Total duration: ${durationSeconds}s`);
    console.log('SERP-462 Migration Compatibility Gate: PASS');
    console.log('====================================================\n');
    cleanup();
    process.exit(0);
  } catch (err) {
    console.error(`\nUnexpected error in migration compatibility gate: ${err.message}`);
    cleanup();
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}