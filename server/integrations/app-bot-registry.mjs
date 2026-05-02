import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRegistryPath = path.join(__dirname, 'data', 'app-bots.json');

const defaultTemplates = [
  {
    id: 'lichess',
    displayName: 'Lichess Coach',
    appId: 'lichess.com',
    siteUrl: 'https://lichess.org',
    category: 'game',
    description: 'Шахматный бот-наставник для разборов, тренировок и supervised playbook.',
  },
  {
    id: 'notago',
    displayName: 'Notago Guide',
    appId: 'notago.ru',
    siteUrl: 'https://notago.ru',
    category: 'game',
    description: 'Бот для пошагового освоения игровых сценариев и пользовательских стратегий.',
  },
  {
    id: 'zagram',
    displayName: 'Zagram Strategist',
    appId: 'zagram.com',
    siteUrl: 'https://zagram.com',
    category: 'game',
    description: 'Отдельный игровой бот с тренировочным журналом и надзором Атмана.',
  },
];

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeBotId(value) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-');

  if (!normalized) {
    throw new Error('App bot id is required.');
  }

  return normalized;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createTrainingState(input = {}) {
  return {
    enabled: input.enabled !== false,
    userGuidance: normalizeText(input.userGuidance),
    atmanSupervision: normalizeText(input.atmanSupervision) || 'Атман следит за безопасностью, качеством стратегии и темпом обучения.',
    lessons: Array.isArray(input.lessons) ? input.lessons.slice(-40) : [],
    lastLessonAt: input.lastLessonAt ?? null,
  };
}

function createRuntimeState(input = {}) {
  return {
    status: input.status ?? 'idle',
    lastStartedAt: input.lastStartedAt ?? null,
    lastStoppedAt: input.lastStoppedAt ?? null,
    lastSessionUserId: input.lastSessionUserId ?? null,
    lastReason: input.lastReason ?? null,
  };
}

function normalizeTemplateRecord(entry = {}) {
  return {
    id: normalizeBotId(entry.id ?? entry.appId ?? entry.displayName ?? `app-bot-${Date.now()}`),
    displayName: normalizeText(entry.displayName) || 'App Bot',
    appId: normalizeText(entry.appId) || 'custom-app',
    siteUrl: normalizeText(entry.siteUrl) || null,
    category: normalizeText(entry.category) || 'application',
    description: normalizeText(entry.description) || '',
  };
}

function normalizeBotRecord(entry = {}) {
  const id = normalizeBotId(entry.id ?? entry.appId ?? entry.displayName ?? `app-bot-${Date.now()}`);
  return {
    id,
    displayName: normalizeText(entry.displayName) || id,
    appId: normalizeText(entry.appId) || id,
    siteUrl: normalizeText(entry.siteUrl) || null,
    category: normalizeText(entry.category) || 'application',
    description: normalizeText(entry.description) || '',
    personalityId: normalizeText(entry.personalityId) || 'default',
    supervisorPersonalityId: normalizeText(entry.supervisorPersonalityId) || 'default',
    createdAt: entry.createdAt ?? new Date().toISOString(),
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
    training: createTrainingState(entry.training),
    runtime: createRuntimeState(entry.runtime),
  };
}

export class AppBotRegistry {
  constructor(options = {}) {
    this.registryPath = options.registryPath ?? process.env.APP_BOT_REGISTRY_PATH ?? defaultRegistryPath;
    this.bridge = options.bridge ?? null;
    this.templates = (options.templates ?? defaultTemplates).map((entry) => normalizeTemplateRecord(entry));
    this.bots = [];
    this.logs = [];
    this.logLimit = Number(options.logLimit ?? 160);
  }

