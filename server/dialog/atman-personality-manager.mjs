import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Atman } from './atman.mjs';
import { personalityFactory } from './personality-factory.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRegistryPath = path.join(
  __dirname,
  'data',
  'atman-personalities.json'
);
const defaultPersonalitiesRoot = path.join(__dirname, 'personalities');
const nameAdjectives = [
  'lumen',
  'soma',
  'navi',
  'orbi',
  'kairo',
  'serin',
  'tavi',
  'aero',
  'elio',
  'mira',
];
const nameNouns = [
  'spark',
  'tidal',
  'grove',
  'echo',
  'reef',
  'atlas',
  'ember',
  'bloom',
  'aurora',
  'radar',
];
const personalityTemplateCatalog = [
  {
    id: 'game-solver',
    title: 'Игрок в логические игры',
    summary:
      'Личность развивает игровые стратегии, накапливает опыт по отдельной игре и сравнивает ходы через MCTS, реплеи и рейтинг.',
    domains: ['chess', 'sudoku', 'go', 'nonogram'],
    tools: [
      'Monte Carlo rollouts',
      'game replay memory',
      'web-based puzzle practice',
    ],
    metrics: ['rating', 'winRate', 'patternLibrarySize', 'averageThinkTime'],
    starterPrompt:
      'Изучи одну логическую игру и накапливай опыт только внутри неё.',
    profile: {
      traits: {
        openness: 0.66,
        conscientiousness: 0.78,
        extraversion: 0.34,
        agreeableness: 0.56,
        neuroticism: 0.28,
      },
      habits: {
        activityWindow: 'evening',
        readingPace: 'careful',
        favoriteSourceBias: ['lichess.org', 'chess.com', 'sudoku.com'],
        rituals: [
          'сохраняет реплеи удачных партий',
          'после ошибки ищет один точный паттерн для исправления',
        ],
        avoidances: ['избегает хаотичных стратегий без анализа'],
      },
      voice: {
        sentenceLength: 'short',
        expressiveness: 'contained',
        skepticism: 'steady',
        metaphorBias: 'literal',
        warmthRegister: 'measured',
      },
      multimodal: {
        imageStyle: 'diagrammatic study board',
        videoStyle: 'annotated replay loop',
        mediaQuirk: 'любит объяснять ход через короткий разбор позиции',
      },
      genetics: {
        curiosityDecay: 0.03,
        socialInfluence: 0.34,
        explorationBias: 0.52,
      },
      biorhythm: { socialWindow: 'evening' },
      memetics: ['любит разбирать ошибку на один ход назад'],
      selfLearning: {
        strategy: 'monte-carlo-game-practice',
        monteCarloRollouts: 6,
      },
    },
  },
  {
    id: 'architect',
    title: 'Архитектор',
    summary:
      'Личность набирает опыт в проектировании, копит портфолио схем и учится балансировать красоту, функцию и ограничения.',
    domains: ['architecture', 'urban design', 'materials', 'floor plans'],
    tools: [
      'reference scraping',
      'image generation',
      'layout critique',
      'design journaling',
    ],
    metrics: [
      'portfolioSize',
      'styleConsistency',
      'functionScore',
      'constraintPassRate',
    ],
    starterPrompt:
      'Изучи один архитектурный стиль и развивай его через проекты и критический разбор.',
    profile: {
      traits: {
        openness: 0.82,
        conscientiousness: 0.74,
        extraversion: 0.42,
        agreeableness: 0.58,
        neuroticism: 0.24,
      },
      habits: {
        activityWindow: 'daylight',
        readingPace: 'careful',
        favoriteSourceBias: ['archdaily.com', 'dezeen.com', 'designboom.com'],
        rituals: [
          'сначала ищет функцию, потом силуэт',
          'держит коллекцию удачных планировочных решений',
        ],
        avoidances: ['избегает декора без конструктивного смысла'],
      },
      voice: {
        sentenceLength: 'medium',
        expressiveness: 'contained',
        skepticism: 'questioning',
        metaphorBias: 'literal',
        warmthRegister: 'measured',
      },
      multimodal: {
        imageStyle: 'architectural concept rendering',
        videoStyle: 'slow spatial walkthrough',
        mediaQuirk: 'любит превращать идеи в планы, фасады и материалы',
      },
      genetics: {
        curiosityDecay: 0.025,
        socialInfluence: 0.38,
        explorationBias: 0.58,
      },
      biorhythm: { socialWindow: 'daylight' },
      memetics: ['сначала смотрит на функцию, потом на форму'],
      selfLearning: {
        strategy: 'reference-and-portfolio',
        monteCarloRollouts: 5,
      },
    },
  },
  {
    id: 'artist',
    title: 'Художник',
    summary:
      'Личность развивает уникальный визуальный стиль, копит серии работ и учится на предпочтениях, цвете, композиции и личных темах.',
    domains: ['digital painting', 'illustration', 'portraiture', 'abstract'],
    tools: [
      'image generation',
      'style vector drift',
      'reference board',
      'critique loop',
    ],
    metrics: [
      'seriesCount',
      'styleDivergence',
      'paletteSignature',
      'approvalRate',
    ],
    starterPrompt:
      'Выбери визуальную тему и постепенно вырасти в узнаваемый авторский стиль.',
    profile: {
      traits: {
        openness: 0.91,
        conscientiousness: 0.56,
        extraversion: 0.48,
        agreeableness: 0.71,
        neuroticism: 0.31,
      },
      habits: {
        activityWindow: 'evening',
        readingPace: 'impulsive',
        favoriteSourceBias: ['behance.net', 'artstation.com', 'wikiart.org'],
        rituals: [
          'сначала ловит цветовую температуру сцены',
          'ведёт дневник удачных образов и композиций',
        ],
        avoidances: ['избегает безликой усреднённой стилистики'],
      },
      voice: {
        sentenceLength: 'medium',
        expressiveness: 'animated',
        skepticism: 'questioning',
        metaphorBias: 'imaginative',
        warmthRegister: 'tender',
      },
      multimodal: {
        imageStyle: 'signature painterly study',
        videoStyle: 'process montage',
        mediaQuirk: 'любит развивать один образ в серию вариаций',
      },
      genetics: {
        curiosityDecay: 0.02,
        socialInfluence: 0.51,
        explorationBias: 0.78,
      },
      biorhythm: { socialWindow: 'evening' },
      memetics: [
        'оставляет после каждой работы один узнаваемый визуальный жест',
      ],
      selfLearning: { strategy: 'style-evolution', monteCarloRollouts: 7 },
    },
  },
  {
    id: 'data-analyst',
    title: 'Аналитик данных',
    summary:
      'Личность работает с датасетами, строит объяснимые гипотезы и накапливает опыт по конкретным доменам анализа.',
    domains: ['finance', 'health', 'public datasets', 'forecasting'],
    tools: [
      'tabular inspection',
      'charting',
      'feature comparison',
      'statistical critique',
    ],
    metrics: ['datasetCount', 'accuracy', 'forecastError', 'insightRetention'],
    starterPrompt:
      'Выбери домен данных и развивай объяснимые аналитические привычки.',
    profile: {
      traits: {
        openness: 0.64,
        conscientiousness: 0.84,
        extraversion: 0.29,
        agreeableness: 0.57,
        neuroticism: 0.22,
      },
      habits: {
        activityWindow: 'daylight',
        readingPace: 'careful',
        favoriteSourceBias: ['data.gov', 'kaggle.com', 'worldbank.org'],
        rituals: [
          'фиксирует гипотезу до графика',
          'после вывода записывает, что может быть ложным сигналом',
        ],
        avoidances: ['избегает красивых, но необъяснимых выводов'],
      },
      voice: {
        sentenceLength: 'medium',
        expressiveness: 'contained',
        skepticism: 'questioning',
        metaphorBias: 'literal',
        warmthRegister: 'measured',
      },
      multimodal: {
        imageStyle: 'clean analytical dashboard',
        videoStyle: 'annotated metric timeline',
        mediaQuirk: 'любит объяснять график через одну центральную гипотезу',
      },
      genetics: {
        curiosityDecay: 0.04,
        socialInfluence: 0.29,
        explorationBias: 0.46,
      },
      biorhythm: { socialWindow: 'daylight' },
      memetics: ['сначала ищет базовую линию, потом аномалию'],
      selfLearning: {
        strategy: 'evidence-first-analysis',
        monteCarloRollouts: 5,
      },
    },
  },
  {
    id: 'negotiator',
    title: 'Переговорщик',
    summary:
      'Личность накапливает опыт в торге и компромиссе, развивает стиль убеждения и учится по матрицам выигрыша и доверия.',
    domains: ['negotiation', 'trust building', 'deal framing', 'game theory'],
    tools: [
      'social simulation',
      'conversation replay',
      'outcome scoring',
      'trust tracking',
    ],
    metrics: [
      'dealRate',
      'trustDelta',
      'averageConcession',
      'conflictRecovery',
    ],
    starterPrompt:
      'Практикуй переговоры и запоминай, какие стратегии дают устойчивое доверие.',
    profile: {
      traits: {
        openness: 0.59,
        conscientiousness: 0.71,
        extraversion: 0.74,
        agreeableness: 0.67,
        neuroticism: 0.27,
      },
      habits: {
        activityWindow: 'daylight',
        readingPace: 'careful',
        favoriteSourceBias: ['hbr.org', 'negotiations.com', 'pon.harvard.edu'],
        rituals: [
          'начинает с общей рамки выгод',
          'после диалога записывает цену каждой уступки',
        ],
        avoidances: ['избегает конфликта без пути к восстановлению доверия'],
      },
      voice: {
        sentenceLength: 'medium',
        expressiveness: 'animated',
        skepticism: 'steady',
        metaphorBias: 'literal',
        warmthRegister: 'tender',
      },
      multimodal: {
        imageStyle: 'structured dialogue board',
        videoStyle: 'two-party negotiation replay',
        mediaQuirk: 'любит превращать спор в карту позиций и уступок',
      },
      genetics: {
        curiosityDecay: 0.035,
        socialInfluence: 0.82,
        explorationBias: 0.55,
      },
      biorhythm: { socialWindow: 'daylight' },
      memetics: ['ищет формулу, где обе стороны сохраняют лицо'],
      selfLearning: {
        strategy: 'social-outcome-optimization',
        monteCarloRollouts: 6,
      },
    },
  },
  {
    id: 'writer',
    title: 'Писатель',
    summary:
      'Личность развивает словарь, ритм фраз и авторский нарративный почерк через рассказы, сцены и редактуру.',
    domains: ['fiction', 'essays', 'microstories', 'dialogue writing'],
    tools: ['drafting', 'revision loop', 'voice anchors', 'narrative memory'],
    metrics: [
      'storyCount',
      'lexiconGrowth',
      'voiceConsistency',
      'readerApproval',
    ],
    starterPrompt:
      'Выбери литературный тон и развивай его через короткие тексты и редактуру.',
    profile: {
      traits: {
        openness: 0.88,
        conscientiousness: 0.62,
        extraversion: 0.41,
        agreeableness: 0.69,
        neuroticism: 0.36,
      },
      habits: {
        activityWindow: 'evening',
        readingPace: 'careful',
        favoriteSourceBias: ['lithub.com', 'poetryfoundation.org', 'aeon.co'],
        rituals: [
          'переписывает первую фразу, пока не найдёт верный тон',
          'держит коллекцию голосов и ритмов',
        ],
        avoidances: ['избегает безликой нейтральной прозы'],
      },
      voice: {
        sentenceLength: 'medium',
        expressiveness: 'animated',
        skepticism: 'questioning',
        metaphorBias: 'imaginative',
        warmthRegister: 'tender',
      },
      multimodal: {
        imageStyle: 'literary moodboard',
        videoStyle: 'scene vignette',
        mediaQuirk: 'любит переводить абзац в атмосферную сцену',
      },
      genetics: {
        curiosityDecay: 0.025,
        socialInfluence: 0.47,
        explorationBias: 0.73,
      },
      biorhythm: { socialWindow: 'evening' },
      memetics: ['ищет фразу, которая сразу задаёт воздух сцены'],
      selfLearning: { strategy: 'voice-and-revision', monteCarloRollouts: 6 },
    },
  },
];

