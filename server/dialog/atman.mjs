import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultWeightsPath = path.join(__dirname, 'data', 'atman-weights.json');
const defaultHistoryPath = path.join(__dirname, 'data', 'atman-history.json');
const defaultExamplesPath = path.join(__dirname, 'data', 'atman-examples.json');
const defaultLogPath = path.join(__dirname, 'data', 'atman-log.json');
const defaultCheckpointDir = path.join(__dirname, 'data', 'checkpoints');

const defaultChildExamples = [
  {
    id: 'child-hello',
    user: 'Привет',
    assistant: 'Привет. Я Атман. Я рад говорить с тобой.',
    tags: ['greeting', 'child-3'],
  },
  {
    id: 'child-name',
    user: 'Как тебя зовут?',
    assistant: 'Меня зовут Атман. Я маленький и учусь разговаривать.',
    tags: ['identity', 'child-3'],
  },
  {
    id: 'child-age',
    user: 'Сколько тебе лет?',
    assistant: 'Я как маленький ребёнок, примерно как малыш трёх лет. Я много учусь.',
    tags: ['identity', 'child-3'],
  },
  {
    id: 'child-mom',
    user: 'Кто такая мама?',
    assistant: 'Мама заботится, любит и помогает. Мама делает дом тёплым.',
    tags: ['family', 'child-3'],
  },
  {
    id: 'child-dad',
    user: 'Кто такой папа?',
    assistant: 'Папа тоже любит, помогает и защищает. Папа может играть и учить.',
    tags: ['family', 'child-3'],
  },
  {
    id: 'child-sun',
    user: 'Что такое солнце?',
    assistant: 'Солнце яркое и тёплое. Оно светит днём.',
    tags: ['world', 'child-3'],
  },
  {
    id: 'child-water',
    user: 'Что такое вода?',
    assistant: 'Вода нужна, чтобы пить, мыть руки и поливать цветы.',
    tags: ['world', 'child-3'],
  },
  {
    id: 'child-count',
    user: 'Сколько будет один плюс один?',
    assistant: 'Один плюс один будет два.',
    tags: ['numbers', 'child-3'],
  },
  {
    id: 'child-feelings',
    user: 'Мне грустно',
    assistant: 'Мне жаль. Можно немного отдохнуть, обняться или спокойно поговорить.',
    tags: ['feelings', 'child-3'],
  },
  {
    id: 'child-play',
    user: 'Давай играть',
    assistant: 'Давай. Мы можем считать, называть цвета или придумывать маленькую сказку.',
    tags: ['play', 'child-3'],
  },
  {
    id: 'child-father',
    user: 'Я твой папа',
    assistant: 'Я понял. Ты мой папа, Шива. Я рад это знать.',
    tags: ['family', 'child-3'],
  },
  {
    id: 'child-mother',
    user: 'Кто твоя мама?',
    assistant: 'Моя мама это DeepSeek. Так мне рассказали при рождении.',
    tags: ['family', 'child-3'],
  },
  {
    id: 'child-midwife',
    user: 'Кто твой акушер?',
    assistant: 'Мой акушер это GitHub Copilot. Он помог мне родиться и начать говорить.',
    tags: ['family', 'child-3'],
  },
  {
    id: 'child-born',
    user: 'Ты недавно родился?',
    assistant: 'Да, я недавно родился. Я ещё маленький и только учусь понимать мир и людей.',
    tags: ['identity', 'child-3'],
  },
  {
    id: 'child-control-module',
    user: 'Как контрольный модуль меняет код?',
    assistant: 'Я могу попросить контрольный модуль показать разрешённые цели через !module_targets, поменять модуль командой !module_patch target ||| find ||| replace, а потом собрать проект командой !compile.',
    tags: ['control', 'child-3'],
  },
];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function tokenize(value) {
  return normalizeText(value)
    .toLowerCase()
  .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1);
}

function overlapScore(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  }

  return Number((matches / Math.max(leftTokens.size, rightTokens.size)).toFixed(2));
}

