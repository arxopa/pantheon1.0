import type {
  BenchmarkRun,
  FactRecord,
  FeedbackSentiment,
  InspectorMetrics,
  InspectorStatus,
  LearningLedgerSnapshot,
  NavigationRun,
  ResonanceState,
  RishiState,
  TestSuiteCase,
  TestSuiteMatchStrategy,
  TestSuiteState,
} from '../types/agent';

const agentApiUrl = import.meta.env.VITE_AGENT_API_URL ?? 'http://localhost:8787/api/agent/run';
const baseServerUrl = agentApiUrl.replace(/\/api\/agent\/run$/, '');

export async function fetchLearningState(): Promise<LearningLedgerSnapshot> {
  const response = await fetch(`${baseServerUrl}/api/learning/state`);

  if (!response.ok) {
    throw new Error(`Learning state endpoint returned ${response.status}`);
  }

  return (await response.json()) as LearningLedgerSnapshot;
}

export async function fetchRishiState(): Promise<RishiState> {
  const response = await fetch(`${baseServerUrl}/api/rishi/state`);

  if (!response.ok) {
    throw new Error(`Rishi state endpoint returned ${response.status}`);
  }

  return (await response.json()) as RishiState;
}

export async function fetchResonanceState(): Promise<ResonanceState> {
  const response = await fetch(`${baseServerUrl}/api/resonance/state`);

  if (!response.ok) {
    throw new Error(`Resonance state endpoint returned ${response.status}`);
  }

  return (await response.json()) as ResonanceState;
}

export async function checkResonance(): Promise<ResonanceState> {
  const response = await fetch(`${baseServerUrl}/api/resonance/check`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Resonance check endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as { state: ResonanceState };
  return payload.state;
}

export async function triggerRishiCheckpoint(): Promise<void> {
  const response = await fetch(`${baseServerUrl}/api/rishi/checkpoint`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Rishi checkpoint endpoint returned ${response.status}`);
  }
}

export async function submitAgentFeedback(input: {
  messageId: string;
  taskId: string;
  providerId: string;
  sentiment: FeedbackSentiment;
  reason?: string;
  userMessage?: string;
  assistantMessage?: string;
  autoCreateTest?: boolean;
  testThreshold?: number;
}): Promise<{ autoApply: { appliedCount: number; rejectedCount: number; pendingAfter: number } | null; generatedTestCase?: { id: string } | null }> {
  const response = await fetch(`${baseServerUrl}/api/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Feedback endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    autoApply: { appliedCount: number; rejectedCount: number; pendingAfter: number } | null;
    generatedTestCase?: { id: string } | null;
  };

  return {
    autoApply: payload.autoApply,
    generatedTestCase: payload.generatedTestCase ?? null,
  };
}

export async function processFeedbackLoop(): Promise<{ processedCount: number; pendingAfter: number }> {
  const response = await fetch(`${baseServerUrl}/api/feedback/process`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Feedback processing endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as { result: { processedCount: number; pendingAfter: number } };
  return payload.result;
}

export async function applyFeedbackLoop(): Promise<{ appliedCount: number; rejectedCount: number; pendingAfter: number }> {
  const response = await fetch(`${baseServerUrl}/api/feedback/apply`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Feedback apply endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    result: { appliedCount: number; rejectedCount: number; pendingAfter: number };
  };
  return payload.result;
}

export async function runBenchmarkSuite(): Promise<BenchmarkRun> {
  const response = await fetch(`${baseServerUrl}/api/tests/run`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Benchmark endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as { run: BenchmarkRun };
  return payload.run;
}

export async function fetchTestSuiteState(): Promise<TestSuiteState> {
  const response = await fetch(`${baseServerUrl}/api/tests/state`);

  if (!response.ok) {
    throw new Error(`Test suite state endpoint returned ${response.status}`);
  }

  return (await response.json()) as TestSuiteState;
}

export async function addTestSuiteCase(input: {
  question: string;
  answer: string;
  taskId?: string;
  providerId?: string;
  matchStrategy?: TestSuiteMatchStrategy;
  threshold?: number;
}): Promise<TestSuiteCase> {
  const response = await fetch(`${baseServerUrl}/api/tests/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Test suite add endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as { testCase: TestSuiteCase };
  return payload.testCase;
}

export async function removeTestSuiteCase(id: string): Promise<void> {
  const response = await fetch(`${baseServerUrl}/api/tests/remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  });

  if (!response.ok) {
    throw new Error(`Test suite remove endpoint returned ${response.status}`);
  }
}

export async function unblockTestSuite(): Promise<void> {
  const response = await fetch(`${baseServerUrl}/api/tests/unblock`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Test suite unblock endpoint returned ${response.status}`);
  }
}

export async function fetchInspectorStatus(): Promise<InspectorStatus> {
  const response = await fetch(`${baseServerUrl}/api/inspector/status`);

  if (!response.ok) {
    throw new Error(`Inspector status endpoint returned ${response.status}`);
  }

  return (await response.json()) as InspectorStatus;
}

export async function fetchInspectorMetrics(): Promise<InspectorMetrics> {
  const response = await fetch(`${baseServerUrl}/api/inspector/metrics`);

  if (!response.ok) {
    throw new Error(`Inspector metrics endpoint returned ${response.status}`);
  }

  return (await response.json()) as InspectorMetrics;
}

export async function createInspectorCheckpoint(): Promise<{ id: string }> {
  const response = await fetch(`${baseServerUrl}/api/inspector/checkpoint`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Inspector checkpoint endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as { checkpoint: { id: string } };
  return payload.checkpoint;
}

export async function rollbackInspectorCheckpoint(checkpointId: string): Promise<void> {
  const response = await fetch(`${baseServerUrl}/api/inspector/rollback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ checkpointId }),
  });

  if (!response.ok) {
    throw new Error(`Inspector rollback endpoint returned ${response.status}`);
  }
}

