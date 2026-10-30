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

async function main() {
  const startTime = Date.now();
  const { migrationsDir } = parseArgs();
  // C1: Cryptographically random per-run password (not static constant)
  const postgresPassword = crypto.randomBytes(16).toString('hex');

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

  // 1. Collect and sort migration files
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error(`Error: No .sql migration files found in ${migrationsDir}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} migration files in sorted order.`);

  // 2. Prepare container metadata
  const containerIdSuffix = crypto.randomBytes(4).toString('hex');
  const containerName = `starqerp-migration-gate-${containerIdSuffix}`;

  // C3: Track container for cleanup as soon as it exists (even before start)
  let containerCreated = false;

  const cleanupContainer = () => {
    if (containerCreated) {
      console.log(`\nTearing down ephemeral container ${containerName}...`);
      runCommand('docker', ['rm', '-f', containerName]);
      containerCreated = false;
      console.log('Container teardown complete.');
    }
  };

  // Register process signal & exit hooks
  process.on('SIGINT', () => {
    cleanupContainer();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanupContainer();
    process.exit(143);
  });
  process.on('exit', () => {
    cleanupContainer();
  });

  try {
    // 3. Create container
    console.log(`\nCreating ephemeral PostgreSQL container (${containerName})...`);
    const createArgs = [
      'create',
      '--name', containerName,
      '--mount', `type=bind,source=${REPO_ROOT},target=/workspace,readonly`,
      '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=1g',
      '--env', `POSTGRES_PASSWORD=${postgresPassword}`,
      '--env', 'POSTGRES_DB=postgres',
      POSTGRES_IMAGE,
    ];

    const createResult = runCommand('docker', createArgs);
    if (createResult.status !== 0) {
      console.error(`Failed to create docker container: ${createResult.stderr || createResult.stdout}`);
      process.exit(1);
    }
    // C3: Container is created in docker daemon; register cleanup immediately
    containerCreated = true;

    // 4. Start container
    console.log(`Starting ephemeral PostgreSQL container (${containerName})...`);
    const startResult = runCommand('docker', ['start', containerName]);
    if (startResult.status !== 0) {
      console.error(`Failed to start docker container: ${startResult.stderr || startResult.stdout}`);
      cleanupContainer();
      process.exit(1);
    }

    // 5. Wait for PostgreSQL to settle and verify stability (A3)
    console.log('Waiting for PostgreSQL container to become healthy and stable...');
    let isStable = false;

    for (let attempt = 1; attempt <= 90; attempt++) {
      const inspectResult = runCommand('docker', [
        'inspect',
        '--format', '{{.State.Status}} {{.State.Health.Status}}',
        containerName,
      ]);
      const statusText = (inspectResult.stdout || '').trim();

      if (statusText === 'running healthy') {
        // Initial connection test
        const testConn1 = runCommand('docker', [
          'exec',
          containerName,
          'psql',
          '-U', 'postgres',
          '-d', 'postgres',
          '--set', 'ON_ERROR_STOP=1',
          '-c', 'SELECT 1;',
        ]);

        if (testConn1.status === 0) {
          // A3: Double-check stability logic mirroring ci.yml:119-134
          // "The Supabase image briefly accepts connections during first-time initialization,
          // then restarts PostgreSQL to apply its bootstrap SQL. A single successful check can land
          // in that window, so confirm the connection is stable before trusting it."
          console.log(`Connected on attempt ${attempt}; confirming stability after 5s window (ci.yml:121-124)...`);
          await sleep(5000);

          const testConn2 = runCommand('docker', [
            'exec',
            containerName,
            'psql',
            '-U', 'postgres',
            '-d', 'postgres',
            '--set', 'ON_ERROR_STOP=1',
            '-c', 'SELECT 1;',
          ]);

          if (testConn2.status === 0) {
            isStable = true;
            console.log('PostgreSQL connection stability confirmed.');
            break;
          } else {
            console.log('Connection dropped during post-bootstrap restart; resuming poll...');
          }
        }
      }

      if (statusText.startsWith('exited')) {
        throw new Error(`PostgreSQL container exited unexpectedly during bootstrap: ${statusText}`);
      }

      await sleep(1000);
    }

    if (!isStable) {
      throw new Error('PostgreSQL container failed to achieve stable readiness within wait window.');
    }

    // 6. Apply migrations in sequence
    console.log('\nApplying migrations in filename-sorted order...');
    let appliedCount = 0;

    for (const file of files) {
      const fullPath = join(migrationsDir, file);
      process.stdout.write(`  [${appliedCount + 1}/${files.length}] Applying ${file}... `);

      let applyResult;
      const relativeToRepo = fullPath.startsWith(REPO_ROOT)
        ? fullPath.slice(REPO_ROOT.length).replace(/^[\\\/]/, '').replace(/\\/g, '/')
        : null;

      if (relativeToRepo) {
        const containerPath = `/workspace/${relativeToRepo}`;
        applyResult = runCommand('docker', [
          'exec',
          containerName,
          'psql',
          '-U', 'postgres',
          '-d', 'postgres',
          '--set', 'ON_ERROR_STOP=1',
          '-f', containerPath,
        ]);
      } else {
        // External directory (e.g. fixtures): read file content and pipe to docker exec psql
        const content = readFileSync(fullPath, 'utf8');
        applyResult = runCommand('docker', [
          'exec',
          '-i',
          containerName,
          'psql',
          '-U', 'postgres',
          '-d', 'postgres',
          '--set', 'ON_ERROR_STOP=1',
        ], { input: content });
      }

      if (applyResult.status !== 0) {
        process.stdout.write('FAILED!\n\n');
        console.error('====================================================');
        console.error(`MIGRATION FAILURE DETECTED ON FILE: ${file}`);
        console.error('====================================================');
        console.error(applyResult.stderr || applyResult.stdout);
        console.error('====================================================\n');
        cleanupContainer();
        process.exit(1);
      } else {
        process.stdout.write('OK\n');
        appliedCount++;
      }
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n====================================================');
    console.log(`ALL MIGRATIONS APPLIED CLEANLY (${appliedCount}/${files.length})`);
    console.log(`Total duration: ${durationSeconds}s`);
    console.log('SERP-462 Migration Compatibility Gate: PASS');
    console.log('====================================================\n');

    cleanupContainer();
    process.exit(0);
  } catch (err) {
    console.error(`\nUnexpected error in migration compatibility gate: ${err.message}`);
    cleanupContainer();
    process.exit(1);
  }
}

main();