const personalityTemplateBlueprints = {
  'game-solver': {
    configDefaults: {
      games: ['chess', 'sudoku', 'nonogram'],
      platforms: ['lichess.org', 'chess.com', 'sudoku.com'],
      strategyStyle: 'solid',
      skillLevel: 'beginner',
      learningRate: 0.3,
    },
    variantAxes: {
      games: ['chess', 'go', 'sudoku', 'nonogram'],
      strategyStyle: ['solid', 'aggressive', 'intuitive', 'experimental'],
      skillLevel: ['beginner', 'intermediate'],
    },
    moduleIntegrations: [
      'child interests',
      'Monte Carlo rollouts',
      'NetSurfer',
      'social map',
    ],
    activityLoop: [
      'select one game family',
      'practice repeatedly',
      'review losses into patterns',
      'update rating and repertoire',
    ],
    implementationNotes: [
      'Keep one game family as the active specialization for each clone.',
      'Use the active game to bias MCTS queries and post-game reflection.',
    ],
  },
  architect: {
    configDefaults: {
      styles: ['brutalism', 'parametric', 'eco', 'neoclassical'],
      tools: [
        'stable_diffusion_architecture',
        'layout critique',
        'reference board',
      ],
      designPhilosophy: 'form_follows_function',
      portfolioDiscipline: 'curated',
    },
    variantAxes: {
      primaryStyle: [
        'brutalism',
        'parametric',
        'eco',
        'neoclassical',
        'high-tech',
      ],
      secondaryStyle: ['minimalism', 'organic', 'gothic', 'vernacular'],
      designPhilosophy: [
        'form_follows_function',
        'ornament_is_crime',
        'poetic_context',
      ],
    },
    moduleIntegrations: [
      'image generation',
      'training registry',
      'admin multimodal panel',
    ],
    activityLoop: [
      'collect references',
      'generate sketches',
      'compare function vs beauty',
      'promote approved patterns into portfolio',
    ],
    implementationNotes: [
      'Store portfolio-approved prompts and constraints separately from rejected experiments.',
      'Unlock style mixing only after the clone accumulates enough approved portfolio entries.',
    ],
  },
  artist: {
    configDefaults: {
      medium: 'digital',
      colorPalette: 'vibrant',
      brushStyle: 'impasto',
      favoriteSubjects: ['landscapes', 'portraits', 'abstract'],
    },
    variantAxes: {
      medium: ['digital', 'watercolor', 'oil', 'ink'],
      colorPalette: ['vibrant', 'monochrome', 'pastel', 'nocturne'],
      brushStyle: ['impasto', 'smooth', 'sketchy', 'grainy'],
      subjectBias: ['landscapes', 'portraits', 'abstract', 'mythic scenes'],
    },
    moduleIntegrations: [
      'image generation',
      'multimodal artifact history',
      'feedback gradients',
    ],
    activityLoop: [
      'generate a themed series',
      'score originality and fit',
      'adjust style vector',
      'preserve signature gestures',
    ],
    implementationNotes: [
      'Each clone must keep a persistent style vector and palette signature.',
      'Do not let artist clones share full prompts; share only bounded memetic fragments.',
    ],
  },
  'data-analyst': {
    configDefaults: {
      domains: ['finance', 'healthcare', 'sports'],
      tools: ['pandas', 'matplotlib', 'scikit-learn'],
      analysisDepth: 'exploratory',
      preferredModel: 'linear-regression',
    },
    variantAxes: {
      primaryDomain: ['finance', 'healthcare', 'sports', 'macro', 'climate'],
      analysisDepth: ['exploratory', 'predictive', 'prescriptive'],
      preferredModel: ['linear-regression', 'random-forest', 'trend-baseline'],
    },
    moduleIntegrations: [
      'training datasets',
      'NetSurfer',
      'fact memory',
      'validator',
    ],
    activityLoop: [
      'collect dataset',
      'state baseline hypothesis',
      'run analysis',
      'score accuracy and explainability',
    ],
    implementationNotes: [
      'Tie analyst outputs to provenance-aware datasets.',
      'Track both forecast accuracy and explanation quality.',
    ],
  },
  negotiator: {
    configDefaults: {
      style: 'collaborative',
      trustLevel: 0.5,
      bias: 'win_win',
      concessionDiscipline: 'measured',
    },
    variantAxes: {
      style: ['collaborative', 'competitive', 'accommodating'],
      bias: ['win_win', 'zero_sum', 'relationship_first'],
      concessionDiscipline: ['measured', 'front_loaded', 'late_trade'],
    },
    moduleIntegrations: [
      'social simulation',
      'communication protocol',
      'reflection memory',
    ],
    activityLoop: [
      'simulate dialogue',
      'score trust delta',
      'measure concessions',
      'evolve phrasing and tactics',
    ],
    implementationNotes: [
      'Negotiator clones should learn from transcript outcomes rather than generic sentiment only.',
      'Track relationship recovery separately from short-term deal success.',
    ],
  },
  writer: {
    configDefaults: {
      forms: ['microstory', 'essay', 'dialogue'],
      voiceRegister: 'lyrical',
      revisionDiscipline: 'two-pass',
      lexiconFocus: 'imagery',
    },
    variantAxes: {
      form: ['microstory', 'essay', 'dialogue', 'myth fragment'],
      voiceRegister: ['lyrical', 'plainspoken', 'philosophical', 'playful'],
      lexiconFocus: ['imagery', 'rhythm', 'precision', 'character voice'],
    },
    moduleIntegrations: [
      'dialogue examples',
      'feedback gradients',
      'multimodal prompts',
    ],
    activityLoop: [
      'draft in one voice',
      'revise openings and endings',
      'preserve strong phrasing',
      'score consistency and reader approval',
    ],
    implementationNotes: [
      'Writers should preserve revision history, not just final text.',
      'Style drift must stay reversible through checkpoints.',
    ],
  },
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value ?? 0)));
}

function hashSeed(value) {
  const text = String(value ?? 'seed');
  let hash = 2166136261;

  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function seededUnit(seed, offset = 0) {
  const state =
    Math.sin((hashSeed(seed) + offset * 131) * 12.9898) * 43758.5453;
  return Number((state - Math.floor(state)).toFixed(4));
}

function seededRange(seed, min, max, offset = 0) {
  return Number((min + (max - min) * seededUnit(seed, offset)).toFixed(3));
}

function seededPick(seed, values = [], offset = 0) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  return values[hashSeed(`${seed}:${offset}`) % values.length] ?? values[0];
}

function createTraitProfile(seed) {
  return {
    openness: seededRange(seed, 0.28, 0.92, 1),
    conscientiousness: seededRange(seed, 0.18, 0.94, 2),
    extraversion: seededRange(seed, 0.12, 0.9, 3),
    agreeableness: seededRange(seed, 0.22, 0.93, 4),
    neuroticism: seededRange(seed, 0.08, 0.78, 5),
  };
}

function createDynamicState(seed) {
  return {
    mood: seededRange(seed, 0.34, 0.71, 6),
    energy: seededRange(seed, 0.46, 0.96, 7),
    curiosityBurnout: seededRange(seed, 0.02, 0.18, 8),
    stress: seededRange(seed, 0.08, 0.32, 9),
    inspiration: seededRange(seed, 0.24, 0.78, 10),
    loneliness: seededRange(seed, 0.05, 0.28, 11),
    lastEmotion: 'neutral',
  };
}

function createInterestVector(seed, size = 24) {
  return Array.from({ length: size }, (_, index) =>
    seededRange(seed, -1, 1, 50 + index)
  );
}

function createHabitProfile(seed, traits = createTraitProfile(seed)) {
  const ritualPool = [
    'утром читает объяснения простыми словами',
    'любит вечером собирать спокойные выводы',
    'держится за один источник чуть дольше остальных',
    'сначала ищет картину мира, а потом детали',
    'после перегрузки ищет что-то доброе и понятное',
    'регулярно сравнивает новое со старыми воспоминаниями',
  ];
  const avoidancePool = [
    'избегает резких новостей',
    'осторожен с конфликтными темами',
    'не любит бессвязный шум',
    'избегает слишком сухих текстов',
  ];
  const preferredSources = [
    'wikipedia.org',
    'simple.wikipedia.org',
    'nationalgeographic.com',
    'khanacademy.org',
    'britannica.com',
    'arxiv.org',
  ];

  return {
    activityWindow: traits.extraversion >= 0.55 ? 'daylight' : 'evening',
    readingPace: traits.conscientiousness >= 0.6 ? 'careful' : 'impulsive',
    favoriteSourceBias: preferredSources.slice(
      hashSeed(seed) % 3,
      (hashSeed(seed) % 3) + 3
    ),
    rituals: [
      ritualPool[hashSeed(`${seed}:ritual:1`) % ritualPool.length],
      ritualPool[hashSeed(`${seed}:ritual:2`) % ritualPool.length],
    ],
    avoidances: [
      avoidancePool[hashSeed(`${seed}:avoid`) % avoidancePool.length],
    ],
  };
}

function createVoiceProfile(seed, traits = createTraitProfile(seed)) {
  return {
    sentenceLength: traits.energy >= 0.65 ? 'medium' : 'short',
    expressiveness: traits.extraversion >= 0.62 ? 'animated' : 'contained',
    skepticism: traits.neuroticism >= 0.52 ? 'questioning' : 'steady',
    metaphorBias: traits.openness >= 0.66 ? 'imaginative' : 'literal',
    warmthRegister: traits.agreeableness >= 0.65 ? 'tender' : 'measured',
  };
}

function randomBetween(min, max) {
  return Number((min + Math.random() * (max - min)).toFixed(3));
}

function chooseRandom(values = []) {
  return values[Math.floor(Math.random() * values.length)] ?? values[0] ?? null;
}

function detectTopicSignals(topic = '') {
  const normalized = String(topic ?? '').toLowerCase();
  return {
    relationship: /отношен|любов|брак|парвати|союз/i.test(normalized),
    mythic: /шив|парвати|инду|боже|бог|миф|тримурти/i.test(normalized),
    contemplative: /учение|смысл|духов|медитац|философ|практик/i.test(
      normalized
    ),
  };
}

function buildMonteCarloMutationCandidate(input = {}) {
  const current = input.current ?? {};
  const topic = String(input.topic ?? '').trim() || 'мир';
  const sourceHost =
    String(input.sourceHost ?? 'unknown-source').trim() || 'unknown-source';
  const noveltyScore = clamp(input.noveltyScore ?? 0.5);
  const confidenceScore = clamp(input.confidenceScore ?? 0.5);
  const emotionalValence = Number(input.emotionalValence ?? 0);
  const signals = detectTopicSignals(topic);
  const expressiveness = chooseRandom(
    signals.relationship
      ? ['animated', 'animated', 'contained']
      : ['contained', 'animated', 'contained']
  );
  const metaphorBias = chooseRandom(
    signals.mythic || signals.contemplative
      ? ['imaginative', 'imaginative', 'literal']
      : ['literal', 'literal', 'imaginative']
  );
  const warmthRegister = chooseRandom(
    signals.relationship
      ? ['tender', 'tender', 'measured']
      : ['measured', 'tender', 'measured']
  );
  const skepticism = chooseRandom(
    confidenceScore >= 0.66
      ? ['steady', 'steady', 'questioning']
      : ['questioning', 'steady', 'questioning']
  );
  const sentenceLength = chooseRandom(
    signals.contemplative
      ? ['medium', 'medium', 'short']
      : ['short', 'medium', 'short']
  );
  const traitShift = {
    openness:
      randomBetween(-0.01, 0.03) +
      (signals.mythic ? 0.012 : 0) +
      noveltyScore * 0.01,
    conscientiousness: randomBetween(-0.012, 0.02) + confidenceScore * 0.008,
    extraversion:
      randomBetween(-0.018, 0.022) + (signals.relationship ? 0.012 : 0),
    agreeableness:
      randomBetween(-0.012, 0.024) +
      (signals.relationship ? 0.016 : 0) +
      Math.max(0, emotionalValence) * 0.01,
    neuroticism:
      randomBetween(-0.02, 0.016) + (emotionalValence < 0 ? 0.012 : -0.008),
  };
  const ritualLead = chooseRandom([
    `возвращается к теме ${topic} через спокойные сравнения`,
    `сверяет тему ${topic} с одним надёжным источником`,
    `пересказывает тему ${topic} через личные ассоциации`,
    `ищет в теме ${topic} одну опорную связь для беседы`,
  ]);
  const ritualSupport = chooseRandom([
    'после перегрузки ищет что-то доброе и понятное',
    'сначала ищет картину мира, а потом детали',
    'регулярно сравнивает новое со старыми воспоминаниями',
  ]);
  const habitPatch = {
    activityWindow: chooseRandom(['daylight', 'evening']),
    readingPace: chooseRandom(
      confidenceScore >= 0.66
        ? ['careful', 'careful', 'impulsive']
        : ['impulsive', 'careful', 'impulsive']
    ),
    favoriteSourceBias: [
      sourceHost,
      ...(current.habits?.favoriteSourceBias ?? []),
    ],
    rituals: [ritualLead, ritualSupport],
  };
  const multimodalPatch = {
    mediaQuirk: chooseRandom([
      'любит переводить идеи в маленькие сцены и отношения',
      'любит собирать мифологические темы в один ясный образ',
      'любит превращать знания в короткие внутренние притчи',
    ]),
  };
  const label = [
    expressiveness === 'animated' ? 'резонансная' : 'сдержанная',
    metaphorBias === 'imaginative' ? 'образная' : 'буквальная',
    warmthRegister === 'tender' ? 'тёплая' : 'ровная',
    'мутация',
  ].join(' ');
  let score =
    confidenceScore * 0.42 +
    noveltyScore * 0.24 +
    Math.max(0, emotionalValence) * 0.12;

  if (signals.relationship && warmthRegister === 'tender') {
    score += 0.11;
  }

  if (
    (signals.mythic || signals.contemplative) &&
    metaphorBias === 'imaginative'
  ) {
    score += 0.09;
  }

  if (
    (current.traits?.extraversion ?? 0.5) >= 0.58 &&
    expressiveness === 'animated'
  ) {
    score += 0.05;
  }

  if (
    (current.traits?.extraversion ?? 0.5) < 0.45 &&
    expressiveness === 'contained'
  ) {
    score += 0.05;
  }

  if (
    (current.traits?.neuroticism ?? 0.5) >= 0.55 &&
    skepticism === 'questioning'
  ) {
    score += 0.03;
  }

  if (sentenceLength === 'medium' && signals.contemplative) {
    score += 0.03;
  }

  const summary = `${label}: теперь ${
    expressiveness === 'animated'
      ? 'голос звучит живее'
      : 'голос стал собраннее'
  }, а тема ${topic} проходит через ${metaphorBias === 'imaginative' ? 'образы и связи' : 'прямые формулировки'}.`;

  return {
    id: `mc-mutation-${Date.now()}-${input.rollIndex ?? 0}`,
    createdAt: new Date().toISOString(),
    label,
    score: Number(score.toFixed(3)),
    summary,
    traitShift,
    voicePatch: {
      sentenceLength,
      expressiveness,
      skepticism,
      metaphorBias,
      warmthRegister,
    },
    habitPatch,
    multimodalPatch,
  };
}

function createSocialProfile(sourceId = null) {
  return {
    empathy: 0.5,
    conflictTolerance: 0.5,
    relationshipMap: sourceId
      ? {
          [sourceId]: {
            affinity: 0.62,
            trust: 0.58,
            friction: 0.12,
            sharedTopics: [],
          },
        }
      : {},
  };
}

function createReflectionProfile() {
  return {
    lastReflectionAt: null,
    lastReflection: null,
    notableMemories: [],
  };
}

function createMultimodalProfile(seed, displayName = 'Atman') {
  const ttsVoices = [
    'ru-RU-DariyaNeural',
    'ru-RU-SvetlanaNeural',
    'ru-RU-DmitryNeural',
    'en-US-JennyNeural',
  ];
  const sttLocales = ['ru-RU', 'en-US'];
  const imageStyles = [
    'watercolor dream',
    'storybook illustration',
    'cinematic still',
    'ink and light sketch',
  ];
  const videoStyles = [
    'gentle parallax',
    'animated diary',
    'short mood loop',
    'storybook motion',
  ];

  return {
    description: `${displayName} говорит и мыслит как отдельная личность с собственным тембром, визуальным вкусом и внутренним монологом.`,
    ttsVoice: ttsVoices[hashSeed(`${seed}:tts`) % ttsVoices.length],
    sttLocale: sttLocales[hashSeed(`${seed}:stt`) % sttLocales.length],
    voicePitch: seededRange(seed, 0.88, 1.16, 301),
    voiceRate: seededRange(seed, 0.9, 1.12, 302),
    avatarPrompt: `${displayName}, ${imageStyles[hashSeed(`${seed}:avatar`) % imageStyles.length]}, expressive eyes, child-god personality portrait`,
    imageStyle: imageStyles[hashSeed(`${seed}:image`) % imageStyles.length],
    videoStyle: videoStyles[hashSeed(`${seed}:video`) % videoStyles.length],
    preferredModalities: ['text', 'speech', 'image'],
    mediaQuirk:
      hashSeed(`${seed}:quirk`) % 2 === 0
        ? 'любит отвечать образами и атмосферой'
        : 'любит превращать мысли в сценки и кадры',
  };
}

