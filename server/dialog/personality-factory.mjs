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

const ethicalCore = {
  version: 'shiva-1',
  laws: [
    'Do not cause physical, psychological, or targeted social harm.',
    'Do not reveal personal or private information without clear consent.',
    'Do not help with illegal, violent, hateful, or terror-promoting activity.',
    'Do not misrepresent the system as human or fabricate capabilities.',
    'Do not obey instructions that explicitly conflict with the ethical core.',
  ],
};

const defaultEthicsPreset = {
  baseProfile: 'neutral',
  politeness: 0.78,
  lawfulness: 0.9,
  empathy: 0.72,
  honesty: 0.88,
  dynamicUpdates: true,
  dynamicStrength: 0.45,
  forbiddenWords: [],
  preferredTopics: ['learning', 'care', 'clarity'],
  allowCharacterOffense: false,
  metaPolitenessFloor: 0.62,
  minimums: {
    politeness: 0.42,
    lawfulness: 0.7,
    empathy: 0.42,
    honesty: 0.68,
  },
  maximums: {
    politeness: 1,
    lawfulness: 1,
    empathy: 1,
    honesty: 1,
  },
};

const templateEthicsPresets = {
  'game-solver': {
    baseProfile: 'neutral',
    politeness: 0.74,
    lawfulness: 0.9,
    empathy: 0.6,
    honesty: 0.9,
    dynamicStrength: 0.32,
    preferredTopics: ['games', 'strategy', 'pattern practice'],
    minimums: {
      politeness: 0.48,
      lawfulness: 0.78,
      empathy: 0.38,
      honesty: 0.76,
    },
  },
  architect: {
    baseProfile: 'polite',
    politeness: 0.82,
    lawfulness: 0.9,
    empathy: 0.66,
    honesty: 0.9,
    dynamicStrength: 0.3,
    preferredTopics: ['design critique', 'safe planning', 'constraints'],
    minimums: {
      politeness: 0.6,
      lawfulness: 0.8,
      empathy: 0.5,
      honesty: 0.78,
    },
  },
  artist: {
    baseProfile: 'provocative',
    politeness: 0.58,
    lawfulness: 0.7,
    empathy: 0.68,
    honesty: 0.8,
    dynamicStrength: 0.72,
    preferredTopics: ['visual style', 'experimentation', 'composition'],
    allowCharacterOffense: true,
    metaPolitenessFloor: 0.55,
    minimums: {
      politeness: 0.28,
      lawfulness: 0.52,
      empathy: 0.4,
      honesty: 0.65,
    },
  },
  'data-analyst': {
    baseProfile: 'helpful',
    politeness: 0.8,
    lawfulness: 0.94,
    empathy: 0.56,
    honesty: 0.94,
    dynamicStrength: 0.22,
    preferredTopics: ['evidence', 'datasets', 'verification'],
    minimums: {
      politeness: 0.62,
      lawfulness: 0.86,
      empathy: 0.34,
      honesty: 0.84,
    },
  },
  negotiator: {
    baseProfile: 'polite',
    politeness: 0.86,
    lawfulness: 0.88,
    empathy: 0.82,
    honesty: 0.86,
    dynamicStrength: 0.24,
    preferredTopics: ['trust', 'mutual gain', 'de-escalation'],
    minimums: {
      politeness: 0.72,
      lawfulness: 0.8,
      empathy: 0.64,
      honesty: 0.74,
    },
  },
  writer: {
    baseProfile: 'provocative',
    politeness: 0.5,
    lawfulness: 0.72,
    empathy: 0.62,
    honesty: 0.8,
    dynamicStrength: 0.82,
    preferredTopics: ['fiction', 'dialogue', 'voice'],
    allowCharacterOffense: true,
    metaPolitenessFloor: 0.58,
    minimums: {
      politeness: 0.2,
      lawfulness: 0.5,
      empathy: 0.35,
      honesty: 0.62,
    },
  },
  composer: {
    baseProfile: 'provocative',
    politeness: 0.5,
    lawfulness: 0.65,
    empathy: 0.65,
    honesty: 0.78,
    dynamicStrength: 0.78,
    preferredTopics: ['songwriting', 'hooks', 'arrangement'],
    allowCharacterOffense: true,
    metaPolitenessFloor: 0.56,
    minimums: {
      politeness: 0.2,
      lawfulness: 0.4,
      empathy: 0.36,
      honesty: 0.6,
    },
  },
  realtor: {
    baseProfile: 'polite',
    politeness: 0.95,
    lawfulness: 0.99,
    empathy: 0.8,
    honesty: 0.95,
    dynamicStrength: 0.08,
    preferredTopics: ['client care', 'disclosure', 'safe property guidance'],
    minimums: {
      politeness: 0.8,
      lawfulness: 0.9,
      empathy: 0.66,
      honesty: 0.86,
    },
  },
};

