function toTimestamp(value) {
  return value ? new Date(value).getTime() : 0;
}

function clampScore(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

export class ResonanceMonitor {
  constructor(options) {
    this.learningLedger = options.learningLedger;
    this.rishi = options.rishi;
    this.checkIntervalMs = Number(options.checkIntervalMs ?? 600000);
    this.lowThreshold = Number(options.lowThreshold ?? 0.3);
    this.recoveryThreshold = Number(options.recoveryThreshold ?? 0.7);
    this.lookbackMinutes = Number(options.lookbackMinutes ?? 60);
    this.minFeedbackSamples = Number(options.minFeedbackSamples ?? 5);
    this.pauseDurationMs = Number(options.pauseDurationMs ?? 1800000);
  }

  getFeedbackStats(snapshot, sinceMs) {
    const recentGradients = snapshot.feedbackGradients.filter((gradient) => {
      const timestamp = toTimestamp(gradient.appliedAt ?? gradient.createdAt);
      return gradient.applicationStatus === 'applied' && timestamp >= sinceMs && gradient.source === 'feedback';
    });

    return {
      likes: recentGradients.filter((gradient) => gradient.sentiment === 'positive').length,
      dislikes: recentGradients.filter((gradient) => gradient.sentiment === 'negative').length,
    };
  }

  getValidationErrorCount(snapshot, sinceMs) {
    return snapshot.validationIncidents.filter((incident) => toTimestamp(incident.createdAt) >= sinceMs).length;
  }

  getValidationPressure(snapshot, sinceMs) {
    const recentIncidents = snapshot.validationIncidents.filter((incident) => toTimestamp(incident.createdAt) >= sinceMs);

    if (recentIncidents.length === 0) {
      return 0;
    }

    const totalPressure = recentIncidents.reduce((sum, incident) => {
      if (typeof incident.pressureProfile?.overallPressure === 'number') {
        return sum + incident.pressureProfile.overallPressure;
      }

      return sum + (incident.verdict === 'fail' ? 0.8 : 0.45);
    }, 0);

    return clampScore(totalPressure / recentIncidents.length);
  }

  getEngagementScore(snapshot, sinceMs) {
    const recentDialogs = snapshot.dialogRuns.filter((dialog) => toTimestamp(dialog.createdAt) >= sinceMs);

    if (recentDialogs.length === 0) {
      return 1;
    }

    const averageHistoryLength = recentDialogs.reduce((sum, dialog) => sum + dialog.historyLength, 0) / recentDialogs.length;
    const averageReplyLength = recentDialogs.reduce((sum, dialog) => sum + dialog.replyLength, 0) / recentDialogs.length;
    const abruptRatio = recentDialogs.filter((dialog) => dialog.replyLength < 100).length / recentDialogs.length;

    const historyScore = Math.min(1, averageHistoryLength / 4);
    const replyScore = Math.min(1, averageReplyLength / 220);

    return clampScore(historyScore * 0.45 + replyScore * 0.45 + (1 - abruptRatio) * 0.1);
  }

  async computeResonance() {
    const snapshot = this.learningLedger.getSnapshot();
    const now = Date.now();
    const sinceMs = now - this.lookbackMinutes * 60 * 1000;
    const { likes, dislikes } = this.getFeedbackStats(snapshot, sinceMs);
    const totalFeedback = likes + dislikes;
    const validationErrors = this.getValidationErrorCount(snapshot, sinceMs);
    const validationPressure = this.getValidationPressure(snapshot, sinceMs);
    const engagementScore = this.getEngagementScore(snapshot, sinceMs);

    if (totalFeedback < this.minFeedbackSamples) {
      return {
        score: null,
        likes,
        dislikes,
        validationErrors,
        validationPressure,
        engagementScore,
        totalFeedback,
      };
    }

    const feedbackScore = totalFeedback > 0 ? likes / totalFeedback : 0.5;
    const validationPenalty = Math.min(0.55, validationPressure * 0.55 + validationErrors * 0.012);
    const validationScore = 1 - validationPenalty;
    const score = clampScore(feedbackScore * 0.6 + validationScore * 0.3 + engagementScore * 0.1);

    return {
      score,
      likes,
      dislikes,
      validationErrors,
      validationPressure,
      engagementScore,
      totalFeedback,
      feedbackScore: clampScore(feedbackScore),
      validationScore: clampScore(validationScore),
    };
  }

  async createGoodCheckpointIfNeeded(resonance, trigger) {
    if (resonance.score === null || resonance.score < this.recoveryThreshold) {
      return null;
    }

    const lastGoodCheckpoint = this.learningLedger.getLastGoodCheckpoint(this.recoveryThreshold);

    if (lastGoodCheckpoint && (Date.now() - toTimestamp(lastGoodCheckpoint.createdAt)) < this.checkIntervalMs) {
      return lastGoodCheckpoint;
    }

    return this.rishi.createCheckpoint(this.learningLedger, resonance.score, {
      trigger,
    });
  }

  async pauseLearning(reason) {
    const pausedUntil = Date.now() + this.pauseDurationMs;
    await this.learningLedger.updateLearningControl({
      pausedUntil,
      pauseReason: reason,
      resonanceState: 'recovering',
    });
    return pausedUntil;
  }

  async maybeResumeLearning(currentScore) {
    const snapshot = this.learningLedger.getSnapshot();
    const control = snapshot.learningControl;

    if (!control.pausedUntil || control.pausedUntil > Date.now()) {
      return false;
    }

    if (currentScore !== null && currentScore >= this.recoveryThreshold) {
      await this.learningLedger.updateLearningControl({
        pausedUntil: null,
        pauseReason: null,
        resonanceState: 'normal',
      });
      await this.learningLedger.recordResonanceEvent({
        kind: 'resume',
        severity: 'info',
        summary: `Резонанс восстановлен до ${currentScore}. Обучение возобновлено.`,
      });
      return true;
    }

    return false;
  }

  async runCheck(trigger = 'scheduled-resonance-check') {
    const resonance = await this.computeResonance();
    const snapshot = this.learningLedger.getSnapshot();
    const control = snapshot.learningControl;

    await this.learningLedger.updateLearningControl({
      currentResonance: resonance.score,
      currentValidationPressure: resonance.validationPressure,
      lastResonanceCheckAt: new Date().toISOString(),
    });

    if (resonance.score === null) {
      return {
        ...resonance,
        state: control.resonanceState,
        skipped: true,
      };
    }

    await this.createGoodCheckpointIfNeeded(resonance, trigger);

    if (resonance.score <= this.lowThreshold && control.resonanceState !== 'low') {
      const checkpoint = this.learningLedger.getLastGoodCheckpoint(this.recoveryThreshold);
      const rollback = checkpoint ? await this.rishi.rollbackToCheckpoint(this.learningLedger, checkpoint.id) : false;
      const pausedUntil = await this.pauseLearning(`Низкий резонанс ${resonance.score}`);

      await this.learningLedger.recordResonanceEvent({
        kind: 'low-resonance',
        severity: 'critical',
        score: resonance.score,
        checkpointId: checkpoint?.id ?? null,
        rollbackApplied: rollback,
        summary: checkpoint
          ? `Резонанс упал до ${resonance.score}. Выполнен откат к ${checkpoint.id}, обучение поставлено на паузу.`
          : `Резонанс упал до ${resonance.score}. Хороший checkpoint не найден, обучение поставлено на паузу.`,
        pausedUntil,
      });

      await this.learningLedger.updateLearningControl({
        resonanceState: 'low',
      });

      return {
        ...resonance,
        state: 'low',
        rollbackApplied: rollback,
        checkpointId: checkpoint?.id ?? null,
        pausedUntil,
      };
    }

    const resumed = await this.maybeResumeLearning(resonance.score);

    if (control.resonanceState !== 'low') {
      await this.learningLedger.updateLearningControl({
        resonanceState: resumed ? 'normal' : control.pausedUntil ? 'recovering' : 'normal',
      });
    }

    await this.learningLedger.recordResonanceEvent({
      kind: 'check',
      severity: resonance.score < this.recoveryThreshold ? 'warn' : 'info',
      score: resonance.score,
      summary: `Текущий резонанс ${resonance.score}. feedback=${resonance.likes}/${resonance.totalFeedback}, validationErrors=${resonance.validationErrors}, validationPressure=${resonance.validationPressure}, engagement=${resonance.engagementScore}.`,
    });

    return {
      ...resonance,
      state: resumed ? 'normal' : control.pausedUntil ? 'recovering' : 'normal',
      resumed,
    };
  }

  async getState() {
    const snapshot = this.learningLedger.getSnapshot();
    const resonance = await this.computeResonance();
    const latestEvent = snapshot.resonanceEvents.at(-1) ?? null;
    const lastGoodCheckpoint = this.learningLedger.getLastGoodCheckpoint(this.recoveryThreshold);

    return {
      currentResonance: resonance.score,
      likes: resonance.likes,
      dislikes: resonance.dislikes,
      validationErrors: resonance.validationErrors,
      validationPressure: resonance.validationPressure,
      engagementScore: resonance.engagementScore,
      totalFeedback: resonance.totalFeedback,
      state: snapshot.learningControl.resonanceState,
      pausedUntil: snapshot.learningControl.pausedUntil,
      pauseReason: snapshot.learningControl.pauseReason,
      lastResonanceCheckAt: snapshot.learningControl.lastResonanceCheckAt,
      lastRollbackAt: snapshot.learningControl.lastRollbackAt,
      lastRollbackCheckpointId: snapshot.learningControl.lastRollbackCheckpointId,
      latestEvent,
      lastGoodCheckpoint,
      thresholds: {
        low: this.lowThreshold,
        recovery: this.recoveryThreshold,
      },
    };
  }

  setThresholds({ low, recovery }) {
    const nextLow = Number(low);
    const nextRecovery = Number(recovery);

    if (!Number.isFinite(nextLow) || !Number.isFinite(nextRecovery)) {
      throw new Error('Resonance thresholds must be numeric.');
    }

    if (nextLow < 0 || nextLow > 1 || nextRecovery < 0 || nextRecovery > 1) {
      throw new Error('Resonance thresholds must be between 0 and 1.');
    }

    if (nextLow >= nextRecovery) {
      throw new Error('Resonance low threshold must be smaller than recovery threshold.');
    }

    this.lowThreshold = nextLow;
    this.recoveryThreshold = nextRecovery;

    return {
      low: this.lowThreshold,
      recovery: this.recoveryThreshold,
    };
  }
}