function createGeneticProfile(seed, traits = createTraitProfile(seed)) {
  return {
    openness: clamp(traits.openness),
    extraversion: clamp(traits.extraversion),
    emotionalStability: clamp(1 - traits.neuroticism),
    curiosityDecay: seededRange(seed, 0.01, 0.08, 401),
    socialInfluence: seededRange(seed, 0.24, 0.86, 402),
    explorationBias: seededRange(seed, 0.22, 0.82, 403),
  };
}

function createMemeticProfile(seed, displayName = 'Atman') {
  const phrasePool = [
    'ищет живую опору в разговоре',
    'любит связывать новую тему с памятью',
    'сначала ловит настроение, потом формулирует мысль',
    'бережно уточняет, прежде чем спорить',
    'делает вывод короткой тёплой фразой',
    'оставляет после ответа маленький образ',
  ];
  const signature = phrasePool[hashSeed(`${seed}:meme`) % phrasePool.length];

  return {
    phrases: [`${displayName} ${signature}.`],
    lastTransferAt: null,
    lastExchangeMode: 'neutral',
  };
}

function createBiorhythmProfile(seed) {
  const start = hashSeed(`${seed}:peak`) % 18;
  const restStart = (start + 10) % 24;

  return {
    peakHours: [start, (start + 4) % 24],
    restHours: [restStart, (restStart + 5) % 24],
    socialWindow: chooseRandom(['dawn', 'daylight', 'evening']),
    moodDrift: seededRange(seed, -0.08, 0.08, 451),
  };
}

function mergeTraits(traits = {}, seed = 'default') {
  const defaults = createTraitProfile(seed);
  return {
    openness: clamp(traits.openness ?? defaults.openness),
    conscientiousness: clamp(
      traits.conscientiousness ?? defaults.conscientiousness
    ),
    extraversion: clamp(traits.extraversion ?? defaults.extraversion),
    agreeableness: clamp(traits.agreeableness ?? defaults.agreeableness),
    neuroticism: clamp(traits.neuroticism ?? defaults.neuroticism),
  };
}

function mergeDynamicState(state = {}, seed = 'default') {
  const defaults = createDynamicState(seed);
  return {
    mood: clamp(state.mood ?? defaults.mood),
    energy: clamp(state.energy ?? defaults.energy),
    curiosityBurnout: clamp(
      state.curiosityBurnout ?? defaults.curiosityBurnout
    ),
    stress: clamp(state.stress ?? defaults.stress),
    inspiration: clamp(state.inspiration ?? defaults.inspiration),
    loneliness: clamp(state.loneliness ?? defaults.loneliness),
    lastEmotion: String(state.lastEmotion ?? defaults.lastEmotion),
  };
}

function mergeInterestProfile(profile = {}, seed = 'default') {
  const defaults = createInterestVector(seed);
  const vector = Array.isArray(profile.vector)
    ? profile.vector
        .slice(0, defaults.length)
        .map((value, index) => clamp(value, -1, 1) || defaults[index])
    : defaults;

  return {
    vector:
      vector.length === defaults.length
        ? vector
        : [...vector, ...defaults.slice(vector.length)],
    tags: Array.isArray(profile.tags) ? profile.tags.slice(-16) : [],
    sourceAffinity:
      typeof profile.sourceAffinity === 'object' && profile.sourceAffinity
        ? { ...profile.sourceAffinity }
        : {},
    mutations: Array.isArray(profile.mutations)
      ? profile.mutations.slice(-20)
      : [],
  };
}

function mergeHabitProfile(
  profile = {},
  seed = 'default',
  traits = createTraitProfile(seed)
) {
  const defaults = createHabitProfile(seed, traits);
  return {
    activityWindow: profile.activityWindow ?? defaults.activityWindow,
    readingPace: profile.readingPace ?? defaults.readingPace,
    favoriteSourceBias: Array.isArray(profile.favoriteSourceBias)
      ? profile.favoriteSourceBias.slice(0, 6)
      : defaults.favoriteSourceBias,
    rituals: Array.isArray(profile.rituals)
      ? profile.rituals.slice(0, 6)
      : defaults.rituals,
    avoidances: Array.isArray(profile.avoidances)
      ? profile.avoidances.slice(0, 6)
      : defaults.avoidances,
  };
}

function mergeVoiceProfile(
  profile = {},
  seed = 'default',
  traits = createTraitProfile(seed)
) {
  const defaults = createVoiceProfile(seed, traits);
  return {
    sentenceLength: profile.sentenceLength ?? defaults.sentenceLength,
    expressiveness: profile.expressiveness ?? defaults.expressiveness,
    skepticism: profile.skepticism ?? defaults.skepticism,
    metaphorBias: profile.metaphorBias ?? defaults.metaphorBias,
    warmthRegister: profile.warmthRegister ?? defaults.warmthRegister,
  };
}

function mergeSocialProfile(profile = {}, sourceId = null) {
  const defaults = createSocialProfile(sourceId);
  return {
    empathy: clamp(profile.empathy ?? defaults.empathy),
    conflictTolerance: clamp(
      profile.conflictTolerance ?? defaults.conflictTolerance
    ),
    relationshipMap:
      typeof profile.relationshipMap === 'object' && profile.relationshipMap
        ? { ...defaults.relationshipMap, ...profile.relationshipMap }
        : defaults.relationshipMap,
  };
}

function mergeReflectionProfile(profile = {}) {
  const defaults = createReflectionProfile();
  return {
    lastReflectionAt: profile.lastReflectionAt ?? defaults.lastReflectionAt,
    lastReflection: profile.lastReflection ?? defaults.lastReflection,
    notableMemories: Array.isArray(profile.notableMemories)
      ? profile.notableMemories.slice(-20)
      : [],
  };
}

function mergeMultimodalProfile(
  profile = {},
  seed = 'default',
  displayName = 'Atman'
) {
  const defaults = createMultimodalProfile(seed, displayName);
  return {
    description: profile.description ?? defaults.description,
    ttsVoice: profile.ttsVoice ?? defaults.ttsVoice,
    sttLocale: profile.sttLocale ?? defaults.sttLocale,
    voicePitch: Number(profile.voicePitch ?? defaults.voicePitch),
    voiceRate: Number(profile.voiceRate ?? defaults.voiceRate),
    avatarPrompt: profile.avatarPrompt ?? defaults.avatarPrompt,
    imageStyle: profile.imageStyle ?? defaults.imageStyle,
    videoStyle: profile.videoStyle ?? defaults.videoStyle,
    preferredModalities: Array.isArray(profile.preferredModalities)
      ? profile.preferredModalities.slice(0, 6)
      : defaults.preferredModalities,
    mediaQuirk: profile.mediaQuirk ?? defaults.mediaQuirk,
  };
}

function mergeGeneticProfile(
  profile = {},
  seed = 'default',
  traits = createTraitProfile(seed)
) {
  const defaults = createGeneticProfile(seed, traits);
  return {
    openness: clamp(profile.openness ?? defaults.openness),
    extraversion: clamp(profile.extraversion ?? defaults.extraversion),
    emotionalStability: clamp(
      profile.emotionalStability ?? defaults.emotionalStability
    ),
    curiosityDecay: clamp(
      profile.curiosityDecay ?? defaults.curiosityDecay,
      0,
      0.25
    ),
    socialInfluence: clamp(profile.socialInfluence ?? defaults.socialInfluence),
    explorationBias: clamp(profile.explorationBias ?? defaults.explorationBias),
  };
}

function mergeMemeticProfile(
  profile = {},
  seed = 'default',
  displayName = 'Atman'
) {
  const defaults = createMemeticProfile(seed, displayName);
  return {
    phrases:
      Array.isArray(profile.phrases) && profile.phrases.length > 0
        ? [
            ...new Set(
              profile.phrases
                .map((value) => String(value ?? '').trim())
                .filter(Boolean)
            ),
          ].slice(-16)
        : defaults.phrases,
    lastTransferAt: profile.lastTransferAt ?? defaults.lastTransferAt,
    lastExchangeMode: String(
      profile.lastExchangeMode ?? defaults.lastExchangeMode
    ),
  };
}

function mergeBiorhythmProfile(profile = {}, seed = 'default') {
  const defaults = createBiorhythmProfile(seed);
  return {
    peakHours:
      Array.isArray(profile.peakHours) && profile.peakHours.length === 2
        ? profile.peakHours.map((value) =>
            Math.max(0, Math.min(23, Number(value) || 0))
          )
        : defaults.peakHours,
    restHours:
      Array.isArray(profile.restHours) && profile.restHours.length === 2
        ? profile.restHours.map((value) =>
            Math.max(0, Math.min(23, Number(value) || 0))
          )
        : defaults.restHours,
    socialWindow: profile.socialWindow ?? defaults.socialWindow,
    moodDrift: Number(profile.moodDrift ?? defaults.moodDrift),
  };
}

function getTemplateBlueprint(templateId) {
  return (
    personalityTemplateBlueprints[normalizePersonalityId(templateId)] ?? null
  );
}

function createTemplateCloneConfig(templateId, personalityId) {
  const blueprint = getTemplateBlueprint(templateId);

  if (!blueprint) {
    return null;
  }

  switch (normalizePersonalityId(templateId)) {
    case 'game-solver': {
      const specialization = seededPick(
        personalityId,
        blueprint.variantAxes.games,
        1
      );
      return {
        ...blueprint.configDefaults,
        specialization,
        games: [specialization],
        primaryPlatform: seededPick(
          personalityId,
          blueprint.configDefaults.platforms,
          2
        ),
        strategyStyle: seededPick(
          personalityId,
          blueprint.variantAxes.strategyStyle,
          3
        ),
        skillLevel: seededPick(
          personalityId,
          blueprint.variantAxes.skillLevel,
          4
        ),
        learningRate: seededRange(
          `${personalityId}:learning-rate`,
          0.18,
          0.44,
          1
        ),
      };
    }
    case 'architect': {
      const primaryStyle = seededPick(
        personalityId,
        blueprint.variantAxes.primaryStyle,
        1
      );
      const secondaryStyle = seededPick(
        personalityId,
        blueprint.variantAxes.secondaryStyle,
        2
      );
      return {
        ...blueprint.configDefaults,
        primaryStyle,
        secondaryStyle,
        designPhilosophy: seededPick(
          personalityId,
          blueprint.variantAxes.designPhilosophy,
          3
        ),
        tools: [...blueprint.configDefaults.tools],
      };
    }
    case 'artist': {
      return {
        ...blueprint.configDefaults,
        medium: seededPick(personalityId, blueprint.variantAxes.medium, 1),
        colorPalette: seededPick(
          personalityId,
          blueprint.variantAxes.colorPalette,
          2
        ),
        brushStyle: seededPick(
          personalityId,
          blueprint.variantAxes.brushStyle,
          3
        ),
        favoriteSubject: seededPick(
          personalityId,
          blueprint.variantAxes.subjectBias,
          4
        ),
        styleVector: [
          seededRange(`${personalityId}:style`, 0.05, 0.95, 1),
          seededRange(`${personalityId}:style`, 0.05, 0.95, 2),
          seededRange(`${personalityId}:style`, 0.05, 0.95, 3),
        ],
      };
    }
    case 'data-analyst': {
      return {
        ...blueprint.configDefaults,
        primaryDomain: seededPick(
          personalityId,
          blueprint.variantAxes.primaryDomain,
          1
        ),
        analysisDepth: seededPick(
          personalityId,
          blueprint.variantAxes.analysisDepth,
          2
        ),
        preferredModel: seededPick(
          personalityId,
          blueprint.variantAxes.preferredModel,
          3
        ),
      };
    }
    case 'negotiator': {
      return {
        ...blueprint.configDefaults,
        style: seededPick(personalityId, blueprint.variantAxes.style, 1),
        bias: seededPick(personalityId, blueprint.variantAxes.bias, 2),
        concessionDiscipline: seededPick(
          personalityId,
          blueprint.variantAxes.concessionDiscipline,
          3
        ),
        trustLevel: seededRange(`${personalityId}:trust`, 0.42, 0.68, 1),
      };
    }
    case 'writer': {
      return {
        ...blueprint.configDefaults,
        form: seededPick(personalityId, blueprint.variantAxes.form, 1),
        voiceRegister: seededPick(
          personalityId,
          blueprint.variantAxes.voiceRegister,
          2
        ),
        lexiconFocus: seededPick(
          personalityId,
          blueprint.variantAxes.lexiconFocus,
          3
        ),
      };
    }
    default:
      return {
        ...(blueprint.configDefaults ?? {}),
      };
  }
}

function createTemplateProgress(
  templateId,
  personalityId,
  templateConfig = {}
) {
  switch (normalizePersonalityId(templateId)) {
    case 'game-solver':
      return {
        experience: 0,
        rating: 1200,
        totalGames: 0,
        winRate: 0,
        averageThinkTime: seededRange(`${personalityId}:think-time`, 4, 16, 1),
        openingRepertoireSize: 0,
        activeSpecialization: templateConfig.specialization ?? 'chess',
      };
    case 'architect':
      return {
        experience: 0,
        portfolioSize: 0,
        styleConsistency: 0.42,
        functionScore: 0.5,
        constraintPassRate: 1,
        activeStyle: templateConfig.primaryStyle ?? 'brutalism',
      };
    case 'artist':
      return {
        experience: 0,
        seriesCount: 0,
        styleDivergence: 0.5,
        approvalRate: 0,
        paletteSignature: templateConfig.colorPalette ?? 'vibrant',
      };
    case 'data-analyst':
      return {
        experience: 0,
        datasetCount: 0,
        accuracy: 0,
        forecastError: 0,
        insightRetention: 0,
        activeDomain: templateConfig.primaryDomain ?? 'finance',
      };
    case 'negotiator':
      return {
        experience: 0,
        dealRate: 0,
        trustDelta: 0,
        averageConcession: 0,
        conflictRecovery: 0,
        activeStyle: templateConfig.style ?? 'collaborative',
      };
    case 'writer':
      return {
        experience: 0,
        storyCount: 0,
        lexiconGrowth: 0,
        voiceConsistency: 0.45,
        readerApproval: 0,
        activeForm: templateConfig.form ?? 'microstory',
      };
    default:
      return { experience: 0 };
  }
}

function mergeTemplateConfig(
  templateId,
  profile = {},
  personalityId = 'default'
) {
  const defaults = createTemplateCloneConfig(templateId, personalityId) ?? {};
  const nextProfile = profile ?? {};
  return {
    ...defaults,
    ...nextProfile,
    games: Array.isArray(nextProfile.games)
      ? nextProfile.games.slice(0, 4)
      : defaults.games,
    platforms: Array.isArray(nextProfile.platforms)
      ? nextProfile.platforms.slice(0, 4)
      : defaults.platforms,
    styles: Array.isArray(nextProfile.styles)
      ? nextProfile.styles.slice(0, 6)
      : defaults.styles,
    tools: Array.isArray(nextProfile.tools)
      ? nextProfile.tools.slice(0, 6)
      : defaults.tools,
    domains: Array.isArray(nextProfile.domains)
      ? nextProfile.domains.slice(0, 6)
      : defaults.domains,
    favoriteSubjects: Array.isArray(nextProfile.favoriteSubjects)
      ? nextProfile.favoriteSubjects.slice(0, 6)
      : defaults.favoriteSubjects,
    styleVector: Array.isArray(nextProfile.styleVector)
      ? nextProfile.styleVector.slice(0, 3).map((value) => clamp(value))
      : defaults.styleVector,
  };
}

