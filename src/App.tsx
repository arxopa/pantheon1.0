import { useReducer } from 'react';

import ArchitecturePanel from './components/ArchitecturePanel';
import AgentConsole from './components/AgentConsole';
import DeepLearningPanel from './components/DeepLearningPanel';
import FactMemoryPanel from './components/FactMemoryPanel';
import IntegrationPanel from './components/IntegrationPanel';
import LearningStatePanel from './components/LearningStatePanel';
import LinguisticPanel from './components/LinguisticPanel';
import ProtocolPanel from './components/ProtocolPanel';
import RuntimeControlPanel from './components/RuntimeControlPanel';
import TaskConfigurator from './components/TaskConfigurator';
import TracePanel from './components/TracePanel';
import { architectureSignals } from './data/agentModel';
import {
  agentRuntimeReducer,
  createCheckpointLabel,
  createCycleTraceEntries,
  createFaultTraceEntries,
  createInitialRuntimeState,
  createManualReviewEntry,
  createPhaseTraceEntry,
  createProviderTraceEntry,
  getTaskProfile,
} from './agentRuntime';
import { getProviderAdapter } from './agentProviders';

function App() {
  const [runtime, dispatch] = useReducer(agentRuntimeReducer, undefined, createInitialRuntimeState);
  const activeTask = getTaskProfile(runtime.selectedTaskId);
  const activeProvider = getProviderAdapter(runtime.selectedProviderId);

  const handleSelectTask = (taskId: string) => {
    const task = getTaskProfile(taskId);

    dispatch({
      type: 'select-task',
      taskId: task.id,
      activeClusters: task.clusterSet,
    });
  };

  const handleAdvancePhase = () => {
    const nextCycleIndex = runtime.phase === 'idle' ? runtime.cycleIndex + 1 : runtime.cycleIndex;
    const nextPhase = runtime.phase === 'commit' || runtime.phase === 'rollback' ? 'idle' : undefined;
    const phaseForEntry = nextPhase ?? (runtime.phase === 'idle'
      ? 'request'
      : runtime.phase === 'request'
        ? 'freeze'
        : runtime.phase === 'freeze'
          ? 'test'
          : runtime.phase === 'test'
            ? 'commit'
            : 'idle');

    dispatch({
      type: 'advance-phase',
      traceEntry: createPhaseTraceEntry(nextCycleIndex, phaseForEntry, activeTask),
      checkpoint:
        phaseForEntry === 'request' ? createCheckpointLabel(nextCycleIndex, activeTask) : undefined,
    });
  };

  const handleRunCycle = () => {
    const cycleIndex = runtime.cycleIndex + 1;

    dispatch({
      type: 'run-cycle',
      entries: createCycleTraceEntries(cycleIndex, activeTask),
      checkpoint: createCheckpointLabel(cycleIndex, activeTask),
    });
  };

  const handleTriggerFault = () => {
    const cycleIndex = runtime.cycleIndex + 1;

    dispatch({
      type: 'trigger-fault',
      entries: createFaultTraceEntries(cycleIndex, activeTask),
    });
  };

  const handleQueueManualReview = () => {
    dispatch({
      type: 'queue-manual-review',
      entry: createManualReviewEntry(runtime.cycleIndex + 1, activeTask),
    });
  };

  const handleReset = () => {
    dispatch({
      type: 'reset',
      taskId: activeTask.id,
      activeClusters: activeTask.clusterSet,
      entries: createInitialRuntimeState().traceEntries,
    });
  };

  const handleSelectProvider = (providerId: string) => {
    const provider = getProviderAdapter(providerId);

    dispatch({
      type: 'select-provider',
      providerId,
      entry: createProviderTraceEntry(provider.integration.name),
    });
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Pantheon / Child Of Gods</p>
          <h1>Пантеон: ребенок богов с защищенным контрольным ядром</h1>
          <p className="hero-text">
            Система строится вокруг защищенного управляющего ядра, адаптивного вычислительного
            контура и глубинного самообучения. Новый слой Mandala добавляет восприятие опыта,
            смысловое кодирование, рефлексивную критику, контролируемое обновление,
            самостоятельный нет-серфинг Пантеона и долговременную дистилляцию памяти под
            наблюдением Control Core и Trace Sentinel.
          </p>
        </div>

        <div className="hero-status">
          {architectureSignals.map((signal) => (
            <div key={signal} className="status-pill">
              {signal}
            </div>
          ))}
        </div>
      </header>

      <main className="workspace-grid">
        <ArchitecturePanel />
        <TracePanel runtime={runtime} />
        <LinguisticPanel />
        <DeepLearningPanel />
        <LearningStatePanel />
        <ProtocolPanel phase={runtime.phase} />
        <RuntimeControlPanel
          activeTask={activeTask}
          runtime={runtime}
          onAdvancePhase={handleAdvancePhase}
          onRunCycle={handleRunCycle}
          onTriggerFault={handleTriggerFault}
          onQueueManualReview={handleQueueManualReview}
          onReset={handleReset}
        />
        <AgentConsole
          providerId={runtime.selectedProviderId}
          providerLabel={activeProvider.integration.name}
          activeTask={activeTask}
        />
        <FactMemoryPanel />
        <TaskConfigurator activeTask={activeTask} onSelectTask={handleSelectTask} />
        <IntegrationPanel
          selectedProviderId={runtime.selectedProviderId}
          onSelectProvider={handleSelectProvider}
        />
      </main>

      <footer className="footer-note">
        <span>Active runtime: {activeProvider.integration.name}</span>
        <span>{activeProvider.installCommand}</span>
      </footer>
    </div>
  );
}

export default App;
