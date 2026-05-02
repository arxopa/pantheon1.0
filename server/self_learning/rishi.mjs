import { ControlCorePolicyGate } from '../core/control-core.mjs';

export class Rishi {
  constructor() {
    this.policyGate = new ControlCorePolicyGate();
  }

  inspect(ledgerSnapshot) {
    const recentCycles = ledgerSnapshot.cycles.slice(-5);
    const recentJournal = ledgerSnapshot.errorJournal.slice(-5);
    const recentFeedback = ledgerSnapshot.feedbackEvents.slice(-8);
    const recentFeedbackGradients = ledgerSnapshot.feedbackGradients.slice(-8);
    const recentValidationIncidents = ledgerSnapshot.validationIncidents.slice(-6);
    const recentAppliedFeedbackGradients = recentFeedbackGradients.filter((gradient) => gradient.applicationStatus === 'applied');
    const recentPendingFeedbackGradients = recentFeedbackGradients.filter((gradient) => gradient.applicationStatus === 'pending');
    const recentResearchRuns = ledgerSnapshot.researchRuns.slice(-3);
    const recentValidationRuns = ledgerSnapshot.validationRuns.slice(-3);
    const recentNavigationRuns = ledgerSnapshot.navigationRuns.slice(-3);
    const recentNetSurferRuns = (ledgerSnapshot.netsurferRuns ?? []).slice(-3);
    const recentBenchmarks = ledgerSnapshot.benchmarkRuns.slice(-3);
    const gradients = this.buildGradients(recentCycles, recentJournal, recentAppliedFeedbackGradients, recentValidationIncidents);
    const insights = this.buildInsights(
      recentCycles,
      recentJournal,
      ledgerSnapshot.nightlyRuns,
      recentFeedback,
      recentPendingFeedbackGradients,
      recentAppliedFeedbackGradients,
      recentValidationIncidents,
      recentResearchRuns,
      recentValidationRuns,
      recentNavigationRuns,
      recentNetSurferRuns,
      recentBenchmarks,
    );
    const resonance = this.assessResonance(
      recentCycles,
      recentJournal,
      insights,
      recentFeedback,
      recentPendingFeedbackGradients,
      recentAppliedFeedbackGradients,
      recentValidationIncidents,
      recentValidationRuns,
      recentBenchmarks,
    );

    return {
      generatedAt: new Date().toISOString(),
      gradients,
      insights,
      recommendedAction: this.pickRecommendation(gradients, insights, recentPendingFeedbackGradients.length),
      rollbackReady: recentCycles.every((cycle) => Boolean(cycle.policy.rollbackCheckpoint)),
      resonanceScore: resonance.score,
      resonanceBand: resonance.band,
      informationSources: this.listInformationSources(ledgerSnapshot),
      verificationSignals: this.listVerificationSignals(
        recentCycles,
        recentJournal,
        recentFeedback,
        recentPendingFeedbackGradients,
        recentAppliedFeedbackGradients,
        recentValidationIncidents,
        recentNavigationRuns,
        recentNetSurferRuns,
        recentBenchmarks,
      ),
    };
  }

  buildGradients(cycles, journal, feedbackGradients, validationIncidents) {
    const computePressure = cycles.filter((cycle) => cycle.candidatePatch.target === 'compute-core').length;
    const memoryPressure = cycles.filter((cycle) => cycle.candidatePatch.target === 'memory-ganga').length;
    const criticPressure = journal.filter((entry) => entry.severity !== 'info').length;
    const feedbackShift = feedbackGradients.reduce((sum, gradient) => sum + gradient.weightShift, 0);
    const validationPressure = validationIncidents.length;
    const validationGradientShift = feedbackGradients
      .filter((gradient) => gradient.source === 'validation')
      .reduce((sum, gradient) => sum + Math.abs(gradient.weightShift), 0);
    const negativeFeedbackShift = feedbackGradients
      .filter((gradient) => gradient.sentiment === 'negative')
      .reduce((sum, gradient) => sum + Math.abs(gradient.weightShift), 0);
    const positiveFeedbackShift = feedbackGradients
      .filter((gradient) => gradient.sentiment === 'positive')
      .reduce((sum, gradient) => sum + gradient.weightShift, 0);

    return [
      {
        id: 'rishi-compute-gradient',
        target: 'compute-core',
        weightShift: Number((computePressure * 0.08 - criticPressure * 0.03 + feedbackShift * 0.4 - validationPressure * 0.05).toFixed(2)),
        rationale: 'Сдвиг отражает частоту candidate patches Compute Core, critic-сигналы и явную пользовательскую обратную связь.',
      },
      {
        id: 'rishi-memory-gradient',
        target: 'memory-ganga',
        weightShift: Number((memoryPressure * 0.11 + journal.length * 0.02 + negativeFeedbackShift * 0.5 + validationGradientShift * 0.3).toFixed(2)),
        rationale: 'Рост веса памяти при накоплении циклов дистилляции, журнала ошибок и причин отрицательной оценки.',
      },
      {
        id: 'rishi-policy-gradient',
        target: 'trace-sentinel',
        weightShift: Number((criticPressure * 0.07 + positiveFeedbackShift * 0.15 + validationPressure * 0.16).toFixed(2)),
        rationale: 'Trace Sentinel получает повышенный вес при деградации и закрепляет подтвержденные пользователем режимы.',
      },
    ];
  }