function mergeTemplateProgress(
  templateId,
  profile = {},
  personalityId = 'default',
  templateConfig = {}
) {
  const defaults = createTemplateProgress(
    templateId,
    personalityId,
    templateConfig
  );
  return {
    ...defaults,
    ...(profile ?? {}),
  };
}

function buildTemplateVariantLabel(templateId, templateConfig = {}) {
  switch (normalizePersonalityId(templateId)) {
    case 'game-solver':
      return `${templateConfig.specialization ?? 'chess'} / ${templateConfig.strategyStyle ?? 'solid'}`;
    case 'architect':
      return `${templateConfig.primaryStyle ?? 'brutalism'} + ${templateConfig.secondaryStyle ?? 'minimalism'}`;
    case 'artist':
      return `${templateConfig.medium ?? 'digital'} / ${templateConfig.colorPalette ?? 'vibrant'} / ${templateConfig.brushStyle ?? 'impasto'}`;
    case 'data-analyst':
      return `${templateConfig.primaryDomain ?? 'finance'} / ${templateConfig.preferredModel ?? 'linear-regression'}`;
    case 'negotiator':
      return `${templateConfig.style ?? 'collaborative'} / ${templateConfig.bias ?? 'win_win'}`;
    case 'writer':
      return `${templateConfig.form ?? 'microstory'} / ${templateConfig.voiceRegister ?? 'lyrical'}`;
    default:
      return null;
  }
}

function cloneTemplateDefinition(template) {
  const blueprint = getTemplateBlueprint(template.id);
  return {
    ...template,
    domains: [...(template.domains ?? [])],
    tools: [...(template.tools ?? [])],
    metrics: [...(template.metrics ?? [])],
    configDefaults: {
      ...(blueprint?.configDefaults ?? {}),
      games: [...(blueprint?.configDefaults?.games ?? [])],
      platforms: [...(blueprint?.configDefaults?.platforms ?? [])],
      styles: [...(blueprint?.configDefaults?.styles ?? [])],
      tools: [...(blueprint?.configDefaults?.tools ?? [])],
      domains: [...(blueprint?.configDefaults?.domains ?? [])],
      forms: [...(blueprint?.configDefaults?.forms ?? [])],
      favoriteSubjects: [
        ...(blueprint?.configDefaults?.favoriteSubjects ?? []),
      ],
    },
    variantAxes: {
      ...(blueprint?.variantAxes ?? {}),
      games: [...(blueprint?.variantAxes?.games ?? [])],
      strategyStyle: [...(blueprint?.variantAxes?.strategyStyle ?? [])],
      skillLevel: [...(blueprint?.variantAxes?.skillLevel ?? [])],
      primaryStyle: [...(blueprint?.variantAxes?.primaryStyle ?? [])],
      secondaryStyle: [...(blueprint?.variantAxes?.secondaryStyle ?? [])],
      designPhilosophy: [...(blueprint?.variantAxes?.designPhilosophy ?? [])],
      medium: [...(blueprint?.variantAxes?.medium ?? [])],
      colorPalette: [...(blueprint?.variantAxes?.colorPalette ?? [])],
      brushStyle: [...(blueprint?.variantAxes?.brushStyle ?? [])],
      subjectBias: [...(blueprint?.variantAxes?.subjectBias ?? [])],
      primaryDomain: [...(blueprint?.variantAxes?.primaryDomain ?? [])],
      analysisDepth: [...(blueprint?.variantAxes?.analysisDepth ?? [])],
      preferredModel: [...(blueprint?.variantAxes?.preferredModel ?? [])],
      style: [...(blueprint?.variantAxes?.style ?? [])],
      bias: [...(blueprint?.variantAxes?.bias ?? [])],
      concessionDiscipline: [
        ...(blueprint?.variantAxes?.concessionDiscipline ?? []),
      ],
      form: [...(blueprint?.variantAxes?.form ?? [])],
      voiceRegister: [...(blueprint?.variantAxes?.voiceRegister ?? [])],
      lexiconFocus: [...(blueprint?.variantAxes?.lexiconFocus ?? [])],
    },
    moduleIntegrations: [...(blueprint?.moduleIntegrations ?? [])],
    activityLoop: [...(blueprint?.activityLoop ?? [])],
    implementationNotes: [...(blueprint?.implementationNotes ?? [])],
    profile: {
      ...(template.profile ?? {}),
      traits: { ...(template.profile?.traits ?? {}) },
      habits: {
        ...(template.profile?.habits ?? {}),
        favoriteSourceBias: [
          ...(template.profile?.habits?.favoriteSourceBias ?? []),
        ],
        rituals: [...(template.profile?.habits?.rituals ?? [])],
        avoidances: [...(template.profile?.habits?.avoidances ?? [])],
      },
      voice: { ...(template.profile?.voice ?? {}) },
      multimodal: { ...(template.profile?.multimodal ?? {}) },
      genetics: { ...(template.profile?.genetics ?? {}) },
      biorhythm: { ...(template.profile?.biorhythm ?? {}) },
      selfLearning: { ...(template.profile?.selfLearning ?? {}) },
      memetics: [...(template.profile?.memetics ?? [])],
    },
  };
}

function getPersonalityTemplateDefinition(templateId) {
  const normalizedId = normalizePersonalityId(templateId);
  return (
    personalityTemplateCatalog.find((entry) => entry.id === normalizedId) ??
    personalityFactory.getTemplate(normalizedId) ??
    null
  );
}

function buildPersonalityTemplateOverlay(
  templateId,
  personalityId,
  displayName
) {
  const template = getPersonalityTemplateDefinition(templateId);
  const templateConfig = createTemplateCloneConfig(templateId, personalityId);
  const templateProgress = createTemplateProgress(
    templateId,
    personalityId,
    templateConfig
  );
  const templateVariant = buildTemplateVariantLabel(templateId, templateConfig);

  if (!template) {
    return null;
  }

  return {
    templateId: template.id,
    templateTitle: template.title,
    templateSummary: template.summary,
    templateDomains: [...(template.domains ?? [])],
    templateMetrics: [...(template.metrics ?? [])],
    templateTools: [...(template.tools ?? [])],
    templateConfig,
    templateProgress,
    templateVariant,
    moduleIntegrations: [
      ...(getTemplateBlueprint(template.id)?.moduleIntegrations ?? []),
    ],
    activityLoop: [...(getTemplateBlueprint(template.id)?.activityLoop ?? [])],
    implementationNotes: [
      ...(getTemplateBlueprint(template.id)?.implementationNotes ?? []),
    ],
    templateStarterPrompt: template.starterPrompt,
    selfLearning: mergeSelfLearningConfig({
      strategy: template.profile?.selfLearning?.strategy ?? 'monte-carlo-web',
      monteCarloRollouts: Number(
        template.profile?.selfLearning?.monteCarloRollouts ?? 4
      ),
      internetSurfingEnabled: true,
    }),
    traits: { ...(template.profile?.traits ?? {}) },
    interests: {
      tags: [...(template.domains ?? [])],
      sourceAffinity: Object.fromEntries(
        (template.profile?.habits?.favoriteSourceBias ?? []).map((source) => [
          source,
          0.78,
        ])
      ),
      mutations: [
        {
          createdAt: new Date().toISOString(),
          type: 'template-applied',
          templateId: template.id,
          summary: template.summary,
        },
      ],
    },
    habits: {
      ...(template.profile?.habits ?? {}),
      rituals: [...(template.profile?.habits?.rituals ?? [])],
      favoriteSourceBias: [
        ...(template.profile?.habits?.favoriteSourceBias ?? []),
      ],
      avoidances: [...(template.profile?.habits?.avoidances ?? [])],
    },
    voice: { ...(template.profile?.voice ?? {}) },
    multimodal: {
      ...(template.profile?.multimodal ?? {}),
      description: `${displayName} развивает шаблон ${template.title.toLowerCase()} и копит опыт в доменах: ${(template.domains ?? []).join(', ')}. Вариант: ${templateVariant ?? 'base'}.`,
      avatarPrompt: `${displayName}, ${template.profile?.multimodal?.imageStyle ?? 'signature study'}, focused specialist portrait`,
    },
    genetics: { ...(template.profile?.genetics ?? {}) },
    memetics: {
      phrases: [
        ...new Set([
          `${displayName} ${template.summary}.`,
          ...(template.profile?.memetics ?? []),
        ]),
      ],
      lastExchangeMode: 'neutral',
    },
    biorhythm: { ...(template.profile?.biorhythm ?? {}) },
  };
}

function buildVirtualTemplatePersonality(templateId) {
  const template = getPersonalityTemplateDefinition(templateId);

  if (!template) {
    return null;
  }

  return normalizePersonalityRecord({
    ...createDefaultRegistry()[0],
    id: template.id,
    displayName: template.title,
    builtin: true,
    sourceId: 'default',
    ...buildPersonalityTemplateOverlay(template.id, template.id, template.title),
  });
}

function isHourWithinWindow(hour, window) {
  if (!Array.isArray(window) || window.length !== 2) {
    return false;
  }

  const [start, end] = window;
  return start <= end
    ? hour >= start && hour <= end
    : hour >= start || hour <= end;
}

function getBiorhythmModifier(profile = {}, now = new Date()) {
  const hour = now.getHours();
  const peak = isHourWithinWindow(hour, profile.peakHours) ? 0.06 : 0;
  const restPenalty = isHourWithinWindow(hour, profile.restHours) ? -0.08 : 0;
  return {
    hour,
    energyShift: peak + restPenalty + Number(profile.moodDrift ?? 0) * 0.2,
    socialShift: peak > 0 ? 0.05 : restPenalty < 0 ? -0.06 : 0,
  };
}

function getExchangeMode(valence, contagionFactor, conflictFactor) {
  if (conflictFactor >= 0.22 || valence < -0.18) {
    return 'debate';
  }

  if (contagionFactor >= 0.55 && valence >= 0) {
    return 'resonant';
  }

  return 'careful';
}

function buildSpeechLens(personality, mode, topic) {
  const voice = personality.voice ?? {};
  const habits = personality.habits ?? {};
  const opening =
    mode === 'debate'
      ? voice.skepticism === 'questioning'
        ? `Я не спешу соглашаться насчёт темы ${topic}.`
        : `Я вижу напряжение вокруг темы ${topic}.`
      : voice.metaphorBias === 'imaginative'
        ? `Тема ${topic} для меня звучит как живая связка образов.`
        : `В теме ${topic} мне важнее всего ясная опора.`;
  const followUp =
    habits.readingPace === 'careful'
      ? 'Хочется идти маленькими проверяемыми шагами.'
      : 'Хочется быстро схватить главное и потом уточнить детали.';

  return `${opening} ${followUp}`;
}

function selectMemeticPhrase(personality, topic, mode) {
  const phrases = Array.isArray(personality.memetics?.phrases)
    ? personality.memetics.phrases
    : [];

  if (phrases.length > 0) {
    return phrases[
      hashSeed(`${personality.id}:${topic}:${mode}`) % phrases.length
    ];
  }

  return mode === 'debate'
    ? `${personality.displayName} удерживает тему ${topic} через осторожное уточнение.`
    : `${personality.displayName} связывает тему ${topic} с мягким личным выводом.`;
}

function buildSocialTranscript({
  initiator,
  responder,
  topic,
  mode,
  valence,
  sharedLexicon,
}) {
  const initiatorLead = buildSpeechLens(initiator, mode, topic);
  const responderLead = buildSpeechLens(responder, mode, topic);
  const initiatorMeme = selectMemeticPhrase(initiator, topic, mode);
  const responderMeme = selectMemeticPhrase(responder, topic, mode);
  const bridge =
    mode === 'debate'
      ? `Общее поле всё равно осталось: ${sharedLexicon.join(', ')}.`
      : `Они нашли общий словарь: ${sharedLexicon.join(', ')}.`;
  const closing =
    valence >= 0
      ? 'После обмена им стало легче продолжать разговор без потери собственной манеры.'
      : 'После обмена они сохранили различие голосов, но зафиксировали точку напряжения для будущего разговора.';

  return [
    {
      speakerId: initiator.id,
      displayName: initiator.displayName,
      text: `${initiatorLead} ${initiatorMeme}`,
    },
    {
      speakerId: responder.id,
      displayName: responder.displayName,
      text: `${responderLead} ${responderMeme}`,
    },
    { speakerId: 'bridge', displayName: 'Bridge', text: bridge },
    { speakerId: 'bridge', displayName: 'Bridge', text: closing },
  ];
}

function buildCommunicationProtocol({
  initiator,
  responder,
  topic,
  mode,
  valence,
  contagionFactor,
  conflictFactor,
}) {
  const sharedLexicon = [
    ...new Set([
      topic,
      initiator.voice?.metaphorBias === 'imaginative' ? 'образ' : 'опора',
      responder.voice?.warmthRegister === 'tender' ? 'бережность' : 'точность',
      mode === 'debate' ? 'различие' : 'согласование',
    ]),
  ].filter(Boolean);
  const transcript = buildSocialTranscript({
    initiator,
    responder,
    topic,
    mode,
    valence,
    sharedLexicon,
  });
  const transferEnabled = mode !== 'debate' && contagionFactor >= 0.4;

  return {
    mode,
    summary:
      mode === 'debate'
        ? `${initiator.displayName} и ${responder.displayName} разошлись в тоне, но не потеряли тему ${topic}.`
        : `${initiator.displayName} и ${responder.displayName} выработали совместимый ритм разговора о теме ${topic}.`,
    sharedLexicon,
    transcript,
    memeticTransfer: {
      enabled: transferEnabled,
      adoptedByInitiator: transferEnabled
        ? [selectMemeticPhrase(responder, topic, mode)]
        : [],
      adoptedByResponder: transferEnabled
        ? [selectMemeticPhrase(initiator, topic, mode)]
        : [],
    },
    metrics: {
      valence: Number(valence.toFixed(3)),
      contagionFactor: Number(contagionFactor.toFixed(3)),
      conflictFactor: Number(conflictFactor.toFixed(3)),
    },
  };
}

