#!/usr/bin/env node
/**
 * CHECK REALITY — assert the configured world matches the declared one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * On 22 August 2026 the ERP shipped an Edge deploy that took nine attempts to make
 * work. Eighty-two tests were green through every single failure. Not one of them
 * was wrong — they simply could not see the problems, because every problem lived
 * in the join between the contract and the world:
 *
 *   · audit critical #5 required an `x-starq-client-kind` header that the only
 *     client did not send
 *   · migration 0011 made `quartermaster` the sole seat that may quote, and nobody
 *     in the allowlist held it
 *   · the seat filter demanded an entity token of "CI" while the allowlist said
 *     "club-ignition"
 *   · both OAuth client ids named a Google project that was not ours — and the
 *     Edge secret was seeded from the same bad source, so app and server agreed
 *     perfectly with each other and were both wrong
 *   · the deploy dropped `--no-verify-jwt`, a setting that existed only in the
 *     shell history of whoever last deployed
 *
 * A contract test proves the contract is coherent. It cannot prove the contract
 * describes the running system. These checks read the ACTUAL configured state —
 * the allowlist, the build defines, the client source, config.toml — and compare
 * it to what the code requires.
 *
 * The tests are still right to exist. This is the other half.
 *
 * Usage:
 *   node scripts/check-reality.mjs
 *
 * Exit codes: 0 all checks pass or skip, 1 at least one FAILED.
 *
 * Checks that depend on files outside the repository (the allowlist, the build
 * defines) SKIP rather than fail when those files are absent, so this is safe to
 * run in CI. A skip is reported loudly — it is not a pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STARQBOOKS = process.env.STARQBOOKS_PATH || path.resolve(ROOT, '..', 'starqBooks');
const ALLOWLIST = 'D:/StarqTech/_secrets/starqBooks-allowlist.json';
const DEFINES = 'D:/StarqTech/_secrets/starq-erp-r0-build-defines.json';

const results = [];
const pass = (name, detail) => results.push({ state: 'PASS', name, detail });
const fail = (name, detail) => results.push({ state: 'FAIL', name, detail });
const skip = (name, detail) => results.push({ state: 'SKIP', name, detail });

const read = (p) => fs.readFileSync(path.isAbsolute(p) ? p : path.join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const exists = (p) => fs.existsSync(path.isAbsolute(p) ? p : path.join(ROOT, p));

/** Pull an exported array of string literals out of the TS contract. */
function contractList(src, name) {
  const at = src.indexOf(`export const ${name}`);
  if (at < 0) return null;
  const open = src.indexOf('[', at);
  const close = src.indexOf('] as const', open);
  return [...src.slice(open, close).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Every seat a command can REQUIRE must be held by a real person.
//    Would have caught SERP-136 before it reached a migration review.
// ─────────────────────────────────────────────────────────────────────────────
function checkSeatOccupancy() {
  const NAME = 'Seat occupancy — every required seat is held by someone';
  if (!exists(ALLOWLIST)) return skip(NAME, 'allowlist not present on this machine');

  const contract = read('contracts/commands.ts');
  const people = readJson(ALLOWLIST).people ?? [];
  const held = new Set(
    people.filter((p) => p.status !== 'disabled' && p.status !== 'test_not_loginable')
      .flatMap((p) => p.seats ?? []),
  );

  // Seats the SQL matrix can demand, taken from the contract rather than retyped.
  const block = contract.slice(
    contract.indexOf('export const PURCHASE_STEP_SEATS'),
    contract.indexOf('} as const', contract.indexOf('export const PURCHASE_STEP_SEATS')),
  );
  const required = new Map();
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*(\w+):\s*\[(.*)\],?\s*$/);
    if (!m) continue;
    const seats = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    if (seats.length) required.set(m[1], seats);
  }
  if (!required.size) return fail(NAME, 'could not parse PURCHASE_STEP_SEATS');

  const orphans = [];
  for (const [step, seats] of required) {
    if (!seats.some((s) => held.has(s))) orphans.push(`${step} needs ${seats.join('|')}`);
  }
  if (orphans.length) {
    return fail(NAME, `no one can perform: ${orphans.join('; ')} — applying the seat matrix would make these steps impossible`);
  }
  pass(NAME, `${required.size} purchase steps, all reachable by a real person`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. The client must SEND every header the Edge REQUIRES.
//    Would have caught SERP-132 — critical #5 needing a header nobody sent.
// ─────────────────────────────────────────────────────────────────────────────
function checkRequiredHeaders() {
  const NAME = 'Required headers — the client sends what the Edge demands';
  const clientPath = path.join(STARQBOOKS, 'starq-ops-app', 'lib', 'core', 'api', 'api_client.dart');
  if (!fs.existsSync(clientPath)) return skip(NAME, `parked flutter client not found at ${clientPath}`);
  const client = fs.readFileSync(clientPath, 'utf8');
  const edge = read('supabase/functions/starq-api/index.ts');

  const problems = [];
  // Headers the Edge reads off the request and treats as load-bearing.
  for (const header of ['x-starq-client-kind', 'x-idempotency-key', 'x-csrf-token']) {
    if (!edge.toLowerCase().includes(header)) continue;
    if (!client.toLowerCase().includes(header)) {
      problems.push(`${header} is read by the Edge and never sent by the client`);
    }
  }
  // And CORS must actually allow them, or the browser strips them before arrival.
  const cors = edge.match(/access-control-allow-headers"[^"]*"([^"]+)"/i);
  if (cors) {
    for (const header of ['x-starq-client-kind', 'x-csrf-token', 'x-idempotency-key']) {
      if (client.toLowerCase().includes(header) && !cors[1].toLowerCase().includes(header)) {
        problems.push(`${header} is sent by the client but missing from access-control-allow-headers`);
      }
    }
  }
  problems.length ? fail(NAME, problems.join('; ')) : pass(NAME, 'client, Edge and CORS agree');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Build defines and the Edge must name the SAME Google project.
//    Would have caught SERP-135 — where both sides agreed, on a foreign project.
// ─────────────────────────────────────────────────────────────────────────────
function checkOauthIdentity() {
  const NAME = 'OAuth identity — build defines and the portal env name one project';
  if (!exists(DEFINES)) return skip(NAME, 'build defines not present on this machine');

  const d = readJson(DEFINES);
  const web = d.GOOGLE_SERVER_CLIENT_ID ?? '';
  const android = d.GOOGLE_ANDROID_CLIENT_ID ?? '';
  const problems = [];

  for (const [k, v] of [['GOOGLE_SERVER_CLIENT_ID', web], ['GOOGLE_ANDROID_CLIENT_ID', android]]) {
    if (!v) problems.push(`${k} is empty`);
    else if (!v.endsWith('.apps.googleusercontent.com')) problems.push(`${k} is not a Google client id`);
  }

  // The portal env is the independent witness — it was the only place holding the
  // correct value on 22 Aug, which is how the foreign project was caught.
  const envPath = 'D:/StarqTech/_secrets/starqBooks.env';
  if (exists(envPath)) {
    const m = read(envPath).match(/^STARQBOOKS_GOOGLE_CLIENT_ID\s*=\s*(.+)$/m);
    const portalWeb = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
    if (portalWeb && web && portalWeb !== web) {
      problems.push('GOOGLE_SERVER_CLIENT_ID does not match STARQBOOKS_GOOGLE_CLIENT_ID in the portal env — one of them is wrong');
    }
    if (portalWeb && web && portalWeb === web) {
      const proj = web.split('-')[0];
      if (android && android.split('-')[0] !== proj) {
        problems.push(`web client is in project ${proj} but the android client is in ${android.split('-')[0]}`);
      }
    }
  }
  problems.length ? fail(NAME, problems.join('; ')) : pass(NAME, `one project, both clients (${web.split('-')[0]})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Gateway settings must be DECLARED, not remembered.
//    Would have caught SERP-130 — the deploy that dropped --no-verify-jwt.
// ─────────────────────────────────────────────────────────────────────────────
function checkGatewayDeclared() {
  const NAME = 'Gateway settings — verify_jwt is in config.toml, not in shell history';
  if (!exists('supabase/config.toml')) {
    return fail(NAME, 'supabase/config.toml is missing — the deploy will use platform defaults and the clients send no apikey');
  }
  const toml = read('supabase/config.toml');
  if (!/\[functions\.starq-api\]/.test(toml)) return fail(NAME, 'config.toml has no [functions.starq-api] section');
  if (!/verify_jwt\s*=\s*false/.test(toml)) {
    return fail(NAME, 'verify_jwt is not pinned to false — the gateway will demand a bearer token the clients do not send');
  }
  pass(NAME, 'verify_jwt = false is declared and version-controlled');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. The cookie must be usable by a cross-site client.
//    Would have caught the SameSite=Strict session that evaporated on 23 Aug.
// ─────────────────────────────────────────────────────────────────────────────
function checkCookieScope() {
  const NAME = 'Cookie scope — the web client is cross-site and must receive the cookie';
  const edge = read('supabase/functions/starq-api/index.ts');
  const m = edge.match(/SameSite=(\w+)/);
  if (!m) return fail(NAME, 'no SameSite attribute found on the session cookie');
  if (m[1] === 'Strict') {
    return fail(NAME, 'SameSite=Strict — the web client is served from another site, so the cookie is set at login and never sent again');
  }
  if (!/HttpOnly/.test(edge) || !/Secure/.test(edge)) {
    return fail(NAME, `SameSite=${m[1]} but HttpOnly and/or Secure is missing`);
  }
  pass(NAME, `SameSite=${m[1]}, HttpOnly and Secure present`);
}


// ─────────────────────────────────────────────────────────────────────────────
// 6. The PORTAL and the CONTRACT must agree on the seat vocabulary.
//    Two live systems, two seat lists, and until 23 Aug nothing compared them.
//
//    Found by DP's cross-system audit, and only on the second pass — the first
//    pass checked auth.py against ITSELF ("SEAT_EVENTS covers all 11 seats, 100%
//    coverage") and reported clean. Internal consistency is not conformance.
//    That is the same mistake that let a seat matrix requiring an unheld seat
//    pass two independent reviews.
//
//    Written as a permanent check rather than left as a report, because a report
//    is true on the day it is written and a check is true on the day it matters.
// ─────────────────────────────────────────────────────────────────────────────
function checkPortalContractDrift() {
  const NAME = 'Portal vs contract — one seat vocabulary across both runtimes';
  const authPath = path.join(STARQBOOKS, 'auth.py');
  if (!fs.existsSync(authPath)) return skip(NAME, `auth.py not found at ${authPath}`);

  const py = fs.readFileSync(authPath, 'utf8');
  const ts = read('contracts/commands.ts');
  const problems = [];

  // -- the seat vocabulary itself --------------------------------------------
  const pySeatsBlock = py.match(/^SEATS\s*=\s*\{([\s\S]*?)^\}/m);
  const tsSeatsBlock = ts.match(/export const SEATS = \[([\s\S]*?)\] as const/);
  if (!pySeatsBlock || !tsSeatsBlock) {
    problems.push('could not locate one of the SEATS declarations');
  } else {
    // Portal keys are the top-level dict keys only, not the nested label/short/binds.
    const portal = new Set(
      [...pySeatsBlock[1].matchAll(/^\s{4}["']([a-z_]+)["']\s*:/gm)].map((m) => m[1]),
    );
    const contract = new Set([...tsSeatsBlock[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));

    const missingFromPortal = [...contract].filter((x) => !portal.has(x));
    const missingFromContract = [...portal].filter((x) => !contract.has(x));
    if (missingFromPortal.length) problems.push(`portal is missing seat(s) the contract defines: ${missingFromPortal.join(', ')}`);
    if (missingFromContract.length) problems.push(`portal defines seat(s) the contract does not: ${missingFromContract.join(', ')}`);
  }

  // -- the purchase step matrix ----------------------------------------------
  const pySteps = {};
  const pyStepBlock = py.match(/^SCM_STEP_SEATS\s*=\s*\{([\s\S]*?)^\}/m);
  if (pyStepBlock) {
    const keys = [...pyStepBlock[1].matchAll(/["'](need|quote|award|receive|match|pay)["']\s*:/g)];
    for (let i = 0; i < keys.length; i++) {
      const from = keys[i].index + keys[i][0].length;
      const to = i + 1 < keys.length ? keys[i + 1].index : pyStepBlock[1].length;
      pySteps[keys[i][1]] = [...pyStepBlock[1].slice(from, to).matchAll(/["']([a-z_]+)["']/g)]
        .map((m) => m[1]).sort();
    }
  }

  const tsSteps = {};
  const tsStart = ts.indexOf('export const PURCHASE_STEP_SEATS');
  if (tsStart >= 0) {
    const block = ts.slice(tsStart, ts.indexOf('} as const', tsStart));
    for (const line of block.split('\n')) {
      const m = line.match(/^\s*(need|quote|award|receive|match|pay):\s*\[(.*)\]/);
      if (m) tsSteps[m[1]] = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    }
  }

  if (!Object.keys(pySteps).length || !Object.keys(tsSteps).length) {
    problems.push('could not parse one of the purchase step matrices');
  } else {
    for (const step of new Set([...Object.keys(pySteps), ...Object.keys(tsSteps)])) {
      const a = (pySteps[step] ?? []).join(',');
      const b = (tsSteps[step] ?? []).join(',');
      if (a !== b) problems.push(`step '${step}' differs — portal [${a || 'absent'}] vs contract [${b || 'absent'}]`);
    }
  }

  problems.length
    ? fail(NAME, problems.join('; '))
    : pass(NAME, 'seat vocabulary and purchase step matrix agree across portal and contract');
}

for (const check of [checkSeatOccupancy, checkPortalContractDrift, checkRequiredHeaders, checkOauthIdentity, checkGatewayDeclared, checkCookieScope]) {
  try { check(); } catch (e) { fail(check.name, `check threw: ${e.message}`); }
}

const width = Math.max(...results.map((r) => r.name.length));
console.log('\nCHECK REALITY — configured state vs declared state\n');
for (const r of results) {
  console.log(`  ${r.state}  ${r.name.padEnd(width)}  ${r.detail}`);
}
const failed = results.filter((r) => r.state === 'FAIL');
const skipped = results.filter((r) => r.state === 'SKIP');
console.log(`\n  ${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped\n`);
if (skipped.length) console.log('  A SKIP is not a pass — it means this machine could not see the file.\n');
process.exit(failed.length ? 1 : 0);
