export type SystemBlock = {
  id: string;
  name: string;
  deity?: string;
  symbolism?: string;
  folder?: string;
  role: string;
  authority: string;
  mutationPolicy: string;
  interfaces: string[];
};

export type DeepLearningStage = {
  id: string;
  name: string;
  owner: string;
  goal: string;
  input: string;
  output: string;
  guard: string;
};

export type SelfLearningLoop = {
  id: string;
  name: string;
  rhythm: string;
  trigger: string;
  result: string;
};

export type DeepLearningModel = {
  name: string;
  objective: string;
  doctrine: string;
  stages: DeepLearningStage[];
  loops: SelfLearningLoop[];
};

export type ProtocolStep = {
  step: string;
  owner: string;
  action: string;
  guard: string;
};

export type TaskProfile = {
  id: string;
  task: string;
  topology: string;
  objective: string;
  controllerDecision: string;
  computeDecision: string;
  traceFocus: string;
  clusterSet: string[];
};

export type RuntimePhase = 'idle' | 'request' | 'freeze' | 'test' | 'commit' | 'rollback';

export type RuntimeStatus = 'stable' | 'awaiting-approval' | 'testing' | 'applied' | 'rolled-back';

export type TraceEntryLevel = 'info' | 'warn' | 'critical';

export type TraceEntry = {
  id: string;
  level: TraceEntryLevel;
  message: string;
};

export type AgentRuntimeState = {
  selectedTaskId: string;
  phase: RuntimePhase;
  status: RuntimeStatus;
  selectedProviderId: string;
  activeClusters: string[];
  controlLock: boolean;
  computeDelegated: boolean;
  tracePriority: 'baseline' | 'elevated' | 'critical';
  manualReviewQueued: boolean;
  lastCheckpoint: string;
  cycleIndex: number;
  traceEntries: TraceEntry[];
};

export type AgentRuntimeAction =
  | { type: 'select-task'; taskId: string; activeClusters: string[] }
  | { type: 'select-provider'; providerId: string; entry: TraceEntry }
  | { type: 'advance-phase'; traceEntry: TraceEntry; checkpoint?: string }
  | { type: 'run-cycle'; entries: TraceEntry[]; checkpoint: string }
  | { type: 'trigger-fault'; entries: TraceEntry[] }
  | { type: 'queue-manual-review'; entry: TraceEntry }
  | { type: 'reset'; activeClusters: string[]; entries: TraceEntry[]; taskId: string };

export type LinguisticNode = {
  id: string;
  name: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
};

export type LinguisticCapability = {
  label: string;
  detail: string;
};

export type LinguisticBlock = {
  id: string;
  name: string;
  mission: string;
  policy: string;
  nodes: LinguisticNode[];
  capabilities: LinguisticCapability[];
};

export type RepoIntegration = {
  id: string;
  name: string;
  repository: string;
  runtimeKind: 'handoff-runtime' | 'tool-runtime';
  role: string;
  whyFits: string;
  npmPackages: string[];
  envKeys: string[];
  capabilities: string[];
  limits: string[];
};

export type AgentProviderBlueprint = {
  id: string;
  providerName: string;
  orchestrationStyle: string;
  linguisticStrategy: string;
  traceStrategy: string;
  bootstrapSteps: string[];
};

export type AgentChatRole = 'user' | 'assistant' | 'system';

export type AgentChatMessage = {
  id: string;
  role: AgentChatRole;
  content: string;
};

export type LinguisticIntent =
  | 'analysis'
  | 'repair'
  | 'creation'
  | 'question'
  | 'reflection'
  | 'unknown';

export type LinguisticTone = 'neutral' | 'urgent' | 'critical' | 'reflective' | 'directive';

export type LinguisticProfile = {
  intent: LinguisticIntent;
  tone: LinguisticTone;
  responseMode: 'answer' | 'clarify' | 'warn';
  needsClarification: boolean;
  domains: string[];
  resonanceHint: string;
};

export type FeedbackSentiment = 'positive' | 'negative';

export type FeedbackEvent = {
  id: string;
  createdAt: string;
  messageId: string;
  taskId: string;
  providerId: string;
  sentiment: FeedbackSentiment;
  reason?: string;
};

export type FeedbackGradient = {
  id: string;
  createdAt: string;
  feedbackEventId: string | null;
  source: 'feedback' | 'validation';
  messageId: string;
  taskId: string;
  providerId: string;
  target: string;
  sentiment: FeedbackSentiment;
  weightShift: number;
  reason?: string;
  rationale: string;
  applied: boolean;
  appliedAt: string | null;
  applicationStatus: 'pending' | 'applied' | 'rejected';
  decisionReason: string | null;
};

