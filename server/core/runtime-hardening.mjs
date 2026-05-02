function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    name: 'Error',
    message: String(error ?? 'Unknown error'),
    stack: null,
  };
}

export function normalizeErrorMessage(error) {
  return serializeError(error).message;
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const externalSignal = options.signal ?? null;
  const timerId = setTimeout(
    () => controller.abort(new Error(`Request timeout after ${timeoutMs}ms`)),
    timeoutMs
  );

  const abortFromExternal = () =>
    controller.abort(
      externalSignal?.reason ?? new Error('Request aborted by external signal')
    );

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternal();
    } else {
      externalSignal.addEventListener('abort', abortFromExternal, {
        once: true,
      });
    }
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timerId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', abortFromExternal);
    }
  }
}

export class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name ?? 'circuit-breaker';
    this.failureThreshold = Math.max(1, Number(options.failureThreshold ?? 3));
    this.cooldownMs = Math.max(1000, Number(options.cooldownMs ?? 60000));
    this.successThreshold = Math.max(1, Number(options.successThreshold ?? 1));
    this.failures = 0;
    this.successes = 0;
    this.state = 'closed';
    this.openedAt = null;
    this.lastError = null;
    this.lastFailureAt = null;
    this.lastSuccessAt = null;
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      failureThreshold: this.failureThreshold,
      cooldownMs: this.cooldownMs,
      openedAt: this.openedAt,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
    };
  }

  canAttempt() {
    if (this.state !== 'open') {
      return true;
    }

    if (!this.openedAt) {
      return true;
    }

    if (Date.now() - new Date(this.openedAt).getTime() >= this.cooldownMs) {
      this.state = 'half-open';
      this.successes = 0;
      return true;
    }

    return false;
  }

  recordSuccess() {
    this.lastSuccessAt = new Date().toISOString();
    this.lastError = null;

    if (this.state === 'half-open') {
      this.successes += 1;

      if (this.successes >= this.successThreshold) {
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
        this.openedAt = null;
      }

      return;
    }

    this.failures = 0;
  }

  recordFailure(error) {
    this.failures += 1;
    this.successes = 0;
    this.lastFailureAt = new Date().toISOString();
    this.lastError = serializeError(error);

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = new Date().toISOString();
    }
  }

  async execute(operation, fallback = null) {
    if (!this.canAttempt()) {
      if (fallback) {
        return fallback(this.getState());
      }

      throw new Error(
        `${this.name} is open; refusing operation until cooldown expires.`
      );
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);

      if (fallback) {
        return fallback(this.getState(), error);
      }

      throw error;
    }
  }
}

export class RuntimeTaskSupervisor {
  constructor(options = {}) {
    this.logger = options.logger ?? console;
    this.tasks = new Map();
    this.stopped = false;
  }

  registerTask(options = {}) {
    if (!options.name) {
      throw new Error('Recurring task name is required.');
    }

    const task = {
      name: options.name,
      intervalMs: Math.max(250, Number(options.intervalMs ?? 1000)),
      timeoutMs: Math.max(
        250,
        Number(options.timeoutMs ?? options.intervalMs ?? 1000)
      ),
      critical: options.critical !== false,
      handler: options.handler,
      status: 'idle',
      totalRuns: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSuccessAt: null,
      lastDurationMs: null,
      lastError: null,
      nextRunAt: null,
      timerId: null,
      currentPromise: null,
    };

    if (typeof task.handler !== 'function') {
      throw new Error(`Recurring task ${task.name} requires a handler.`);
    }

    this.tasks.set(task.name, task);
    return this.getTaskState(task.name);
  }

  scheduleNextRun(task) {
    if (this.stopped) {
      return;
    }

    task.nextRunAt = new Date(Date.now() + task.intervalMs).toISOString();
    task.timerId = setTimeout(() => {
      this.runTask(task.name).catch((error) => {
        this.logger.error?.(`[runtime-supervisor] ${task.name} crashed`, error);
      });
    }, task.intervalMs);
    task.timerId.unref?.();
  }

  async runTask(name) {
    const task = this.tasks.get(name);

    if (!task || this.stopped) {
      return null;
    }

    if (task.currentPromise) {
      return task.currentPromise;
    }

    task.currentPromise = (async () => {
      const startedAt = Date.now();
      task.status = 'running';
      task.lastStartedAt = new Date(startedAt).toISOString();
      task.totalRuns += 1;
      task.lastError = null;
      task.nextRunAt = null;

      try {
        await Promise.race([
          Promise.resolve().then(() => task.handler()),
          new Promise((_, reject) => {
            const timerId = setTimeout(() => {
              reject(
                new Error(
                  `Task ${task.name} timed out after ${task.timeoutMs}ms`
                )
              );
            }, task.timeoutMs);
            timerId.unref?.();
          }),
        ]);
        task.status = 'idle';
        task.consecutiveFailures = 0;
        task.lastSuccessAt = new Date().toISOString();
      } catch (error) {
        task.status = 'failed';
        task.totalFailures += 1;
        task.consecutiveFailures += 1;
        task.lastError = serializeError(error);
        this.logger.error?.(
          `[runtime-supervisor] ${task.name} failed: ${normalizeErrorMessage(error)}`
        );
      } finally {
        task.lastFinishedAt = new Date().toISOString();
        task.lastDurationMs = Date.now() - startedAt;
        task.currentPromise = null;
        this.scheduleNextRun(task);
      }

      return this.getTaskState(task.name);
    })();

    return task.currentPromise;
  }

  startAll() {
    for (const task of this.tasks.values()) {
      if (task.timerId) {
        clearTimeout(task.timerId);
      }
      this.scheduleNextRun(task);
    }
  }

  async stopAll(reason = 'manual-stop') {
    this.stopped = true;
    for (const task of this.tasks.values()) {
      if (task.timerId) {
        clearTimeout(task.timerId);
        task.timerId = null;
      }
      task.nextRunAt = null;
      if (task.status === 'running') {
        task.status = 'stopping';
      }
      task.stopReason = reason;
    }

    await Promise.allSettled(
      [...this.tasks.values()]
        .map((task) => task.currentPromise)
        .filter(Boolean)
    );
  }

  getTaskState(name) {
    const task = this.tasks.get(name);

    if (!task) {
      return null;
    }

    return {
      name: task.name,
      intervalMs: task.intervalMs,
      timeoutMs: task.timeoutMs,
      critical: task.critical,
      status: task.status,
      totalRuns: task.totalRuns,
      totalFailures: task.totalFailures,
      consecutiveFailures: task.consecutiveFailures,
      lastStartedAt: task.lastStartedAt,
      lastFinishedAt: task.lastFinishedAt,
      lastSuccessAt: task.lastSuccessAt,
      lastDurationMs: task.lastDurationMs,
      lastError: task.lastError,
      nextRunAt: task.nextRunAt,
      stopReason: task.stopReason ?? null,
    };
  }

  getStatus() {
    const tasks = [...this.tasks.keys()].map((name) => this.getTaskState(name));
    const criticalFailures = tasks.filter(
      (task) => task?.critical && task.consecutiveFailures > 0
    );
    const fatalCriticalFailures = criticalFailures.filter(
      (task) => task.consecutiveFailures >= 3
    );

    return {
      stopped: this.stopped,
      overall:
        fatalCriticalFailures.length > 0
          ? 'unhealthy'
          : criticalFailures.length > 0
            ? 'degraded'
            : 'healthy',
      criticalFailures: criticalFailures.length,
      fatalCriticalFailures: fatalCriticalFailures.length,
      tasks,
    };
  }
}