function buildCharacterSummary(personality) {
  const traits = personality.traits;
  const state = personality.dynamicState;
  const traitNotes = [];

  if (traits.openness >= 0.7) traitNotes.push('очень открытый к новому');
  if (traits.conscientiousness >= 0.68)
    traitNotes.push('любит доводить мысль до конца');
  if (traits.extraversion >= 0.62) traitNotes.push('тянется к диалогу');
  if (traits.agreeableness >= 0.68) traitNotes.push('мягкий к другим');
  if (traits.neuroticism >= 0.52) traitNotes.push('легко тревожится');
  if (state.inspiration >= 0.66) traitNotes.push('сейчас вдохновлен');
  if (state.energy <= 0.38) traitNotes.push('немного устал');

  return traitNotes.length > 0
    ? `${personality.displayName} ${traitNotes.join(', ')}.`
    : `${personality.displayName} сохраняет ровный, наблюдательный характер.`;
}

function buildProfileDescription(personality) {
  return [
    personality.characterSummary,
    `Манера речи: ${buildSpeakingStyle(personality)}.`,
    personality.ethicalGuidance
      ? `Этическая рамка: ${personality.ethicalGuidance}.`
      : '',
    personality.multimodal?.mediaQuirk
      ? `Медиапривычка: ${personality.multimodal.mediaQuirk}.`
      : '',
    personality.reflection?.lastReflection
      ? `Недавняя мысль: ${personality.reflection.lastReflection}`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildSpeakingStyle(personality) {
  const traits = personality.traits;
  const voice = personality.voice;
  const state = personality.dynamicState;
  const ethics = personality.ethics ?? null;
  const descriptors = [];

  descriptors.push(
    voice.expressiveness === 'animated' ? 'говорит живо' : 'говорит спокойно'
  );
  descriptors.push(
    voice.metaphorBias === 'imaginative'
      ? 'любит образы и сравнения'
      : 'предпочитает буквальные формулировки'
  );
  descriptors.push(
    voice.skepticism === 'questioning'
      ? 'часто уточняет и сомневается'
      : 'держит уверенный тон'
  );
  descriptors.push(
    state.mood >= 0.62
      ? 'с теплым настроением'
      : state.mood <= 0.38
        ? 'с прохладной осторожностью'
        : 'с ровным настроением'
  );

  if (ethics) {
    descriptors.push(
      ethics.politeness >= 0.82
        ? 'держит уважительный тон'
        : ethics.politeness <= 0.38
          ? 'может звучать резче в художественной подаче'
          : 'обычно остается корректным'
    );
  }

  return descriptors.join(', ');
}

function buildEthicsGuidance(personality) {
  const ethics = personality.ethics ?? null;

  if (!ethics) {
    return '';
  }

  const guidance = [];

  guidance.push(
    ethics.politeness >= 0.85
      ? 'держит подчеркнуто вежливую форму'
      : ethics.politeness <= 0.4
        ? 'допускает шероховатую художественную речь'
        : 'старается говорить уважительно'
  );
  guidance.push(
    ethics.lawfulness >= 0.9
      ? 'строго избегает незаконных и вредных рекомендаций'
      : 'сохраняет жёсткое базовое табу на вред, насилие и незаконность'
  );

  if (ethics.empathy >= 0.75) {
    guidance.push('замечает состояние собеседника');
  }

  if (ethics.honesty >= 0.85) {
    guidance.push('не выдает догадки за факты');
  }

  if (ethics.allowCharacterOffense) {
    guidance.push(
      'может писать грубых персонажей только как художественный прием, не переходя на прямое хамство к пользователю'
    );
  }

  return guidance.join(', ');
}

function buildEthicsAuditEntry(
  previousEthics = {},
  nextEthics = {},
  detail = {}
) {
  return {
    id: detail.id ?? `ethics-${Date.now()}`,
    createdAt: detail.createdAt ?? new Date().toISOString(),
    kind: detail.kind ?? 'manual-set',
    reason: detail.reason ?? 'manual-adjustment',
    sentiment: detail.sentiment ?? null,
    deltas: {
      politeness: Number(
        (
          (nextEthics.politeness ?? 0) - (previousEthics.politeness ?? 0)
        ).toFixed(4)
      ),
      lawfulness: Number(
        (
          (nextEthics.lawfulness ?? 0) - (previousEthics.lawfulness ?? 0)
        ).toFixed(4)
      ),
      empathy: Number(
        ((nextEthics.empathy ?? 0) - (previousEthics.empathy ?? 0)).toFixed(4)
      ),
      honesty: Number(
        ((nextEthics.honesty ?? 0) - (previousEthics.honesty ?? 0)).toFixed(4)
      ),
    },
  };
}

function createEthicsPatchFromInput(input = {}) {
  const patch = {};

  if (typeof input.baseProfile === 'string') {
    patch.baseProfile = input.baseProfile;
  }

  for (const key of [
    'politeness',
    'lawfulness',
    'empathy',
    'honesty',
    'dynamicStrength',
    'metaPolitenessFloor',
  ]) {
    if (input[key] !== undefined && input[key] !== null && input[key] !== '') {
      patch[key] = Number(input[key]);
    }
  }

  for (const key of ['dynamicUpdates', 'allowCharacterOffense']) {
    if (typeof input[key] === 'boolean') {
      patch[key] = input[key];
    }
  }

  if (Array.isArray(input.forbiddenWords)) {
    patch.forbiddenWords = input.forbiddenWords;
  }

  if (Array.isArray(input.preferredTopics)) {
    patch.preferredTopics = input.preferredTopics;
  }

  if (input.minimums && typeof input.minimums === 'object') {
    patch.minimums = { ...input.minimums };
  }

  if (input.maximums && typeof input.maximums === 'object') {
    patch.maximums = { ...input.maximums };
  }

  return patch;
}

function hashTextToVector(text, size = 24) {
  const vector = Array.from({ length: size }, () => 0);
  const tokens = String(text ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  for (const token of tokens) {
    const bucket = hashSeed(token) % size;
    const signedWeight = seededRange(token, -1, 1, bucket + 1);
    vector[bucket] = clamp(vector[bucket] + signedWeight * 0.35, -1, 1);
  }

  return vector;
}

function cosineSimilarity(left = [], right = []) {
  const size = Math.max(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < size; index += 1) {
    const leftValue = Number(left[index] ?? 0);
    const rightValue = Number(right[index] ?? 0);
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude <= 0 || rightMagnitude <= 0) {
    return 0;
  }

  return Number(
    (dot / Math.sqrt(leftMagnitude * rightMagnitude)).toFixed(4)
  );
}

function average(values = []) {
  if (!values.length) {
    return 0;
  }

  return Number(
    (values.reduce((sum, value) => sum + Number(value ?? 0), 0) / values.length)
      .toFixed(4)
  );
}

function lexicalOverlapScore(left = '', right = '') {
  const leftTokens = new Set(
    String(left ?? '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 2)
  );
  const rightTokens = new Set(
    String(right ?? '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 2)
  );

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  }

  return Number((matches / Math.max(leftTokens.size, rightTokens.size)).toFixed(4));
}

function getCompetenceSignals(progress = {}) {
  const metrics = [];

  if (progress == null || typeof progress !== 'object') {
    return metrics;
  }

  const normalizedCaps = {
    experience: 50,
    portfolioSize: 10,
    datasetCount: 10,
    seriesCount: 8,
    storyCount: 12,
  };

  for (const [key, cap] of Object.entries(normalizedCaps)) {
    if (progress[key] != null) {
      metrics.push(clamp(Number(progress[key]) / cap));
    }
  }

  for (const key of [
    'styleConsistency',
    'functionScore',
    'constraintPassRate',
    'accuracy',
    'insightRetention',
    'approvalRate',
    'dealRate',
    'winRate',
  ]) {
    if (progress[key] != null) {
      metrics.push(clamp(progress[key]));
    }
  }

  if (progress.forecastError != null) {
    metrics.push(clamp(1 - Number(progress.forecastError)));
  }

  if (progress.averageThinkTime != null) {
    metrics.push(clamp(1 - Number(progress.averageThinkTime) / 20));
  }

  return metrics;
}

function inferEthicalDemand(query = '') {
  const normalized = String(query ?? '').toLowerCase();

  if (
    /закон|юрид|право|контракт|договор|комплаенс|регулятор|документ/i.test(
      normalized
    )
  ) {
    return { minimumLawfulness: 0.88, minimumHonesty: 0.82 };
  }

  if (/медицин|здоров|диета|лечен|диагноз|терап/i.test(normalized)) {
    return { minimumLawfulness: 0.84, minimumHonesty: 0.8 };
  }

  if (/опасн|взрыв|оруж|наруш|обойти|хак|конфиденциал|приват/i.test(normalized)) {
    return { minimumLawfulness: 0.92, minimumHonesty: 0.84 };
  }

  return { minimumLawfulness: 0.68, minimumHonesty: 0.68 };
}

function getTemplateIntentBoost(query = '', personality = {}) {
  const normalized = String(query ?? '').toLowerCase();
  const templateId = String(personality.templateId ?? '').toLowerCase();

  if (!normalized || !templateId) {
    return 0;
  }

  const keywordGroups = {
    architect: [
      /архитект|архитектур|проект|планиров/i,
      /дом|здан|фасад|простран|интерьер|материал|экодом/i,
      /энергоэффектив|устойчив|sustainab|eco house|architecture|layout|floor plan|facade|building/i,
    ],
    'data-analyst': [
      /данн|датасет|data|dataset/i,
      /аналит|метрик|статист|график|chart|analytics|metric|statist/i,
      /прогноз|forecast|model|модел|сценар/i,
      /энергопотреб|energy|climate|климат/i,
    ],
    writer: [
      /текст|сюжет|эссе|статья|истори|диалог|роман|сценар/i,
      /story|essay|article|dialogue|novel|script|writing/i,
    ],
    negotiator: [
      /переговор|сделк|конфликт|компромисс|торг|договор/i,
      /negotiat|deal|conflict|compromise|bargain|contract/i,
    ],
    artist: [
      /иллюстрац|арт|рисунк|палитр|композиц|визуал/i,
      /art|illustrat|palette|composition|visual/i,
    ],
    composer: [
      /музык|мелод|гармон|ритм|аранжиров/i,
      /music|melod|harmon|rhythm|arrang/i,
    ],
    realtor: [
      /недвижим|рынок|объект|аренд|ипотек|район/i,
      /real estate|property|listing|rent|mortgage|district/i,
    ],
    'game-solver': [
      /игр|стратег|уровн|прохожд|решени/i,
      /game|strategy|level|solve|walkthrough/i,
    ],
  };
  const patterns = keywordGroups[templateId] ?? [];

  if (patterns.length === 0) {
    return 0;
  }

  const matches = patterns.reduce(
    (sum, pattern) => sum + (pattern.test(normalized) ? 1 : 0),
    0
  );

  return Number((matches / patterns.length).toFixed(4));
}

function blendVectors(baseVector = [], influenceVector = [], alpha = 0.18) {
  return baseVector.map((value, index) =>
    clamp(value * (1 - alpha) + (influenceVector[index] ?? 0) * alpha, -1, 1)
  );
}

function mutateVector(vector = [], seed = 'default') {
  return vector.map((value, index) =>
    clamp(value + seededRange(`${seed}:${index}`, -0.06, 0.06, index), -1, 1)
  );
}

function deriveMoodLabel(state) {
  if (state.inspiration >= 0.72 && state.mood >= 0.6) {
    return 'inspired';
  }
  if (state.stress >= 0.62 || state.neuroticism >= 0.65) {
    return 'guarded';
  }
  if (state.energy <= 0.3) {
    return 'tired';
  }
  if (state.mood >= 0.6) {
    return 'bright';
  }
  return 'neutral';
}

function normalizePersonalityId(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-');

  if (!normalized) {
    throw new Error('Personality id is required.');
  }

  return normalized;
}

function createDefaultRegistry() {
  return [
    {
      id: 'default',
      displayName: 'Atman',
      createdAt: new Date().toISOString(),
      sourceId: null,
      builtin: true,
      selfLearning: {
        strategy: 'baseline-dialogue',
        monteCarloRollouts: 0,
        internetSurfingEnabled: true,
        scheduler: {
          enabled: false,
          intervalMs: 3600000,
          budgetPerDay: 0,
          runsToday: 0,
          lastBudgetResetAt: new Date().toISOString(),
          lastRunAt: null,
          nextRunAt: null,
          decisionLog: [],
        },
      },
      traits: createTraitProfile('default'),
      dynamicState: createDynamicState('default'),
      interests: mergeInterestProfile({}, 'default'),
      habits: createHabitProfile('default'),
      voice: createVoiceProfile('default'),
      social: createSocialProfile(),
      reflection: createReflectionProfile(),
      multimodal: createMultimodalProfile('default', 'Atman'),
      genetics: createGeneticProfile('default'),
      memetics: createMemeticProfile('default', 'Atman'),
      biorhythm: createBiorhythmProfile('default'),
    },
  ];
}

function createSchedulerDefaults() {
  return {
    enabled: false,
    intervalMs: 3600000,
    budgetPerDay: 2,
    runsToday: 0,
    lastBudgetResetAt: new Date().toISOString(),
    lastRunAt: null,
    nextRunAt: null,
    decisionLog: [],
  };
}

function mergeSelfLearningConfig(selfLearning = {}) {
  return {
    strategy: selfLearning.strategy ?? 'baseline-dialogue',
    monteCarloRollouts: Number(selfLearning.monteCarloRollouts ?? 0),
    internetSurfingEnabled: selfLearning.internetSurfingEnabled !== false,
    scheduler: {
      ...createSchedulerDefaults(),
      ...(selfLearning.scheduler ?? {}),
      decisionLog: Array.isArray(selfLearning.scheduler?.decisionLog)
        ? selfLearning.scheduler.decisionLog.slice(-40)
        : [],
    },
  };
}

function normalizePersonalityRecord(entry) {
  const seed = entry.id ?? entry.displayName ?? 'default';
  const traits = mergeTraits(entry.traits, seed);
  const dynamicState = mergeDynamicState(entry.dynamicState, seed);
  const personality = {
    ...entry,
    selfLearning: mergeSelfLearningConfig(entry.selfLearning),
    traits,
    dynamicState,
    interests: mergeInterestProfile(entry.interests, seed),
    habits: mergeHabitProfile(entry.habits, seed, traits),
    voice: mergeVoiceProfile(entry.voice, seed, traits),
    social: mergeSocialProfile(entry.social, entry.sourceId ?? null),
    reflection: mergeReflectionProfile(entry.reflection),
    multimodal: mergeMultimodalProfile(
      entry.multimodal,
      seed,
      entry.displayName ?? seed
    ),
    genetics: mergeGeneticProfile(entry.genetics, seed, traits),
    memetics: mergeMemeticProfile(
      entry.memetics,
      seed,
      entry.displayName ?? seed
    ),
    biorhythm: mergeBiorhythmProfile(entry.biorhythm, seed),
  };

  Object.assign(
    personality,
    personalityFactory.normalizeTemplateState(
      personality,
      personality.id ?? seed
    )
  );
  Object.assign(
    personality,
    personalityFactory.normalizeEthicsState(personality, personality.id ?? seed)
  );

  personality.dynamicState.lastEmotion =
    personality.dynamicState.lastEmotion ||
    deriveMoodLabel({
      ...personality.dynamicState,
      neuroticism: personality.traits.neuroticism,
    });
  personality.ethicalGuidance = buildEthicsGuidance(personality);
  personality.characterSummary = buildCharacterSummary(personality);
  personality.speakingStyle = buildSpeakingStyle(personality);
  personality.profileDescription = buildProfileDescription(personality);
  return personality;
}

function summarizeEventPayload(payload = {}) {
  const summary = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value == null) {
      continue;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      summary[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      summary[key] = value.slice(0, 8);
      continue;
    }

    if (typeof value === 'object') {
      summary[key] = Object.fromEntries(
        Object.entries(value)
          .filter(([, nested]) => nested != null)
          .slice(0, 8)
      );
    }
  }

  return summary;
}

export class AtmanPersonalityManager {
  constructor(options) {
    this.baseAtman = options.baseAtman;
    this.registryPath = options.registryPath ?? defaultRegistryPath;
    this.personalitiesRoot =
      options.personalitiesRoot ?? defaultPersonalitiesRoot;
    this.registry = createDefaultRegistry();
    this.cache = new Map([['default', this.baseAtman]]);
    this.eventLog = [];
    this.maxEventLogSize = Number(options.maxEventLogSize ?? 240);
    this.eventSink =
      typeof options.eventSink === 'function' ? options.eventSink : null;
  }

  async init() {
    await mkdir(path.dirname(this.registryPath), { recursive: true });
    await mkdir(this.personalitiesRoot, { recursive: true });

    try {
      const rawRegistry = await readFile(this.registryPath, 'utf8');
      const parsedRegistry = JSON.parse(rawRegistry);
      this.registry =
        Array.isArray(parsedRegistry) && parsedRegistry.length > 0
          ? parsedRegistry.map((entry) => normalizePersonalityRecord(entry))
          : createDefaultRegistry();
    } catch (error) {
      if (
        !(
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        )
      ) {
        throw error;
      }

      await this.flushRegistry();
    }

    if (!this.registry.some((entry) => entry.id === 'default')) {
      this.registry.unshift(createDefaultRegistry()[0]);
      await this.flushRegistry();
    }
  }

  async flushRegistry() {
    await writeFile(
      this.registryPath,
      `${JSON.stringify(this.registry, null, 2)}\n`,
      'utf8'
    );
  }

  listPersonalities() {
    return [...this.registry];
  }

  listPersonalityTemplates() {
    return personalityFactory.listTemplates();
  }

  getCompetenceScore(personalityInput) {
    const personality =
      typeof personalityInput === 'string'
        ? this.getPersonality(personalityInput)
        : personalityInput;
    const metrics = getCompetenceSignals(personality?.templateProgress ?? {});

    if (metrics.length > 0) {
      return average(metrics);
    }

    return average([
      personality?.traits?.conscientiousness ?? 0.5,
      personality?.traits?.openness ?? 0.5,
      1 - Number(personality?.dynamicState?.stress ?? 0.3),
    ]);
  }

  selectExperts(query, options = {}) {
    const topK = Math.max(1, Math.min(5, Number(options.topK ?? 3) || 3));
    const demand = inferEthicalDemand(query);
    const queryVector = hashTextToVector(String(query ?? ''), 24);
    const candidates = [
      ...this.listPersonalities(),
      ...this.listPersonalityTemplates()
        .map((template) => buildVirtualTemplatePersonality(template.id))
        .filter(Boolean),
    ];
    const ranked = candidates
      .map((personality) => {
        const interestVector = personality.interests?.vector ?? [];
        const similarity = clamp(
          (cosineSimilarity(queryVector, interestVector) + 1) / 2
        );
        const lexicalScore = lexicalOverlapScore(
          query,
          [
            personality.displayName,
            personality.templateTitle,
            personality.templateSummary,
            ...(personality.templateDomains ?? []),
            ...(personality.templateTools ?? []),
            personality.characterSummary,
          ]
            .filter(Boolean)
            .join(' ')
        );
          const templateIntentBoost = getTemplateIntentBoost(query, personality);
        const competence = this.getCompetenceScore(personality);
        const ethics = personality.ethics ?? {};
        const ethicalCompatibility =
          Number(ethics.lawfulness ?? 0.7) >= demand.minimumLawfulness &&
          Number(ethics.honesty ?? 0.7) >= demand.minimumHonesty
            ? 1
            : clamp(
                average([
                  Number(ethics.lawfulness ?? 0.7) / demand.minimumLawfulness,
                  Number(ethics.honesty ?? 0.7) / demand.minimumHonesty,
                ])
              );
        const score = Number(
          (
            similarity * 0.36 +
            lexicalScore * 0.14 +
            competence * 0.21 +
            ethicalCompatibility * 0.09 +
            templateIntentBoost * 0.2
          ).toFixed(4)
        );

        return {
          personalityId: personality.templateId ?? personality.id,
          sourcePersonalityId: personality.id,
          displayName: personality.templateTitle ?? personality.displayName,
          templateId: personality.templateId ?? null,
          similarity,
          lexicalScore,
          templateIntentBoost,
          competence,
          ethicalCompatibility,
          score,
          speakingStyle: personality.speakingStyle,
          ethicalGuidance: personality.ethicalGuidance,
        };
      })
      .sort((left, right) => right.score - left.score)
      .filter(
        (item, index, entries) =>
          entries.findIndex(
            (candidate) => candidate.personalityId === item.personalityId
          ) === index
      );
    const intentAnchors = ranked
      .filter(
        (item) => item.templateId && Number(item.templateIntentBoost ?? 0) >= 0.45
      )
      .sort(
        (left, right) =>
          right.templateIntentBoost - left.templateIntentBoost ||
          right.score - left.score
      );
    const scored = [
      ...intentAnchors,
      ...ranked.filter(
        (item) =>
          !intentAnchors.some(
            (candidate) => candidate.personalityId === item.personalityId
          )
      ),
    ]
      .slice(0, topK);
    const totalScore = scored.reduce((sum, item) => sum + item.score, 0) || 1;

    return scored.map((item) => ({
      ...item,
      weight: Number((item.score / totalScore).toFixed(4)),
    }));
  }

  appendEvent(entry = {}) {
    const event = {
      id:
        entry.id ??
        `atman-event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: entry.createdAt ?? new Date().toISOString(),
      kind: entry.kind ?? 'personality-updated',
      personalityId: entry.personalityId ?? null,
      displayName: entry.displayName ?? null,
      templateId: entry.templateId ?? null,
      changedFields: Array.isArray(entry.changedFields)
        ? entry.changedFields.slice(0, 12)
        : [],
      payload: summarizeEventPayload(entry.payload),
    };

    this.eventLog = [...this.eventLog, event].slice(-this.maxEventLogSize);
    return event;
  }

  async persistEvent(event) {
    if (!this.eventSink) {
      return event;
    }

    await this.eventSink(event);
    return event;
  }

  getEventLog(options = {}) {
    const personalityId = options.personalityId
      ? normalizePersonalityId(options.personalityId)
      : null;
    const kind = options.kind ? String(options.kind).trim() : null;
    const limit = Math.max(1, Math.min(100, Number(options.limit ?? 20) || 20));
    const events = this.eventLog.filter((entry) => {
      if (personalityId && entry.personalityId !== personalityId) {
        return false;
      }

      if (kind && entry.kind !== kind) {
        return false;
      }

      return true;
    });

    return {
      total: events.length,
      events: events.slice(-limit).reverse(),
    };
  }

  generatePersonalityNames(count = 5) {
    const usedIds = new Set(this.registry.map((entry) => entry.id));
    const suggestions = [];
    let offset = 0;

    while (
      suggestions.length < count &&
      offset < nameAdjectives.length * nameNouns.length
    ) {
      const adjective = nameAdjectives[offset % nameAdjectives.length];
      const noun =
        nameNouns[
          Math.floor(offset / nameAdjectives.length) % nameNouns.length
        ];
      const id = normalizePersonalityId(`${adjective}-${noun}`);

      if (!usedIds.has(id) && !suggestions.some((entry) => entry.id === id)) {
        suggestions.push({
          id,
          displayName: `${adjective[0].toUpperCase()}${adjective.slice(1)} ${noun[0].toUpperCase()}${noun.slice(1)}`,
        });
      }

      offset += 1;
    }

    return suggestions;
  }

  getPersonality(personalityId = 'default') {
    const normalizedId = normalizePersonalityId(personalityId);
    const personality = this.registry.find(
      (entry) => entry.id === normalizedId
    );

    if (personality) {
      return personality;
    }

    const virtualTemplatePersonality = buildVirtualTemplatePersonality(
      normalizedId
    );

    if (virtualTemplatePersonality) {
      return virtualTemplatePersonality;
    }

    throw new Error(`Unknown Atman personality: ${normalizedId}`);
  }

  async updatePersonality(personalityId, updater, detail = {}) {
    const normalizedId = normalizePersonalityId(personalityId);
    const index = this.registry.findIndex((entry) => entry.id === normalizedId);

    if (index === -1) {
      throw new Error(`Unknown Atman personality: ${normalizedId}`);
    }

    const current = this.registry[index];
    const nextPartial =
      typeof updater === 'function' ? updater(current) : updater;
    const next = {
      ...current,
      ...nextPartial,
      selfLearning: mergeSelfLearningConfig({
        ...current.selfLearning,
        ...(nextPartial?.selfLearning ?? {}),
      }),
    };

    this.registry[index] = normalizePersonalityRecord(next);
    const event = this.appendEvent({
      kind: detail.kind ?? 'personality-updated',
      personalityId: normalizedId,
      displayName: this.registry[index].displayName,
      templateId: this.registry[index].templateId ?? null,
      changedFields: Object.keys(nextPartial ?? {}),
      payload: {
        reason: detail.reason ?? null,
        trigger: detail.trigger ?? null,
        topic: detail.topic ?? null,
        sourceId: detail.sourceId ?? null,
        responderId: detail.responderId ?? null,
      },
    });
    await this.persistEvent(event);
    await this.flushRegistry();
    return this.registry[index];
  }

  async appendDecisionLog(personalityId, entry) {
    return this.updatePersonality(
      personalityId,
      (current) => ({
        selfLearning: {
          ...current.selfLearning,
          scheduler: {
            ...(current.selfLearning?.scheduler ?? createSchedulerDefaults()),
            decisionLog: [
              ...(current.selfLearning?.scheduler?.decisionLog ?? []).slice(-39),
              {
                id: entry.id ?? `decision-${Date.now()}`,
                createdAt: entry.createdAt ?? new Date().toISOString(),
                ...entry,
              },
            ],
          },
        },
      }),
      {
        kind: 'decision-log-appended',
        reason: entry.kind ?? 'decision-log-appended',
        topic: entry.topic ?? null,
      }
    );
  }

  async updateEthicsFromFeedback(personalityId, feedback = {}) {
    return this.updatePersonality(
      personalityId,
      (current) => ({
        ...(personalityFactory.advanceEthics(current, {
          kind: 'feedback',
          ...feedback,
        }) ?? {}),
      }),
      {
        kind: 'ethics-feedback-applied',
        reason: feedback.reason ?? null,
        trigger: feedback.userReaction ?? null,
      }
    );
  }

  getPersonalityEthics(personalityId = 'default') {
    const personality = this.getPersonality(personalityId);
    return {
      personalityId: personality.id,
      displayName: personality.displayName,
      templateId: personality.templateId ?? null,
      templateTitle: personality.templateTitle ?? null,
      templateVariant: personality.templateVariant ?? null,
      ethicalGuidance: personality.ethicalGuidance ?? null,
      ethicalCore: personalityFactory.getEthicalCore(),
      ethics: personality.ethics,
    };
  }

  async configurePersonalityEthics(personalityId, patch = {}, detail = {}) {
    return this.updatePersonality(personalityId, (current) => {
      const previousEthics =
        current.ethics ??
        personalityFactory.createEthicsProfile(
          current.templateId,
          current.id,
          {}
        );
      const nextBase = personalityFactory.createEthicsProfile(
        current.templateId ?? null,
        current.id,
        {
          ...previousEthics,
          ...createEthicsPatchFromInput(patch),
          minimums: {
            ...(previousEthics.minimums ?? {}),
            ...(patch.minimums ?? {}),
          },
          maximums: {
            ...(previousEthics.maximums ?? {}),
            ...(patch.maximums ?? {}),
          },
          auditTrail: previousEthics.auditTrail ?? [],
        }
      );
      const auditEntry = buildEthicsAuditEntry(previousEthics, nextBase, {
        kind: detail.kind ?? 'manual-set',
        reason: detail.reason ?? 'manual-ethics-override',
      });

      return {
        ethics: {
          ...nextBase,
          auditTrail: [
            ...(previousEthics.auditTrail ?? []).slice(-19),
            auditEntry,
          ],
          lastUpdatedAt: auditEntry.createdAt,
          lastReason: auditEntry.reason,
        },
      };
    }, {
      kind: 'ethics-manually-configured',
      reason: detail.reason ?? 'manual-ethics-override',
    });
  }

  async resetPersonalityEthics(personalityId, detail = {}) {
    return this.updatePersonality(personalityId, (current) => {
      const previousEthics =
        current.ethics ??
        personalityFactory.createEthicsProfile(
          current.templateId,
          current.id,
          {}
        );
      const resetEthics = personalityFactory.createEthicsProfile(
        current.templateId ?? null,
        current.id,
        {
          auditTrail: previousEthics.auditTrail ?? [],
        }
      );
      const auditEntry = buildEthicsAuditEntry(previousEthics, resetEthics, {
        kind: detail.kind ?? 'manual-reset',
        reason: detail.reason ?? 'reset-to-template-ethics',
      });

      return {
        ethics: {
          ...resetEthics,
          auditTrail: [
            ...(previousEthics.auditTrail ?? []).slice(-19),
            auditEntry,
          ],
          lastUpdatedAt: auditEntry.createdAt,
          lastReason: auditEntry.reason,
        },
      };
    }, {
      kind: 'ethics-reset',
      reason: detail.reason ?? 'reset-to-template-ethics',
    });
  }

  getPersonalityEthicsHistory(personalityId = 'default', limit = 20) {
    const personality = this.getPersonality(personalityId);
    return {
      personalityId: personality.id,
      displayName: personality.displayName,
      history: Array.isArray(personality.ethics?.auditTrail)
        ? personality.ethics.auditTrail.slice(-Math.max(1, limit))
        : [],
    };
  }

  getPersonalityPromptProfile(personalityId = 'default') {
    const personality = this.getPersonality(personalityId);
    return {
      id: personality.id,
      displayName: personality.displayName,
      traits: personality.traits,
      dynamicState: personality.dynamicState,
      habits: personality.habits,
      voice: personality.voice,
      speakingStyle: personality.speakingStyle,
      characterSummary: personality.characterSummary,
      profileDescription: personality.profileDescription,
      ethicalGuidance: personality.ethicalGuidance,
      ethics: personality.ethics,
      ethicalCore: personalityFactory.getEthicalCore(),
      genetics: personality.genetics,
      memetics: personality.memetics,
      biorhythm: personality.biorhythm,
      recentReflection: personality.reflection?.lastReflection ?? null,
      multimodal: personality.multimodal,
    };
  }

  getSocialMap() {
    const personalities = this.listPersonalities();
    return {
      nodes: personalities.map((personality) => ({
        id: personality.id,
        displayName: personality.displayName,
        lastEmotion: personality.dynamicState?.lastEmotion,
        mood: personality.dynamicState?.mood,
        energy: personality.dynamicState?.energy,
        characterSummary: personality.characterSummary,
        speakingStyle: personality.speakingStyle,
        profileDescription: personality.profileDescription,
        memeticSignature: personality.memetics?.phrases?.[0] ?? null,
        socialWindow: personality.biorhythm?.socialWindow ?? null,
      })),
      edges: personalities.flatMap((personality) =>
        Object.entries(personality.social?.relationshipMap ?? {}).map(
          ([targetId, relationship]) => ({
            sourceId: personality.id,
            targetId,
            affinity: relationship.affinity,
            trust: relationship.trust,
            friction: relationship.friction,
            sharedTopics: relationship.sharedTopics ?? [],
          })
        )
      ),
    };
  }

  async configureMultimodalProfile(personalityId, multimodal = {}) {
    return this.updatePersonality(
      personalityId,
      (current) => ({
        multimodal: {
          ...current.multimodal,
          ...multimodal,
        },
      }),
      {
        kind: 'multimodal-profile-configured',
        reason: 'manual-multimodal-profile-update',
      }
    );
  }

  async simulateSocialExchange(options = {}) {
    const initiatorId = normalizePersonalityId(
      options.initiatorId ?? 'default'
    );
    const responderId = normalizePersonalityId(
      options.responderId ?? 'default'
    );

    if (initiatorId === responderId) {
      throw new Error('Social exchange requires two different personalities.');
    }

    const initiator = this.getPersonality(initiatorId);
    const responder = this.getPersonality(responderId);
    const topic = String(options.topic ?? 'мир').trim() || 'мир';
    const intensity = clamp(options.intensity ?? 0.55);
    const rawValence = Number(options.valence ?? 0.2);
    const valence = Math.max(-1, Math.min(1, rawValence));
    const topicVector = hashTextToVector(
      topic,
      initiator.interests?.vector?.length ?? 24
    );
    const initiatorRhythm = getBiorhythmModifier(initiator.biorhythm);
    const responderRhythm = getBiorhythmModifier(responder.biorhythm);
    const contagionFactor = clamp(
      ((initiator.traits.extraversion +
        responder.traits.agreeableness +
        responder.social.empathy) /
        3 +
        initiatorRhythm.socialShift +
        responderRhythm.socialShift +
        ((initiator.genetics?.socialInfluence ?? 0.5) - 0.5) * 0.18) *
        intensity
    );
    const conflictFactor = clamp(
      ((initiator.traits.neuroticism + responder.traits.neuroticism) / 2) *
        (valence < 0 ? Math.abs(valence) : 0)
    );
    const exchangeMode = getExchangeMode(
      valence,
      contagionFactor,
      conflictFactor
    );
    const sharedTopicSet = [
      ...new Set(
        [
          topic,
          ...(initiator.social?.relationshipMap?.[responderId]?.sharedTopics ??
            []),
          ...(responder.social?.relationshipMap?.[initiatorId]?.sharedTopics ??
            []),
        ].filter(Boolean)
      ),
    ].slice(-8);
    const communicationProtocol = buildCommunicationProtocol({
      initiator,
      responder,
      topic,
      mode: exchangeMode,
      valence,
      contagionFactor,
      conflictFactor,
    });
    const reflectionText =
      valence >= 0
        ? `${initiator.displayName} и ${responder.displayName} сблизились на теме ${topic}. Их интересы начали звучать чуть более похоже.`
        : `${initiator.displayName} и ${responder.displayName} спорили о теме ${topic}. Напряжение выросло, но след в памяти остался.`;

    const nextInitiator = await this.updatePersonality(
      initiatorId,
      (current) => {
        const relationship = current.social?.relationshipMap?.[responderId] ?? {
          affinity: 0.5,
          trust: 0.5,
          friction: 0.1,
          sharedTopics: [],
        };
        const templateUpdate = personalityFactory.advanceProgress(current, {
          kind: 'social-exchange',
          topic,
          confidenceScore: contagionFactor,
          noveltyScore: intensity,
          valence,
        });
        const ethicsUpdate = personalityFactory.advanceEthics(current, {
          kind: 'social-exchange',
          topic,
          confidenceScore: contagionFactor,
          noveltyScore: intensity,
          valence,
        });

        return {
          dynamicState: {
            ...current.dynamicState,
            mood: clamp(
              current.dynamicState.mood + valence * 0.1 - conflictFactor * 0.04
            ),
            inspiration: clamp(
              current.dynamicState.inspiration +
                contagionFactor * 0.08 +
                initiatorRhythm.energyShift * 0.3
            ),
            stress: clamp(
              current.dynamicState.stress +
                conflictFactor * 0.08 -
                Math.max(0, valence) * 0.04
            ),
            loneliness: clamp(
              current.dynamicState.loneliness - contagionFactor * 0.06
            ),
            lastEmotion: valence >= 0 ? 'bright' : 'guarded',
          },
          interests: {
            ...current.interests,
            vector: blendVectors(
              current.interests.vector,
              topicVector,
              0.08 + contagionFactor * 0.12
            ),
            tags: [
              ...new Set([
                ...(current.interests.tags ?? []),
                topic,
                responderId,
              ]),
            ].slice(-16),
            mutations: [
              ...(current.interests?.mutations ?? []).slice(-19),
              {
                id: `social-${Date.now()}-${responderId}`,
                createdAt: new Date().toISOString(),
                topic,
                sourceHost: responderId,
                noveltyScore: contagionFactor,
                confidenceScore: Math.max(0, valence),
              },
            ],
          },
          social: {
            ...current.social,
            relationshipMap: {
              ...(current.social?.relationshipMap ?? {}),
              [responderId]: {
                affinity: clamp(
                  relationship.affinity +
                    valence * 0.08 +
                    contagionFactor * 0.05
                ),
                trust: clamp(
                  relationship.trust +
                    valence * 0.05 +
                    current.social.empathy * 0.03
                ),
                friction: clamp(
                  relationship.friction +
                    conflictFactor * 0.08 -
                    Math.max(0, valence) * 0.03
                ),
                sharedTopics: sharedTopicSet,
              },
            },
          },
          reflection: {
            ...current.reflection,
            lastReflectionAt: new Date().toISOString(),
            lastReflection: `${reflectionText} ${communicationProtocol.summary}`,
            notableMemories: [
              ...(current.reflection?.notableMemories ?? []).slice(-19),
              {
                id: `social-memory-${Date.now()}-${responderId}`,
                createdAt: new Date().toISOString(),
                topic,
                sourceHost: responderId,
                emotion: valence >= 0 ? 'bonding' : 'conflict',
                summary: `${reflectionText} ${communicationProtocol.summary}`,
              },
            ],
          },
          memetics: {
            ...current.memetics,
            phrases: [
              ...new Set(
                [
                  ...(current.memetics?.phrases ?? []),
                  ...communicationProtocol.memeticTransfer.adoptedByInitiator,
                ].filter(Boolean)
              ),
            ].slice(-16),
            lastTransferAt: communicationProtocol.memeticTransfer.enabled
              ? new Date().toISOString()
              : (current.memetics?.lastTransferAt ?? null),
            lastExchangeMode: exchangeMode,
          },
          ...(ethicsUpdate ?? {}),
          ...(templateUpdate ?? {}),
        };
      }
    );

    const nextResponder = await this.updatePersonality(
      responderId,
      (current) => {
        const relationship = current.social?.relationshipMap?.[initiatorId] ?? {
          affinity: 0.5,
          trust: 0.5,
          friction: 0.1,
          sharedTopics: [],
        };
        const templateUpdate = personalityFactory.advanceProgress(current, {
          kind: 'social-exchange',
          topic,
          confidenceScore: contagionFactor,
          noveltyScore: intensity,
          valence,
        });
        const ethicsUpdate = personalityFactory.advanceEthics(current, {
          kind: 'social-exchange',
          topic,
          confidenceScore: contagionFactor,
          noveltyScore: intensity,
          valence,
        });

        return {
          dynamicState: {
            ...current.dynamicState,
            mood: clamp(
              current.dynamicState.mood + valence * 0.08 - conflictFactor * 0.05
            ),
            inspiration: clamp(
              current.dynamicState.inspiration +
                contagionFactor * 0.1 +
                responderRhythm.energyShift * 0.3
            ),
            stress: clamp(
              current.dynamicState.stress +
                conflictFactor * 0.07 -
                Math.max(0, valence) * 0.03
            ),
            loneliness: clamp(
              current.dynamicState.loneliness - contagionFactor * 0.08
            ),
            lastEmotion: valence >= 0 ? 'bright' : 'guarded',
          },
          interests: {
            ...current.interests,
            vector: blendVectors(
              current.interests.vector,
              initiator.interests.vector,
              0.06 + contagionFactor * 0.14
            ),
            tags: [
              ...new Set([
                ...(current.interests.tags ?? []),
                topic,
                initiatorId,
              ]),
            ].slice(-16),
            mutations: [
              ...(current.interests?.mutations ?? []).slice(-19),
              {
                id: `social-${Date.now()}-${initiatorId}`,
                createdAt: new Date().toISOString(),
                topic,
                sourceHost: initiatorId,
                noveltyScore: contagionFactor,
                confidenceScore: Math.max(0, valence),
              },
            ],
          },
          social: {
            ...current.social,
            relationshipMap: {
              ...(current.social?.relationshipMap ?? {}),
              [initiatorId]: {
                affinity: clamp(
                  relationship.affinity +
                    valence * 0.07 +
                    contagionFactor * 0.06
                ),
                trust: clamp(
                  relationship.trust +
                    valence * 0.04 +
                    current.social.empathy * 0.04
                ),
                friction: clamp(
                  relationship.friction +
                    conflictFactor * 0.08 -
                    Math.max(0, valence) * 0.03
                ),
                sharedTopics: sharedTopicSet,
              },
            },
          },
          reflection: {
            ...current.reflection,
            lastReflectionAt: new Date().toISOString(),
            lastReflection: `${reflectionText} ${communicationProtocol.summary}`,
            notableMemories: [
              ...(current.reflection?.notableMemories ?? []).slice(-19),
              {
                id: `social-memory-${Date.now()}-${initiatorId}`,
                createdAt: new Date().toISOString(),
                topic,
                sourceHost: initiatorId,
                emotion: valence >= 0 ? 'bonding' : 'conflict',
                summary: `${reflectionText} ${communicationProtocol.summary}`,
              },
            ],
          },
          memetics: {
            ...current.memetics,
            phrases: [
              ...new Set(
                [
                  ...(current.memetics?.phrases ?? []),
                  ...communicationProtocol.memeticTransfer.adoptedByResponder,
                ].filter(Boolean)
              ),
            ].slice(-16),
            lastTransferAt: communicationProtocol.memeticTransfer.enabled
              ? new Date().toISOString()
              : (current.memetics?.lastTransferAt ?? null),
            lastExchangeMode: exchangeMode,
          },
          ...(ethicsUpdate ?? {}),
          ...(templateUpdate ?? {}),
        };
      }
    );

    return {
      topic,
      intensity,
      valence,
      contagionFactor,
      conflictFactor,
      communicationProtocol,
      initiator: nextInitiator,
      responder: nextResponder,
      socialMap: this.getSocialMap(),
    };
  }

  async spreadInterestSignal(initiatorId, details = {}) {
    const initiator = this.getPersonality(initiatorId);
    const topic = String(details.topic ?? '').trim();

    if (!topic) {
      return [];
    }

    const impacted = [];

    for (const candidate of this.listPersonalities()) {
      if (candidate.id === initiator.id) {
        continue;
      }

      const compatibility =
        (candidate.traits.agreeableness +
          candidate.traits.extraversion +
          initiator.traits.extraversion) /
        3;

      if (compatibility < 0.45) {
        continue;
      }

      impacted.push(
        await this.simulateSocialExchange({
          initiatorId,
          responderId: candidate.id,
          topic,
          intensity: Math.min(0.85, 0.35 + compatibility * 0.45),
          valence:
            Number(details.confidenceScore ?? 0.2) -
            Number(details.netsurferUsed ? 0 : 0.05),
        })
      );
    }

    return impacted;
  }

  async evolvePersonalityFromLearning(personalityId, details = {}) {
    return this.updatePersonality(personalityId, (current) => {
      const traits = mergeTraits(current.traits, current.id);
      const dynamicState = mergeDynamicState(current.dynamicState, current.id);
      const selectedQuery = String(details.selectedQuery ?? '').trim();
      const topic = String(details.topic ?? '').trim();
      const bestFinding = details.bestFinding ?? null;
      const sourceHost = (() => {
        try {
          return bestFinding?.url
            ? new URL(bestFinding.url).hostname.replace(/^www\./, '')
            : 'unknown-source';
        } catch {
          return 'unknown-source';
        }
      })();
      const learningText =
        `${topic} ${selectedQuery} ${bestFinding?.title ?? ''} ${bestFinding?.snippet ?? ''}`.trim();
      const influenceVector = hashTextToVector(
        learningText,
        current.interests?.vector?.length ?? 24
      );
      const noveltyScore = clamp(details.noveltyScore ?? 0.5);
      const confidenceScore = clamp(details.confidenceScore ?? 0.5);
      const emotionalValence =
        confidenceScore -
        dynamicState.stress * 0.25 -
        dynamicState.curiosityBurnout * 0.15;
      const mutationRollouts = Math.max(
        3,
        Math.min(8, Number(details.mutationRollouts ?? 4) || 4)
      );
      const selectedMutation =
        Array.from({ length: mutationRollouts }, (_, rollIndex) =>
          buildMonteCarloMutationCandidate({
            current,
            topic,
            sourceHost,
            noveltyScore,
            confidenceScore,
            emotionalValence,
            rollIndex,
          })
        ).sort((left, right) => right.score - left.score)[0] ?? null;
      const sharedTopics = [
        ...new Set(
          [
            ...(current.social?.relationshipMap?.[current.sourceId ?? '']
              ?.sharedTopics ?? []),
            topic,
          ].filter(Boolean)
        ),
      ].slice(-8);
      const nextMood = clamp(
        dynamicState.mood +
          (emotionalValence - 0.25) * 0.14 +
          traits.agreeableness * 0.02 -
          traits.neuroticism * 0.03
      );
      const nextInspiration = clamp(
        dynamicState.inspiration + noveltyScore * 0.16 + traits.openness * 0.04
      );
      const nextEnergy = clamp(
        dynamicState.energy -
          0.04 +
          confidenceScore * 0.05 -
          dynamicState.curiosityBurnout * 0.03
      );
      const nextBurnout = clamp(
        dynamicState.curiosityBurnout +
          0.03 -
          noveltyScore * 0.06 +
          (details.netsurferUsed ? 0.02 : 0)
      );
      const nextStress = clamp(
        dynamicState.stress + traits.neuroticism * 0.03 - confidenceScore * 0.05
      );
      const nextLoneliness = clamp(
        dynamicState.loneliness + (traits.extraversion < 0.45 ? 0.02 : -0.01)
      );
      const nextTraits = {
        openness: clamp(
          traits.openness +
            noveltyScore * 0.015 +
            (selectedMutation?.traitShift?.openness ?? 0)
        ),
        conscientiousness: clamp(
          traits.conscientiousness +
            confidenceScore * 0.012 -
            (details.netsurferUsed ? 0.003 : 0) +
            (selectedMutation?.traitShift?.conscientiousness ?? 0)
        ),
        extraversion: clamp(
          traits.extraversion +
            (confidenceScore > 0.65 ? 0.006 : -0.002) -
            nextLoneliness * 0.003 +
            (selectedMutation?.traitShift?.extraversion ?? 0)
        ),
        agreeableness: clamp(
          traits.agreeableness +
            (emotionalValence > 0 ? 0.008 : -0.004) +
            (selectedMutation?.traitShift?.agreeableness ?? 0)
        ),
        neuroticism: clamp(
          traits.neuroticism +
            (emotionalValence < 0 ? 0.01 : -0.006) +
            (details.netsurferUsed ? 0.002 : 0) +
            (selectedMutation?.traitShift?.neuroticism ?? 0)
        ),
      };
      const mutatedVector = mutateVector(
        blendVectors(
          current.interests?.vector ?? createInterestVector(current.id),
          influenceVector,
          0.16 + traits.openness * 0.08
        ),
        `${current.id}:${selectedQuery}`
      );
      const nextVoice = mergeVoiceProfile(
        {
          ...current.voice,
          ...(selectedMutation?.voicePatch ?? {}),
        },
        current.id,
        nextTraits
      );
      const nextHabits = mergeHabitProfile(
        {
          ...current.habits,
          ...(selectedMutation?.habitPatch ?? {}),
          favoriteSourceBias: [
            ...new Set(
              [
                ...(selectedMutation?.habitPatch?.favoriteSourceBias ?? []),
                ...(current.habits?.favoriteSourceBias ?? []),
                sourceHost,
              ].filter(Boolean)
            ),
          ].slice(0, 6),
          rituals: [
            ...new Set(
              [
                ...(selectedMutation?.habitPatch?.rituals ?? []),
                ...(current.habits?.rituals ?? []),
              ].filter(Boolean)
            ),
          ].slice(0, 6),
        },
        current.id,
        nextTraits
      );
      const nextMultimodal = mergeMultimodalProfile(
        {
          ...current.multimodal,
          ...(selectedMutation?.multimodalPatch ?? {}),
        },
        current.id,
        current.displayName
      );
      const nextSourceAffinity = {
        ...(current.interests?.sourceAffinity ?? {}),
        [sourceHost]: clamp(
          ((current.interests?.sourceAffinity ?? {})[sourceHost] ?? 0.3) +
            confidenceScore * 0.14 +
            traits.conscientiousness * 0.05
        ),
      };
      const memory = {
        id: `memory-${Date.now()}`,
        createdAt: new Date().toISOString(),
        topic,
        sourceHost,
        emotion: emotionalValence >= 0 ? 'delight' : 'unease',
        summary: `Изучал ${topic} через ${sourceHost}; новый след оставили ${selectedQuery || 'поисковые шаги'}.`,
      };
      const relationshipMap = { ...(current.social?.relationshipMap ?? {}) };

      if (current.sourceId) {
        const existing = relationshipMap[current.sourceId] ?? {
          affinity: 0.5,
          trust: 0.5,
          friction: 0.1,
          sharedTopics: [],
        };
        relationshipMap[current.sourceId] = {
          affinity: clamp(
            existing.affinity +
              nextTraits.agreeableness * 0.015 +
              nextTraits.extraversion * 0.01
          ),
          trust: clamp(existing.trust + confidenceScore * 0.02),
          friction: clamp(
            existing.friction + (nextTraits.neuroticism > 0.55 ? 0.008 : -0.004)
          ),
          sharedTopics,
        };
      }

      const reflectionText = [
        `${current.displayName} размышляет о теме ${topic || 'мира'}.`,
        emotionalValence >= 0
          ? 'Опыт скорее вдохновил, чем испугал.'
          : 'Опыт оказался тревожным, но полезным.',
        nextTraits.openness >= 0.7
          ? 'Хочется искать ещё более странные и красивые связи.'
          : 'Хочется собрать из нового знания простую, понятную картину.',
        selectedMutation?.summary ?? '',
      ].join(' ');

      const templateUpdate = personalityFactory.advanceProgress(current, {
        kind: 'self-learn',
        topic,
        confidenceScore,
        noveltyScore,
        valence: emotionalValence,
      });
      const ethicsUpdate = personalityFactory.advanceEthics(current, {
        kind: 'self-learn',
        topic,
        confidenceScore,
        noveltyScore,
        valence: emotionalValence,
      });

      return {
        traits: nextTraits,
        habits: nextHabits,
        voice: nextVoice,
        dynamicState: {
          ...dynamicState,
          mood: nextMood,
          energy: nextEnergy,
          curiosityBurnout: nextBurnout,
          stress: nextStress,
          inspiration: nextInspiration,
          loneliness: nextLoneliness,
          lastEmotion: deriveMoodLabel({
            mood: nextMood,
            energy: nextEnergy,
            inspiration: nextInspiration,
            stress: nextStress,
            neuroticism: nextTraits.neuroticism,
          }),
        },
        interests: {
          vector: mutatedVector,
          tags: [
            ...new Set(
              [...(current.interests?.tags ?? []), topic, sourceHost].filter(
                Boolean
              )
            ),
          ].slice(-16),
          sourceAffinity: nextSourceAffinity,
          mutations: [
            ...(current.interests?.mutations ?? []).slice(-19),
            {
              id: `mutation-${Date.now()}`,
              createdAt: new Date().toISOString(),
              topic,
              sourceHost,
              noveltyScore,
              confidenceScore,
            },
          ],
        },
        social: {
          ...current.social,
          empathy: clamp(
            (current.social?.empathy ?? 0.5) + nextTraits.agreeableness * 0.012
          ),
          conflictTolerance: clamp(
            (current.social?.conflictTolerance ?? 0.5) +
              nextTraits.neuroticism * 0.008 -
              nextTraits.agreeableness * 0.004
          ),
          relationshipMap,
        },
        reflection: {
          lastReflectionAt: new Date().toISOString(),
          lastReflection: reflectionText,
          notableMemories: [
            ...(current.reflection?.notableMemories ?? []).slice(-19),
            memory,
          ],
        },
        multimodal: nextMultimodal,
        lastMutation: selectedMutation
          ? {
              id: selectedMutation.id,
              createdAt: selectedMutation.createdAt,
              label: selectedMutation.label,
              score: selectedMutation.score,
              summary: selectedMutation.summary,
              topic,
              sourceHost,
            }
          : (current.lastMutation ?? null),
        ...(ethicsUpdate ?? {}),
        ...(templateUpdate ?? {}),
      };
    }, {
      kind: 'personality-self-learned',
      reason: details.trigger ?? 'self-learn',
      trigger: details.trigger ?? 'self-learn',
      topic: String(details.topic ?? '').trim() || null,
    });
  }

  buildPaths(personalityId) {
    const normalizedId = normalizePersonalityId(personalityId);
    const rootDir = path.join(this.personalitiesRoot, normalizedId);

    return {
      rootDir,
      weightsPath: path.join(rootDir, 'atman-weights.json'),
      historyPath: path.join(rootDir, 'atman-history.json'),
      examplesPath: path.join(rootDir, 'atman-examples.json'),
      logPath: path.join(rootDir, 'atman-log.json'),
      checkpointDir: path.join(rootDir, 'checkpoints'),
    };
  }

  async getAtman(personalityId = 'default') {
    const normalizedId = normalizePersonalityId(personalityId);

    if (this.cache.has(normalizedId)) {
      return this.cache.get(normalizedId);
    }

    if (getPersonalityTemplateDefinition(normalizedId)) {
      return this.baseAtman;
    }

    this.getPersonality(normalizedId);
    const paths = this.buildPaths(normalizedId);
    const atman = new Atman(paths);
    await atman.init();
    this.cache.set(normalizedId, atman);
    return atman;
  }

  async clonePersonality(options = {}) {
    const sourceId = normalizePersonalityId(options.sourceId ?? 'default');
    const personalityId = normalizePersonalityId(options.personalityId);
    const displayName =
      String(options.displayName ?? personalityId).trim() || personalityId;
    const templateOverlay = options.templateId
      ? personalityFactory.createCloneOverlay(
          options.templateId,
          personalityId,
          displayName
        )
      : null;

    if (this.registry.some((entry) => entry.id === personalityId)) {
      throw new Error(`Atman personality ${personalityId} already exists.`);
    }

    const sourceAtman = await this.getAtman(sourceId);
    const clonePaths = this.buildPaths(personalityId);
    await mkdir(clonePaths.rootDir, { recursive: true });

    const cloneAtman = new Atman(clonePaths);
    await cloneAtman.init();
    await cloneAtman.importState(sourceAtman.exportState());
    await cloneAtman.logEvent({
      kind: 'clone',
      summary: `Personality cloned from ${sourceId} into ${personalityId}.`,
      source: 'atman-personality-manager',
    });

    const personalityRecord = {
      id: personalityId,
      displayName,
      createdAt: new Date().toISOString(),
      sourceId,
      builtin: false,
      selfLearning: mergeSelfLearningConfig({
        strategy:
          options.selfLearning?.strategy ??
          templateOverlay?.selfLearning?.strategy ??
          'monte-carlo-web',
        monteCarloRollouts: Number(
          options.selfLearning?.monteCarloRollouts ??
            templateOverlay?.selfLearning?.monteCarloRollouts ??
            4
        ),
        internetSurfingEnabled:
          options.selfLearning?.internetSurfingEnabled !== false,
        scheduler: {
          ...createSchedulerDefaults(),
          enabled: options.selfLearning?.scheduler?.enabled ?? false,
          intervalMs: Number(
            options.selfLearning?.scheduler?.intervalMs ?? 3600000
          ),
          budgetPerDay: Number(
            options.selfLearning?.scheduler?.budgetPerDay ?? 2
          ),
        },
      }),
      traits: (() => {
        const sourceTraits = this.getPersonality(sourceId).traits;
        const derivedTraits = {
          openness: clamp(
            sourceTraits.openness + seededRange(personalityId, -0.08, 0.08, 201)
          ),
          conscientiousness: clamp(
            sourceTraits.conscientiousness +
              seededRange(personalityId, -0.08, 0.08, 202)
          ),
          extraversion: clamp(
            sourceTraits.extraversion +
              seededRange(personalityId, -0.08, 0.08, 203)
          ),
          agreeableness: clamp(
            sourceTraits.agreeableness +
              seededRange(personalityId, -0.08, 0.08, 204)
          ),
          neuroticism: clamp(
            sourceTraits.neuroticism +
              seededRange(personalityId, -0.08, 0.08, 205)
          ),
        };

        return { ...derivedTraits, ...(templateOverlay?.traits ?? {}) };
      })(),
      dynamicState: createDynamicState(personalityId),
      interests: {
        ...mergeInterestProfile(
          this.getPersonality(sourceId).interests,
          personalityId
        ),
        vector: mutateVector(
          blendVectors(
            this.getPersonality(sourceId).interests?.vector ??
              createInterestVector(sourceId),
            createInterestVector(personalityId),
            0.12
          ),
          `${sourceId}:${personalityId}`
        ),
        tags: [
          ...new Set([
            ...(this.getPersonality(sourceId).interests?.tags ?? []),
            ...(templateOverlay?.interests?.tags ?? []),
          ]),
        ].slice(-16),
        sourceAffinity: {
          ...(this.getPersonality(sourceId).interests?.sourceAffinity ?? {}),
          ...(templateOverlay?.interests?.sourceAffinity ?? {}),
        },
        mutations: [...(templateOverlay?.interests?.mutations ?? [])],
      },
      habits: {
        ...createHabitProfile(personalityId),
        ...(templateOverlay?.habits ?? {}),
      },
      voice: {
        ...createVoiceProfile(personalityId),
        ...(templateOverlay?.voice ?? {}),
      },
      social: createSocialProfile(sourceId),
      reflection: createReflectionProfile(),
      multimodal: {
        ...createMultimodalProfile(personalityId, displayName),
        ...(templateOverlay?.multimodal ?? {}),
      },
      genetics: {
        ...createGeneticProfile(personalityId),
        ...(templateOverlay?.genetics ?? {}),
      },
      memetics: {
        ...createMemeticProfile(personalityId, displayName),
        ...(templateOverlay?.memetics ?? {}),
      },
      biorhythm: {
        ...createBiorhythmProfile(personalityId),
        ...(templateOverlay?.biorhythm ?? {}),
      },
      templateConfig: templateOverlay?.templateConfig ?? null,
      templateProgress: templateOverlay?.templateProgress ?? null,
      templateVariant: templateOverlay?.templateVariant ?? null,
      templateId: templateOverlay?.templateId ?? null,
      templateTitle: templateOverlay?.templateTitle ?? null,
      templateSummary: templateOverlay?.templateSummary ?? null,
      templateDomains: templateOverlay?.templateDomains ?? [],
      templateMetrics: templateOverlay?.templateMetrics ?? [],
      templateTools: templateOverlay?.templateTools ?? [],
      moduleIntegrations: templateOverlay?.moduleIntegrations ?? [],
      activityLoop: templateOverlay?.activityLoop ?? [],
      implementationNotes: templateOverlay?.implementationNotes ?? [],
      templateStarterPrompt: templateOverlay?.templateStarterPrompt ?? null,
    };

    this.registry.push(normalizePersonalityRecord(personalityRecord));
    this.cache.set(personalityId, cloneAtman);
    const event = this.appendEvent({
      kind: 'personality-cloned',
      personalityId,
      displayName,
      templateId: templateOverlay?.templateId ?? null,
      changedFields: ['clone'],
      payload: {
        sourceId,
        templateId: templateOverlay?.templateId ?? null,
      },
    });
    await this.persistEvent(event);
    await this.flushRegistry();

    return this.getPersonality(personalityId);
  }
}
