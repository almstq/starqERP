#!/usr/bin/env node
/**
 * CHECK REALITY — assert the configured world matches the declared one.
 *
 * Exported check functions allow comprehensive mutation testing in tests/check_reality_mutation.test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const DEFAULT_STARQBOOKS = process.env.STARQBOOKS_PATH || path.resolve(ROOT, '..', 'starqBooks');
const DEFAULT_ALLOWLIST = 'D:/StarqTech/_secrets/starqBooks-allowlist.json';
const DEFAULT_DEFINES = 'D:/StarqTech/_secrets/starq-erp-r0-build-defines.json';

export function checkSeatOccupancy(opts = {}) {
  const root = opts.root || ROOT;
  const allowlistPath = opts.allowlistPath || DEFAULT_ALLOWLIST;
  const NAME = 'Seat occupancy — every required seat is held by someone';
  
  // If allowlistData is directly injected (e.g. mutation tests), skip filesystem check
  if (!opts.allowlistData && !fs.existsSync(allowlistPath)) {
    return { state: 'SKIP', name: NAME, detail: 'allowlist not present on this machine' };
  }

  const contractPath = path.join(root, 'contracts', 'commands.ts');
  const contract = opts.contractContent || fs.readFileSync(contractPath, 'utf8');
  const people = (opts.allowlistData || JSON.parse(fs.readFileSync(allowlistPath, 'utf8'))).people ?? [];
  const held = new Set(
    people.filter((p) => p.status !== 'disabled' && p.status !== 'test_not_loginable')
      .flatMap((p) => p.seats ?? []),
  );

  const at = contract.indexOf('export const PURCHASE_STEP_SEATS');
  if (at < 0) return { state: 'FAIL', name: NAME, detail: 'could not parse PURCHASE_STEP_SEATS' };
  const block = contract.slice(at, contract.indexOf('} as const', at));
  const required = new Map();
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*(\w+):\s*\[(.*)\],?\s*$/);
    if (!m) continue;
    const seats = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    if (seats.length) required.set(m[1], seats);
  }
  if (!required.size) return { state: 'FAIL', name: NAME, detail: 'could not parse PURCHASE_STEP_SEATS' };

  const orphans = [];
  for (const [step, seats] of required) {
    if (!seats.some((s) => held.has(s))) orphans.push(`${step} needs ${seats.join('|')}`);
  }
  if (orphans.length) {
    return { state: 'FAIL', name: NAME, detail: `no one can perform: ${orphans.join('; ')} — applying the seat matrix would make these steps impossible` };
  }
  return { state: 'PASS', name: NAME, detail: `${required.size} purchase steps, all reachable by a real person` };
}

export function checkRequiredHeaders(opts = {}) {
  const root = opts.root || ROOT;
  const starqBooks = opts.starqBooks || DEFAULT_STARQBOOKS;
  const NAME = 'Required headers — the client sends what the Edge demands';
  
  const clientPath = path.join(starqBooks, 'starq-ops-app', 'lib', 'core', 'api', 'api_client.dart');
  if (!opts.clientContent && !fs.existsSync(clientPath)) {
    return { state: 'SKIP', name: NAME, detail: `parked flutter client not found at ${clientPath}` };
  }
  const client = opts.clientContent || fs.readFileSync(clientPath, 'utf8');
  const edgePath = path.join(root, 'supabase', 'functions', 'starq-api', 'index.ts');
  const edge = opts.edgeContent || fs.readFileSync(edgePath, 'utf8');

  const problems = [];
  for (const header of ['x-starq-client-kind', 'x-idempotency-key', 'x-csrf-token']) {
    if (!edge.toLowerCase().includes(header)) continue;
    if (!client.toLowerCase().includes(header)) {
      problems.push(`${header} is read by the Edge and never sent by the client`);
    }
  }
  const cors = edge.match(/access-control-allow-headers"[^"]*"([^"]+)"/i);
  if (cors) {
    for (const header of ['x-starq-client-kind', 'x-csrf-token', 'x-idempotency-key']) {
      if (client.toLowerCase().includes(header) && !cors[1].toLowerCase().includes(header)) {
        problems.push(`${header} is sent by the client but missing from access-control-allow-headers`);
      }
    }
  }
  return problems.length 
    ? { state: 'FAIL', name: NAME, detail: problems.join('; ') }
    : { state: 'PASS', name: NAME, detail: 'client, Edge and CORS agree' };
}

export function checkOauthIdentity(opts = {}) {
  const definesPath = opts.definesPath || DEFAULT_DEFINES;
  const envPath = opts.envPath || 'D:/StarqTech/_secrets/starqBooks.env';
  const NAME = 'OAuth identity — build defines and the portal env name one project';
  
  if (!opts.definesData && !fs.existsSync(definesPath)) {
    return { state: 'SKIP', name: NAME, detail: 'build defines not present on this machine' };
  }

  const d = opts.definesData || JSON.parse(fs.readFileSync(definesPath, 'utf8'));
  const web = d.GOOGLE_SERVER_CLIENT_ID ?? '';
  const android = d.GOOGLE_ANDROID_CLIENT_ID ?? '';
  const problems = [];

  for (const [k, v] of [['GOOGLE_SERVER_CLIENT_ID', web], ['GOOGLE_ANDROID_CLIENT_ID', android]]) {
    if (!v) problems.push(`${k} is empty`);
    else if (!v.endsWith('.apps.googleusercontent.com')) problems.push(`${k} is not a Google client id`);
  }

  if (opts.envContent || fs.existsSync(envPath)) {
    const content = opts.envContent || fs.readFileSync(envPath, 'utf8');
    const m = content.match(/^STARQBOOKS_GOOGLE_CLIENT_ID\s*=\s*(.+)$/m);
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
  return problems.length 
    ? { state: 'FAIL', name: NAME, detail: problems.join('; ') }
    : { state: 'PASS', name: NAME, detail: `one project, both clients (${web.split('-')[0]})` };
}

export function checkGatewayDeclared(opts = {}) {
  const root = opts.root || ROOT;
  const configPath = path.join(root, 'supabase', 'config.toml');
  const NAME = 'Gateway settings — verify_jwt is in config.toml, not in shell history';
  
  if (!opts.configContent && !fs.existsSync(configPath)) {
    return { state: 'FAIL', name: NAME, detail: 'supabase/config.toml is missing — the deploy will use platform defaults and the clients send no apikey' };
  }
  const toml = opts.configContent || fs.readFileSync(configPath, 'utf8');
  if (!/\[functions\.starq-api\]/.test(toml)) {
    return { state: 'FAIL', name: NAME, detail: 'config.toml has no [functions.starq-api] section' };
  }
  if (!/verify_jwt\s*=\s*false/.test(toml)) {
    return { state: 'FAIL', name: NAME, detail: 'verify_jwt is not pinned to false — the gateway will demand a bearer token the clients do not send' };
  }
  return { state: 'PASS', name: NAME, detail: 'verify_jwt = false is declared and version-controlled' };
}

export function checkCookieScope(opts = {}) {
  const root = opts.root || ROOT;
  const edgePath = path.join(root, 'supabase', 'functions', 'starq-api', 'index.ts');
  const NAME = 'Cookie scope — the web client is cross-site and must receive the cookie';
  
  const edge = opts.edgeContent || fs.readFileSync(edgePath, 'utf8');
  const m = edge.match(/SameSite=(\w+)/);
  if (!m) return { state: 'FAIL', name: NAME, detail: 'no SameSite attribute found on the session cookie' };
  if (m[1] === 'Strict') {
    return { state: 'FAIL', name: NAME, detail: 'SameSite=Strict — the web client is served from another site, so the cookie is set at login and never sent again' };
  }
  if (!/HttpOnly/.test(edge) || !/Secure/.test(edge)) {
    return { state: 'FAIL', name: NAME, detail: `SameSite=${m[1]} but HttpOnly and/or Secure is missing` };
  }
  return { state: 'PASS', name: NAME, detail: `SameSite=${m[1]}, HttpOnly and Secure present` };
}

export function checkPortalContractDrift(opts = {}) {
  const root = opts.root || ROOT;
  const starqBooks = opts.starqBooks || DEFAULT_STARQBOOKS;
  const NAME = 'Portal vs contract — one seat vocabulary across both runtimes';
  
  const authPath = path.join(starqBooks, 'auth.py');
  if (!opts.authContent && !fs.existsSync(authPath)) {
    return { state: 'SKIP', name: NAME, detail: `auth.py not found at ${authPath}` };
  }

  const py = opts.authContent || fs.readFileSync(authPath, 'utf8');
  const contractPath = path.join(root, 'contracts', 'commands.ts');
  const ts = opts.contractContent || fs.readFileSync(contractPath, 'utf8');
  const problems = [];

  const pySeatsBlock = py.match(/^SEATS\s*=\s*\{([\s\S]*?)^\}/m);
  const tsSeatsBlock = ts.match(/export const SEATS = \[([\s\S]*?)\] as const/);
  if (!pySeatsBlock || !tsSeatsBlock) {
    problems.push('could not locate one of the SEATS declarations');
  } else {
    const portal = new Set(
      [...pySeatsBlock[1].matchAll(/^\s{4}["']([a-z_]+)["']\s*:/gm)].map((m) => m[1]),
    );
    const contract = new Set([...tsSeatsBlock[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));

    const missingFromPortal = [...contract].filter((x) => !portal.has(x));
    const missingFromContract = [...portal].filter((x) => !contract.has(x));
    if (missingFromPortal.length) problems.push(`portal is missing seat(s) the contract defines: ${missingFromPortal.join(', ')}`);
    if (missingFromContract.length) problems.push(`portal defines seat(s) the contract does not: ${missingFromContract.join(', ')}`);
  }

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

  return problems.length
    ? { state: 'FAIL', name: NAME, detail: problems.join('; ') }
    : { state: 'PASS', name: NAME, detail: 'seat vocabulary and purchase step matrix agree across portal and contract' };
}

export function runAllChecks(opts = {}) {
  return [
    checkSeatOccupancy(opts),
    checkPortalContractDrift(opts),
    checkRequiredHeaders(opts),
    checkOauthIdentity(opts),
    checkGatewayDeclared(opts),
    checkCookieScope(opts),
  ];
}

// Standalone CLI execution
const isDirectRun = Boolean(
  process.argv[1] &&
  (path.resolve(process.argv[1]).toLowerCase() === path.resolve(__filename).toLowerCase() ||
   process.argv[1].toLowerCase().endsWith('check-reality.mjs'))
);
if (isDirectRun) {
  const results = runAllChecks();
  const width = Math.max(...results.map((r) => r.name.length));
  console.log('\nCHECK REALITY — configured state vs declared state\n');
  for (const r of results) {
    console.log(`  ${r.state.padEnd(4)}  ${r.name.padEnd(width)}  ${r.detail}`);
  }
  const failed = results.filter((r) => r.state === 'FAIL');
  const skipped = results.filter((r) => r.state === 'SKIP');
  console.log(`\n  ${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped\n`);
  if (skipped.length) console.log('  A SKIP is not a pass — it means this machine could not see the file.\n');
  process.exit(failed.length ? 1 : 0);
}
