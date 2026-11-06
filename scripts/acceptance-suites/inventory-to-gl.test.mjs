#!/usr/bin/env node
/**
 * STARQ ERP - SERP-463 acceptance suite: Inventory-to-GL chain only (DEC-100).
 *
 * Run:  node --test scripts/acceptance-suites/inventory-to-gl.test.mjs
 * Needs: Docker, and web/node_modules (for the tsx loader used to import the TS domain function).
 *
 * Assembly only. No new accounting behaviour. Each test names the existing artifact it exercises.
 * Real migrated Postgres comes from the SERP-462 harness (scripts/migration-compatibility-gate.mjs,
 * imported, not copied).
 *
 * Runner choice: node:test in .mjs. Same family as tests/*.test.mjs invoked by ci.yml with `node`,
 * and it can drive the Docker harness directly; vitest (web/) is scoped to the web package.
 *
 * HONESTY BLOCK - what this suite does NOT prove (reported as NOT EXERCISED, never silently passed):
 *   - DEC-100 criteria: tenant isolation, idempotency (beyond the cited serp090 probe), concurrency,
 *     auditability. Migration compatibility is covered only by SERP-462 plus the 63/63 apply here.
 *   - Reservation and transfer posting-control wiring (SERP-466/467, commit 0dd4fa2) is absent from
 *     this base (67e130c), so the "reserve -> transfer" leg of the normal path is NOT EXERCISED.
 *   - The TS reconciliation takes in-memory arrays; no DB rows are fed into it here.
 *   - The 344 probe runs as the postgres superuser; it proves the DB trigger rejects control accounts
 *     even for superuser, not specifically a role named service_role.
 *   - Reversal "append-only": no UPDATE/DELETE-blocking trigger exists on counter_returns in the
 *     migrations; protection is revoked grants only. Reported as such, not as trigger-enforced.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REPO_ROOT,
  DEFAULT_MIGRATIONS_DIR,
  createGateContainer,
  startGateContainer,
  waitForStableDb,
  applyAllMigrations,
} from '../migration-compatibility-gate.mjs';

const quiet = () => {};
let container = null;
let migrationResult = null;

/** Run a SQL file or text in the container; stdout+stderr merged so probe ERROR lines stay in order. */
function psqlMerged(sql, { stopOnError = true } = {}) {
  const flag = stopOnError ? '--set ON_ERROR_STOP=1' : '--set ON_ERROR_STOP=0';
  const r = spawnSync(
    'docker',
    ['exec', '-i', container.containerName, 'sh', '-c', `psql -U postgres -d postgres ${flag} 2>&1`],
    { input: sql, encoding: 'utf8' },
  );
  return { status: r.status, out: r.stdout || '' };
}

const probe = (name) => readFileSync(join(REPO_ROOT, 'tests', name), 'utf8');

before(async () => {
  container = createGateContainer({ log: quiet });
  startGateContainer(container, { log: quiet });
  await waitForStableDb(container, { log: quiet });
  migrationResult = applyAllMigrations(container, DEFAULT_MIGRATIONS_DIR, { write: quiet });
});

after(() => {
  if (container) container.teardown();
});

test('SETUP [SERP-462 harness]: all migrations apply from zero on the pinned Supabase Postgres', () => {
  assert.equal(migrationResult.failedFile, null, `migration failed: ${migrationResult.failedFile}\n${migrationResult.failure}`);
  assert.equal(migrationResult.applied, migrationResult.total);
  assert.ok(migrationResult.total >= 63);
});

test('NORMAL (partial) [inventoryReconciliation.ts ACCEPTED #16458 + chart_of_accounts_as_data 1310]: subledger equals control balance -> zero variance', async () => {
  // DB side: Account 1310 exists and is a control account (the account the invariant reconciles to).
  const acct = psqlMerged(
    "select account_code || '|' || posting_control from public.chart_of_accounts where account_code = '1310' limit 1;\n",
  );
  assert.equal(acct.status, 0, acct.out);
  assert.match(acct.out, /1310\|control/, `1310 must be a control account:\n${acct.out}`);

  // TS side: import the accepted domain function through the web package's tsx loader.
  const requireFromWeb = createRequire(join(REPO_ROOT, 'web', 'package.json'));
  const tsxApi = pathToFileURL(requireFromWeb.resolve('tsx/esm/api')).href;
  const { tsImport } = await import(tsxApi);
  const mod = await tsImport(
    pathToFileURL(resolve(REPO_ROOT, 'web/src/domain/inventoryReconciliation.ts')).href,
    import.meta.url,
  );
  const item = (id, qty, cost) => ({ id, sku: id, name: id, category: 'Spare Parts', quantityOnHand: qty, unit: 'pc', reorderLevel: 0, unitCost: cost, sellingPrice: cost * 2, supplierId: 's', supplierName: 's', locationInShop: 'A1', stockStatus: 'In Stock', lastRestockedDate: '2026-10-29' });
  const items = [item('A', 10, 12.5), item('B', 3, 100), item('C', 0, 50)];
  const control = 10 * 12.5 + 3 * 100; // 425.00
  const ok = mod.reconcileInventoryToGL(items, control);
  assert.equal(ok.isReconciled, true);
  assert.equal(ok.variance, 0);
  assert.equal(ok.excludedNonPositiveStockItems.length, 1, 'zero-stock item must be surfaced, not valued');

  // Prohibited direction: a mismatch must not pass.
  const bad = mod.reconcileInventoryToGL(items, control - 0.01);
  assert.equal(bad.isReconciled, false);
  assert.equal(bad.variance, 0.01);
});

