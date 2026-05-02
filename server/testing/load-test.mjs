import {
  expectJson,
  mean,
  startManagedRuntime,
  writeJsonReport,
} from './beta-utils.mjs';

const concurrency = Math.max(1, Number(process.env.BETA_LOAD_CONCURRENCY ?? 6));
const rounds = Math.max(1, Number(process.env.BETA_LOAD_ROUNDS ?? 4));
const personalities = [
  'default',
  'ember-jester',
  'lumen-spark',
  'stoic-sentinel',
  'tide-dreamer',
];

async function main() {
  const runtime = await startManagedRuntime({
    baseUrl: process.env.BETA_API_URL,
    spawnRuntime: !process.env.BETA_API_URL,
    port: process.env.BETA_TEST_PORT ?? 8821,
  });

  try {
    const results = [];

    for (let round = 0; round < rounds; round += 1) {
      const batch = Array.from({ length: concurrency }, async (_, index) => {
        const personalityId =
          personalities[(round + index) % personalities.length];
        const result = await expectJson(
          runtime.baseUrl,
          '/api/atman/personality-chat',
          {
            method: 'POST',
            body: {
              message: `Бета-нагрузка round=${round} slot=${index}: расскажи кратко, что тебе сейчас интересно.`,
              userId: `beta-load-${index}`,
              personalityId,
              history: [],
            },
          }
        );

        return {
          round,
          slot: index,
          personalityId,
          durationMs: result.durationMs,
          sessionKey: result.json.sessionKey,
          responseLength: String(result.json.response ?? '').length,
        };
      });

      results.push(...(await Promise.all(batch)));
    }

    const summary = {
      concurrency,
      rounds,
      totalRequests: results.length,
      averageDurationMs: mean(results.map((entry) => entry.durationMs)),
      maxDurationMs: Math.max(...results.map((entry) => entry.durationMs)),
      overFiveSeconds: results.filter((entry) => entry.durationMs > 5000)
        .length,
    };
    const payload = {
      kind: 'pantheon-beta-load-test',
      createdAt: new Date().toISOString(),
      baseUrl: runtime.baseUrl,
      summary,
      results,
    };
    const reportFile = await writeJsonReport(
      `beta-load-${runtime.tag}.json`,
      payload
    );
    console.log(JSON.stringify({ summary, reportFile }, null, 2));

    if (summary.overFiveSeconds > 0) {
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
