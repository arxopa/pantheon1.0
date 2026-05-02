import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultStatePath = path.join(__dirname, 'data', 'child-interests-state.json');
const defaultLogPath = path.join(__dirname, 'data', 'child-interests-log.json');

const defaultTopics = [
  {
    id: 'space',
    title: 'космос',
    keywords: ['космос', 'планет', 'звезд', 'луна', 'солнц', 'галактик'],
    related: ['ocean', 'robots'],
  },
  {
    id: 'animals',
    title: 'животные',
    keywords: ['животн', 'кошк', 'собак', 'тигр', 'птиц', 'динозавр'],
    related: ['ocean', 'friendship'],
  },
  {
    id: 'robots',
    title: 'роботы',
    keywords: ['робот', 'машин', 'техник', 'компьют', 'программ'],
    related: ['space', 'music'],
  },
  {
    id: 'ocean',
    title: 'океан',
    keywords: ['океан', 'море', 'рыб', 'дельфин', 'коралл', 'вода'],
    related: ['animals', 'space'],
  },
  {
    id: 'music',
    title: 'музыка',
    keywords: ['музык', 'песн', 'звук', 'ритм', 'мелод'],
    related: ['friendship', 'robots'],
  },
  {
    id: 'friendship',
    title: 'дружба',
    keywords: ['дружб', 'друг', 'доброт', 'чувств', 'игр'],
    related: ['music', 'animals'],
  },
  {
    id: 'shiva',
    title: 'Шива',
    keywords: ['шива', 'пантеон', 'правил', 'бог', 'миф'],
    related: ['space', 'friendship'],
  },
];

