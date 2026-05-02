import {
  collectRuntimeSnapshot,
  expectJson,
  mean,
  sleep,
  startManagedRuntime,
  writeJsonReport,
} from './beta-utils.mjs';

const durationMinutes = Math.max(
  1,
  Number(process.env.BETA_SOAK_DURATION_MINUTES ?? 5)
);
const intervalMs = Math.max(
  15000,
  Number(process.env.BETA_SOAK_INTERVAL_MS ?? 60000)
);
const scriptedTurns = Math.max(
  1,
  Number(process.env.BETA_SOAK_SCRIPTED_TURNS ?? 4)
);

function buildMessages(cycle) {
  return [
    {
      endpoint: '/api/atman/chat',
      body: {
        message: `Soak cycle ${cycle}: кто ты и что сейчас помнишь?`,
        userId: 'beta-soak-user',
        personalityId: 'default',
        history: [],
      },
      kind: 'text',
    },
    {
      endpoint: '/api/atman/personality-chat',
      body: {
        message: `Soak cycle ${cycle}: чем тебе интересен мир?`,
        userId: 'beta-soak-user',
        personalityId: 'ember-jester',
        history: [],
      },
      kind: 'personality-text',
    },
    {
      endpoint: '/api/atman/media/tts',
      body: {
        personalityId: 'default',
        text: `Soak cycle ${cycle}: тест голоса`,
      },
      kind: 'tts',
    },
    {
      endpoint: '/api/atman/self-learn',
      body: {
        personalityId: cycle % 2 === 0 ? 'default' : 'lumen-spark',
        topic: cycle % 2 === 0 ? 'океан' : 'мир',
        rollouts: 2,
        trigger: `beta-soak-${cycle}`,
      },
      kind: 'self-learn',
    },
  ].slice(0, scriptedTurns);
}

async function main() {
  const runtime = await startManagedRuntime({
    baseUrl: process.env.BETA_API_URL,
    spawnRuntime: !process.env.BETA_API_URL,
    port: process.env.BETA_TEST_PORT ?? 8824,
  });
  const report = {
    kind: 'pantheon-beta-soak-test',
    createdAt: new Date().toISOString(),
    baseUrl: runtime.baseUrl,
    runtime: {
      port: runtime.port,
      tag: runtime.tag,
      logFilePath: runtime.logFilePath,
      pid: runtime.pid ?? null,
    },
    settings: {
      durationMinutes,
      intervalMs,
      scriptedTurns,
    },
    cycles: [],
    snapshots: [],
  };
  const deadline = Date.now() + durationMinutes * 60 * 1000;
  let cycle = 0;

  try {
    while (Date.now() < deadline) {
      cycle += 1;
      const startedAt = Date.now();
      const operations = [];
      const messages = buildMessages(cycle);

      for (const entry of messages) {
        const result = await expectJson(runtime.baseUrl, entry.endpoint, {
          method: 'POST',
          body: entry.body,
        });
        operations.push({
          kind: entry.kind,
          endpoint: entry.endpoint,
          durationMs: result.durationMs,
          status: result.status,
        });
      }

      const snapshot = await collectRuntimeSnapshot(
        runtime.baseUrl,
        runtime.pid
      );
      report.snapshots.push(snapshot);
      report.cycles.push({
        cycle,
        startedAt: new Date(startedAt).toISOString(),
        durationMs: Date.now() - startedAt,
        operations,
        healthStatus: snapshot.health.status,
        supervisorOverall: snapshot.runtimeStatus.supervisor?.overall ?? null,
        rssKb: snapshot.process?.rssKb ?? null,
        cpuPercent: snapshot.process?.cpuPercent ?? null,
      });

      if (Date.now() + intervalMs >= deadline) {
        break;
      }

      await sleep(intervalMs);
    }

    const allOperations = report.cycles.flatMap((entry) => entry.operations);
    report.summary = {
      totalCycles: report.cycles.length,
      totalOperations: allOperations.length,
      averageOperationDurationMs: mean(
        allOperations.map((entry) => entry.durationMs)
      ),
      maxOperationDurationMs: allOperations.length
        ? Math.max(...allOperations.map((entry) => entry.durationMs))
        : 0,
      maxRssKb: Math.max(
        0,
        ...report.cycles.map((entry) => Number(entry.rssKb ?? 0))
      ),
      maxCpuPercent: Math.max(
        0,
        ...report.cycles.map((entry) => Number(entry.cpuPercent ?? 0))
      ),
      unhealthySnapshots: report.snapshots.filter(
        (entry) => entry.health.status !== 'healthy'
      ).length,
      criticalFailuresObserved: report.snapshots.reduce(
        (sum, entry) =>
          sum + Number(entry.runtimeStatus.supervisor?.criticalFailures ?? 0),
        0
      ),
    };

    const reportFile = await writeJsonReport(
      `beta-soak-${runtime.tag}.json`,
      report
    );
    console.log(
      JSON.stringify({ summary: report.summary, reportFile }, null, 2)
    );

    if (report.summary.unhealthySnapshots > 0) {
      process.exitCode = 1;
    }
  } finally {
    await runtime.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
