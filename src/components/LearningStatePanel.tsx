import { useEffect, useState } from 'react';

import {
  addTestSuiteCase,
  applyFeedbackLoop,
  checkResonance,
  clearPendingInspectorGradients,
  createInspectorCheckpoint,
  fetchLearningState,
  fetchInspectorMetrics,
  fetchInspectorStatus,
  fetchResonanceState,
  fetchTestSuiteState,
  processFeedbackLoop,
  removeTestSuiteCase,
  rollbackInspectorCheckpoint,
  fetchRishiState,
  runBenchmarkSuite,
  toggleInspectorLearning,
  triggerRishiCheckpoint,
  unblockTestSuite,
  updateInspectorResonanceThresholds,
  updateInspectorTestSuiteThreshold,
} from '../lib/learningDiagnostics';
import type {
  BenchmarkRun,
  InspectorMetrics,
  InspectorStatus,
  LearningLedgerSnapshot,
  ResonanceState,
  RishiState,
  TestSuiteMatchStrategy,
  TestSuiteState,
} from '../types/agent';

function LearningStatePanel() {
  const [learningState, setLearningState] = useState<LearningLedgerSnapshot | null>(null);
  const [rishiState, setRishiState] = useState<RishiState | null>(null);
  const [resonanceState, setResonanceState] = useState<ResonanceState | null>(null);
  const [testSuiteState, setTestSuiteState] = useState<TestSuiteState | null>(null);
  const [inspectorStatus, setInspectorStatus] = useState<InspectorStatus | null>(null);
  const [inspectorMetrics, setInspectorMetrics] = useState<InspectorMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkpointPending, setCheckpointPending] = useState(false);
  const [feedbackLoopPending, setFeedbackLoopPending] = useState(false);
  const [feedbackApplyPending, setFeedbackApplyPending] = useState(false);
  const [benchmarkPending, setBenchmarkPending] = useState(false);
  const [resonancePending, setResonancePending] = useState(false);
  const [testMutationPending, setTestMutationPending] = useState(false);
  const [inspectorPending, setInspectorPending] = useState(false);
  const [benchmarkStatus, setBenchmarkStatus] = useState<string | null>(null);
  const [newTestQuestion, setNewTestQuestion] = useState('');
  const [newTestAnswer, setNewTestAnswer] = useState('');
  const [newTestMatchStrategy, setNewTestMatchStrategy] = useState<TestSuiteMatchStrategy>('includes');
  const [newTestThreshold, setNewTestThreshold] = useState('0.7');
  const [resonanceLowInput, setResonanceLowInput] = useState('0.3');
  const [resonanceRecoveryInput, setResonanceRecoveryInput] = useState('0.7');
  const [suiteThresholdInput, setSuiteThresholdInput] = useState('0.7');
  const latestCycle = learningState ? learningState.cycles[learningState.cycles.length - 1] : undefined;
  const latestNightlyRun = learningState
    ? learningState.nightlyRuns[learningState.nightlyRuns.length - 1]
    : undefined;
  const latestRishiCheckpoint = learningState
    ? learningState.rishiCheckpoints[learningState.rishiCheckpoints.length - 1]
    : undefined;
  const latestBenchmarkRun: BenchmarkRun | undefined = learningState
    ? learningState.benchmarkRuns[learningState.benchmarkRuns.length - 1]
    : undefined;
  const latestResearchRun = learningState
    ? learningState.researchRuns[learningState.researchRuns.length - 1]
    : undefined;
  const latestValidationRun = learningState
    ? learningState.validationRuns[learningState.validationRuns.length - 1]
    : undefined;
  const latestNavigationRun = learningState
    ? learningState.navigationRuns[learningState.navigationRuns.length - 1]
    : undefined;
  const recentFeedback = learningState ? learningState.feedbackEvents.slice(-3).reverse() : [];
  const recentFeedbackGradients = learningState ? learningState.feedbackGradients.slice(-3).reverse() : [];

  const loadDiagnostics = async () => {
    const [ledger, rishi, resonance, testSuite, inspector, metrics] = await Promise.all([
      fetchLearningState(),
      fetchRishiState(),
      fetchResonanceState(),
      fetchTestSuiteState(),
      fetchInspectorStatus(),
      fetchInspectorMetrics(),
    ]);

    setLearningState(ledger);
    setRishiState(rishi);
    setResonanceState(resonance);
    setTestSuiteState(testSuite);
    setInspectorStatus(inspector);
    setInspectorMetrics(metrics);
    setResonanceLowInput(String(inspector.resonance.thresholds.low));
    setResonanceRecoveryInput(String(inspector.resonance.thresholds.recovery));
    setSuiteThresholdInput(String(inspector.testSuite.threshold));
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [ledger, rishi, resonance, testSuite, inspector, metrics] = await Promise.all([
          fetchLearningState(),
          fetchRishiState(),
          fetchResonanceState(),
          fetchTestSuiteState(),
          fetchInspectorStatus(),
          fetchInspectorMetrics(),
        ]);

        if (!cancelled) {
          setLearningState(ledger);
          setRishiState(rishi);
          setResonanceState(resonance);
          setTestSuiteState(testSuite);
          setInspectorStatus(inspector);
          setInspectorMetrics(metrics);
          setResonanceLowInput(String(inspector.resonance.thresholds.low));
          setResonanceRecoveryInput(String(inspector.resonance.thresholds.recovery));
          setSuiteThresholdInput(String(inspector.testSuite.threshold));
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Diagnostics unavailable');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    const timerId = window.setInterval(() => {
      void load();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, []);

  const reload = async () => {
    setLoading(true);
    setError(null);

    try {
      await loadDiagnostics();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Diagnostics unavailable');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckResonance = async () => {
    if (resonancePending) {
      return;
    }

    setResonancePending(true);
    setBenchmarkStatus(null);
    setError(null);

    try {
      const nextState = await checkResonance();
      setResonanceState(nextState);
      setBenchmarkStatus(`Resonance check: ${nextState.currentResonance ?? 'insufficient-data'} / state ${nextState.state}.`);
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Resonance check failed');
    } finally {
      setResonancePending(false);
    }
  };

  const handleTriggerCheckpoint = async () => {
    if (checkpointPending) {
      return;
    }

    setCheckpointPending(true);
    setError(null);

    try {
      await triggerRishiCheckpoint();
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Rishi checkpoint failed');
    } finally {
      setCheckpointPending(false);
    }
  };

  const handleRunBenchmark = async () => {
    if (benchmarkPending) {
      return;
    }

    setBenchmarkPending(true);
    setBenchmarkStatus(null);
    setError(null);

    try {
      const run = await runBenchmarkSuite();
      setBenchmarkStatus(`Test suite ${run.suite} завершен со score ${run.score}. blocked=${run.blockedLearning ? 'yes' : 'no'}.`);
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Benchmark failed');
    } finally {
      setBenchmarkPending(false);
    }
  };

  const handleProcessFeedback = async () => {
    if (feedbackLoopPending) {
      return;
    }

    setFeedbackLoopPending(true);
    setBenchmarkStatus(null);
    setError(null);

    try {
      const result = await processFeedbackLoop();
      setBenchmarkStatus(`Feedback loop обработал ${result.processedCount} событий. Pending after: ${result.pendingAfter}.`);
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Feedback loop failed');
    } finally {
      setFeedbackLoopPending(false);
    }
  };

  const handleApplyFeedback = async () => {
    if (feedbackApplyPending) {
      return;
    }

    setFeedbackApplyPending(true);
    setBenchmarkStatus(null);
    setError(null);

    try {
      const result = await applyFeedbackLoop();
      setBenchmarkStatus(
        `Feedback apply loop применил ${result.appliedCount} gradients, rejected ${result.rejectedCount}, pending after: ${result.pendingAfter}.`,
      );
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Feedback apply failed');
    } finally {
      setFeedbackApplyPending(false);
    }
  };

  const handleAddTest = async () => {
    if (testMutationPending) {
      return;
    }

    const question = newTestQuestion.trim();
    const answer = newTestAnswer.trim();

    if (!question || !answer) {
      setError('Для нового теста нужны question и expected answer.');
      return;
    }

    setTestMutationPending(true);
    setBenchmarkStatus(null);
    setError(null);

    try {
      await addTestSuiteCase({
        question,
        answer,
        matchStrategy: newTestMatchStrategy,
        threshold: Number(newTestThreshold) || 0.7,
      });
      setNewTestQuestion('');
      setNewTestAnswer('');
      setBenchmarkStatus('Новый test case добавлен в persistent suite.');
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Test add failed');
    } finally {
      setTestMutationPending(false);
    }
  };

  const handleRemoveTest = async (id: string) => {
    if (testMutationPending) {
      return;
    }

    setTestMutationPending(true);
    setBenchmarkStatus(null);
    setError(null);

    try {
      await removeTestSuiteCase(id);
      setBenchmarkStatus('Test case удален из persistent suite.');
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Test remove failed');
    } finally {
      setTestMutationPending(false);
    }
  };

  const handleUnblockTestSuite = async () => {
    if (testMutationPending) {
      return;
    }

    setTestMutationPending(true);
    setBenchmarkStatus(null);
    setError(null);

    try {
      await unblockTestSuite();
      setBenchmarkStatus('Test suite block cleared manually.');
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Test unblock failed');
    } finally {
      setTestMutationPending(false);
    }
  };

  const runInspectorAction = async (action: () => Promise<void>, successMessage: string) => {
    if (inspectorPending) {
      return;
    }

    setInspectorPending(true);
    setBenchmarkStatus(null);
    setError(null);

    try {
      await action();
      setBenchmarkStatus(successMessage);
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Inspector action failed');
    } finally {
      setInspectorPending(false);
    }
  };

  const handleCreateCheckpoint = async () => {
    await runInspectorAction(async () => {
      const checkpoint = await createInspectorCheckpoint();
      setBenchmarkStatus(`Checkpoint created: ${checkpoint.id}.`);
    }, 'Inspector checkpoint created.');
  };

  const handleRollback = async (checkpointId: string) => {
    await runInspectorAction(async () => {
      await rollbackInspectorCheckpoint(checkpointId);
    }, `Rollback completed for ${checkpointId}.`);
  };

  const handleClearGradients = async () => {
    await runInspectorAction(async () => {
      const result = await clearPendingInspectorGradients();
      setBenchmarkStatus(`Pending gradients cleared: ${result.removedCount}. Remaining: ${result.pendingAfter}.`);
    }, 'Pending gradients cleared.');
  };

  const handleToggleLearning = async (enabled: boolean) => {
    await runInspectorAction(async () => {
      await toggleInspectorLearning(enabled);
    }, `Learning ${enabled ? 'enabled' : 'disabled'} manually.`);
  };

  const handleUpdateResonanceThresholds = async () => {
    await runInspectorAction(async () => {
      const thresholds = await updateInspectorResonanceThresholds({
        low: Number(resonanceLowInput),
        recovery: Number(resonanceRecoveryInput),
      });
      setBenchmarkStatus(`Resonance thresholds updated to ${thresholds.low}/${thresholds.recovery}.`);
    }, 'Resonance thresholds updated.');
  };

  const handleUpdateTestThreshold = async () => {
    await runInspectorAction(async () => {
      const threshold = await updateInspectorTestSuiteThreshold(Number(suiteThresholdInput));
      setBenchmarkStatus(`Test suite threshold updated to ${threshold.threshold}.`);
    }, 'Test suite threshold updated.');
  };

  return (
    <section className="panel learning-state-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Inspectable State</p>
          <h2>Ledger и Rishi</h2>
        </div>
        <span className="panel-meta">
          {loading ? 'syncing' : learningState?.lastUpdatedAt ?? 'waiting for server'}
        </span>
      </div>

      <div className="action-bar learning-action-bar">
        <button
          type="button"
          className="action-button action-button-secondary"
          onClick={handleTriggerCheckpoint}
          disabled={checkpointPending}
        >
          {checkpointPending ? 'Фиксируем checkpoint...' : 'Запустить Rishi checkpoint'}
        </button>
        <button
          type="button"
          className="action-button"
          onClick={handleProcessFeedback}
          disabled={feedbackLoopPending}
        >
          {feedbackLoopPending ? 'Обрабатываем feedback...' : 'Прогнать feedback loop'}
        </button>
        <button
          type="button"
          className="action-button action-button-secondary"
          onClick={handleApplyFeedback}
          disabled={feedbackApplyPending}
        >
          {feedbackApplyPending ? 'Применяем gradients...' : 'Применить feedback gradients'}
        </button>
        <button
          type="button"
          className="action-button"
          onClick={handleRunBenchmark}
          disabled={benchmarkPending}
        >
          {benchmarkPending ? 'Запускаем test set...' : 'Запустить test set'}
        </button>
        <button
          type="button"
          className="action-button action-button-secondary"
          onClick={handleCheckResonance}
          disabled={resonancePending}
        >
          {resonancePending ? 'Считаем resonance...' : 'Проверить resonance'}
        </button>
      </div>

      {error ? <p className="console-error">{error}</p> : null}
      {benchmarkStatus ? <p className="learning-report-copy">{benchmarkStatus}</p> : null}

      <div className="learning-state-grid">
        <article className="runtime-stat">
          <span>Cycles</span>
          <strong>{learningState?.stats.cycleCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Dialog Runs</span>
          <strong>{learningState?.stats.dialogRunCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Memory Shards</span>
          <strong>{learningState?.stats.memoryShardCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Facts</span>
          <strong>{learningState?.stats.factCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Error Journal</span>
          <strong>{learningState?.stats.errorJournalCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Nightly Runs</span>
          <strong>{learningState?.stats.nightlyRunCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Rishi Checkpoints</span>
          <strong>{learningState?.stats.rishiCheckpointCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Checkpoint Snapshots</span>
          <strong>{learningState?.stats.checkpointSnapshotCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Feedback</span>
          <strong>{learningState?.stats.feedbackCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Feedback Ratio</span>
          <strong>{learningState?.stats.positiveFeedbackRatio ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Feedback Gradients</span>
          <strong>{learningState?.stats.feedbackGradientCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Pending Gradients</span>
          <strong>{learningState?.stats.pendingFeedbackGradientCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Applied Gradients</span>
          <strong>{learningState?.stats.appliedFeedbackGradientCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Research Runs</span>
          <strong>{learningState?.stats.researchRunCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Validation Runs</span>
          <strong>{learningState?.stats.validationRunCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Validation Failures</span>
          <strong>{learningState?.stats.validationFailureCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Navigation Runs</span>
          <strong>{learningState?.stats.navigationRunCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Validation Avg</span>
          <strong>{learningState?.stats.validationAverageScore ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Resonance Events</span>
          <strong>{learningState?.stats.resonanceEventCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Benchmarks</span>
          <strong>{learningState?.stats.benchmarkRunCount ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Benchmark Avg</span>
          <strong>{learningState?.stats.benchmarkAverageScore ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Validation Pressure</span>
          <strong>{learningState?.learningControl.currentValidationPressure ?? 0}</strong>
        </article>
        <article className="runtime-stat">
          <span>Test Suite Block</span>
          <strong>{learningState?.stats.testSuiteBlocked ? 'yes' : 'no'}</strong>
        </article>
        <article className="runtime-stat">
          <span>Manual Learning Pause</span>
          <strong>{learningState?.stats.manualLearningPaused ? 'yes' : 'no'}</strong>
        </article>
        <article className="runtime-stat">
          <span>Inspector Actions</span>
          <strong>{learningState?.stats.inspectorActionCount ?? 0}</strong>
        </article>
      </div>

      <div className="learning-state-columns">
        <div className="learning-state-stack">
          <article className="learning-report-card">
            <strong>Recent cycle</strong>
            <p className="learning-report-copy">
              {latestCycle?.summary ?? 'Нет записанных циклов самообучения.'}
            </p>
            <p className="learning-report-copy">
              Shiva gate:{' '}
              {latestCycle?.policy.reason ?? 'Ожидается первое решение policy gate.'}
            </p>
          </article>

          <article className="learning-report-card">
            <strong>Night distillation</strong>
            <p className="learning-report-copy">
              {latestNightlyRun?.summary ?? 'Фоновая дистилляция еще не выполнялась.'}
            </p>
          </article>

          <article className="learning-report-card">
            <strong>Latest benchmark</strong>
            <p className="learning-report-copy">
              {latestBenchmarkRun
                ? `${latestBenchmarkRun.suite}: ${latestBenchmarkRun.score}`
                : 'Benchmark suite еще не запускался.'}
            </p>
            <p className="learning-report-copy">
              Learning block from run: {latestBenchmarkRun?.blockedLearning ? 'yes' : 'no'}
            </p>
            <div className="learning-list">
              {(latestBenchmarkRun?.cases ?? []).map((testCase) => (
                <div key={testCase.id} className="learning-list-item">
                  <span>{testCase.label}</span>
                  <strong>{testCase.passed ? 'pass' : 'fail'}</strong>
                  <p>Expected: {testCase.expected}. Actual: {testCase.actual}.</p>
                </div>
              ))}
            </div>
          </article>

          <article className="learning-report-card">
            <strong>Recent feedback</strong>
            <div className="learning-list">
              {recentFeedback.map((item) => (
                <div key={item.id} className="learning-list-item">
                  <span>{item.sentiment}</span>
                  <strong>{item.createdAt}</strong>
                  <p>{item.reason ?? 'Причина не указана.'}</p>
                </div>
              ))}
              {recentFeedback.length === 0 ? (
                <p className="learning-report-copy">Пока нет пользовательской обратной связи.</p>
              ) : null}
            </div>
          </article>

          <article className="learning-report-card">
            <strong>Feedback gradients</strong>
            <p className="learning-report-copy">
              Last processed: {learningState?.feedbackProcessing.lastProcessedAt ?? 'еще не запускался'}
            </p>
            <p className="learning-report-copy">
              Last applied: {learningState?.feedbackProcessing.lastAppliedAt ?? 'еще не запускался'}
            </p>
            <div className="learning-list">
              {recentFeedbackGradients.map((item) => (
                <div key={item.id} className="learning-list-item">
                  <span>{item.sentiment} / {item.applicationStatus}</span>
                  <strong>{item.weightShift > 0 ? '+' : ''}{item.weightShift.toFixed(2)}</strong>
                  <p>{item.reason ?? item.rationale}</p>
                  <p>{item.decisionReason ?? 'Ожидает применения через Shiva-gated loop.'}</p>
                </div>
              ))}
              {recentFeedbackGradients.length === 0 ? (
                <p className="learning-report-copy">Пока нет градиентов, выведенных из пользовательской оценки.</p>
              ) : null}
            </div>
          </article>

          <article className="learning-report-card">
            <strong>Pantheon Web Scout</strong>
            <p className="learning-report-copy">
              {latestResearchRun?.summary ?? 'Pantheon Web Scout еще не собирал внешние источники.'}
            </p>
            <p className="learning-report-copy">
              Status: {latestResearchRun?.status ?? 'unknown'}
            </p>
          </article>

          <article className="learning-report-card">
            <strong>Pantheon Validator</strong>
            <p className="learning-report-copy">
              {latestValidationRun?.summary ?? 'Pantheon Validator еще не запускался.'}
            </p>
            <p className="learning-report-copy">
              Verdict: {latestValidationRun?.verdict ?? 'unknown'} / score {latestValidationRun?.score ?? 0}
            </p>
            <p className="learning-report-copy">
              Fact matches: {latestValidationRun?.factMatchCount ?? 0}
            </p>
            <p className="learning-report-copy">
              Pressure: {latestValidationRun?.pressureProfile.overallPressure ?? learningState?.learningControl.currentValidationPressure ?? 0} / uncertainty {latestValidationRun?.uncertaintyPosture ?? 'unknown'}
            </p>
            {latestValidationRun?.failureReasons.length ? (
              <div className="learning-list">
                {latestValidationRun.failureReasons.map((reason) => (
                  <div key={reason} className="learning-list-item">
                    <span>validator</span>
                    <p>{reason}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </article>

          <article className="learning-report-card">
            <strong>Pantheon Navigation Core</strong>
            <p className="learning-report-copy">
              {latestNavigationRun?.summary ?? 'Pantheon Navigation Core еще не запускался.'}
            </p>
            <p className="learning-report-copy">
              Status: {latestNavigationRun?.status ?? 'unknown'} / visited {latestNavigationRun?.visitedCount ?? 0} / blocked {latestNavigationRun?.blockedCount ?? 0}
            </p>
          </article>

          <article className="learning-report-card">
            <strong>Resonance with reality</strong>
            <p className="learning-report-copy">
              Score: {resonanceState?.currentResonance ?? rishiState?.resonanceScore ?? 0} / 1.00
            </p>
            <p className="learning-report-copy">
              Band: {rishiState?.resonanceBand ?? 'unknown'} / state {resonanceState?.state ?? 'unknown'}
            </p>
            <p className="learning-report-copy">
              Verification:{' '}
              {rishiState?.verificationSignals.join(', ') ?? 'ожидаются сигналы верификации'}
            </p>
            <p className="learning-report-copy">
              Learning paused: {learningState?.stats.learningPaused ? 'yes' : 'no'}
            </p>
            <p className="learning-report-copy">
              Pause reason: {resonanceState?.pauseReason ?? 'none'}
            </p>
            <p className="learning-report-copy">
              Validation pressure: {resonanceState?.validationPressure ?? learningState?.learningControl.currentValidationPressure ?? 0}
            </p>
          </article>
        </div>

        <div className="learning-state-stack">
          <article className="learning-report-card">
            <strong>Inspector Control Plane</strong>
            <p className="learning-report-copy">
              Learning blocked: {inspectorStatus?.learningBlocked ? 'yes' : 'no'}
            </p>
            <p className="learning-report-copy">
              Guards: manual={inspectorStatus?.guards.manual ? 'on' : 'off'} / resonance={inspectorStatus?.guards.resonance ? 'on' : 'off'} / test={inspectorStatus?.guards.testSuite ? 'on' : 'off'}
            </p>
            <p className="learning-report-copy">
              Pending gradients: {inspectorStatus?.pendingGradients ?? learningState?.stats.pendingFeedbackGradientCount ?? 0}
            </p>
            <div className="action-bar learning-action-bar test-suite-controls">
              <button type="button" className="action-button" onClick={handleCreateCheckpoint} disabled={inspectorPending}>
                {inspectorPending ? 'Фиксируем checkpoint...' : 'Create checkpoint'}
              </button>
              <button type="button" className="action-button action-button-secondary" onClick={handleClearGradients} disabled={inspectorPending}>
                {inspectorPending ? 'Очищаем gradients...' : 'Clear pending gradients'}
              </button>
              <button type="button" className="action-button" onClick={() => { void handleToggleLearning(false); }} disabled={inspectorPending || inspectorStatus?.guards.manual}>
                Manual pause learning
              </button>
              <button type="button" className="action-button action-button-secondary" onClick={() => { void handleToggleLearning(true); }} disabled={inspectorPending || !inspectorStatus?.guards.manual}>
                Resume learning
              </button>
            </div>
            <div className="test-suite-inline-fields inspector-threshold-grid">
              <label className="test-suite-field">
                <span>Resonance Low</span>
                <input className="feedback-reason-input" type="number" min="0" max="1" step="0.05" value={resonanceLowInput} onChange={(event) => setResonanceLowInput(event.target.value)} />
              </label>
              <label className="test-suite-field">
                <span>Resonance Recovery</span>
                <input className="feedback-reason-input" type="number" min="0" max="1" step="0.05" value={resonanceRecoveryInput} onChange={(event) => setResonanceRecoveryInput(event.target.value)} />
              </label>
            </div>
            <div className="action-bar learning-action-bar test-suite-controls">
              <button type="button" className="action-button" onClick={handleUpdateResonanceThresholds} disabled={inspectorPending}>
                Update resonance thresholds
              </button>
            </div>
            <div className="test-suite-inline-fields inspector-threshold-grid">
              <label className="test-suite-field">
                <span>Test Threshold</span>
                <input className="feedback-reason-input" type="number" min="0" max="1" step="0.05" value={suiteThresholdInput} onChange={(event) => setSuiteThresholdInput(event.target.value)} />
              </label>
            </div>
            <div className="action-bar learning-action-bar test-suite-controls">
              <button type="button" className="action-button action-button-secondary" onClick={handleUpdateTestThreshold} disabled={inspectorPending}>
                Update test threshold
              </button>
            </div>
          </article>

          <article className="learning-report-card">
            <strong>Test Suite Judge</strong>
            <p className="learning-report-copy">
              Blocked: {testSuiteState?.blocked ? 'yes' : 'no'} / threshold {testSuiteState?.accuracyThreshold ?? 0.7}
            </p>
            <p className="learning-report-copy">
              Last accuracy: {testSuiteState?.lastAccuracy ?? learningState?.learningControl.lastTestSuiteAccuracy ?? 'n/a'}
            </p>
            <p className="learning-report-copy">
              Last run: {testSuiteState?.lastRunAt ?? learningState?.learningControl.lastTestSuiteRunAt ?? 'еще не запускался'}
            </p>
            <p className="learning-report-copy">
              Block reason: {learningState?.learningControl.testSuiteBlockReason ?? 'none'}
            </p>
            <div className="action-bar learning-action-bar test-suite-controls">
              <button
                type="button"
                className="action-button"
                onClick={handleRunBenchmark}
                disabled={benchmarkPending}
              >
                {benchmarkPending ? 'Запускаем suite...' : 'Прогнать suite сейчас'}
              </button>
              <button
                type="button"
                className="action-button action-button-secondary"
                onClick={handleUnblockTestSuite}
                disabled={testMutationPending || !testSuiteState?.blocked}
              >
                {testMutationPending ? 'Снимаем блок...' : 'Снять test block'}
              </button>
            </div>
            <div className="test-suite-form">
              <textarea
                className="feedback-reason-input test-suite-textarea"
                placeholder="Новый вопрос для test suite"
                value={newTestQuestion}
                onChange={(event) => setNewTestQuestion(event.target.value)}
                rows={3}
              />
              <textarea
                className="feedback-reason-input test-suite-textarea"
                placeholder="Эталонный ответ или regex/includes якорь"
                value={newTestAnswer}
                onChange={(event) => setNewTestAnswer(event.target.value)}
                rows={3}
              />
              <div className="test-suite-inline-fields">
                <label className="test-suite-field">
                  <span>Match</span>
                  <select
                    className="feedback-reason-input test-suite-select"
                    value={newTestMatchStrategy}
                    onChange={(event) => setNewTestMatchStrategy(event.target.value as TestSuiteMatchStrategy)}
                  >
                    <option value="includes">includes</option>
                    <option value="equals">equals</option>
                    <option value="regex">regex</option>
                    <option value="similarity">similarity</option>
                  </select>
                </label>
                <label className="test-suite-field">
                  <span>Threshold</span>
                  <input
                    className="feedback-reason-input"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={newTestThreshold}
                    onChange={(event) => setNewTestThreshold(event.target.value)}
                  />
                </label>
              </div>
              <button
                type="button"
                className="action-button"
                onClick={handleAddTest}
                disabled={testMutationPending}
              >
                {testMutationPending ? 'Сохраняем test case...' : 'Добавить test case'}
              </button>
            </div>
            <div className="learning-list">
              {(testSuiteState?.tests ?? []).map((testCase) => (
                <div key={testCase.id} className="learning-list-item test-suite-item">
                  <span>{testCase.matchStrategy}</span>
                  <strong>{testCase.question}</strong>
                  <p>{testCase.answer}</p>
                  <p>threshold {testCase.threshold} / task {testCase.taskId} / provider {testCase.providerId}</p>
                  <button
                    type="button"
                    className="action-button action-button-secondary test-suite-remove"
                    onClick={() => {
                      void handleRemoveTest(testCase.id);
                    }}
                    disabled={testMutationPending}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {testSuiteState?.tests.length ? null : (
                <p className="learning-report-copy">Persistent suite пока пуста. Добавьте golden question и expected answer вручную.</p>
              )}
            </div>
          </article>

          <article className="learning-report-card">
            <strong>Rishi recommendation</strong>
            <p className="learning-report-copy">
              {rishiState?.recommendedAction ?? 'Rishi еще не собрал достаточно сигналов.'}
            </p>
            <p className="learning-report-copy">
              Rollback ready: {rishiState?.rollbackReady ? 'yes' : 'no'}
            </p>
            <p className="learning-report-copy">
              Last checkpoint:{' '}
              {latestRishiCheckpoint?.createdAt ?? 'checkpoint еще не записан'}
            </p>
          </article>

          <article className="learning-report-card">
            <strong>Rishi gradients</strong>
            <div className="learning-list">
              {(rishiState?.gradients ?? []).slice(0, 3).map((gradient) => (
                <div key={gradient.id} className="learning-list-item">
                  <span>{gradient.target}</span>
                  <strong>{gradient.weightShift > 0 ? '+' : ''}{gradient.weightShift.toFixed(2)}</strong>
                  <p>{gradient.rationale}</p>
                </div>
              ))}
              {rishiState?.gradients.length ? null : <p className="learning-report-copy">Пока нет рассчитанных дельт.</p>}
            </div>
          </article>

          <article className="learning-report-card">
            <strong>Latest Rishi checkpoints</strong>
            <div className="learning-list">
              {(inspectorMetrics?.checkpoints ?? []).map((checkpoint) => (
                <div key={checkpoint.id} className="learning-list-item test-suite-item">
                  <span>{checkpoint.trigger}</span>
                  <strong>{checkpoint.id}</strong>
                  <p>{checkpoint.createdAt}</p>
                  <p>resonance {checkpoint.resonanceScore ?? 'n/a'} / rollbackReady {checkpoint.rollbackReady ? 'yes' : 'no'}</p>
                  <button
                    type="button"
                    className="action-button action-button-secondary test-suite-remove"
                    onClick={() => {
                      void handleRollback(checkpoint.id);
                    }}
                    disabled={inspectorPending}
                  >
                    Rollback to checkpoint
                  </button>
                </div>
              ))}
              {inspectorMetrics?.checkpoints.length ? null : (
                <p className="learning-report-copy">Checkpoint history пока пуста.</p>
              )}
            </div>
          </article>

          <article className="learning-report-card">
            <strong>Resonance events</strong>
            <div className="learning-list">
              {(inspectorMetrics?.resonanceEvents ?? []).map((event) => (
                <div key={event.id} className="learning-list-item">
                  <span>{event.kind}</span>
                  <strong>{event.score ?? 'n/a'}</strong>
                  <p>{event.summary}</p>
                </div>
              ))}
              {inspectorMetrics?.resonanceEvents.length ? null : <p className="learning-report-copy">Resonance monitor еще не писал событий.</p>}
            </div>
          </article>

          <article className="learning-report-card">
            <strong>Inspector log</strong>
            <div className="learning-list">
              {(inspectorStatus?.recentLogs ?? []).map((entry) => (
                <div key={entry.id} className="learning-list-item">
                  <span>{entry.source}</span>
                  <strong>{entry.createdAt}</strong>
                  <p>{entry.summary}</p>
                  <p>{entry.detail ?? 'No extra detail.'}</p>
                </div>
              ))}
              {inspectorStatus?.recentLogs.length ? null : <p className="learning-report-copy">Inspector log еще пуст.</p>}
            </div>
          </article>

          <article className="learning-report-card">
            <strong>Validation incidents</strong>
            <div className="learning-list">
              {(inspectorMetrics?.validationIncidents ?? []).map((incident) => (
                <div key={incident.id} className="learning-list-item">
                  <span>{incident.verdict}</span>
                  <strong>{incident.createdAt}</strong>
                  <p>{incident.summary}</p>
                  <p>{incident.failureReasons.join(' | ') || 'No failure reasons.'}</p>
                </div>
              ))}
              {inspectorMetrics?.validationIncidents.length ? null : <p className="learning-report-copy">Validation incidents пока нет.</p>}
            </div>
          </article>

          <article className="learning-report-card">
            <strong>Information sources</strong>
            <div className="learning-list">
              {(rishiState?.informationSources ?? []).map((source) => (
                <div key={source} className="learning-list-item">
                  <span>source</span>
                  <p>{source}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="learning-report-card">
            <strong>Fact memory</strong>
            <div className="learning-list">
              {(learningState?.facts ?? []).slice(-3).reverse().map((fact) => (
                <div key={fact.id} className="learning-list-item">
                  <span>{fact.provenance}</span>
                  <strong>{fact.score}</strong>
                  <p>{fact.key}</p>
                  <p>{fact.source} / {fact.validationStatus}</p>
                </div>
              ))}
              {learningState?.facts.length ? null : <p className="learning-report-copy">Пока нет сохраненных фактов.</p>}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default LearningStatePanel;