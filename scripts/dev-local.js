#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(repoRoot, '.env.local'), override: false });
} catch (err) {
  // dotenv is optional; ignore if not installed
}
const toggleScript = path.resolve(__dirname, 'toggle-runtime.js');

const DEFAULT_PROXY_PORT = '8787';

function startProxyIfNeeded() {
  const shouldStart = process.env.START_AI_PROXY !== '0';
  if (!shouldStart) {
    return Promise.resolve(null);
  }

  if (!process.env.LONGCAT_KEY) {
    console.warn('[dev-local] START_AI_PROXY enabled but LONGCAT_KEY is missing. Skipping proxy startup.');
    return Promise.resolve(null);
  }

  const port = process.env.AI_PROXY_PORT || DEFAULT_PROXY_PORT;
  const env = {
    ...process.env,
    PORT: port,
    HOST: process.env.AI_PROXY_HOST || '127.0.0.1',
  };

  return new Promise((resolve, reject) => {
    const proxy = spawn(process.execPath, [path.resolve(__dirname, 'ai-server.js')], {
      cwd: repoRoot,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let resolved = false;

    const handleReady = (data) => {
      const text = data.toString();
      process.stdout.write(`[ai-proxy] ${text}`);
      if (!resolved && /MoE Proxy is running on/.test(text)) {
        resolved = true;
        resolve({ process: proxy, port });
      }
    };

    proxy.stdout.on('data', handleReady);
    proxy.stderr.on('data', data => {
      process.stderr.write(`[ai-proxy] ${data}`);
    });

    proxy.on('error', err => {
      if (!resolved) {
        reject(err);
      } else {
        console.error('[ai-proxy] Error:', err);
      }
    });

    proxy.on('exit', code => {
      if (!resolved) {
        reject(new Error(`AI proxy exited before startup (code ${code ?? 'unknown'})`));
      } else {
        console.log(`[ai-proxy] exited with code ${code ?? 0}`);
      }
    });

    // Fallback: if we don't see the ready log within 3 seconds, just continue.
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('[ai-proxy] Continuing without readiness confirmation.');
        resolve({ process: proxy, port });
      }
    }, 3000).unref();
  });
}

function stopProxy(proxyHandle) {
  if (!proxyHandle || !proxyHandle.process) {
    return Promise.resolve();
  }

  const child = proxyHandle.process;
  if (child.killed) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
      resolve();
    }, 3000).unref();

    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill('SIGTERM');
  });
}

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
  let proxyHandle = null;
  try {
    proxyHandle = await startProxyIfNeeded();
  } catch (err) {
    console.error('Failed to start AI proxy:', err);
    process.exit(1);
  }

  try {
    await runToggle('node');
  } catch (err) {
    console.error('Failed to switch runtime to Node.js:', err);
    await stopProxy(proxyHandle);
    process.exit(1);
  }

  const devCommand = 'if [ -f .env.local ]; then set -a; source .env.local; set +a; fi; CHOKIDAR_USEPOLLING=true next dev';

  const envVars = { ...process.env };
  if (proxyHandle) {
    const proxyPort = proxyHandle.port || process.env.AI_PROXY_PORT || DEFAULT_PROXY_PORT;
    if (!envVars.AI_BASE_URL) {
      envVars.AI_BASE_URL = `http://127.0.0.1:${proxyPort}/v1`;
    }
    if (!envVars.AI_API_KEY && envVars.PROXY_TOKEN) {
      envVars.AI_API_KEY = envVars.PROXY_TOKEN;
    }
  }

  const child = spawn('bash', ['-lc', devCommand], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: envVars,
  });

  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    await Promise.all([
      stopProxy(proxyHandle),
      (async () => {
        try {
          await runToggle('edge');
        } catch (err) {
          console.error('Failed to reset runtime to edge:', err);
        }
      })(),
    ]);
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
    if (proxyHandle && proxyHandle.process && !proxyHandle.process.killed) {
      try {
        proxyHandle.process.kill(signal);
      } catch (err) {
        if (err && err.code !== 'ESRCH') {
          console.error(`Failed to forward ${signal} to AI proxy process:`, err);
        }
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