  async init() {
    await mkdir(path.dirname(this.registryPath), { recursive: true });

    try {
      const raw = await readFile(this.registryPath, 'utf8');
      const payload = JSON.parse(raw);
      this.bots = Array.isArray(payload.bots) ? payload.bots.map((entry) => normalizeBotRecord(entry)) : [];
      this.logs = Array.isArray(payload.logs) ? payload.logs.slice(-this.logLimit) : [];
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }

      await this.flush();
    }
  }

  async flush() {
    await writeFile(this.registryPath, `${JSON.stringify({ bots: this.bots, logs: this.logs }, null, 2)}\n`, 'utf8');
  }

  async log(event) {
    this.logs = [
      ...this.logs,
      {
        id: event.id ?? `app-bot-log-${Date.now()}`,
        createdAt: event.createdAt ?? new Date().toISOString(),
        ...event,
      },
    ].slice(-this.logLimit);
    await this.flush();
    return this.logs;
  }

  listTemplates() {
    return this.templates.map((entry) => deepClone(entry));
  }

  listBots() {
    return this.bots
      .map((entry) => deepClone(entry))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'ru'));
  }

  getBot(botId) {
    const normalizedId = normalizeBotId(botId);
    const bot = this.bots.find((entry) => entry.id === normalizedId);

    if (!bot) {
      throw new Error(`Unknown app bot: ${normalizedId}`);
    }

    return bot;
  }

  getStatus() {
    return {
      botCount: this.bots.length,
      activeBotCount: this.bots.filter((entry) => entry.runtime.status === 'active').length,
      trainingBotCount: this.bots.filter((entry) => entry.runtime.status === 'training').length,
      templates: this.listTemplates(),
      bots: this.listBots(),
      logs: [...this.logs].slice(-40).reverse(),
    };
  }

  buildBotRecord(input = {}) {
    const template = normalizeText(input.templateId)
      ? this.templates.find((entry) => entry.id === normalizeBotId(input.templateId)) ?? null
      : null;
    return normalizeBotRecord({
      ...template,
      ...input,
      training: {
        userGuidance: normalizeText(input.userGuidance),
        atmanSupervision: normalizeText(input.atmanSupervision),
      },
    });
  }

  async createBot(input = {}) {
    const bot = this.buildBotRecord(input);

    if (this.bots.some((entry) => entry.id === bot.id)) {
      throw new Error(`App bot ${bot.id} already exists.`);
    }

    this.bots.push(bot);
    await this.log({
      kind: 'create',
      botId: bot.id,
      summary: `App bot ${bot.displayName} created for ${bot.appId}.`,
    });
    await this.flush();
    return deepClone(bot);
  }

  async updateBot(botId, input = {}) {
    const current = this.getBot(botId);
    const updated = normalizeBotRecord({
      ...current,
      ...input,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      training: {
        ...current.training,
        ...(input.training ?? {}),
        userGuidance: input.userGuidance ?? current.training.userGuidance,
        atmanSupervision: input.atmanSupervision ?? current.training.atmanSupervision,
      },
      runtime: {
        ...current.runtime,
        ...(input.runtime ?? {}),
      },
    });
    const index = this.bots.findIndex((entry) => entry.id === current.id);
    this.bots[index] = updated;
    await this.log({
      kind: 'update',
      botId: updated.id,
      summary: `App bot ${updated.displayName} updated.`,
    });
    await this.flush();
    return deepClone(updated);
  }

  async addTrainingEntry(botId, input = {}) {
    const current = this.getBot(botId);
    const lesson = {
      id: input.id ?? `app-bot-lesson-${Date.now()}`,
      createdAt: input.createdAt ?? new Date().toISOString(),
      userGuidance: normalizeText(input.userGuidance),
      atmanAssessment: normalizeText(input.atmanAssessment),
      nextAction: normalizeText(input.nextAction),
    };

    if (!lesson.userGuidance && !lesson.atmanAssessment && !lesson.nextAction) {
      throw new Error('Training entry requires at least one meaningful note.');
    }

    current.training.lessons = [...current.training.lessons, lesson].slice(-40);
    current.training.lastLessonAt = lesson.createdAt;
    current.runtime.status = 'training';
    current.runtime.lastReason = 'user-guided-training';
    current.updatedAt = new Date().toISOString();
    await this.log({
      kind: 'training',
      botId: current.id,
      summary: `Training note added to ${current.displayName}.`,
      lesson,
    });
    await this.flush();
    return {
      bot: deepClone(current),
      lesson,
    };
  }

  async startBot(botId, options = {}) {
    const bot = this.getBot(botId);
    bot.runtime.status = 'active';
    bot.runtime.lastStartedAt = new Date().toISOString();
    bot.runtime.lastReason = normalizeText(options.reason) || 'admin-start';
    bot.runtime.lastSessionUserId = `app-bot:${bot.id}`;
    bot.updatedAt = new Date().toISOString();

    let bridgeResult = null;
    if (options.startBridgeSession !== false && this.bridge) {
      bridgeResult = await this.bridge.startSession({
        transportMode: 'app-bot',
        sessionUserId: `app-bot:${bot.id}`,
        personalityId: bot.personalityId,
        isolatedChannelLabel: `app-bot:${bot.appId}`,
        initialMessage: options.initialMessage
          ?? `Я запускаю бота ${bot.displayName} для ${bot.appId}. Пользователь учит меня шагам, а Атман ${bot.supervisorPersonalityId} следит за качеством обучения.`,
      });
    }

    await this.log({
      kind: 'start',
      botId: bot.id,
      summary: `App bot ${bot.displayName} started.`,
      bridgeResult,
    });
    await this.flush();
    return {
      bot: deepClone(bot),
      bridgeResult,
    };
  }

  async stopBot(botId, reason = 'admin-stop') {
    const bot = this.getBot(botId);
    bot.runtime.status = 'idle';
    bot.runtime.lastStoppedAt = new Date().toISOString();
    bot.runtime.lastReason = normalizeText(reason) || 'admin-stop';
    bot.updatedAt = new Date().toISOString();

    let bridgeResult = null;
    if (this.bridge?.active && this.bridge.sessionUserId === `app-bot:${bot.id}`) {
      bridgeResult = await this.bridge.stopSession(`app-bot-stop:${bot.id}`);
    }

    await this.log({
      kind: 'stop',
      botId: bot.id,
      summary: `App bot ${bot.displayName} stopped.`,
      bridgeResult,
    });
    await this.flush();
    return {
      bot: deepClone(bot),
      bridgeResult,
    };
  }
}