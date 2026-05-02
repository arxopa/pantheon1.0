const baseUrl = process.env.AGENT_API_URL ?? `http://localhost:${process.env.AGENT_SERVER_PORT ?? 8787}`;

async function main() {
  console.log('Agent server preflight');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`OPENAI_API_KEY configured: ${Boolean(process.env.OPENAI_API_KEY)}`);
  console.log(`NIGHT_DISTILLATION_INTERVAL_MS: ${process.env.NIGHT_DISTILLATION_INTERVAL_MS ?? 'default(900000)'}`);
  console.log(`RISHI_CHECKPOINT_INTERVAL_MS: ${process.env.RISHI_CHECKPOINT_INTERVAL_MS ?? 'default(1200000)'}`);
  console.log(`FEEDBACK_PROCESSING_INTERVAL_MS: ${process.env.FEEDBACK_PROCESSING_INTERVAL_MS ?? 'default(180000)'}`);
  console.log(`FEEDBACK_APPLICATION_INTERVAL_MS: ${process.env.FEEDBACK_APPLICATION_INTERVAL_MS ?? 'default(240000)'}`);
  console.log(`FEEDBACK_AUTO_APPLY_BATCH_SIZE: ${process.env.FEEDBACK_AUTO_APPLY_BATCH_SIZE ?? 'default(5)'}`);
  console.log(`PANTHEON_WEB_SCOUT_ENABLED: ${process.env.PANTHEON_WEB_SCOUT_ENABLED ?? 'default(true)'}`);
  console.log(`PANTHEON_NAVIGATION_ALLOWLIST: ${process.env.PANTHEON_NAVIGATION_ALLOWLIST ?? 'default(localhost,127.0.0.1,duckduckgo.com,html.duckduckgo.com)'}`);
  console.log(`PANTHEON_NAVIGATION_MAX_STEPS: ${process.env.PANTHEON_NAVIGATION_MAX_STEPS ?? 'default(3)'}`);
  console.log(`PANTHEON_NAVIGATION_MIN_DELAY_MS: ${process.env.PANTHEON_NAVIGATION_MIN_DELAY_MS ?? 'default(350)'}`);
  console.log(`PANTHEON_NAVIGATION_MAX_DELAY_MS: ${process.env.PANTHEON_NAVIGATION_MAX_DELAY_MS ?? 'default(1200)'}`);
  console.log(`PANTHEON_NAVIGATION_TIMEOUT_MS: ${process.env.PANTHEON_NAVIGATION_TIMEOUT_MS ?? 'default(7000)'}`);
  console.log(`PANTHEON_FACT_TTL_MS: ${process.env.PANTHEON_FACT_TTL_MS ?? 'default(86400000)'}`);
  console.log(`PANTHEON_FACT_MIN_SCORE: ${process.env.PANTHEON_FACT_MIN_SCORE ?? 'default(0.65)'}`);
  console.log(`RESONANCE_CHECK_INTERVAL_MS: ${process.env.RESONANCE_CHECK_INTERVAL_MS ?? 'default(600000)'}`);
  console.log(`RESONANCE_LOW_THRESHOLD: ${process.env.RESONANCE_LOW_THRESHOLD ?? 'default(0.3)'}`);
  console.log(`RESONANCE_RECOVERY_THRESHOLD: ${process.env.RESONANCE_RECOVERY_THRESHOLD ?? 'default(0.7)'}`);
  console.log(`RESONANCE_LOOKBACK_MINUTES: ${process.env.RESONANCE_LOOKBACK_MINUTES ?? 'default(60)'}`);
  console.log(`RESONANCE_MIN_FEEDBACK_SAMPLES: ${process.env.RESONANCE_MIN_FEEDBACK_SAMPLES ?? 'default(5)'}`);
  console.log(`RESONANCE_PAUSE_DURATION_MS: ${process.env.RESONANCE_PAUSE_DURATION_MS ?? 'default(1800000)'}`);
  console.log(`PANTHEON_TEST_SUITE_PATH: ${process.env.PANTHEON_TEST_SUITE_PATH ?? 'default(server/testing/data/test-suite.json)'}`);
  console.log(`PANTHEON_TEST_SUITE_ACCURACY_THRESHOLD: ${process.env.PANTHEON_TEST_SUITE_ACCURACY_THRESHOLD ?? 'default(0.7)'}`);
  console.log(`PANTHEON_TEST_SUITE_INTERVAL_MS: ${process.env.PANTHEON_TEST_SUITE_INTERVAL_MS ?? 'default(86400000)'}`);
  console.log(`ATMAN_OLLAMA_URL: ${process.env.ATMAN_OLLAMA_URL ?? 'default(http://127.0.0.1:11434/api/generate)'}`);
  console.log(`ATMAN_OLLAMA_MODEL: ${process.env.ATMAN_OLLAMA_MODEL ?? 'not configured'}`);

  const endpoints = ['/api/learning/state', '/api/rishi/state'];

  for (const endpoint of endpoints) {
    const response = await fetch(`${baseUrl}${endpoint}`);

    if (!response.ok) {
      throw new Error(`${endpoint} returned ${response.status}`);
    }

    console.log(`${endpoint}: ok`);
  }

  const resonanceStateResponse = await fetch(`${baseUrl}/api/resonance/state`);

  if (!resonanceStateResponse.ok) {
    throw new Error(`/api/resonance/state returned ${resonanceStateResponse.status}`);
  }

  console.log('/api/resonance/state: ok');

  const feedbackLoopResponse = await fetch(`${baseUrl}/api/feedback/process`, {
    method: 'POST',
  });

  if (!feedbackLoopResponse.ok) {
    throw new Error(`/api/feedback/process returned ${feedbackLoopResponse.status}`);
  }

  console.log('/api/feedback/process: ok');

  const feedbackApplyResponse = await fetch(`${baseUrl}/api/feedback/apply`, {
    method: 'POST',
  });

  if (!feedbackApplyResponse.ok) {
    throw new Error(`/api/feedback/apply returned ${feedbackApplyResponse.status}`);
  }

  console.log('/api/feedback/apply: ok');

  const researchResponse = await fetch(`${baseUrl}/api/research/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      taskId: 'preflight-research',
      query: 'Pantheon local server state',
      urls: [`${baseUrl}/api/learning/state`],
    }),
  });

  if (!researchResponse.ok) {
    throw new Error(`/api/research/run returned ${researchResponse.status}`);
  }

  console.log('/api/research/run: ok');

  const validationResponse = await fetch(`${baseUrl}/api/validation/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      taskId: 'preflight-validation',
      message: 'Проверь локальное состояние сервера.',
      reply: 'Локальное состояние сервера подтверждено через Pantheon Web Scout.',
    }),
  });

  if (!validationResponse.ok) {
    throw new Error(`/api/validation/run returned ${validationResponse.status}`);
  }

  console.log('/api/validation/run: ok');

  const factStoreResponse = await fetch(`${baseUrl}/api/facts/store`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: 'preflight fact',
      value: 'Столица Франции — Париж.',
      score: 0.92,
      source: 'preflight',
    }),
  });

  if (!factStoreResponse.ok) {
    throw new Error(`/api/facts/store returned ${factStoreResponse.status}`);
  }

  console.log('/api/facts/store: ok');

  const factRecallResponse = await fetch(`${baseUrl}/api/facts/recall`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      keywords: ['франции', 'париж'],
      limit: 2,
      minScore: 0.6,
    }),
  });

  if (!factRecallResponse.ok) {
    throw new Error(`/api/facts/recall returned ${factRecallResponse.status}`);
  }

  console.log('/api/facts/recall: ok');

  const navigationResponse = await fetch(`${baseUrl}/api/navigation/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      taskId: 'preflight-navigation',
      goal: 'Inspect local ledger endpoint',
      urls: [`${baseUrl}/api/learning/state`],
    }),
  });

  if (!navigationResponse.ok) {
    throw new Error(`/api/navigation/run returned ${navigationResponse.status}`);
  }

  console.log('/api/navigation/run: ok');

  const resonanceCheckResponse = await fetch(`${baseUrl}/api/resonance/check`, {
    method: 'POST',
  });

  if (!resonanceCheckResponse.ok) {
    throw new Error(`/api/resonance/check returned ${resonanceCheckResponse.status}`);
  }

  console.log('/api/resonance/check: ok');

  const testStateResponse = await fetch(`${baseUrl}/api/tests/state`);

  if (!testStateResponse.ok) {
    throw new Error(`/api/tests/state returned ${testStateResponse.status}`);
  }

  console.log('/api/tests/state: ok');

  const netSurferStatusResponse = await fetch(`${baseUrl}/api/netsurfer/status`);

  if (!netSurferStatusResponse.ok) {
    throw new Error(`/api/netsurfer/status returned ${netSurferStatusResponse.status}`);
  }

  console.log('/api/netsurfer/status: ok');

  const atmanStatusResponse = await fetch(`${baseUrl}/api/atman/status`);

  if (!atmanStatusResponse.ok) {
    throw new Error(`/api/atman/status returned ${atmanStatusResponse.status}`);
  }

  console.log('/api/atman/status: ok');

  const atmanWeightsResponse = await fetch(`${baseUrl}/api/atman/weights`);

  if (!atmanWeightsResponse.ok) {
    throw new Error(`/api/atman/weights returned ${atmanWeightsResponse.status}`);
  }

  console.log('/api/atman/weights: ok');

  const atmanExamplesResponse = await fetch(`${baseUrl}/api/atman/examples`);

  if (!atmanExamplesResponse.ok) {
    throw new Error(`/api/atman/examples returned ${atmanExamplesResponse.status}`);
  }

  console.log('/api/atman/examples: ok');

  const atmanLogsResponse = await fetch(`${baseUrl}/api/atman/logs`);

  if (!atmanLogsResponse.ok) {
    throw new Error(`/api/atman/logs returned ${atmanLogsResponse.status}`);
  }

  console.log('/api/atman/logs: ok');

  const interestsStatusResponse = await fetch(`${baseUrl}/api/interests/status`);

  if (!interestsStatusResponse.ok) {
    throw new Error(`/api/interests/status returned ${interestsStatusResponse.status}`);
  }

  console.log('/api/interests/status: ok');

  const interestsLogsResponse = await fetch(`${baseUrl}/api/interests/logs`);

  if (!interestsLogsResponse.ok) {
    throw new Error(`/api/interests/logs returned ${interestsLogsResponse.status}`);
  }

  console.log('/api/interests/logs: ok');

  const interestsAutomationResponse = await fetch(`${baseUrl}/api/interests/automation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      enabled: true,
    }),
  });

  if (!interestsAutomationResponse.ok) {
    throw new Error(`/api/interests/automation returned ${interestsAutomationResponse.status}`);
  }

  console.log('/api/interests/automation: ok');

  const bridgeStatusResponse = await fetch(`${baseUrl}/api/bridge/status`);

  if (!bridgeStatusResponse.ok) {
    throw new Error(`/api/bridge/status returned ${bridgeStatusResponse.status}`);
  }

  console.log('/api/bridge/status: ok');

  const chatPageResponse = await fetch(`${baseUrl}/chat.html`);

  if (!chatPageResponse.ok) {
    throw new Error(`/chat.html returned ${chatPageResponse.status}`);
  }

  console.log('/chat.html: ok');

  const adminPageResponse = await fetch(`${baseUrl}/admin.html`);

  if (!adminPageResponse.ok) {
    throw new Error(`/admin.html returned ${adminPageResponse.status}`);
  }

  console.log('/admin.html: ok');

  const inspectorStatusResponse = await fetch(`${baseUrl}/api/inspector/status`);

  if (!inspectorStatusResponse.ok) {
    throw new Error(`/api/inspector/status returned ${inspectorStatusResponse.status}`);
  }

  console.log('/api/inspector/status: ok');

  const inspectorMetricsResponse = await fetch(`${baseUrl}/api/inspector/metrics`);

  if (!inspectorMetricsResponse.ok) {
    throw new Error(`/api/inspector/metrics returned ${inspectorMetricsResponse.status}`);
  }

  console.log('/api/inspector/metrics: ok');

  const inspectorModuleTargetsResponse = await fetch(`${baseUrl}/api/inspector/module-targets`);

  if (!inspectorModuleTargetsResponse.ok) {
    throw new Error(`/api/inspector/module-targets returned ${inspectorModuleTargetsResponse.status}`);
  }

  console.log('/api/inspector/module-targets: ok');

  console.log('Preflight passed. Continue with: npm run smoke:agent-server');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});