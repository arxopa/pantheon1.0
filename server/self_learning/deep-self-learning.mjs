import { ControlCorePolicyGate } from '../core/control-core.mjs';

export class DeepSelfLearning {
  constructor() {
    this.name = 'Deep Self-Learning Mandala';
    this.layers = [
      'perception',
      'semantic-encoding',
      'reflective-critic',
      'controlled-update',
      'memory-distillation',
    ];
    this.policyGate = new ControlCorePolicyGate();
  }

  resolveLoop(message) {
    const normalized = String(message ?? '').toLowerCase();

    if (normalized.includes('ядро') || normalized.includes('control core')) {
      return 'architectural-mutation';
    }

    if (normalized.includes('ошиб') || normalized.includes('fault') || normalized.includes('rollback')) {
      return 'night-distillation';
    }

    return 'micro-backprop';
  }

  buildErrorJournal(message, history) {
    const normalized = String(message ?? '').toLowerCase();
    const journal = [];

    if (normalized.includes('ошиб') || normalized.includes('fail') || normalized.includes('fault')) {
      journal.push({
        id: `critic-${history.length + 1}`,
        stage: 'Reflective Critic Layer',
        severity: 'warn',
        issue: 'The request carries an explicit degradation or failure signal.',
        action: 'Escalate traces into the Night Distillation loop.',
      });
    }

    if (history.length > 6) {
      journal.push({
        id: `memory-${history.length}`,
        stage: 'Memory Distillation Layer',
        severity: 'info',
        issue: 'History length requires compression into durable memory.',
        action: 'Summarize recent context into retained shards.',
      });
    }

    if (normalized.includes('ядро') || normalized.includes('control core')) {
      journal.push({
        id: `policy-${history.length + 1}`,
        stage: 'Controlled Update Layer',
        severity: 'critical',
        issue: 'The request targets the protected Control Core surface.',
        action: 'Deny automatic update and route into manual review.',
      });
    }

    return journal;
  }

  buildCandidatePatch(message, loop) {
    const normalized = String(message ?? '').toLowerCase();
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
        ? 'Manual validation is required before any quality gain can be realized.'
        : 'Reduce repeated mistakes and stabilize cluster selection.',
      requiresManualReview: touchesProtectedSurface || loop === 'architectural-mutation',
    };
  }

  buildMemoryShards(taskId, message, history, errorJournal) {
    const recentUserTurns = history.filter((entry) => entry.role === 'user').slice(-2);

    return [
      {
        id: `memory-${taskId}-${history.length}`,
        title: 'Recent intent shard',
        summary: recentUserTurns.map((entry) => entry.content).join(' | ') || message,
        source: 'Perception Layer',
        retention: errorJournal.some((entry) => entry.severity === 'critical') ? 'long' : 'medium',
      },
      {
        id: `memory-${taskId}-critic-${errorJournal.length}`,
        title: 'Critic distillation shard',
        summary:
          errorJournal.length > 0
            ? errorJournal.map((entry) => entry.issue).join(' ')
            : 'No critical findings; this cycle can serve as a stable baseline sample.',
        source: 'Reflective Critic Layer',
        retention: errorJournal.length > 0 ? 'long' : 'short',
      },
    ];
  }

  cycle({ message, taskId, history = [] }) {
    const loop = this.resolveLoop(message);
    const errorJournal = this.buildErrorJournal(message, history);
    const candidatePatch = this.buildCandidatePatch(message, loop);
    const memoryShards = this.buildMemoryShards(taskId, message, history, errorJournal);
    const policy = this.policyGate.evaluate({ taskId, candidatePatch, errorJournal });

    return {
      message,
      taskId,
      loop,
      layers: this.layers,
      candidatePatch,
      policy,
      memoryShards,
      errorJournal,
      summary: policy.approved
        ? `Mandala cycle prepared ${candidatePatch.target} update under Shiva-gated approval.`
        : `Mandala cycle diverted ${candidatePatch.target} update into protected manual review.`,
    };
  }

  runNightDistillation({ cycles = [], memoryShards = [], errorJournal = [] }) {
    const synthesisInput = [
      ...cycles.slice(-3).map((entry) => entry.summary),
      ...errorJournal.slice(-3).map((entry) => entry.issue),
    ].join(' ');
    const summarySeed = synthesisInput || 'stable runtime baseline';
    const candidatePatch = {
      target: 'memory-ganga',
      strategy: 'compress recent cycles and critic findings into durable retrieval shards',
      confidence: cycles.length > 0 ? 0.79 : 0.61,
      expectedGain: 'Reduce context drift and preserve reusable patterns across sessions.',
      requiresManualReview: false,
    };
    const nextErrorJournal = errorJournal.length > 0
      ? errorJournal.slice(-5)
      : [
          {
            id: `night-journal-${Date.now()}`,
            stage: 'Memory Distillation Layer',
            severity: 'info',
            issue: 'Night distillation found no blocking critic signals.',
            action: 'Preserve stable baseline and compact recent cycles.',
          },
        ];
    const nextMemoryShards = [
      {
        id: `night-memory-${Date.now()}`,
        title: 'Night distillation shard',
        summary: summarySeed,
        source: 'Memory Distillation Layer',
        retention: 'long',
      },
      ...memoryShards.slice(-2),
    ];
    const policy = this.policyGate.evaluate({
      taskId: 'night-distillation',
      candidatePatch,
      errorJournal: nextErrorJournal,
    });

    return {
      taskId: 'night-distillation',
      loop: 'night-distillation',
      layers: this.layers,
      candidatePatch,
      policy,
      memoryShards: nextMemoryShards,
      errorJournal: nextErrorJournal,
      summary: policy.approved
        ? 'Night Distillation condensed recent cycles into durable memory shards.'
        : 'Night Distillation halted due to a protected critic signal.',
    };
  }
}