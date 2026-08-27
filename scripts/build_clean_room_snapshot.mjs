import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SOURCE_ROOT = 'D:\\StarqTech\\starqERP';
const TARGET_ROOT = 'D:\\StarqTech\\starqERP-public';

console.log('=== BUILD CLEAN-ROOM PUBLIC SNAPSHOT ===\n');
console.log(`Source: ${SOURCE_ROOT}`);
console.log(`Target: ${TARGET_ROOT}\n`);

// 1. Clean / Prepare target directory
if (fs.existsSync(TARGET_ROOT)) {
  console.log(`Removing existing target directory: ${TARGET_ROOT}`);
  fs.rmSync(TARGET_ROOT, { recursive: true, force: true });
}
fs.mkdirSync(TARGET_ROOT, { recursive: true });

// 2. Define Public Allowlist Files and Folders
const publicDirs = [
  'contracts',
  'supabase/functions/starq-api',
  'supabase/functions/_shared',
  'supabase/migrations',
  'tests',
  'web/public',
  'web/src',
  'docs/architecture',
  'docs/development',
  'docs/security',
  'docs/roadmap',
  '.well-known'
];

const publicFiles = [
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  '.gitignore',
  'contracts/commands.ts',
  'contracts/tenant_import_pipeline.ts',
  'supabase/config.toml',
  'supabase/seed.sql',
  'web/index.html',
  'web/metadata.json',
  'web/package.json',
  'web/package-lock.json',
  'web/tsconfig.json',
  'web/vite.config.ts',
  'web/.env.example',
  'web/.gitignore',
  'web/README.md',
  'docs/PRIVACY.md',
  'docs/TERMS.md',
  'docs/DPA.md',
  'docs/SUPPORT.md',
  'docs/UI_CONSTITUTION.md'
];

// Helper to copy file
function copyFile(relPath) {
  const src = path.join(SOURCE_ROOT, relPath);
  const dest = path.join(TARGET_ROOT, relPath);
  if (!fs.existsSync(src)) {
    console.warn(`[WARN] Source file not found: ${relPath}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// Helper to copy directory recursively
function copyDir(relDir) {
  const srcDir = path.join(SOURCE_ROOT, relDir);
  const destDir = path.join(TARGET_ROOT, relDir);
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryRel = path.join(relDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__pycache__' || entry.name === 'dist' || entry.name === 'node_modules') continue;
      copyDir(entryRel);
    } else {
      if (entry.name.endsWith('.pyc') || entry.name === 'bun.lock') continue;
      copyFile(entryRel);
    }
  }
}

// Copy directories and files
console.log('Copying public directories...');
for (const dir of publicDirs) {
  copyDir(dir);
}

console.log('Copying standalone public files...');
for (const file of publicFiles) {
  copyFile(file);
}

console.log('Copying public tests...');
copyDir('tests');

// 3. Sanitization Transforms
console.log('\nApplying sanitization transforms to target files...');

function sanitizeFile(relPath, transforms) {
  const fullPath = path.join(TARGET_ROOT, relPath);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf8');
  for (const [find, replace] of transforms) {
    content = content.replaceAll(find, replace);
  }
  fs.writeFileSync(fullPath, content, 'utf8');
}

// Sanitize web/.env.example
sanitizeFile('web/.env.example', [
  ['VITE_SUPABASE_URL=http://localhost:54321', 'VITE_SUPABASE_URL=http://127.0.0.1:54321'],
  ['API_KEY="MY_GEMINI_API_KEY"', 'API_KEY="your-gemini-api-key"'],
]);

// Sanitize web/src/app/LoginPage.tsx fallback client ID
sanitizeFile('web/src/app/LoginPage.tsx', [
  ['901212915429-starq-erp-web.apps.googleusercontent.com', 'demo-client-id.apps.googleusercontent.com'],
]);

// Sanitize web/vite.config.ts proxy
sanitizeFile('web/vite.config.ts', [
  ['https://wthabguvueewgtabjsdo.supabase.co/functions/v1/starq-api', 'http://127.0.0.1:54321/functions/v1/starq-api'],
]);

// Sanitize supabase/config.toml
sanitizeFile('supabase/config.toml', [
  ['project_id = "wthabguvueewgtabjsdo"', 'project_id = "demo-starq-erp"'],
]);

// Sanitize contracts/tenant_import_pipeline.ts sample emails
sanitizeFile('contracts/tenant_import_pipeline.ts', [
  ['rauf.ahmed@outlook.com', 'demo.customer1@example.com'],
  ['shaan.ib@gmail.com', 'demo.customer2@example.com'],
  ['contact@hoadhaa.mv', 'info@example.com'],
]);

// Sanitize tests/contract/commands_test.ts passwords
sanitizeFile('tests/contract/commands_test.ts', [
  ['SuperSecretPassword123!', 'DemoSyntheticTestPassword123!'],
]);

// Sanitize tests/check_reality_mutation.test.mjs client IDs
sanitizeFile('tests/check_reality_mutation.test.mjs', [
  ['901212915429-l7i347so1avnr0dnaq50hfi91fm0d0o4.apps.googleusercontent.com', 'demo-mock-client-id.apps.googleusercontent.com'],
]);

console.log('Sanitization complete.');
