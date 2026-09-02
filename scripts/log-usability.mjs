#!/usr/bin/env node
/**
 * SERP-257 — append one entry to the usability log.
 *
 *   node scripts/log-usability.mjs "what you were doing" "what happened" 5
 *
 * Three arguments: the task attempted, what happened, and rough minutes lost.
 * The timestamp and your username are added for you.
 *
 * WHY A SCRIPT FOR A MARKDOWN TABLE. Because friction has to be recorded IN THE
 * MOMENT to be worth anything, and anything that takes effort to write stops
 * being written on the day it would have mattered most. Removing the excuse is
 * the entire purpose.
 *
 * NO AGENT USES THIS. SERP-257 states that entries are written by the humans
 * doing the work. An agent writing entries would produce a log of what an agent
 * imagines is annoying, which is the reconstructed-friction problem wearing a
 * different hat.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const LOG = path.resolve('docs/operations/USABILITY_LOG.md');

const [task, what, minutes] = process.argv.slice(2);

if (!task || !what) {
  console.error(`
  Append one entry to the usability log.

    node scripts/log-usability.mjs "<task attempted>" "<what happened>" [minutes]

  Example:
    node scripts/log-usability.mjs "post a manual journal" \\
      "could not tell which accounts I was allowed to pick; tried three" 6

  Write it now rather than later — a reconstructed log loses exactly the
  problems that have already become habit, and those are the expensive ones.
`);
  process.exit(1);
}

if (!fs.existsSync(LOG)) {
  console.error(`Log not found at ${LOG}. Run from the repository root.`);
  process.exit(2);
}

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const who = os.userInfo().username || 'unknown';
const mins = minutes && /^\d+$/.test(minutes) ? minutes : '';
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();

const row = `| ${stamp} | ${cell(who)} | ${cell(task)} | ${cell(what)} | ${mins} |\n`;

fs.appendFileSync(LOG, row, 'utf8');

console.log('Logged.');
console.log(row.trim());
console.log(`\n  ${LOG}`);
console.log(`
  If the system did not do the thing AT ALL and you did it another way, that is a
  WORKAROUND, not friction — put it in docs/operations/WORKAROUND_REGISTER.md.
  Anything touching a financial figure is raised as P0 immediately.`);
