import { baseTraceEntries, repoIntegrations, taskProfiles } from './data/agentModel';
import type {
  AgentRuntimeAction,
  AgentRuntimeState,
  RuntimePhase,
  RuntimeStatus,
  TaskProfile,
  TraceEntry,
} from './types/agent';

const phaseOrder: RuntimePhase[] = ['idle', 'request', 'freeze', 'test', 'commit'];

function appendEntries(state: AgentRuntimeState, entries: TraceEntry[]) {
  return [...entries, ...state.traceEntries].slice(0, 10);
}

export function getTaskProfile(taskId: string): TaskProfile {
  return taskProfiles.find((profile) => profile.id === taskId) ?? taskProfiles[0];
}

function nextPhase(current: RuntimePhase): RuntimePhase {
  const index = phaseOrder.indexOf(current);
  if (index === -1 || index === phaseOrder.length - 1) {
    return 'idle';
  }

  return phaseOrder[index + 1];
}

function deriveStatus(phase: RuntimePhase): RuntimeStatus {
  switch (phase) {
    case 'request':
      return 'awaiting-approval';
    case 'freeze':
    case 'test':
      return 'testing';
    case 'commit':
      return 'applied';
    case 'rollback':
      return 'rolled-back';
    default:
      return 'stable';
  }
}

function derivePriority(phase: RuntimePhase) {
  if (phase === 'test' || phase === 'rollback') {
    return 'critical' as const;
  }

  if (phase === 'freeze' || phase === 'request') {
    return 'elevated' as const;
  }

  return 'baseline' as const;
}

export function createCheckpointLabel(cycleIndex: number, task: TaskProfile) {
  return `cp-${task.id}-${String(cycleIndex).padStart(2, '0')}`;
}

export function createPhaseTraceEntry(
  cycleIndex: number,
  phase: RuntimePhase,
  task: TaskProfile,
): TraceEntry {
  const messages: Record<RuntimePhase, string> = {
    idle: `[stabilize] ${task.task}: controller restored steady-state topology`,
    request: `[request] cycle ${cycleIndex}: compute core proposed ${task.topology}`,
    freeze: `[freeze] control core seized compute authority for sandbox validation`,
    test: `[test] trace sentinel scanning ${task.traceFocus.toLowerCase()}`,
    commit: `[commit] topology committed with active clusters: ${task.clusterSet.join(', ')}`,
    rollback: `[rollback] trace sentinel forced safe revert to last checkpoint`,
  };

  return {
    id: `${task.id}-${phase}-${cycleIndex}`,
    level: phase === 'rollback' ? 'critical' : phase === 'test' ? 'warn' : 'info',
    message: messages[phase],
  };
}

export function createCycleTraceEntries(cycleIndex: number, task: TaskProfile): TraceEntry[] {
  return [
    createPhaseTraceEntry(cycleIndex, 'request', task),
    createPhaseTraceEntry(cycleIndex, 'freeze', task),
    createPhaseTraceEntry(cycleIndex, 'test', task),
    createPhaseTraceEntry(cycleIndex, 'commit', task),
  ].reverse();
}

export function createFaultTraceEntries(cycleIndex: number, task: TaskProfile): TraceEntry[] {
  return [
    {
      id: `${task.id}-fault-${cycleIndex}`,
      level: 'critical',
      message: `[fault] ${task.task}: trigger conflict detected inside ${task.clusterSet[0]}`,
    },
    createPhaseTraceEntry(cycleIndex, 'rollback', task),
  ];
}

export function createManualReviewEntry(cycleIndex: number, task: TaskProfile): TraceEntry {
  return {
    id: `${task.id}-manual-${cycleIndex}`,
    level: 'warn',
    message: `[review] compute core requested manual redesign of control core for ${task.task}`,
  };
}

export function createInitialRuntimeState(): AgentRuntimeState {
  const initialTask = taskProfiles[0];

  return {
    selectedTaskId: initialTask.id,
    phase: 'idle',
    status: 'stable',
    selectedProviderId: repoIntegrations[0].id,
    activeClusters: initialTask.clusterSet,
    controlLock: false,
    computeDelegated: false,
    tracePriority: 'baseline',
    manualReviewQueued: false,
    lastCheckpoint: createCheckpointLabel(0, initialTask),
    cycleIndex: 0,
    traceEntries: baseTraceEntries,
  };
}

export function agentRuntimeReducer(
  state: AgentRuntimeState,
  action: AgentRuntimeAction,
): AgentRuntimeState {
  switch (action.type) {
    case 'select-task':
      return {
        ...state,
        selectedTaskId: action.taskId,
        activeClusters: action.activeClusters,
        phase: 'idle',
        status: 'stable',
        controlLock: false,
        computeDelegated: false,
        tracePriority: 'baseline',
      };
    case 'select-provider':
      return {
        ...state,
        selectedProviderId: action.providerId,
        traceEntries: appendEntries(state, [action.entry]),
      };
    case 'advance-phase': {
      const phase = nextPhase(state.phase);
      const status = deriveStatus(phase);

      return {
        ...state,
        phase,
        status,
        controlLock: phase === 'freeze' || phase === 'test',
        computeDelegated: phase === 'freeze' || phase === 'test',
        tracePriority: derivePriority(phase),
        lastCheckpoint: action.checkpoint ?? state.lastCheckpoint,
        cycleIndex: phase === 'request' ? state.cycleIndex + 1 : state.cycleIndex,
        traceEntries: appendEntries(state, [action.traceEntry]),
      };
    }
    case 'run-cycle':
      return {
        ...state,
        cycleIndex: state.cycleIndex + 1,
        phase: 'commit',
        status: 'applied',
        controlLock: false,
        computeDelegated: false,
        tracePriority: 'baseline',
        lastCheckpoint: action.checkpoint,
        traceEntries: appendEntries(state, action.entries),
      };
    case 'trigger-fault':
      return {
        ...state,
        phase: 'rollback',
        status: 'rolled-back',
        controlLock: true,
        computeDelegated: true,
        tracePriority: 'critical',
        traceEntries: appendEntries(state, action.entries),
      };
    case 'queue-manual-review':
      return {
        ...state,
        manualReviewQueued: true,
        traceEntries: appendEntries(state, [action.entry]),
      };
    case 'reset':
      return {
        ...createInitialRuntimeState(),
        selectedTaskId: action.taskId,
        activeClusters: action.activeClusters,
        traceEntries: action.entries,
      };
    default:
      return state;
  }
}

export function createProviderTraceEntry(providerName: string): TraceEntry {
  return {
    id: `provider-${providerName.toLowerCase().replace(/\s+/g, '-')}`,
    level: 'info',
    message: `[provider] linguistic mesh switched orchestration profile to ${providerName}`,
  };
}