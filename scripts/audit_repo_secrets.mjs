import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== STARQ ERP COMPREHENSIVE SECRET & SANITIZATION AUDIT ===\n');

const patterns = [
  { name: 'Supabase / JWT Tokens (HS256)', regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g },
  { name: 'Generic Private Keys', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'Database Connection Strings', regex: /postgres(ql)?:\/\/[^:\s]+:[^@\s]+@[^\s]+/g },
  { name: 'Google OAuth Client Secret', regex: /GOCSPX-[a-zA-Z0-9_-]+/g },
  { name: 'Google Client IDs', regex: /\d{10,}-[a-z0-9_.-]+\.apps\.googleusercontent\.com/g },
  { name: 'Supabase Project Hostnames / References', regex: /[a-z0-9]{20}\.supabase\.co/g },
  { name: 'Email Addresses', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'Local Absolute Windows/Unix Paths', regex: /(?:[A-Z]:\\[a-zA-Z0-9_.\-\\]+|\/Users\/[a-zA-Z0-9_.\-\/]+|\/home\/[a-zA-Z0-9_.\-\/]+)/gi },
  { name: 'Hardcoded Passwords / Secrets', regex: /(?:password|secret|api_key|service_key|anon_key|jwt_secret)\s*[:=]\s*['"][^'"]{6,}['"]/gi }
];

const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.svg', '.pptx', '.pdf', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.lock']);

// 1. Scan HEAD working tree
console.log('1. Scanning HEAD Working Tree:');
const headFiles = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
const headFindings = {};

for (const file of headFiles) {
  const ext = path.extname(file).toLowerCase();
  if (binaryExts.has(ext)) continue;
  if (!fs.existsSync(file)) continue;

  let content = '';
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const p of patterns) {
    const matches = [...content.matchAll(p.regex)];
    if (matches.length > 0) {
      if (!headFindings[p.name]) headFindings[p.name] = [];
      for (const m of matches) {
        headFindings[p.name].push({ file, match: m[0].slice(0, 100) });
      }
    }
  }
}

for (const [name, matches] of Object.entries(headFindings)) {
  console.log(`\n  • [${name}]: ${matches.length} occurrences in HEAD`);
  const unique = [...new Set(matches.map(m => `${m.file} -> ${m.match}`))].slice(0, 10);
  for (const u of unique) {
    console.log(`      - ${u}`);
  }
}

// 2. Scan Git Commit History
console.log('\n2. Scanning Full Git Commit History:');
const gitLog = execSync('git log -p', { maxBuffer: 150 * 1024 * 1024, encoding: 'utf8' });
const historyFindings = {};

for (const p of patterns) {
  const matches = [...gitLog.matchAll(p.regex)];
  if (matches.length > 0) {
    historyFindings[p.name] = matches.map(m => m[0].slice(0, 100));
    console.log(`\n  • [${p.name}]: ${matches.length} occurrences in Git history`);
    const unique = [...new Set(historyFindings[p.name])].slice(0, 10);
    for (const u of unique) {
      console.log(`      - ${u}`);
    }
  }
}

console.log('\n=== Audit Scan Complete ===');
