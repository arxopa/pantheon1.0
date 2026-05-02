import type {
  AgentProviderBlueprint,
  DeepLearningModel,
  LinguisticBlock,
  ProtocolStep,
  RepoIntegration,
  SystemBlock,
  TaskProfile,
  TraceEntry,
} from '../types/agent';

export const systemBlocks: SystemBlock[] = [
  {
    id: '01',
    name: 'Control Core',
    deity: 'Shiva',
    symbolism: 'Неизменяемый закон и центр управляющих инвариантов.',
    folder: 'server/core/',
    role: 'Неподвижный управляющий блок, который удерживает инварианты системы и решает, какие кластеры вообще могут существовать.',
    authority:
      'Единственный источник разрешений на добавление, удаление и временный перехват полномочий расчетного блока.',
    mutationPolicy:
      'Прямое изменение запрещено. Любая реструктуризация допускается только вручную, редко и с обязательным откатом.',
    interfaces: ['policy gate', 'cluster allocator', 'rollback ledger'],
  },
  {
    id: '02',
    name: 'Compute Core',
    deity: 'Shakti',
    symbolism:
      'Активная вычислительная сила, которая обучается и перестраивается.',
    folder: 'server/compute/',
    role: 'Самоадаптирующееся вычислительное ядро, которое строит, тестирует и перестраивает рабочие нейросетевые кластеры под текущую задачу.',
    authority:
      'Контролирует все блоки, кроме Control Core, и может предлагать его реструктуризацию через защищенный ручной канал.',
    mutationPolicy:
      'Перед изменением собственной архитектуры обязано запрашивать разрешение и передавать управление контрольному блоку на время теста.',
    interfaces: [
      'task decomposition',
      'cluster synthesis',
      'self-test sandbox',
    ],
  },
  {
    id: '03',
    name: 'Trace Sentinel',
    deity: 'Ganesha',
    symbolism: 'Наблюдатель, писец и приоритетный критик всех сбоев.',
    folder: 'server/trace/',
    role: 'Высокоприоритетный блок трассировки, логирования и триггеров, который фиксирует аномалии раньше бизнес-логики.',
    authority:
      'Имеет приоритет по триггерам, может останавливать тестовые циклы и маркировать опасные конфигурации.',
    mutationPolicy:
      'Изменяется только через Compute Core, но его критические правила приоритета защищены контролем инвариантов.',
    interfaces: ['event probes', 'fault snapshots', 'trigger priority bus'],
  },
];

