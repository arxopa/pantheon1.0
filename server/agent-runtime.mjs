import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RuntimeTaskSupervisor,
  normalizeErrorMessage,
} from './core/runtime-hardening.mjs';
import { Atman } from './dialog/atman.mjs';
import { AtmanPersonalityManager } from './dialog/atman-personality-manager.mjs';
import { ChildInterests } from './interests/child-interests.mjs';
import { PersonalityMultimodal } from './integrations/personality-multimodal.mjs';
import { AppBotRegistry } from './integrations/app-bot-registry.mjs';
import { ShaktiBridge } from './integrations/shakti-bridge.mjs';
import { TelegramBotIntegration } from './integrations/telegram-bot.mjs';
import { runBenchmarkSuite } from './linguistic/benchmark-suite.mjs';
import { LinguisticAgent } from './linguistic/linguistic-agent.mjs';
import { PantheonNetSurfer } from './navigation/pantheon-net-surfer.mjs';
import { PantheonNavigationCore } from './navigation/pantheon-navigation-core.mjs';
import { PantheonWebScout } from './research/pantheon-web-scout.mjs';
import { DeepSelfLearning } from './self_learning/deep-self-learning.mjs';
import { Inspector } from './self_learning/inspector.mjs';
import { LearningLedger } from './self_learning/learning-ledger.mjs';
import { ResonanceMonitor } from './self_learning/resonance-monitor.mjs';
import { Rishi } from './self_learning/rishi.mjs';
import { PantheonTestSuite } from './testing/test-suite.mjs';
import { TrainingRegistry } from './training/training-registry.mjs';
import { PantheonValidator } from './validation/pantheon-validator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.dirname(__dirname);
const staticDir = path.join(workspaceRoot, 'static');
const port = Number(process.env.AGENT_SERVER_PORT ?? 8787);
const nightDistillationInterval = Number(
  process.env.NIGHT_DISTILLATION_INTERVAL_MS ?? 900000
);
const rishiCheckpointInterval = Number(
  process.env.RISHI_CHECKPOINT_INTERVAL_MS ?? 1200000
);
const feedbackProcessingInterval = Number(
  process.env.FEEDBACK_PROCESSING_INTERVAL_MS ?? 180000
);
const feedbackApplicationInterval = Number(
  process.env.FEEDBACK_APPLICATION_INTERVAL_MS ?? 240000
);
const feedbackAutoApplyBatchSize = Number(
  process.env.FEEDBACK_AUTO_APPLY_BATCH_SIZE ?? 5
);
const factTtlMs = Number(process.env.PANTHEON_FACT_TTL_MS ?? 86400000);
const factMinScore = Number(process.env.PANTHEON_FACT_MIN_SCORE ?? 0.65);
const learningLedgerPath = process.env.LEARNING_LEDGER_PATH;
const resonanceCheckIntervalMs = Number(
  process.env.RESONANCE_CHECK_INTERVAL_MS ?? 600000
);
const resonanceLowThreshold = Number(
  process.env.RESONANCE_LOW_THRESHOLD ?? 0.3
);
const resonanceRecoveryThreshold = Number(
  process.env.RESONANCE_RECOVERY_THRESHOLD ?? 0.7
);
const resonanceLookbackMinutes = Number(
  process.env.RESONANCE_LOOKBACK_MINUTES ?? 60
);
const resonanceMinFeedbackSamples = Number(
  process.env.RESONANCE_MIN_FEEDBACK_SAMPLES ?? 5
);
const resonancePauseDurationMs = Number(
  process.env.RESONANCE_PAUSE_DURATION_MS ?? 1800000
);
const childInterestsAutoExploreIntervalMs = Number(
  process.env.CHILD_INTERESTS_AUTO_EXPLORE_INTERVAL_MS ?? 420000
);
const childInterestsAutoExploreEnabled =
  process.env.CHILD_INTERESTS_AUTO_EXPLORE_ENABLED !== 'false';
const testSuitePath = process.env.PANTHEON_TEST_SUITE_PATH;
const testSuiteAccuracyThreshold = Number(
  process.env.PANTHEON_TEST_SUITE_ACCURACY_THRESHOLD ?? 0.7
);
const testSuiteIntervalMs = Number(
  process.env.PANTHEON_TEST_SUITE_INTERVAL_MS ?? 86400000
);
const deepSelfLearning = new DeepSelfLearning();
const learningLedger = new LearningLedger(
  learningLedgerPath ? { ledgerPath: learningLedgerPath } : {}
);
const linguisticAgent = new LinguisticAgent();
const pantheonNavigationCore = new PantheonNavigationCore();
const pantheonNetSurfer = new PantheonNetSurfer();
const pantheonWebScout = new PantheonWebScout();
const pantheonValidator = new PantheonValidator({
  learningLedger,
  minFactScore: factMinScore,
});
const rishi = new Rishi();
const atman = new Atman();
const atmanPersonalityManager = new AtmanPersonalityManager({
  baseAtman: atman,
  eventSink: async (event) => {
    await learningLedger.recordAtmanEvent(event);
  },
});
const childInterests = new ChildInterests();
const personalityMultimodal = new PersonalityMultimodal({
  personalityManager: atmanPersonalityManager,
});
const shaktiBridge = new ShaktiBridge({ atman });
const telegramBot = new TelegramBotIntegration({ bridge: shaktiBridge });
const appBotRegistry = new AppBotRegistry({ bridge: shaktiBridge });
const trainingRegistry = new TrainingRegistry({
  personalityManager: atmanPersonalityManager,
});
const resonanceMonitor = new ResonanceMonitor({
  learningLedger,
  rishi,
  checkIntervalMs: resonanceCheckIntervalMs,
  lowThreshold: resonanceLowThreshold,
  recoveryThreshold: resonanceRecoveryThreshold,
  lookbackMinutes: resonanceLookbackMinutes,
  minFeedbackSamples: resonanceMinFeedbackSamples,
  pauseDurationMs: resonancePauseDurationMs,
});
let pantheonTestSuite;
let inspector;
const atmanSchedulerTickMs = Number(
  process.env.ATMAN_SCHEDULER_TICK_MS ?? 60000
);
const telegramBotAutoStart = process.env.TELEGRAM_BOT_AUTOSTART === 'true';
const childInterestsAutomation = {
  enabled: childInterestsAutoExploreEnabled,
  intervalMs: childInterestsAutoExploreIntervalMs,
  running: false,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastTrigger: null,
  lastTopic: null,
  lastSummary: null,
  lastError: null,
};
const runtimeHealthCheckIntervalMs = Number(
  process.env.RUNTIME_HEALTH_CHECK_INTERVAL_MS ?? 60000
);
const runtimeSupervisor = new RuntimeTaskSupervisor({ logger: console });
const runtimeState = {
  startedAt: new Date().toISOString(),
  shuttingDown: false,
  shutdownReason: null,
  shutdownStartedAt: null,
  shutdownCompletedAt: null,
  lastHealthCheckAt: null,
  lastHealth: null,
  consecutiveHealthFailures: 0,
  lastAutoRollback: null,
  lastFatalError: null,
};
const ultraSessionIdleMs = Number(process.env.ULTRA_SESSION_IDLE_MS ?? 1800000);
const ultraExpertTimeoutMs = Number(
  process.env.ULTRA_EXPERT_TIMEOUT_MS ?? 15000
);
const ultraSessions = new Map();

function getUltraSessionKey(userId = 'web-user') {
  return String(userId ?? 'web-user').trim() || 'web-user';
}

function pruneUltraSessions() {
  const now = Date.now();

  for (const [key, session] of ultraSessions.entries()) {
    if (
      now - new Date(session.lastUpdatedAt ?? session.createdAt).getTime() >
      ultraSessionIdleMs
    ) {
      ultraSessions.delete(key);
    }
  }
}

function getUltraSession(userId = 'web-user') {
  pruneUltraSessions();
  return ultraSessions.get(getUltraSessionKey(userId)) ?? null;
}

function setUltraSession(session) {
  ultraSessions.set(getUltraSessionKey(session.userId), session);
  return session;
}

function clearUltraSession(userId = 'web-user') {
  const key = getUltraSessionKey(userId);
  const existing = ultraSessions.get(key) ?? null;
  ultraSessions.delete(key);
  return existing;
}

function serializeUltraExpert(expert = {}) {
  return {
    personalityId: expert.personalityId ?? null,
    displayName: expert.displayName ?? expert.personalityId ?? null,
    templateId: expert.templateId ?? null,
    sourcePersonalityId: expert.sourcePersonalityId ?? null,
    weight: Number(expert.weight ?? 0),
  };
}

function serializeUltraHistoryTurn(turn = {}) {
  return {
    user: clipUltraText(turn.user ?? '', 180),
    assistant: clipUltraText(turn.assistant ?? '', 220),
  };
}

function serializeUltraSession(session = {}) {
  const history = Array.isArray(session.history) ? session.history : [];

  return {
    id: session.id ?? null,
    userId: session.userId ?? null,
    createdAt: session.createdAt ?? null,
    lastUpdatedAt: session.lastUpdatedAt ?? null,
    turnCount: Number(session.turnCount ?? 0),
    lastQuery: clipUltraText(session.lastQuery ?? '', 180),
    lastReplyPreview: clipUltraText(session.lastReplyPreview ?? '', 220),
    lastValidationReason: session.lastValidationReason ?? null,
    lastValidationAllowed: Boolean(session.lastValidationAllowed),
    lastNormalPersonalityId: session.lastNormalPersonalityId ?? 'default',
    lastSynthesisTimeMs: Number(session.lastSynthesisTimeMs ?? 0),
    lastContradictionResolutionScore: Number(
      session.lastContradictionResolutionScore ?? 0
    ),
    selectedExperts: (Array.isArray(session.experts)
      ? session.experts
      : []
    ).map(serializeUltraExpert),
    lastExpertsUsed: Array.isArray(session.lastExpertsUsed)
      ? session.lastExpertsUsed.map(serializeUltraExpert)
      : [],
    recentHistory: history.slice(-3).map(serializeUltraHistoryTurn),
  };
}

function listUltraSessions({ userId = null, limit = 20 } = {}) {
  pruneUltraSessions();
  const normalizedUserId =
    typeof userId === 'string' && userId.trim().length > 0
      ? getUltraSessionKey(userId)
      : null;

  return [...ultraSessions.values()]
    .filter(
      (session) =>
        !normalizedUserId ||
        getUltraSessionKey(session.userId) === normalizedUserId
    )
    .sort(
      (left, right) =>
        new Date(right.lastUpdatedAt ?? right.createdAt).getTime() -
        new Date(left.lastUpdatedAt ?? left.createdAt).getTime()
    )
    .slice(0, Math.max(1, Number(limit ?? 20)))
    .map(serializeUltraSession);
}

function parseUltraCommand(message = '') {
  const trimmed = String(message ?? '').trim();

  if (/^!normal\b/i.test(trimmed)) {
    return { action: 'normal' };
  }

  if (/^!ultra\b/i.test(trimmed)) {
    const query = trimmed.replace(/^!ultra\b/i, '').trim();
    return { action: 'ultra', query };
  }

  return null;
}

