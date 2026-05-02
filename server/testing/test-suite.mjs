import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultTestSuitePath = path.join(__dirname, 'data', 'test-suite.json');

function normalizeText(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1);
}

function overlapScore(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  }

  return Number((matches / Math.max(leftTokens.size, rightTokens.size)).toFixed(2));
}

function createDefaultTests() {
  return [];
}

export class PantheonTestSuite {
  constructor(options) {
    this.learningLedger = options.learningLedger;
    this.executeAgentTurn = options.executeAgentTurn;
    this.testSuitePath = options.testSuitePath ?? defaultTestSuitePath;
    this.accuracyThreshold = Number(options.accuracyThreshold ?? 0.7);
    this.checkIntervalMs = Number(options.checkIntervalMs ?? 24 * 60 * 60 * 1000);
    this.tests = [];
  }

  async init() {
    await mkdir(path.dirname(this.testSuitePath), { recursive: true });

    try {
      const raw = await readFile(this.testSuitePath, 'utf8');
      this.tests = JSON.parse(raw);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        throw error;
      }

      this.tests = createDefaultTests();
      await this.flush();
    }

    return this.tests;
  }

  async flush() {
    await writeFile(this.testSuitePath, `${JSON.stringify(this.tests, null, 2)}\n`, 'utf8');
  }

  listTests() {
    return this.tests;
  }

  async addTest(testCase) {
    const now = Date.now();
    const nextTest = {
      id: testCase.id ?? `test-${now}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: testCase.createdAt ?? new Date(now).toISOString(),
      question: String(testCase.question ?? '').trim(),
      answer: String(testCase.answer ?? '').trim(),
      taskId: testCase.taskId ?? 'analysis',
      providerId: testCase.providerId ?? 'openai-agents',
      matchStrategy: testCase.matchStrategy ?? 'includes',
      threshold: Number(testCase.threshold ?? (testCase.matchStrategy === 'similarity' ? 0.7 : 1)),
      urls: testCase.urls ?? [],
      history: testCase.history ?? [],
    };

    this.tests = [...this.tests, nextTest];
    await this.flush();
    return nextTest;
  }

  async removeTest(testId) {
    const beforeCount = this.tests.length;
    this.tests = this.tests.filter((testCase) => testCase.id !== testId);

    if (this.tests.length === beforeCount) {
      return null;
    }

    await this.flush();
    return true;
  }

  compare(testCase, actual) {
    const expected = String(testCase.answer ?? '');
    const actualText = String(actual ?? '');

    if (testCase.matchStrategy === 'equals') {
      const passed = normalizeText(actualText) === normalizeText(expected);
      return { passed, score: passed ? 1 : 0 };
    }

    if (testCase.matchStrategy === 'regex') {
      const pattern = new RegExp(expected, 'iu');
      const passed = pattern.test(actualText);
      return { passed, score: passed ? 1 : 0 };
    }

    if (testCase.matchStrategy === 'similarity') {
      const score = overlapScore(actualText, expected);
      return { passed: score >= Number(testCase.threshold ?? 0.7), score };
    }

    const passed = normalizeText(actualText).includes(normalizeText(expected));
    return { passed, score: passed ? 1 : 0 };
  }

  async runTests(metadata = {}) {
    if (this.tests.length === 0) {
      const run = {
        id: `benchmark-${Date.now()}`,
        createdAt: new Date().toISOString(),
        suite: 'pantheon-test-suite',
        score: 1,
        passed: true,
        blockedLearning: false,
        cases: [],
      };

      await this.learningLedger.recordBenchmarkRun(run);
      await this.learningLedger.updateLearningControl({
        testSuiteBlocked: false,
        testSuiteBlockReason: null,
        lastTestSuiteRunAt: run.createdAt,
        lastTestSuiteAccuracy: run.score,
      });
      return run;
    }

    const cases = [];

    for (const testCase of this.tests) {
      const execution = await this.executeAgentTurn({
        message: testCase.question,
        taskId: testCase.taskId,
        providerId: testCase.providerId,
        mode: 'server',
        history: testCase.history,
        urls: testCase.urls,
      }, {
        persistArtifacts: false,
        applyValidationGate: false,
        allowExternal: false,
      });

      const comparison = this.compare(testCase, execution.reply.content);

      cases.push({
        id: testCase.id,
        label: testCase.question,
        passed: comparison.passed,
        score: comparison.score,
        expected: testCase.answer,
        actual: execution.reply.content,
      });
    }

    const score = Number((cases.reduce((sum, item) => sum + item.score, 0) / cases.length).toFixed(2));
    const blockedLearning = score < this.accuracyThreshold;
    const run = {
      id: `benchmark-${Date.now()}`,
      createdAt: new Date().toISOString(),
      suite: 'pantheon-test-suite',
      score,
      passed: !blockedLearning,
      blockedLearning,
      trigger: metadata.trigger ?? 'manual-test-run',
      cases,
    };

    await this.learningLedger.recordBenchmarkRun(run);
    await this.learningLedger.updateLearningControl({
      testSuiteBlocked: blockedLearning,
      testSuiteBlockReason: blockedLearning
        ? `Test suite accuracy ${score} ниже порога ${this.accuracyThreshold}.`
        : null,
      lastTestSuiteRunAt: run.createdAt,
      lastTestSuiteAccuracy: score,
    });

    return run;
  }

  async unblock(reason = 'manual-test-unblock') {
    await this.learningLedger.updateLearningControl({
      testSuiteBlocked: false,
      testSuiteBlockReason: null,
    });

    return {
      ok: true,
      reason,
    };
  }

  setAccuracyThreshold(threshold) {
    const nextThreshold = Number(threshold);

    if (!Number.isFinite(nextThreshold) || nextThreshold < 0 || nextThreshold > 1) {
      throw new Error('Test suite threshold must be between 0 and 1.');
    }

    this.accuracyThreshold = nextThreshold;

    return {
      threshold: this.accuracyThreshold,
    };
  }

  startScheduler() {
    return setInterval(async () => {
      try {
        await this.runTests({ trigger: 'scheduled-test-suite' });
      } catch (error) {
        console.error('Test suite scheduler failed:', error);
      }
    }, this.checkIntervalMs).unref();
  }
}