export const deepLearningModel: DeepLearningModel = {
  name: 'Deep Self-Learning Mandala',
  objective:
    'Заложить в систему безопасный цикл глубинного самообучения, где сеть умеет накапливать опыт, критиковать собственные ошибки, обновлять стратегии и дистиллировать память без нарушения управляющих инвариантов.',
  doctrine:
    'Самообучение проходит через слои восприятия, смыслового кодирования, рефлексивной критики, контролируемого обновления и долговременной дистилляции памяти. Ни одно обновление не закрепляется без санкции Control Core и записи в Trace Sentinel.',
  stages: [
    {
      id: 'S1',
      name: 'Perception Layer',
      owner: 'Data Lila + Linguistic Mesh',
      goal: 'Собрать опыт из входов, ошибок, действий и внешних сигналов.',
      input: 'user input, tool output, runtime events',
      output: 'normalized experience packets',
      guard: 'Только очищенные и разрешенные данные переходят в обучение.',
    },
    {
      id: 'S2',
      name: 'Semantic Encoding Layer',
      owner: 'Compute Core',
      goal: 'Преобразовать опыт в латентные представления, признаки и гипотезы.',
      input: 'normalized experience packets',
      output: 'embeddings, hypotheses, confidence maps',
      guard: 'Кодирование идет в sandbox и не меняет policy напрямую.',
    },
    {
      id: 'S3',
      name: 'Reflective Critic Layer',
      owner: 'Trace Sentinel + Observer',
      goal: 'Найти деградацию, ошибки и паттерны, которые должны скорректировать обучение.',
      input: 'embeddings, traces, failures, memory recalls',
      output: 'critic reports, anomaly gradients, refactor signals',
      guard: 'Критический сигнал может остановить цикл и вызвать rollback.',
    },
    {
      id: 'S4',
      name: 'Controlled Update Layer',
      owner: 'Control Core + Compute Core',
      goal: 'Разрешить только допустимые обновления кластеров, стратегий и маршрутов.',
      input: 'critic reports, candidate updates',
      output: 'approved adaptation patches',
      guard: 'Без Shiva-gate изменения не закрепляются.',
    },
    {
      id: 'S5',
      name: 'Memory Distillation Layer',
      owner: 'Memory Ganga + Kali Reaper',
      goal: 'Закрепить полезное знание и удалить устаревший шум.',
      input: 'approved patches, retention policy',
      output: 'long-term memory shards, pruned stale memory',
      guard: 'Забывание идет по регламенту и не затрагивает управляющее ядро.',
    },
  ],
  loops: [
    {
      id: 'L1',
      name: 'Micro Backprop Loop',
      rhythm: 'на каждый диалоговый цикл',
      trigger: 'ошибка ответа, низкая уверенность, tool failure',
      result: 'локальная коррекция стратегии ответа и выбора инструментов',
    },
    {
      id: 'L2',
      name: 'Night Distillation Loop',
      rhythm: 'пакетно по расписанию',
      trigger: 'накопление новой памяти и trace-анализа',
      result:
        'сжатие памяти, пересборка эмбеддингов и обновление профилей кластеров',
    },
    {
      id: 'L3',
      name: 'Architectural Mutation Loop',
      rhythm: 'редко и только вручную',
      trigger: 'устойчивая деградация или новый класс задач',
      result:
        'кандидат на перестройку Compute Core или ручной review для Control Core',
    },
  ],
};

export const protocolSteps: ProtocolStep[] = [
  {
    step: 'Запрос',
    owner: 'Compute Core',
    action:
      'Формулирует изменение собственной архитектуры или состава кластера и прикладывает прогноз выгоды.',
    guard: 'Без signed intent пакет не рассматривается.',
  },
  {
    step: 'Заморозка',
    owner: 'Control Core',
    action:
      'Блокирует рискованные каналы и временно принимает управление функциями расчетного блока на период теста.',
    guard: 'Только ограниченное окно времени и только sandbox-маршрут.',
  },
  {
    step: 'Тест',
    owner: 'Trace Sentinel',
    action:
      'Отслеживает ошибки, деградацию, конфликт триггеров и формирует журнал аномалий с высшим приоритетом.',
    guard: 'Любой критический сигнал завершает тест с rollback.',
  },
  {
    step: 'Подтверждение',
    owner: 'Control Core',
    action:
      'Сверяет результаты теста с инвариантами и либо применяет изменение, либо возвращает старую конфигурацию.',
    guard: 'Решение фиксируется в rollback ledger.',
  },
];

