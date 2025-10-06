#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const modeArg = process.argv[2];
if (!modeArg || !['edge', 'node'].includes(modeArg)) {
  console.error('Usage: node scripts/toggle-runtime.js <edge|node>');
  process.exit(1);
}
const desired = modeArg === 'edge' ? 'edge' : 'nodejs';

const targetDir = path.resolve(process.cwd(), 'src/app/api');

function listRouteFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...listRouteFiles(p));
    } else if (e.isFile() && /route\.ts$/.test(e.name)) {
      files.push(p);
    }
  }
  return files;
}

const files = listRouteFiles(targetDir);
let changed = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf-8');
  const next = src.replace(/export\s+const\s+runtime\s*=\s*["'](?:edge|nodejs)["']\s*;/g, `export const runtime = "${desired}";`);
  if (next !== src) {
    fs.writeFileSync(file, next);
    changed++;
    console.log(`Updated runtime -> ${desired}: ${path.relative(process.cwd(), file)}`);
  }
}

if (changed === 0) {
  console.log('No files needed changes.');
} else {
  console.log(`Runtime set to ${desired} in ${changed} file(s).`);
}
