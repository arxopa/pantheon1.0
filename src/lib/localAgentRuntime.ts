import { getProviderAdapter } from '../agentProviders';
import { getTaskProfile } from '../agentRuntime';
import type { AgentExecutionRequest, AgentExecutionResponse } from '../types/agent';
import { runDeepSelfLearningCycle } from './deepSelfLearning';

function summarizeHistoryTurns(historyLength: number) {
  if (historyLength <= 1) {
    return 'single-turn focus';
  }

  if (historyLength <= 4) {
    return 'short-session context';
  }

  return 'long-session compression';
}

export async function runLocalAgentRuntime(
  request: AgentExecutionRequest,
): Promise<AgentExecutionResponse> {
  const task = getTaskProfile(request.taskId);
  const provider = getProviderAdapter(request.providerId);
  const historyMode = summarizeHistoryTurns(request.history.length);
  const learningReport = runDeepSelfLearningCycle({
    message: request.message,
    taskId: request.taskId,
    history: request.history,
  });
  const replyText = [
    `Лингвистический блок принял запрос: "${request.message}".`,
    `Semantic Router выбрал профиль задачи "${task.task}" и runtime "${provider.integration.name}".`,
    `Control Core удержал инварианты, Compute Core собрал кластеры ${task.clusterSet.join(', ')}, а Trace Sentinel включил режим ${task.traceFocus.toLowerCase()}.`,
    `Mandala report: ${learningReport.summary}`,
    `Shiva-gate: ${learningReport.policy.reason}`,
    `Текущий режим истории: ${historyMode}.`,
    `Следующий безопасный шаг: ${provider.blueprint.bootstrapSteps[0]}.`,
  ].join(' ');

  return {
    reply: {
      id: `assistant-local-${Date.now()}`,
      role: 'assistant',
      content: replyText,
    },
    runtimeSource: 'local-fallback',
    providerLabel: provider.integration.name,
    trace: [
      `[linguistic] intent graph built for ${task.task}`,
      `[router] provider selected: ${provider.integration.name}`,
      `[learning] ${learningReport.summary}`,
      `[policy] ${learningReport.policy.reason}`,
      `[memory] distilled shards: ${learningReport.memoryShards.length}`,
      `[compute] active cluster set: ${task.clusterSet.join(', ')}`,
      `[trace] fallback runtime returned simulated answer`,
    ],
    learningReport,
  };
}