  buildInsights(cycles, journal, nightlyRuns, feedbackEvents, pendingFeedbackGradients, appliedFeedbackGradients, validationIncidents, researchRuns, validationRuns, navigationRuns, netsurferRuns, benchmarkRuns) {
    const lastCycle = cycles.at(-1);
    const lastNightly = nightlyRuns.at(-1);
    const lastBenchmark = benchmarkRuns.at(-1);
    const lastAppliedFeedbackGradient = appliedFeedbackGradients.at(-1);
    const lastValidationIncident = validationIncidents.at(-1);
    const lastResearchRun = researchRuns.at(-1);
    const lastValidationRun = validationRuns.at(-1);
    const lastNavigationRun = navigationRuns.at(-1);
    const lastNetSurferRun = netsurferRuns.at(-1);
    const insights = [];

    if (lastCycle) {
      insights.push({
        id: 'rishi-last-cycle',
        kind: lastCycle.policy.approved ? 'stability' : 'degradation',
        summary: lastCycle.summary,
        evidence: lastCycle.policy.reason,
      });
    }

    if (journal.some((entry) => entry.severity === 'critical')) {
      insights.push({
        id: 'rishi-critical-journal',
        kind: 'degradation',
        summary: 'Rishi обнаружил критический critic-signal в журнале самообучения.',
        evidence: journal.filter((entry) => entry.severity === 'critical').map((entry) => entry.issue).join(' '),
      });
    }

    if (lastNightly) {
      insights.push({
        id: 'rishi-nightly',
        kind: 'opportunity',
        summary: 'Последний night distillation дал материал для нового memory shard.',
        evidence: lastNightly.summary,
      });
    }

    const negativeFeedback = feedbackEvents.filter((entry) => entry.sentiment === 'negative');

    if (negativeFeedback.length > 0) {
      insights.push({
        id: 'rishi-feedback',
        kind: 'degradation',
        summary: 'Пользовательская обратная связь содержит отрицательные оценки.',
        evidence: negativeFeedback.map((entry) => entry.reason ?? entry.messageId).join(' | '),
      });
    }

    if (pendingFeedbackGradients.length > 0) {
      insights.push({
        id: 'rishi-feedback-pending',
        kind: 'opportunity',
        summary: 'Есть pending feedback gradients, ожидающие применения через Rishi.',
        evidence: `${pendingFeedbackGradients.length} pending gradients await Shiva-gated apply.`,
      });
    }

    if (lastAppliedFeedbackGradient) {
      insights.push({
        id: 'rishi-feedback-gradient',
        kind: lastAppliedFeedbackGradient.sentiment === 'negative' ? 'degradation' : 'opportunity',
        summary: (lastAppliedFeedbackGradient.source ?? 'feedback') === 'validation'
          ? 'Rishi преобразовал validation failure в сильный corrective gradient.'
          : 'Rishi преобразовал явную обратную связь в reinforcement gradient.',
        evidence: `${lastAppliedFeedbackGradient.source ?? 'feedback'}/${lastAppliedFeedbackGradient.sentiment}: ${lastAppliedFeedbackGradient.reason ?? lastAppliedFeedbackGradient.messageId}`,
      });
    }

    if (lastValidationIncident) {
      insights.push({
        id: 'rishi-validation-incident',
        kind: 'degradation',
        summary: 'Validator зафиксировал инцидент truth-metrics и передал его в learning loop.',
        evidence: lastValidationIncident.failureReasons.join(' | ') || lastValidationIncident.summary,
      });
    }

    if (lastResearchRun) {
      insights.push({
        id: 'rishi-research',
        kind: lastResearchRun.status === 'completed' ? 'stability' : 'opportunity',
        summary: lastResearchRun.summary,
        evidence: lastResearchRun.findings.map((finding) => finding.url).join(' | ') || lastResearchRun.errors.join(' | '),
      });
    }

    if (lastValidationRun) {
      insights.push({
        id: 'rishi-validation',
        kind: lastValidationRun.verdict === 'fail' ? 'degradation' : lastValidationRun.verdict === 'warn' ? 'opportunity' : 'stability',
        summary: lastValidationRun.summary,
        evidence: lastValidationRun.checks.map((check) => `${check.label}: ${check.passed}`).join(' | '),
      });
    }

    if (lastNavigationRun) {
      insights.push({
        id: 'rishi-navigation',
        kind: lastNavigationRun.status === 'completed' ? 'stability' : 'opportunity',
        summary: lastNavigationRun.summary,
        evidence: lastNavigationRun.steps.map((step) => `${step.status}:${step.url}`).join(' | '),
      });
    }

    if (lastNetSurferRun) {
      insights.push({
        id: 'rishi-netsurfer',
        kind: lastNetSurferRun.status === 'completed' ? 'stability' : 'opportunity',
        summary: lastNetSurferRun.summary,
        evidence: [lastNetSurferRun.action, lastNetSurferRun.url, lastNetSurferRun.pageTitle, lastNetSurferRun.error].filter(Boolean).join(' | '),
      });
    }

    if (lastBenchmark) {
      insights.push({
        id: 'rishi-benchmark',
        kind: lastBenchmark.passed ? 'stability' : 'degradation',
        summary: `Последний benchmark-suite завершился со score ${lastBenchmark.score}.`,
        evidence: lastBenchmark.cases.map((item) => `${item.label}: ${item.actual}`).join(' | '),
      });
    }

    return insights;
  }

