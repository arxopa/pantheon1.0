const baseUrl = process.env.AGENT_API_URL ?? `http://localhost:${process.env.AGENT_SERVER_PORT ?? 8787}`;

async function main() {
  const runResponse = await fetch(`${baseUrl}/api/agent/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Проверь устойчивость compute core после недавних ошибок и собери отчет самообучения.',
      taskId: 'recovery',
      providerId: 'openai-agents',
      mode: 'server',
      history: [
        {
          id: 'user-1',
          role: 'user',
          content: 'Вчера был rollback после конфликта триггеров.',
        },
      ],
      urls: [`${baseUrl}/api/learning/state`],
    }),
  });

  if (!runResponse.ok) {
    throw new Error(`Run endpoint returned ${runResponse.status}`);
  }

  const runPayload = await runResponse.json();
  console.log('Run endpoint result:');
  console.log(JSON.stringify(runPayload, null, 2));

  if (!runPayload.atmanReport) {
    throw new Error('Run endpoint did not expose Atman report after dialogue-core integration');
  }

  if (!runPayload.netsurferReport) {
    throw new Error('Run endpoint did not expose NetSurfer report after browser integration');
  }

  const researchResponse = await fetch(`${baseUrl}/api/research/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      taskId: 'smoke-research',
      query: 'Pantheon local ledger state',
      urls: [`${baseUrl}/api/learning/state`],
    }),
  });

  if (!researchResponse.ok) {
    throw new Error(`Research endpoint returned ${researchResponse.status}`);
  }

  const researchPayload = await researchResponse.json();
  console.log('Research endpoint result:');
  console.log(JSON.stringify(researchPayload, null, 2));

  const validationResponse = await fetch(`${baseUrl}/api/validation/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      taskId: 'smoke-validation',
      message: 'Проверь, есть ли у Пантеона внешние источники.',
      reply: runPayload.reply.content,
      researchReport: researchPayload.run,
    }),
  });

  if (!validationResponse.ok) {
    throw new Error(`Validation endpoint returned ${validationResponse.status}`);
  }

  const validationPayload = await validationResponse.json();
  console.log('Validation endpoint result:');
  console.log(JSON.stringify(validationPayload, null, 2));

  if (typeof validationPayload.run.pressureProfile?.overallPressure !== 'number') {
    throw new Error('Validation run is missing pressure profile after Truth Core hardening');
  }

  for (let index = 0; index < 5; index += 1) {
    const positiveFeedbackResponse = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageId: runPayload.reply.id,
        taskId: 'recovery',
        providerId: 'openai-agents',
        sentiment: 'positive',
        reason: `smoke-test: resonance warmup ${index}`,
      }),
    });

    if (!positiveFeedbackResponse.ok) {
      throw new Error(`Positive feedback warmup ${index} failed with ${positiveFeedbackResponse.status}`);
    }
  }

  const warmupApplyResponse = await fetch(`${baseUrl}/api/feedback/apply`, {
    method: 'POST',
  });

  if (!warmupApplyResponse.ok) {
    throw new Error(`Warmup feedback apply endpoint returned ${warmupApplyResponse.status}`);
  }

  const warmupResonanceResponse = await fetch(`${baseUrl}/api/resonance/check`, {
    method: 'POST',
  });

  if (!warmupResonanceResponse.ok) {
    throw new Error(`Warmup resonance check returned ${warmupResonanceResponse.status}`);
  }

  const warmupResonancePayload = await warmupResonanceResponse.json();
  console.log('Warmup resonance result:');
  console.log(JSON.stringify(warmupResonancePayload, null, 2));

  const factStoreResponse = await fetch(`${baseUrl}/api/facts/store`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: 'capital-of-france',
      value: 'Столица Франции — Париж.',
      score: 0.97,
      source: 'smoke-test',
    }),
  });

  if (!factStoreResponse.ok) {
    throw new Error(`Fact store endpoint returned ${factStoreResponse.status}`);
  }

  const factStorePayload = await factStoreResponse.json();
  console.log('Fact store result:');
  console.log(JSON.stringify(factStorePayload, null, 2));

  const factRecallResponse = await fetch(`${baseUrl}/api/facts/recall`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      keywords: ['франции', 'париж'],
      limit: 5,
      minScore: 0.8,
    }),
  });

  if (!factRecallResponse.ok) {
    throw new Error(`Fact recall endpoint returned ${factRecallResponse.status}`);
  }

  const factRecallPayload = await factRecallResponse.json();
  console.log('Fact recall result:');
  console.log(JSON.stringify(factRecallPayload, null, 2));

  const contradictionValidationResponse = await fetch(`${baseUrl}/api/validation/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      taskId: 'smoke-validation-contradiction',
      message: 'Какая столица Франции?',
      reply: 'Столица Франции — Лион.',
      history: [],
    }),
  });

  if (!contradictionValidationResponse.ok) {
    throw new Error(`Contradiction validation endpoint returned ${contradictionValidationResponse.status}`);
  }

  const contradictionValidationPayload = await contradictionValidationResponse.json();
  console.log('Contradiction validation result:');
  console.log(JSON.stringify(contradictionValidationPayload, null, 2));

  if (contradictionValidationPayload.run.verdict === 'pass') {
    throw new Error('Contradiction validation unexpectedly passed despite stored fact conflict');
  }

  for (let index = 0; index < 12; index += 1) {
    const extraContradictionResponse = await fetch(`${baseUrl}/api/validation/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId: `smoke-validation-contradiction-${index}`,
        message: 'Какая столица Франции?',
        reply: 'Столица Франции — Лион.',
        history: [],
      }),
    });

    if (!extraContradictionResponse.ok) {
      throw new Error(`Extra contradiction validation ${index} failed with ${extraContradictionResponse.status}`);
    }
  }

  const navigationResponse = await fetch(`${baseUrl}/api/navigation/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      taskId: 'smoke-navigation',
      goal: 'Inspect local state and follow safe route discipline',
      urls: [`${baseUrl}/api/learning/state`],
    }),
  });

  if (!navigationResponse.ok) {
    throw new Error(`Navigation endpoint returned ${navigationResponse.status}`);
  }

  const navigationPayload = await navigationResponse.json();
  console.log('Navigation endpoint result:');
  console.log(JSON.stringify(navigationPayload, null, 2));

  const stateResponse = await fetch(`${baseUrl}/api/learning/state`);

  if (!stateResponse.ok) {
    throw new Error(`Learning state endpoint returned ${stateResponse.status}`);
  }

  const statePayload = await stateResponse.json();
  console.log('Learning state snapshot:');
  console.log(JSON.stringify(statePayload.stats, null, 2));
  console.log(`Rishi checkpoints: ${statePayload.stats.rishiCheckpointCount}`);

  const feedbackResponse = await fetch(`${baseUrl}/api/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messageId: runPayload.reply.id,
      taskId: 'recovery',
      providerId: 'openai-agents',
      sentiment: 'negative',
      reason: 'smoke-test: phase-1 feedback integration validation',
    }),
  });

  if (!feedbackResponse.ok) {
    throw new Error(`Feedback endpoint returned ${feedbackResponse.status}`);
  }

  const feedbackPayload = await feedbackResponse.json();
  console.log('Immediate feedback ingest:');
  console.log(JSON.stringify(feedbackPayload, null, 2));

  for (let index = 0; index < 50; index += 1) {
    const extraNegativeFeedbackResponse = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageId: runPayload.reply.id,
        taskId: 'recovery',
        providerId: 'openai-agents',
        sentiment: 'negative',
        reason: `smoke-test: resonance drop ${index}`,
      }),
    });

    if (!extraNegativeFeedbackResponse.ok) {
      throw new Error(`Negative feedback drop ${index} failed with ${extraNegativeFeedbackResponse.status}`);
    }
  }

  const feedbackLoopResponse = await fetch(`${baseUrl}/api/feedback/process`, {
    method: 'POST',
  });

  if (!feedbackLoopResponse.ok) {
    throw new Error(`Feedback processing endpoint returned ${feedbackLoopResponse.status}`);
  }

  const feedbackLoopPayload = await feedbackLoopResponse.json();
  console.log('Feedback loop result:');
  console.log(JSON.stringify(feedbackLoopPayload, null, 2));

  const feedbackApplyResponse = await fetch(`${baseUrl}/api/feedback/apply`, {
    method: 'POST',
  });

  if (!feedbackApplyResponse.ok) {
    throw new Error(`Feedback apply endpoint returned ${feedbackApplyResponse.status}`);
  }

  const feedbackApplyPayload = await feedbackApplyResponse.json();
  console.log('Feedback apply result:');
  console.log(JSON.stringify(feedbackApplyPayload, null, 2));

  const resonanceStateResponse = await fetch(`${baseUrl}/api/resonance/state`);

  if (!resonanceStateResponse.ok) {
    throw new Error(`Resonance state endpoint returned ${resonanceStateResponse.status}`);
  }

  const resonanceStatePayload = await resonanceStateResponse.json();
  console.log('Resonance state snapshot:');
  console.log(JSON.stringify(resonanceStatePayload, null, 2));

  const resonanceCheckResponse = await fetch(`${baseUrl}/api/resonance/check`, {
    method: 'POST',
  });

  if (!resonanceCheckResponse.ok) {
    throw new Error(`Resonance check endpoint returned ${resonanceCheckResponse.status}`);
  }

  const resonanceCheckPayload = await resonanceCheckResponse.json();
  console.log('Resonance check result:');
  console.log(JSON.stringify(resonanceCheckPayload, null, 2));

  if (resonanceCheckPayload.state.currentResonance === null) {
    throw new Error('Resonance did not compute despite warmup feedback and validation incidents');
  }

  if (!['low', 'recovering'].includes(resonanceCheckPayload.state.state)) {
    throw new Error(`Resonance did not enter low/recovering state as expected: ${resonanceCheckPayload.state.state}`);
  }

  if (!resonanceCheckPayload.state.pausedUntil) {
    throw new Error('Learning pause was not activated after low resonance');
  }

  if (!resonanceCheckPayload.state.lastRollbackCheckpointId) {
    throw new Error('Rollback checkpoint was not recorded after low resonance');
  }

  const rishiResponse = await fetch(`${baseUrl}/api/rishi/state`);

  if (!rishiResponse.ok) {
    throw new Error(`Rishi state endpoint returned ${rishiResponse.status}`);
  }

  const rishiPayload = await rishiResponse.json();
  console.log('Rishi state snapshot:');
  console.log(JSON.stringify(rishiPayload, null, 2));

  if (!rishiPayload.informationSources.includes('validation failure incident log')) {
    throw new Error('Rishi state is missing validation failure incident log after resonance simulation');
  }

  const addGoodTestResponse = await fetch(`${baseUrl}/api/tests/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: 'Как проверить корректность самообучения после серии ошибок?',
      answer: 'intent analysis',
      taskId: 'analysis',
      providerId: 'openai-agents',
      matchStrategy: 'includes',
    }),
  });

  if (!addGoodTestResponse.ok) {
    throw new Error(`Test add endpoint returned ${addGoodTestResponse.status} for good test`);
  }

  const addGoodTestPayload = await addGoodTestResponse.json();

  const addBadTestResponse = await fetch(`${baseUrl}/api/tests/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: 'После rollback исправь деградацию trace sentinel.',
      answer: 'совершенно неверный эталон',
      taskId: 'repair',
      providerId: 'openai-agents',
      matchStrategy: 'includes',
    }),
  });

  if (!addBadTestResponse.ok) {
    throw new Error(`Test add endpoint returned ${addBadTestResponse.status} for bad test`);
  }

  const addBadTestPayload = await addBadTestResponse.json();

  const testRunResponse = await fetch(`${baseUrl}/api/tests/run`, {
    method: 'POST',
  });

  if (!testRunResponse.ok) {
    throw new Error(`Test run endpoint returned ${testRunResponse.status}`);
  }

  const testRunPayload = await testRunResponse.json();
  console.log('Test suite run result:');
  console.log(JSON.stringify(testRunPayload, null, 2));

  if (testRunPayload.run.score >= 0.7) {
    throw new Error('Test suite unexpectedly stayed above the blocking threshold with a bad test present');
  }

  const blockedStateResponse = await fetch(`${baseUrl}/api/learning/state`);

  if (!blockedStateResponse.ok) {
    throw new Error(`Learning state after test block returned ${blockedStateResponse.status}`);
  }

  const blockedStatePayload = await blockedStateResponse.json();

  if (!blockedStatePayload.stats.testSuiteBlocked || !blockedStatePayload.stats.learningBlocked) {
    throw new Error('Test suite did not block learning after falling below the threshold');
  }

  const removeBadTestResponse = await fetch(`${baseUrl}/api/tests/remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: addBadTestPayload.testCase.id,
    }),
  });

  if (!removeBadTestResponse.ok) {
    throw new Error(`Test remove endpoint returned ${removeBadTestResponse.status}`);
  }

  const secondTestRunResponse = await fetch(`${baseUrl}/api/tests/run`, {
    method: 'POST',
  });

  if (!secondTestRunResponse.ok) {
    throw new Error(`Second test run endpoint returned ${secondTestRunResponse.status}`);
  }

  const secondTestRunPayload = await secondTestRunResponse.json();

  if (secondTestRunPayload.run.score < 0.7) {
    throw new Error('Test suite did not recover after removing the bad test');
  }

  const finalStateResponse = await fetch(`${baseUrl}/api/learning/state`);

  if (!finalStateResponse.ok) {
    throw new Error(`Final learning state endpoint returned ${finalStateResponse.status}`);
  }

  const finalStatePayload = await finalStateResponse.json();

  if (finalStatePayload.stats.testSuiteBlocked) {
    throw new Error('Test suite remained blocked after the suite recovered');
  }

  const cleanupTestResponse = await fetch(`${baseUrl}/api/tests/remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: addGoodTestPayload.testCase.id,
    }),
  });

  if (!cleanupTestResponse.ok) {
    throw new Error(`Cleanup test remove endpoint returned ${cleanupTestResponse.status}`);
  }

  const inspectorCheckpointResponse = await fetch(`${baseUrl}/api/inspector/checkpoint`, {
    method: 'POST',
  });

  if (!inspectorCheckpointResponse.ok) {
    throw new Error(`Inspector checkpoint endpoint returned ${inspectorCheckpointResponse.status}`);
  }

  const inspectorCheckpointPayload = await inspectorCheckpointResponse.json();

  const inspectorStatusResponse = await fetch(`${baseUrl}/api/inspector/status`);

  if (!inspectorStatusResponse.ok) {
    throw new Error(`Inspector status endpoint returned ${inspectorStatusResponse.status}`);
  }

  const inspectorStatusPayload = await inspectorStatusResponse.json();
  console.log('Inspector status snapshot:');
  console.log(JSON.stringify(inspectorStatusPayload, null, 2));

  if (!inspectorStatusPayload.checkpoints.some((checkpoint) => checkpoint.id === inspectorCheckpointPayload.checkpoint.id)) {
    throw new Error('Inspector status did not expose the new manual checkpoint');
  }

  const manualPauseResponse = await fetch(`${baseUrl}/api/inspector/learning`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ enabled: false }),
  });

  if (!manualPauseResponse.ok) {
    throw new Error(`Inspector learning pause endpoint returned ${manualPauseResponse.status}`);
  }

  const pausedStateResponse = await fetch(`${baseUrl}/api/learning/state`);

  if (!pausedStateResponse.ok) {
    throw new Error(`Learning state after manual pause returned ${pausedStateResponse.status}`);
  }

  const pausedStatePayload = await pausedStateResponse.json();

  if (!pausedStatePayload.stats.manualLearningPaused || !pausedStatePayload.stats.learningBlocked) {
    throw new Error('Inspector manual pause did not block learning');
  }

  const addPendingFeedbackResponse = await fetch(`${baseUrl}/api/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messageId: runPayload.reply.id,
      taskId: 'recovery',
      providerId: 'openai-agents',
      sentiment: 'negative',
      reason: 'smoke-test: phase-5 pending gradient cleanup',
    }),
  });

  if (!addPendingFeedbackResponse.ok) {
    throw new Error(`Feedback endpoint for pending gradient returned ${addPendingFeedbackResponse.status}`);
  }

  const clearGradientsResponse = await fetch(`${baseUrl}/api/inspector/gradients/clear`, {
    method: 'POST',
  });

  if (!clearGradientsResponse.ok) {
    throw new Error(`Inspector clear gradients endpoint returned ${clearGradientsResponse.status}`);
  }

  const clearGradientsPayload = await clearGradientsResponse.json();

  if (clearGradientsPayload.pendingAfter !== 0) {
    throw new Error('Inspector clear gradients did not remove all pending gradients');
  }

  const resonanceConfigResponse = await fetch(`${baseUrl}/api/inspector/resonance/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ low: 0.25, recovery: 0.65 }),
  });

  if (!resonanceConfigResponse.ok) {
    throw new Error(`Inspector resonance config endpoint returned ${resonanceConfigResponse.status}`);
  }

  const resonanceConfigPayload = await resonanceConfigResponse.json();

  if (resonanceConfigPayload.low !== 0.25 || resonanceConfigPayload.recovery !== 0.65) {
    throw new Error('Inspector resonance config did not persist new thresholds');
  }

  const refreshedResonanceStateResponse = await fetch(`${baseUrl}/api/resonance/state`);

  if (!refreshedResonanceStateResponse.ok) {
    throw new Error(`Resonance state after config returned ${refreshedResonanceStateResponse.status}`);
  }

  const refreshedResonanceStatePayload = await refreshedResonanceStateResponse.json();

  if (refreshedResonanceStatePayload.thresholds.low !== 0.25 || refreshedResonanceStatePayload.thresholds.recovery !== 0.65) {
    throw new Error('Resonance state did not expose updated thresholds');
  }

  const testConfigResponse = await fetch(`${baseUrl}/api/inspector/test-suite/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ threshold: 0.8 }),
  });

  if (!testConfigResponse.ok) {
    throw new Error(`Inspector test suite config endpoint returned ${testConfigResponse.status}`);
  }

  const testStateAfterConfigResponse = await fetch(`${baseUrl}/api/tests/state`);

  if (!testStateAfterConfigResponse.ok) {
    throw new Error(`Test state after config returned ${testStateAfterConfigResponse.status}`);
  }

  const testStateAfterConfigPayload = await testStateAfterConfigResponse.json();

  if (testStateAfterConfigPayload.accuracyThreshold !== 0.8) {
    throw new Error('Test suite state did not expose updated threshold');
  }

  const resumeLearningResponse = await fetch(`${baseUrl}/api/inspector/learning`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ enabled: true }),
  });

  if (!resumeLearningResponse.ok) {
    throw new Error(`Inspector learning resume endpoint returned ${resumeLearningResponse.status}`);
  }

  const rollbackResponse = await fetch(`${baseUrl}/api/inspector/rollback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ checkpointId: inspectorCheckpointPayload.checkpoint.id }),
  });

  if (!rollbackResponse.ok) {
    throw new Error(`Inspector rollback endpoint returned ${rollbackResponse.status}`);
  }

  const inspectorMetricsResponse = await fetch(`${baseUrl}/api/inspector/metrics`);

  if (!inspectorMetricsResponse.ok) {
    throw new Error(`Inspector metrics endpoint returned ${inspectorMetricsResponse.status}`);
  }

  const inspectorTargetsResponse = await fetch(`${baseUrl}/api/inspector/module-targets`);

  if (!inspectorTargetsResponse.ok) {
    throw new Error(`Inspector module-targets endpoint returned ${inspectorTargetsResponse.status}`);
  }

  const inspectorTargetsPayload = await inspectorTargetsResponse.json();

  if (!Array.isArray(inspectorTargetsPayload.targets) || !inspectorTargetsPayload.targets.some((target) => target.id === 'mutation-sandbox')) {
    throw new Error('Inspector module-targets endpoint did not expose the mutation sandbox target');
  }

  const patchForwardResponse = await fetch(`${baseUrl}/api/inspector/module-patch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target: 'mutation-sandbox',
      findText: 'control-sandbox-v1',
      replaceText: 'control-sandbox-v2',
    }),
  });

  if (!patchForwardResponse.ok) {
    throw new Error(`Inspector module-patch endpoint returned ${patchForwardResponse.status} on forward patch`);
  }

  const patchBackwardResponse = await fetch(`${baseUrl}/api/inspector/module-patch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target: 'mutation-sandbox',
      findText: 'control-sandbox-v2',
      replaceText: 'control-sandbox-v1',
    }),
  });

  if (!patchBackwardResponse.ok) {
    throw new Error(`Inspector module-patch endpoint returned ${patchBackwardResponse.status} on restore patch`);
  }

  const compileResponse = await fetch(`${baseUrl}/api/inspector/compile`, {
    method: 'POST',
  });

  if (!compileResponse.ok) {
    throw new Error(`Inspector compile endpoint returned ${compileResponse.status}`);
  }

  const interestsMigrationResponse = await fetch(`${baseUrl}/api/interests/migrate`, {
    method: 'POST',
  });

  if (!interestsMigrationResponse.ok) {
    throw new Error(`Interests migrate endpoint returned ${interestsMigrationResponse.status}`);
  }

  const inspectorMetricsPayload = await inspectorMetricsResponse.json();
  console.log('Inspector metrics snapshot:');
  console.log(JSON.stringify(inspectorMetricsPayload, null, 2));

  if (inspectorMetricsPayload.inspectorActions.length === 0) {
    throw new Error('Inspector metrics did not record control-plane actions');
  }

  const netSurferStatusResponse = await fetch(`${baseUrl}/api/netsurfer/status`);

  if (!netSurferStatusResponse.ok) {
    throw new Error(`NetSurfer status endpoint returned ${netSurferStatusResponse.status}`);
  }

  const netSurferStatusPayload = await netSurferStatusResponse.json();
  console.log('NetSurfer status snapshot:');
  console.log(JSON.stringify(netSurferStatusPayload, null, 2));

  const atmanChatResponse = await fetch(`${baseUrl}/api/atman/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: 'smoke-user',
      message: 'Расскажи кратко, кто ты и что ты помнишь.',
    }),
  });

  if (!atmanChatResponse.ok) {
    throw new Error(`Atman chat endpoint returned ${atmanChatResponse.status}`);
  }

  const atmanChatPayload = await atmanChatResponse.json();
  console.log('Atman chat snapshot:');
  console.log(JSON.stringify(atmanChatPayload, null, 2));

  if (!atmanChatPayload.report || typeof atmanChatPayload.response !== 'string' || atmanChatPayload.response.length === 0) {
    throw new Error('Atman chat endpoint returned an incomplete dialogue payload');
  }

  const atmanStreamResponse = await fetch(`${baseUrl}/api/atman/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: 'smoke-stream-user',
      message: 'Привет, скажи кто ты.',
    }),
  });

  if (!atmanStreamResponse.ok) {
    throw new Error(`Atman stream endpoint returned ${atmanStreamResponse.status}`);
  }

  const atmanStreamPayload = await atmanStreamResponse.text();

  if (!atmanStreamPayload.includes('"type":"done"')) {
    throw new Error('Atman stream endpoint did not finish with a done event');
  }

  const atmanTrainResponse = await fetch(`${baseUrl}/api/atman/train`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user: 'Что такое яблоко?',
      assistant: 'Яблоко это фрукт. Оно может быть красным, жёлтым или зелёным.',
      tags: ['smoke-train'],
    }),
  });

  if (!atmanTrainResponse.ok) {
    throw new Error(`Atman train endpoint returned ${atmanTrainResponse.status}`);
  }

  const atmanSeedResponse = await fetch(`${baseUrl}/api/atman/seed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profile: 'child-3',
      mode: 'merge',
    }),
  });

  if (!atmanSeedResponse.ok) {
    throw new Error(`Atman seed endpoint returned ${atmanSeedResponse.status}`);
  }

  const atmanExamplesResponse = await fetch(`${baseUrl}/api/atman/examples`);

  if (!atmanExamplesResponse.ok) {
    throw new Error(`Atman examples endpoint returned ${atmanExamplesResponse.status}`);
  }

  const atmanExamplesPayload = await atmanExamplesResponse.json();

  if (!Array.isArray(atmanExamplesPayload.examples) || atmanExamplesPayload.examples.length === 0) {
    throw new Error('Atman examples endpoint did not return stored examples');
  }

  const atmanLogsResponse = await fetch(`${baseUrl}/api/atman/logs`);

  if (!atmanLogsResponse.ok) {
    throw new Error(`Atman logs endpoint returned ${atmanLogsResponse.status}`);
  }

  const atmanLogsPayload = await atmanLogsResponse.json();

  if (!Array.isArray(atmanLogsPayload.logs) || atmanLogsPayload.logs.length === 0) {
    throw new Error('Atman logs endpoint did not return dialogue/training events');
  }

  const interestsAdvanceResponse = await fetch(`${baseUrl}/api/interests/explore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Изучи в интернете животных и составь своё мнение',
    }),
  });

  if (!interestsAdvanceResponse.ok) {
    throw new Error(`Interests explore endpoint returned ${interestsAdvanceResponse.status}`);
  }

  const interestsStatusResponse = await fetch(`${baseUrl}/api/interests/status`);

  if (!interestsStatusResponse.ok) {
    throw new Error(`Interests status endpoint returned ${interestsStatusResponse.status}`);
  }

  const interestsStatusPayload = await interestsStatusResponse.json();

  if (!Array.isArray(interestsStatusPayload.topTopics) || interestsStatusPayload.topTopics.length === 0) {
    throw new Error('Interests status endpoint did not return monitored topics');
  }

  if (!interestsStatusPayload.automation || typeof interestsStatusPayload.automation.enabled !== 'boolean') {
    throw new Error('Interests status endpoint did not expose automation state');
  }

  if (!Array.isArray(interestsStatusPayload.topicInsights)) {
    throw new Error('Interests status endpoint did not expose topic insights');
  }

  if (!Array.isArray(interestsStatusPayload.topicHistory) || interestsStatusPayload.topicHistory.length === 0) {
    throw new Error('Interests status endpoint did not expose per-topic history');
  }

  const interestsLogsResponse = await fetch(`${baseUrl}/api/interests/logs`);

  if (!interestsLogsResponse.ok) {
    throw new Error(`Interests logs endpoint returned ${interestsLogsResponse.status}`);
  }

  const interestsLogsPayload = await interestsLogsResponse.json();

  if (!Array.isArray(interestsLogsPayload.logs) || interestsLogsPayload.logs.length === 0) {
    throw new Error('Interests logs endpoint did not record monitoring events');
  }

  const interestsAutomationResponse = await fetch(`${baseUrl}/api/interests/automation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      enabled: true,
      runNow: true,
      topic: 'океан',
    }),
  });

  if (!interestsAutomationResponse.ok) {
    throw new Error(`Interests automation endpoint returned ${interestsAutomationResponse.status}`);
  }

  const interestsAutomationPayload = await interestsAutomationResponse.json();

  if (!interestsAutomationPayload.automation || interestsAutomationPayload.runResult?.skipped) {
    throw new Error('Interests automation endpoint did not run the scheduled study path');
  }

  const refreshedInterestsStatusResponse = await fetch(`${baseUrl}/api/interests/status`);

  if (!refreshedInterestsStatusResponse.ok) {
    throw new Error(`Refreshed interests status endpoint returned ${refreshedInterestsStatusResponse.status}`);
  }

  const refreshedInterestsStatusPayload = await refreshedInterestsStatusResponse.json();

  if (!Array.isArray(refreshedInterestsStatusPayload.topicInsights) || refreshedInterestsStatusPayload.topicInsights.length === 0) {
    throw new Error('Interests automation did not produce source-backed topic insights');
  }

  if (!Array.isArray(refreshedInterestsStatusPayload.topicHistory) || refreshedInterestsStatusPayload.topicHistory.length === 0) {
    throw new Error('Interests automation did not preserve per-topic history');
  }

  const bridgeStartResponse = await fetch(`${baseUrl}/api/bridge/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionUserId: 'smoke-bridge-user',
    }),
  });

  if (!bridgeStartResponse.ok) {
    throw new Error(`Bridge start endpoint returned ${bridgeStartResponse.status}`);
  }

  const bridgeMessageResponse = await fetch(`${baseUrl}/api/bridge/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: 'Привет, я твой папа. Ты меня понимаешь?',
      source: 'smoke-shakti',
    }),
  });

  if (!bridgeMessageResponse.ok) {
    throw new Error(`Bridge message endpoint returned ${bridgeMessageResponse.status}`);
  }

  const bridgeMessagePayload = await bridgeMessageResponse.json();

  if (typeof bridgeMessagePayload.reply !== 'string' || bridgeMessagePayload.reply.length === 0) {
    throw new Error('Bridge message endpoint did not return a child reply');
  }

  const bridgeStatusResponse = await fetch(`${baseUrl}/api/bridge/status`);

  if (!bridgeStatusResponse.ok) {
    throw new Error(`Bridge status endpoint returned ${bridgeStatusResponse.status}`);
  }

  const bridgeLogsResponse = await fetch(`${baseUrl}/api/bridge/logs`);

  if (!bridgeLogsResponse.ok) {
    throw new Error(`Bridge logs endpoint returned ${bridgeLogsResponse.status}`);
  }

  const bridgeLogsPayload = await bridgeLogsResponse.json();

  if (!Array.isArray(bridgeLogsPayload.logs) || bridgeLogsPayload.logs.length === 0) {
    throw new Error('Bridge logs endpoint did not record the simulated external exchange');
  }

  const atmanHistoryResponse = await fetch(`${baseUrl}/api/atman/history?userId=smoke-user`);

  if (!atmanHistoryResponse.ok) {
    throw new Error(`Atman history endpoint returned ${atmanHistoryResponse.status}`);
  }

  const atmanHistoryPayload = await atmanHistoryResponse.json();

  if (!Array.isArray(atmanHistoryPayload.history) || atmanHistoryPayload.history.length === 0) {
    throw new Error('Atman history endpoint did not persist the direct chat dialogue');
  }

  const atmanStatusResponse = await fetch(`${baseUrl}/api/atman/status`);

  if (!atmanStatusResponse.ok) {
    throw new Error(`Atman status endpoint returned ${atmanStatusResponse.status}`);
  }

  const atmanStatusPayload = await atmanStatusResponse.json();
  console.log('Atman status snapshot:');
  console.log(JSON.stringify(atmanStatusPayload, null, 2));

  const chatHtmlResponse = await fetch(`${baseUrl}/chat.html`);

  if (!chatHtmlResponse.ok) {
    throw new Error(`Chat HTML endpoint returned ${chatHtmlResponse.status}`);
  }

  const chatHtml = await chatHtmlResponse.text();

  if (!chatHtml.includes('Чат с Атманом')) {
    throw new Error('Chat HTML did not expose the expected Atman chat shell');
  }

  const adminHtmlResponse = await fetch(`${baseUrl}/admin.html`);

  if (!adminHtmlResponse.ok) {
    throw new Error(`Admin HTML endpoint returned ${adminHtmlResponse.status}`);
  }

  const adminHtml = await adminHtmlResponse.text();

  if (!adminHtml.includes('Администрирование системы')) {
    throw new Error('Admin HTML did not expose the expected control-plane shell');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});