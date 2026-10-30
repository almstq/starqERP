#!/usr/bin/env node
/**
 * starqERP — Design token ratchet
 *
 * WHY THIS EXISTS
 * The product has a real Material 3 token system: an official seed (#0B57D0),
 * the material-color-utilities generator, and 33 --md-sys-color tokens. It is
 * also bypassed 1,710 times by raw Tailwind palette utilities across 57 files.
 *
 * That combination is the worst of both worlds. We pay to maintain a token
 * layer and cannot use it: the theme is not derivable, a tenant skin or light
 * mode cannot ship without editing components one by one, and contrast cannot
 * be verified because half the colours are ad hoc.
 *
 * WHY A RATCHET AND NOT A BAN
 * Banning outright would fail on day one against 1,710 existing usages. A flat
 * allowlist would freeze those files but still let each of them grow.
 *
 * So this is a ratchet. Every file carries a baseline count. A file may go
 * DOWN, never UP. A file not in the baseline must have ZERO. The number can
 * only shrink, and it shrinks whenever anyone touches one of these files.
 *
 * The founder's decision (2026-08-29) is that the burn-down happens at ~85%
 * build progress, not now, because surfaces are still being reshaped and
 * tokenising a component twice is waste. This gate is the one part that had to
 * land immediately: it is the only piece whose cost GROWS with delay. Without
 * it, 1,710 becomes several thousand by 85% and the burn-down scales with it.
 *
 * HOW TO BURN A FILE DOWN
 *   1. Replace raw palette classes with the semantic token equivalents, e.g.
 *        bg-slate-900   -> bg-[var(--md-sys-color-surface-container)]
 *        text-slate-400 -> text-[var(--md-sys-color-on-surface-variant)]
 *        border-slate-800 -> border-[var(--md-sys-color-outline-variant)]
 *      Pick the token by ROLE, never by visual match. If no token fits the role,
 *      that is a finding worth raising, not a reason to keep the raw colour.
 *   2. Re-run this script. It prints the new count.
 *   3. Lower that file's number in BASELINE below (or delete the entry at zero).
 *   4. Commit both together, so the ratchet can never be loosened silently.
 *
 * Run:  node scripts/lint-design-tokens.mjs
 *       node scripts/lint-design-tokens.mjs --report   (counts only, never fails)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = path.join(ROOT, 'web', 'src', 'components');

const PALETTES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const PROPS = 'bg|text|border|ring|from|via|to|divide|outline|shadow|accent|caret|decoration|fill|stroke|placeholder';
const RAW_COLOUR = new RegExp(`\\b(?:${PROPS})-(?:${PALETTES})-\\d{2,3}\\b`, 'g');

/**
 * BASELINE — the debt as measured on 2026-08-29 at 142/319 board progress.
 * These numbers may only ever DECREASE. See "HOW TO BURN A FILE DOWN" above.
 */
