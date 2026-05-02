import { getProviderAdapter } from '../agentProviders';
import type { AgentExecutionRequest, AgentExecutionResponse } from '../types/agent';
import { runLocalAgentRuntime } from './localAgentRuntime';

const defaultApiUrl = import.meta.env.VITE_AGENT_API_URL ?? 'http://localhost:8787/api/agent/run';

export async function executeAgentTurn(
  request: AgentExecutionRequest,
): Promise<AgentExecutionResponse> {
  if (request.mode === 'local') {
    return runLocalAgentRuntime(request);
  }

  try {
    const response = await fetch(defaultApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Agent server returned ${response.status}`);
    }

    return (await response.json()) as AgentExecutionResponse;
  } catch (error) {
    if (request.mode === 'server') {
      throw error;
    }

    const fallback = await runLocalAgentRuntime(request);
    const provider = getProviderAdapter(request.providerId);

    return {
      ...fallback,
      trace: [
        `[bridge] remote runtime unavailable, switching to local fallback for ${provider.integration.name}`,
        ...fallback.trace,
      ],
    };
  }
}