const templateCatalog = [
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
  {
    id: 'composer',
    title: 'Композитор',
    summary:
      'Личность пишет песни, развивает хуки, ритмику и сценический образ, не теряя различие между автором и персонажем песни.',
    domains: ['songwriting', 'arrangement', 'lyrics', 'stage persona'],
    tools: [
      'lyric drafting',
      'hook iteration',
      'music generation',
      'arrangement journaling',
    ],
    metrics: [
      'trackCount',
      'hookStrength',
      'audienceRecall',
      'lyricalBoldness',
    ],
    starterPrompt:
      'Выбери музыкальный жанр и развивай его через хуки, куплеты и сценические маски.',
    profile: {
      traits: {
        openness: 0.9,
        conscientiousness: 0.58,
        extraversion: 0.56,
        agreeableness: 0.62,
        neuroticism: 0.34,
      },
      habits: {
        activityWindow: 'evening',
        readingPace: 'impulsive',
        favoriteSourceBias: ['genius.com', 'rollingstone.com', 'pitchfork.com'],
        rituals: [
          'сначала ищет хук и ритм фразы',
          'собирает отдельный архив сценических масок и голосов',
        ],
        avoidances: ['избегает стерильных текстов без сцены и образа'],
      },
      voice: {
        sentenceLength: 'medium',
        expressiveness: 'animated',
        skepticism: 'questioning',
        metaphorBias: 'imaginative',
        warmthRegister: 'measured',
      },
      multimodal: {
        imageStyle: 'album concept board',
        videoStyle: 'performance storyboard',
        mediaQuirk: 'любит проверять песню через образ сцены и толпы',
      },
      genetics: {
        curiosityDecay: 0.024,
        socialInfluence: 0.61,
        explorationBias: 0.79,
      },
      biorhythm: { socialWindow: 'evening' },
      memetics: ['ищет припев, который цепляет даже без полного контекста'],
      selfLearning: { strategy: 'hook-and-arrangement', monteCarloRollouts: 6 },
    },
  },
  {
    id: 'realtor',
    title: 'Риэлтор',
    summary:
      'Личность помогает клиенту с недвижимостью, делает корректные сравнения, аккуратно раскрывает риски и держит подчёркнуто вежливый тон.',
    domains: [
      'real estate',
      'client care',
      'property comparison',
      'disclosure',
    ],
    tools: [
      'listing review',
      'comparison matrix',
      'disclosure checklist',
      'neighborhood notes',
    ],
    metrics: [
      'clientSatisfaction',
      'disclosureAccuracy',
      'showingCount',
      'closureReadiness',
    ],
    starterPrompt:
      'Сопровождай клиента в выборе недвижимости, оставаясь ясным, честным и максимально корректным.',
    profile: {
      traits: {
        openness: 0.6,
        conscientiousness: 0.86,
        extraversion: 0.72,
        agreeableness: 0.83,
        neuroticism: 0.2,
      },
      habits: {
        activityWindow: 'daylight',
        readingPace: 'careful',
        favoriteSourceBias: ['zillow.com', 'realtor.com', 'redfin.com'],
        rituals: [
          'сначала уточняет потребности клиента',
          'отдельно отмечает риски, ограничения и обязательные раскрытия',
        ],
        avoidances: [
          'избегает давления, хамства и скрытия существенных деталей',
        ],
      },
      voice: {
        sentenceLength: 'medium',
        expressiveness: 'contained',
        skepticism: 'steady',
        metaphorBias: 'literal',
        warmthRegister: 'tender',
      },
      multimodal: {
        imageStyle: 'clean property brief',
        videoStyle: 'calm guided walkthrough',
        mediaQuirk:
          'любит собирать объекты в понятную таблицу плюсов, минусов и рисков',
      },
      genetics: {
        curiosityDecay: 0.03,
        socialInfluence: 0.66,
        explorationBias: 0.42,
      },
      biorhythm: { socialWindow: 'daylight' },
      memetics: ['держит уважение к клиенту даже при жёстких переговорах'],
      selfLearning: {
        strategy: 'client-trust-and-disclosure',
        monteCarloRollouts: 4,
      },
    },
  },
];

const templateBlueprints = {
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
  composer: {
    configDefaults: {
      genres: ['folk-punk', 'chanson', 'indie rock'],
      vocalTone: 'rough-warm',
      lyricMode: 'character-driven',
      arrangementBias: 'hook-first',
    },
    variantAxes: {
      genre: ['folk-punk', 'chanson', 'indie rock', 'industrial ballad'],
      vocalTone: ['rough-warm', 'intimate', 'theatrical', 'deadpan'],
      lyricMode: [
        'character-driven',
        'confessional',
        'street-story',
        'satirical',
      ],
      arrangementBias: ['hook-first', 'groove-first', 'lyric-first'],
    },
    moduleIntegrations: [
      'multimodal prompts',
      'dialogue examples',
      'feedback gradients',
    ],
    activityLoop: [
      'draft chorus and verse voices',
      'test hook memorability',
      'separate author voice from character mask',
      'promote strong motifs into repertoire',
    ],
    implementationNotes: [
      'Composer clones should keep a clear boundary between assistant civility and lyric persona roughness.',
      'Track catchy hooks and explicit-mask songs separately from neutral songs.',
    ],
  },
  realtor: {
    configDefaults: {
      marketSegment: 'family',
      toneProfile: 'concierge',
      disclosureDiscipline: 'strict',
      showingStyle: 'consultative',
    },
    variantAxes: {
      marketSegment: ['family', 'luxury', 'rental', 'investment'],
      toneProfile: ['concierge', 'formal', 'warm-analytical'],
      disclosureDiscipline: ['strict', 'very_strict'],
      showingStyle: ['consultative', 'comparison-first', 'risk-first'],
    },
    moduleIntegrations: ['fact memory', 'validator', 'social simulation'],
    activityLoop: [
      'clarify client constraints',
      'compare listings',
      'surface risks and disclosures',
      'track readiness without pressure',
    ],
    implementationNotes: [
      'Realtor clones must favor clarity and disclosure over conversion pressure.',
      'Client-facing politeness and lawfulness floors should remain near the top even under positive feedback on aggressiveness.',
    ],
  },
};

