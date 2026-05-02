import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultLedgerPath = path.join(__dirname, 'data', 'learning-ledger.json');

function createInitialLedger() {
  return {
    lastUpdatedAt: null,
    cycles: [],
    dialogRuns: [],
    memoryShards: [],
    facts: [],
    errorJournal: [],
    nightlyRuns: [],
    rishiCheckpoints: [],
    checkpointSnapshots: [],
    resonanceEvents: [],
    inspectorActions: [],
    feedbackEvents: [],
    feedbackGradients: [],
    validationIncidents: [],
    atmanEvents: [],
    learningControl: {
      currentResonance: null,
      resonanceState: 'normal',
      pausedUntil: null,
      pauseReason: null,
      manualLearningPaused: false,
      manualPauseReason: null,
      lastResonanceCheckAt: null,
      lastRollbackAt: null,
      lastRollbackCheckpointId: null,
      currentValidationPressure: null,
      testSuiteBlocked: false,
      testSuiteBlockReason: null,
      lastTestSuiteRunAt: null,
      lastTestSuiteAccuracy: null,
    },
    feedbackProcessing: {
      processedFeedbackIds: [],
      lastProcessedAt: null,
      lastAppliedAt: null,
    },
    researchRuns: [],
    validationRuns: [],
    navigationRuns: [],
    netsurferRuns: [],
    benchmarkRuns: [],
  };
}

function dedupeById(entries, maxEntries) {
  const seen = new Set();
  const ordered = [];

  for (const entry of [...entries].reverse()) {
    if (seen.has(entry.id)) {
      continue;
    }

    seen.add(entry.id);
    ordered.push(entry);
  }

  return ordered.reverse().slice(-maxEntries);
}