test('NORMAL (reserve -> transfer legs): NOT EXERCISED on this base (SERP-466/467 at 0dd4fa2 not integrated)', { skip: 'NOT EXERCISED: reservation/transfer posting-control code is absent from base 67e130c' }, () => {});

test('NEGATIVE [tests/serp_344_posting_control_probe.sql + enforce_posting_control]: control/header/system/unknown accounts reject, postable accounts accept', () => {
  const r = psqlMerged(probe('serp_344_posting_control_probe.sql'), { stopOnError: false });
  // Split into the probe's "--- <label>" sections and classify each.
  const sections = r.out.split(/^--- /m).slice(1).map((s) => ({ label: s.split('\n')[0], body: s }));
  const byCode = (code) => sections.find((s) => s.label.startsWith(code));
  const rejected = (s) => /ERROR:/.test(s.body) && !/\baccepted\b/.test(s.body);
  const accepted = (s) => /\baccepted\b/.test(s.body) && !/ERROR:/.test(s.body);
  for (const code of ['1000', '2120', '1210', '3200', '9999']) {
    const s = byCode(code);
    assert.ok(s, `probe section ${code} missing:\n${r.out}`);
    assert.ok(rejected(s), `${code} must be REJECTED:\n${s.body}`);
  }
  for (const code of ['1114', '6210']) {
    const s = byCode(code);
    assert.ok(s, `probe section ${code} missing:\n${r.out}`);
    assert.ok(accepted(s), `${code} must be ACCEPTED:\n${s.body}`);
  }
});

test('RETRY [tests/serp090_retry_resilience_probe.sql]: identical-key replay is idempotent, conflicting payload fails closed, no double stock effect', () => {
  const r = psqlMerged(probe('serp090_retry_resilience_probe.sql'));
  assert.equal(r.status, 0, `serp090 probe failed (the probe raises on any broken assertion):\n${r.out.slice(-3000)}`);
  assert.doesNotMatch(r.out, /FAILED|EXPECTED ERROR/, r.out.slice(-3000));
});

test('REVERSAL [tests/serp088_counter_return_void_probe.sql + 202609192359_serp088 counter_returns.reversal_type]: return/void restore stock; reversal_type vocabulary holds', () => {
  const r = psqlMerged(probe('serp088_counter_return_void_probe.sql'));
  assert.equal(r.status, 0, `serp088 probe failed:\n${r.out.slice(-3000)}`);
  assert.doesNotMatch(r.out, /FAILED|EXPECTED ERROR/, r.out.slice(-3000));

  const types = psqlMerged(
    "select pg_get_constraintdef(c.oid) from pg_constraint c join pg_class t on t.oid = c.conrelid where t.relname = 'counter_returns' and c.contype = 'c' and pg_get_constraintdef(c.oid) ilike '%reversal_type%';\n",
  );
  assert.equal(types.status, 0, types.out);
  for (const v of ['return', 'void', 'refund']) {
    assert.match(types.out, new RegExp(`'${v}'`), `reversal_type check must allow '${v}':\n${types.out}`);
  }
});

test('REVERSAL append-only (honest check): counter_returns is closed to anon/authenticated writes via revoked grants; no UPDATE/DELETE-blocking trigger exists', () => {
  const grants = psqlMerged(
    "select 'upd=' || has_table_privilege('authenticated','public.counter_returns','UPDATE') || ' del=' || has_table_privilege('authenticated','public.counter_returns','DELETE') || ' ins=' || has_table_privilege('authenticated','public.counter_returns','INSERT');\n",
  );
  assert.equal(grants.status, 0, grants.out);
  assert.match(grants.out, /upd=false del=false ins=false/, grants.out);

  const trig = psqlMerged(
    "select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relname = 'counter_returns' and not t.tgisinternal;\n",
  );
  assert.equal(trig.status, 0, trig.out);
  // Documented limitation, asserted so it cannot be silently over-claimed: 0 user triggers today.
  assert.match(trig.out, /\n\s*0\s*\n/, `expected 0 user triggers on counter_returns (append-only is grant-based only):\n${trig.out}`);
});