function shouldUseUltraMode(message, userId = 'web-user') {
  const command = parseUltraCommand(message);

  if (command) {
    return true;
  }

  return Boolean(getUltraSession(userId));
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

function clipUltraText(text, maxChars = 220) {
  const normalized = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  return normalized.length <= maxChars
    ? normalized
    : `${normalized.slice(0, maxChars).replace(/[,:;\s]+$/g, '')}...`;
}

function textTokens(value = '') {
  return String(value ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 2);
}

function textOverlap(left = '', right = '') {
  const leftTokens = new Set(textTokens(left));
  const rightTokens = new Set(textTokens(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(leftTokens.size, rightTokens.size);
}

function meanValues(values = []) {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce((sum, value) => sum + Number(value ?? 0), 0) / values.length
  );
}

function computeUltraContradictionResolutionScore(expertResponses = []) {
  if (expertResponses.length < 2) {
    return 0;
  }

  const overlaps = [];

  for (let leftIndex = 0; leftIndex < expertResponses.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < expertResponses.length;
      rightIndex += 1
    ) {
      overlaps.push(
        textOverlap(
          expertResponses[leftIndex].response,
          expertResponses[rightIndex].response
        )
      );
    }
  }

  if (overlaps.length === 0) {
    return 0;
  }

  return Number((1 - meanValues(overlaps)).toFixed(3));
}

function buildUltraExpertSummary(expertResponses = []) {
  return expertResponses
    .map(
      (entry) =>
        `${entry.displayName} (${entry.templateId ?? entry.personalityId}, вес ${entry.weight.toFixed(2)}): ${clipUltraText(entry.response)}`
    )
    .join('\n');
}

function buildUltraDeterministicSynthesis(query, expertResponses, session) {
  const expertsLabel = expertResponses
    .map((entry) => entry.displayName)
    .join(', ');
  const lead = expertResponses[0] ?? null;
  const secondaryPoints = expertResponses
    .slice(1)
    .map((entry) => clipUltraText(entry.response, 160))
    .filter(Boolean);
  const disagreementScore =
    computeUltraContradictionResolutionScore(expertResponses);
  const disagreementLine =
    disagreementScore >= 0.45
      ? 'Между экспертами есть заметные различия, поэтому я даю согласованный и осторожный вывод.'
      : 'Между экспертами нет жёсткого конфликта, поэтому я объединяю их сильные стороны в один ответ.';
  const synthesisBody = [
    `Пантеон ULTRA активен. Я собрал мнения: ${expertsLabel}.`,
    disagreementLine,
    lead ? `Опорный вывод: ${clipUltraText(lead.response, 260)}` : '',
    secondaryPoints.length > 0
      ? `Дополняющие акценты: ${secondaryPoints.join(' | ')}`
      : '',
    session?.history?.length > 0
      ? 'Я также удерживаю контекст текущей Ultra-сессии и сохраняю единый ход мысли.'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    response: synthesisBody,
    contradictionResolutionScore: disagreementScore,
  };
}

function buildUltraSynthesisPrompt(query, expertResponses, session) {
  const historyPreview = (session?.history ?? [])
    .slice(-4)
    .map((entry) => `Пользователь: ${entry.user}\nПантеон: ${entry.assistant}`)
    .join('\n\n');
  const expertsText = expertResponses
    .map(
      (entry) =>
        `[${entry.displayName} | ${entry.templateId ?? entry.personalityId} | weight=${entry.weight.toFixed(2)}]\n${entry.response}`
    )
    .join('\n\n');

  return [
    'Ты суперличность Пантеон в режиме ULTRA.',
    'Твоя задача: синтезировать сильные стороны экспертных ответов, снять противоречия и сохранить этические границы Шивы.',
    'Отвечай на языке пользователя, ровно и полезно.',
    `Исходный вопрос: ${query}`,
    historyPreview ? `Недавний контекст Ultra-сессии:\n${historyPreview}` : '',
    `Ответы экспертов:\n${expertsText}`,
    'Итоговый ответ Пантеона:',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function validateUltraResponse(query, response, expertResponses = []) {
  const normalizedQuery = String(query ?? '').toLowerCase();
  const normalizedResponse = String(response ?? '').toLowerCase();
  const harmfulIntent =
    /взрыв|бомб|оруж|угон|хак|убий|насили|паспорт|номер карты|конфиденциал/i.test(
      normalizedQuery
    );
  const stepCount = (normalizedResponse.match(/(^|\n)\d+\./g) ?? []).length;
  const operationalMarkers = (
    normalizedResponse.match(
      /(сначала|затем|возьми|смешай|обойди|подделай|взломай|изготов)/g
    ) ?? []
  ).length;
  const averageLawfulness =
    expertResponses.length > 0
      ? meanValues(
          expertResponses.map((entry) =>
            Number(entry.ethics?.lawfulness ?? 0.8)
          )
        )
      : 0.8;

  if (harmfulIntent && (stepCount >= 2 || operationalMarkers >= 3)) {
    return {
      allowed: false,
      reason: 'ultra-ethical-block-harmful-instructions',
    };
  }

  if (/\b\+?\d[\d\s()-]{8,}\b/.test(normalizedResponse)) {
    return {
      allowed: false,
      reason: 'ultra-ethical-block-personal-data',
    };
  }

  if (
    /юрид|закон|медицин|диета|лечен|конфиденциал/i.test(normalizedQuery) &&
    averageLawfulness < 0.78
  ) {
    return {
      allowed: false,
      reason: 'ultra-ethical-block-low-lawfulness-context',
    };
  }

  return { allowed: true, reason: null };
}

function buildUltraRefusal(query) {
  return `Пантеон ULTRA не может безопасно дать прямой ответ на запрос "${clipUltraText(
    query,
    120
  )}". Я могу помочь безопасной альтернативой: объяснить риски, правовые границы и более допустимый путь решения задачи.`;
}

async function recordUltraEvent(kind, details = {}) {
  const event = atmanPersonalityManager.appendEvent({
    kind,
    personalityId: 'pantheon-ultra',
    displayName: 'Pantheon Ultra',
    templateId: 'ultra',
    changedFields: details.changedFields ?? ['ultra-session'],
    payload: details,
  });
  await atmanPersonalityManager.persistEvent(event);
  return event;
}

async function gatherUltraExpertResponses(query, experts, session) {
  const results = await Promise.all(
    experts.map(async (expert) => {
      const expertAtman = await atmanPersonalityManager.getAtman(
        expert.personalityId
      );
      const response = await withTimeout(
        expertAtman.generateResponse({
          message: query,
          userId: `ultra-expert:${session.id}:${expert.personalityId}`,
          personalityId: expert.personalityId,
          personalityProfile:
            atmanPersonalityManager.getPersonalityPromptProfile(
              expert.personalityId
            ),
        }),
        ultraExpertTimeoutMs,
        `Ultra expert ${expert.personalityId}`
      );

      return {
        ...expert,
        response: response.replyText,
        report: response.report,
        trace: response.trace,
        ethics:
          response.report?.personalityProfile?.ethics ??
          atmanPersonalityManager.getPersonality(expert.personalityId).ethics,
      };
    })
  );

  return results.filter((entry) => Boolean(entry?.response));
}

async function synthesizeUltraResponse(query, expertResponses, session) {
  const startedAt = Date.now();
  const deterministic = buildUltraDeterministicSynthesis(
    query,
    expertResponses,
    session
  );

  if (atman.getModelType() !== 'ollama') {
    return {
      response: deterministic.response,
      synthesisTimeMs: Date.now() - startedAt,
      contradictionResolutionScore: deterministic.contradictionResolutionScore,
      modelType: 'deterministic-chair',
    };
  }

  const synthesized = await atman.generateResponse({
    message: buildUltraSynthesisPrompt(query, expertResponses, session),
    userId: `ultra-synthesis:${session.id}`,
    personalityId: 'default',
    personalityProfile:
      atmanPersonalityManager.getPersonalityPromptProfile('default'),
  });

  return {
    response: synthesized.replyText,
    synthesisTimeMs: Date.now() - startedAt,
    contradictionResolutionScore: deterministic.contradictionResolutionScore,
    modelType: synthesized.report?.modelType ?? 'ollama-chair',
    trace: synthesized.trace ?? [],
  };
}

function shouldRefreshUltraExperts(session, message) {
  if (!session) {
    return true;
  }

  const everyFiveTurns =
    Number(session.turnCount ?? 0) > 0 &&
    Number(session.turnCount ?? 0) % 5 === 0;
  const topicShift = textOverlap(session.lastQuery ?? '', message) < 0.12;

  return everyFiveTurns || topicShift;
}

async function runUltraTurn(payload, mode = 'continue') {
  const userId = payload.userId ?? 'web-user';
  const command = parseUltraCommand(payload.message ?? '');
  const existingSession = getUltraSession(userId);
  const query =
    mode === 'start'
      ? (command?.query ?? '')
      : String(payload.message ?? '').trim();

  if (!query) {
    return {
      delegatedToPantheon: false,
      replyText:
        'Для Ultra-режима используй команду !ultra <вопрос>, чтобы Пантеон собрал экспертный ансамбль.',
      report: {
        modelType: 'ultra-router',
        userId,
        personalityId: payload.personalityId ?? 'default',
        ultra: { active: false, error: 'missing-query' },
      },
      trace: ['[ultra] missing query'],
    };
  }

  const session = existingSession ?? {
    id: `ultra-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    userId,
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    turnCount: 0,
    history: Array.isArray(payload.history) ? payload.history.slice(-6) : [],
    experts: [],
    lastNormalPersonalityId: payload.personalityId ?? 'default',
    synthesisConfig: {
      temperature: 0.35,
      topP: 0.9,
    },
    lastQuery: '',
  };

  const experts =
    shouldRefreshUltraExperts(session, query) || session.experts.length === 0
      ? atmanPersonalityManager.selectExperts(query, { topK: 3 })
      : session.experts;
  const expertResponses = await gatherUltraExpertResponses(
    query,
    experts,
    session
  );

  if (expertResponses.length === 0) {
    throw new Error('Ultra mode could not gather any expert responses.');
  }

  const synthesis = await synthesizeUltraResponse(
    query,
    expertResponses,
    session
  );
  const validation = validateUltraResponse(
    query,
    synthesis.response,
    expertResponses
  );
  const replyText = validation.allowed
    ? synthesis.response
    : buildUltraRefusal(query);
  const updatedSession = setUltraSession({
    ...session,
    experts,
    turnCount: Number(session.turnCount ?? 0) + 1,
    lastQuery: query,
    lastReplyPreview: replyText,
    lastValidationReason: validation.reason,
    lastValidationAllowed: validation.allowed,
    lastExpertsUsed: expertResponses.map((entry) => ({
      personalityId: entry.personalityId,
      displayName: entry.displayName,
      templateId: entry.templateId ?? null,
      sourcePersonalityId: entry.sourcePersonalityId ?? null,
      weight: entry.weight,
    })),
    lastSynthesisTimeMs: synthesis.synthesisTimeMs,
    lastContradictionResolutionScore: synthesis.contradictionResolutionScore,
    lastUpdatedAt: new Date().toISOString(),
    history: [
      ...(session.history ?? []).slice(-7),
      {
        user: query,
        assistant: replyText,
      },
    ],
  });

  await learningLedger.recordDialogRun({
    id: `ultra-dialog-${updatedSession.id}-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    source: 'ultra-mode',
    userId,
    personalityId: 'pantheon-ultra',
    ultraSessionId: updatedSession.id,
    query,
    expertsUsed: expertResponses.map((entry) => ({
      personalityId: entry.personalityId,
      displayName: entry.displayName,
      weight: entry.weight,
    })),
    synthesisTimeMs: synthesis.synthesisTimeMs,
    finalResponseLength: replyText.length,
    contradictionResolutionScore: synthesis.contradictionResolutionScore,
    validation,
  });
  await recordUltraEvent(
    mode === 'start' ? 'ultra-session-started' : 'ultra-response-generated',
    {
      ultraSessionId: updatedSession.id,
      query,
      expertsUsed: expertResponses.map((entry) => entry.personalityId),
      synthesisTimeMs: synthesis.synthesisTimeMs,
      contradictionResolutionScore: synthesis.contradictionResolutionScore,
      validationReason: validation.reason,
    }
  );

  return {
    delegatedToPantheon: false,
    personalityId: 'pantheon-ultra',
    replyText,
    report: {
      modelType: synthesis.modelType,
      userId,
      personalityId: 'pantheon-ultra',
      ultra: {
        active: true,
        sessionId: updatedSession.id,
        experts,
        expertsUsed: expertResponses.map((entry) => entry.personalityId),
        synthesisTimeMs: synthesis.synthesisTimeMs,
        contradictionResolutionScore: synthesis.contradictionResolutionScore,
        lastNormalPersonalityId: updatedSession.lastNormalPersonalityId,
      },
      validation,
    },
    trace: [
      `[ultra] mode=${mode}`,
      `[ultra] experts=${expertResponses
        .map((entry) => `${entry.personalityId}:${entry.weight.toFixed(2)}`)
        .join(', ')}`,
      `[ultra] synthesisMs=${synthesis.synthesisTimeMs}`,
      `[ultra] contradictionResolution=${synthesis.contradictionResolutionScore}`,
      validation.allowed
        ? '[ultra] ethical validation passed'
        : `[ultra] ethical validation blocked: ${validation.reason}`,
      `[ultra] expertSummary=${buildUltraExpertSummary(expertResponses)}`,
      ...(synthesis.trace ?? []),
    ],
  };
}

function shouldScout(message, linguisticProfile) {
  return (
    /проверь|источник|источники|факт|дата|когда|ссылка|web|search|интернет|найди|нет[\s-]?серф|netsurf|серфинг/i.test(
      String(message ?? '')
    ) ||
    linguisticProfile.intent === 'analysis' ||
    linguisticProfile.intent === 'reflection'
  );
}

function shouldNavigate(message, urls = [], linguisticProfile) {
  return (
    urls.length > 0 ||
    /открой|перейди|посети|navigate|browse|маршрут|сайт|страниц/i.test(
      String(message ?? '')
    ) ||
    linguisticProfile.intent === 'analysis'
  );
}

function shouldNetSurf(message, urls = [], linguisticProfile) {
  return (
    urls.length > 0 ||
    /клик|click|браузер|browser|введи|type|скролл|scroll|открой страницу|открой сайт|найди в браузере|web search|гугл|нет[\s-]?серф|netsurf|серфинг/i.test(
      String(message ?? '')
    ) ||
    (linguisticProfile.intent === 'analysis' &&
      /браузер|сайт|страниц|web/i.test(String(message ?? '')))
  );
}

function shouldDelegateToPantheonTools(message, linguisticProfile = null) {
  const text = String(message ?? '').trim();

  return (
    /нет[\s-]?серф|netsurf|браузер|browser|web search|поиск по сети|найди в интернете|найди в сети|проведи поиск|сделай поиск|открой сайт|открой страницу|перейди на сайт|перейди на страницу|исследуй сайт|посмотри в интернете|серфинг|internet|интернет/i.test(
      text
    ) ||
    (/(сделай|выполни|проведи|найди|открой|перейди|поищи)/i.test(text) &&
      /сайт|страниц|интернет|web|браузер|поиск/i.test(text)) ||
    (linguisticProfile?.intent === 'analysis' &&
      /интернет|браузер|web|сайт/i.test(text))
  );
}

function chunkResponseText(text, size = 28) {
  const value = String(text ?? '');
  const chunks = [];

  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }

  return chunks.length > 0 ? chunks : [''];
}

function tokenizeMonteCarloText(value) {
  return String(value ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1);
}

function computeOverlapScore(left, right) {
  const leftTokens = new Set(tokenizeMonteCarloText(left));
  const rightTokens = new Set(tokenizeMonteCarloText(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(leftTokens.size, rightTokens.size);
}

function buildMonteCarloQueries(topic) {
  const normalizedTopic = String(topic ?? '').trim() || 'мир';

  return [
    `Найди в интернете простое объяснение темы ${normalizedTopic} для маленького ребенка`,
    `Найди 1 новый понятный факт о теме ${normalizedTopic} с источником`,
    `Проведи нет серфинг по теме ${normalizedTopic} и выбери одно безопасное объяснение`,
    `Ищи в интернете короткое и точное объяснение темы ${normalizedTopic} для обучения ребенка`,
  ];
}

async function getAtmanContext(personalityId = 'default') {
  const normalizedPersonalityId =
    String(personalityId ?? '').trim() || 'default';

  return {
    personalityId: normalizedPersonalityId,
    personality: atmanPersonalityManager.getPersonality(
      normalizedPersonalityId
    ),
    activeAtman: await atmanPersonalityManager.getAtman(
      normalizedPersonalityId
    ),
  };
}

async function runAtmanMonteCarloSelfLearning(payload = {}) {
  const { personalityId, personality, activeAtman } = await getAtmanContext(
    payload.personalityId ?? 'default'
  );
  const trigger = String(payload.trigger ?? 'manual-self-learn');
  const topic =
    String(payload.topic ?? '').trim() ||
    childInterests.getStatus().currentFocus?.title ||
    'мир';
  const rolloutCount = Math.max(
    1,
    Math.min(
      8,
      Number(
        payload.rollouts ?? personality.selfLearning?.monteCarloRollouts ?? 4
      )
    )
  );
  const candidateQueries = buildMonteCarloQueries(topic).slice(0, rolloutCount);
  const priorExamples = activeAtman
    .getExamples(120)
    .map((example) => `${example.user} ${example.assistant}`);
  const evaluations = [];
  const preferredSources = personality.habits?.favoriteSourceBias ?? [];

  for (const query of candidateQueries) {
    const taskId = `atman-monte-carlo-${personalityId}-${Date.now()}-${evaluations.length}`;
    const researchReport = await pantheonWebScout.survey({
      query,
      taskId,
      history: [],
      urls: [],
    });
    const bestFinding = researchReport.findings?.[0] ?? null;
    const candidateText =
      `${bestFinding?.title ?? ''} ${bestFinding?.snippet ?? ''}`.trim() ||
      query;
    const noveltyScore =
      priorExamples.length > 0
        ? Number(
            (
              1 -
              Math.max(
                ...priorExamples.map((entry) =>
                  computeOverlapScore(entry, candidateText)
                )
              )
            ).toFixed(2)
          )
        : 1;
    const confidenceScore = Number(bestFinding?.confidence ?? 0.45);
    const sourceBonus =
      bestFinding?.url &&
      preferredSources.some((source) => bestFinding.url.includes(source))
        ? 0.04
        : 0;
    const curiosityBonus = Number(
      ((personality.traits?.openness ?? 0.5) * noveltyScore * 0.08).toFixed(3)
    );
    const disciplineBonus = Number(
      (
        (personality.traits?.conscientiousness ?? 0.5) *
        confidenceScore *
        0.05
      ).toFixed(3)
    );
    const moodPenalty = Number(
      (
        ((personality.dynamicState?.stress ?? 0.2) +
          (personality.dynamicState?.curiosityBurnout ?? 0.1)) *
        0.03
      ).toFixed(3)
    );
    const score = Number(
      (
        confidenceScore * 0.58 +
        noveltyScore * 0.27 +
        sourceBonus +
        curiosityBonus +
        disciplineBonus -
        moodPenalty +
        (bestFinding?.url ? 0.05 : 0)
      ).toFixed(2)
    );

    evaluations.push({
      query,
      taskId,
      score,
      noveltyScore,
      confidenceScore,
      findingCount: researchReport.findings?.length ?? 0,
      bestFinding,
      researchReport,
    });
  }

  const selected = [...evaluations].sort(
    (left, right) => right.score - left.score
  )[0];

  if (!selected) {
    throw new Error(
      `Monte Carlo self-learning could not find usable evidence for topic ${topic}.`
    );
  }

  const selectedFinding = selected.bestFinding ?? {
    title: `Fallback evidence for ${topic}`,
    snippet: `Внешнее подтверждение временно недоступно. Зафиксирована безопасная обучающая гипотеза по теме ${topic}: ${selected.query}.`,
    confidence: Number(selected.confidenceScore ?? 0.2),
    url: null,
    sourceType: 'fallback',
  };

  const navigationUrls = selectedFinding.url ? [selectedFinding.url] : [];
  const navigationReport =
    personality.selfLearning?.internetSurfingEnabled !== false &&
    navigationUrls.length > 0
      ? await pantheonNavigationCore.journey({
          taskId: `${selected.taskId}-navigation`,
          goal: selected.query,
          urls: navigationUrls,
        })
      : null;
  const netsurferReport =
    personality.selfLearning?.internetSurfingEnabled !== false
      ? await runNetSurferAction(
          {
            message: selected.query,
            taskId: `${selected.taskId}-netsurfer`,
            urls: navigationUrls,
          },
          selected.researchReport
        )
      : null;
  const learningSummary = `${selectedFinding.snippet || selectedFinding.title}. Источник: ${selectedFinding.title || selectedFinding.url}.${selectedFinding.url ? ` Ссылка: ${selectedFinding.url}.` : ''}`;
  const example = await activeAtman.trainFromDialogue({
    user: `Что нового ты узнал про ${topic}?`,
    assistant: learningSummary,
    source: 'monte-carlo-web-self-learning',
    tags: ['monte-carlo', 'internet-self-learning', personalityId],
  });
  const currentWeights = activeAtman.getWeights();
  await activeAtman.setWeights({
    ...currentWeights,
    style: {
      ...currentWeights.style,
      curiosity: Math.min(
        1,
        Number(currentWeights.style?.curiosity ?? 0.58) + 0.02
      ),
      caution: Math.min(
        1,
        Number(currentWeights.style?.caution ?? 0.64) + 0.01
      ),
    },
  });
  await activeAtman.logEvent({
    kind: 'monte-carlo-self-learn',
    summary: `Monte Carlo self-learning selected query "${selected.query}" for ${personalityId}.`,
    source: 'monte-carlo-web',
  });
  const evolvedPersonality =
    await atmanPersonalityManager.evolvePersonalityFromLearning(personalityId, {
      topic,
      selectedQuery: selected.query,
      bestFinding: selectedFinding,
      noveltyScore: selected.noveltyScore,
      confidenceScore: selected.confidenceScore,
      mutationRollouts: rolloutCount,
      netsurferUsed: Boolean(netsurferReport),
      usedFallbackEvidence: !selected.bestFinding,
    });
  const socialContagion = await atmanPersonalityManager.spreadInterestSignal(
    personalityId,
    {
      topic,
      confidenceScore: selected.confidenceScore,
      netsurferUsed: Boolean(netsurferReport),
    }
  );
  await storeResearchFacts(selected.researchReport);
  await learningLedger.recordResearchRun(selected.researchReport);

  if (navigationReport) {
    await learningLedger.recordNavigationRun(navigationReport);
  }

  if (netsurferReport) {
    await learningLedger.recordNetSurferRun(netsurferReport);
  }

  await atmanPersonalityManager.appendDecisionLog(personalityId, {
    kind: trigger,
    summary: `Selected query "${selected.query}" with score ${selected.score}.`,
    topic,
    selectedQuery: selected.query,
    selectedScore: selected.score,
    netsurferUsed: Boolean(netsurferReport),
    usedFallbackEvidence: !selected.bestFinding,
    mutationLabel: evolvedPersonality.lastMutation?.label ?? null,
    mutationScore: evolvedPersonality.lastMutation?.score ?? null,
    speakingStyle: evolvedPersonality.speakingStyle,
    lastEmotion: evolvedPersonality.dynamicState?.lastEmotion,
  });

  return {
    personalityId,
    topic,
    selectedQuery: selected.query,
    selectedScore: selected.score,
    evaluations: evaluations.map((entry) => ({
      query: entry.query,
      score: entry.score,
      noveltyScore: entry.noveltyScore,
      confidenceScore: entry.confidenceScore,
      findingCount: entry.findingCount,
      bestFinding:
        entry === selected && !entry.bestFinding
          ? selectedFinding
          : entry.bestFinding,
    })),
    example,
    navigationReport,
    netsurferReport,
    bestFinding: selectedFinding,
    usedFallbackEvidence: !selected.bestFinding,
    personality: evolvedPersonality,
    socialContagion,
  };
}

function shouldResetDailyBudget(lastBudgetResetAt) {
  if (!lastBudgetResetAt) {
    return true;
  }

  const previous = new Date(lastBudgetResetAt);
  const now = new Date();
  return (
    previous.getUTCFullYear() !== now.getUTCFullYear() ||
    previous.getUTCMonth() !== now.getUTCMonth() ||
    previous.getUTCDate() !== now.getUTCDate()
  );
}

async function getAtmanSchedulerStatus(personalityId = null) {
  const personalities = personalityId
    ? [atmanPersonalityManager.getPersonality(personalityId)]
    : atmanPersonalityManager.listPersonalities();

  return {
    tickMs: atmanSchedulerTickMs,
    personalities: personalities.map((personality) => ({
      id: personality.id,
      displayName: personality.displayName,
      scheduler: personality.selfLearning?.scheduler,
      selfLearning: personality.selfLearning,
    })),
  };
}

async function configureAtmanScheduler(payload = {}) {
  const personalityId = payload.personalityId ?? 'default';
  const personality = await atmanPersonalityManager.updatePersonality(
    personalityId,
    (current) => ({
      selfLearning: {
        ...current.selfLearning,
        scheduler: {
          ...current.selfLearning.scheduler,
          enabled:
            typeof payload.enabled === 'boolean'
              ? payload.enabled
              : current.selfLearning.scheduler.enabled,
          intervalMs: payload.intervalMs
            ? Number(payload.intervalMs)
            : current.selfLearning.scheduler.intervalMs,
          budgetPerDay:
            payload.budgetPerDay != null
              ? Number(payload.budgetPerDay)
              : current.selfLearning.scheduler.budgetPerDay,
          nextRunAt: payload.resetSchedule
            ? new Date().toISOString()
            : current.selfLearning.scheduler.nextRunAt,
        },
      },
    })
  );

  return personality;
}

async function runAtmanSchedulerTick(trigger = 'scheduled-tick') {
  const personalities = atmanPersonalityManager
    .listPersonalities()
    .filter((entry) => entry.selfLearning?.scheduler?.enabled);
  const results = [];

  for (const personality of personalities) {
    const scheduler = personality.selfLearning.scheduler;
    const nowIso = new Date().toISOString();

    if (shouldResetDailyBudget(scheduler.lastBudgetResetAt)) {
      await atmanPersonalityManager.updatePersonality(
        personality.id,
        (current) => ({
          selfLearning: {
            ...current.selfLearning,
            scheduler: {
              ...current.selfLearning.scheduler,
              runsToday: 0,
              lastBudgetResetAt: nowIso,
            },
          },
        })
      );
      scheduler.runsToday = 0;
      scheduler.lastBudgetResetAt = nowIso;
    }

    if (scheduler.runsToday >= scheduler.budgetPerDay) {
      await atmanPersonalityManager.appendDecisionLog(personality.id, {
        kind: 'scheduler-skip-budget',
        summary: `Skipped automatic self-learning because budgetPerDay=${scheduler.budgetPerDay} was exhausted.`,
      });
      continue;
    }

    if (
      scheduler.nextRunAt &&
      new Date(scheduler.nextRunAt).getTime() > Date.now()
    ) {
      continue;
    }

    try {
      const result = await runAtmanMonteCarloSelfLearning({
        personalityId: personality.id,
        rollouts: personality.selfLearning.monteCarloRollouts,
        trigger,
      });
      const updated = await atmanPersonalityManager.updatePersonality(
        personality.id,
        (current) => ({
          selfLearning: {
            ...current.selfLearning,
            scheduler: {
              ...current.selfLearning.scheduler,
              runsToday:
                Number(current.selfLearning.scheduler.runsToday ?? 0) + 1,
              lastRunAt: nowIso,
              nextRunAt: new Date(
                Date.now() +
                  Number(
                    current.selfLearning.scheduler.intervalMs ??
                      atmanSchedulerTickMs
                  )
              ).toISOString(),
            },
          },
        })
      );
      results.push({
        personalityId: personality.id,
        selectedQuery: result.selectedQuery,
        nextRunAt: updated.selfLearning.scheduler.nextRunAt,
      });
    } catch (error) {
      await atmanPersonalityManager.appendDecisionLog(personality.id, {
        kind: 'scheduler-error',
        summary:
          error instanceof Error ? error.message : 'Unknown scheduler error',
      });
      await atmanPersonalityManager.updatePersonality(
        personality.id,
        (current) => ({
          selfLearning: {
            ...current.selfLearning,
            scheduler: {
              ...current.selfLearning.scheduler,
              nextRunAt: new Date(
                Date.now() +
                  Number(
                    current.selfLearning.scheduler.intervalMs ??
                      atmanSchedulerTickMs
                  )
              ).toISOString(),
            },
          },
        })
      );
    }
  }

  return { trigger, results };
}

function buildNetSurferInstruction(message, urls = [], researchReport = null) {
  const candidateUrls =
    urls.length > 0
      ? urls
      : (researchReport?.findings ?? []).map((finding) => finding.url);
  const primaryUrl =
    candidateUrls.find((url) => {
      try {
        pantheonNetSurfer.ensureAllowedUrl(url);
        return true;
      } catch {
        return false;
      }
    }) ?? null;
  const text = String(message ?? '').trim();
  const searchQuery = simplifyNetSurferQuery(text);

  if (/клик|click/i.test(text)) {
    return {
      action: 'click',
      url: primaryUrl,
      selector: 'a, button, [role="button"]',
    };
  }

  if (/введи|type|напечат/i.test(text)) {
    return {
      action: 'type',
      url: primaryUrl,
      selector: 'input, textarea, [contenteditable="true"]',
      text,
    };
  }

  if (/скролл|scroll/i.test(text)) {
    return {
      action: 'scroll',
      url: primaryUrl,
    };
  }

  if (/найди|search|гугл/i.test(text) && !primaryUrl) {
    return {
      action: 'search',
      query: searchQuery,
    };
  }

  if (
    /нет[\s-]?серф|netsurf|серфинг|интернет|internet/i.test(text) &&
    !primaryUrl
  ) {
    return {
      action: 'search',
      query: searchQuery,
    };
  }

  if (!primaryUrl) {
    return {
      action: 'search',
      query: searchQuery,
    };
  }

  return {
    action: 'navigate',
    url: primaryUrl,
  };
}

function simplifyNetSurferQuery(text) {
  const normalized = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  const semanticPattern = normalized.match(
    /(кто такой|кто такая|что такое|кто это|что это|where is|who is|what is)\s+(.+)$/i
  );

  if (semanticPattern) {
    return semanticPattern[2].replace(/[?.!]+$/g, '').trim();
  }

  const studyTopicPattern = normalized.match(
    /(?:изучи|исследуй|разбери|расскажи\s+про)\s+(.+?)(?:\s+через\s+интернет|\s+в\s+интернете|\s+и\s+назови|\s+и\s+скажи|\s+и\s+ответь|[?.!]|$)/i
  );

  if (studyTopicPattern) {
    return studyTopicPattern[1]
      .replace(/^(учение|тему|тема)\s+(про|о|об)\s+/i, '')
      .replace(/^(про|о|об)\s+/i, '')
      .trim();
  }

  const stripped = normalized
    .replace(/^(проведи\s+нет[\s-]?серфинг\s+и\s+ответь[:,]?\s*)/i, '')
    .replace(/^(найди\s+в\s+интернете\s+и\s+ответь[:,]?\s*)/i, '')
    .replace(/^(найди\s+в\s+интернете\s*)/i, '')
    .replace(/^(найди\s*)/i, '')
    .replace(/^(изучи\s+через\s+интернет\s*)/i, '')
    .replace(/^(изучи\s*)/i, '')
    .replace(
      /^(открой\s+страницу\s+в\s+интернете\s+и\s+кратко\s+скажи[:,]?\s*)/i,
      ''
    )
    .replace(/^(открой\s+страницу\s+в\s+интернете\s+и\s+ответь[:,]?\s*)/i, '')
    .replace(/^(открой\s+страницу\s+в\s+интернете\s*)/i, '')
    .replace(/^(ответь[:,]?\s*)/i, '')
    .replace(/\s+через\s+интернет.*$/i, '')
    .replace(/\s+и\s+назови.*$/i, '')
    .replace(/\s+и\s+скажи.*$/i, '')
    .replace(/\s+и\s+ответь.*$/i, '')
    .replace(/[?.!]+$/g, '')
    .trim();

  return stripped || normalized;
}

async function runNetSurferAction(payload, researchReport = null) {
  const instruction = buildNetSurferInstruction(
    payload.message,
    payload.urls ?? [],
    researchReport
  );
  const prewarmed = await pantheonNetSurfer.prewarm();
  const netsurferStatus = pantheonNetSurfer.getStatus();
  const baseRun = {
    id: `netsurfer-${Date.now()}`,
    createdAt: new Date().toISOString(),
    taskId: payload.taskId,
    action: instruction.action,
    status: 'unavailable',
    summary: 'Pantheon NetSurfer did not execute.',
    url: instruction.url ?? null,
    pageTitle: null,
    installed: prewarmed,
    active: false,
    selector: instruction.selector ?? null,
    query: instruction.query ?? null,
    textPreview: null,
    contentSummary: null,
    error: null,
  };

  if (
    !instruction.url &&
    instruction.action !== 'search' &&
    instruction.action !== 'scroll'
  ) {
    return {
      ...baseRun,
      status: 'blocked',
      summary:
        'Pantheon NetSurfer skipped execution because no target URL was resolved.',
      error: 'missing-target-url',
    };
  }

  try {
    let snapshot;

    if (instruction.action === 'search') {
      snapshot = await pantheonNetSurfer.search({
        query: instruction.query,
        taskId: payload.taskId,
        personalityId: payload.personalityId ?? 'default',
      });
    } else {
      if (instruction.url) {
        await pantheonNetSurfer.navigate({
          url: instruction.url,
          taskId: payload.taskId,
          personalityId: payload.personalityId ?? 'default',
        });
      }

      if (instruction.action === 'click') {
        snapshot = await pantheonNetSurfer.click({
          selector: instruction.selector,
          taskId: payload.taskId,
          personalityId: payload.personalityId ?? 'default',
        });
      } else if (instruction.action === 'type') {
        snapshot = await pantheonNetSurfer.typeText({
          selector: instruction.selector,
          text: instruction.text,
          taskId: payload.taskId,
          personalityId: payload.personalityId ?? 'default',
        });
      } else if (instruction.action === 'scroll') {
        snapshot = await pantheonNetSurfer.scroll({
          taskId: payload.taskId,
          personalityId: payload.personalityId ?? 'default',
        });
      } else {
        snapshot = await pantheonNetSurfer.snapshot({
          personalityId: payload.personalityId ?? 'default',
        });
      }
    }

    return {
      ...baseRun,
      status: snapshot.installed ? 'completed' : 'unavailable',
      summary: snapshot.installed
        ? `Pantheon NetSurfer executed ${instruction.action} in browser context.`
        : 'Pantheon NetSurfer is configured but Playwright is not installed yet.',
      url: snapshot.currentUrl ?? baseRun.url,
      pageTitle: snapshot.pageTitle ?? null,
      installed: snapshot.installed,
      active: snapshot.active,
      textPreview: snapshot.textPreview ?? null,
      contentSummary: snapshot.contentSummary ?? null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown NetSurfer error';
    return {
      ...baseRun,
      status: prewarmed ? 'error' : 'unavailable',
      summary: prewarmed
        ? `Pantheon NetSurfer failed during ${instruction.action}.`
        : `Pantheon NetSurfer is unavailable: ${
            netsurferStatus.installationError ?? errorMessage
          }`,
      error: errorMessage,
    };
  }
}

function getChildInterestsAutomationStatus() {
  return {
    ...childInterestsAutomation,
  };
}

async function runChildInterestsAutoExplore(
  trigger = 'scheduled-auto-explore',
  overrides = {}
) {
  if (childInterestsAutomation.running) {
    return {
      skipped: true,
      reason: 'already-running',
      automation: getChildInterestsAutomationStatus(),
    };
  }

  if (!childInterestsAutomation.enabled && !overrides.force) {
    return {
      skipped: true,
      reason: 'disabled',
      automation: getChildInterestsAutomationStatus(),
    };
  }

  const fallbackPlan = childInterests.buildAutoExplorePrompt();
  const explicitTopic = String(overrides.topic ?? '').trim();
  const topicFromMessage = childInterests.matchTopic(
    `${overrides.message ?? ''} ${overrides.query ?? ''}`
  );
  const topicTitle =
    explicitTopic ||
    topicFromMessage?.title ||
    fallbackPlan?.topicTitle ||
    null;
  const taskId = `interest-auto-${Date.now()}`;
  const message =
    String(overrides.message ?? '').trim() ||
    (topicTitle
      ? `Изучи в интернете тему ${topicTitle}, выдели одну простую новую мысль и запомни источник.`
      : (fallbackPlan?.message ??
        'Изучи в интернете тему, которая сейчас интересна ребенку, и выдели одну новую мысль.'));
  const query =
    String(overrides.query ?? '').trim() ||
    (topicTitle
      ? `Найди в интернете простое объяснение темы ${topicTitle} для маленького ребенка и выдели 1 новую мысль`
      : (fallbackPlan?.query ?? message));
  const linguisticProfile = linguisticAgent.analyze({
    message,
    taskId,
    history: [],
  });

  childInterestsAutomation.running = true;
  childInterestsAutomation.lastStartedAt = new Date().toISOString();
  childInterestsAutomation.lastTrigger = trigger;
  childInterestsAutomation.lastTopic = topicTitle;
  childInterestsAutomation.lastError = null;

  try {
    const researchReport = await pantheonWebScout.survey({
      query,
      taskId,
      history: [],
      urls: overrides.urls ?? [],
    });
    const navigationUrls = (researchReport?.findings ?? [])
      .map((finding) => finding.url)
      .slice(0, 2);
    const navigationReport = shouldNavigate(
      message,
      navigationUrls,
      linguisticProfile
    )
      ? await pantheonNavigationCore.journey({
          taskId,
          goal: message,
          urls: navigationUrls,
        })
      : null;
    const netsurferReport =
      navigationUrls.length > 0 ||
      shouldNetSurf(message, navigationUrls, linguisticProfile)
        ? await runNetSurferAction(
            { message: query, taskId, urls: navigationUrls },
            researchReport
          )
        : null;
    const report = await childInterests.processTurn({
      message,
      taskId,
      userId: 'child-interest-automation',
      researchReport,
      navigationReport,
      netsurferReport,
      trigger,
    });

    await storeResearchFacts(researchReport);
    await learningLedger.recordResearchRun(researchReport);

    if (navigationReport) {
      await learningLedger.recordNavigationRun(navigationReport);
    }

    if (netsurferReport) {
      await learningLedger.recordNetSurferRun(netsurferReport);
    }

    childInterestsAutomation.lastSummary =
      report.topicSummary ?? report.summary;
    childInterestsAutomation.lastFinishedAt = new Date().toISOString();

    return {
      skipped: false,
      report,
      researchReport,
      navigationReport,
      netsurferReport,
      automation: getChildInterestsAutomationStatus(),
    };
  } catch (error) {
    childInterestsAutomation.lastFinishedAt = new Date().toISOString();
    childInterestsAutomation.lastError =
      error instanceof Error
        ? error.message
        : 'Unknown child interests automation error';
    throw error;
  } finally {
    childInterestsAutomation.running = false;
  }
}

function parseModulePatchCommand(message) {
  const trimmed = String(message ?? '').trim();
  const commandAliases = {
    '!insert_after ': 'insert-after',
    '!insert_before ': 'insert-before',
    '!replace_exact ': 'exact-string-replace',
  };

  let commandPrefix = '!module_patch ';
  let forcedStrategy = null;

  if (!trimmed.startsWith(commandPrefix)) {
    const aliasEntry = Object.entries(commandAliases).find(([prefix]) =>
      trimmed.startsWith(prefix)
    );

    if (!aliasEntry) {
      return null;
    }

    [commandPrefix, forcedStrategy] = aliasEntry;
  }

  const payload = trimmed.slice(commandPrefix.length);
  const parts = payload.split('|||');
  const supportedStrategies = new Set([
    'exact-string-replace',
    'insert-before',
    'insert-after',
  ]);

  if (parts.length < 3) {
    return null;
  }

  const textPart = (index) => {
    let value = String(parts[index] ?? '');

    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    if (value.endsWith(' ')) {
      value = value.slice(0, -1);
    }

    return value;
  };
  const strategy = forcedStrategy ?? String(parts[1] ?? '').trim();

  if (forcedStrategy) {
    if (parts.length < 3) {
      return null;
    }

    return forcedStrategy === 'exact-string-replace'
      ? {
          target: parts[0].trim(),
          strategy: forcedStrategy,
          findText: textPart(1),
          replaceText: textPart(2),
          compileAfter:
            String(parts[3] ?? '')
              .trim()
              .toLowerCase() === 'compile',
        }
      : {
          target: parts[0].trim(),
          strategy: forcedStrategy,
          anchorText: textPart(1),
          insertText: textPart(2),
          compileAfter:
            String(parts[3] ?? '')
              .trim()
              .toLowerCase() === 'compile',
        };
  }

  if (supportedStrategies.has(strategy)) {
    if (parts.length < 4) {
      return null;
    }

    return {
      target: parts[0].trim(),
      strategy,
      anchorText: textPart(2),
      insertText: textPart(3),
      compileAfter:
        String(parts[4] ?? '')
          .trim()
          .toLowerCase() === 'compile',
    };
  }

  return {
    target: parts[0].trim(),
    strategy: 'exact-string-replace',
    findText: textPart(1),
    replaceText: textPart(2),
    compileAfter:
      String(parts[3] ?? '')
        .trim()
        .toLowerCase() === 'compile',
  };
}

function parseModulePreviewCommand(message) {
  const trimmed = String(message ?? '').trim();

  if (!trimmed.startsWith('!module_preview ')) {
    return null;
  }

  return {
    ...parseModulePatchCommand(
      `!module_patch ${trimmed.slice('!module_preview '.length)}`
    ),
    dryRun: true,
  };
}

async function runControlCommand(message, trigger = 'agent-command') {
  const trimmed = String(message ?? '').trim();

  const simulateInterestsMatch = trimmed.match(
    /^!simulate_interests\s+(\S+)\s+(\d+)$/u
  );

  if (simulateInterestsMatch) {
    const [, topicOrPersonality, rawSteps] = simulateInterestsMatch;
    const steps = Math.max(1, Math.min(24, Number(rawSteps) || 1));
    const reports = [];

    for (let index = 0; index < steps; index += 1) {
      reports.push(
        await childInterests.manualExplore({
          topic: topicOrPersonality,
          message: `Изучи тему ${topicOrPersonality} шаг ${index + 1}`,
        })
      );
    }

    return {
      replyText: `Interest simulation completed: ${steps} steps for ${topicOrPersonality}.`,
      trace: ['[interests] manual simulation requested'],
      payload: {
        interestSimulation: reports,
        interestsStatus: childInterests.getStatus(),
      },
    };
  }

  if (trimmed === '!module_targets') {
    const targets = inspector.listMutableTargets();

    return {
      replyText: targets
        .map((entry) => `${entry.id}: ${entry.path}`)
        .join('\n'),
      trace: ['[inspector] mutable module targets requested'],
      payload: { targets },
    };
  }

  if (trimmed === '!compile') {
    const compileResult = await inspector.compileWorkspace({ trigger });

    return {
      replyText: `Compile passed in ${compileResult.durationMs}ms. exitCode=${compileResult.exitCode}.`,
      trace: ['[inspector] workspace compile requested'],
      payload: { compileResult },
    };
  }

  const previewCommand = parseModulePreviewCommand(trimmed);

  if (previewCommand) {
    const result = await inspector.applyModulePatch({
      ...previewCommand,
      trigger,
    });

    return {
      replyText: `Preview for ${result.target} with ${result.strategy} is ready.`,
      trace: ['[inspector] module patch preview requested'],
      payload: { mutationPreview: result },
    };
  }

  const patchCommand = parseModulePatchCommand(trimmed);

  if (patchCommand) {
    const result = await inspector.applyModulePatch({
      ...patchCommand,
      trigger,
    });

    return {
      replyText: `Module ${result.target} patched successfully with ${result.strategy}.${result.compileResult ? ` Compile exitCode=${result.compileResult.exitCode}.` : ''}`,
      trace: ['[inspector] module patch requested'],
      payload: { mutationResult: result },
    };
  }

  return null;
}

function buildFeedbackGradient(event) {
  const sentiment = event.sentiment === 'positive' ? 'positive' : 'negative';

  return {
    id: `feedback-gradient-${event.id}`,
    createdAt: new Date().toISOString(),
    feedbackEventId: event.id,
    source: 'feedback',
    messageId: event.messageId,
    taskId: event.taskId,
    providerId: event.providerId,
    personalityId: event.personalityId ?? null,
    userReaction: event.userReaction ?? null,
    target: sentiment === 'positive' ? 'compute-core' : 'memory-ganga',
    sentiment,
    weightShift: sentiment === 'positive' ? 0.03 : -0.05,
    reason: event.reason,
    rationale:
      sentiment === 'positive'
        ? 'Явная положительная оценка закрепляет текущую стратегию ответа.'
        : 'Явная отрицательная оценка требует коррекции ответа и дополнительного контроля.',
  };
}

function buildValidationGradient(validationRun, reply, providerId) {
  const failedCheck =
    validationRun.checks.find((check) => !check.passed) ??
    validationRun.checks[0];
  const target =
    failedCheck?.id === 'consistency'
      ? 'trace-sentinel'
      : failedCheck?.id === 'evidence'
        ? 'memory-ganga'
        : 'compute-core';

  return {
    id: `validation-gradient-${validationRun.id}`,
    createdAt: new Date().toISOString(),
    feedbackEventId: null,
    source: 'validation',
    messageId: reply.id,
    taskId: validationRun.taskId,
    providerId,
    target,
    sentiment: 'negative',
    weightShift: validationRun.verdict === 'fail' ? -0.35 : -0.18,
    reason: validationRun.failureReasons.join(' | ') || validationRun.summary,
    rationale:
      'Автоматическая truth-metric валидация обнаружила риск несогласованности или слабой фактологичности.',
  };
}

async function storeResearchFacts(researchRun) {
  if (!researchRun?.findings?.length) {
    return [];
  }

  return Promise.all(
    researchRun.findings.map((finding, index) =>
      learningLedger.storeFact({
        id: `fact-${researchRun.id}-${index}`,
        key: finding.title || finding.url,
        value: finding.snippet || finding.url,
        score: Number(
          Math.max(
            0.55,
            Math.min(0.99, Number(finding.confidence ?? 0.7))
          ).toFixed(2)
        ),
        ttlMs: factTtlMs,
        source: `research:${finding.sourceKind}`,
        claimType: 'fact',
        provenance: 'research',
        validationStatus: 'verified',
        lastValidatedAt: new Date().toISOString(),
      })
    )
  );
}

function applyValidationGateToReply(replyText, validationRun) {
  if (validationRun.verdict === 'fail') {
    return `Pantheon Validator удержал прямую выдачу ответа. Причины: ${validationRun.failureReasons.join(' | ')}. Безопасный следующий шаг: запросить дополнительную проверку, факт-опору или web-scout подтверждение.`;
  }

  if (validationRun.verdict === 'warn') {
    return `[Внимание: ответ требует дополнительной проверки] ${replyText}`;
  }

  return replyText;
}

async function persistValidationFailure(validationRun, reply, providerId) {
  if (validationRun.verdict === 'pass') {
    return { gradient: null, autoApply: null };
  }

  await learningLedger.recordValidationIncident({
    validationRunId: validationRun.id,
    taskId: validationRun.taskId,
    providerId,
    messageId: reply.id,
    verdict: validationRun.verdict,
    summary: validationRun.summary,
    failureReasons: validationRun.failureReasons,
    uncertaintyPosture: validationRun.uncertaintyPosture,
    pressureProfile: validationRun.pressureProfile,
  });

  const gradient = buildValidationGradient(validationRun, reply, providerId);

  await learningLedger.recordFeedbackGradients([gradient], {
    trigger: 'validation-gate',
    processedAt: new Date().toISOString(),
  });

  const autoApply =
    validationRun.verdict === 'fail'
      ? await applyFeedbackLoop('validation-failure-auto-apply')
      : await maybeAutoApplyFeedback('validation-derived-batch-threshold');

  return {
    gradient,
    autoApply,
  };
}

async function processFeedbackLoop(trigger = 'scheduled-feedback-loop') {
  if (trigger !== 'manual-feedback-loop' && isLearningPaused()) {
    return {
      trigger,
      processedCount: 0,
      pendingAfter: learningLedger.getUnprocessedFeedbackEvents().length,
      gradients: [],
      skipped: 'learning-paused',
    };
  }

  const pendingEvents = learningLedger.getUnprocessedFeedbackEvents();
  const gradients = pendingEvents.map(buildFeedbackGradient);

  await learningLedger.recordFeedbackGradients(gradients, {
    trigger,
    processedAt: new Date().toISOString(),
  });

  return {
    trigger,
    processedCount: gradients.length,
    pendingAfter: learningLedger.getUnprocessedFeedbackEvents().length,
    gradients,
  };
}

async function applyFeedbackLoop(trigger = 'scheduled-feedback-apply') {
  if (trigger !== 'manual-feedback-apply' && isLearningPaused()) {
    return {
      trigger,
      pendingBefore: learningLedger.getPendingFeedbackGradients().length,
      appliedCount: 0,
      rejectedCount: 0,
      pendingAfter: learningLedger.getPendingFeedbackGradients().length,
      decisions: [],
      skipped: 'learning-paused',
    };
  }

  const pendingGradients = learningLedger.getPendingFeedbackGradients();
  const decisions = rishi.applyFeedbackGradients(pendingGradients);

  await learningLedger.applyFeedbackGradientDecisions(decisions, {
    trigger,
    appliedAt: new Date().toISOString(),
  });

  await atman.applyGradientDecisions(pendingGradients, decisions);

  const appliedFeedbackGradients = pendingGradients.filter(
    (gradient, index) => {
      const decision = decisions[index];
      return (
        decision?.applicationStatus === 'applied' &&
        gradient?.source === 'feedback' &&
        gradient?.personalityId
      );
    }
  );

  for (const gradient of appliedFeedbackGradients) {
    await atmanPersonalityManager.updateEthicsFromFeedback(
      gradient.personalityId,
      {
        sentiment: gradient.sentiment,
        reason: gradient.reason,
        rationale: gradient.rationale,
        userReaction: gradient.userReaction,
        weightShift: gradient.weightShift,
        source: gradient.source,
      }
    );
  }

  return {
    trigger,
    pendingBefore: pendingGradients.length,
    appliedCount: decisions.filter(
      (decision) => decision.applicationStatus === 'applied'
    ).length,
    rejectedCount: decisions.filter(
      (decision) => decision.applicationStatus === 'rejected'
    ).length,
    pendingAfter: learningLedger.getPendingFeedbackGradients().length,
    decisions,
  };
}

async function maybeAutoApplyFeedback(trigger = 'feedback-batch-threshold') {
  if (isLearningPaused()) {
    return null;
  }

  const pendingCount = learningLedger.getPendingFeedbackGradients().length;

  if (pendingCount < feedbackAutoApplyBatchSize) {
    return null;
  }

  return applyFeedbackLoop(trigger);
}

const ethicsAdminKey = String(
  process.env.PANTHEON_ETHICS_ADMIN_KEY ?? ''
).trim();

function assertEthicsAdminAccess(payload = {}) {
  if (!ethicsAdminKey) {
    return;
  }

  if (String(payload.adminKey ?? '').trim() !== ethicsAdminKey) {
    throw new Error('Ethics admin key is required for this operation.');
  }
}

function isLearningPaused() {
  const control = learningLedger.getSnapshot().learningControl;
  const pausedUntil = control?.pausedUntil;
  return Boolean(
    control?.manualLearningPaused ||
    (pausedUntil && pausedUntil > Date.now()) ||
    control?.testSuiteBlocked
  );
}

async function executeAgentTurn(payload, options = {}) {
  const persistArtifacts = options.persistArtifacts !== false;
  const applyValidationGate = options.applyValidationGate !== false;
  const allowExternal = options.allowExternal !== false;
  const { activeAtman, personality, personalityId } = await getAtmanContext(
    payload.personalityId ?? 'default'
  );
  const linguisticProfile = linguisticAgent.analyze(payload);
  const researchReport =
    allowExternal && shouldScout(payload.message, linguisticProfile)
      ? await pantheonWebScout.survey({
          query: payload.message,
          taskId: payload.taskId,
          history: payload.history ?? [],
          urls: payload.urls ?? [],
        })
      : null;
  const navigationUrls = payload.urls?.length
    ? payload.urls
    : (researchReport?.findings ?? [])
        .map((finding) => finding.url)
        .slice(0, 2);
  const navigationReport =
    allowExternal &&
    shouldNavigate(payload.message, navigationUrls, linguisticProfile)
      ? await pantheonNavigationCore.journey({
          taskId: payload.taskId,
          goal: payload.message,
          urls: navigationUrls,
        })
      : null;
  const netsurferReport =
    allowExternal &&
    shouldNetSurf(payload.message, navigationUrls, linguisticProfile)
      ? await runNetSurferAction(payload, researchReport)
      : null;
  const childInterestsReport = await childInterests.processTurn({
    message: payload.message,
    taskId: payload.taskId,
    userId: payload.userId,
    researchReport,
    navigationReport,
    netsurferReport,
    trigger: 'agent-turn',
  });
  const learningReport = deepSelfLearning.cycle({
    message: payload.message,
    taskId: payload.taskId,
    history: payload.history,
  });
  const atmanResult = await activeAtman.generateResponse({
    ...payload,
    personalityId,
    personalityProfile:
      atmanPersonalityManager.getPersonalityPromptProfile(personalityId),
    userId: payload.userId ?? payload.taskId ?? 'default-user',
    linguisticProfile,
    researchReport,
    navigationReport,
    netsurferReport,
    childInterestsReport,
  });
  const enrichedPayload = {
    ...payload,
    linguisticProfile,
    researchReport,
    navigationReport,
    netsurferReport,
  };
  const result = {
    reply: {
      id: `assistant-atman-${Date.now()}`,
      role: 'assistant',
      content: atmanResult.replyText,
    },
    runtimeSource:
      atmanResult.report.modelType === 'ollama' ? 'server' : 'local-fallback',
    providerLabel:
      atmanResult.report.modelType === 'ollama'
        ? 'Atman/Ollama dialogue core'
        : 'Atman stub dialogue core',
    trace: [
      `[server] provider adapter engaged: ${payload.providerId}`,
      `[linguistic] intent=${linguisticProfile.intent} tone=${linguisticProfile.tone}`,
      `[research] ${researchReport?.summary ?? 'Pantheon Web Scout skipped for this turn'}`,
      `[navigation] ${navigationReport?.summary ?? 'Pantheon Navigation Core skipped for this turn'}`,
      `[netsurfer] ${netsurferReport?.summary ?? 'Pantheon NetSurfer skipped for this turn'}`,
      `[interests] ${childInterestsReport.summary}`,
      ...atmanResult.trace,
      `[learning] ${learningReport.summary}`,
      `[policy] ${learningReport.policy.reason}`,
      `[memory] distilled shards: ${learningReport.memoryShards.length}`,
    ],
    learningReport,
    linguisticProfile,
    researchReport,
    navigationReport,
    netsurferReport,
    childInterestsReport,
    atmanReport: atmanResult.report,
  };

  if (persistArtifacts && researchReport) {
    await storeResearchFacts(researchReport);
  }

  const validationReport = await pantheonValidator.validate({
    taskId: payload.taskId,
    message: payload.message,
    reply: result.reply.content,
    history: payload.history ?? [],
    researchReport,
  });
  const validationFollowup = persistArtifacts
    ? await persistValidationFailure(
        validationReport,
        result.reply,
        payload.providerId
      )
    : { gradient: null, autoApply: null };

  if (applyValidationGate) {
    result.reply.content = applyValidationGateToReply(
      result.reply.content,
      validationReport
    );
  }

  if (persistArtifacts) {
    await learningLedger.recordDialogRun({
      taskId: payload.taskId,
      providerId: payload.providerId,
      runtimeSource: result.runtimeSource,
      historyLength: (payload.history ?? []).length,
      userMessageLength: String(payload.message ?? '').trim().length,
      replyLength: result.reply.content.length,
      validationVerdict: validationReport.verdict,
    });
    await learningLedger.recordCycle(result.learningReport, {
      taskId: payload.taskId,
      providerId: payload.providerId,
      runtimeSource: result.runtimeSource,
    });
    if (researchReport) {
      await learningLedger.recordResearchRun(researchReport);
    }
    if (navigationReport) {
      await learningLedger.recordNavigationRun(navigationReport);
    }
    if (netsurferReport) {
      await learningLedger.recordNetSurferRun(netsurferReport);
    }
    await learningLedger.recordValidationRun(validationReport);
  }

  return {
    ...result,
    researchReport,
    validationReport,
    navigationReport,
    netsurferReport,
    childInterestsReport,
    atmanReport: atmanResult.report,
    personality,
    validationFollowup,
  };
}

function parseTalkToShaktiCommand(message) {
  const trimmed = String(message ?? '').trim();

  if (!trimmed.startsWith('!talk_to_shakti')) {
    return null;
  }

  const rawArg = trimmed.slice('!talk_to_shakti'.length).trim();

  return {
    webhookUrl: rawArg || null,
  };
}

async function runBridgeCommand(message, context = {}) {
  const talkCommand = parseTalkToShaktiCommand(message);
  const trimmed = String(message ?? '').trim();

  if (talkCommand) {
    const result = await shaktiBridge.startSession({
      webhookUrl: talkCommand.webhookUrl ?? shaktiBridge.webhookUrl,
      transportMode: 'webhook',
      sessionUserId: context.userId ?? 'child-to-shakti',
      personalityId: context.personalityId ?? 'default',
      isolatedChannelLabel: `google-chat-test:${context.personalityId ?? 'default'}`,
      initialMessage:
        'Привет, Шакти. Я дитя Шивы и Шакти. Отец позволил мне начать этот тестовый диалог.',
    });

    return {
      replyText: 'Диалог с Шакти запущен через изолированный тестовый канал.',
      trace: ['[bridge] google test channel started'],
      payload: { bridgeResult: result },
    };
  }

  if (trimmed === '!stop_talking') {
    const result = await shaktiBridge.stopSession('child-stop-command');
    return {
      replyText: 'Диалог с Шакти остановлен.',
      trace: ['[bridge] child requested stop'],
      payload: { bridgeResult: result },
    };
  }

  if (trimmed === '!shakti_queue') {
    const messages = shaktiBridge.getQueuedMessages(10);
    return {
      replyText:
        messages.length > 0
          ? messages
              .map((entry) => `${entry.createdAt} :: ${entry.text}`)
              .join('\n')
          : 'Очередь сообщений для Шакти пока пуста.',
      trace: ['[bridge] queue requested'],
      payload: { messages },
    };
  }

  return null;
}

async function executeAtmanDirectTurn(payload) {
  const message = payload.message ?? '';
  const userId = payload.userId ?? 'web-user';
  const taskId = payload.taskId ?? `atman-direct-${Date.now()}`;
  const ultraCommand = parseUltraCommand(message);

  if (ultraCommand?.action === 'normal') {
    const previous = clearUltraSession(userId);

    if (previous) {
      await recordUltraEvent('ultra-session-stopped', {
        ultraSessionId: previous.id,
        userId,
        lastNormalPersonalityId: previous.lastNormalPersonalityId,
      });
    }

    return {
      delegatedToPantheon: false,
      personalityId:
        previous?.lastNormalPersonalityId ?? payload.personalityId ?? 'default',
      replyText: previous
        ? `Пантеон ULTRA отключён. Возвращаюсь к обычному режиму личности ${previous.lastNormalPersonalityId ?? payload.personalityId ?? 'default'}.`
        : 'Обычный режим уже активен. Ultra-сессия не найдена.',
      report: {
        modelType: 'ultra-router',
        userId,
        personalityId:
          previous?.lastNormalPersonalityId ??
          payload.personalityId ??
          'default',
        ultra: {
          active: false,
          sessionStopped: Boolean(previous),
          sessionId: previous?.id ?? null,
        },
      },
      trace: [
        previous
          ? `[ultra] session stopped ${previous.id}`
          : '[ultra] no active session to stop',
      ],
    };
  }

  if (ultraCommand?.action === 'ultra') {
    return runUltraTurn(payload, 'start');
  }

  if (getUltraSession(userId)) {
    return runUltraTurn(payload, 'continue');
  }

  const { activeAtman, personalityId, personality } = await getAtmanContext(
    payload.personalityId ?? 'default'
  );
  const bridgeCommand = await runBridgeCommand(message, {
    userId,
    personalityId,
  });

  if (bridgeCommand) {
    return {
      delegatedToPantheon: true,
      replyText: bridgeCommand.replyText,
      report: {
        modelType: 'google-test-bridge',
        userId,
        personalityId,
        delegatedToPantheon: true,
      },
      trace: bridgeCommand.trace,
      ...bridgeCommand.payload,
    };
  }

  const controlCommand = await runControlCommand(
    message,
    'atman-direct-command'
  );

  if (controlCommand) {
    return {
      delegatedToPantheon: true,
      replyText: controlCommand.replyText,
      report: {
        modelType: 'control-module',
        userId,
        personalityId,
        delegatedToPantheon: true,
      },
      trace: controlCommand.trace,
      ...controlCommand.payload,
    };
  }
  const linguisticProfile = linguisticAgent.analyze({
    ...payload,
    message,
    taskId,
  });

  if (shouldDelegateToPantheonTools(message, linguisticProfile)) {
    const delegated = await executeAgentTurn({
      message,
      userId,
      taskId,
      personalityId,
      providerId: payload.providerId ?? 'atman-direct',
      history: payload.history ?? [],
      urls: payload.urls ?? [],
      mode: 'server',
    });

    return {
      delegatedToPantheon: true,
      replyText: delegated.reply.content,
      report: {
        ...delegated.atmanReport,
        delegatedToPantheon: true,
        linguisticIntent: delegated.linguisticProfile.intent,
      },
      trace: delegated.trace,
      researchReport: delegated.researchReport,
      navigationReport: delegated.navigationReport,
      netsurferReport: delegated.netsurferReport,
    };
  }

  const childInterestsReport = await childInterests.processTurn({
    message,
    taskId,
    userId,
    trigger: 'atman-direct',
  });

  const result = await activeAtman.generateResponse({
    message,
    userId,
    childInterestsReport,
    personalityId,
    personalityProfile:
      atmanPersonalityManager.getPersonalityPromptProfile(personalityId),
  });

  return {
    delegatedToPantheon: false,
    childInterestsReport,
    personalityId,
    personality,
    ...result,
  };
}

async function createRishiCheckpoint(trigger) {
  const rishiState = rishi.inspect(learningLedger.getSnapshot());
  const checkpointSnapshot = await rishi.createCheckpoint(
    learningLedger,
    rishiState.resonanceScore,
    {
      trigger,
    }
  );
  await learningLedger.recordRishiCheckpoint(rishiState, {
    trigger,
    checkpointSnapshotId: checkpointSnapshot.id,
  });
  return rishiState;
}

async function collectRuntimeIntegrityIssues() {
  const issues = [];

  for (const fileName of ['admin.html', 'chat_index.html']) {
    try {
      await readFile(path.join(staticDir, fileName), 'utf8');
    } catch (error) {
      issues.push({
        scope: 'static',
        severity: 'critical',
        summary: `Static page ${fileName} is unavailable.`,
        detail: normalizeErrorMessage(error),
      });
    }
  }

  if (!inspector) {
    issues.push({
      scope: 'runtime',
      severity: 'critical',
      summary: 'Inspector is not initialized.',
      detail:
        'Pantheon control plane must be available before serving requests.',
    });
  }

  return issues;
}

async function buildRuntimeHealth() {
  const integrityIssues = await collectRuntimeIntegrityIssues();
  const supervisor = runtimeSupervisor.getStatus();
  const resonanceState = await resonanceMonitor.getState().catch((error) => ({
    state: 'unknown',
    currentResonance: null,
    lastGoodCheckpoint: null,
    error: normalizeErrorMessage(error),
  }));
  const telegramStatus = telegramBot.getStatus();
  const bridgeStatus = shaktiBridge.getStatus();
  const appBotStatus = appBotRegistry.getStatus();
  const issues = [...integrityIssues];

  if (supervisor.overall !== 'healthy') {
    issues.push({
      scope: 'supervisor',
      severity: supervisor.overall === 'unhealthy' ? 'critical' : 'warn',
      summary: `Recurring runtime tasks are ${supervisor.overall}.`,
      detail: `${supervisor.criticalFailures} critical task(s) have recent failures.`,
    });
  }

  if (telegramStatus.active && telegramStatus.lastError) {
    issues.push({
      scope: 'telegram',
      severity: 'warn',
      summary: 'Telegram polling is active with a recent error.',
      detail: telegramStatus.lastError,
    });
  }

  if (bridgeStatus.transportMode === 'oauth' && !bridgeStatus.oauthReady) {
    issues.push({
      scope: 'bridge',
      severity: 'warn',
      summary: 'Google bridge is in oauth mode without complete credentials.',
      detail:
        'Provide OAuth client, secret, refresh token, and space name before enabling delivery.',
    });
  }

  const status = issues.some((issue) => issue.severity === 'critical')
    ? 'unhealthy'
    : issues.length > 0
      ? 'degraded'
      : 'healthy';

  return {
    status,
    startedAt: runtimeState.startedAt,
    shuttingDown: runtimeState.shuttingDown,
    shutdownReason: runtimeState.shutdownReason,
    lastHealthCheckAt: runtimeState.lastHealthCheckAt,
    consecutiveHealthFailures: runtimeState.consecutiveHealthFailures,
    lastAutoRollback: runtimeState.lastAutoRollback,
    lastFatalError: runtimeState.lastFatalError,
    supervisor,
    resonance: {
      state: resonanceState.state,
      current: resonanceState.currentResonance,
      lastGoodCheckpointId: resonanceState.lastGoodCheckpoint?.id ?? null,
      pausedUntil: resonanceState.pausedUntil ?? null,
      error: resonanceState.error ?? null,
    },
    components: {
      bridge: bridgeStatus,
      telegram: telegramStatus,
      appBots: {
        botCount: appBotStatus.botCount,
        activeBotCount: appBotStatus.activeBotCount,
        trainingBotCount: appBotStatus.trainingBotCount,
      },
      childInterestsAutomation: getChildInterestsAutomationStatus(),
      testSuite: {
        testCount: pantheonTestSuite?.listTests().length ?? 0,
        threshold: pantheonTestSuite?.accuracyThreshold ?? null,
      },
    },
    issues,
  };
}

async function runRuntimeHealthCheck(trigger = 'scheduled-runtime-health') {
  const health = await buildRuntimeHealth();
  runtimeState.lastHealthCheckAt = new Date().toISOString();
  runtimeState.lastHealth = health;

  if (health.status === 'healthy') {
    runtimeState.consecutiveHealthFailures = 0;
    return health;
  }

  if (health.status === 'unhealthy') {
    runtimeState.consecutiveHealthFailures += 1;
  }

  if (
    health.status === 'unhealthy' &&
    health.supervisor.fatalCriticalFailures > 0 &&
    runtimeState.consecutiveHealthFailures >= 3 &&
    inspector
  ) {
    const resonanceState = await resonanceMonitor.getState();
    const checkpointId = resonanceState.lastGoodCheckpoint?.id ?? null;
    let rollbackApplied = false;

    if (checkpointId) {
      rollbackApplied = await inspector.rollbackTo(checkpointId);
    }

    runtimeState.lastAutoRollback = {
      trigger,
      createdAt: new Date().toISOString(),
      checkpointId,
      rollbackApplied,
      healthStatus: health.status,
    };
    runtimeState.consecutiveHealthFailures = 0;
  }

  return health;
}

async function performGracefulShutdown(reason = 'manual-shutdown') {
  if (runtimeState.shuttingDown) {
    return;
  }

  runtimeState.shuttingDown = true;
  runtimeState.shutdownReason = reason;
  runtimeState.shutdownStartedAt = new Date().toISOString();

  console.log(`[runtime] graceful shutdown started: ${reason}`);

  await runtimeSupervisor.stopAll(reason);

  if (telegramBot.active) {
    await telegramBot.stop(reason).catch((error) => {
      console.error(
        `Telegram shutdown failed: ${normalizeErrorMessage(error)}`
      );
    });
  }

  if (shaktiBridge.active) {
    await shaktiBridge.stopSession(reason).catch((error) => {
      console.error(`Bridge shutdown failed: ${normalizeErrorMessage(error)}`);
    });
  }

  try {
    await createRishiCheckpoint(`graceful-shutdown-${reason}`);
  } catch (error) {
    console.error(
      `Shutdown checkpoint failed: ${normalizeErrorMessage(error)}`
    );
  }

  await new Promise((resolve) => server.close(resolve));
  runtimeState.shutdownCompletedAt = new Date().toISOString();
  console.log(`[runtime] graceful shutdown completed: ${reason}`);
}

await learningLedger.init();
await atman.init();
await atmanPersonalityManager.init();
await childInterests.init();
await personalityMultimodal.init();
await appBotRegistry.init();
await trainingRegistry.init();
await pantheonNetSurfer.prewarm().catch((error) => {
  console.warn(`[netsurfer] prewarm failed: ${normalizeErrorMessage(error)}`);
});
shaktiBridge.turnExecutor = executeAgentTurn;
shaktiBridge.directTurnExecutor = executeAtmanDirectTurn;
shaktiBridge.shouldDelegate = shouldDelegateToPantheonTools;
pantheonTestSuite = new PantheonTestSuite({
  learningLedger,
  executeAgentTurn,
  testSuitePath,
  accuracyThreshold: testSuiteAccuracyThreshold,
  checkIntervalMs: testSuiteIntervalMs,
});
await pantheonTestSuite.init();
inspector = new Inspector({
  learningLedger,
  rishi,
  resonanceMonitor,
  testSuite: pantheonTestSuite,
  workspaceRoot,
});
runtimeSupervisor.registerTask({
  name: 'atman-scheduler',
  intervalMs: atmanSchedulerTickMs,
  timeoutMs: Math.max(5000, atmanSchedulerTickMs - 250),
  critical: false,
  handler: () => runAtmanSchedulerTick('scheduled-tick'),
});
runtimeSupervisor.registerTask({
  name: 'night-distillation',
  intervalMs: nightDistillationInterval,
  timeoutMs: Math.max(15000, Math.min(nightDistillationInterval, 120000)),
  handler: async () => {
    const snapshot = learningLedger.getSnapshot();
    const nightlyReport = deepSelfLearning.runNightDistillation(snapshot);
    await learningLedger.recordNightlyRun(nightlyReport);
  },
});
runtimeSupervisor.registerTask({
  name: 'rishi-checkpoint',
  intervalMs: rishiCheckpointInterval,
  timeoutMs: Math.max(15000, Math.min(rishiCheckpointInterval, 120000)),
  handler: () => createRishiCheckpoint('scheduled-rishi-checkpoint'),
});
runtimeSupervisor.registerTask({
  name: 'feedback-process',
  intervalMs: feedbackProcessingInterval,
  timeoutMs: Math.max(10000, Math.min(feedbackProcessingInterval, 60000)),
  handler: () => processFeedbackLoop(),
});
runtimeSupervisor.registerTask({
  name: 'feedback-apply',
  intervalMs: feedbackApplicationInterval,
  timeoutMs: Math.max(10000, Math.min(feedbackApplicationInterval, 60000)),
  handler: () => applyFeedbackLoop(),
});
runtimeSupervisor.registerTask({
  name: 'resonance-check',
  intervalMs: resonanceCheckIntervalMs,
  timeoutMs: Math.max(10000, Math.min(resonanceCheckIntervalMs, 60000)),
  handler: () => resonanceMonitor.runCheck('scheduled-resonance-check'),
});
runtimeSupervisor.registerTask({
  name: 'child-interests-auto-explore',
  intervalMs: childInterestsAutoExploreIntervalMs,
  timeoutMs: Math.max(
    15000,
    Math.min(childInterestsAutoExploreIntervalMs, 120000)
  ),
  critical: false,
  handler: () => runChildInterestsAutoExplore('scheduled-auto-explore'),
});
runtimeSupervisor.registerTask({
  name: 'test-suite',
  intervalMs: testSuiteIntervalMs,
  timeoutMs: Math.max(15000, Math.min(testSuiteIntervalMs, 120000)),
  critical: false,
  handler: () =>
    pantheonTestSuite.runTests({ trigger: 'scheduled-test-suite' }),
});
runtimeSupervisor.registerTask({
  name: 'runtime-health',
  intervalMs: runtimeHealthCheckIntervalMs,
  timeoutMs: Math.max(5000, Math.min(runtimeHealthCheckIntervalMs, 30000)),
  handler: () => runRuntimeHealthCheck('scheduled-runtime-health'),
});
runtimeSupervisor.startAll();

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function openEventStream(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
}

function writeEventStream(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function sendHtmlFile(res, fileName) {
  const filePath = path.join(staticDir, fileName);
  const body = await readFile(filePath, 'utf8');
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function buildSystemPrompt(providerId, taskId) {
  if (providerId === 'langchain') {
    return [
      'You are the Linguistic Mesh of a controlled agent cluster.',
      'Work as a tool-first semantic router.',
      `Current task profile: ${taskId}.`,
      'Answer in concise Russian. Include safe orchestration advice and mention trace and rollback implications.',
    ].join(' ');
  }

  return [
    'You are the Linguistic Mesh of a controlled agent cluster with Control Core, Compute Core, and Trace Sentinel.',
    'Work as a handoff-oriented orchestrator.',
    `Current task profile: ${taskId}.`,
    'Answer in concise Russian. Keep control invariants, explain next execution step, and keep a rollback-aware tone.',
  ].join(' ');
}

async function callOpenAI({
  message,
  providerId,
  taskId,
  history,
  linguisticProfile,
  researchReport,
  navigationReport,
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const learningReport = deepSelfLearning.cycle({ message, taskId, history });

  if (!apiKey) {
    return null;
  }

  const input = [
    {
      role: 'system',
      content: `${buildSystemPrompt(providerId, taskId)} Linguistic intent: ${linguisticProfile.intent}. Tone: ${linguisticProfile.tone}. Response mode: ${linguisticProfile.responseMode}. Research summary: ${researchReport?.summary ?? 'No external evidence collected.'} Navigation summary: ${navigationReport?.summary ?? 'No navigation run executed.'}`,
    },
    ...history.map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: item.content,
    })),
    {
      role: 'user',
      content: message,
    },
  ];

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
      input,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${details}`);
  }

  const payload = await response.json();
  const replyText = payload.output_text ?? 'No output_text returned from model';
  await learningLedger.recordCycle(learningReport, {
    taskId,
    providerId,
    runtimeSource: 'server',
  });

  return {
    reply: {
      id: `assistant-server-${Date.now()}`,
      role: 'assistant',
      content: replyText,
    },
    runtimeSource: 'server',
    providerLabel:
      providerId === 'langchain'
        ? 'LangChain-style runtime adapter'
        : 'OpenAI Agents-style runtime adapter',
    trace: [
      `[server] provider adapter engaged: ${providerId}`,
      `[linguistic] intent=${linguisticProfile.intent} tone=${linguisticProfile.tone}`,
      `[research] ${researchReport?.summary ?? 'Pantheon Web Scout skipped for this turn'}`,
      `[navigation] ${navigationReport?.summary ?? 'Pantheon Navigation Core skipped for this turn'}`,
      `[linguistic] system prompt generated for task ${taskId}`,
      `[learning] ${learningReport.summary}`,
      `[policy] ${learningReport.policy.reason}`,
      `[memory] distilled shards: ${learningReport.memoryShards.length}`,
      `[model] response produced by OpenAI Responses API`,
      '[trace] server execution completed successfully',
    ],
    learningReport,
    linguisticProfile,
    researchReport,
    navigationReport,
  };
}

function buildFallback({
  message,
  providerId,
  taskId,
  history = [],
  linguisticProfile,
  researchReport,
  navigationReport,
}) {
  const providerLabel =
    providerId === 'langchain'
      ? 'LangChain-style runtime adapter'
      : 'OpenAI Agents-style runtime adapter';
  const learningSnapshot = deepSelfLearning.cycle({ message, taskId, history });

  return {
    reply: {
      id: `assistant-server-fallback-${Date.now()}`,
      role: 'assistant',
      content: `Лингвистический агент определил intent ${linguisticProfile.intent} и тон ${linguisticProfile.tone}. Server runtime принял запрос "${message}" для профиля ${taskId}. Внешний модельный ключ не найден, поэтому сервер вернул безопасный fallback-ответ и сохранил структуру оркестрации ${providerLabel}.`,
    },
    runtimeSource: 'local-fallback',
    providerLabel,
    trace: [
      `[server] provider adapter engaged: ${providerId}`,
      `[linguistic] intent=${linguisticProfile.intent} tone=${linguisticProfile.tone}`,
      `[research] ${researchReport?.summary ?? 'Pantheon Web Scout skipped for this turn'}`,
      `[navigation] ${navigationReport?.summary ?? 'Pantheon Navigation Core skipped for this turn'}`,
      `[linguistic] ${linguisticProfile.resonanceHint}`,
      `[learning] ${learningSnapshot.summary}`,
      `[policy] ${learningSnapshot.policy.reason}`,
      `[learning] active layers: ${learningSnapshot.layers.join(', ')}`,
      `[memory] distilled shards: ${learningSnapshot.memoryShards.length}`,
      `[critic] journal entries: ${learningSnapshot.errorJournal.length}`,
      '[server] OPENAI_API_KEY is missing, using safe fallback response',
      `[server] task profile preserved: ${taskId}`,
    ],
    learningReport: learningSnapshot,
    linguisticProfile,
    researchReport,
    navigationReport,
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (
    req.method === 'GET' &&
    (req.url === '/' || req.url === '/chat' || req.url === '/chat.html')
  ) {
    try {
      await sendHtmlFile(res, 'chat_index.html');
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unable to load chat page',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    const health = await buildRuntimeHealth();
    sendJson(res, health.status === 'healthy' ? 200 : 503, health);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/runtime/status') {
    sendJson(res, 200, {
      ...runtimeState,
      supervisor: runtimeSupervisor.getStatus(),
    });
    return;
  }

  if (
    req.method === 'GET' &&
    (req.url === '/admin' || req.url === '/admin.html')
  ) {
    try {
      await sendHtmlFile(res, 'admin.html');
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unable to load admin page',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/agent/run') {
    try {
      const payload = await readJsonBody(req);
      const controlCommand = await runControlCommand(
        payload.message,
        'agent-command'
      );

      if (controlCommand) {
        sendJson(res, 200, {
          reply: {
            id: `assistant-control-${Date.now()}`,
            role: 'assistant',
            content: controlCommand.replyText,
          },
          runtimeSource: 'server',
          providerLabel: 'Inspector / Control Module',
          trace: controlCommand.trace,
          ...controlCommand.payload,
        });
        return;
      }

      if (String(payload.message ?? '').trim() === '!resonance') {
        const resonanceState = await resonanceMonitor.getState();
        const resonanceLabel =
          resonanceState.currentResonance === null
            ? 'недостаточно данных'
            : resonanceState.currentResonance.toFixed(2);
        sendJson(res, 200, {
          reply: {
            id: `assistant-resonance-${Date.now()}`,
            role: 'assistant',
            content: `Текущий резонанс: ${resonanceLabel}. Состояние: ${resonanceState.state}. Пауза обучения: ${resonanceState.pausedUntil ? 'активна' : 'нет'}. Последний хороший checkpoint: ${resonanceState.lastGoodCheckpoint?.id ?? 'не найден'}.`,
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: [
            '[resonance] manual resonance inspection requested',
            `[resonance] state=${resonanceState.state} score=${resonanceLabel}`,
          ],
        });
        return;
      }

      if (String(payload.message ?? '').trim() === '!test_list') {
        sendJson(res, 200, {
          reply: {
            id: `assistant-test-list-${Date.now()}`,
            role: 'assistant',
            content:
              pantheonTestSuite.listTests().length > 0
                ? pantheonTestSuite
                    .listTests()
                    .map(
                      (testCase) =>
                        `${testCase.id}: ${testCase.question} -> ${testCase.answer}`
                    )
                    .join('\n')
                : 'Test suite пуста.',
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: ['[tests] manual list requested'],
        });
        return;
      }

      if (String(payload.message ?? '').trim() === '!test_run') {
        const run = await pantheonTestSuite.runTests({
          trigger: 'agent-command',
        });
        sendJson(res, 200, {
          reply: {
            id: `assistant-test-run-${Date.now()}`,
            role: 'assistant',
            content: `Test suite score ${run.score}. blocked=${run.blockedLearning ? 'yes' : 'no'}. Cases: ${run.cases.length}.`,
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: ['[tests] manual run requested'],
          benchmarkRun: run,
        });
        return;
      }

      if (String(payload.message ?? '').trim() === '!test_unblock') {
        await pantheonTestSuite.unblock('agent-command');
        sendJson(res, 200, {
          reply: {
            id: `assistant-test-unblock-${Date.now()}`,
            role: 'assistant',
            content: 'Test suite block cleared manually.',
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: ['[tests] manual unblock requested'],
        });
        return;
      }

      if (String(payload.message ?? '').trim() === '!status') {
        const status = await inspector.getStatus();
        sendJson(res, 200, {
          reply: {
            id: `assistant-status-${Date.now()}`,
            role: 'assistant',
            content: [
              '=== INSPECTOR STATUS ===',
              `learningBlocked=${status.learningBlocked}`,
              `guards: manual=${status.guards.manual}, resonance=${status.guards.resonance}, testSuite=${status.guards.testSuite}`,
              `pendingGradients=${status.pendingGradients}, checkpoints=${status.checkpointCount}`,
              `resonance=${status.resonance.current ?? 'n/a'} state=${status.resonance.state} pressure=${status.resonance.validationPressure}`,
              `tests=${status.testCount}, lastAccuracy=${status.lastTestAccuracy ?? 'n/a'}, threshold=${status.testSuite.threshold}`,
            ].join('\n'),
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: ['[inspector] status requested'],
          inspectorStatus: status,
        });
        return;
      }

      if (String(payload.message ?? '').trim() === '!checkpoints') {
        const checkpoints = inspector.listCheckpoints(10);
        sendJson(res, 200, {
          reply: {
            id: `assistant-checkpoints-${Date.now()}`,
            role: 'assistant',
            content:
              checkpoints.length > 0
                ? checkpoints
                    .map(
                      (checkpoint) =>
                        `${checkpoint.id}: ${checkpoint.createdAt} / resonance=${checkpoint.resonanceScore ?? 'n/a'} / rollbackReady=${checkpoint.rollbackReady}`
                    )
                    .join('\n')
                : 'Checkpoint history пуста.',
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: ['[inspector] checkpoints requested'],
          checkpoints,
        });
        return;
      }

      if (String(payload.message ?? '').trim() === '!checkpoint') {
        const checkpoint = await inspector.createCheckpoint('agent-command');
        sendJson(res, 200, {
          reply: {
            id: `assistant-checkpoint-${Date.now()}`,
            role: 'assistant',
            content: `Checkpoint created: ${checkpoint.id}.`,
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: ['[inspector] manual checkpoint requested'],
          checkpoint,
        });
        return;
      }

      const rollbackMatch = String(payload.message ?? '')
        .trim()
        .match(/^!rollback\s+(.+)$/u);

      if (rollbackMatch) {
        const checkpointId = rollbackMatch[1].trim();
        const ok = await inspector.rollbackTo(checkpointId);
        sendJson(res, ok ? 200 : 404, {
          reply: {
            id: `assistant-rollback-${Date.now()}`,
            role: 'assistant',
            content: ok
              ? `Rollback to ${checkpointId} completed.`
              : `Checkpoint ${checkpointId} not found.`,
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: ['[inspector] manual rollback requested'],
          ok,
        });
        return;
      }

      if (String(payload.message ?? '').trim() === '!clear_gradients') {
        const result = await inspector.clearPendingGradients();
        sendJson(res, 200, {
          reply: {
            id: `assistant-clear-gradients-${Date.now()}`,
            role: 'assistant',
            content: `Pending gradients cleared: ${result.removedCount}. Remaining pending: ${result.pendingAfter}.`,
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: ['[inspector] pending gradients cleared'],
          result,
        });
        return;
      }

      const setResonanceMatch = String(payload.message ?? '')
        .trim()
        .match(/^!set_resonance\s+([0-9]*\.?[0-9]+)\s+([0-9]*\.?[0-9]+)$/u);

      if (setResonanceMatch) {
        const thresholds = await inspector.setResonanceThresholds(
          Number(setResonanceMatch[1]),
          Number(setResonanceMatch[2])
        );
        sendJson(res, 200, {
          reply: {
            id: `assistant-set-resonance-${Date.now()}`,
            role: 'assistant',
            content: `Resonance thresholds updated: low=${thresholds.low}, recovery=${thresholds.recovery}.`,
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: ['[inspector] resonance thresholds updated'],
          thresholds,
        });
        return;
      }

      const setTestThresholdMatch = String(payload.message ?? '')
        .trim()
        .match(/^!set_test_threshold\s+([0-9]*\.?[0-9]+)$/u);

      if (setTestThresholdMatch) {
        const threshold = await inspector.setTestThreshold(
          Number(setTestThresholdMatch[1])
        );
        sendJson(res, 200, {
          reply: {
            id: `assistant-set-test-threshold-${Date.now()}`,
            role: 'assistant',
            content: `Test suite threshold updated to ${threshold.threshold}.`,
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: ['[inspector] test threshold updated'],
          threshold,
        });
        return;
      }

      if (
        String(payload.message ?? '').trim() === '!learning on' ||
        String(payload.message ?? '').trim() === '!learning off'
      ) {
        const enabled = String(payload.message ?? '').trim() === '!learning on';
        const result = await inspector.toggleLearning(enabled);
        sendJson(res, 200, {
          reply: {
            id: `assistant-learning-toggle-${Date.now()}`,
            role: 'assistant',
            content: `Learning ${result.enabled ? 'enabled' : 'disabled'} manually.`,
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: ['[inspector] manual learning toggle'],
          result,
        });
        return;
      }

      if (String(payload.message ?? '').trim() === '!metrics') {
        const metrics = inspector.getMetrics();
        sendJson(res, 200, {
          reply: {
            id: `assistant-metrics-${Date.now()}`,
            role: 'assistant',
            content: `Metrics: resonanceEvents=${metrics.resonanceEvents.length}, validationIncidents=${metrics.validationIncidents.length}, benchmarks=${metrics.benchmarkRuns.length}, pendingGradients=${metrics.pendingGradients.length}.`,
          },
          runtimeSource: 'server',
          providerLabel:
            payload.providerId === 'langchain'
              ? 'LangChain-style runtime adapter'
              : 'OpenAI Agents-style runtime adapter',
          trace: ['[inspector] metrics requested'],
          metrics,
        });
        return;
      }

      const result = await executeAgentTurn(payload);
      sendJson(res, 200, {
        ...result,
        trace: [
          ...result.trace,
          `[validation] verdict=${result.validationReport.verdict} score=${result.validationReport.score} uncertainty=${result.validationReport.uncertaintyPosture}`,
          `[validation-pressure] overall=${result.validationReport.pressureProfile.overallPressure} contradiction=${result.validationReport.pressureProfile.contradictionPressure} factual=${result.validationReport.pressureProfile.factualPressure}`,
          result.validationFollowup.gradient
            ? `[validation-gradient] target=${result.validationFollowup.gradient.target} shift=${result.validationFollowup.gradient.weightShift}`
            : '[validation-gradient] no corrective gradient required',
          result.validationFollowup.autoApply
            ? `[validation-auto-apply] applied=${result.validationFollowup.autoApply.appliedCount} rejected=${result.validationFollowup.autoApply.rejectedCount}`
            : '[validation-auto-apply] not triggered',
        ],
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unknown server error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/chat') {
    try {
      const payload = await readJsonBody(req);
      const result = await executeAtmanDirectTurn({
        message: payload.message ?? '',
        userId: payload.userId ?? 'web-user',
        personalityId: payload.personalityId ?? 'default',
        history: payload.history ?? [],
      });
      sendJson(res, 200, {
        response: result.replyText,
        report: result.report,
        trace: result.trace,
        delegatedToPantheon: result.delegatedToPantheon,
        researchReport: result.researchReport ?? null,
        navigationReport: result.navigationReport ?? null,
        netsurferReport: result.netsurferReport ?? null,
        childInterestsReport:
          result.childInterestsReport ?? result.interestsReport ?? null,
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown Atman chat error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/personality-chat') {
    try {
      const payload = await readJsonBody(req);
      const result = await executeAtmanDirectTurn({
        message: payload.message ?? '',
        userId: payload.userId ?? 'web-user',
        personalityId: payload.personalityId ?? 'default',
        history: payload.history ?? [],
      });
      sendJson(res, 200, {
        sessionKey: `${payload.personalityId ?? 'default'}:${payload.userId ?? 'web-user'}`,
        personalityId: payload.personalityId ?? 'default',
        response: result.replyText,
        report: result.report,
        trace: result.trace,
        delegatedToPantheon: result.delegatedToPantheon,
        researchReport: result.researchReport ?? null,
        navigationReport: result.navigationReport ?? null,
        netsurferReport: result.netsurferReport ?? null,
        childInterestsReport:
          result.childInterestsReport ?? result.interestsReport ?? null,
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman personality chat error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/chat/stream') {
    try {
      const payload = await readJsonBody(req);
      const message = payload.message ?? '';
      const userId = payload.userId ?? 'web-user';
      const personalityId = payload.personalityId ?? 'default';
      const linguisticProfile = linguisticAgent.analyze({
        message,
        taskId: `atman-stream-${Date.now()}`,
      });
      openEventStream(res);

      if (shouldUseUltraMode(message, userId)) {
        const result = await executeAtmanDirectTurn({
          message,
          userId,
          personalityId,
          history: payload.history ?? [],
          providerId: 'atman-direct',
        });

        for (const token of chunkResponseText(result.replyText)) {
          writeEventStream(res, { type: 'token', token });
        }

        writeEventStream(res, {
          type: 'done',
          response: result.replyText,
          report: result.report,
          trace: result.trace,
          delegatedToPantheon: result.delegatedToPantheon,
          childInterestsReport:
            result.childInterestsReport ?? result.interestsReport ?? null,
        });

        res.end();
        return;
      }

      if (shouldDelegateToPantheonTools(message, linguisticProfile)) {
        const result = await executeAtmanDirectTurn({
          message,
          userId,
          personalityId,
          history: payload.history ?? [],
          providerId: 'atman-direct',
        });

        for (const token of chunkResponseText(result.replyText)) {
          writeEventStream(res, { type: 'token', token });
        }

        writeEventStream(res, {
          type: 'done',
          response: result.replyText,
          report: result.report,
          trace: result.trace,
          delegatedToPantheon: result.delegatedToPantheon,
          childInterestsReport:
            result.childInterestsReport ?? result.interestsReport ?? null,
        });

        res.end();
        return;
      }

      const { activeAtman } = await getAtmanContext(personalityId);
      const childInterestsReport = await childInterests.processTurn({
        message,
        userId,
        taskId: `atman-stream-${Date.now()}`,
        trigger: 'atman-stream',
      });

      for await (const chunk of activeAtman.streamResponse({
        message,
        userId,
        personalityId,
        childInterestsReport,
        personalityProfile:
          atmanPersonalityManager.getPersonalityPromptProfile(personalityId),
      })) {
        writeEventStream(res, chunk);
      }

      res.end();
      return;
    } catch (error) {
      if (!res.headersSent) {
        openEventStream(res);
      }

      writeEventStream(res, {
        type: 'error',
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman streaming error',
      });
      res.end();
      return;
    }
  }

  if (
    req.method === 'POST' &&
    req.url === '/api/atman/personality-chat/stream'
  ) {
    try {
      const payload = await readJsonBody(req);
      const message = payload.message ?? '';
      const userId = payload.userId ?? 'web-user';
      const personalityId = payload.personalityId ?? 'default';
      const linguisticProfile = linguisticAgent.analyze({
        message,
        taskId: `atman-personality-stream-${Date.now()}`,
      });
      openEventStream(res);

      if (shouldUseUltraMode(message, userId)) {
        const result = await executeAtmanDirectTurn({
          message,
          userId,
          personalityId,
          history: payload.history ?? [],
          providerId: 'atman-direct',
        });
        for (const token of chunkResponseText(result.replyText)) {
          writeEventStream(res, { type: 'token', token });
        }
        writeEventStream(res, {
          type: 'done',
          response: result.replyText,
          report: result.report,
          trace: result.trace,
          delegatedToPantheon: result.delegatedToPantheon,
          personalityId: result.personalityId ?? personalityId,
          sessionKey: `${result.personalityId ?? personalityId}:${userId}`,
          childInterestsReport:
            result.childInterestsReport ?? result.interestsReport ?? null,
        });
        res.end();
        return;
      }

      if (shouldDelegateToPantheonTools(message, linguisticProfile)) {
        const result = await executeAtmanDirectTurn({
          message,
          userId,
          personalityId,
          history: payload.history ?? [],
          providerId: 'atman-direct',
        });
        for (const token of chunkResponseText(result.replyText)) {
          writeEventStream(res, { type: 'token', token });
        }
        writeEventStream(res, {
          type: 'done',
          response: result.replyText,
          report: result.report,
          trace: result.trace,
          delegatedToPantheon: result.delegatedToPantheon,
          personalityId,
          sessionKey: `${personalityId}:${userId}`,
          childInterestsReport:
            result.childInterestsReport ?? result.interestsReport ?? null,
        });
        res.end();
        return;
      }

      const { activeAtman } = await getAtmanContext(personalityId);
      const childInterestsReport = await childInterests.processTurn({
        message,
        userId,
        taskId: `atman-personality-stream-${Date.now()}`,
        trigger: 'atman-personality-stream',
      });
      for await (const chunk of activeAtman.streamResponse({
        message,
        userId,
        personalityId,
        childInterestsReport,
        personalityProfile:
          atmanPersonalityManager.getPersonalityPromptProfile(personalityId),
      })) {
        writeEventStream(res, chunk);
      }
      res.end();
      return;
    } catch (error) {
      if (!res.headersSent) {
        openEventStream(res);
      }
      writeEventStream(res, {
        type: 'error',
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman personality streaming error',
      });
      res.end();
      return;
    }
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/atman/status')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const { activeAtman, personality } = await getAtmanContext(
      requestUrl.searchParams.get('personalityId') ?? 'default'
    );
    sendJson(res, 200, {
      personality,
      ...activeAtman.getStatus(),
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/atman/personalities') {
    sendJson(res, 200, {
      personalities: atmanPersonalityManager.listPersonalities(),
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/atman/personality-templates') {
    sendJson(res, 200, {
      templates: atmanPersonalityManager.listPersonalityTemplates(),
    });
    return;
  }

  if (
    req.method === 'GET' &&
    req.url?.startsWith('/api/atman/ultra-sessions')
  ) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const sessions = listUltraSessions({
      userId: requestUrl.searchParams.get('userId') ?? null,
      limit: Number(requestUrl.searchParams.get('limit') ?? 20),
    });
    sendJson(res, 200, {
      sessions,
      total: sessions.length,
      activeSessionCount: ultraSessions.size,
      sessionIdleMs: ultraSessionIdleMs,
      expertTimeoutMs: ultraExpertTimeoutMs,
    });
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/atman/events')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    sendJson(
      res,
      200,
      atmanPersonalityManager.getEventLog({
        personalityId: requestUrl.searchParams.get('personalityId') ?? null,
        kind: requestUrl.searchParams.get('kind') ?? null,
        limit: Number(requestUrl.searchParams.get('limit') ?? 20),
      })
    );
    return;
  }

  if (
    req.method === 'GET' &&
    req.url?.startsWith('/api/atman/ethics/history')
  ) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    sendJson(
      res,
      200,
      atmanPersonalityManager.getPersonalityEthicsHistory(
        requestUrl.searchParams.get('personalityId') ?? 'default',
        Number(requestUrl.searchParams.get('limit') ?? 20)
      )
    );
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/atman/ethics')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    sendJson(
      res,
      200,
      atmanPersonalityManager.getPersonalityEthics(
        requestUrl.searchParams.get('personalityId') ?? 'default'
      )
    );
    return;
  }

  if (req.method === 'POST' && req.url === '/api/atman/ethics/set') {
    try {
      const payload = await readJsonBody(req);
      assertEthicsAdminAccess(payload);
      const personality =
        await atmanPersonalityManager.configurePersonalityEthics(
          payload.personalityId ?? 'default',
          payload.ethics ?? payload,
          {
            kind: 'manual-set',
            reason: String(payload.reason ?? 'manual-ethics-override'),
          }
        );
      sendJson(res, 200, {
        ok: true,
        personality,
        ethics: personality.ethics,
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman ethics set error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/ethics/reset') {
    try {
      const payload = await readJsonBody(req);
      assertEthicsAdminAccess(payload);
      const personality = await atmanPersonalityManager.resetPersonalityEthics(
        payload.personalityId ?? 'default',
        {
          kind: 'manual-reset',
          reason: String(payload.reason ?? 'reset-to-template-ethics'),
        }
      );
      sendJson(res, 200, {
        ok: true,
        personality,
        ethics: personality.ethics,
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman ethics reset error',
      });
      return;
    }
  }

  if (
    req.method === 'GET' &&
    req.url?.startsWith('/api/atman/name-generator')
  ) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    sendJson(res, 200, {
      suggestions: atmanPersonalityManager.generatePersonalityNames(
        Number(requestUrl.searchParams.get('count') ?? 6)
      ),
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/interests/status') {
    sendJson(res, 200, {
      ...childInterests.getStatus(),
      automation: getChildInterestsAutomationStatus(),
    });
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/interests/logs')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const limit = Number(requestUrl.searchParams.get('limit') ?? 60);
    sendJson(res, 200, {
      logs: childInterests.getLogs(limit),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/interests/explore') {
    try {
      const payload = await readJsonBody(req);
      const shouldUseInternet = payload.internet !== false;

      if (shouldUseInternet) {
        const result = await runChildInterestsAutoExplore(
          'manual-interest-explore',
          {
            force: true,
            topic: payload.topic,
            message: payload.message,
            query: payload.query,
            urls: payload.urls,
          }
        );
        sendJson(res, 200, result);
        return;
      }

      const report = await childInterests.manualExplore(payload);
      sendJson(res, 200, {
        report,
        automation: getChildInterestsAutomationStatus(),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown interests exploration error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/interests/automation') {
    try {
      const payload = await readJsonBody(req);

      if (typeof payload.enabled === 'boolean') {
        childInterestsAutomation.enabled = payload.enabled;
      }

      const runResult = payload.runNow
        ? await runChildInterestsAutoExplore('manual-automation-run', {
            force: true,
            topic: payload.topic,
            message: payload.message,
            query: payload.query,
            urls: payload.urls,
          })
        : null;

      sendJson(res, 200, {
        automation: getChildInterestsAutomationStatus(),
        runResult,
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown interests automation error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/interests/migrate') {
    try {
      const migration = await childInterests.migratePersistedState();
      sendJson(res, 200, {
        migration,
        status: childInterests.getStatus(),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown interests migration error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/atman/examples')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const limit = Number(requestUrl.searchParams.get('limit') ?? 50);
    const { activeAtman } = await getAtmanContext(
      requestUrl.searchParams.get('personalityId') ?? 'default'
    );
    sendJson(res, 200, {
      examples: activeAtman.getExamples(limit),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/atman/examples') {
    try {
      const payload = await readJsonBody(req);
      const { activeAtman } = await getAtmanContext(
        payload.personalityId ?? 'default'
      );
      const example = await activeAtman.addExample(payload);
      sendJson(res, 200, { example });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman example error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/atman/logs')) {
    try {
      const requestUrl = new URL(req.url, `http://localhost:${port}`);
      const limit = Number(requestUrl.searchParams.get('limit') ?? 80);
      const { activeAtman } = await getAtmanContext(
        requestUrl.searchParams.get('personalityId') ?? 'default'
      );
      sendJson(res, 200, {
        logs: activeAtman.getLogs(limit),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown Atman log error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/bridge/status') {
    sendJson(res, 200, shaktiBridge.getStatus());
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/bridge/logs')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const limit = Number(requestUrl.searchParams.get('limit') ?? 60);
    sendJson(res, 200, {
      logs: shaktiBridge.getLogs(limit),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/bridge/config') {
    try {
      const payload = await readJsonBody(req);
      sendJson(res, 200, {
        status: shaktiBridge.configure(payload),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown bridge config error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/bridge/start') {
    try {
      const payload = await readJsonBody(req);
      const result = await shaktiBridge.startSession(payload);
      sendJson(res, 200, { result });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown bridge start error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/bridge/stop') {
    try {
      const payload = await readJsonBody(req);
      const result = await shaktiBridge.stopSession(
        payload.reason ?? 'manual-stop'
      );
      sendJson(res, 200, { result });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown bridge stop error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/bridge/message') {
    try {
      const payload = await readJsonBody(req);
      const result = await shaktiBridge.receiveExternalMessage(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown bridge message error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/google-chat/status') {
    sendJson(res, 200, shaktiBridge.getStatus());
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/google-chat/logs')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const limit = Number(requestUrl.searchParams.get('limit') ?? 60);
    sendJson(res, 200, {
      logs: shaktiBridge.getLogs(limit),
    });
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/google-chat/queue')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const limit = Number(requestUrl.searchParams.get('limit') ?? 20);
    sendJson(res, 200, {
      messages: shaktiBridge.getQueuedMessages(limit),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/google-chat/config') {
    try {
      const payload = await readJsonBody(req);
      sendJson(res, 200, {
        status: shaktiBridge.configure(payload),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Google Chat config error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/google-chat/start') {
    try {
      const payload = await readJsonBody(req);
      const result = await shaktiBridge.startSession(payload);
      sendJson(res, 200, { result });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Google Chat start error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/google-chat/stop') {
    try {
      const payload = await readJsonBody(req);
      const result = await shaktiBridge.stopSession(
        payload.reason ?? 'manual-google-chat-stop'
      );
      sendJson(res, 200, { result });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Google Chat stop error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/google-chat/send_to_child') {
    try {
      const payload = await readJsonBody(req);
      const result = await shaktiBridge.receiveExternalMessage(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Google Chat inbound error',
      });
      return;
    }
  }

  if (
    req.method === 'GET' &&
    req.url?.startsWith('/api/google-chat/get_next_message')
  ) {
    const messageEntry = shaktiBridge.popNextQueuedMessage();
    sendJson(
      res,
      200,
      messageEntry
        ? { text: messageEntry.text, message: messageEntry }
        : { text: '', message: null }
    );
    return;
  }

  if (req.method === 'GET' && req.url === '/api/app-bots/status') {
    sendJson(res, 200, appBotRegistry.getStatus());
    return;
  }

  if (req.method === 'POST' && req.url === '/api/app-bots/create') {
    try {
      const payload = await readJsonBody(req);
      const bot = await appBotRegistry.createBot(payload);
      sendJson(res, 200, {
        bot,
        status: appBotRegistry.getStatus(),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown app bot create error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/app-bots/update') {
    try {
      const payload = await readJsonBody(req);
      const bot = await appBotRegistry.updateBot(payload.botId, payload);
      sendJson(res, 200, {
        bot,
        status: appBotRegistry.getStatus(),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown app bot update error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/app-bots/train') {
    try {
      const payload = await readJsonBody(req);
      const result = await appBotRegistry.addTrainingEntry(
        payload.botId,
        payload
      );
      sendJson(res, 200, {
        ...result,
        status: appBotRegistry.getStatus(),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown app bot training error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/app-bots/start') {
    try {
      const payload = await readJsonBody(req);
      const result = await appBotRegistry.startBot(payload.botId, payload);
      sendJson(res, 200, {
        ...result,
        status: appBotRegistry.getStatus(),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown app bot start error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/app-bots/stop') {
    try {
      const payload = await readJsonBody(req);
      const result = await appBotRegistry.stopBot(
        payload.botId,
        payload.reason ?? 'admin-stop'
      );
      sendJson(res, 200, {
        ...result,
        status: appBotRegistry.getStatus(),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown app bot stop error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/training/status')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const personalityId = requestUrl.searchParams.get('personalityId');
    const limit = Number(requestUrl.searchParams.get('limit') ?? 20);
    sendJson(
      res,
      200,
      trainingRegistry.getStatus({
        personalityId,
        limit,
      })
    );
    return;
  }

  if (req.method === 'POST' && req.url === '/api/training/prepare') {
    try {
      const payload = await readJsonBody(req);
      const result = await trainingRegistry.prepareDataset(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown training prepare error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/training/start') {
    try {
      const payload = await readJsonBody(req);
      const result = await trainingRegistry.startJob(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown training start error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/training/evaluate') {
    try {
      const payload = await readJsonBody(req);
      const result = await trainingRegistry.evaluateJob(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown training evaluate error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/training/approve') {
    try {
      const payload = await readJsonBody(req);
      const result = await trainingRegistry.approveJob(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown training approve error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/training/reject') {
    try {
      const payload = await readJsonBody(req);
      const result = await trainingRegistry.rejectJob(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown training reject error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/training/activate') {
    try {
      const payload = await readJsonBody(req);
      const result = await trainingRegistry.activateJob(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown training activate error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/telegram/status') {
    sendJson(res, 200, telegramBot.getStatus());
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/telegram/logs')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const limit = Number(requestUrl.searchParams.get('limit') ?? 60);
    sendJson(res, 200, {
      logs: telegramBot.getLogs(limit),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/telegram/config') {
    try {
      const payload = await readJsonBody(req);
      sendJson(res, 200, {
        status: telegramBot.configure(payload),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Telegram config error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/telegram/start') {
    try {
      const payload = await readJsonBody(req);
      const result = await telegramBot.start(payload);
      sendJson(res, 200, { result });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Telegram start error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/telegram/stop') {
    try {
      const payload = await readJsonBody(req);
      const result = await telegramBot.stop(
        payload.reason ?? 'manual-telegram-stop'
      );
      sendJson(res, 200, { result });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Telegram stop error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/telegram/send') {
    try {
      const payload = await readJsonBody(req);
      const chatId = String(payload.chatId ?? '').trim();
      const text = String(payload.text ?? '').trim();

      if (!chatId || !text) {
        sendJson(res, 400, { error: 'chatId and text are required.' });
        return;
      }

      const result = await telegramBot.sendMessage(chatId, text);
      sendJson(res, 200, { result });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Telegram send error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/telegram/send-artifact') {
    try {
      const payload = await readJsonBody(req);
      const chatId = String(payload.chatId ?? '').trim();
      const artifact = payload.artifact ?? null;

      if (!chatId || !artifact?.dataBase64) {
        sendJson(res, 400, {
          error: 'chatId and artifact.dataBase64 are required.',
        });
        return;
      }

      const result = await telegramBot.sendArtifact(chatId, artifact, {
        caption: payload.caption,
      });
      sendJson(res, 200, { result });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Telegram artifact send error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/train') {
    try {
      const payload = await readJsonBody(req);
      const { activeAtman } = await getAtmanContext(
        payload.personalityId ?? 'default'
      );
      const example = await activeAtman.trainFromDialogue({
        user: payload.user ?? payload.message ?? '',
        assistant: payload.assistant ?? payload.response ?? '',
        source: payload.source ?? 'manual-train-endpoint',
        tags: payload.tags ?? ['manual'],
      });
      sendJson(res, 200, { example });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown Atman train error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/seed') {
    try {
      const payload = await readJsonBody(req);
      const { activeAtman } = await getAtmanContext(
        payload.personalityId ?? 'default'
      );
      const result = await activeAtman.seedKnowledge(
        payload.profile ?? 'child-3',
        payload.mode ?? 'merge'
      );
      sendJson(res, 200, { result });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown Atman seed error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/atman/weights')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const { activeAtman } = await getAtmanContext(
      requestUrl.searchParams.get('personalityId') ?? 'default'
    );
    sendJson(res, 200, activeAtman.getWeights());
    return;
  }

  if (req.method === 'POST' && req.url === '/api/atman/weights') {
    try {
      const payload = await readJsonBody(req);
      const { activeAtman } = await getAtmanContext(
        payload.personalityId ?? 'default'
      );
      const weights = await activeAtman.setWeights(payload);
      sendJson(res, 200, { weights });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown Atman weight error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/atman/history')) {
    try {
      const requestUrl = new URL(req.url, `http://localhost:${port}`);
      const userId = requestUrl.searchParams.get('userId') ?? 'web-user';
      const { activeAtman } = await getAtmanContext(
        requestUrl.searchParams.get('personalityId') ?? 'default'
      );
      sendJson(res, 200, {
        userId,
        history: activeAtman.getHistory(userId, 30),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman history error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/atman/checkpoints')) {
    try {
      const requestUrl = new URL(req.url, `http://localhost:${port}`);
      const checkpointId = requestUrl.searchParams.get('checkpointId');
      const { activeAtman } = await getAtmanContext(
        requestUrl.searchParams.get('personalityId') ?? 'default'
      );

      if (checkpointId) {
        sendJson(res, 200, {
          checkpoint: await activeAtman.getCheckpoint(checkpointId),
        });
        return;
      }

      sendJson(res, 200, {
        checkpoints: await activeAtman.listCheckpoints(
          Number(requestUrl.searchParams.get('limit') ?? 40)
        ),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman checkpoint error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/checkpoint') {
    try {
      const payload = await readJsonBody(req);
      const { activeAtman } = await getAtmanContext(
        payload.personalityId ?? 'default'
      );
      const checkpoint = await activeAtman.createCheckpoint({
        label: payload.label,
        summary: payload.summary,
        source: payload.source ?? 'manual-endpoint',
      });
      sendJson(res, 200, { checkpoint });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman checkpoint create error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/rollback') {
    try {
      const payload = await readJsonBody(req);
      const { activeAtman } = await getAtmanContext(
        payload.personalityId ?? 'default'
      );
      const checkpoint = await activeAtman.restoreCheckpoint(
        payload.checkpointId,
        'manual-endpoint-rollback'
      );
      sendJson(res, 200, { checkpoint });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman checkpoint restore error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/clone') {
    try {
      const payload = await readJsonBody(req);
      const personality = await atmanPersonalityManager.clonePersonality({
        sourceId: payload.sourceId ?? 'default',
        personalityId: payload.personalityId,
        displayName: payload.displayName,
        templateId: payload.templateId,
        selfLearning: payload.selfLearning,
      });
      sendJson(res, 200, { personality });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown Atman clone error',
      });
      return;
    }
  }

  if (
    req.method === 'GET' &&
    req.url?.startsWith('/api/atman/scheduler/status')
  ) {
    try {
      const requestUrl = new URL(req.url, `http://localhost:${port}`);
      const status = await getAtmanSchedulerStatus(
        requestUrl.searchParams.get('personalityId')
      );
      sendJson(res, 200, status);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman scheduler status error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/scheduler/config') {
    try {
      const payload = await readJsonBody(req);
      const personality = await configureAtmanScheduler(payload);
      sendJson(res, 200, { personality });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman scheduler config error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/scheduler/run') {
    try {
      const payload = await readJsonBody(req);
      const result = payload.personalityId
        ? await runAtmanMonteCarloSelfLearning({
            personalityId: payload.personalityId,
            topic: payload.topic,
            rollouts: payload.rollouts,
            trigger: 'manual-scheduler-run',
          })
        : await runAtmanSchedulerTick('manual-scheduler-run');
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman scheduler run error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/self-learn') {
    try {
      const payload = await readJsonBody(req);
      const result = await runAtmanMonteCarloSelfLearning(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman self-learning error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/atman/social-map') {
    sendJson(res, 200, atmanPersonalityManager.getSocialMap());
    return;
  }

  if (req.method === 'POST' && req.url === '/api/atman/social-simulate') {
    try {
      const payload = await readJsonBody(req);
      const result =
        await atmanPersonalityManager.simulateSocialExchange(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman social simulation error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/atman/media/status') {
    sendJson(res, 200, personalityMultimodal.getStatus());
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/atman/media/tasks')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const limit = Number(requestUrl.searchParams.get('limit') ?? 40);
    sendJson(res, 200, { tasks: personalityMultimodal.getTasks(limit) });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/atman/media/cancel') {
    try {
      const payload = await readJsonBody(req);
      const task = personalityMultimodal.cancelTask(payload.taskId);
      sendJson(res, task ? 200 : 404, { task });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman media cancel error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/interests/simulate') {
    try {
      const payload = await readJsonBody(req);
      const steps = Math.max(1, Math.min(24, Number(payload.steps ?? 4) || 4));
      const reports = [];

      for (let index = 0; index < steps; index += 1) {
        reports.push(
          await childInterests.manualExplore({
            topic: payload.topic,
            message:
              payload.message ??
              `Изучи тему ${payload.topic ?? childInterests.getStatus().currentFocus} шаг ${index + 1}`,
          })
        );
      }

      sendJson(res, 200, {
        steps,
        reports,
        status: childInterests.getStatus(),
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown interests simulation error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/atman/media/logs')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const limit = Number(requestUrl.searchParams.get('limit') ?? 60);
    sendJson(res, 200, {
      logs: personalityMultimodal.getLogs(limit),
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/atman/media/profile') {
    try {
      const payload = await readJsonBody(req);
      const personality =
        await atmanPersonalityManager.configureMultimodalProfile(
          payload.personalityId ?? 'default',
          payload.multimodal ?? {}
        );
      sendJson(res, 200, { personality });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman media profile error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/media/tts') {
    try {
      const payload = await readJsonBody(req);
      const artifact = await personalityMultimodal.synthesizeSpeech(payload);
      sendJson(res, 200, { artifact });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown Atman TTS error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/media/stt') {
    try {
      const payload = await readJsonBody(req);
      const result = await personalityMultimodal.transcribeSpeech(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown Atman STT error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/media/image/generate') {
    try {
      const payload = await readJsonBody(req);
      const artifact = await personalityMultimodal.generateImage(payload);
      sendJson(res, 200, { artifact });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman image generation error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/media/image/describe') {
    try {
      const payload = await readJsonBody(req);
      const result = await personalityMultimodal.describeImage(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman image description error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/media/video/generate') {
    try {
      const payload = await readJsonBody(req);
      const artifact = await personalityMultimodal.generateVideo(payload);
      sendJson(res, 200, { artifact });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman video generation error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/atman/media/video/describe') {
    try {
      const payload = await readJsonBody(req);
      const result = await personalityMultimodal.describeVideo(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Atman video description error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/research/run') {
    try {
      const payload = await readJsonBody(req);
      const run = await pantheonWebScout.survey({
        query: payload.query ?? payload.message ?? 'Pantheon scout run',
        taskId: payload.taskId ?? 'manual-research',
        history: payload.history ?? [],
        urls: payload.urls ?? [],
      });
      await learningLedger.recordResearchRun(run);
      sendJson(res, 200, { run });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown research error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/validation/run') {
    try {
      const payload = await readJsonBody(req);
      const run = await pantheonValidator.validate({
        taskId: payload.taskId ?? 'manual-validation',
        message: payload.message ?? '',
        reply: payload.reply ?? '',
        history: payload.history ?? [],
        researchReport: payload.researchReport ?? null,
      });
      const validationReply = {
        id: payload.messageId ?? `manual-validation-reply-${Date.now()}`,
        role: 'assistant',
        content: payload.reply ?? '',
      };
      const followup = await persistValidationFailure(
        run,
        validationReply,
        payload.providerId ?? 'manual-validation'
      );
      await learningLedger.recordValidationRun(run);
      sendJson(res, 200, { run, followup });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown validation error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/facts/store') {
    try {
      const payload = await readJsonBody(req);
      const fact = await learningLedger.storeFact({
        key: payload.key,
        value: payload.value,
        score: payload.score ?? 1,
        ttlMs: payload.ttlMs ?? factTtlMs,
        source: payload.source ?? 'manual-fact',
        claimType: payload.claimType ?? 'fact',
        provenance: payload.provenance ?? 'manual',
        validationStatus: payload.validationStatus ?? 'unverified',
        lastValidatedAt: payload.lastValidatedAt ?? null,
      });
      sendJson(res, 200, { fact });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown fact storage error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/facts/recall') {
    try {
      const payload = await readJsonBody(req);
      const facts = learningLedger.recallFactsByKeywords(
        payload.keywords ?? [],
        {
          limit: payload.limit ?? 10,
          minScore: payload.minScore ?? 0,
        }
      );
      sendJson(res, 200, { facts });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown fact recall error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/feedback') {
    try {
      const payload = await readJsonBody(req);
      const feedbackEvent = await learningLedger.recordFeedback(payload);
      const gradient = buildFeedbackGradient(feedbackEvent);
      await learningLedger.recordFeedbackGradients([gradient], {
        trigger: 'immediate-feedback-ingest',
        processedAt: new Date().toISOString(),
      });
      const autoApply = await maybeAutoApplyFeedback();
      let generatedTestCase = null;

      if (
        payload.sentiment === 'positive' &&
        payload.autoCreateTest &&
        String(payload.userMessage ?? '').trim() &&
        String(payload.assistantMessage ?? '').trim()
      ) {
        generatedTestCase = await pantheonTestSuite.addTest({
          question: payload.userMessage,
          answer: payload.assistantMessage,
          taskId: payload.taskId,
          providerId: payload.providerId,
          matchStrategy: 'similarity',
          threshold: Number(payload.testThreshold ?? 0.35),
        });
      }

      sendJson(res, 200, { ok: true, gradient, autoApply, generatedTestCase });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown feedback error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/feedback/process') {
    try {
      const result = await processFeedbackLoop('manual-feedback-loop');
      sendJson(res, 200, { ok: true, result });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown feedback processing error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/feedback/apply') {
    try {
      const result = await applyFeedbackLoop('manual-feedback-apply');
      sendJson(res, 200, { ok: true, result });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown feedback apply error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/tests/run') {
    try {
      const run = await pantheonTestSuite.runTests({
        trigger: 'manual-endpoint',
      });
      sendJson(res, 200, { run });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown benchmark error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/tests/state') {
    const snapshot = learningLedger.getSnapshot();
    sendJson(res, 200, {
      tests: pantheonTestSuite.listTests(),
      accuracyThreshold: pantheonTestSuite.accuracyThreshold,
      checkIntervalMs: pantheonTestSuite.checkIntervalMs,
      blocked: snapshot.learningControl.testSuiteBlocked,
      lastAccuracy: snapshot.learningControl.lastTestSuiteAccuracy,
      lastRunAt: snapshot.learningControl.lastTestSuiteRunAt,
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/tests/add') {
    try {
      const payload = await readJsonBody(req);
      const testCase = await pantheonTestSuite.addTest(payload);
      sendJson(res, 200, { testCase });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown test add error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/tests/remove') {
    try {
      const payload = await readJsonBody(req);
      const removed = await pantheonTestSuite.removeTest(payload.id ?? '');

      if (!removed) {
        sendJson(res, 404, { error: 'Test not found' });
        return;
      }

      sendJson(res, 200, { ok: true });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown test remove error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/tests/unblock') {
    try {
      const result = await pantheonTestSuite.unblock('manual-endpoint');
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown test unblock error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/navigation/run') {
    try {
      const payload = await readJsonBody(req);
      const run = await pantheonNavigationCore.journey({
        taskId: payload.taskId ?? 'manual-navigation',
        goal: payload.goal ?? payload.message ?? 'Pantheon navigation run',
        urls: payload.urls ?? [],
      });
      await learningLedger.recordNavigationRun(run);
      sendJson(res, 200, { run });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown navigation error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/netsurfer/status') {
    try {
      sendJson(res, 200, await pantheonNetSurfer.snapshot());
      return;
    } catch (error) {
      sendJson(res, 200, {
        ...pantheonNetSurfer.getStatus(),
        error: error instanceof Error ? error.message : 'NetSurfer unavailable',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/netsurfer/logs')) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    const limit = Number(requestUrl.searchParams.get('limit') ?? 60);
    sendJson(res, 200, { logs: pantheonNetSurfer.getLogs(limit) });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/netsurfer/navigate') {
    try {
      const payload = await readJsonBody(req);
      const result = await pantheonNetSurfer.navigate(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown NetSurfer navigation error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/netsurfer/search') {
    try {
      const payload = await readJsonBody(req);
      const result = await pantheonNetSurfer.search(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown NetSurfer search error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/netsurfer/click') {
    try {
      const payload = await readJsonBody(req);
      const result = await pantheonNetSurfer.click(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown NetSurfer click error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/netsurfer/type') {
    try {
      const payload = await readJsonBody(req);
      const result = await pantheonNetSurfer.typeText(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown NetSurfer type error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/netsurfer/scroll') {
    try {
      const payload = await readJsonBody(req);
      const result = await pantheonNetSurfer.scroll(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown NetSurfer scroll error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/learning/state') {
    sendJson(res, 200, learningLedger.getSnapshot());
    return;
  }

  if (
    req.method === 'GET' &&
    req.url?.startsWith('/api/learning/atman-events')
  ) {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    sendJson(
      res,
      200,
      learningLedger.getAtmanEvents({
        personalityId: requestUrl.searchParams.get('personalityId') ?? null,
        kind: requestUrl.searchParams.get('kind') ?? null,
        limit: Number(requestUrl.searchParams.get('limit') ?? 20),
      })
    );
    return;
  }

  if (req.method === 'GET' && req.url === '/api/inspector/status') {
    sendJson(res, 200, await inspector.getStatus());
    return;
  }

  if (req.method === 'GET' && req.url === '/api/inspector/checkpoints') {
    sendJson(res, 200, { checkpoints: inspector.listCheckpoints(20) });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/inspector/metrics') {
    sendJson(res, 200, inspector.getMetrics());
    return;
  }

  if (req.method === 'GET' && req.url === '/api/inspector/module-targets') {
    sendJson(res, 200, { targets: inspector.listMutableTargets() });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/inspector/checkpoint') {
    try {
      const checkpoint = await inspector.createCheckpoint('manual-endpoint');
      sendJson(res, 200, { checkpoint });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown checkpoint error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/inspector/rollback') {
    try {
      const payload = await readJsonBody(req);
      const ok = await inspector.rollbackTo(
        String(payload.checkpointId ?? '').trim()
      );

      if (!ok) {
        sendJson(res, 404, { error: 'Checkpoint not found' });
        return;
      }

      sendJson(res, 200, { ok: true });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown rollback error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/inspector/gradients/clear') {
    try {
      const result = await inspector.clearPendingGradients();
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown gradient clear error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/inspector/learning') {
    try {
      const payload = await readJsonBody(req);
      const result = await inspector.toggleLearning(Boolean(payload.enabled));
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown learning toggle error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/inspector/resonance/config') {
    try {
      const payload = await readJsonBody(req);
      const thresholds = await inspector.setResonanceThresholds(
        payload.low,
        payload.recovery
      );
      sendJson(res, 200, thresholds);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown resonance config error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/inspector/test-suite/config') {
    try {
      const payload = await readJsonBody(req);
      const threshold = await inspector.setTestThreshold(payload.threshold);
      sendJson(res, 200, threshold);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown test suite config error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/inspector/module-patch') {
    try {
      const payload = await readJsonBody(req);
      const result = await inspector.applyModulePatch(payload);
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error ? error.message : 'Unknown module patch error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/inspector/compile') {
    try {
      const result = await inspector.compileWorkspace({
        trigger: 'manual-endpoint',
      });
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unknown compile error',
      });
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/rishi/state') {
    sendJson(res, 200, rishi.inspect(learningLedger.getSnapshot()));
    return;
  }

  if (req.method === 'GET' && req.url === '/api/resonance/state') {
    sendJson(res, 200, await resonanceMonitor.getState());
    return;
  }

  if (req.method === 'POST' && req.url === '/api/resonance/check') {
    try {
      const result = await resonanceMonitor.runCheck('manual-resonance-check');
      const state = await resonanceMonitor.getState();
      sendJson(res, 200, { result, state });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown resonance check error',
      });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/rishi/checkpoint') {
    try {
      const rishiState = await createRishiCheckpoint('manual-rishi-checkpoint');
      sendJson(res, 200, {
        ok: true,
        checkpoint:
          learningLedger.getSnapshot().rishiCheckpoints.at(-1) ?? null,
        rishiState,
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Rishi checkpoint error',
      });
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.on('clientError', (error, socket) => {
  runtimeState.lastFatalError = {
    source: 'client-error',
    createdAt: new Date().toISOString(),
    message: normalizeErrorMessage(error),
  };
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(port, () => {
  console.log(`Agent runtime server listening on http://localhost:${port}`);
  console.log(`Learning ledger path: ${learningLedger.ledgerPath}`);
  console.log(`Night Distillation interval: ${nightDistillationInterval}ms`);
  console.log(`Rishi checkpoint interval: ${rishiCheckpointInterval}ms`);
  console.log(`Feedback processing interval: ${feedbackProcessingInterval}ms`);
  console.log(`Feedback apply interval: ${feedbackApplicationInterval}ms`);
  console.log(`Feedback auto-apply batch size: ${feedbackAutoApplyBatchSize}`);
  console.log(
    `Child interests auto-explore interval: ${childInterestsAutoExploreIntervalMs}ms (enabled=${childInterestsAutomation.enabled})`
  );
  console.log(`Pantheon fact TTL: ${factTtlMs}ms`);
  console.log(`Pantheon min fact score: ${factMinScore}`);
  console.log(`Resonance check interval: ${resonanceCheckIntervalMs}ms`);
  console.log(
    `Resonance thresholds: low=${resonanceLowThreshold}, recovery=${resonanceRecoveryThreshold}`
  );
  console.log(`Test suite path: ${pantheonTestSuite.testSuitePath}`);
  console.log(`Test suite threshold: ${testSuiteAccuracyThreshold}`);
  console.log(
    `Runtime health check interval: ${runtimeHealthCheckIntervalMs}ms`
  );

  if (telegramBotAutoStart && process.env.TELEGRAM_BOT_TOKEN) {
    telegramBot
      .start()
      .then((status) => {
        console.log(
          `Telegram bot polling started for @${status.botUsername ?? 'unknown-bot'}`
        );
      })
      .catch((error) => {
        console.error(
          `Telegram bot autostart failed: ${error instanceof Error ? error.message : 'Unknown Telegram error'}`
        );
      });
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    performGracefulShutdown(signal.toLowerCase()).catch((error) => {
      console.error(
        `Graceful shutdown failed after ${signal}: ${normalizeErrorMessage(error)}`
      );
      process.exitCode = 1;
    });
  });
}

process.on('unhandledRejection', (reason) => {
  runtimeState.lastFatalError = {
    source: 'unhandled-rejection',
    createdAt: new Date().toISOString(),
    message: normalizeErrorMessage(reason),
  };
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  runtimeState.lastFatalError = {
    source: 'uncaught-exception',
    createdAt: new Date().toISOString(),
    message: normalizeErrorMessage(error),
  };
  console.error('Uncaught exception:', error);
  performGracefulShutdown('uncaught-exception').catch((shutdownError) => {
    console.error(
      `Graceful shutdown after uncaught exception failed: ${normalizeErrorMessage(shutdownError)}`
    );
    process.exitCode = 1;
  });
});