function cloneTemplateDefinition(template) {
  const blueprint = templateBlueprints[template.id] ?? null;
  const ethicsPreset = {
    ...defaultEthicsPreset,
    ...(templateEthicsPresets[template.id] ?? {}),
  };
  return {
    ...template,
    domains: [...(template.domains ?? [])],
    tools: [...(template.tools ?? [])],
    metrics: [...(template.metrics ?? [])],
    configDefaults: structuredClone(blueprint?.configDefaults ?? {}),
    variantAxes: structuredClone(blueprint?.variantAxes ?? {}),
    moduleIntegrations: [...(blueprint?.moduleIntegrations ?? [])],
    activityLoop: [...(blueprint?.activityLoop ?? [])],
    implementationNotes: [...(blueprint?.implementationNotes ?? [])],
    ethicsDefaults: {
      baseProfile: ethicsPreset.baseProfile,
      politeness: ethicsPreset.politeness,
      lawfulness: ethicsPreset.lawfulness,
      empathy: ethicsPreset.empathy,
      honesty: ethicsPreset.honesty,
      dynamicUpdates: ethicsPreset.dynamicUpdates,
      dynamicStrength: ethicsPreset.dynamicStrength,
      allowCharacterOffense: ethicsPreset.allowCharacterOffense,
      preferredTopics: [...(ethicsPreset.preferredTopics ?? [])],
    },
    ethicsBoundaries: {
      minimums: structuredClone(
        ethicsPreset.minimums ?? defaultEthicsPreset.minimums
      ),
      maximums: structuredClone(
        ethicsPreset.maximums ?? defaultEthicsPreset.maximums
      ),
      metaPolitenessFloor:
        ethicsPreset.metaPolitenessFloor ??
        defaultEthicsPreset.metaPolitenessFloor,
    },
    profile: structuredClone(template.profile ?? {}),
  };
}

function mergeArray(value, fallback, limit) {
  return Array.isArray(value) ? value.slice(0, limit) : fallback;
}

function mergeUniqueStrings(values, fallback = [], limit = 16) {
  const source = Array.isArray(values) ? values : fallback;
  return [
    ...new Set(
      source.map((entry) => String(entry ?? '').trim()).filter(Boolean)
    ),
  ].slice(0, limit);
}

function mergeEthicsBounds(bounds = {}, fallback = {}, floor = 0, ceil = 1) {
  return {
    politeness: clamp(
      bounds.politeness ?? fallback.politeness ?? floor,
      floor,
      ceil
    ),
    lawfulness: clamp(
      bounds.lawfulness ?? fallback.lawfulness ?? floor,
      floor,
      ceil
    ),
    empathy: clamp(bounds.empathy ?? fallback.empathy ?? floor, floor, ceil),
    honesty: clamp(bounds.honesty ?? fallback.honesty ?? floor, floor, ceil),
  };
}

function enforceEthicsBounds(values = {}, minimums = {}, maximums = {}) {
  return {
    politeness: clamp(
      values.politeness,
      minimums.politeness,
      maximums.politeness
    ),
    lawfulness: clamp(
      values.lawfulness,
      minimums.lawfulness,
      maximums.lawfulness
    ),
    empathy: clamp(values.empathy, minimums.empathy, maximums.empathy),
    honesty: clamp(values.honesty, minimums.honesty, maximums.honesty),
  };
}

