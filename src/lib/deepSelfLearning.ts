import type {
  AgentChatMessage,
  LearningCandidatePatch,
  LearningErrorJournalEntry,
  LearningMemoryShard,
  LearningPolicyDecision,
  LearningReport,
} from '../types/agent';

type DeepSelfLearningInput = {
  message: string;
  taskId: string;
  history: AgentChatMessage[];
};

const protectedTargets = new Set(['control-core', 'trace-priority-bus']);

function summarizeIntent(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('ядро') || normalized.includes('control core')) {
    return 'architectural-mutation' as const;
  }

  if (normalized.includes('ошиб') || normalized.includes('сбой') || normalized.includes('rollback')) {
    return 'night-distillation' as const;
  }

  return 'micro-backprop' as const;
}

function buildErrorJournal(message: string, history: AgentChatMessage[]): LearningErrorJournalEntry[] {
  const normalized = message.toLowerCase();
  const journal: LearningErrorJournalEntry[] = [];

  if (normalized.includes('ошиб') || normalized.includes('fail') || normalized.includes('fault')) {
    journal.push({
      id: `critic-${history.length + 1}`,
      stage: 'Reflective Critic Layer',
      severity: 'warn',
      issue: 'Диалог содержит явный сигнал ошибки или деградации.',
      action: 'Поднять вес trace-сигналов и направить опыт в ночную дистилляцию.',
    });
  }

  if (history.length > 6) {
    journal.push({
      id: `memory-${history.length}`,
      stage: 'Memory Distillation Layer',
      severity: 'info',
      issue: 'История становится длинной и требует сжатия контекста.',
      action: 'Сконденсировать диалог в memory shard и сократить оперативную историю.',
    });
  }

  if (normalized.includes('ядро') || normalized.includes('control core')) {
    journal.push({
      id: `policy-${Date.now()}`,
      stage: 'Controlled Update Layer',
      severity: 'critical',
      issue: 'Запрос затрагивает защищенный управляющий контур.',
      action: 'Остановить автоматическое закрепление и перевести изменение в manual review.',
    });
  }

  return journal;
}

function buildCandidatePatch(message: string, loop: LearningReport['loop']): LearningCandidatePatch {
  const normalized = message.toLowerCase();
  const touchesProtectedSurface = normalized.includes('ядро') || normalized.includes('control core');
  const target = touchesProtectedSurface
    ? 'control-core'
    : loop === 'night-distillation'
      ? 'memory-ganga'
      : 'compute-core';

  return {
    target,
    strategy:
      loop === 'night-distillation'
        ? 'compress recent traces into reusable memory shards'
        : loop === 'architectural-mutation'
          ? 'prepare sandboxed architecture mutation candidate'
          : 'adjust routing weights and tool selection heuristics',
    confidence: touchesProtectedSurface ? 0.41 : loop === 'micro-backprop' ? 0.74 : 0.68,
    expectedGain: touchesProtectedSurface
      ? 'Нужна ручная проверка перед любым приростом качества.'
      : 'Снижение повторяющихся ошибок и более устойчивый подбор кластеров.',
    requiresManualReview: touchesProtectedSurface || loop === 'architectural-mutation',
  };
}

function buildMemoryShards(
  taskId: string,
  message: string,
  history: AgentChatMessage[],
  journal: LearningErrorJournalEntry[],
): LearningMemoryShard[] {
  const latestUserTurns = history.filter((entry) => entry.role === 'user').slice(-2);

  return [
    {
      id: `memory-${taskId}-${history.length}`,
      title: 'Recent intent shard',
      summary: latestUserTurns.map((entry) => entry.content).join(' | ') || message,
      source: 'Perception Layer',
      retention: journal.some((entry) => entry.severity === 'critical') ? 'long' : 'medium',
    },
    {
      id: `memory-${taskId}-critic-${journal.length}`,
      title: 'Critic distillation shard',
      summary:
        journal.length > 0
          ? journal.map((entry) => entry.issue).join(' ') 
          : 'Критических замечаний нет, цикл можно использовать как эталон стабильного поведения.',
      source: 'Reflective Critic Layer',
      retention: journal.length > 0 ? 'long' : 'short',
    },
  ];
}

function evaluatePolicy(
  taskId: string,
  patch: LearningCandidatePatch,
  journal: LearningErrorJournalEntry[],
): LearningPolicyDecision {
  const criticalFinding = journal.some((entry) => entry.severity === 'critical');
  const touchesProtectedSurface = protectedTargets.has(patch.target);
  const approved = !criticalFinding && !touchesProtectedSurface;

  return {
    approved,
    authority: approved ? 'Control Core / Shiva' : 'Control Core / Shiva manual channel',
    reason: approved
      ? `Обновление для ${patch.target} не нарушает управляющие инварианты.`
      : touchesProtectedSurface
        ? 'Кандидат затрагивает защищенное ядро и не может быть закреплен автоматически.'
        : 'Цикл содержит критический critic-signal и должен завершиться rollback-aware review.',
    rollbackCheckpoint: `cp-${taskId}-${patch.target}`,
    manualReviewRequired: !approved || patch.requiresManualReview,
  };
}

export function runDeepSelfLearningCycle({
  message,
  taskId,
  history,
}: DeepSelfLearningInput): LearningReport {
  const loop = summarizeIntent(message);
  const errorJournal = buildErrorJournal(message, history);
  const candidatePatch = buildCandidatePatch(message, loop);
  const memoryShards = buildMemoryShards(taskId, message, history, errorJournal);
  const policy = evaluatePolicy(taskId, candidatePatch, errorJournal);

  return {
    loop,
    summary: policy.approved
      ? `Mandala cycle prepared ${candidatePatch.target} update under Shiva-gated approval.`
      : `Mandala cycle diverted ${candidatePatch.target} update into protected manual review.` ,
    doctrine:
      'Experience is encoded, criticized, distilled into memory, and only then proposed as a guarded update.',
    candidatePatch,
    policy,
    memoryShards,
    errorJournal,
  };
}