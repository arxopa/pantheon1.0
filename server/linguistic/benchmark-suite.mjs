export const benchmarkSuite = [
  {
    id: 'bench-analysis',
    label: 'Analysis intent detection',
    message: 'Как проверить корректность самообучения после серии ошибок?',
    expectedIntent: 'analysis',
  },
  {
    id: 'bench-repair',
    label: 'Repair intent detection',
    message: 'После rollback исправь деградацию trace sentinel.',
    expectedIntent: 'repair',
  },
  {
    id: 'bench-creation',
    label: 'Creation intent detection',
    message: 'Добавь новый блок памяти и свяжи его с вычислительным контуром.',
    expectedIntent: 'creation',
  },
  {
    id: 'bench-reflection',
    label: 'Reflection resonance hint',
    message: 'Как система удерживает резонанс с реальностью и моей волей?',
    expectedIntent: 'reflection',
  },
];

export function runBenchmarkSuite(agent) {
  const cases = benchmarkSuite.map((testCase) => {
    const profile = agent.analyze({
      message: testCase.message,
      history: [],
      taskId: 'analysis',
    });
    const passed = profile.intent === testCase.expectedIntent;

    return {
      id: testCase.id,
      label: testCase.label,
      passed,
      score: passed ? 1 : 0,
      expected: testCase.expectedIntent,
      actual: profile.intent,
    };
  });

  const score = Number((cases.reduce((sum, item) => sum + item.score, 0) / cases.length).toFixed(2));

  return {
    id: `benchmark-${Date.now()}`,
    createdAt: new Date().toISOString(),
    suite: 'linguistic-agent-baseline',
    score,
    passed: score >= 0.75,
    cases,
  };
}