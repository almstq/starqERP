#!/usr/bin/env node
/**
 * SERP-234 — systematic reachability sweep.
 *
 * WHY THIS EXISTS. Dead code does not merely sit there, it DEFEATS VERIFICATION.
 * Two separate reports that the fabricated MIRA GST surface had been removed were
 * made in good faith and were both wrong, because the surviving copy lived in a
 * component that never mounts. No amount of clicking through the running app
 * could have found it — the screen it rendered was unreachable, and so was the
 * evidence that it still existed.
 *
 * METHOD. Reachability is COMPUTED from the real entry point outward, not judged
 * by reading imports by hand. Start at src/main.tsx, follow every relative
 * import transitively, and report what is left over.
 *
 * A file being unreachable is not automatically a defect. Tests, scripts and
 * type-only modules are legitimately outside the render graph. The point is that
 * every unreachable file must be a DECISION — retired, or recorded as
 * intentionally unmounted with a reason — rather than something nobody noticed.
 *
 *   node scripts/reachability-sweep.mjs            # human-readable report
 *   node scripts/reachability-sweep.mjs --json     # machine-readable
 *   node scripts/reachability-sweep.mjs --strict   # exit 1 if unreviewed orphans exist
 *
 * Run it before a release. It is cheap and it is the only check that catches
 * "removed" code that was never actually reachable to begin with.
 */

import fs from 'node:fs';
import path from 'node:path';

const WEB_SRC = path.resolve('web/src');
const ENTRY = path.join(WEB_SRC, 'main.tsx');
const EXTS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * Files that are legitimately outside the render graph, with the reason.
 * An entry here is a DECISION on the record. Anything not listed and not
 * reachable is an unreviewed orphan and the sweep says so.
 */
const INTENTIONALLY_UNMOUNTED = {
  'test/': 'Test suites and harness. Reached by vitest, not by the router.',
  '.test.': 'Test file.',
  'vite-env.d.ts': 'Vite ambient type declarations. Consumed by tsc, never imported.',
  'types/': 'Type-only modules. Erased at build time; reachability does not apply.',
  // Known and owned elsewhere — deliberately NOT re-litigated here.
  'App.tsx': 'KNOWN, owned by SERP-192 — a second stale router covering 10 views while main.tsx mounts app/router.tsx. Left to that task, not duplicated here.',
  'InvoiceDetailModal.tsx': 'KNOWN, owned by SERP-192 — imported nowhere and carries a fabricated MIRA TIN. Left to that task.',

  // --- DEC-103 / SERP-393 / Gate F4: Capability screens deliberately held pending backend schema ---
  'components/payroll/PayrollManagementView.tsx': 'HOLD under DEC-103 / SERP-393: No payroll/employee table or command. Fixture-seeded.',
  'components/inventory/MultiWarehouseView.tsx': 'HOLD under DEC-103 / SERP-393: No warehouse or stock_transfer table. Fixture-seeded.',
  'components/manufacturing/ProductionOrderView.tsx': 'HOLD under DEC-103 / SERP-393: No production_order or BOM table. Fixture-seeded.',
  'components/projects/JobCostingView.tsx': 'HOLD under DEC-103 / SERP-393: No job_cost table or command. Fixture-seeded.',
  'components/sales/CreditDunningView.tsx': 'HOLD under DEC-103 / SERP-393: No credit_profile or dunning table. Fixture-seeded.',
  'components/reports/ConsolidatedReportingView.tsx': 'HOLD under DEC-103 / SERP-393: No branch table or consolidation ledger. Fixture-seeded.',
  'components/banking/AiReconciliationView.tsx': 'HOLD under DEC-103 / SERP-393: No bank statement table or OCR service. Mock OCR text.',
  'components/admin/AgentRegistryView.tsx': 'HOLD under DEC-103 / SERP-393: Belongs to platform plane (StarqHQShell/SERP-099), not tenant router.',
  'components/onboarding/OrganisationSetupModal.tsx': 'RETIRE under DEC-103 / SERP-393: Superseded duplicate of RegisterOrganisationModal.',

  // --- DEC-103 / SERP-393: Domain support modules for held capability screens ---
  'domain/agentRegistry.ts': 'HOLD under DEC-103 / SERP-393: Domain definitions for held AgentRegistryView.',
  'domain/aiReconciliation.ts': 'HOLD under DEC-103 / SERP-393: Mock OCR parser for held AiReconciliationView.',
  'domain/consolidatedBranches.ts': 'HOLD under DEC-103 / SERP-393: Static branch constants for held ConsolidatedReportingView.',
  'domain/creditDunning.ts': 'HOLD under DEC-103 / SERP-393: Domain types for held CreditDunningView.',
  'domain/interBookTransfers.ts': 'HOLD under DEC-103 / SERP-393: Domain rules for inter-book transfers pending reporting UI.',
  'domain/jobCosting.ts': 'HOLD under DEC-103 / SERP-393: Job costing domain calculations for held JobCostingView.',
  'domain/landedCost.ts': 'HOLD under DEC-103 / SERP-393: Landed cost allocation logic pending purchasing UI.',
  'domain/manufacturing.ts': 'HOLD under DEC-103 / SERP-393: BOM calculations for held ProductionOrderView.',
  'domain/payroll.ts': 'HOLD under DEC-103 / SERP-393: Pension & salary calculations for held PayrollManagementView.',
  'domain/threeWayMatch.ts': 'HOLD under DEC-103 / SERP-393: 3-way matching logic pending AP workflow UI.',
  'domain/warehouse.ts': 'HOLD under DEC-103 / SERP-393: Warehouse transfer domain logic for held MultiWarehouseView.',
};

function listSourceFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listSourceFiles(p));
    else if (EXTS.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}

/** Resolve a relative import the way the bundler would. */
function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // bare specifier — a package, not our code
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    ...EXTS.map((e) => base + e),
    ...EXTS.map((e) => path.join(base, 'index' + e)),
  ];
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

const IMPORT_RE = /(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function importsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const specs = [];
  let m;
  while ((m = IMPORT_RE.exec(src))) specs.push(m[1] || m[2]);
  return specs.filter(Boolean);
}

/** Walk from the entry point, following every relative import transitively. */
function computeReachable(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importsOf(file)) {
      const resolved = resolveImport(file, spec);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

function classify(rel) {
  for (const [needle, reason] of Object.entries(INTENTIONALLY_UNMOUNTED)) {
    if (rel.includes(needle)) return reason;
  }
  return null;
}

// ── run ─────────────────────────────────────────────────────────────────────
if (!fs.existsSync(ENTRY)) {
  console.error(`Entry point not found: ${ENTRY}. Run from the repository root.`);
  process.exit(2);
}

const all = listSourceFiles(WEB_SRC);
const reachable = computeReachable(ENTRY);
const unreachable = all.filter((f) => !reachable.has(f));

const accounted = [];
const orphans = [];
for (const f of unreachable) {
  const rel = path.relative(WEB_SRC, f).replace(/\\/g, '/');
  const reason = classify(rel);
  (reason ? accounted : orphans).push({ file: rel, reason });
}

const json = process.argv.includes('--json');
const strict = process.argv.includes('--strict');

if (json) {
  console.log(JSON.stringify({
    entry: path.relative(process.cwd(), ENTRY).replace(/\\/g, '/'),
    total: all.length,
    reachable: reachable.size,
    unreachable: unreachable.length,
    accounted: accounted.length,
    orphans,
  }, null, 2));
} else {
  console.log('SERP-234 — reachability sweep');
  console.log(`entry:       web/src/main.tsx`);
  console.log(`source files: ${all.length}`);
  console.log(`reachable:    ${reachable.size}`);
  console.log(`unreachable:  ${unreachable.length}  (${accounted.length} accounted for, ${orphans.length} unreviewed)\n`);

  if (accounted.length) {
    console.log('ACCOUNTED FOR — intentionally outside the render graph');
    const byReason = {};
    for (const a of accounted) (byReason[a.reason] ??= []).push(a.file);
    for (const [reason, files] of Object.entries(byReason)) {
      console.log(`  ${reason}`);
      if (files.length <= 6) files.forEach((f) => console.log(`    ${f}`));
      else console.log(`    ${files.length} files`);
    }
    console.log('');
  }

  if (orphans.length) {
    console.log('UNREVIEWED ORPHANS — each needs a decision: retire, or record a reason');
    orphans.forEach((o) => console.log(`  ${o.file}`));
    console.log('\nAn unreachable component can render a screen nobody can reach, which is');
    console.log('how a fabricated GST surface survived being "removed" twice. Decide on each.');
  } else {
    console.log('No unreviewed orphans. Every unreachable file has a recorded reason.');
  }
}

if (strict && orphans.length) process.exit(1);