export type ResearchFinding = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  sourceKind: 'search-result' | 'direct-url' | 'local-endpoint';
  confidence: number;
};

export type ResearchRun = {
  id: string;
  createdAt: string;
  taskId: string;
  query: string;
  status: 'completed' | 'limited' | 'offline' | 'skipped';
  summary: string;
  sourceCount: number;
  findings: ResearchFinding[];
  errors: string[];
};

export type ValidationCheck = {
  id: string;
  label: string;
  passed: boolean;
  severity: LearningSeverity;
  evidence: string;
};

export type FactClaimType = 'fact' | 'inference' | 'instruction' | 'preference' | 'hypothesis';

export type FactProvenance =
  | 'manual'
  | 'research'
  | 'runtime-observed'
  | 'validation-confirmed'
  | 'user-provided'
  | 'inferred';

export type UncertaintyPosture = 'confident' | 'cautious' | 'insufficient-evidence';

export type ValidationPressureProfile = {
  contradictionPressure: number;
  factualPressure: number;
  utilityPressure: number;
  uncertaintyPressure: number;
  overallPressure: number;
};

export type ValidationRun = {
  id: string;
  createdAt: string;
  taskId: string;
  message: string;
  passed: boolean;
  verdict: 'pass' | 'warn' | 'fail';
  score: number;
  researchStatus: ResearchRun['status'];
  factMatchCount: number;
  factsUsed: Array<{
    id: string;
    key: string;
    score: number;
    source: string;
    claimType: FactClaimType;
    provenance: FactProvenance;
  }>;
  failureReasons: string[];
  summary: string;
  uncertaintyPosture: UncertaintyPosture;
  pressureProfile: ValidationPressureProfile;
  checks: ValidationCheck[];
};

export type FactRecord = {
  id: string;
  createdAt: string;
  key: string;
  value: string;
  score: number;
  source: string;
  claimType: FactClaimType;
  provenance: FactProvenance;
  validationStatus: 'unverified' | 'verified' | 'disputed';
  lastValidatedAt: string | null;
  expiresAt: number;
};

export type ValidationIncident = {
  id: string;
  createdAt: string;
  validationRunId: string;
  taskId: string;
  providerId: string;
  messageId: string;
  verdict: ValidationRun['verdict'];
  summary: string;
  failureReasons: string[];
  uncertaintyPosture: UncertaintyPosture;
  pressureProfile: ValidationPressureProfile;
};

export type DialogRun = {
  id: string;
  createdAt: string;
  taskId: string;
  providerId: string;
  runtimeSource: string;
  historyLength: number;
  userMessageLength: number;
  replyLength: number;
  validationVerdict: ValidationRun['verdict'];
};

export type LearningCheckpointSnapshot = {
  id: string;
  createdAt: string;
  trigger: string;
  resonanceScore: number | null;
  rollbackReady: boolean;
};

export type ResonanceEvent = {
  id: string;
  createdAt: string;
  kind: 'check' | 'low-resonance' | 'resume';
  severity: LearningSeverity;
  score?: number;
  checkpointId?: string | null;
  rollbackApplied?: boolean;
  pausedUntil?: number | null;
  summary: string;
};

export type LearningControlState = {
  currentResonance: number | null;
  resonanceState: 'normal' | 'low' | 'recovering';
  pausedUntil: number | null;
  pauseReason: string | null;
  manualLearningPaused: boolean;
  manualPauseReason: string | null;
  lastResonanceCheckAt: string | null;
  lastRollbackAt: string | null;
  lastRollbackCheckpointId: string | null;
  currentValidationPressure: number | null;
  testSuiteBlocked: boolean;
  testSuiteBlockReason: string | null;
  lastTestSuiteRunAt: string | null;
  lastTestSuiteAccuracy: number | null;
};

export type NavigationStep = {
  id: string;
  url: string;
  title: string;
  status: 'visited' | 'blocked' | 'error';
  delayMs: number;
  snippet: string;
  discoveredLinks: string[];
};

export type NavigationRun = {
  id: string;
  createdAt: string;
  taskId: string;
  goal: string;
  sessionId: string;
  status: 'completed' | 'blocked' | 'error';
  summary: string;
  visitedCount: number;
  blockedCount: number;
  steps: NavigationStep[];
};

export type NetSurferRun = {
  id: string;
  createdAt: string;
  taskId: string;
  action: 'navigate' | 'search' | 'click' | 'type' | 'scroll' | 'status';
  status: 'completed' | 'blocked' | 'error' | 'unavailable';
  summary: string;
  url: string | null;
  pageTitle: string | null;
  installed: boolean;
  active: boolean;
  selector?: string | null;
  query?: string | null;
  textPreview?: string | null;
  contentSummary?: string | null;
  error?: string | null;
};

