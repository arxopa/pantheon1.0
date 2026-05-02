import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ControlCorePolicyGate } from '../core/control-core.mjs';

function toTimestamp(value) {
  return value ? new Date(value).getTime() : 0;
}

function sortRecent(entries) {
  return [...entries].sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));
}

export class Inspector {
  constructor(options) {
    this.learningLedger = options.learningLedger;
    this.rishi = options.rishi;
    this.resonanceMonitor = options.resonanceMonitor;
    this.testSuite = options.testSuite;
    this.workspaceRoot = options.workspaceRoot ?? process.cwd();
    this.policyGate = options.policyGate ?? new ControlCorePolicyGate();
    this.moduleTargets = {
      'agent-runtime': 'server/agent-runtime.mjs',
      'atman-dialog': 'server/dialog/atman.mjs',
      'child-interests': 'server/interests/child-interests.mjs',
      'shakti-bridge': 'server/integrations/shakti-bridge.mjs',
      'pantheon-web-scout': 'server/research/pantheon-web-scout.mjs',
      'pantheon-navigation-core': 'server/navigation/pantheon-navigation-core.mjs',
      'pantheon-net-surfer': 'server/navigation/pantheon-net-surfer.mjs',
      'pantheon-validator': 'server/validation/pantheon-validator.mjs',
      'inspector': 'server/self_learning/inspector.mjs',
      'resonance-monitor': 'server/self_learning/resonance-monitor.mjs',
      'learning-ledger': 'server/self_learning/learning-ledger.mjs',
      'rishi': 'server/self_learning/rishi.mjs',
      'test-suite': 'server/testing/test-suite.mjs',
      'preflight': 'server/self_learning/preflight.mjs',
      'smoke-test': 'server/self_learning/smoke-test.mjs',
      'mutation-sandbox': 'server/testing/data/control-mutation-sandbox.mjs',
    };
  }

  listMutableTargets() {
    return Object.entries(this.moduleTargets).map(([id, relativePath]) => ({
      id,
      path: relativePath,
      protected: false,
    }));
  }

  resolveTarget(target) {
    const relativePath = this.moduleTargets[target] ?? null;

    if (!relativePath) {
      throw new Error(`Unknown module target: ${target}`);
    }

    return {
      id: target,
      relativePath,
      absolutePath: path.join(this.workspaceRoot, relativePath),
    };
  }

  buildPatchDecision(target, strategy) {
    const candidatePatch = {
      target,
      domain: 'code-module',
      strategy,
      confidence: 0.78,
      expectedGain: `Apply controlled module mutation to ${target}.`,
      requiresManualReview: false,
    };
    const decision = this.policyGate.evaluate({
      taskId: `inspector-mutation-${Date.now()}`,
      candidatePatch,
      errorJournal: [],
    });

    if (!decision.approved) {
      throw new Error(decision.reason);
    }

    return decision;
  }

  normalizePatchRequest(payload) {
    const strategy = String(payload.strategy ?? '').trim() || 'exact-string-replace';

    if (strategy === 'exact-string-replace') {
      const findText = String(payload.findText ?? '');
      const replaceText = String(payload.replaceText ?? '');

      if (!findText) {
        throw new Error('Module patch requires non-empty findText.');
      }

      return {
        strategy,
        matchText: findText,
        nextContent: (currentContent) => currentContent.replace(findText, replaceText),
      };
    }

    if (strategy === 'insert-before' || strategy === 'insert-after') {
      const anchorText = String(payload.anchorText ?? payload.findText ?? '');
      const insertText = String(payload.insertText ?? payload.replaceText ?? '');

      if (!anchorText) {
        throw new Error(`Module patch with strategy ${strategy} requires non-empty anchorText.`);
      }

      if (!insertText) {
        throw new Error(`Module patch with strategy ${strategy} requires non-empty insertText.`);
      }

      return {
        strategy,
        matchText: anchorText,
        nextContent: (currentContent) => {
          const index = currentContent.indexOf(anchorText);

          if (index === -1) {
            return currentContent;
          }

          return strategy === 'insert-before'
            ? `${currentContent.slice(0, index)}${insertText}${currentContent.slice(index)}`
            : `${currentContent.slice(0, index + anchorText.length)}${insertText}${currentContent.slice(index + anchorText.length)}`;
        },
      };
    }

    throw new Error(`Unsupported module patch strategy: ${strategy}`);
  }

  buildPatchPreview(currentContent, nextContent, matchText) {
    const matchIndex = currentContent.indexOf(matchText);
    const previewStart = Math.max(0, matchIndex - 120);
    const previewEnd = Math.min(currentContent.length, matchIndex + matchText.length + 120);
    const nextPreviewEnd = Math.min(nextContent.length, previewEnd + Math.max(0, nextContent.length - currentContent.length));

    return {
      before: currentContent.slice(previewStart, previewEnd),
      after: nextContent.slice(previewStart, nextPreviewEnd),
    };
  }