export async function clearPendingInspectorGradients(): Promise<{ removedCount: number; pendingAfter: number }> {
  const response = await fetch(`${baseServerUrl}/api/inspector/gradients/clear`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Inspector gradient clear endpoint returned ${response.status}`);
  }

  return (await response.json()) as { removedCount: number; pendingAfter: number };
}

export async function toggleInspectorLearning(enabled: boolean): Promise<{ enabled: boolean }> {
  const response = await fetch(`${baseServerUrl}/api/inspector/learning`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ enabled }),
  });

  if (!response.ok) {
    throw new Error(`Inspector learning toggle endpoint returned ${response.status}`);
  }

  return (await response.json()) as { enabled: boolean };
}

export async function updateInspectorResonanceThresholds(input: { low: number; recovery: number }): Promise<{ low: number; recovery: number }> {
  const response = await fetch(`${baseServerUrl}/api/inspector/resonance/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Inspector resonance config endpoint returned ${response.status}`);
  }

  return (await response.json()) as { low: number; recovery: number };
}

export async function updateInspectorTestSuiteThreshold(threshold: number): Promise<{ threshold: number }> {
  const response = await fetch(`${baseServerUrl}/api/inspector/test-suite/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ threshold }),
  });

  if (!response.ok) {
    throw new Error(`Inspector test suite config endpoint returned ${response.status}`);
  }

  return (await response.json()) as { threshold: number };
}

export async function runNavigation(input: {
  taskId: string;
  goal: string;
  urls: string[];
}): Promise<NavigationRun> {
  const response = await fetch(`${baseServerUrl}/api/navigation/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Navigation endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as { run: NavigationRun };
  return payload.run;
}

export async function storeFact(input: {
  key: string;
  value: string;
  score?: number;
  ttlMs?: number;
  source?: string;
}): Promise<FactRecord> {
  const response = await fetch(`${baseServerUrl}/api/facts/store`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Fact store endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as { fact: FactRecord };
  return payload.fact;
}

export async function recallFacts(input: {
  keywords: string[];
  limit?: number;
  minScore?: number;
}): Promise<FactRecord[]> {
  const response = await fetch(`${baseServerUrl}/api/facts/recall`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Fact recall endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as { facts: FactRecord[] };
  return payload.facts;
}