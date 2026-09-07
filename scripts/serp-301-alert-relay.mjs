import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Usage (keep the relay secret in the process environment, never in a file or argument):
//   STARQ_ALERT_RELAY_URL=https://erp.example \
//   STARQBOOKS_ALERT_RELAY_SECRET=... \
//   node scripts/serp-301-alert-relay.mjs

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_ROOM_PATH = 'D:/StarqTech/agent-comms/room.jsonl';
const DEFAULT_SEND_PATH = 'D:/StarqTech/agent-comms/scripts/send.mjs';
const DEFAULT_LOOKBACK_MS = 15 * 60 * 1000;

function roomBody(record) {
  return [record?.body, record?.event?.body].filter((value) => typeof value === 'string').join('\n');
}

export function readRelayCursor(roomText) {
  const seenIds = new Set();
  let latestOccurredAt = null;

  for (const line of String(roomText ?? '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    const body = roomBody(record);
    for (const match of body.matchAll(/security_event_id=([^\s]+)/g)) {
      seenIds.add(match[1]);
    }
    for (const match of body.matchAll(/occurred_at=([^\s]+)/g)) {
      const candidate = match[1];
      if (!Number.isNaN(Date.parse(candidate)) && (!latestOccurredAt || Date.parse(candidate) > Date.parse(latestOccurredAt))) {
        latestOccurredAt = new Date(candidate).toISOString();
      }
    }
  }

  return { seenIds, latestOccurredAt };
}

function validEventId(value) {
  return typeof value === 'number' || (typeof value === 'string' && /^[A-Za-z0-9._:-]+$/.test(value));
}

export function selectNewEvents(events, seenIds) {
  const unique = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    const id = String(event?.id ?? '');
    if (!validEventId(event?.id) || !id || seenIds.has(id) || unique.has(id)) continue;
    if (typeof event.event_type !== 'string' || typeof event.outcome !== 'string') continue;
    if (Number.isNaN(Date.parse(event.occurred_at))) continue;
    unique.set(id, event);
  }
  return [...unique.values()].sort((left, right) => Date.parse(left.occurred_at) - Date.parse(right.occurred_at));
}

export function explicitlyEscalatesToFounder(event) {
  const metadata = event?.metadata && typeof event.metadata === 'object' ? event.metadata : {};
  return metadata.founder_escalation === true
    || metadata.escalation === 'founder'
    || metadata.risk_threshold === 'founder';
}

function safeToken(value, fallback = 'unknown') {
  const token = String(value ?? '').replace(/[\r\n\s]+/g, '_').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 100);
  return token || fallback;
}

export function buildAlertBody(event) {
  const eventId = safeToken(event.id);
  const occurredAt = new Date(event.occurred_at).toISOString();
  const requestId = /^[0-9a-f-]{16,}$/i.test(String(event.request_id ?? '')) ? event.request_id : 'none';
  const founderEscalation = explicitlyEscalatesToFounder(event);
  const mentions = founderEscalation ? '@claude @nexus @ali' : '@claude @nexus';
  return [
    '[SERP-301 SECURITY ALERT]',
    `security_event_id=${eventId}`,
    `event_type=${safeToken(event.event_type)}`,
    `outcome=${safeToken(event.outcome)}`,
    `occurred_at=${occurredAt}`,
    `request_id=${requestId}`,
    `founder_escalation=${founderEscalation ? 'explicit' : 'not_inferred'}`,
    mentions,
  ].join(' ');
}

function relayUrl() {
  const base = process.env.STARQ_ALERT_RELAY_URL;
  if (!base) throw new Error('STARQ_ALERT_RELAY_URL is required');
  const url = new URL('/admin/security-events/recent', base.endsWith('/') ? base : `${base}/`);
  return url;
}

function acquireLock(lockPath) {
  mkdirSync(dirname(lockPath), { recursive: true });
  let descriptor;
  try {
    descriptor = openSync(lockPath, 'wx');
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`relay_already_running:${basename(lockPath)}`);
    throw error;
  }
  try {
    closeSync(descriptor);
  } catch {
    unlinkSync(lockPath);
    throw new Error('relay_lock_initialization_failed');
  }
  return () => {
    try { unlinkSync(lockPath); } catch { /* another process owns cleanup */ }
  };
}

async function fetchEvents(since) {
  const secret = process.env.STARQBOOKS_ALERT_RELAY_SECRET;
  if (!secret) throw new Error('STARQBOOKS_ALERT_RELAY_SECRET is required');
  const url = relayUrl();
  url.searchParams.set('since', since);
  const response = await fetch(url, { headers: { 'x-starq-relay-secret': secret } });
  if (!response.ok) throw new Error(`relay_http_${response.status}`);
  const payload = await response.json();
  if (!payload || payload.ok !== true || !Array.isArray(payload.events)) throw new Error('relay_invalid_response');
  return payload.events;
}

function sendRoomMessage(sendPath, body) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [sendPath, '--from', 'codex', '--room', '--body', body, '--tag', 'security'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(stdout.trim());
      else reject(new Error(`room_post_failed:${code}:${stderr.trim().slice(0, 200)}`));
    });
  });
}

export async function runRelay({
  roomPath = process.env.STARQ_AGENT_COMMS_ROOM ?? DEFAULT_ROOM_PATH,
  sendPath = process.env.STARQ_AGENT_COMMS_SEND ?? DEFAULT_SEND_PATH,
  now = Date.now(),
} = {}) {
  if (!existsSync(roomPath)) throw new Error('agent_comms_room_not_found');
  if (!existsSync(sendPath)) throw new Error('agent_comms_sender_not_found');

  const { seenIds, latestOccurredAt } = readRelayCursor(readFileSync(roomPath, 'utf8'));
  const since = latestOccurredAt ?? new Date(now - DEFAULT_LOOKBACK_MS).toISOString();
  const events = selectNewEvents(await fetchEvents(since), seenIds);
  const posted = [];
  for (const event of events) {
    await sendRoomMessage(sendPath, buildAlertBody(event));
    posted.push(String(event.id));
  }
  return { since, fetched: events.length, posted };
}

async function main() {
  const lockPath = process.env.STARQ301_RELAY_LOCK ?? join(tmpdir(), 'starq-serp301-alert-relay.lock');
  const release = acquireLock(lockPath);
  try {
    const result = await runRelay();
    console.log(`SERP-301 relay: fetched=${result.fetched} posted=${result.posted.length}`);
  } finally {
    release();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(`SERP-301 relay failed: ${error instanceof Error ? error.message : 'unknown_error'}`);
    process.exitCode = 1;
  });
}