export type AtmanReport = {
  modelType: 'stub' | 'ollama';
  userId: string;
  historyLength: number;
  memoryKey: string;
  weights: {
    warmth: number;
    curiosity: number;
    directness: number;
    caution: number;
  };
};

export type BenchmarkCaseResult = {
  id: string;
  label: string;
  passed: boolean;
  score: number;
  expected: string;
  actual: string;
};

export type BenchmarkRun = {
  id: string;
  createdAt: string;
  suite: string;
  score: number;
  passed: boolean;
  blockedLearning?: boolean;
  cases: BenchmarkCaseResult[];
};

export type TestSuiteMatchStrategy = 'equals' | 'regex' | 'similarity' | 'includes';

export type TestSuiteCase = {
  id: string;
  createdAt: string;
  question: string;
  answer: string;
  taskId: string;
  providerId: string;
  matchStrategy: TestSuiteMatchStrategy;
  threshold: number;
  urls: string[];
  history: AgentChatMessage[];
};

export type TestSuiteState = {
  tests: TestSuiteCase[];
  accuracyThreshold: number;
  checkIntervalMs: number;
  blocked: boolean;
  lastAccuracy: number | null;
  lastRunAt: string | null;
};

export type InspectorAction = {
  id: string;
  createdAt: string;
  kind:
    | 'manual-learning-toggle'
    | 'rollback'
    | 'checkpoint'
    | 'clear-gradients'
    | 'resonance-threshold-update'
    | 'test-threshold-update';
  summary: string;
  details?: string | null;
};

export type InspectorCheckpointSummary = {
  id: string;
  createdAt: string;
  trigger: string;
  resonanceScore: number | null;
  rollbackReady: boolean;
  isLastRollback: boolean;
};

export type InspectorLogEntry = {
  id: string;
  createdAt: string;
  source: 'inspector' | 'resonance' | 'validation' | 'benchmark' | 'feedback';
  severity: LearningSeverity;
  summary: string;
  detail: string | null;
};

export type InspectorStatus = {
  generatedAt: string;
  learningBlocked: boolean;
  guards: {
    manual: boolean;
    resonance: boolean;
    testSuite: boolean;
  };
  pendingGradients: number;
  appliedGradients: number;
  checkpointCount: number;
  testCount: number;
  lastTestAccuracy: number | null;
  resonance: {
    current: number | null;
    state: ResonanceState['state'];
    validationPressure: number;
    thresholds: {
      low: number;
      recovery: number;
    };
  };
  testSuite: {
    threshold: number;
    intervalMs: number;
    blocked: boolean;
  };
  checkpoints: InspectorCheckpointSummary[];
  recentLogs: InspectorLogEntry[];
};

export type InspectorMetrics = {
  checkpoints: InspectorCheckpointSummary[];
  resonanceEvents: ResonanceEvent[];
  validationIncidents: ValidationIncident[];
  benchmarkRuns: BenchmarkRun[];
  pendingGradients: FeedbackGradient[];
  inspectorActions: InspectorAction[];
};

export type LearningSeverity = 'info' | 'warn' | 'critical';

export type LearningErrorJournalEntry = {
  id: string;
  stage: string;
  severity: LearningSeverity;
  issue: string;
  action: string;
};

export type LearningMemoryShard = {
  id: string;
  title: string;
  summary: string;
  source: string;
  retention: 'short' | 'medium' | 'long';
};

export type LearningCandidatePatch = {
  target: string;
  strategy: string;
  confidence: number;
  expectedGain: string;
  requiresManualReview: boolean;
};

export type LearningPolicyDecision = {
  approved: boolean;
  authority: string;
  reason: string;
  rollbackCheckpoint: string;
  manualReviewRequired: boolean;
};

export type LearningReport = {
  loop: 'micro-backprop' | 'night-distillation' | 'architectural-mutation';
  summary: string;
  doctrine: string;
  candidatePatch: LearningCandidatePatch;
  policy: LearningPolicyDecision;
  memoryShards: LearningMemoryShard[];
  errorJournal: LearningErrorJournalEntry[];
};

export type AgentExecutionMode = 'auto' | 'server' | 'local';

export type AgentExecutionRequest = {
  message: string;
  taskId: string;
  providerId: string;
  mode: AgentExecutionMode;
  history: AgentChatMessage[];
  urls?: string[];
  userId?: string;
};