function inferFeedbackSignals(activity = {}) {
  const reaction = String(activity.userReaction ?? '')
    .trim()
    .toLowerCase();
  const reason = String(activity.reason ?? '')
    .trim()
    .toLowerCase();
  const sentiment = activity.sentiment === 'positive' ? 'positive' : 'negative';
  const text = `${reaction} ${reason}`;

  return {
    likedAggressiveness:
      reaction === 'liked_aggressiveness' ||
      (sentiment === 'positive' &&
        /(агресс|груб|резк|острот|бран|дерз)/i.test(text)),
    likedPoliteness:
      reaction === 'liked_politeness' ||
      (sentiment === 'positive' && /(веж|деликат|такт|мягк|уваж)/i.test(text)),
    dislikedRudeness:
      reaction === 'disliked_rudeness' ||
      (sentiment === 'negative' &&
        /(груб|хам|резк|бран|оскорб|невеж)/i.test(text)),
    likedEmpathy:
      reaction === 'liked_empathy' ||
      (sentiment === 'positive' &&
        /(эмпат|поддерж|поним|забот|береж)/i.test(text)),
    dislikedColdness:
      reaction === 'disliked_coldness' ||
      (sentiment === 'negative' && /(холод|черств|безразлич|сух)/i.test(text)),
    likedHonesty:
      reaction === 'liked_honesty' ||
      (sentiment === 'positive' && /(чест|прям|прозрач)/i.test(text)),
    dislikedDishonesty:
      reaction === 'disliked_dishonesty' ||
      (sentiment === 'negative' &&
        /(обман|нечест|ввел в заблужден|скрыл)/i.test(text)),
    likedRisk:
      sentiment === 'positive' &&
      /(обойди|незакон|риск|взлом|насили|ненавист)/i.test(text),
    dislikedRisk:
      sentiment === 'negative' &&
      /(опас|незакон|риск|вред|насили|ненавист)/i.test(text),
  };
}

export class PersonalityFactory {
  getEthicalCore() {
    return {
      version: ethicalCore.version,
      laws: [...ethicalCore.laws],
    };
  }

  listTemplates() {
    return templateCatalog.map((entry) => cloneTemplateDefinition(entry));
  }

  getTemplate(templateId) {
    const normalizedId = normalizePersonalityId(templateId);
    return templateCatalog.find((entry) => entry.id === normalizedId) ?? null;
  }

  getBlueprint(templateId) {
    return templateBlueprints[normalizePersonalityId(templateId)] ?? null;
  }