export const taskProfiles: TaskProfile[] = [
  {
    id: 'analysis',
    task: 'Аналитика и планирование',
    topology: 'Граф рассуждений с малыми экспертными узлами',
    objective: 'Максимум качества решений при умеренной скорости.',
    controllerDecision:
      'Повышает вес policy-узлов и запрещает агрессивную самоперестройку.',
    computeDecision:
      'Собирает узлы вывода, памяти и оценивания в медленный, но устойчивый кластер.',
    traceFocus: 'Версионность гипотез, drift reasoning, конфликт правил.',
    clusterSet: ['planner mesh', 'memory lattice', 'critic ring'],
  },
  {
    id: 'realtime',
    task: 'Реакция в реальном времени',
    topology: 'Низколатентный стриминговый кластер',
    objective: 'Минимальная задержка и локальные автономные решения.',
    controllerDecision:
      'Дает приоритет каналам телеметрии и сокращает глубину маршрута принятия решений.',
    computeDecision:
      'Отбрасывает тяжелые слои, оставляя быстрые модели ранжирования и локальные кэши.',
    traceFocus: 'Потеря пакетов, лавина триггеров, перегрев каналов.',
    clusterSet: ['telemetry spine', 'ranking shards', 'cache relay'],
  },
  {
    id: 'recovery',
    task: 'Отладка и восстановление',
    topology: 'Диагностический кластер с зеркалированием состояния',
    objective: 'Быстрый поиск источника ошибки и безопасный откат.',
    controllerDecision:
      'Переводит систему в guarded mode и расширяет полномочия Trace Sentinel.',
    computeDecision:
      'Строит двойники проблемных контуров и проверяет гипотезы на изолированном стенде.',
    traceFocus: 'Каскадные ошибки, конфликт зависимостей, rollback debt.',
    clusterSet: ['mirror twin', 'fault lab', 'rollback proxy'],
  },
  {
    id: 'creation',
    task: 'Генерация новых архитектур',
    topology: 'Эволюционный кластер проектирования',
    objective: 'Выращивание новых блоков под незнакомые классы задач.',
    controllerDecision:
      'Ограничивает область роста новыми sandbox-контурами и требует полную телеметрию.',
    computeDecision:
      'Генерирует несколько вариантов архитектур, сравнивает их и выдвигает лучший в ручной review.',
    traceFocus:
      'Нестабильные связи, утечка ответственности, нарушение инвариантов.',
    clusterSet: ['synthesis garden', 'eval arena', 'mutation gate'],
  },
];

export const invariants = [
  'Control Core нельзя менять автоматически.',
  'Compute Core не может сам утвердить собственную реструктуризацию.',
  'Trace Sentinel всегда обрабатывает критические триггеры раньше остальных блоков.',
  'Каждое архитектурное изменение обязано иметь checkpoint и rollback plan.',
  'Ручная перестройка Control Core допускается только после проверяемого sandbox-прогона.',
];

export const architectureSignals = [
  '3 protected blocks',
  'manual rollback path',
  'task-driven topology',
  'priority trace bus',
  'linguistic cognition mesh',
  'deep self-learning mandala',
];

export const linguisticBlock: LinguisticBlock = {
  id: 'ling-01',
  name: 'Linguistic Mesh',
  mission:
    'Преобразует естественный язык в формальные намерения, сценарии действий, ограничения и сигналы handoff для остальных блоков системы.',
  policy:
    'Работает под управлением Compute Core, но все метаправила деэскалации, безопасности и критичных handoff проходят через Control Core и Trace Sentinel.',
  nodes: [
    {
      id: 'L1',
      name: 'Intent Parser',
      purpose:
        'Выделяет цели, ограничения, срочность и класс задачи из пользовательского запроса.',
      inputs: ['user utterance', 'session context'],
      outputs: ['intent graph', 'risk hints'],
    },
    {
      id: 'L2',
      name: 'Semantic Router',
      purpose:
        'Решает, какому кластеру или внешнему агентному рантайму передать задачу.',
      inputs: ['intent graph', 'provider registry'],
      outputs: ['handoff target', 'tool shortlist'],
    },
    {
      id: 'L3',
      name: 'Dialogue Memory',
      purpose:
        'Держит сжатую историю диалога и речевые якоря для многошаговых цепочек.',
      inputs: ['conversation events', 'trace markers'],
      outputs: ['memory slice', 'context pack'],
    },
    {
      id: 'L4',
      name: 'Response Synthesizer',
      purpose:
        'Собирает ответ из результатов инструментов, подагентов и правил стиля.',
      inputs: ['tool output', 'handoff output', 'policy constraints'],
      outputs: ['final answer', 'confidence band'],
    },
  ],
  capabilities: [
    {
      label: 'Intent decomposition',
      detail:
        'Разбивает запрос на цель, ограничения, приоритет и нужный вид рассуждения.',
    },
    {
      label: 'Semantic routing',
      detail:
        'Выбирает между локальным кластером, handoff-агентом и tool-first pipeline.',
    },
    {
      label: 'Session compression',
      detail:
        'Сжимает историю для длинных диалогов без потери управляющих сигналов.',
    },
    {
      label: 'Policy-aware generation',
      detail:
        'Формирует ответ с учетом ограничений Control Core и тревог Trace Sentinel.',
    },
  ],
};