function dedupeValues(values, maxEntries) {
  return [...new Set(values)].slice(-maxEntries);
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeKeywords(keywords) {
  return [...new Set(
    (keywords ?? [])
      .map((keyword) => normalizeText(keyword))
      .filter((keyword) => keyword.length > 2),
  )];
}

export class LearningLedger {
  constructor(options = {}) {
    this.ledgerPath = options.ledgerPath ?? defaultLedgerPath;
    this.maxCycles = options.maxCycles ?? 60;
    this.maxDialogRuns = options.maxDialogRuns ?? 120;
    this.maxMemoryShards = options.maxMemoryShards ?? 120;
    this.maxFacts = options.maxFacts ?? 200;
    this.maxJournalEntries = options.maxJournalEntries ?? 120;
    this.maxCheckpointSnapshots = options.maxCheckpointSnapshots ?? 60;
    this.maxResonanceEvents = options.maxResonanceEvents ?? 120;
    this.maxFeedbackGradients = options.maxFeedbackGradients ?? 120;
    this.maxValidationIncidents = options.maxValidationIncidents ?? 120;
    this.maxInspectorActions = options.maxInspectorActions ?? 120;
    this.maxProcessedFeedbackIds = options.maxProcessedFeedbackIds ?? 300;
    this.maxAtmanEvents = options.maxAtmanEvents ?? 240;
    this.state = createInitialLedger();
  }

  async init() {
    await mkdir(path.dirname(this.ledgerPath), { recursive: true });

    try {
      const raw = await readFile(this.ledgerPath, 'utf8');
      this.state = {
        ...createInitialLedger(),
        ...JSON.parse(raw),
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        throw error;
      }

      await this.flush();
    }

    return this.state;
  }

  async flush() {
    this.pruneExpiredFacts();
    this.state.lastUpdatedAt = new Date().toISOString();
    await writeFile(this.ledgerPath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
  }

  pruneExpiredFacts(now = Date.now()) {
    this.state.facts = (this.state.facts ?? []).filter((fact) => fact.expiresAt > now);
  }

  async storeFact(fact) {
    const ttlMs = Math.max(1000, Number(fact.ttlMs ?? 86400000));
    const now = Date.now();
    const nextFact = {
      id: fact.id ?? `fact-${now}`,
      createdAt: new Date(now).toISOString(),
      key: String(fact.key ?? '').trim(),
      value: String(fact.value ?? '').trim(),
      score: Number(Math.max(0, Math.min(1, Number(fact.score ?? 1))).toFixed(2)),
      source: fact.source ?? 'manual-fact',
      claimType: fact.claimType ?? 'fact',
      provenance: fact.provenance ?? 'manual',
      validationStatus: fact.validationStatus ?? 'unverified',
      lastValidatedAt: fact.lastValidatedAt ?? null,
      expiresAt: now + ttlMs,
    };

    this.pruneExpiredFacts(now);
    this.state.facts = dedupeById([...this.state.facts, nextFact], this.maxFacts);
    await this.flush();
    return nextFact;
  }

  recallFactsByKeywords(keywords, options = {}) {
    const normalizedKeywords = normalizeKeywords(keywords);
    const limit = options.limit ?? 10;
    const minScore = options.minScore ?? 0;
    const now = Date.now();

    this.pruneExpiredFacts(now);

    if (normalizedKeywords.length === 0) {
      return [];
    }

    return this.state.facts
      .filter((fact) => fact.score >= minScore)
      .filter((fact) => {
        const key = normalizeText(fact.key);
        const value = normalizeText(fact.value);
        return normalizedKeywords.some((keyword) => key.includes(keyword) || value.includes(keyword));
      })
      .sort((left, right) => right.score - left.score || right.expiresAt - left.expiresAt)
      .slice(0, limit);
  }

  async recordDialogRun(dialogRun) {
    this.state.dialogRuns = [
      ...this.state.dialogRuns,
      {
        id: dialogRun.id ?? `dialog-${Date.now()}`,
        createdAt: dialogRun.createdAt ?? new Date().toISOString(),
        ...dialogRun,
      },
    ].slice(-this.maxDialogRuns);
    await this.flush();
    return this.state;
  }

  async recordCycle(report, metadata = {}) {
    this.state.cycles = [
      ...this.state.cycles,
      {
        id: `cycle-${Date.now()}`,
        createdAt: new Date().toISOString(),
        taskId: metadata.taskId ?? report.taskId ?? 'unknown-task',
        providerId: metadata.providerId ?? 'unknown-provider',
        runtimeSource: metadata.runtimeSource ?? 'unknown-runtime',
        summary: report.summary,
        loop: report.loop,
        candidatePatch: report.candidatePatch,
        policy: report.policy,
      },
    ].slice(-this.maxCycles);

    this.state.memoryShards = dedupeById(
      [...this.state.memoryShards, ...report.memoryShards],
      this.maxMemoryShards,
    );
    this.state.errorJournal = dedupeById(
      [...this.state.errorJournal, ...report.errorJournal],
      this.maxJournalEntries,
    );
    await this.flush();
    return this.state;
  }

  async recordNightlyRun(report) {
    this.state.nightlyRuns = [
      ...this.state.nightlyRuns,
      {
        id: `night-${Date.now()}`,
        createdAt: new Date().toISOString(),
        summary: report.summary,
        policy: report.policy,
        candidatePatch: report.candidatePatch,
        memoryShardCount: report.memoryShards.length,
        journalCount: report.errorJournal.length,
      },
    ].slice(-30);

    this.state.memoryShards = dedupeById(
      [...this.state.memoryShards, ...report.memoryShards],
      this.maxMemoryShards,
    );
    this.state.errorJournal = dedupeById(
      [...this.state.errorJournal, ...report.errorJournal],
      this.maxJournalEntries,
    );
    await this.flush();
    return this.state;
  }

  async recordRishiCheckpoint(state, metadata = {}) {
    this.state.rishiCheckpoints = [
      ...this.state.rishiCheckpoints,
      {
        id: `rishi-${Date.now()}`,
        createdAt: new Date().toISOString(),
        trigger: metadata.trigger ?? 'scheduled-inspection',
        resonanceScore: state.resonanceScore ?? null,
        checkpointSnapshotId: metadata.checkpointSnapshotId ?? null,
        recommendedAction: state.recommendedAction,
        rollbackReady: state.rollbackReady,
        gradientCount: state.gradients.length,
        insightCount: state.insights.length,
        gradients: state.gradients,
        insights: state.insights,
      },
    ].slice(-40);

    await this.flush();
    return this.state;
  }

  async recordCheckpointSnapshot(snapshot, metadata = {}) {
    const checkpoint = {
      id: metadata.id ?? `checkpoint-${Date.now()}`,
      createdAt: metadata.createdAt ?? new Date().toISOString(),
      trigger: metadata.trigger ?? 'scheduled-rishi-checkpoint',
      resonanceScore: metadata.resonanceScore ?? null,
      rollbackReady: metadata.rollbackReady ?? true,
      learningState: {
        memoryShards: snapshot.memoryShards,
        facts: snapshot.facts,
        feedbackGradients: snapshot.feedbackGradients,
        validationIncidents: snapshot.validationIncidents,
        feedbackProcessing: snapshot.feedbackProcessing,
      },
    };

    this.state.checkpointSnapshots = [
      ...this.state.checkpointSnapshots,
      checkpoint,
    ].slice(-this.maxCheckpointSnapshots);
    await this.flush();
    return checkpoint;
  }

  getLastGoodCheckpoint(minResonance = 0.7) {
    return [...(this.state.checkpointSnapshots ?? [])]
      .reverse()
      .find((checkpoint) => checkpoint.rollbackReady && (checkpoint.resonanceScore ?? 0) >= minResonance) ?? null;
  }

  async restoreCheckpoint(checkpointId) {
    const checkpoint = (this.state.checkpointSnapshots ?? []).find((item) => item.id === checkpointId);

    if (!checkpoint) {
      return null;
    }

    this.state.memoryShards = checkpoint.learningState.memoryShards ?? [];
    this.state.facts = checkpoint.learningState.facts ?? [];
    this.state.feedbackGradients = checkpoint.learningState.feedbackGradients ?? [];
    this.state.validationIncidents = dedupeById(
      [
        ...(checkpoint.learningState.validationIncidents ?? []),
        ...(this.state.validationIncidents ?? []),
      ],
      this.maxValidationIncidents,
    );
    this.state.feedbackProcessing = checkpoint.learningState.feedbackProcessing ?? createInitialLedger().feedbackProcessing;
    this.state.learningControl = {
      ...this.state.learningControl,
      lastRollbackAt: new Date().toISOString(),
      lastRollbackCheckpointId: checkpoint.id,
    };

    await this.flush();
    return checkpoint;
  }

  async recordFeedback(feedback) {
    const feedbackEvent = {
      id: `feedback-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...feedback,
    };

    this.state.feedbackEvents = [...this.state.feedbackEvents, feedbackEvent].slice(-100);

    await this.flush();
    return feedbackEvent;
  }

  getUnprocessedFeedbackEvents() {
    const processedIds = new Set(this.state.feedbackProcessing.processedFeedbackIds ?? []);
    return this.state.feedbackEvents.filter((event) => !processedIds.has(event.id));
  }

  async recordFeedbackGradients(gradients, metadata = {}) {
    this.state.feedbackGradients = dedupeById(
      [
        ...this.state.feedbackGradients,
        ...gradients.map((gradient) => ({
          applied: false,
          appliedAt: null,
          applicationStatus: 'pending',
          decisionReason: null,
          ...gradient,
        })),
      ],
      this.maxFeedbackGradients,
    );
    this.state.feedbackProcessing = {
      processedFeedbackIds: dedupeValues(
        [
          ...(this.state.feedbackProcessing.processedFeedbackIds ?? []),
          ...gradients.map((gradient) => gradient.feedbackEventId).filter(Boolean),
        ],
        this.maxProcessedFeedbackIds,
      ),
      lastProcessedAt: metadata.processedAt ?? new Date().toISOString(),
      lastAppliedAt: this.state.feedbackProcessing.lastAppliedAt ?? null,
    };

    await this.flush();
    return this.state;
  }

  getPendingFeedbackGradients() {
    return this.state.feedbackGradients.filter((gradient) => gradient.applicationStatus === 'pending');
  }

  async applyFeedbackGradientDecisions(decisions, metadata = {}) {
    const decisionsById = new Map(decisions.map((decision) => [decision.id, decision]));

    this.state.feedbackGradients = this.state.feedbackGradients.map((gradient) => {
      const decision = decisionsById.get(gradient.id);

      if (!decision) {
        return gradient;
      }

      const applied = decision.applicationStatus === 'applied';

      return {
        ...gradient,
        applied,
        appliedAt: applied ? decision.appliedAt ?? metadata.appliedAt ?? new Date().toISOString() : null,
        applicationStatus: decision.applicationStatus,
        decisionReason: decision.decisionReason,
      };
    });

    this.state.feedbackProcessing = {
      ...this.state.feedbackProcessing,
      lastAppliedAt: metadata.appliedAt ?? new Date().toISOString(),
    };

    await this.flush();
    return this.state;
  }

  async clearPendingFeedbackGradients(metadata = {}) {
    const beforeCount = this.state.feedbackGradients.length;

    this.state.feedbackGradients = this.state.feedbackGradients.filter(
      (gradient) => gradient.applicationStatus !== 'pending',
    );

    this.state.feedbackProcessing = {
      ...this.state.feedbackProcessing,
      lastAppliedAt: metadata.clearedAt ?? new Date().toISOString(),
    };

    await this.flush();

    return {
      removedCount: beforeCount - this.state.feedbackGradients.length,
      pendingAfter: this.getPendingFeedbackGradients().length,
    };
  }

  async recordResearchRun(run) {
    this.state.researchRuns = [...this.state.researchRuns, run].slice(-40);
    await this.flush();
    return this.state;
  }

  async recordValidationRun(run) {
    this.state.validationRuns = [...this.state.validationRuns, run].slice(-60);
    await this.flush();
    return this.state;
  }

  async recordValidationIncident(incident) {
    this.state.validationIncidents = [
      ...this.state.validationIncidents,
      {
        id: incident.id ?? `validation-incident-${Date.now()}`,
        createdAt: incident.createdAt ?? new Date().toISOString(),
        ...incident,
      },
    ].slice(-this.maxValidationIncidents);
    await this.flush();
    return this.state;
  }

  async recordResonanceEvent(event) {
    this.state.resonanceEvents = [
      ...this.state.resonanceEvents,
      {
        id: event.id ?? `resonance-event-${Date.now()}`,
        createdAt: event.createdAt ?? new Date().toISOString(),
        ...event,
      },
    ].slice(-this.maxResonanceEvents);
    await this.flush();
    return this.state;
  }

  async recordInspectorAction(action) {
    this.state.inspectorActions = [
      ...this.state.inspectorActions,
      {
        id: action.id ?? `inspector-action-${Date.now()}`,
        createdAt: action.createdAt ?? new Date().toISOString(),
        details: action.details ?? null,
        ...action,
      },
    ].slice(-this.maxInspectorActions);
    await this.flush();
    return this.state;
  }

  async updateLearningControl(patch) {
    this.state.learningControl = {
      ...this.state.learningControl,
      ...patch,
    };
    await this.flush();
    return this.state.learningControl;
  }

  async recordNavigationRun(run) {
    this.state.navigationRuns = [...this.state.navigationRuns, run].slice(-40);
    await this.flush();
    return this.state;
  }

  async recordNetSurferRun(run) {
    this.state.netsurferRuns = [...(this.state.netsurferRuns ?? []), run].slice(-40);
    await this.flush();
    return this.state;
  }

  async recordBenchmarkRun(run) {
    this.state.benchmarkRuns = [...this.state.benchmarkRuns, run].slice(-30);
    await this.flush();
    return this.state;
  }

  async recordAtmanEvent(event) {
    this.state.atmanEvents = dedupeById(
      [
        ...(this.state.atmanEvents ?? []),
        {
          id: event.id ?? `atman-event-${Date.now()}`,
          createdAt: event.createdAt ?? new Date().toISOString(),
          kind: event.kind ?? 'personality-updated',
          personalityId: event.personalityId ?? null,
          displayName: event.displayName ?? null,
          templateId: event.templateId ?? null,
          changedFields: Array.isArray(event.changedFields)
            ? event.changedFields.slice(0, 12)
            : [],
          payload: event.payload ?? null,
        },
      ],
      this.maxAtmanEvents
    );
    await this.flush();
    return this.state;
  }

  getAtmanEvents(options = {}) {
    const personalityId = options.personalityId
      ? String(options.personalityId).trim().toLowerCase()
      : null;
    const kind = options.kind ? String(options.kind).trim() : null;
    const limit = Math.max(1, Math.min(100, Number(options.limit ?? 20) || 20));
    const events = (this.state.atmanEvents ?? []).filter((entry) => {
      if (personalityId && String(entry.personalityId ?? '').toLowerCase() !== personalityId) {
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

  getSnapshot() {
    this.pruneExpiredFacts();
    const positiveFeedbackCount = this.state.feedbackEvents.filter((event) => event.sentiment === 'positive').length;
    const appliedFeedbackGradientCount = this.state.feedbackGradients.filter((gradient) => gradient.applicationStatus === 'applied').length;
    const pendingFeedbackGradientCount = this.state.feedbackGradients.filter((gradient) => gradient.applicationStatus === 'pending').length;
    const validationFailureCount = this.state.validationRuns.filter((run) => run.verdict !== 'pass').length;
    const validationAverageScore = this.state.validationRuns.length > 0
      ? Number((this.state.validationRuns.reduce((sum, run) => sum + run.score, 0) / this.state.validationRuns.length).toFixed(2))
      : 0;
    const benchmarkAverageScore = this.state.benchmarkRuns.length > 0
      ? Number((this.state.benchmarkRuns.reduce((sum, run) => sum + run.score, 0) / this.state.benchmarkRuns.length).toFixed(2))
      : 0;

    return {
      ...this.state,
      stats: {
        cycleCount: this.state.cycles.length,
        dialogRunCount: this.state.dialogRuns.length,
        memoryShardCount: this.state.memoryShards.length,
        factCount: this.state.facts.length,
        errorJournalCount: this.state.errorJournal.length,
        nightlyRunCount: this.state.nightlyRuns.length,
        rishiCheckpointCount: this.state.rishiCheckpoints.length,
        checkpointSnapshotCount: this.state.checkpointSnapshots.length,
        resonanceEventCount: this.state.resonanceEvents.length,
        feedbackCount: this.state.feedbackEvents.length,
        positiveFeedbackRatio: this.state.feedbackEvents.length > 0
          ? Number((positiveFeedbackCount / this.state.feedbackEvents.length).toFixed(2))
          : 0,
        feedbackGradientCount: this.state.feedbackGradients.length,
        pendingFeedbackGradientCount,
        appliedFeedbackGradientCount,
        researchRunCount: this.state.researchRuns.length,
        validationRunCount: this.state.validationRuns.length,
        validationFailureCount,
        validationAverageScore,
        navigationRunCount: this.state.navigationRuns.length,
        netsurferRunCount: (this.state.netsurferRuns ?? []).length,
        benchmarkRunCount: this.state.benchmarkRuns.length,
        benchmarkAverageScore,
        atmanEventCount: (this.state.atmanEvents ?? []).length,
        learningPaused: Boolean(this.state.learningControl.pausedUntil && this.state.learningControl.pausedUntil > Date.now()),
        manualLearningPaused: Boolean(this.state.learningControl.manualLearningPaused),
        testSuiteBlocked: Boolean(this.state.learningControl.testSuiteBlocked),
        learningBlocked: Boolean(
          this.state.learningControl.manualLearningPaused
            ||
          (this.state.learningControl.pausedUntil && this.state.learningControl.pausedUntil > Date.now())
            || this.state.learningControl.testSuiteBlocked,
        ),
        inspectorActionCount: this.state.inspectorActions.length,
      },
    };
  }
}