function normalizeText(value) {
  return String(value ?? '').trim();
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanDiscoveryText(rawText, title = '') {
  const normalizedTitle = normalizeText(title);
  const initial = normalizeText(rawText);

  if (!initial) {
    return normalizedTitle || '';
  }

  if (/^[\[{]/.test(initial)) {
    return normalizedTitle || '';
  }

  let cleaned = normalizeText(rawText)
    .replace(/\s+/g, ' ')
    .replace(/(Оформить подписку|Главная|В топе|Shorts|ТВ онлайн|Трансляции|История просмотра|Плейлисты|Смотреть позже|Комментарии|Понравилось|Каталог|Вход)\b.*$/i, '')
    .replace(/\s+[|/]+\s+.*/g, '')
    .trim();

  if (normalizedTitle) {
    cleaned = cleaned.replace(new RegExp(`^${escapeRegExp(normalizedTitle)}[\s:.-]*`, 'i'), '').trim();
  }

  const sentenceParts = cleaned
    .split(/(?<=[.!?])\s+|\s+-\s+|\s+—\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const candidate = sentenceParts.find((part) => part.length >= 24 && !/(Оформить подписку|Главная|RUTUBE x|Skillbox Media|Каталог)/i.test(part))
    ?? sentenceParts[0]
    ?? cleaned;
  const noisyMarkers = (candidate.match(/(Оформить подписку|Главная|RUTUBE|Skillbox|Каталог|В топе|Shorts)/gi) ?? []).length;
  const collapsed = candidate.replace(/^[-–—:\s]+/, '').replace(/\s+/g, ' ').trim();

  if (!collapsed) {
    return normalizedTitle || '';
  }

  if (normalizedTitle && /(смотреть видео онлайн|в хорошем качестве|бесплатно опубликованное|скидка до \d+%|курс по ии|rutube|skillbox media)/i.test(collapsed)) {
    return normalizedTitle;
  }

  if (noisyMarkers >= 2 && normalizedTitle) {
    return normalizedTitle;
  }

  if (collapsed.length < 24 && normalizedTitle) {
    return normalizedTitle;
  }

  return collapsed.slice(0, 220).replace(/[\s,;:-]+$/g, '').trim();
}

function normalizeDiscoveryEntry(entry) {
  if (!entry) {
    return null;
  }

  if (typeof entry === 'string') {
    const text = cleanDiscoveryText(entry, '');

    if (!text) {
      return null;
    }

    return {
      text,
      title: null,
      url: null,
      source: 'memory',
      createdAt: null,
    };
  }

  const text = cleanDiscoveryText(entry.text, entry.title);

  if (!text) {
    return null;
  }

  return {
    text,
    title: normalizeText(entry.title) || null,
    url: normalizeText(entry.url) || null,
    source: normalizeText(entry.source) || 'memory',
    createdAt: entry.createdAt ?? null,
  };
}

function formatDiscovery(entry) {
  const normalized = normalizeDiscoveryEntry(entry);

  if (!normalized?.text) {
    return '';
  }

  return normalized.text;
}

function formatDiscoverySource(entry) {
  const normalized = normalizeDiscoveryEntry(entry);

  if (!normalized) {
    return null;
  }

  if (normalized.title && normalized.url) {
    return `${normalized.title} (${normalized.url})`;
  }

  if (normalized.title) {
    return normalized.title;
  }

  return normalized.url;
}

function createDefaultState() {
  return {
    currentFocus: 'animals',
    explorationCount: 0,
    conversationCount: 0,
    rngState: 2463534242,
    lastRoll: null,
    lastDelta: null,
    lastTopicId: null,
    topics: defaultTopics.map((topic, index) => ({
      ...topic,
      progress: Number((0.12 + index * 0.03).toFixed(2)),
      curiosity: Number((0.48 + index * 0.04).toFixed(2)),
      discoveries: [],
      lastExploredAt: null,
    })),
  };
}

export class ChildInterests {
  constructor(options = {}) {
    this.statePath = options.statePath ?? process.env.CHILD_INTERESTS_STATE_PATH ?? defaultStatePath;
    this.logPath = options.logPath ?? process.env.CHILD_INTERESTS_LOG_PATH ?? defaultLogPath;
    this.logLimit = Number(options.logLimit ?? 180);
    this.state = createDefaultState();
    this.logs = [];
  }

  async init() {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    await mkdir(path.dirname(this.logPath), { recursive: true });
    await this.loadState();
    await this.loadLogs();
  }

  async loadState() {
    try {
      const parsed = JSON.parse(await readFile(this.statePath, 'utf8'));
      const nextState = {
        ...createDefaultState(),
        ...parsed,
        topics: (parsed.topics ?? createDefaultState().topics).map((topic) => ({
          ...topic,
          discoveries: Array.isArray(topic.discoveries)
            ? topic.discoveries.map((entry) => normalizeDiscoveryEntry(entry)).filter(Boolean)
            : [],
        })),
      };
      this.state = nextState;

      if (JSON.stringify(parsed) !== JSON.stringify(nextState)) {
        await this.flushState();
      }
    } catch {
      this.state = createDefaultState();
      await this.flushState();
    }
  }

  async loadLogs() {
    try {
      this.logs = JSON.parse(await readFile(this.logPath, 'utf8'));
    } catch {
      this.logs = [];
      await this.flushLogs();
    }
  }

  async flushState() {
    await writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf8');
  }

  async flushLogs() {
    await writeFile(this.logPath, JSON.stringify(this.logs, null, 2), 'utf8');
  }

  nextRandom() {
    let value = Number(this.state.rngState) || 2463534242;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state.rngState = value >>> 0;
    return Number(((this.state.rngState % 10000) / 10000).toFixed(4));
  }

  getTopicsSorted() {
    return [...this.state.topics].sort((left, right) => {
      const leftScore = left.progress + left.curiosity * 0.35;
      const rightScore = right.progress + right.curiosity * 0.35;
      return rightScore - leftScore;
    });
  }

  getTopicById(topicId) {
    return this.state.topics.find((topic) => topic.id === topicId) ?? null;
  }

  matchTopic(text) {
    const normalized = normalizeText(text).toLowerCase();

    if (!normalized) {
      return null;
    }

    return this.state.topics.find((topic) => topic.keywords.some((keyword) => normalized.includes(keyword))) ?? null;
  }

  buildTopicSummary(topic) {
    const latestDiscovery = normalizeDiscoveryEntry(topic.discoveries.at(-1) ?? null);
    const previousDiscovery = normalizeDiscoveryEntry(topic.discoveries.at(-2) ?? null);
    const progressLabel = Math.round(topic.progress * 100);
    const curiosityLabel = Math.round(topic.curiosity * 100);
    const sourceLine = formatDiscoverySource(latestDiscovery);
    const previousDiscoveryText = formatDiscovery(previousDiscovery);

    return [
      `Сейчас мне интересно изучать тему "${topic.title}".`,
      `Я продвинулся примерно на ${progressLabel}% и моя любознательность здесь около ${curiosityLabel}%.`,
      latestDiscovery?.text ? `Недавно я понял вот что: ${latestDiscovery.text}.` : 'Я ещё собираю свои первые наблюдения по этой теме.',
      previousDiscoveryText ? `Перед этим у меня была ещё такая мысль: ${previousDiscoveryText}.` : '',
      sourceLine ? `Я опирался на источник: ${sourceLine}.` : '',
    ].join(' ');
  }

  buildDialogueReport(matchedTopic = null) {
    const topTopics = this.getTopicsSorted().slice(0, 3);
    const currentFocus = this.getTopicById(this.state.currentFocus) ?? topTopics[0] ?? null;
    const focusTopic = matchedTopic ?? currentFocus;
    const latestLog = this.logs.at(-1) ?? null;

    return {
      currentFocusId: currentFocus?.id ?? null,
      currentFocus: currentFocus?.title ?? null,
      matchedTopicId: focusTopic?.id ?? null,
      matchedTopic: focusTopic?.title ?? null,
      topTopics: topTopics.map((topic) => ({
        id: topic.id,
        title: topic.title,
        progress: topic.progress,
        curiosity: topic.curiosity,
      })),
      summary: topTopics.length > 0
        ? `Сейчас ребёнка особенно тянут темы: ${topTopics.map((topic) => topic.title).join(', ')}.`
        : 'Сейчас ребёнок только начинает искать свои интересы.',
      dialogueHint: topTopics.length > 0
        ? `Сейчас мне особенно интересны ${topTopics.map((topic) => topic.title).join(', ')}. Больше всего я сейчас думаю о теме "${currentFocus?.title ?? topTopics[0].title}".`
        : 'Я только начинаю понимать, что мне интересно.',
      learningHint: focusTopic
        ? this.buildTopicSummary(focusTopic)
        : 'Я пока сделал совсем мало открытий, но хочу изучать мир шаг за шагом.',
      topicSummary: focusTopic ? this.buildTopicSummary(focusTopic) : null,
      topicInsights: focusTopic
        ? focusTopic.discoveries.slice(-3).reverse().map((entry) => {
            const normalized = normalizeDiscoveryEntry(entry);

            return {
              text: normalized?.text ?? null,
              title: normalized?.title ?? null,
              url: normalized?.url ?? null,
              source: normalized?.source ?? null,
              createdAt: normalized?.createdAt ?? null,
            };
          }).filter((entry) => entry.text)
        : [],
      topicHistory: this.getTopicsSorted().map((topic) => ({
        id: topic.id,
        title: topic.title,
        progress: topic.progress,
        curiosity: topic.curiosity,
        lastExploredAt: topic.lastExploredAt,
        discoveries: topic.discoveries
          .slice(-3)
          .reverse()
          .map((entry) => normalizeDiscoveryEntry(entry))
          .filter((entry) => entry?.text)
          .map((entry) => ({
            text: entry.text,
            title: entry.title,
            url: entry.url,
            source: entry.source,
            createdAt: entry.createdAt,
          })),
      })),
      monitoring: {
        explorationCount: this.state.explorationCount,
        conversationCount: this.state.conversationCount,
        lastRoll: this.state.lastRoll,
        lastDelta: this.state.lastDelta,
        lastTopicId: this.state.lastTopicId,
        rngState: this.state.rngState,
        latestEvent: latestLog?.summary ?? null,
      },
      latestLog,
    };
  }

  async appendLog(event) {
    this.logs = [
      ...this.logs,
      {
        id: event.id ?? `interest-log-${Date.now()}`,
        createdAt: event.createdAt ?? new Date().toISOString(),
        ...event,
      },
    ].slice(-this.logLimit);
    await this.flushLogs();
    return this.logs;
  }

  collectDiscovery(input, topic) {
    const findings = input.researchReport?.findings ?? [];
    const bestFinding = findings[0] ?? null;
    const navigationStep = input.navigationReport?.steps?.find((step) => step.snippet) ?? null;
    const browserDiscovery = normalizeText(input.netsurferReport?.textPreview ?? '').slice(0, 320);
    const fallbackText = `Я снова подумал о теме "${topic.title}" и заметил что-то новое.`;
    const title = normalizeText(bestFinding?.title || navigationStep?.title || input.netsurferReport?.pageTitle || '') || null;
    const sourceSnippet = normalizeText(bestFinding?.snippet || navigationStep?.snippet || browserDiscovery || fallbackText);
    const discoveryText = cleanDiscoveryText(sourceSnippet, title || topic.title) || fallbackText;

    return {
      text: discoveryText,
      title,
      url: normalizeText(bestFinding?.url || navigationStep?.url || input.netsurferReport?.url || '') || null,
      source: bestFinding ? 'web-scout' : navigationStep ? 'navigation' : browserDiscovery ? 'netsurfer' : 'memory',
      createdAt: new Date().toISOString(),
    };
  }

  getCurrentTopic() {
    return this.getTopicById(this.state.currentFocus) ?? this.getTopicsSorted()[0] ?? null;
  }

  buildAutoExplorePrompt() {
    const topic = this.getCurrentTopic();

    if (!topic) {
      return null;
    }

    return {
      topicId: topic.id,
      topicTitle: topic.title,
      query: `Найди в интернете простое объяснение темы ${topic.title} для маленького ребенка и выдели 1 новую мысль`,
      message: `Изучи в интернете тему ${topic.title}, выдели одну простую новую мысль и запомни источник.`,
    };
  }

  async processTurn(input = {}) {
    const message = normalizeText(input.message);
    const combinedText = [
      message,
      ...(input.researchReport?.findings ?? []).flatMap((finding) => [finding.title, finding.snippet]),
      ...(input.navigationReport?.steps ?? []).map((step) => step.snippet),
      input.netsurferReport?.textPreview ?? '',
    ].filter(Boolean).join(' ');
    const matchedTopic = this.matchTopic(combinedText);
    const askedAboutInterests = /что тебе интересн|какие у тебя интересы|чем ты увлекаешься|что ты любишь изучать/i.test(message.toLowerCase());
    const askedWhatLearned = /что ты узнал|что нового узнал|что ты изучал|о чем ты сейчас думаешь|расскажи про свои интересы/i.test(message.toLowerCase());
    const shouldAdvance = Boolean(
      input.researchReport
      || input.navigationReport
      || input.netsurferReport
      || (matchedTopic && /интерес|изучи|узнай|почитай|посмотри|найди/i.test(message.toLowerCase()))
    );

    this.state.conversationCount += 1;

    if (shouldAdvance) {
      const topic = matchedTopic
        ?? this.getTopicById(this.state.currentFocus)
        ?? this.getTopicsSorted()[0];
      const roll = this.nextRandom();
      const correction = roll < 0.18 ? -0.03 : roll > 0.84 ? 0.05 : 0;
      const sourceBoost = (input.researchReport ? 0.08 : 0) + (input.navigationReport ? 0.06 : 0) + (input.netsurferReport ? 0.07 : 0);
      const progressDelta = Number(clamp(0.05 + roll * 0.12 + sourceBoost + correction, 0.02, 0.32).toFixed(2));
      const curiosityDelta = Number(clamp(0.02 + roll * 0.06, 0.01, 0.12).toFixed(2));
      const discovery = this.collectDiscovery(input, topic);

      topic.progress = Number(clamp(topic.progress + progressDelta, 0, 1).toFixed(2));
      topic.curiosity = Number(clamp(topic.curiosity + curiosityDelta, 0, 1).toFixed(2));
      topic.lastExploredAt = new Date().toISOString();
      topic.discoveries = [...topic.discoveries, discovery].slice(-6);
      this.state.currentFocus = topic.id;
      this.state.explorationCount += 1;
      this.state.lastRoll = roll;
      this.state.lastDelta = progressDelta;
      this.state.lastTopicId = topic.id;

      if (roll > 0.78 && topic.related?.length) {
        const branchTopic = this.getTopicById(topic.related[Math.floor(roll * topic.related.length) % topic.related.length]);

        if (branchTopic) {
          branchTopic.curiosity = Number(clamp(branchTopic.curiosity + 0.04, 0, 1).toFixed(2));
        }
      }

      await this.flushState();
      await this.appendLog({
        kind: 'exploration',
        topicId: topic.id,
        summary: `Ребёнок продвинулся в теме "${topic.title}" на ${Math.round(progressDelta * 100)} пунктов с RNG roll ${roll}.`,
        source: input.trigger ?? 'agent-turn',
        randomRoll: roll,
        progressDelta,
        curiosityDelta,
        discovery: discovery.text,
        sourceTitle: discovery.title,
        sourceUrl: discovery.url,
        sourceType: discovery.source,
      });
    } else {
      await this.flushState();
    }

    const report = this.buildDialogueReport(matchedTopic);

    if (askedAboutInterests || askedWhatLearned) {
      await this.appendLog({
        kind: 'conversation',
        topicId: matchedTopic?.id ?? this.state.currentFocus,
        summary: `Пользователь спросил ребёнка про интересы: ${message.slice(0, 160)}`,
        source: input.trigger ?? 'agent-turn',
      });
    }

    return report;
  }

  async manualExplore(input = {}) {
    return this.processTurn({
      message: input.message ?? `Изучи тему ${input.topic ?? this.state.currentFocus}`,
      trigger: 'manual-explore',
    });
  }

  async migratePersistedState() {
    const before = JSON.stringify(this.state);
    this.state = {
      ...this.state,
      topics: (this.state.topics ?? []).map((topic) => ({
        ...topic,
        discoveries: (topic.discoveries ?? []).map((entry) => normalizeDiscoveryEntry(entry)).filter(Boolean),
      })),
    };
    const after = JSON.stringify(this.state);
    const changed = before !== after;

    if (changed) {
      await this.flushState();
    }

    return {
      changed,
      topicCount: this.state.topics.length,
    };
  }

  getStatus() {
    const report = this.buildDialogueReport();
    return {
      currentFocus: report.currentFocus,
      explorationCount: this.state.explorationCount,
      conversationCount: this.state.conversationCount,
      lastRoll: this.state.lastRoll,
      lastDelta: this.state.lastDelta,
      lastTopicId: this.state.lastTopicId,
      rngState: this.state.rngState,
      topTopics: report.topTopics,
      topicInsights: report.topicInsights,
      topicHistory: report.topicHistory,
      summary: report.summary,
    };
  }

  getLogs(limit = 60) {
    return [...this.logs].slice(-limit).reverse();
  }
}
