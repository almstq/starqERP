const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const WEB_SRC = path.resolve('d:/StarqTech/starqERP/web/src');
function readRepoFile(filePath) {
  const resolved = path.resolve(filePath);
  if (resolved !== WEB_SRC && !resolved.startsWith(`${WEB_SRC}${path.sep}`)) {
    throw new Error(`refusing to read outside web/src: ${resolved}`);
  }
  return fs.readFileSync(resolved, 'utf8');
}

const allFiles = getFiles(WEB_SRC);
console.log('Total files under web/src:', allFiles.length);

const imports = new Set();
allFiles.forEach(f => {
  const content = readRepoFile(f);
  const regex = /from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(f), importPath);
      imports.add(resolved.toLowerCase());
      imports.add((resolved + '.ts').toLowerCase());
      imports.add((resolved + '.tsx').toLowerCase());
      imports.add(path.join(resolved, 'index.ts').toLowerCase());
      imports.add(path.join(resolved, 'index.tsx').toLowerCase());
    }
  }
});

const unreferenced = [];
allFiles.forEach(f => {
  const base = path.basename(f);
  if (base === 'main.tsx' || base === 'index.html' || f.includes('test') || f.includes('vite-env.d.ts')) return;
  const fLower = f.toLowerCase();
  const fWithoutExt = fLower.replace(/\.tsx?$/, '');
  const isImported = imports.has(fLower) || imports.has(fWithoutExt);
  if (!isImported) {
    unreferenced.push(f);
  }
});

console.log('Unreferenced files count:', unreferenced.length);
unreferenced.forEach(u => console.log(' -', u));