  pickRecommendation(gradients, insights, pendingFeedbackGradientCount = 0) {
    if (pendingFeedbackGradientCount > 0) {
      return `Сначала применить ${pendingFeedbackGradientCount} pending feedback gradients через Shiva-gated apply loop.`;
    }

    const largestGradient = [...gradients].sort((left, right) => Math.abs(right.weightShift) - Math.abs(left.weightShift))[0];
    const degradationSignal = insights.find((insight) => insight.kind === 'degradation');

    if (degradationSignal) {
      return `Сначала удержать rollback-aware режим и проверить ${largestGradient.target} через sandbox review.`;
    }

    return `Усилить ${largestGradient.target} и закрепить выводы Rishi в следующем Night Distillation цикле.`;
  }

  assessResonance(cycles, journal, insights, feedbackEvents, pendingFeedbackGradients, appliedFeedbackGradients, validationRuns, benchmarkRuns) {
    const approvedRatio = cycles.length > 0
      ? cycles.filter((cycle) => cycle.policy.approved).length / cycles.length
      : 1;
    const criticPenalty = Math.min(0.45, journal.filter((entry) => entry.severity !== 'info').length * 0.12);
    const degradationPenalty = insights.some((insight) => insight.kind === 'degradation') ? 0.2 : 0;
    const negativeFeedbackRatio = feedbackEvents.length > 0
      ? feedbackEvents.filter((entry) => entry.sentiment === 'negative').length / feedbackEvents.length
      : 0;
    const feedbackPenalty = Number((negativeFeedbackRatio * 0.3).toFixed(2));
    const processingPenalty = feedbackEvents.length > appliedFeedbackGradients.length && feedbackEvents.length > 0 ? 0.08 : 0;
    const applicationPenalty = pendingFeedbackGradients.length > 0 ? 0.06 : 0;
    const lastValidationScore = validationRuns.at(-1)?.score ?? 0.75;
    const validationBonus = Number(((lastValidationScore - 0.5) * 0.18).toFixed(2));
    const benchmarkScore = benchmarkRuns.at(-1)?.score ?? 1;
    const benchmarkBonus = Number(((benchmarkScore - 0.5) * 0.2).toFixed(2));
    const score = Number(
      Math.max(0, Math.min(1, approvedRatio - criticPenalty - degradationPenalty - feedbackPenalty - processingPenalty - applicationPenalty + validationBonus + benchmarkBonus)).toFixed(2),
    );

    return {
      score,
      band: score >= 0.75 ? 'stable' : score >= 0.45 ? 'questioning' : 'drifting',
    };
  }