export type AgentExecutionResponse = {
  reply: AgentChatMessage;
  runtimeSource: 'server' | 'local-fallback';
  providerLabel: string;
  trace: string[];
  learningReport?: LearningReport;
  linguisticProfile?: LinguisticProfile;
  researchReport?: ResearchRun | null;
  validationReport?: ValidationRun | null;
  navigationReport?: NavigationRun | null;
  netsurferReport?: NetSurferRun | null;
  atmanReport?: AtmanReport | null;
};

export type LearningLedgerCycle = {
  id: string;
  createdAt: string;
  taskId: string;
  providerId: string;
  runtimeSource: string;
  summary: string;
  loop: LearningReport['loop'];
  candidatePatch: LearningCandidatePatch;
  policy: LearningPolicyDecision;
};

export type LearningLedgerNightlyRun = {
  id: string;
  createdAt: string;
  summary: string;
  policy: LearningPolicyDecision;
  candidatePatch: LearningCandidatePatch;
  memoryShardCount: number;
  journalCount: number;
};

export type LearningLedgerRishiCheckpoint = {
  id: string;
  createdAt: string;
  trigger: string;
  recommendedAction: string;
  rollbackReady: boolean;
  gradientCount: number;
  insightCount: number;
  gradients: RishiDelta[];
  insights: RishiInsight[];
};

export type LearningLedgerSnapshot = {
  lastUpdatedAt: string | null;
  cycles: LearningLedgerCycle[];
  dialogRuns: DialogRun[];
  memoryShards: LearningMemoryShard[];
  facts: FactRecord[];
  errorJournal: LearningErrorJournalEntry[];
  nightlyRuns: LearningLedgerNightlyRun[];
  rishiCheckpoints: LearningLedgerRishiCheckpoint[];
  checkpointSnapshots: LearningCheckpointSnapshot[];
  resonanceEvents: ResonanceEvent[];
  inspectorActions: InspectorAction[];
  feedbackEvents: FeedbackEvent[];
  feedbackGradients: FeedbackGradient[];
  validationIncidents: ValidationIncident[];
  learningControl: LearningControlState;
  feedbackProcessing: {
    processedFeedbackIds: string[];
    lastProcessedAt: string | null;
    lastAppliedAt: string | null;
  };
  researchRuns: ResearchRun[];
  validationRuns: ValidationRun[];
  navigationRuns: NavigationRun[];
  netsurferRuns: NetSurferRun[];
  benchmarkRuns: BenchmarkRun[];
  stats: {
    cycleCount: number;
    dialogRunCount: number;
    memoryShardCount: number;
    factCount: number;
    errorJournalCount: number;
    nightlyRunCount: number;
    rishiCheckpointCount: number;
    checkpointSnapshotCount: number;
    resonanceEventCount: number;
    feedbackCount: number;
    positiveFeedbackRatio: number;
    feedbackGradientCount: number;
    pendingFeedbackGradientCount: number;
    appliedFeedbackGradientCount: number;
    researchRunCount: number;
    validationRunCount: number;
    validationFailureCount: number;
    validationAverageScore: number;
    navigationRunCount: number;
    netsurferRunCount: number;
    benchmarkRunCount: number;
    benchmarkAverageScore: number;
    learningPaused: boolean;
    manualLearningPaused: boolean;
    testSuiteBlocked: boolean;
    learningBlocked: boolean;
    inspectorActionCount: number;
  };
};

export type RishiDelta = {
  id: string;
  target: string;
  weightShift: number;
  rationale: string;
};

export type RishiInsight = {
  id: string;
  kind: 'stability' | 'degradation' | 'opportunity';
  summary: string;
  evidence: string;
};

export type RishiState = {
  generatedAt: string;
  gradients: RishiDelta[];
  insights: RishiInsight[];
  recommendedAction: string;
  rollbackReady: boolean;
  resonanceScore: number;
  resonanceBand: 'stable' | 'questioning' | 'drifting';
  informationSources: string[];
  verificationSignals: string[];
};

export type ResonanceState = {
  currentResonance: number | null;
  likes: number;
  dislikes: number;
  validationErrors: number;
  validationPressure: number;
  engagementScore: number;
  totalFeedback: number;
  state: 'normal' | 'low' | 'recovering';
  pausedUntil: number | null;
  pauseReason: string | null;
  lastResonanceCheckAt: string | null;
  lastRollbackAt: string | null;
  lastRollbackCheckpointId: string | null;
  latestEvent: ResonanceEvent | null;
  lastGoodCheckpoint: LearningCheckpointSnapshot | null;
  thresholds: {
    low: number;
    recovery: number;
  };
};