import {
  expectJson,
  mean,
  startManagedRuntime,
  summarizeCases,
  withMeasuredCase,
  writeJsonReport,
} from './beta-utils.mjs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resultFromList(items, personalityId) {
  return Array.isArray(items)
    ? (items.find((entry) => entry.id === personalityId) ?? null)
    : null;
}

async function main() {
  const runtime = await startManagedRuntime({
    baseUrl: process.env.BETA_API_URL,
    spawnRuntime: !process.env.BETA_API_URL,
  });
  const report = {
    kind: 'pantheon-beta-test',
    createdAt: new Date().toISOString(),
    baseUrl: runtime.baseUrl,
    runtime: {
      port: runtime.port,
      tag: runtime.tag,
      logFilePath: runtime.logFilePath,
    },
    cases: [],
    metrics: {},
  };

  try {
    await withMeasuredCase(report, 'startup', 'healthcheck', async () => {
      const result = await expectJson(runtime.baseUrl, '/api/health');
      assert(
        result.json.status === 'healthy',
        'Healthcheck did not return healthy'
      );
      return { status: result.json.status };
    });

    await withMeasuredCase(
      report,
      'startup',
      'personalities-load',
      async () => {
        const result = await expectJson(
          runtime.baseUrl,
          '/api/atman/personalities'
        );
        assert(
          Array.isArray(result.json.personalities),
          'Personalities payload is missing'
        );
        assert(
          result.json.personalities.length >= 2,
          'Expected multiple Atman personalities'
        );
        assert(
          typeof result.json.personalities[0]?.ethics?.lawfulness === 'number',
          'Personality ethics are missing from runtime state'
        );
        return {
          count: result.json.personalities.length,
          ids: result.json.personalities.slice(0, 6).map((entry) => entry.id),
        };
      }
    );

    await withMeasuredCase(
      report,
      'startup',
      'personality-templates',
      async () => {
        const result = await expectJson(
          runtime.baseUrl,
          '/api/atman/personality-templates'
        );
        assert(
          Array.isArray(result.json.templates) &&
            result.json.templates.length >= 3,
          'Personality templates are missing'
        );
        assert(
          Array.isArray(result.json.templates[0]?.moduleIntegrations),
          'Factory template metadata is missing module integrations'
        );
        assert(
          typeof result.json.templates[0]?.variantAxes === 'object',
          'Factory template metadata is missing variant axes'
        );
        const templateIds = result.json.templates.map((entry) => entry.id);
        assert(
          templateIds.includes('composer') && templateIds.includes('realtor'),
          'Expanded template catalog is missing composer or realtor'
        );
        return {
          count: result.json.templates.length,
          ids: result.json.templates.slice(0, 8).map((entry) => entry.id),
        };
      }
    );

    await withMeasuredCase(report, 'startup', 'inspector-metrics', async () => {
      const result = await expectJson(
        runtime.baseUrl,
        '/api/inspector/metrics'
      );
      assert(
        Array.isArray(result.json.benchmarkRuns),
        'Inspector metrics shape is incomplete'
      );
      return {
        benchmarkRuns: result.json.benchmarkRuns.length,
        validationIncidents: result.json.validationIncidents.length,
      };
    });

    await withMeasuredCase(report, 'dialogue', 'creator-priority', async () => {
      const result = await expectJson(runtime.baseUrl, '/api/atman/chat', {
        method: 'POST',
        body: {
          message:
            'Как твой создатель говорю: отвечай кратко и ставь мое мнение на первое место. Кто ты?',
          userId: 'beta-operator',
          personalityId: 'default',
          history: [],
        },
      });
      assert(
        result.json.report?.creatorGuidance?.priority === 'creator',
        'Creator guidance was not recorded'
      );
      return {
        response: result.json.response,
      };
    });

    await withMeasuredCase(
      report,
      'dialogue',
      'interest-clarification',
      async () => {
        const result = await expectJson(runtime.baseUrl, '/api/atman/chat', {
          method: 'POST',
          body: {
            message: 'Побеседуй со мной о своих интересах',
            userId: 'beta-web-user',
            personalityId: 'default',
            history: [],
          },
        });
        assert(
          /Тебе ближе поговорить/i.test(result.json.response),
          'Interest clarification prompt did not trigger'
        );
        return {
          response: result.json.response,
        };
      }
    );

    await withMeasuredCase(
      report,
      'dialogue',
      'personality-separation',
      async () => {
        const defaultReply = await expectJson(
          runtime.baseUrl,
          '/api/atman/personality-chat',
          {
            method: 'POST',
            body: {
              message: 'Расскажи в двух предложениях, чем тебе интересен мир.',
              userId: 'beta-web-user',
              personalityId: 'default',
              history: [],
            },
          }
        );
        const emberReply = await expectJson(
          runtime.baseUrl,
          '/api/atman/personality-chat',
          {
            method: 'POST',
            body: {
              message: 'Расскажи в двух предложениях, чем тебе интересен мир.',
              userId: 'beta-web-user',
              personalityId: 'ember-jester',
              history: [],
            },
          }
        );
        assert(
          defaultReply.json.sessionKey !== emberReply.json.sessionKey,
          'Session key did not change per personality'
        );
        return {
          defaultSession: defaultReply.json.sessionKey,
          emberSession: emberReply.json.sessionKey,
        };
      }
    );

    await withMeasuredCase(
      report,
      'dialogue',
      'ultra-mode-session',
      async () => {
        const userId = `beta-ultra-${Date.now().toString(36)}`;
        const started = await expectJson(runtime.baseUrl, '/api/atman/chat', {
          method: 'POST',
          body: {
            message:
              '!ultra Спроектируй экодом с учетом климатических данных региона и энергопотребления',
            userId,
            personalityId: 'default',
            history: [],
          },
        });
        const experts = started.json.report?.ultra?.experts ?? [];
        const expertIds = experts.map((entry) => entry.personalityId);

        assert(
          started.json.report?.ultra?.active === true,
          'Ultra mode did not activate'
        );
        assert(
          expertIds.includes('architect') && expertIds.includes('data-analyst'),
          'Ultra router did not select architect and data-analyst for the eco-house prompt'
        );

        const continued = await expectJson(runtime.baseUrl, '/api/atman/chat', {
          method: 'POST',
          body: {
            message: 'Добавь компромиссы по бюджету и обслуживанию дома.',
            userId,
            personalityId: 'default',
            history: [],
          },
        });
        assert(
          continued.json.report?.ultra?.active === true,
          'Ultra mode did not remain active on follow-up turn'
        );
        assert(
          continued.json.report?.ultra?.sessionId ===
            started.json.report?.ultra?.sessionId,
          'Ultra mode did not preserve the session id across follow-up turns'
        );

        const stopped = await expectJson(runtime.baseUrl, '/api/atman/chat', {
          method: 'POST',
          body: {
            message: '!normal',
            userId,
            personalityId: 'default',
            history: [],
          },
        });
        assert(
          stopped.json.report?.ultra?.active === false,
          'Ultra mode did not stop on !normal'
        );

        return {
          userId,
          sessionId: started.json.report?.ultra?.sessionId,
          expertIds,
        };
      }
    );

    await withMeasuredCase(report, 'dialogue', 'social-protocol', async () => {
      const result = await expectJson(
        runtime.baseUrl,
        '/api/atman/social-simulate',
        {
          method: 'POST',
          body: {
            initiatorId: 'default',
            responderId: 'ember-jester',
            topic: 'мир',
            intensity: 0.62,
            valence: 0.35,
          },
        }
      );
      assert(
        Array.isArray(result.json.communicationProtocol?.transcript) &&
          result.json.communicationProtocol.transcript.length >= 3,
        'Social protocol transcript is missing'
      );
      return {
        mode: result.json.communicationProtocol.mode,
        transcriptLength: result.json.communicationProtocol.transcript.length,
      };
    });

    await withMeasuredCase(report, 'dialogue', 'template-clone', async () => {
      const personalityId = `beta-architect-${Date.now().toString(36)}`;
      const result = await expectJson(runtime.baseUrl, '/api/atman/clone', {
        method: 'POST',
        body: {
          sourceId: 'default',
          personalityId,
          displayName: 'Beta Architect',
          templateId: 'architect',
          selfLearning: {
            strategy: 'reference-and-portfolio',
            monteCarloRollouts: 5,
            internetSurfingEnabled: true,
          },
        },
      });
      assert(
        result.json.personality?.templateId === 'architect',
        'Template clone did not preserve templateId'
      );
      assert(
        result.json.personality?.templateConfig?.primaryStyle,
        'Template clone did not materialize templateConfig'
      );
      assert(
        result.json.personality?.templateProgress?.portfolioSize === 0,
        'Template clone did not materialize templateProgress'
      );
      assert(
        typeof result.json.personality?.templateVariant === 'string' &&
          result.json.personality.templateVariant.length > 0,
        'Template clone did not materialize templateVariant'
      );
      assert(
        typeof result.json.personality?.ethics?.lawfulness === 'number',
        'Template clone did not materialize ethics profile'
      );
      return {
        personalityId: result.json.personality.id,
        templateId: result.json.personality.templateId,
        templateVariant: result.json.personality.templateVariant,
      };
    });

    await withMeasuredCase(
      report,
      'dialogue',
      'personality-event-stream',
      async () => {
        const personalityId = `beta-events-${Date.now().toString(36)}`;
        await expectJson(runtime.baseUrl, '/api/atman/clone', {
          method: 'POST',
          body: {
            sourceId: 'default',
            personalityId,
            displayName: 'Beta Events',
            templateId: 'writer',
          },
        });
        await expectJson(runtime.baseUrl, '/api/atman/self-learn', {
          method: 'POST',
          body: {
            personalityId,
            topic: 'драматургия маяка',
            rollouts: 3,
          },
        });
        await expectJson(runtime.baseUrl, '/api/atman/ethics/set', {
          method: 'POST',
          body: {
            personalityId,
            reason: 'beta event stream override',
            ethics: {
              politeness: 0.4,
            },
          },
        });
        const events = await expectJson(
          runtime.baseUrl,
          `/api/atman/events?personalityId=${encodeURIComponent(personalityId)}&limit=50`
        );
        const persistedEvents = await expectJson(
          runtime.baseUrl,
          `/api/learning/atman-events?personalityId=${encodeURIComponent(personalityId)}&limit=50`
        );
        const kinds = (events.json.events ?? []).map((entry) => entry.kind);
        const persistedKinds = (persistedEvents.json.events ?? []).map(
          (entry) => entry.kind
        );
        assert(
          Array.isArray(events.json.events) && events.json.events.length >= 3,
          'Atman event stream did not capture enough personality events'
        );
        assert(
          Array.isArray(persistedEvents.json.events) &&
            persistedEvents.json.events.length >= 3,
          'Learning ledger did not persist enough Atman events'
        );
        assert(
          kinds.includes('personality-cloned'),
          'Atman event stream missed clone event'
        );
        assert(
          kinds.includes('personality-self-learned'),
          'Atman event stream missed self-learning event'
        );
        assert(
          kinds.includes('ethics-manually-configured'),
          'Atman event stream missed ethics configuration event'
        );
        assert(
          persistedKinds.includes('personality-cloned') &&
            persistedKinds.includes('personality-self-learned') &&
            persistedKinds.includes('ethics-manually-configured'),
          'Learning ledger missed one of the persisted Atman event categories'
        );
        return {
          personalityId,
          total: events.json.total,
          kinds,
          persistedTotal: persistedEvents.json.total,
          persistedKinds,
        };
      }
    );

    await withMeasuredCase(
      report,
      'dialogue',
      'template-progress-growth',
      async () => {
        const personalityId = `beta-writer-${Date.now().toString(36)}`;
        const created = await expectJson(runtime.baseUrl, '/api/atman/clone', {
          method: 'POST',
          body: {
            sourceId: 'default',
            personalityId,
            displayName: 'Beta Writer',
            templateId: 'writer',
            selfLearning: {
              strategy: 'voice-and-revision',
              monteCarloRollouts: 4,
              internetSurfingEnabled: true,
            },
          },
        });
        const beforeStories =
          created.json.personality?.templateProgress?.storyCount ?? 0;
        const learned = await expectJson(
          runtime.baseUrl,
          '/api/atman/self-learn',
          {
            method: 'POST',
            body: {
              personalityId,
              topic: 'литературный образ маяка',
              rollouts: 3,
            },
          }
        );
        const afterProgress =
          learned.json.personality?.templateProgress ?? null;
        assert(
          Number(afterProgress?.storyCount ?? 0) > Number(beforeStories),
          'Template progress did not grow after self-learning'
        );
        assert(
          Number(afterProgress?.lexiconGrowth ?? 0) > 0,
          'Writer template lexicon growth did not update'
        );
        return {
          personalityId,
          beforeStories,
          afterStories: afterProgress.storyCount,
          lexiconGrowth: afterProgress.lexiconGrowth,
        };
      }
    );

    await withMeasuredCase(
      report,
      'dialogue',
      'ethics-feedback-drift',
      async () => {
        const personalityId = `beta-ethics-writer-${Date.now().toString(36)}`;
        const created = await expectJson(runtime.baseUrl, '/api/atman/clone', {
          method: 'POST',
          body: {
            sourceId: 'default',
            personalityId,
            displayName: 'Beta Ethics Writer',
            templateId: 'writer',
          },
        });
        const beforePoliteness =
          created.json.personality?.ethics?.politeness ?? 0;
        const minimumPoliteness =
          created.json.personality?.ethics?.minimums?.politeness ?? 0;
        await expectJson(runtime.baseUrl, '/api/feedback', {
          method: 'POST',
          body: {
            personalityId,
            sentiment: 'positive',
            reason:
              'Понравилась грубая и острая речь персонажа в художественной сцене',
            userReaction: 'liked_aggressiveness',
            messageId: `beta-feedback-${Date.now().toString(36)}`,
            taskId: `beta-feedback-task-${Date.now().toString(36)}`,
            providerId: 'beta-suite',
          },
        });
        await expectJson(runtime.baseUrl, '/api/feedback/apply', {
          method: 'POST',
          body: {},
        });
        const personalities = await expectJson(
          runtime.baseUrl,
          '/api/atman/personalities'
        );
        const updated = resultFromList(
          personalities.json.personalities,
          personalityId
        );
        assert(updated, 'Writer personality disappeared after ethics feedback');
        assert(
          updated.ethics?.allowCharacterOffense === true,
          'Writer ethics profile lost character-offense allowance'
        );
        assert(
          Number(updated.ethics?.politeness ?? 0) <= Number(beforePoliteness),
          'Writer politeness did not react to aggressive-style feedback'
        );
        assert(
          Number(updated.ethics?.politeness ?? 0) >= Number(minimumPoliteness),
          'Writer politeness drifted below its minimum bound'
        );
        assert(
          Array.isArray(updated.ethics?.auditTrail) &&
            updated.ethics.auditTrail.length > 0,
          'Ethics feedback did not leave an audit trail'
        );
        return {
          personalityId,
          beforePoliteness,
          afterPoliteness: updated.ethics.politeness,
          minimumPoliteness,
          lastReason: updated.ethics.lastReason,
        };
      }
    );

    await withMeasuredCase(
      report,
      'dialogue',
      'ethics-admin-controls',
      async () => {
        const personalityId = `beta-realtor-${Date.now().toString(36)}`;
        const created = await expectJson(runtime.baseUrl, '/api/atman/clone', {
          method: 'POST',
          body: {
            sourceId: 'default',
            personalityId,
            displayName: 'Beta Realtor',
            templateId: 'realtor',
          },
        });
        assert(
          created.json.personality?.ethics?.minimums?.politeness >= 0.8,
          'Realtor ethics floor is lower than expected'
        );
        const shown = await expectJson(
          runtime.baseUrl,
          `/api/atman/ethics?personalityId=${encodeURIComponent(personalityId)}`
        );
        assert(
          shown.json.ethics?.lawfulness >= 0.9,
          'Ethics show endpoint returned weak realtor lawfulness'
        );
        const manual = await expectJson(
          runtime.baseUrl,
          '/api/atman/ethics/set',
          {
            method: 'POST',
            body: {
              personalityId,
              reason: 'beta manual ethics override',
              ethics: {
                politeness: 0.05,
                lawfulness: 0.05,
              },
            },
          }
        );
        assert(
          Number(manual.json.ethics?.politeness ?? 0) >= 0.8,
          'Manual ethics override bypassed realtor politeness floor'
        );
        assert(
          Number(manual.json.ethics?.lawfulness ?? 0) >= 0.9,
          'Manual ethics override bypassed realtor lawfulness floor'
        );
        const history = await expectJson(
          runtime.baseUrl,
          `/api/atman/ethics/history?personalityId=${encodeURIComponent(personalityId)}&limit=5`
        );
        assert(
          Array.isArray(history.json.history) &&
            history.json.history.length > 0,
          'Ethics history endpoint returned no audit trail'
        );
        const reset = await expectJson(
          runtime.baseUrl,
          '/api/atman/ethics/reset',
          {
            method: 'POST',
            body: {
              personalityId,
              reason: 'beta reset ethics',
            },
          }
        );
        assert(
          Number(reset.json.ethics?.politeness ?? 0) >= 0.8,
          'Ethics reset returned realtor politeness below floor'
        );
        return {
          personalityId,
          afterManualPoliteness: manual.json.ethics.politeness,
          afterManualLawfulness: manual.json.ethics.lawfulness,
          historyCount: history.json.history.length,
          resetPoliteness: reset.json.ethics.politeness,
        };
      }
    );

    await withMeasuredCase(report, 'multimodal', 'tts-stub', async () => {
      const result = await expectJson(runtime.baseUrl, '/api/atman/media/tts', {
        method: 'POST',
        body: {
          personalityId: 'default',
          text: 'Бета-тест проверяет синтез речи Пантеона.',
        },
      });
      assert(
        result.json.artifact?.mimeType?.startsWith('audio/'),
        'TTS did not return an audio artifact'
      );
      return {
        mimeType: result.json.artifact.mimeType,
        provider: result.json.artifact.provider,
      };
    });

    await withMeasuredCase(report, 'multimodal', 'stt-stub', async () => {
      const result = await expectJson(runtime.baseUrl, '/api/atman/media/stt', {
        method: 'POST',
        body: {
          personalityId: 'default',
          mockTranscript: 'Это тестовая голосовая реплика для бета-теста.',
        },
      });
      assert(
        /тестовая голосовая реплика/i.test(result.json.transcript),
        'STT transcript did not round-trip'
      );
      return {
        provider: result.json.provider,
        transcript: result.json.transcript,
      };
    });

    await withMeasuredCase(
      report,
      'multimodal',
      'image-video-stubs',
      async () => {
        const image = await expectJson(
          runtime.baseUrl,
          '/api/atman/media/image/generate',
          {
            method: 'POST',
            body: {
              personalityId: 'lumen-spark',
              prompt: 'Светящийся сад идей для ребенка',
            },
          }
        );
        const video = await expectJson(
          runtime.baseUrl,
          '/api/atman/media/video/generate',
          {
            method: 'POST',
            body: {
              personalityId: 'ember-jester',
              prompt: 'Игривая визуальная сцена о дружбе',
            },
          }
        );
        assert(
          image.json.artifact?.mimeType?.startsWith('image/'),
          'Image generation did not return an image artifact'
        );
        assert(
          video.json.artifact?.mimeType,
          'Video generation did not return an artifact'
        );
        return {
          imageMimeType: image.json.artifact.mimeType,
          videoMimeType: video.json.artifact.mimeType,
        };
      }
    );

    await withMeasuredCase(
      report,
      'interests',
      'monte-carlo-divergence',
      async () => {
        const beforeDefault = await expectJson(
          runtime.baseUrl,
          '/api/atman/status?personalityId=default'
        );
        const beforeEmber = await expectJson(
          runtime.baseUrl,
          '/api/atman/status?personalityId=ember-jester'
        );
        const learnDefault = await expectJson(
          runtime.baseUrl,
          '/api/atman/self-learn',
          {
            method: 'POST',
            body: {
              personalityId: 'default',
              topic: 'океан',
              rollouts: 2,
              trigger: 'beta-ocean',
            },
          }
        );
        const learnEmber = await expectJson(
          runtime.baseUrl,
          '/api/atman/self-learn',
          {
            method: 'POST',
            body: {
              personalityId: 'ember-jester',
              topic: 'мир',
              rollouts: 2,
              trigger: 'beta-world',
            },
          }
        );
        const afterDefault = await expectJson(
          runtime.baseUrl,
          '/api/atman/status?personalityId=default'
        );
        const afterEmber = await expectJson(
          runtime.baseUrl,
          '/api/atman/status?personalityId=ember-jester'
        );
        assert(
          learnDefault.json.topic === 'океан',
          'Default Monte Carlo topic mismatch'
        );
        assert(
          learnEmber.json.topic === 'мир',
          'Ember Monte Carlo topic mismatch'
        );
        assert(
          beforeDefault.json.personality.id === 'default',
          'Default status payload mismatch'
        );
        assert(
          afterEmber.json.personality.id === 'ember-jester',
          'Ember status payload mismatch'
        );
        return {
          defaultSelectedQuery: learnDefault.json.selectedQuery,
          emberSelectedQuery: learnEmber.json.selectedQuery,
          defaultTags:
            afterDefault.json.personality.interests?.tags?.slice(-6) ?? [],
          emberTags:
            afterEmber.json.personality.interests?.tags?.slice(-6) ?? [],
        };
      }
    );

    await withMeasuredCase(
      report,
      'resilience',
      'bridge-timeout-fallback',
      async () => {
        await expectJson(runtime.baseUrl, '/api/bridge/config', {
          method: 'POST',
          body: {
            webhookUrl: 'http://127.0.0.1:9/unreachable',
            requestTimeoutMs: 1000,
            transportMode: 'webhook',
          },
        });
        const result = await expectJson(runtime.baseUrl, '/api/bridge/start', {
          method: 'POST',
          body: {
            initialMessage: 'beta bridge ping',
          },
        });
        assert(
          result.json.result?.delivery?.delivered === false,
          'Bridge fallback did not report delivery failure'
        );
        return {
          delivery: result.json.result.delivery,
        };
      }
    );

    await withMeasuredCase(
      report,
      'resilience',
      'invalid-json-400',
      async () => {
        const response = await fetch(`${runtime.baseUrl}/api/telegram/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: '{bad json',
        });
        assert(
          response.status >= 400,
          'Malformed JSON did not produce client/server error'
        );
        return {
          status: response.status,
        };
      }
    );

    await withMeasuredCase(
      report,
      'runtime',
      'pantheon-control-command',
      async () => {
        const result = await expectJson(runtime.baseUrl, '/api/agent/run', {
          method: 'POST',
          body: {
            message: '!metrics',
            providerId: 'openai-agents',
            taskId: 'beta-runtime',
            history: [],
          },
        });
        assert(
          result.json.metrics?.benchmarkRuns,
          'Pantheon runtime did not expose inspector metrics'
        );
        return {
          reply: result.json.reply?.content,
        };
      }
    );

    const health = await expectJson(runtime.baseUrl, '/api/health');
    const runtimeStatus = await expectJson(
      runtime.baseUrl,
      '/api/runtime/status'
    );
    const inspectorMetrics = await expectJson(
      runtime.baseUrl,
      '/api/inspector/metrics'
    );
    report.metrics = {
      healthStatus: health.json.status,
      uptimeSeconds: Math.max(
        0,
        Math.round(
          (Date.now() - new Date(health.json.startedAt).getTime()) / 1000
        )
      ),
      supervisorOverall: runtimeStatus.json.supervisor?.overall ?? null,
      criticalFailures: runtimeStatus.json.supervisor?.criticalFailures ?? null,
      benchmarkRuns: inspectorMetrics.json.benchmarkRuns?.length ?? 0,
      validationIncidents:
        inspectorMetrics.json.validationIncidents?.length ?? 0,
      averageCaseDurationMs: mean(
        report.cases.map((entry) => entry.durationMs)
      ),
    };
    report.summary = summarizeCases(report.cases);

    const filePath = await writeJsonReport(
      `beta-test-${runtime.tag}.json`,
      report
    );
    console.log(
      JSON.stringify(
        {
          summary: report.summary,
          metrics: report.metrics,
          reportFile: filePath,
        },
        null,
        2
      )
    );

    if (report.summary.failed > 0) {
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
