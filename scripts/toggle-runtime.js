#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

function printHelp() {
  console.log(`\nToggle Next.js API route runtime between edge and node.\n\n` +
    `Usage:\n  node scripts/toggle-runtime.js <edge|node> [--dry] [--backup]\n\n` +
    `Options:\n  --dry     Preview files that would change without writing\n  --backup  Persist a backup snapshot under .runtime-backups/\n  --help    Show this message\n`);
}

if (args.includes('--help') || args.length === 0) {
  printHelp();
  process.exit(args.length === 0 ? 1 : 0);
}

const modeArg = args.find(arg => !arg.startsWith('-'));
if (!modeArg || !['edge', 'node'].includes(modeArg)) {
  console.error('Invalid or missing mode. Expected "edge" or "node".');
  printHelp();
  process.exit(1);
}

const desired = modeArg === 'edge' ? 'edge' : 'nodejs';
const isDryRun = args.includes('--dry');
const shouldBackup = args.includes('--backup');

const targetDir = path.resolve(process.cwd(), 'src/app/api');

function listRouteFiles(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const nextPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...listRouteFiles(nextPath));
      } else if (entry.isFile() && /route\.ts$/.test(entry.name)) {
        files.push(nextPath);
      }
    }
    return files;
  } catch (err) {
    console.error(`Failed to read directory ${dir}:`, err.message);
    process.exit(1);
  }
}

const files = listRouteFiles(targetDir);

if (files.length === 0) {
  console.warn('No route files found under src/app/api.');
  process.exit(0);
}

let backupPath = null;
if (shouldBackup) {
  const backupDir = path.resolve(process.cwd(), '.runtime-backups');
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = path.join(backupDir, `runtime-backup-${timestamp}.json`);
    const snapshot = files.map(file => ({
      file: path.relative(process.cwd(), file),
      content: fs.readFileSync(file, 'utf-8'),
    }));
    fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2));
    console.log(`Backup saved to ${path.relative(process.cwd(), backupPath)}`);
  } catch (err) {
    console.error('Failed to create backup:', err.message);
    process.exit(1);
  }
}

let changed = 0;
for (const file of files) {
  try {
    const src = fs.readFileSync(file, 'utf-8');
    const match = src.match(/export\s+const\s+runtime\s*=\s*["'](edge|nodejs)["']\s*;/);

    if (!match) {
      continue;
    }

    const current = match[1];
    if (current === desired) {
      continue;
    }

    const replacement = `export const runtime = "${desired}";`;
    const next = src.replace(match[0], replacement);

    if (isDryRun) {
      console.log(`[DRY] Would update: ${path.relative(process.cwd(), file)}`);
    } else {
      fs.writeFileSync(file, next);
      console.log(`Updated runtime -> ${desired}: ${path.relative(process.cwd(), file)}`);
    }
    changed++;
  } catch (err) {
    console.error(`Failed to process ${file}:`, err.message);
  }
}

if (changed === 0) {
  console.log(isDryRun ? 'Dry run complete. No changes required.' : 'No files needed changes.');
} else if (!isDryRun) {
  console.log(`Runtime set to ${desired} in ${changed} file(s).`);
} else {
  console.log(`Dry run complete. ${changed} file(s) would change.`);
}

if (!isDryRun && backupPath && changed === 0) {
  // No changes were needed; remove the unused backup to avoid clutter.
  try {
    fs.unlinkSync(backupPath);
  } catch {
    // Swallow errors silently.
  }
}