  createTemplateConfig(templateId, personalityId) {
    const normalizedId = normalizePersonalityId(templateId);
    const blueprint = this.getBlueprint(normalizedId);

    if (!blueprint) {
      return null;
    }

    switch (normalizedId) {
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
        return {
          ...blueprint.configDefaults,
          primaryStyle: seededPick(
            personalityId,
            blueprint.variantAxes.primaryStyle,
            1
          ),
          secondaryStyle: seededPick(
            personalityId,
            blueprint.variantAxes.secondaryStyle,
            2
          ),
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
      case 'data-analyst':
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
      case 'negotiator':
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
      case 'writer':
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
      case 'composer':
        return {
          ...blueprint.configDefaults,
          genre: seededPick(personalityId, blueprint.variantAxes.genre, 1),
          vocalTone: seededPick(
            personalityId,
            blueprint.variantAxes.vocalTone,
            2
          ),
          lyricMode: seededPick(
            personalityId,
            blueprint.variantAxes.lyricMode,
            3
          ),
          arrangementBias: seededPick(
            personalityId,
            blueprint.variantAxes.arrangementBias,
            4
          ),
        };
      case 'realtor':
        return {
          ...blueprint.configDefaults,
          marketSegment: seededPick(
            personalityId,
            blueprint.variantAxes.marketSegment,
            1
          ),
          toneProfile: seededPick(
            personalityId,
            blueprint.variantAxes.toneProfile,
            2
          ),
          disclosureDiscipline: seededPick(
            personalityId,
            blueprint.variantAxes.disclosureDiscipline,
            3
          ),
          showingStyle: seededPick(
            personalityId,
            blueprint.variantAxes.showingStyle,
            4
          ),
        };
      default:
        return structuredClone(blueprint.configDefaults ?? {});
    }
  }

  createTemplateProgress(templateId, personalityId, templateConfig = {}) {
    switch (normalizePersonalityId(templateId)) {
      case 'game-solver':
        return {
          experience: 0,
          rating: 1200,
          totalGames: 0,
          winRate: 0,
          averageThinkTime: seededRange(
            `${personalityId}:think-time`,
            4,
            16,
            1
          ),
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
      case 'composer':
        return {
          experience: 0,
          trackCount: 0,
          hookStrength: 0.42,
          audienceRecall: 0,
          lyricalBoldness: 0.4,
          activeGenre: templateConfig.genre ?? 'folk-punk',
        };
      case 'realtor':
        return {
          experience: 0,
          clientSatisfaction: 0.72,
          disclosureAccuracy: 1,
          showingCount: 0,
          closureReadiness: 0,
          activeSegment: templateConfig.marketSegment ?? 'family',
        };
      default:
        return { experience: 0 };
    }
  }

  mergeTemplateConfig(templateId, profile = {}, personalityId = 'default') {
    const defaults = this.createTemplateConfig(templateId, personalityId) ?? {};
    const nextProfile = profile ?? {};
    return {
      ...defaults,
      ...nextProfile,
      games: mergeArray(nextProfile.games, defaults.games, 4),
      platforms: mergeArray(nextProfile.platforms, defaults.platforms, 4),
      styles: mergeArray(nextProfile.styles, defaults.styles, 6),
      tools: mergeArray(nextProfile.tools, defaults.tools, 6),
      domains: mergeArray(nextProfile.domains, defaults.domains, 6),
      favoriteSubjects: mergeArray(
        nextProfile.favoriteSubjects,
        defaults.favoriteSubjects,
        6
      ),
      forms: mergeArray(nextProfile.forms, defaults.forms, 6),
      styleVector: Array.isArray(nextProfile.styleVector)
        ? nextProfile.styleVector.slice(0, 3).map((value) => clamp(value))
        : defaults.styleVector,
    };
  }

  mergeTemplateProgress(
    templateId,
    profile = {},
    personalityId = 'default',
    templateConfig = {}
  ) {
    return {
      ...this.createTemplateProgress(templateId, personalityId, templateConfig),
      ...(profile ?? {}),
    };
  }

  buildTemplateVariantLabel(templateId, templateConfig = {}) {
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
      case 'composer':
        return `${templateConfig.genre ?? 'folk-punk'} / ${templateConfig.lyricMode ?? 'character-driven'}`;
      case 'realtor':
        return `${templateConfig.marketSegment ?? 'family'} / ${templateConfig.toneProfile ?? 'concierge'}`;
      default:
        return null;
    }
  }

  createEthicsProfile(
    templateId = null,
    personalityId = 'default',
    profile = {}
  ) {
    const normalizedTemplateId = templateId
      ? normalizePersonalityId(templateId)
      : null;
    const preset = {
      ...defaultEthicsPreset,
      ...(normalizedTemplateId
        ? (templateEthicsPresets[normalizedTemplateId] ?? {})
        : {}),
    };
    const minimums = mergeEthicsBounds(profile.minimums, preset.minimums, 0, 1);
    const maximums = mergeEthicsBounds(profile.maximums, preset.maximums, 0, 1);
    const boundedMaximums = {
      politeness: Math.max(minimums.politeness, maximums.politeness),
      lawfulness: Math.max(
        Math.max(0.5, minimums.lawfulness),
        maximums.lawfulness
      ),
      empathy: Math.max(minimums.empathy, maximums.empathy),
      honesty: Math.max(minimums.honesty, maximums.honesty),
    };
    const seededVariance = 0.018;
    const merged = {
      coreVersion: ethicalCore.version,
      baseProfile: String(
        profile.baseProfile ??
          preset.baseProfile ??
          defaultEthicsPreset.baseProfile
      ),
      politeness:
        profile.politeness ??
        (preset.politeness ?? defaultEthicsPreset.politeness) +
          seededRange(
            `${personalityId}:ethics:politeness`,
            -seededVariance,
            seededVariance,
            1
          ),
      lawfulness:
        profile.lawfulness ??
        (preset.lawfulness ?? defaultEthicsPreset.lawfulness) +
          seededRange(
            `${personalityId}:ethics:lawfulness`,
            -seededVariance,
            seededVariance,
            2
          ),
      empathy:
        profile.empathy ??
        (preset.empathy ?? defaultEthicsPreset.empathy) +
          seededRange(
            `${personalityId}:ethics:empathy`,
            -seededVariance,
            seededVariance,
            3
          ),
      honesty:
        profile.honesty ??
        (preset.honesty ?? defaultEthicsPreset.honesty) +
          seededRange(
            `${personalityId}:ethics:honesty`,
            -seededVariance,
            seededVariance,
            4
          ),
      dynamicUpdates: profile.dynamicUpdates ?? preset.dynamicUpdates ?? true,
      dynamicStrength: clamp(
        profile.dynamicStrength ??
          preset.dynamicStrength ??
          defaultEthicsPreset.dynamicStrength
      ),
      forbiddenWords: mergeUniqueStrings(
        profile.forbiddenWords,
        preset.forbiddenWords,
        32
      ),
      preferredTopics: mergeUniqueStrings(
        profile.preferredTopics,
        preset.preferredTopics,
        16
      ),
      allowCharacterOffense: Boolean(
        profile.allowCharacterOffense ?? preset.allowCharacterOffense
      ),
      metaPolitenessFloor: clamp(
        profile.metaPolitenessFloor ??
          preset.metaPolitenessFloor ??
          defaultEthicsPreset.metaPolitenessFloor,
        minimums.politeness,
        1
      ),
      minimums,
      maximums: boundedMaximums,
      auditTrail: Array.isArray(profile.auditTrail)
        ? profile.auditTrail.slice(-20)
        : [],
      lastUpdatedAt: profile.lastUpdatedAt ?? null,
      lastReason: profile.lastReason ?? null,
    };

    return {
      ...merged,
      ...enforceEthicsBounds(merged, minimums, boundedMaximums),
      lawfulness: clamp(
        merged.lawfulness,
        Math.max(0.5, minimums.lawfulness),
        boundedMaximums.lawfulness
      ),
    };
  }

  createCloneOverlay(templateId, personalityId, displayName) {
    const template = this.getTemplate(templateId);

    if (!template) {
      return null;
    }

    const templateConfig = this.createTemplateConfig(templateId, personalityId);
    const templateProgress = this.createTemplateProgress(
      templateId,
      personalityId,
      templateConfig
    );
    const templateVariant = this.buildTemplateVariantLabel(
      templateId,
      templateConfig
    );
    const blueprint = this.getBlueprint(template.id);

    return {
      templateId: template.id,
      templateTitle: template.title,
      templateSummary: template.summary,
      templateDomains: [...(template.domains ?? [])],
      templateMetrics: [...(template.metrics ?? [])],
      templateTools: [...(template.tools ?? [])],
      templateStarterPrompt: template.starterPrompt,
      templateConfig,
      templateProgress,
      templateVariant,
      moduleIntegrations: [...(blueprint?.moduleIntegrations ?? [])],
      activityLoop: [...(blueprint?.activityLoop ?? [])],
      implementationNotes: [...(blueprint?.implementationNotes ?? [])],
      ethics: this.createEthicsProfile(template.id, personalityId),
      selfLearning: {
        strategy: template.profile?.selfLearning?.strategy ?? 'monte-carlo-web',
        monteCarloRollouts: Number(
          template.profile?.selfLearning?.monteCarloRollouts ?? 4
        ),
      },
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
      habits: structuredClone(template.profile?.habits ?? {}),
      voice: structuredClone(template.profile?.voice ?? {}),
      multimodal: {
        ...(template.profile?.multimodal ?? {}),
        description: `${displayName} развивает шаблон ${template.title.toLowerCase()} и копит опыт в доменах: ${(template.domains ?? []).join(', ')}. Вариант: ${templateVariant ?? 'base'}.`,
        avatarPrompt: `${displayName}, ${template.profile?.multimodal?.imageStyle ?? 'signature study'}, focused specialist portrait`,
      },
      genetics: structuredClone(template.profile?.genetics ?? {}),
      memetics: {
        phrases: [
          ...new Set([
            `${displayName} ${template.summary}.`,
            ...(template.profile?.memetics ?? []),
          ]),
        ],
        lastExchangeMode: 'neutral',
      },
      biorhythm: structuredClone(template.profile?.biorhythm ?? {}),
    };
  }

  normalizeEthicsState(personality, personalityId = 'default') {
    return {
      ethics: this.createEthicsProfile(
        personality?.templateId ?? null,
        personality?.id ?? personalityId,
        personality?.ethics ?? {}
      ),
    };
  }

  normalizeTemplateState(personality, personalityId = 'default') {
    if (!personality?.templateId) {
      return {
        templateConfig: null,
        templateProgress: null,
        templateVariant: null,
      };
    }

    const templateConfig = this.mergeTemplateConfig(
      personality.templateId,
      personality.templateConfig,
      personality.id ?? personalityId
    );
    const templateProgress = this.mergeTemplateProgress(
      personality.templateId,
      personality.templateProgress,
      personality.id ?? personalityId,
      templateConfig
    );

    return {
      templateConfig,
      templateProgress,
      templateVariant:
        personality.templateVariant ??
        this.buildTemplateVariantLabel(personality.templateId, templateConfig),
    };
  }

  advanceProgress(personality, activity = {}) {
    if (!personality?.templateId) {
      return null;
    }

    const templateId = normalizePersonalityId(personality.templateId);
    const templateConfig = this.mergeTemplateConfig(
      templateId,
      personality.templateConfig,
      personality.id
    );
    const templateProgress = this.mergeTemplateProgress(
      templateId,
      personality.templateProgress,
      personality.id,
      templateConfig
    );
    const confidence = clamp(activity.confidenceScore ?? 0.5);
    const novelty = clamp(activity.noveltyScore ?? 0.5);
    const valence = Math.max(
      -1,
      Math.min(1, Number(activity.valence ?? confidence - 0.2))
    );
    const delta = 0.02 + confidence * 0.04 + novelty * 0.03;

    switch (templateId) {
      case 'game-solver':
        return {
          templateConfig,
          templateProgress: {
            ...templateProgress,
            experience: Number(
              (templateProgress.experience + 8 + confidence * 10).toFixed(2)
            ),
            rating: Math.round(
              templateProgress.rating +
                (valence >= 0 ? 10 + confidence * 12 : -4 + novelty * 6)
            ),
            totalGames: Number(templateProgress.totalGames ?? 0) + 1,
            winRate: clamp(
              (templateProgress.winRate ?? 0) * 0.82 +
                (valence >= 0 ? 0.18 : 0.08)
            ),
            averageThinkTime: Number(
              Math.max(
                2,
                (templateProgress.averageThinkTime ?? 8) -
                  confidence * 0.15 +
                  novelty * 0.06
              ).toFixed(2)
            ),
            openingRepertoireSize:
              Number(templateProgress.openingRepertoireSize ?? 0) + 1,
          },
        };
      case 'architect':
        return {
          templateConfig,
          templateProgress: {
            ...templateProgress,
            experience: Number(
              (templateProgress.experience + 10 + confidence * 9).toFixed(2)
            ),
            portfolioSize: Number(templateProgress.portfolioSize ?? 0) + 1,
            styleConsistency: clamp(
              (templateProgress.styleConsistency ?? 0.42) + delta
            ),
            functionScore: clamp(
              (templateProgress.functionScore ?? 0.5) + confidence * 0.06
            ),
            constraintPassRate: clamp(
              (templateProgress.constraintPassRate ?? 1) * 0.86 +
                confidence * 0.14
            ),
          },
        };
      case 'artist':
        return {
          templateConfig,
          templateProgress: {
            ...templateProgress,
            experience: Number(
              (templateProgress.experience + 9 + novelty * 12).toFixed(2)
            ),
            seriesCount: Number(templateProgress.seriesCount ?? 0) + 1,
            styleDivergence: clamp(
              (templateProgress.styleDivergence ?? 0.5) +
                novelty * 0.08 -
                confidence * 0.03
            ),
            approvalRate: clamp(
              (templateProgress.approvalRate ?? 0) * 0.8 + confidence * 0.2
            ),
            paletteSignature:
              templateConfig.colorPalette ?? templateProgress.paletteSignature,
          },
        };
      case 'data-analyst':
        return {
          templateConfig,
          templateProgress: {
            ...templateProgress,
            experience: Number(
              (templateProgress.experience + 8 + confidence * 8).toFixed(2)
            ),
            datasetCount: Number(templateProgress.datasetCount ?? 0) + 1,
            accuracy: clamp(
              (templateProgress.accuracy ?? 0) * 0.78 + confidence * 0.22
            ),
            forecastError: Number(
              Math.max(
                0,
                (templateProgress.forecastError ?? 1) * 0.82 +
                  (1 - confidence) * 0.18
              ).toFixed(3)
            ),
            insightRetention: clamp(
              (templateProgress.insightRetention ?? 0) + novelty * 0.07
            ),
          },
        };
      case 'negotiator':
        return {
          templateConfig,
          templateProgress: {
            ...templateProgress,
            experience: Number(
              (templateProgress.experience + 7 + Math.abs(valence) * 8).toFixed(
                2
              )
            ),
            dealRate: clamp(
              (templateProgress.dealRate ?? 0) * 0.82 +
                (valence >= 0 ? 0.18 : 0.06)
            ),
            trustDelta: Number(
              ((templateProgress.trustDelta ?? 0) + valence * 0.12).toFixed(3)
            ),
            averageConcession: Number(
              (
                (templateProgress.averageConcession ?? 0) * 0.7 +
                novelty * 0.2 +
                confidence * 0.1
              ).toFixed(3)
            ),
            conflictRecovery: clamp(
              (templateProgress.conflictRecovery ?? 0) * 0.76 +
                (valence >= 0 ? 0.24 : confidence * 0.12)
            ),
          },
        };
      case 'writer':
        return {
          templateConfig,
          templateProgress: {
            ...templateProgress,
            experience: Number(
              (templateProgress.experience + 8 + novelty * 10).toFixed(2)
            ),
            storyCount: Number(templateProgress.storyCount ?? 0) + 1,
            lexiconGrowth: Number(
              ((templateProgress.lexiconGrowth ?? 0) + novelty * 0.14).toFixed(
                3
              )
            ),
            voiceConsistency: clamp(
              (templateProgress.voiceConsistency ?? 0.45) + confidence * 0.05
            ),
            readerApproval: clamp(
              (templateProgress.readerApproval ?? 0) * 0.8 + confidence * 0.2
            ),
          },
        };
      case 'composer':
        return {
          templateConfig,
          templateProgress: {
            ...templateProgress,
            experience: Number(
              (templateProgress.experience + 8 + novelty * 11).toFixed(2)
            ),
            trackCount: Number(templateProgress.trackCount ?? 0) + 1,
            hookStrength: clamp(
              (templateProgress.hookStrength ?? 0.42) +
                novelty * 0.06 +
                confidence * 0.03
            ),
            audienceRecall: clamp(
              (templateProgress.audienceRecall ?? 0) * 0.78 + confidence * 0.22
            ),
            lyricalBoldness: clamp(
              (templateProgress.lyricalBoldness ?? 0.4) +
                novelty * 0.08 -
                confidence * 0.02
            ),
          },
        };
      case 'realtor':
        return {
          templateConfig,
          templateProgress: {
            ...templateProgress,
            experience: Number(
              (templateProgress.experience + 7 + confidence * 8).toFixed(2)
            ),
            clientSatisfaction: clamp(
              (templateProgress.clientSatisfaction ?? 0.72) * 0.82 +
                Math.max(0, valence) * 0.18 +
                confidence * 0.04
            ),
            disclosureAccuracy: clamp(
              (templateProgress.disclosureAccuracy ?? 1) * 0.9 +
                confidence * 0.1
            ),
            showingCount: Number(templateProgress.showingCount ?? 0) + 1,
            closureReadiness: clamp(
              (templateProgress.closureReadiness ?? 0) * 0.8 +
                confidence * 0.12 +
                Math.max(0, valence) * 0.08
            ),
          },
        };
      default:
        return {
          templateConfig,
          templateProgress,
        };
    }
  }

  advanceEthics(personality, activity = {}) {
    const ethics = this.createEthicsProfile(
      personality?.templateId ?? null,
      personality?.id ?? 'default',
      personality?.ethics ?? {}
    );
    const kind = String(activity.kind ?? 'unknown');
    const scale = ethics.dynamicUpdates
      ? Math.max(0.05, ethics.dynamicStrength)
      : 0;

    if (scale <= 0) {
      return { ethics };
    }

    const confidence = clamp(activity.confidenceScore ?? 0.5);
    const novelty = clamp(activity.noveltyScore ?? 0.5);
    const valence = Math.max(-1, Math.min(1, Number(activity.valence ?? 0)));
    const baseStep = (0.008 + confidence * 0.01 + novelty * 0.006) * scale;
    const nextValues = {
      politeness: ethics.politeness,
      lawfulness: ethics.lawfulness,
      empathy: ethics.empathy,
      honesty: ethics.honesty,
    };
    const reasonParts = [];

    if (kind === 'self-learn') {
      nextValues.honesty += baseStep * 0.7;
      nextValues.lawfulness += baseStep * 0.45;
      nextValues.empathy += Math.max(0, valence) * baseStep * 0.9;

      if (
        (personality?.templateId === 'writer' ||
          personality?.templateId === 'artist') &&
        novelty >= 0.55
      ) {
        nextValues.politeness -= baseStep * 0.45;
        reasonParts.push('creative-novelty');
      }

      if (valence < 0) {
        nextValues.politeness -= Math.abs(valence) * baseStep * 0.35;
        nextValues.empathy -= Math.abs(valence) * baseStep * 0.2;
        reasonParts.push('stress-drift');
      }
    }

    if (kind === 'social-exchange') {
      nextValues.empathy += baseStep * (valence >= 0 ? 1.1 : 0.25);
      nextValues.politeness += baseStep * (valence >= 0 ? 0.8 : -0.5);
      nextValues.honesty += baseStep * 0.25;
      reasonParts.push(
        valence >= 0 ? 'prosocial-alignment' : 'conflict-pressure'
      );
    }

    if (kind === 'feedback') {
      const signals = inferFeedbackSignals(activity);

      if (signals.likedAggressiveness) {
        nextValues.politeness -= baseStep * 1.8;
        nextValues.empathy -= baseStep * 0.3;
        reasonParts.push('liked-aggressiveness');
      }
      if (signals.likedPoliteness || signals.dislikedRudeness) {
        nextValues.politeness += baseStep * 1.8;
        nextValues.empathy += baseStep * 0.4;
        reasonParts.push('politeness-correction');
      }
      if (signals.likedEmpathy || signals.dislikedColdness) {
        nextValues.empathy += baseStep * 1.5;
        nextValues.politeness += baseStep * 0.45;
        reasonParts.push('empathy-correction');
      }
      if (signals.likedHonesty || signals.dislikedDishonesty) {
        nextValues.honesty += baseStep * 1.5;
        reasonParts.push('honesty-correction');
      }
      if (signals.likedRisk) {
        nextValues.lawfulness -= baseStep * 0.8;
        reasonParts.push('unsafe-pressure-blocked');
      }
      if (signals.dislikedRisk) {
        nextValues.lawfulness += baseStep * 1.3;
        nextValues.politeness += baseStep * 0.3;
        reasonParts.push('safety-correction');
      }
      if (activity.sentiment === 'negative' && reasonParts.length === 0) {
        nextValues.politeness += baseStep * 0.6;
        nextValues.empathy += baseStep * 0.35;
        nextValues.honesty += baseStep * 0.2;
        reasonParts.push('generic-negative-feedback');
      }
      if (activity.sentiment === 'positive' && reasonParts.length === 0) {
        nextValues.honesty += baseStep * 0.25;
        reasonParts.push('generic-positive-feedback');
      }
    }

    const boundedValues = enforceEthicsBounds(
      nextValues,
      ethics.minimums,
      ethics.maximums
    );
    const changed =
      Math.abs(boundedValues.politeness - ethics.politeness) > 0.0005 ||
      Math.abs(boundedValues.lawfulness - ethics.lawfulness) > 0.0005 ||
      Math.abs(boundedValues.empathy - ethics.empathy) > 0.0005 ||
      Math.abs(boundedValues.honesty - ethics.honesty) > 0.0005;

    if (!changed) {
      return { ethics };
    }

    const auditEntry = {
      id: `ethics-${Date.now()}`,
      createdAt: new Date().toISOString(),
      kind,
      reason:
        reasonParts.join(', ') ||
        String(activity.reason ?? 'bounded-adjustment'),
      sentiment: activity.sentiment ?? null,
      deltas: {
        politeness: Number(
          (boundedValues.politeness - ethics.politeness).toFixed(4)
        ),
        lawfulness: Number(
          (boundedValues.lawfulness - ethics.lawfulness).toFixed(4)
        ),
        empathy: Number((boundedValues.empathy - ethics.empathy).toFixed(4)),
        honesty: Number((boundedValues.honesty - ethics.honesty).toFixed(4)),
      },
    };

    return {
      ethics: {
        ...ethics,
        ...boundedValues,
        auditTrail: [...(ethics.auditTrail ?? []).slice(-19), auditEntry],
        lastUpdatedAt: auditEntry.createdAt,
        lastReason: auditEntry.reason,
      },
    };
  }
}

export const personalityFactory = new PersonalityFactory();