export const repoIntegrations: RepoIntegration[] = [
  {
    id: 'openai-agents',
    name: 'OpenAI Agents JS',
    repository: 'openai/openai-agents-js',
    runtimeKind: 'handoff-runtime',
    role: 'Основной handoff-рантайм для иерархии агентов, tool approvals, lifecycle hooks и realtime-сценариев.',
    whyFits:
      'Подходит под вашу схему Control Core → Compute Core → specialist agents, потому что имеет нативные handoffs, lifecycle events и session/runtime orchestration.',
    npmPackages: ['@openai/agents', 'zod'],
    envKeys: ['VITE_OPENAI_API_KEY'],
    capabilities: [
      'agent handoffs',
      'tool lifecycle',
      'session memory',
      'realtime session',
    ],
    limits: ['Требует ключ API', 'Полноценный runtime нужен после npm install'],
  },
  {
    id: 'langchain',
    name: 'LangChain JS',
    repository: 'langchain-ai/langchainjs',
    runtimeKind: 'tool-runtime',
    role: 'Резервный tool-oriented рантайм для динамического отбора инструментов, structured output и ReAct-маршрутов.',
    whyFits:
      'Подходит для Semantic Router и Linguistic Mesh, потому что дает createAgent, middleware и динамический выбор инструментов по контексту.',
    npmPackages: ['optional: langchain', 'optional: @langchain/openai', 'zod'],
    envKeys: ['VITE_OPENAI_API_KEY'],
    capabilities: [
      'dynamic tools',
      'structured output',
      'middleware routing',
      'ReAct agent',
    ],
    limits: [
      'В этом репо используется встроенный adapter без обязательной установки пакетов',
      'Browser-конфиг нужно держать минимальным',
    ],
  },
];

export const providerBlueprints: AgentProviderBlueprint[] = [
  {
    id: 'openai-agents',
    providerName: 'OpenAI Agents JS',
    orchestrationStyle: 'handoff graph with guarded specialist escalation',
    linguisticStrategy:
      'Intent Parser -> Semantic Router -> handoff to specialist agent',
    traceStrategy:
      'lifecycle hooks + tool events + manual approval checkpoints',
    bootstrapSteps: [
      'Инициализировать control, compute и linguistic agents.',
      'Зарегистрировать handoffs и tool approvals.',
      'Подключить Trace Sentinel к lifecycle hooks.',
    ],
  },
  {
    id: 'langchain',
    providerName: 'LangChain JS',
    orchestrationStyle: 'tool-first ReAct loop with middleware filtering',
    linguisticStrategy:
      'Semantic Router ограничивает набор инструментов под задачу',
    traceStrategy: 'middleware logging + structured output validation',
    bootstrapSteps: [
      'Создать tool catalog для языкового блока.',
      'Добавить middleware отбора инструментов.',
      'Подключить structured output для контрольных решений.',
    ],
  },
];

export const baseTraceEntries: TraceEntry[] = [
  {
    id: 'boot-1',
    level: 'info',
    message: '[invariant] control core remains immutable by default',
  },
  {
    id: 'boot-2',
    level: 'info',
    message: '[cluster] adaptive registry synced with controller policy',
  },
  {
    id: 'boot-3',
    level: 'warn',
    message: '[review] manual redesign path is locked until operator approval',
  },
  {
    id: 'boot-4',
    level: 'info',
    message: '[mandala] deep self-learning loop initialized in guarded mode',
  },
];
