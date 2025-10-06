#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const toggleScript = path.resolve(__dirname, 'toggle-runtime.js');

function runToggle(mode) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [toggleScript, mode], {
      cwd: repoRoot,
      stdio: 'inherit',
    });

    proc.on('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`toggle-runtime ${mode} exited with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

async function main() {
  try {
    await runToggle('node');
  } catch (err) {
    console.error('Failed to switch runtime to Node.js:', err);
    process.exit(1);
  }

  const devCommand = 'if [ -f .env.local ]; then set -a; source .env.local; set +a; fi; CHOKIDAR_USEPOLLING=true next dev';

  const child = spawn('bash', ['-lc', devCommand], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
    },
  });

  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      await runToggle('edge');
    } catch (err) {
      console.error('Failed to reset runtime to edge:', err);
    }
  };

  const forwardSignal = signal => {
    if (child.killed) {
      return;
    }
    try {
      child.kill(signal);
    } catch (err) {
      if (err && err.code !== 'ESRCH') {
        console.error(`Failed to forward ${signal} to dev process:`, err);
      }
    }
  };

  ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(signal => {
    process.on(signal, () => {
      forwardSignal(signal);
    });
  });

  process.on('uncaughtException', async err => {
    console.error('Uncaught exception:', err);
    forwardSignal('SIGTERM');
    await cleanup();
    process.exit(1);
  });

  process.on('unhandledRejection', async reason => {
    console.error('Unhandled rejection:', reason);
    forwardSignal('SIGTERM');
    await cleanup();
    process.exit(1);
  });

  child.on('error', err => {
    console.error('Failed to start Next dev server:', err);
    cleanup().finally(() => process.exit(1));
  });

  child.on('exit', code => {
    cleanup().finally(() => {
      process.exit(code ?? 0);
    });
  });
}

main();
