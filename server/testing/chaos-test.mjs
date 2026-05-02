import {
  expectJson,
  request,
  startManagedRuntime,
  writeJsonReport,
} from './beta-utils.mjs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const runtime = await startManagedRuntime({
    baseUrl: process.env.BETA_API_URL,
    spawnRuntime: !process.env.BETA_API_URL,
    port: process.env.BETA_TEST_PORT ?? 8822,
  });
  const results = [];

  try {
    const malformed = await request(runtime.baseUrl, '/api/telegram/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{broken',
    });
    results.push({
      name: 'malformed-json',
      passed: malformed.status >= 400,
      status: malformed.status,
    });

    await expectJson(runtime.baseUrl, '/api/bridge/config', {
      method: 'POST',
      body: {
        webhookUrl: 'http://127.0.0.1:9/unreachable',
        transportMode: 'webhook',
        requestTimeoutMs: 1000,
      },
    });
    const bridgeStart = await expectJson(runtime.baseUrl, '/api/bridge/start', {
      method: 'POST',
      body: {
        initialMessage: 'beta chaos start',
      },
    });
    results.push({
      name: 'bridge-fallback',
      passed: bridgeStart.json.result?.delivery?.delivered === false,
      delivery: bridgeStart.json.result?.delivery ?? null,
    });

    const healthAfterBridge = await expectJson(runtime.baseUrl, '/api/health');
    results.push({
      name: 'health-after-bridge-failure',
      passed: healthAfterBridge.json.status === 'healthy',
      status: healthAfterBridge.json.status,
    });

    const telegramSend = await request(runtime.baseUrl, '/api/telegram/send', {
      method: 'POST',
      body: {
        chatId: '',
        text: '',
      },
    });
    results.push({
      name: 'telegram-validation',
      passed: telegramSend.status === 400,
      status: telegramSend.status,
      body: telegramSend.json ?? telegramSend.text,
    });

    const runtimeStatus = await expectJson(
      runtime.baseUrl,
      '/api/runtime/status'
    );
    results.push({
      name: 'supervisor-still-healthy',
      passed: runtimeStatus.json.supervisor?.overall === 'healthy',
      overall: runtimeStatus.json.supervisor?.overall,
    });

    const payload = {
      kind: 'pantheon-chaos-test',
      createdAt: new Date().toISOString(),
      baseUrl: runtime.baseUrl,
      results,
      summary: {
        total: results.length,
        passed: results.filter((entry) => entry.passed).length,
        failed: results.filter((entry) => !entry.passed).length,
      },
    };
    const reportFile = await writeJsonReport(
      `beta-chaos-${runtime.tag}.json`,
      payload
    );
    console.log(
      JSON.stringify({ summary: payload.summary, reportFile }, null, 2)
    );
    assert(payload.summary.failed === 0, 'One or more chaos checks failed');
  } finally {
    await runtime.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