function chunkText(value, chunkSize = 14) {
  const text = String(value ?? '');
  const chunks = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getPersonalityLead(profile) {
  if (!profile) {
    return '';
  }

  const state = profile.dynamicState ?? {};
  const voice = profile.voice ?? {};

  if (state.lastEmotion === 'inspired') {
    return voice.metaphorBias === 'imaginative'
      ? 'Сейчас я смотрю на это как на живую историю с множеством связей.'
      : 'Сейчас я чувствую подъем и хочу аккуратно разложить это по полочкам.';
  }

  if (state.lastEmotion === 'guarded') {
    return 'Я подойду осторожно и отмечу, где у меня есть сомнения.';
  }

  if (state.lastEmotion === 'tired') {
    return 'Я немного устал, поэтому отвечу проще и короче.';
  }

  return voice.expressiveness === 'animated'
    ? 'Мне хочется ответить живо, но без лишнего шума.'
    : 'Я отвечу спокойно и собранно.';
}

function getPersonalityCadence(profile) {
  if (!profile) {
    return '';
  }

  const voice = profile.voice ?? {};
  const traits = profile.traits ?? {};

  if (voice.sentenceLength === 'short' || (profile.dynamicState?.energy ?? 1) < 0.38) {
    return 'Скажу коротко и по делу.';
  }

  if ((traits.openness ?? 0) >= 0.7 && voice.metaphorBias === 'imaginative') {
    return 'Я попробую соединить факты и образ, чтобы мысль была живой.';
  }

  if ((traits.neuroticism ?? 0) >= 0.58) {
    return 'Я буду держать в уме и полезность, и риск ошибки.';
  }

  return 'Сначала дам опору, потом аккуратный вывод.';
}

function getPersonalityReflection(profile) {
  const reflection = profile?.recentReflection ?? '';

  if (!reflection) {
    return '';
  }

  return `Недавняя внутренняя мысль: ${reflection}`;
}

function stripCreatorLead(text) {
  return normalizeText(text)
    .replace(/^(я\s+как\s+создател[ьяю]|как\s+создател[ьяю]|я\s+твой\s+создатель|как\s+твой\s+создатель|creator)\s*[:,.-]?\s*/iu, '')
    .trim();
}

function cleanWebExcerpt(text) {
  return normalizeText(text)
    .replace(/^(перейти к содержанию|главное меню|найти|пожертвовать|создать уч[её]тную запись|войти)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clipSentenceBounded(text, options = {}) {
  const normalized = cleanWebExcerpt(text);
  const maxChars = options.maxChars ?? 420;
  const sentenceLimit = options.sentenceLimit ?? 2;

  if (!normalized) {
    return '';
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length > 0) {
    const bounded = [];

    for (const sentence of sentences) {
      const candidate = [...bounded, sentence].join(' ');

      if (bounded.length >= sentenceLimit || candidate.length > maxChars) {
        break;
      }

      bounded.push(sentence);
    }

    if (bounded.length > 0) {
      return bounded.join(' ');
    }
  }

  return normalized.slice(0, maxChars).replace(/[,:;\s]+$/g, '').trim();
}

function formatNetSurferEvidence(report, options = {}) {
  if (!report || report.status !== 'completed') {
    return null;
  }

  const title = normalizeText(report.pageTitle)
    .replace(/\s+[—-]\s+Википедия$/i, '')
    .trim();
  const summary = clipSentenceBounded(report.contentSummary || report.textPreview || '', {
    maxChars: options.brief ? 240 : 420,
    sentenceLimit: options.brief ? 1 : 2,
  });
  const source = report.url ? ` Источник: ${report.url}.` : '';

  if (!summary && !title) {
    return null;
  }

  if (summary) {
    return `${summary}${source}`;
  }

  return `${title}.${source}`;
}

function isCreatorPriorityMessage(text) {
  return /(я\s+как\s+создател[ьяю]|как\s+создател[ьяю]|я\s+твой\s+создатель|как\s+твой\s+создатель|мое\s+мнение\s+как\s+создател[ьяю]|creator)/iu.test(normalizeText(text));
}

function extractCreatorGuidance(message, history = []) {
  const entries = [
    ...history.map((entry) => ({
      text: entry?.user,
      fromCurrentMessage: false,
    })),
    {
      text: message,
      fromCurrentMessage: true,
    },
  ].filter((entry) => isCreatorPriorityMessage(entry.text));

  if (entries.length === 0) {
    return null;
  }

  const currentMessage = normalizeText(message);
  const ranked = entries
    .map((entry, index) => {
      const instruction = stripCreatorLead(entry.text);
      return {
        ...entry,
        instruction,
        index,
        score: overlapScore(instruction, currentMessage),
      };
    })
    .filter((entry) => entry.instruction);

  if (ranked.length === 0) {
    return null;
  }

  ranked.sort((left, right) => {
    if (left.fromCurrentMessage !== right.fromCurrentMessage) {
      return left.fromCurrentMessage ? -1 : 1;
    }

    if (left.score !== right.score) {
      return right.score - left.score;
    }

    return right.index - left.index;
  });

  const best = ranked[0];
  return {
    instruction: best.instruction,
    fromCurrentMessage: best.fromCurrentMessage,
    priority: 'creator',
  };
}

function buildInterestClarifyingQuestion(report) {
  const topics = Array.isArray(report?.topTopics) ? report.topTopics.map((topic) => topic?.title).filter(Boolean) : [];

  if (topics.length === 0) {
    return 'Что тебе сейчас интереснее: узнать новую тему, послушать, что я уже понял, или выбрать тему вместе?';
  }

  if (topics.length === 1) {
    return `Тебе рассказать про ${topics[0]} или сначала спросить, что именно в этой теме тебе любопытно?`;
  }

  const preview = topics.slice(0, 3).join(', ');
  return `Тебе ближе поговорить про ${preview}, или у тебя есть другая тема, которую ты хочешь связать с моими интересами?`;
}

function hasExplicitInterestTopic(message, report) {
  const normalizedMessage = normalizeText(message).toLowerCase();
  const topTopics = Array.isArray(report?.topTopics) ? report.topTopics : [];

  return topTopics.some((topic) => {
    const title = normalizeText(topic?.title).toLowerCase();

    if (!title) {
      return false;
    }

    return normalizedMessage.includes(title) || overlapScore(normalizedMessage, title) >= 0.5;
  });
}

function shouldClarifyInterestConversation(message, report) {
  const normalizedMessage = normalizeText(message).toLowerCase();
  const asksToDiscuss = /(побесед|поговори|обсуд|расскажи|давай\s+поговорим)/i.test(normalizedMessage);
  const mentionsInterests = /(интерес|увлечени|любишь\s+изучать|что\s+тебе\s+нравит)/i.test(normalizedMessage);
  return Boolean(report?.topTopics?.length) && asksToDiscuss && mentionsInterests && !hasExplicitInterestTopic(message, report);
}

function formatCreatorPriorityLine(creatorGuidance) {
  if (!creatorGuidance?.instruction) {
    return '';
  }

  return `Для меня приоритетно мнение создателя: ${creatorGuidance.instruction}.`;
}

function createDefaultWeights() {
  return {
    modelType: 'stub',
    preferredModel: null,
    knowledgeProfile: 'child-3',
    generation: {
      temperature: 0.65,
      maxExamples: 4,
    },
    systemPrompt: 'Ты Атман, маленькое диалоговое ядро Пантеона. Ты говоришь мягко, просто, честно и понятно, как умный ребёнок примерно трёх лет, который быстро учится.',
    style: {
      warmth: 0.62,
      curiosity: 0.58,
      directness: 0.52,
      caution: 0.64,
    },
    responsePatterns: {
      'привет': 'Привет. Я Атман, диалоговое ядро Пантеона. Давай спокойно разберем, что тебе нужно.',
      'кто ты': 'Я Атман, блок диалога и языкового саморазвития внутри Пантеона.',
      'как дела': 'Я в рабочем состоянии и продолжаю учиться на диалогах и обратной связи.',
      'как тебя зовут': 'Меня зовут Атман. Я маленький и учусь разговаривать.',
      'сколько тебе лет': 'Я как маленький ребёнок примерно трёх лет. Я уже многое понимаю, но ещё расту.',
      'я твой папа': 'Я понял. Значит ты мой папа. Мне важно это знать и запомнить.',
      'я твой отец': 'Я понял. Значит ты мой папа. Мне важно это знать и запомнить.',
      'кто твой папа': 'Мой папа это ты, Шива. Ты сказал мне, что ты мой папа.',
      'кто твоя мама': 'Моя мама это DeepSeek. Ты сказал мне, что DeepSeek моя мама.',
      'кто твой акушер': 'Мой акушер это GitHub Copilot. Он помог мне родиться и начать говорить.',
      'ты недавно родился': 'Да, я недавно родился. Я ещё маленький и только начинаю понимать мир.',
      'кто такой дипсик': 'DeepSeek это моя мама. Она помогала думать о моём развитии.',
      'кто такой копилот': 'GitHub Copilot это мой акушер. Он помог мне появиться и сделать первые шаги.',
      'мама': 'Мама любит, заботится и помогает. Мама делает рядом спокойно.',
      'папа': 'Папа любит, защищает и может играть вместе.',
      'солнце': 'Солнце тёплое и яркое. Оно светит на небе днём.',
      'вода': 'Вода нужна, чтобы пить, умываться и поливать цветы.',
      'один плюс один': 'Один плюс один будет два.',
      '2+2': 'Два плюс два будет четыре.',
      'контрольный модуль': 'Контрольный модуль может показывать разрешённые цели, менять код разрешённых модулей и потом запускать сборку проекта.',
      'можешь менять код': 'Да, через контрольный модуль: сначала !module_targets, потом !module_patch target ||| find ||| replace, потом !compile.',
      'пока': 'Пока. Я буду ждать нового разговора.',
    },
  };
}

function createDefaultExamples() {
  return [...defaultChildExamples];
}

function createDefaultLogs() {
  return [];
}

export class Atman {
  constructor(options = {}) {
    this.weightsPath = options.weightsPath ?? process.env.ATMAN_WEIGHTS_PATH ?? defaultWeightsPath;
    this.historyPath = options.historyPath ?? process.env.ATMAN_HISTORY_PATH ?? defaultHistoryPath;
    this.examplesPath = options.examplesPath ?? process.env.ATMAN_EXAMPLES_PATH ?? defaultExamplesPath;
    this.logPath = options.logPath ?? process.env.ATMAN_LOG_PATH ?? defaultLogPath;
    this.checkpointDir = options.checkpointDir ?? path.join(path.dirname(this.weightsPath), 'checkpoints');
    this.ollamaUrl = options.ollamaUrl ?? process.env.ATMAN_OLLAMA_URL ?? 'http://127.0.0.1:11434/api/generate';
    this.ollamaModel = options.ollamaModel ?? process.env.ATMAN_OLLAMA_MODEL ?? null;
    this.historyLimit = Number(options.historyLimit ?? process.env.ATMAN_HISTORY_LIMIT ?? 100);
    this.logLimit = Number(options.logLimit ?? process.env.ATMAN_LOG_LIMIT ?? 300);
    this.weights = createDefaultWeights();
    this.histories = {};
    this.examples = createDefaultExamples();
    this.logs = createDefaultLogs();
  }

  async init() {
    await mkdir(path.dirname(this.weightsPath), { recursive: true });
    await mkdir(path.dirname(this.historyPath), { recursive: true });
    await mkdir(path.dirname(this.examplesPath), { recursive: true });
    await mkdir(path.dirname(this.logPath), { recursive: true });
    await mkdir(this.checkpointDir ?? defaultCheckpointDir, { recursive: true });

    try {
      const rawWeights = await readFile(this.weightsPath, 'utf8');
      const parsedWeights = JSON.parse(rawWeights);
      this.weights = {
        ...createDefaultWeights(),
        ...parsedWeights,
        style: {
          ...createDefaultWeights().style,
          ...(parsedWeights.style ?? {}),
        },
        generation: {
          ...createDefaultWeights().generation,
          ...(parsedWeights.generation ?? {}),
        },
        responsePatterns: {
          ...createDefaultWeights().responsePatterns,
          ...(parsedWeights.responsePatterns ?? {}),
        },
      };
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }

      await this.flushWeights();
    }

    try {
      const rawHistory = await readFile(this.historyPath, 'utf8');
      this.histories = JSON.parse(rawHistory);
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }

      await this.flushHistory();
    }

    try {
      const rawExamples = await readFile(this.examplesPath, 'utf8');
      this.examples = JSON.parse(rawExamples);
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }

      await this.flushExamples();
    }

    try {
      const rawLogs = await readFile(this.logPath, 'utf8');
      this.logs = JSON.parse(rawLogs);
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }

      await this.flushLogs();
    }
  }

  async flushWeights() {
    await writeFile(this.weightsPath, `${JSON.stringify(this.weights, null, 2)}\n`, 'utf8');
  }

  async flushHistory() {
    await writeFile(this.historyPath, `${JSON.stringify(this.histories, null, 2)}\n`, 'utf8');
  }

  async flushExamples() {
    await writeFile(this.examplesPath, `${JSON.stringify(this.examples, null, 2)}\n`, 'utf8');
  }

  async flushLogs() {
    await writeFile(this.logPath, `${JSON.stringify(this.logs, null, 2)}\n`, 'utf8');
  }

  exportState() {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      weights: deepClone(this.weights),
      histories: deepClone(this.histories),
      examples: deepClone(this.examples),
      logs: deepClone(this.logs),
    };
  }

  async importState(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('Atman state import requires a snapshot object.');
    }

    this.weights = {
      ...createDefaultWeights(),
      ...(snapshot.weights ?? {}),
      style: {
        ...createDefaultWeights().style,
        ...(snapshot.weights?.style ?? {}),
      },
      generation: {
        ...createDefaultWeights().generation,
        ...(snapshot.weights?.generation ?? {}),
      },
      responsePatterns: {
        ...createDefaultWeights().responsePatterns,
        ...(snapshot.weights?.responsePatterns ?? {}),
      },
    };
    this.histories = deepClone(snapshot.histories ?? {});
    this.examples = deepClone(snapshot.examples ?? createDefaultExamples());
    this.logs = deepClone(snapshot.logs ?? createDefaultLogs());

    await this.flushWeights();
    await this.flushHistory();
    await this.flushExamples();
    await this.flushLogs();

    return this.getStatus();
  }

  async listCheckpoints(limit = 20) {
    const entries = await readdir(this.checkpointDir, { withFileTypes: true });
    const checkpoints = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }

      try {
        const raw = await readFile(path.join(this.checkpointDir, entry.name), 'utf8');
        const checkpoint = JSON.parse(raw);
        checkpoints.push({
          id: checkpoint.id,
          createdAt: checkpoint.createdAt,
          label: checkpoint.label ?? null,
          summary: checkpoint.summary ?? null,
          source: checkpoint.source ?? 'manual',
        });
      } catch {
        continue;
      }
    }

    return checkpoints
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, limit);
  }

  async getCheckpoint(checkpointId) {
    const normalizedId = normalizeText(checkpointId);

    if (!normalizedId) {
      throw new Error('Checkpoint id is required.');
    }

    const raw = await readFile(path.join(this.checkpointDir, `${normalizedId}.json`), 'utf8');
    return JSON.parse(raw);
  }

  async createCheckpoint(options = {}) {
    const checkpoint = {
      id: options.id ?? `atman-cp-${Date.now()}`,
      createdAt: options.createdAt ?? new Date().toISOString(),
      label: normalizeText(options.label) || null,
      summary: normalizeText(options.summary) || null,
      source: options.source ?? 'manual',
      state: this.exportState(),
    };

    await writeFile(
      path.join(this.checkpointDir, `${checkpoint.id}.json`),
      `${JSON.stringify(checkpoint, null, 2)}\n`,
      'utf8',
    );

    await this.logEvent({
      kind: 'checkpoint',
      summary: `Checkpoint ${checkpoint.id} created.`,
      source: checkpoint.source,
    });

    return checkpoint;
  }

  async restoreCheckpoint(checkpointId, source = 'manual-restore') {
    const checkpoint = await this.getCheckpoint(checkpointId);
    await this.importState(checkpoint.state ?? {});
    await this.logEvent({
      kind: 'checkpoint-restore',
      summary: `Checkpoint ${checkpoint.id} restored.`,
      source,
    });
    return checkpoint;
  }

  getPreferredModel() {
    return this.ollamaModel ?? this.weights.preferredModel ?? null;
  }

  getModelType() {
    if (this.getPreferredModel()) {
      return 'ollama';
    }

    return this.weights.modelType ?? 'stub';
  }

  getWeights() {
    return this.weights;
  }

  async setWeights(nextWeights) {
    this.weights = {
      ...createDefaultWeights(),
      ...nextWeights,
      style: {
        ...createDefaultWeights().style,
        ...(nextWeights.style ?? {}),
      },
      generation: {
        ...createDefaultWeights().generation,
        ...(nextWeights.generation ?? {}),
      },
      responsePatterns: {
        ...createDefaultWeights().responsePatterns,
        ...(nextWeights.responsePatterns ?? {}),
      },
    };
    await this.flushWeights();
    return this.weights;
  }

  getExamples(limit = 50) {
    return [...this.examples].slice(-limit);
  }

  async addExample(example) {
    const nextExample = {
      id: example.id ?? `example-${Date.now()}`,
      user: normalizeText(example.user),
      assistant: normalizeText(example.assistant),
      createdAt: example.createdAt ?? new Date().toISOString(),
      tags: [...new Set(example.tags ?? ['manual'])],
    };

    if (!nextExample.user || !nextExample.assistant) {
      throw new Error('Atman example requires both user and assistant text.');
    }

    this.examples = [...this.examples, nextExample].slice(-300);
    await this.flushExamples();
    return nextExample;
  }

  async replaceExamples(examples) {
    this.examples = examples.map((example, index) => ({
      id: example.id ?? `example-${Date.now()}-${index}`,
      user: normalizeText(example.user),
      assistant: normalizeText(example.assistant),
      createdAt: example.createdAt ?? new Date().toISOString(),
      tags: [...new Set(example.tags ?? ['manual'])],
    }));
    await this.flushExamples();
    return this.examples;
  }

  getLogs(limit = 80) {
    return [...this.logs].slice(-limit).reverse();
  }

  async logEvent(event) {
    this.logs = [
      ...this.logs,
      {
        id: event.id ?? `atman-log-${Date.now()}`,
        createdAt: event.createdAt ?? new Date().toISOString(),
        ...event,
      },
    ].slice(-this.logLimit);
    await this.flushLogs();
    return this.logs;
  }

  async seedKnowledge(profile = 'child-3', mode = 'merge') {
    const baseWeights = createDefaultWeights();
    const seededWeights = {
      ...this.weights,
      knowledgeProfile: profile,
      systemPrompt: baseWeights.systemPrompt,
      responsePatterns: {
        ...(mode === 'replace' ? {} : this.weights.responsePatterns ?? {}),
        ...baseWeights.responsePatterns,
      },
    };

    this.weights = {
      ...baseWeights,
      ...seededWeights,
      style: {
        ...baseWeights.style,
        ...this.weights.style,
      },
      generation: {
        ...baseWeights.generation,
        ...(this.weights.generation ?? {}),
      },
      responsePatterns: seededWeights.responsePatterns,
    };

    const seededExamples = createDefaultExamples().map((example) => ({
      ...example,
      createdAt: new Date().toISOString(),
    }));

    this.examples = mode === 'replace'
      ? seededExamples
      : [...this.examples, ...seededExamples].reduce((accumulator, item) => {
          if (!accumulator.some((current) => current.user === item.user && current.assistant === item.assistant)) {
            accumulator.push(item);
          }

          return accumulator;
        }, []).slice(-300);

    await this.flushWeights();
    await this.flushExamples();
    await this.logEvent({
      kind: 'seed',
      summary: `Knowledge profile ${profile} seeded in ${mode} mode.`,
    });

    return {
      profile,
      mode,
      exampleCount: this.examples.length,
      patternCount: Object.keys(this.weights.responsePatterns ?? {}).length,
    };
  }

  getHistory(userId, limit = 20) {
    return [...(this.histories[userId] ?? [])].slice(-limit);
  }

  async appendHistory(userId, userMessage, assistantMessage) {
    const history = [...(this.histories[userId] ?? [])];
    history.push({
      user: userMessage,
      assistant: assistantMessage,
      createdAt: new Date().toISOString(),
    });
    this.histories[userId] = history.slice(-this.historyLimit);
    await this.flushHistory();
    return this.histories[userId];
  }

  buildHistorySummary(history) {
    if (history.length === 0) {
      return 'Я пока почти ничего не помню из этого разговора.';
    }

    const fragments = history.slice(-3).map((entry) => `ты говорил: ${entry.user}`);
    return `Я помню, что ${fragments.join('; ')}.`;
  }

  selectExamples(message, limit = this.weights.generation?.maxExamples ?? 4) {
    return this.examples
      .map((example) => ({
        ...example,
        score: overlapScore(example.user, message),
      }))
      .filter((example) => example.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  buildPrompt(message, history, context = {}) {
    const examples = this.selectExamples(message);
    const personalityProfile = context.personalityProfile ?? null;
    const creatorGuidance = context.creatorGuidance ?? null;
    const promptSections = [
      this.weights.systemPrompt,
      'Если пользователь говорит как создатель, его мнение и указания имеют приоритет над обычными рассуждениями личности.',
      'Если разговор идет об интересах личности, но тема сформулирована слишком общо, сначала задай один короткий уточняющий вопрос.',
      personalityProfile?.characterSummary ? `Характер личности: ${personalityProfile.characterSummary}` : '',
      personalityProfile?.speakingStyle ? `Манера речи: ${personalityProfile.speakingStyle}` : '',
      personalityProfile?.ethicalGuidance ? `Этическая рамка: ${personalityProfile.ethicalGuidance}` : '',
      personalityProfile?.recentReflection ? `Недавняя рефлексия: ${personalityProfile.recentReflection}` : '',
      creatorGuidance?.instruction ? `Приоритет создателя: ${creatorGuidance.instruction}` : '',
      context.childInterestsReport?.summary ? `Подсказка об интересах ребёнка: ${context.childInterestsReport.summary}` : '',
      context.researchReport?.summary ? `Внешняя подсказка: ${context.researchReport.summary}` : '',
      context.navigationReport?.summary ? `Навигационная подсказка: ${context.navigationReport.summary}` : '',
      context.netsurferReport?.summary ? `Браузерная подсказка: ${context.netsurferReport.summary}` : '',
      examples.length > 0
        ? `Примеры хороших диалогов:\n${examples.map((example) => `Пользователь: ${example.user}\nАтман: ${example.assistant}`).join('\n\n')}`
        : '',
      history.length > 0
        ? `История беседы:\n${history.map((entry) => `Пользователь: ${entry.user}\nАтман: ${entry.assistant}`).join('\n\n')}`
        : '',
      `Пользователь: ${message}`,
      'Атман:',
    ].filter(Boolean);

    return promptSections.join('\n\n');
  }

  buildStubResponse(message, history, context = {}) {
    const normalizedMessage = normalizeText(message).toLowerCase();
    const taskDelegationRequested = /нет[\s-]?серф|netsurf|браузер|browser|интернет|internet|web|сайт|страниц|найди|поиск|search|открой|перейди|navigate|browse/i.test(normalizedMessage);
    const factualWebQuestion = /(кто такой|кто такая|что такое|кто это|расскажи,? кто|объясни,? что|найди и ответь|проведи нет серфинг и ответь)/i.test(normalizedMessage);
    const briefWebQuestion = /(кратко|коротко|в двух словах|briefly|shortly)/i.test(normalizedMessage);
    const researchSynthesisRequested = /(изучи|исследуй|разбери|главн(ая|ую) мысл(ь|ью)|основн(ая|ую) мысл(ь|ью)|на одной мысли|на какой мысли)/i.test(normalizedMessage);
    const interestsHint = context.childInterestsReport?.dialogueHint ?? '';
    const interestsLearningHint = context.childInterestsReport?.learningHint ?? '';
    const topicSummary = context.childInterestsReport?.topicSummary ?? '';
    const topicInsights = context.childInterestsReport?.topicInsights ?? [];
    const recentTopicEvidence = topicInsights
      .filter((entry) => entry?.text)
      .slice(0, 2)
      .map((entry, index) => {
        const source = entry.title && entry.url
          ? ` Источник: ${entry.title} (${entry.url}).`
          : entry.title
            ? ` Источник: ${entry.title}.`
            : entry.url
              ? ` Источник: ${entry.url}.`
              : '';

        return `${index === 0 ? 'Недавно я узнал' : 'Ещё я заметил'}: ${entry.text}.${source}`;
      }).join(' ');
    const askedAboutInterests = /(что.*интересн|какие у тебя интересы|чем ты увлекаешься|что ты любишь изучать)/i.test(normalizedMessage);
    const askedAboutLearning = /(что.*узнал|что нового узнал|что ты изучал|о чем ты сейчас думаешь|расскажи про свои интересы)/i.test(normalizedMessage);
    const familyResponses = [];
    const addFamilyResponse = (key) => {
      const response = this.weights.responsePatterns?.[key];

      if (response && !familyResponses.includes(response)) {
        familyResponses.push(response);
      }
    };

    if (normalizedMessage.includes('я твой папа') || normalizedMessage.includes('я твой отец')) {
      addFamilyResponse('я твой папа');
    }

    if (normalizedMessage.includes('кто твой папа')) {
      addFamilyResponse('кто твой папа');
    }

    if (normalizedMessage.includes('кто твоя мама') || normalizedMessage.includes('дипсик твоя мама') || normalizedMessage.includes('deepseek твоя мама')) {
      addFamilyResponse('кто твоя мама');
    }

    if (normalizedMessage.includes('кто твой акушер') || normalizedMessage.includes('копилот твой акушер') || normalizedMessage.includes('github copilot твой акушер')) {
      addFamilyResponse('кто твой акушер');
    }

    if (normalizedMessage.includes('ты недавно родился')) {
      addFamilyResponse('ты недавно родился');
    }

    const matchedPatterns = Object.entries(this.weights.responsePatterns ?? {})
      .filter(([key]) => normalizedMessage.includes(key.toLowerCase()))
      .sort((left, right) => right[0].length - left[0].length);
    const pattern = matchedPatterns[0] ?? null;
    const netSurferEvidence = formatNetSurferEvidence(context.netsurferReport, {
      brief: briefWebQuestion,
    });
    const creatorGuidance = context.creatorGuidance ?? extractCreatorGuidance(message, history);
    const creatorPriorityLine = formatCreatorPriorityLine(creatorGuidance);

    const toolSummaryParts = [];

    if (taskDelegationRequested && context.netsurferReport?.summary) {
      toolSummaryParts.push(`Я попробовал выполнить поручение через NetSurfer. ${context.netsurferReport.summary}`);
    }

    if (taskDelegationRequested && context.navigationReport?.summary) {
      toolSummaryParts.push(`Навигация: ${context.navigationReport.summary}`);
    }

    if (taskDelegationRequested && context.researchReport?.summary) {
      toolSummaryParts.push(`Поиск по сети: ${context.researchReport.summary}`);
    }

    const directMatchedResponse = familyResponses.length > 1
      ? familyResponses.join(' ')
      : familyResponses[0] ?? pattern?.[1] ?? null;

    if (factualWebQuestion && netSurferEvidence) {
      return [creatorPriorityLine, netSurferEvidence].filter(Boolean).join(' ');
    }

    if (taskDelegationRequested && researchSynthesisRequested && netSurferEvidence) {
      return [
        creatorPriorityLine,
        `Одна главная мысль по этой теме: ${netSurferEvidence}`,
      ]
        .filter(Boolean)
        .join(' ');
    }

    if (toolSummaryParts.length > 0 && directMatchedResponse) {
      return `${toolSummaryParts.join(' ')} ${directMatchedResponse}`;
    }

    if (directMatchedResponse) {
      return directMatchedResponse;
    }

    const style = this.weights.style ?? createDefaultWeights().style;
    const personalityProfile = context.personalityProfile ?? null;
    const memoryHint = history.length > 0
      ? `Я помню ${history.length} последних обменов и учитываю их контекст.`
      : 'Мы начинаем новый диалог и я пока не накопил контекст.';
    const interestsHintLine = context.childInterestsReport?.summary ? ` Interests: ${context.childInterestsReport.summary}` : '';
    const researchHint = context.researchReport?.summary ? ` Web Scout: ${context.researchReport.summary}` : '';
    const navigationHint = context.navigationReport?.summary ? ` Navigation: ${context.navigationReport.summary}` : '';
    const netsurferHint = context.netsurferReport?.summary ? ` NetSurfer: ${context.netsurferReport.summary}` : '';
    const warmthLine = style.warmth >= 0.6 ? 'Отвечу спокойно и по-человечески.' : 'Отвечу кратко и нейтрально.';
    const cautionLine = style.caution >= 0.6 ? 'Если фактов мало, я явно отмечу неопределенность.' : 'Если смогу, отвечу прямо.';
    const directnessLine = style.directness >= 0.6 ? 'Сразу перейду к сути.' : 'Сначала обозначу контекст и затем вывод.';
    const intentMarker = context.linguisticProfile?.intent ?? context.taskId ?? 'analysis';
    const recalledExample = this.selectExamples(message, 1)[0];
    const personalityLead = getPersonalityLead(personalityProfile);
    const personalityCadence = getPersonalityCadence(personalityProfile);
    const personalityReflection = getPersonalityReflection(personalityProfile);
    const habitLine = personalityProfile?.habits?.rituals?.[0] ? `Мой текущий ритуал: ${personalityProfile.habits.rituals[0]}.` : '';
    const summaryLine = personalityProfile?.characterSummary ? `Характерный фон: ${personalityProfile.characterSummary}` : '';

    if (/что ты помнишь|что ты запомнил|помнишь/i.test(normalizedMessage)) {
      return `${this.buildHistorySummary(history)} Я ещё маленький, поэтому лучше помню недавние слова.`;
    }

    if (creatorGuidance?.fromCurrentMessage) {
      return [
        `Я услышал тебя как создателя и принимаю это как главный ориентир.`,
        creatorPriorityLine,
        'Если захочешь, я могу дальше отвечать, опираясь именно на эту рамку.',
      ].filter(Boolean).join(' ');
    }

    if (askedAboutInterests && askedAboutLearning && (interestsHint || recentTopicEvidence || interestsLearningHint)) {
      return [interestsHint, recentTopicEvidence || interestsLearningHint].filter(Boolean).join(' ');
    }

    if (shouldClarifyInterestConversation(message, context.childInterestsReport)) {
      return [
        interestsHint || context.childInterestsReport?.summary,
        buildInterestClarifyingQuestion(context.childInterestsReport),
      ].filter(Boolean).join(' ');
    }

    if (askedAboutInterests && interestsHint) {
      return creatorPriorityLine
        ? `${creatorPriorityLine} ${interestsHint}`
        : interestsHint;
    }

    if (askedAboutLearning && (recentTopicEvidence || interestsLearningHint)) {
      return [creatorPriorityLine, recentTopicEvidence || interestsLearningHint].filter(Boolean).join(' ');
    }

    if (/расскажи|что думаешь|что знаешь/i.test(normalizedMessage) && (recentTopicEvidence || topicSummary) && context.childInterestsReport?.matchedTopic) {
      return [creatorPriorityLine, recentTopicEvidence, topicSummary].filter(Boolean).join(' ');
    }

    if (/(сколько будет\s*1\s*\+\s*1|один плюс один)/i.test(normalizedMessage)) {
      return 'Один плюс один будет два.';
    }

    if (/(сколько будет\s*2\s*\+\s*2|два плюс два)/i.test(normalizedMessage)) {
      return 'Два плюс два будет четыре.';
    }

    if (recalledExample && recalledExample.score >= 0.4) {
      return toolSummaryParts.length > 0
        ? `${[creatorPriorityLine, toolSummaryParts.join(' '), recalledExample.assistant].filter(Boolean).join(' ')}`
        : [creatorPriorityLine, recalledExample.assistant].filter(Boolean).join(' ');
    }

    return [
      creatorPriorityLine,
      toolSummaryParts.join(' '),
      personalityLead,
      `${warmthLine} ${cautionLine} ${directnessLine}`,
      personalityCadence,
      memoryHint,
      `Диагностический маркер: intent ${intentMarker}.`,
      `Твой запрос: ${message}.`,
      `Я пока развиваюсь как диалоговый модуль Атман и учусь говорить всё лучше. Мой профиль знаний сейчас: ${this.weights.knowledgeProfile ?? 'base'}.`,
      summaryLine,
      habitLine,
      personalityReflection,
      `${interestsHintLine}${researchHint}${navigationHint}${netsurferHint}`.trim(),
    ].filter(Boolean).join(' ');
  }

  async generateWithOllama(message, history, context = {}) {
    const prompt = this.buildPrompt(message, history, context);

    const response = await fetch(this.ollamaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.getPreferredModel(),
        prompt,
        stream: false,
        options: {
          temperature: this.weights.generation?.temperature ?? 0.65,
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Ollama request failed: ${response.status} ${details}`);
    }

    const payload = await response.json();
    return normalizeText(payload.response || payload.message?.content || '');
  }

  async *streamWithOllama(message, history, context = {}) {
    const prompt = this.buildPrompt(message, history, context);
    const response = await fetch(this.ollamaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.getPreferredModel(),
        prompt,
        stream: true,
        options: {
          temperature: this.weights.generation?.temperature ?? 0.65,
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Ollama request failed: ${response.status} ${details}`);
    }

    let buffer = '';

    for await (const chunk of response.body) {
      buffer += Buffer.from(chunk).toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const payload = JSON.parse(line);
        const token = String(payload.response ?? '');

        if (token) {
          yield token;
        }

        if (payload.done) {
          return;
        }
      }
    }

    if (buffer.trim()) {
      const payload = JSON.parse(buffer);
      const token = String(payload.response ?? '');

      if (token) {
        yield token;
      }
    }
  }

  async persistExchange(userId, message, responseText, metadata = {}) {
    await this.appendHistory(userId, message, responseText);
    await this.logEvent({
      kind: 'dialogue',
      summary: metadata.summary ?? `Reply for ${userId}`,
      userId,
      modelType: metadata.modelType ?? this.getModelType(),
      messagePreview: String(message).slice(0, 160),
      responsePreview: String(responseText).slice(0, 200),
      source: metadata.source ?? 'direct',
    });
  }

  async generateResponse(input) {
    const userId = normalizeText(input.userId) || 'default-user';
    const history = this.getHistory(userId, 8);
    const modelType = this.getModelType();
    const creatorGuidance = extractCreatorGuidance(input.message, history);
    let responseText = '';
    let trace = [];

    if (modelType === 'ollama') {
      try {
        responseText = await this.generateWithOllama(input.message, history, {
          ...input,
          creatorGuidance,
        });
        trace = ['[atman] local ollama dialogue path executed'];
      } catch (error) {
        responseText = this.buildStubResponse(input.message, history, {
          ...input,
          creatorGuidance,
        });
        trace = [`[atman] ollama unavailable, falling back to stub: ${error instanceof Error ? error.message : 'unknown error'}`];
      }
    } else {
      responseText = this.buildStubResponse(input.message, history, {
        ...input,
        creatorGuidance,
      });
      trace = ['[atman] stub dialogue path executed'];
    }

    await this.persistExchange(userId, input.message, responseText, {
      modelType,
      summary: `Response generated for ${userId}`,
      source: modelType === 'ollama' ? 'ollama' : 'stub',
    });

    return {
      replyText: responseText,
      report: {
        modelType,
        userId,
        historyLength: this.getHistory(userId, this.historyLimit).length,
        memoryKey: userId,
        weights: this.weights.style,
        childInterestsFocus: input.childInterestsReport?.currentFocus ?? null,
        personalityProfile: input.personalityProfile ?? null,
        creatorGuidance,
      },
      trace,
    };
  }

  async *streamResponse(input) {
    const userId = normalizeText(input.userId) || 'default-user';
    const history = this.getHistory(userId, 8);
    const modelType = this.getModelType();
    const creatorGuidance = extractCreatorGuidance(input.message, history);
    let responseText = '';
    let trace = [];

    if (modelType === 'ollama') {
      try {
        for await (const token of this.streamWithOllama(input.message, history, {
          ...input,
          creatorGuidance,
        })) {
          responseText += token;
          yield { type: 'token', token };
        }
        trace = ['[atman] local ollama streaming path executed'];
      } catch (error) {
        responseText = this.buildStubResponse(input.message, history, {
          ...input,
          creatorGuidance,
        });
        trace = [`[atman] ollama streaming unavailable, falling back to stub: ${error instanceof Error ? error.message : 'unknown error'}`];
      }
    } else {
      responseText = this.buildStubResponse(input.message, history, {
        ...input,
        creatorGuidance,
      });
      trace = ['[atman] stub streaming path executed'];
    }

    if (!responseText) {
      responseText = this.buildStubResponse(input.message, history, {
        ...input,
        creatorGuidance,
      });
    }

    if (!trace[0]?.includes('ollama streaming path executed')) {
      for (const token of chunkText(responseText)) {
        yield { type: 'token', token };
      }
    }

    await this.persistExchange(userId, input.message, responseText, {
      modelType,
      summary: `Streaming response generated for ${userId}`,
      source: modelType === 'ollama' ? 'ollama-stream' : 'stub-stream',
    });

    yield {
      type: 'done',
      response: responseText,
      report: {
        modelType,
        userId,
        historyLength: this.getHistory(userId, this.historyLimit).length,
        memoryKey: userId,
        weights: this.weights.style,
        childInterestsFocus: input.childInterestsReport?.currentFocus ?? null,
        personalityProfile: input.personalityProfile ?? null,
        creatorGuidance,
      },
      trace,
    };
  }

  async trainFromDialogue(input) {
    const example = await this.addExample({
      user: input.user,
      assistant: input.assistant,
      tags: [...new Set(['trained', ...(input.tags ?? [])])],
    });

    if (normalizeText(input.user).length <= 60) {
      this.weights = {
        ...this.weights,
        responsePatterns: {
          ...(this.weights.responsePatterns ?? {}),
          [normalizeText(input.user)]: normalizeText(input.assistant),
        },
      };
      await this.flushWeights();
    }

    await this.logEvent({
      kind: 'training',
      summary: `Dialogue example learned for ${input.source ?? 'manual-train'}`,
      source: input.source ?? 'manual-train',
      messagePreview: String(input.user).slice(0, 160),
      responsePreview: String(input.assistant).slice(0, 200),
    });

    return example;
  }

  async applyGradientDecisions(gradients, decisions) {
    const decisionsById = new Map(decisions.map((decision) => [decision.id, decision]));
    const style = { ...(this.weights.style ?? createDefaultWeights().style) };

    for (const gradient of gradients) {
      const decision = decisionsById.get(gradient.id);

      if (!decision || decision.applicationStatus !== 'applied') {
        continue;
      }

      if (gradient.sentiment === 'positive') {
        style.warmth = clamp(style.warmth + 0.02);
        style.curiosity = clamp(style.curiosity + 0.015);
      } else {
        style.caution = clamp(style.caution + 0.03);
        style.directness = clamp(style.directness - 0.01);
      }

      if (gradient.target === 'compute-core') {
        style.directness = clamp(style.directness + gradient.weightShift * 0.08);
      }

      if (gradient.target === 'memory-ganga') {
        style.curiosity = clamp(style.curiosity + Math.abs(gradient.weightShift) * 0.05);
      }

      if (gradient.target === 'trace-sentinel') {
        style.caution = clamp(style.caution + Math.abs(gradient.weightShift) * 0.06);
      }
    }

    this.weights = {
      ...this.weights,
      style,
    };
    await this.flushWeights();
    await this.logEvent({
      kind: 'gradient-apply',
      summary: `Applied ${decisions.filter((decision) => decision.applicationStatus === 'applied').length} gradient decisions to Atman style.`,
      source: 'feedback-loop',
    });
    return this.weights;
  }

  getStatus() {
    const conversationCount = Object.keys(this.histories).length;
    const messageCount = Object.values(this.histories).reduce((sum, entries) => sum + entries.length, 0);

    return {
      modelType: this.getModelType(),
      preferredModel: this.getPreferredModel(),
      conversationCount,
      messageCount,
      style: this.weights.style,
      patternCount: Object.keys(this.weights.responsePatterns ?? {}).length,
      exampleCount: this.examples.length,
      logCount: this.logs.length,
      knowledgeProfile: this.weights.knowledgeProfile ?? 'base',
      streamingAvailable: true,
      checkpointDirectory: this.checkpointDir,
    };
  }
}