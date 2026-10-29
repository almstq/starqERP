#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trackedFiles = execFileSync(
  'git',
  ['ls-files', '--', '*.md', '*.mdx', 'contracts/commands.ts', 'supabase/functions/_shared/commands.ts'],
  { cwd: root, encoding: 'utf8' },
)
  .split(/\r?\n/)
  .filter(Boolean);

const excluded = /^(?:docs\/(?:history|evidence)\/|legacy\/)/i;
const prohibited = [
  { pattern: /https?:\/\/ai\.studio(?:\/|$)/i, reason: 'remove live AI Studio template links from current documentation' },
  { pattern: /\bGEMINI_API_KEY\b/i, reason: 'remove obsolete Gemini setup instructions from current documentation' },
  { pattern: /Flutter\s*[—–-]\s*the caller/i, reason: 'do not present the retired Flutter client as a current contract consumer' },
  { pattern: /garage clients/i, reason: 'describe the current browser client instead of removed garage clients' },
  { pattern: /TODAY the Flutter client/i, reason: 'replace stale present-tense Flutter client claims' },
  { pattern: /Flutter client does not yet send `CommandEnvelope`/i, reason: 'describe the current browser client accurately' },
];

const violations = [];
for (const relativePath of trackedFiles) {
  if (excluded.test(relativePath)) continue;
  const content = readFileSync(join(root, relativePath), 'utf8');
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    for (const rule of prohibited) {
      if (rule.pattern.test(lines[index])) {
        violations.push(`${relativePath}:${index + 1}: ${rule.reason}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Documentation content guard failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation content guard passed (${trackedFiles.length} tracked documents/contracts checked).`);
}
