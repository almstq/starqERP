import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');

console.log('=== SERP-263: Pre-Push Secret & Credential Sweep ===\n');

// 1. Get all tracked files in git
const trackedFiles = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .map((f) => f.trim())
  .filter((f) => f.length > 0);

console.log(`Scanning ${trackedFiles.length} tracked repository files for secrets/credentials...`);

const FORBIDDEN_PATTERNS = [
  { name: 'Private Key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Live GitHub Token', regex: /ghp_[A-Za-z0-9_]{36,}|gho_[A-Za-z0-9_]{36,}/ },
  { name: 'Live AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'Live Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/ },
  { name: 'Live OpenAI Secret Key', regex: /sk-[a-zA-Z0-9]{48}/ },
  { name: 'Live Supabase Service Role Key with secret payload', regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.service_role/ },
  { name: 'Unmasked Live PostgreSQL Connection String', regex: /postgres(?:ql)?:\/\/[a-zA-Z0-9_\-\.]+:[^@\s]{6,}@[a-zA-Z0-9_\-\.]+\.[a-zA-Z]{2,}\// },
];

const IGNORE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.woff', '.woff2'];

let violations = 0;

for (const relPath of trackedFiles) {
  const ext = path.extname(relPath).toLowerCase();
  if (IGNORE_EXTENSIONS.includes(ext)) continue;
  if (relPath.includes('pre-push-secret-scan.mjs')) continue; // ignore self-pattern matching

  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf8');
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.regex.test(content)) {
      console.error(`[VIOLATION] ${pattern.name} detected in: ${relPath}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\nFAILED: Found ${violations} secret/credential violations in tracked files.`);
  process.exit(1);
}

console.log(`✓ Clean: 0 secret violations found across all ${trackedFiles.length} tracked files.\n`);
process.exit(0);