  listInformationSources(ledgerSnapshot) {
    const sources = [
      'dialog turns from Agent Console history',
      'learning ledger cycles',
      'memory shards distilled by Mandala',
      'error journal from Reflective Critic Layer',
    ];

    if (ledgerSnapshot.nightlyRuns.length > 0) {
      sources.push('night distillation summaries');
    }

    if (ledgerSnapshot.feedbackEvents.length > 0) {
      sources.push('explicit user feedback events');
    }

    if (ledgerSnapshot.feedbackGradients.length > 0) {
      sources.push('feedback-derived reinforcement gradients');
    }

    if (ledgerSnapshot.feedbackGradients.some((gradient) => gradient.applicationStatus === 'applied')) {
      sources.push('Shiva-approved applied feedback gradients');
    }

    if (ledgerSnapshot.researchRuns.length > 0) {
      sources.push('Pantheon Web Scout evidence runs');
    }

    if (ledgerSnapshot.validationRuns.length > 0) {
      sources.push('Pantheon Validator truth checks');
    }

    if (ledgerSnapshot.validationIncidents.length > 0) {
      sources.push('validation failure incident log');
    }

    if (ledgerSnapshot.navigationRuns.length > 0) {
      sources.push('Pantheon Navigation Core session traces');
    }

    if ((ledgerSnapshot.netsurferRuns ?? []).length > 0) {
      sources.push('Pantheon NetSurfer browser traces');
    }

    if (ledgerSnapshot.benchmarkRuns.length > 0) {
      sources.push('linguistic benchmark suite');
    }

    return sources;
  }

  listVerificationSignals(cycles, journal, feedbackEvents, pendingFeedbackGradients, appliedFeedbackGradients, validationIncidents, navigationRuns, netsurferRuns, benchmarkRuns) {
    const signals = [
      'Shiva policy approval or denial',
      'rollback checkpoint availability',
      'critic severity trends',
    ];

    if (cycles.some((cycle) => cycle.runtimeSource === 'server')) {
      signals.push('live runtime execution traces');
    }

    if (journal.some((entry) => entry.severity === 'critical')) {
      signals.push('critical journal escalation');
    }

    if (feedbackEvents.length > 0) {
      signals.push('explicit user feedback');
    }

    if (pendingFeedbackGradients.length > 0) {
      signals.push('feedback gradient processing loop');
    }

    if (appliedFeedbackGradients.length > 0) {
      signals.push('feedback gradient apply loop');
    }

    if (validationIncidents.length > 0) {
      signals.push('validation failure gradients');
    }

    if (pendingFeedbackGradients.length === 0 && appliedFeedbackGradients.length > 0) {
      signals.push('autonomous feedback reinforcement loop');
    }

    signals.push('Pantheon Validator truth checks');

    signals.push('Pantheon Web Scout evidence gathering');

    if (navigationRuns.length > 0) {
      signals.push('Pantheon Navigation Core route discipline');
    }

    if (netsurferRuns.length > 0) {
      signals.push('Pantheon NetSurfer browser action trace');
    }

    if (benchmarkRuns.length > 0) {
      signals.push('benchmark suite score');
    }

    return signals;
  }

  applyFeedbackGradients(feedbackGradients) {
    return feedbackGradients.map((gradient) => {
      const candidatePatch = {
        target: gradient.target,
        strategy: 'apply explicit user feedback reinforcement gradient',
        confidence: Number(Math.min(0.95, Math.abs(gradient.weightShift) + 0.5).toFixed(2)),
        expectedGain: 'Align runtime behavior with explicit user feedback.',
        requiresManualReview: false,
      };
      const decision = this.policyGate.evaluate({
        taskId: gradient.taskId,
        candidatePatch,
        errorJournal: [],
      });

      return {
        id: gradient.id,
        applicationStatus: decision.approved ? 'applied' : 'rejected',
        appliedAt: decision.approved ? new Date().toISOString() : null,
        decisionReason: decision.reason,
      };
    });
  }

  async createCheckpoint(learningLedger, resonance = null, metadata = {}) {
    const snapshot = learningLedger.getSnapshot();
    return learningLedger.recordCheckpointSnapshot(snapshot, {
      trigger: metadata.trigger ?? 'scheduled-rishi-checkpoint',
      resonanceScore: resonance,
      rollbackReady: snapshot.cycles.every((cycle) => Boolean(cycle.policy.rollbackCheckpoint)),
    });
  }

  async rollbackToCheckpoint(learningLedger, checkpointId) {
    const checkpoint = await learningLedger.restoreCheckpoint(checkpointId);
    return Boolean(checkpoint);
  }
}