  async applyModulePatch({ target, findText, replaceText, anchorText, insertText, strategy = 'exact-string-replace', compileAfter = false, dryRun = false, trigger = 'manual-endpoint' }) {
    const resolved = this.resolveTarget(String(target ?? '').trim());
    const patchRequest = this.normalizePatchRequest({
      findText,
      replaceText,
      anchorText,
      insertText,
      strategy,
    });

    this.buildPatchDecision(resolved.id, patchRequest.strategy);

    const currentContent = await readFile(resolved.absolutePath, 'utf8');
    const occurrences = currentContent.split(patchRequest.matchText).length - 1;

    if (occurrences !== 1) {
      throw new Error(`Expected exactly one match for ${patchRequest.strategy === 'exact-string-replace' ? 'findText' : 'anchorText'} in ${resolved.relativePath}, got ${occurrences}.`);
    }

    const nextContent = patchRequest.nextContent(currentContent);

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        target: resolved.id,
        path: resolved.relativePath,
        strategy: patchRequest.strategy,
        occurrences,
        preview: this.buildPatchPreview(currentContent, nextContent, patchRequest.matchText),
      };
    }

    await writeFile(resolved.absolutePath, nextContent, 'utf8');

    let compileResult = null;

    if (compileAfter) {
      compileResult = await this.compileWorkspace({ trigger: `${trigger}-compile` });
    }

    await this.learningLedger.recordInspectorAction({
      kind: 'module-patch',
      summary: `Inspector patched ${resolved.id}.`,
      details: `path=${resolved.relativePath}; strategy=${patchRequest.strategy}; compileAfter=${compileAfter}`,
    });

    return {
      ok: true,
      target: resolved.id,
      path: resolved.relativePath,
      strategy: patchRequest.strategy,
      occurrences,
      compileResult,
    };
  }

  async compileWorkspace({ trigger = 'manual-endpoint' } = {}) {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const startedAt = Date.now();

    const result = await new Promise((resolve, reject) => {
      const child = spawn(command, ['run', 'build'], {
        cwd: this.workspaceRoot,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });

      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });

      child.on('error', reject);
      child.on('close', (exitCode) => {
        resolve({
          ok: exitCode === 0,
          exitCode,
          durationMs: Date.now() - startedAt,
          stdoutTail: stdout.split('\n').slice(-30).join('\n').trim(),
          stderrTail: stderr.split('\n').slice(-30).join('\n').trim(),
        });
      });
    });

    await this.learningLedger.recordInspectorAction({
      kind: 'workspace-compile',
      summary: `Inspector compile ${result.ok ? 'passed' : 'failed'} with exitCode=${result.exitCode}.`,
      details: `trigger=${trigger}; durationMs=${result.durationMs}`,
    });

    if (!result.ok) {
      throw new Error(result.stderrTail || result.stdoutTail || `npm run build failed with exitCode=${result.exitCode}`);
    }

    return result;
  }

  listCheckpoints(limit = 10) {
    const snapshot = this.learningLedger.getSnapshot();

    return [...(snapshot.checkpointSnapshots ?? [])]
      .reverse()
      .slice(0, limit)
      .map((checkpoint) => ({
        id: checkpoint.id,
        createdAt: checkpoint.createdAt,
        trigger: checkpoint.trigger,
        resonanceScore: checkpoint.resonanceScore ?? null,
        rollbackReady: checkpoint.rollbackReady,
        isLastRollback: snapshot.learningControl.lastRollbackCheckpointId === checkpoint.id,
      }));
  }

  buildRecentLogs(limit = 12) {
    const snapshot = this.learningLedger.getSnapshot();
    const inspectorLogs = (snapshot.inspectorActions ?? []).map((action) => ({
      id: action.id,
      createdAt: action.createdAt,
      source: 'inspector',
      severity: 'info',
      summary: action.summary,
      detail: action.details ?? null,
    }));
    const resonanceLogs = (snapshot.resonanceEvents ?? []).map((event) => ({
      id: event.id,
      createdAt: event.createdAt,
      source: 'resonance',
      severity: event.severity,
      summary: event.summary,
      detail: event.checkpointId ?? null,
    }));
    const validationLogs = (snapshot.validationIncidents ?? []).map((incident) => ({
      id: incident.id,
      createdAt: incident.createdAt,
      source: 'validation',
      severity: incident.verdict === 'fail' ? 'critical' : 'warn',
      summary: incident.summary,
      detail: incident.failureReasons.join(' | ') || null,
    }));
    const benchmarkLogs = (snapshot.benchmarkRuns ?? []).map((run) => ({
      id: run.id,
      createdAt: run.createdAt,
      source: 'benchmark',
      severity: run.passed ? 'info' : 'critical',
      summary: `Test suite ${run.suite} finished with score ${run.score}.`,
      detail: run.blockedLearning ? 'Learning blocked by test suite.' : null,
    }));
    const feedbackLogs = (snapshot.feedbackGradients ?? [])
      .filter((gradient) => gradient.applicationStatus !== 'pending')
      .map((gradient) => ({
        id: gradient.id,
        createdAt: gradient.appliedAt ?? gradient.createdAt,
        source: 'feedback',
        severity: gradient.applicationStatus === 'rejected' ? 'warn' : 'info',
        summary: `Gradient ${gradient.applicationStatus}: ${gradient.target} ${gradient.weightShift > 0 ? '+' : ''}${gradient.weightShift.toFixed(2)}.`,
        detail: gradient.decisionReason ?? gradient.reason ?? null,
      }));

    return sortRecent([...inspectorLogs, ...resonanceLogs, ...validationLogs, ...benchmarkLogs, ...feedbackLogs]).slice(0, limit);
  }

  async getStatus() {
    const snapshot = this.learningLedger.getSnapshot();
    const resonance = await this.resonanceMonitor.getState();

    return {
      generatedAt: new Date().toISOString(),
      learningBlocked: snapshot.stats.learningBlocked,
      guards: {
        manual: snapshot.learningControl.manualLearningPaused,
        resonance: snapshot.stats.learningPaused,
        testSuite: snapshot.learningControl.testSuiteBlocked,
      },
      pendingGradients: snapshot.stats.pendingFeedbackGradientCount,
      appliedGradients: snapshot.stats.appliedFeedbackGradientCount,
      checkpointCount: snapshot.stats.checkpointSnapshotCount,
      testCount: this.testSuite.listTests().length,
      lastTestAccuracy: snapshot.learningControl.lastTestSuiteAccuracy,
      resonance: {
        current: resonance.currentResonance,
        state: resonance.state,
        validationPressure: resonance.validationPressure,
        thresholds: resonance.thresholds,
      },
      testSuite: {
        threshold: this.testSuite.accuracyThreshold,
        intervalMs: this.testSuite.checkIntervalMs,
        blocked: snapshot.learningControl.testSuiteBlocked,
      },
      controlModule: {
        mutableTargets: this.listMutableTargets(),
        patchStrategies: ['exact-string-replace', 'insert-before', 'insert-after'],
        compileCommand: 'npm run build',
      },
      checkpoints: this.listCheckpoints(8),
      recentLogs: this.buildRecentLogs(10),
    };
  }

  getMetrics() {
    const snapshot = this.learningLedger.getSnapshot();

    return {
      checkpoints: this.listCheckpoints(12),
      resonanceEvents: [...(snapshot.resonanceEvents ?? [])].slice(-10).reverse(),
      validationIncidents: [...(snapshot.validationIncidents ?? [])].slice(-10).reverse(),
      benchmarkRuns: [...(snapshot.benchmarkRuns ?? [])].slice(-10).reverse(),
      pendingGradients: this.learningLedger.getPendingFeedbackGradients().slice(-10).reverse(),
      inspectorActions: [...(snapshot.inspectorActions ?? [])].slice(-10).reverse(),
    };
  }

  async createCheckpoint(trigger = 'manual-inspector-checkpoint') {
    const resonance = await this.resonanceMonitor.computeResonance();
    const checkpoint = await this.rishi.createCheckpoint(this.learningLedger, resonance.score, {
      trigger,
    });

    await this.learningLedger.recordInspectorAction({
      kind: 'checkpoint',
      summary: `Inspector created checkpoint ${checkpoint.id}.`,
      details: `trigger=${trigger}`,
    });

    return checkpoint;
  }

  async rollbackTo(checkpointId) {
    const ok = await this.rishi.rollbackToCheckpoint(this.learningLedger, checkpointId);

    if (ok) {
      await this.learningLedger.recordInspectorAction({
        kind: 'rollback',
        summary: `Inspector rolled back to ${checkpointId}.`,
        details: null,
      });
    }

    return ok;
  }

  async clearPendingGradients() {
    const result = await this.learningLedger.clearPendingFeedbackGradients({
      clearedAt: new Date().toISOString(),
    });

    await this.learningLedger.recordInspectorAction({
      kind: 'clear-gradients',
      summary: `Inspector cleared ${result.removedCount} pending gradients.`,
      details: `pendingAfter=${result.pendingAfter}`,
    });

    return result;
  }

  async setResonanceThresholds(low, recovery) {
    const thresholds = this.resonanceMonitor.setThresholds({ low, recovery });

    await this.learningLedger.recordInspectorAction({
      kind: 'resonance-threshold-update',
      summary: `Resonance thresholds updated to low=${thresholds.low}, recovery=${thresholds.recovery}.`,
      details: null,
    });

    return thresholds;
  }

  async setTestThreshold(threshold) {
    const result = this.testSuite.setAccuracyThreshold(threshold);

    await this.learningLedger.recordInspectorAction({
      kind: 'test-threshold-update',
      summary: `Test suite threshold updated to ${result.threshold}.`,
      details: null,
    });

    return result;
  }

  async toggleLearning(enable) {
    await this.learningLedger.updateLearningControl({
      manualLearningPaused: !enable,
      manualPauseReason: enable ? null : 'Inspector manual learning pause',
    });

    await this.learningLedger.recordInspectorAction({
      kind: 'manual-learning-toggle',
      summary: `Learning ${enable ? 'enabled' : 'disabled'} manually.`,
      details: null,
    });

    return {
      enabled: Boolean(enable),
    };
  }
}