const BASELINE = {
  'accounts/BankReconciliationView.tsx': 126,
  'tax/MiraGst201View.tsx': 107,
  'settings/WorkflowsConfigTab.tsx': 90,
  'sales/CreditDunningView.tsx': 80,
  'settings/UsersManagementTab.tsx': 78,
  'tax/MiraTgstView.tsx': 77,
  'reports/ReportsView.tsx': 65,
  'auth/MfaSetupModal.tsx': 62,
  'payroll/PayrollManagementView.tsx': 62,
  'reports/CashFlowStatementView.tsx': 61,
  'accounts/MultiCurrencyView.tsx': 59,
  'projects/JobCostingView.tsx': 51,
  'settings/SupportTab.tsx': 51,
  'inventory/MultiWarehouseView.tsx': 49,
  'invoices/BilingualInvoicePrintView.tsx': 49,
  'reports/AgingMatricesView.tsx': 49,
  'reports/ConsolidatedReportingView.tsx': 48,
  'onboarding/OrganisationSetupModal.tsx': 47,
  'admin/AgentRegistryView.tsx': 45,
  'manufacturing/ProductionOrderView.tsx': 39,
  'settings/RolesPermissionsTab.tsx': 38,
  'banking/AiReconciliationView.tsx': 34,
  'jobs/WorkflowStepRail.tsx': 34,
  'invoices/FavaraPaymentModal.tsx': 29,
  'accounts/PeriodManagementView.tsx': 26,
  'invoices/InvoicesView.tsx': 24,
  'jobs/CreateJobModal.tsx': 23,
  'auth/MfaChallengeModal.tsx': 21,
  'accounts/YearEndClosingModal.tsx': 17,
  'customers/NewCustomerModal.tsx': 16,
  'inventory/NewItemModal.tsx': 14,
  'invoices/CreateInvoiceModal.tsx': 13,
  'purchasing/CreatePOModal.tsx': 11,
  'accounts/UnlockPeriodModal.tsx': 10,
  'invoices/SettlementAllocationModal.tsx': 10,
  'payments/RecordPaymentModal.tsx': 10,
  'platform/StarqHQHealth.tsx': 10,
  'invoices/CreditNoteModal.tsx': 9,
  'accounts/AccountsView.tsx': 8,
  'accounts/ManualJournalModal.tsx': 7,
  'inventory/StockAdjustmentModal.tsx': 7,
  'platform/StarqHQOverview.tsx': 7,
  'platform/StarqHQProvisioning.tsx': 1,
  'platform/StarqHQApplications.tsx': 6,
  'platform/StarqHQSettings.tsx': 6,
  'onboarding/RegisterOrganisationModal.tsx': 4,
  'reports/DrilldownDrawer.tsx': 4,
  'brand/StarqLogo.tsx': 3,
  'accounts/GeneralLedgerView.tsx': 2,
  'common/Modal.tsx': 1,
  'dashboard/DashboardView.tsx': 1,
  'platform/StarqHQSubscriptions.tsx': 1,
};

const args = process.argv.slice(2);
const reportOnly = args.includes('--report');
// --seed prints a fresh BASELINE block from the current tree. Use it when
// seeding for the first time, never to paper over a broken ratchet.
const seedMode = args.includes('--seed');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

console.log('=== starqERP: design token ratchet ===\n');

if (!fs.existsSync(SCAN_DIR)) {
  console.error(`  ✗ scan directory not found: ${SCAN_DIR}`);
  process.exit(1);
}

const counts = new Map();
let total = 0;
for (const file of walk(SCAN_DIR)) {
  const rel = path.relative(SCAN_DIR, file).split(path.sep).join('/');
  const hits = (fs.readFileSync(file, 'utf8').match(RAW_COLOUR) || []).length;
  if (hits > 0) {
    counts.set(rel, hits);
    total += hits;
  }
}

if (seedMode) {
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  console.log('const BASELINE = {');
  for (const [rel, hits] of sorted) console.log(`  '${rel}': ${hits},`);
  console.log('};');
  process.exit(0);
}

let errors = 0;
const improved = [];

for (const [rel, hits] of [...counts].sort((a, b) => b[1] - a[1])) {
  const allowed = BASELINE[rel];
  if (allowed === undefined) {
    console.error(
      `  ✗ NEW FILE WITH RAW COLOURS: ${rel} (${hits})\n` +
      `      Use --md-sys-color tokens. This file has no baseline, so its budget is zero.`
    );
    errors++;
  } else if (hits > allowed) {
    console.error(
      `  ✗ RATCHET BROKEN: ${rel} (${hits}, baseline ${allowed}, +${hits - allowed})\n` +
      `      This file may go down, never up.`
    );
    errors++;
  } else if (hits < allowed) {
    improved.push(`${rel}: ${allowed} -> ${hits}`);
  }
}

for (const rel of Object.keys(BASELINE)) {
  if (!counts.has(rel)) improved.push(`${rel}: ${BASELINE[rel]} -> 0  (clear it from BASELINE)`);
}

if (improved.length) {
  console.log('  ↓ Improved — lower these in BASELINE and commit together:');
  improved.forEach((l) => console.log(`      ${l}`));
  console.log('');
}

const baselineTotal = Object.values(BASELINE).reduce((a, b) => a + b, 0);
console.log('======================================================');
console.log(`  Files with raw palette colours : ${counts.size}`);
console.log(`  Total raw palette usages       : ${total}`);
console.log(`  Baseline (top offenders)       : ${baselineTotal}`);
console.log('======================================================\n');

if (reportOnly) {
  console.log('  (--report: counts only, no gate)');
  process.exit(0);
}

if (errors > 0) {
  console.error(`❌ Design token ratchet failed with ${errors} violation(s).`);
  process.exit(1);
}

console.log('✓ Design token ratchet holding — no file grew.\n');
