import { execFile, spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.join(__dirname, '..', '..');
const reportsRoot = path.join(__dirname, 'data', 'beta-reports');

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mean(values) {
  if (!values.length) {
    return 0;
  }

  return Number(
    (
      values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length
    ).toFixed(2)
  );
}

export function createBetaTag() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function ensureReportsRoot() {
  await mkdir(reportsRoot, { recursive: true });
  return reportsRoot;
}

export async function writeReportFile(fileName, content) {
  await ensureReportsRoot();
  const filePath = path.join(reportsRoot, fileName);
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

export async function writeJsonReport(fileName, payload) {
  return writeReportFile(fileName, `${JSON.stringify(payload, null, 2)}\n`);
}

export async function request(baseUrl, pathname, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  let body = options.body;

  if (
    body &&
    typeof body === 'object' &&
    !(body instanceof Uint8Array) &&
    !headers['Content-Type']
  ) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  });
  const durationMs = Date.now() - startedAt;
  const text = await response.text();
  let json = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    durationMs,
    text,
    json,
  };
}

export async function expectJson(baseUrl, pathname, options = {}) {
  const result = await request(baseUrl, pathname, options);

  if (!result.ok) {
    throw new Error(`${pathname} returned ${result.status}: ${result.text}`);
  }

  if (!result.json) {
    throw new Error(`${pathname} did not return JSON.`);
  }

  return result;
}

export async function waitForHealthy(baseUrl, timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const health = await expectJson(baseUrl, '/api/health');

      if (health.json.status === 'healthy') {
        return health.json;
      }

      lastError = new Error(`health status=${health.json.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  throw (
    lastError ?? new Error(`Timed out waiting for ${baseUrl} health check.`)
  );
}

export async function withMeasuredCase(report, category, name, runner) {
  const startedAt = Date.now();

  try {
    const details = await runner();
    const entry = {
      category,
      name,
      passed: true,
      durationMs: Date.now() - startedAt,
      details: details ?? null,
    };
    report.cases.push(entry);
    return entry;
  } catch (error) {
    const entry = {
      category,
      name,
      passed: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown beta test error',
    };
    report.cases.push(entry);
    return entry;
  }
}

function createRuntimeEnv(port, tag) {
  return {
    ...process.env,
    AGENT_SERVER_PORT: String(port),
    LEARNING_LEDGER_PATH: `/tmp/dots2-beta-ledger-${tag}.json`,
    PANTHEON_TEST_SUITE_PATH: `/tmp/dots2-beta-tests-${tag}.json`,
    ATMAN_WEIGHTS_PATH: `/tmp/dots2-beta-atman-weights-${tag}.json`,
    ATMAN_HISTORY_PATH: `/tmp/dots2-beta-atman-history-${tag}.json`,
    ATMAN_EXAMPLES_PATH: `/tmp/dots2-beta-atman-examples-${tag}.json`,
    ATMAN_LOG_PATH: `/tmp/dots2-beta-atman-log-${tag}.json`,
  };
}

export async function startManagedRuntime(options = {}) {
  const tag = options.tag ?? createBetaTag();
  const port = Number(options.port ?? process.env.BETA_TEST_PORT ?? 8820);
  const baseUrl = options.baseUrl ?? `http://127.0.0.1:${port}`;

  if (options.spawnRuntime === false || process.env.BETA_API_URL) {
    await waitForHealthy(
      options.baseUrl ?? process.env.BETA_API_URL ?? baseUrl
    );
    return {
      baseUrl: options.baseUrl ?? process.env.BETA_API_URL ?? baseUrl,
      stop: async () => {},
      logFilePath: null,
      port,
      tag,
    };
  }

  await ensureReportsRoot();
  const logFilePath = path.join(reportsRoot, `runtime-${tag}.log`);
  const child = spawn(process.execPath, ['server/agent-runtime.mjs'], {
    cwd: workspaceRoot,
    env: createRuntimeEnv(port, tag),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', async (chunk) => {
    await writeFile(logFilePath, chunk, { flag: 'a' });
  });
  child.stderr.on('data', async (chunk) => {
    await writeFile(logFilePath, chunk, { flag: 'a' });
  });

  await waitForHealthy(baseUrl);

  return {
    baseUrl,
    port,
    tag,
    pid: child.pid,
    logFilePath,
    stop: async () => {
      if (child.exitCode !== null) {
        return;
      }

      child.kill('SIGTERM');

      const deadline = Date.now() + 5000;

      while (child.exitCode === null && Date.now() < deadline) {
        await sleep(100);
      }

      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    },
  };
}

export function summarizeCases(cases) {
  const passed = cases.filter((entry) => entry.passed).length;
  const failed = cases.length - passed;
  return {
    total: cases.length,
    passed,
    failed,
    passRate: cases.length > 0 ? Number((passed / cases.length).toFixed(2)) : 1,
    averageDurationMs: mean(cases.map((entry) => entry.durationMs)),
  };
}

export function execFileAsync(file, args = []) {
  return new Promise((resolve, reject) => {
    execFile(file, args, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

export async function readProcessStats(pid) {
  if (!pid) {
    return null;
  }

  try {
    const { stdout } = await execFileAsync('ps', [
      '-o',
      'pid=,rss=,%cpu=',
      '-p',
      String(pid),
    ]);
    const [line] = String(stdout).trim().split('\n').filter(Boolean);

    if (!line) {
      return null;
    }

    const [processId, rssKb, cpuPercent] = line.trim().split(/\s+/);
    return {
      pid: Number(processId),
      rssKb: Number(rssKb),
      cpuPercent: Number(cpuPercent),
    };
  } catch {
    return null;
  }
}

export async function collectRuntimeSnapshot(baseUrl, pid = null) {
  const [health, runtimeStatus, inspectorMetrics, processStats] =
    await Promise.all([
      expectJson(baseUrl, '/api/health'),
      expectJson(baseUrl, '/api/runtime/status'),
      expectJson(baseUrl, '/api/inspector/metrics'),
      readProcessStats(pid),
    ]);

  return {
    collectedAt: new Date().toISOString(),
    health: health.json,
    runtimeStatus: runtimeStatus.json,
    inspectorMetrics: inspectorMetrics.json,
    process: processStats,
  };
}
