import { providerBlueprints, repoIntegrations } from './data/agentModel';
import type { AgentProviderBlueprint, RepoIntegration } from './types/agent';

export type AgentProviderAdapter = {
  integration: RepoIntegration;
  blueprint: AgentProviderBlueprint;
  summary: string;
  installCommand: string;
  runtimeHints: string[];
};

export function getProviderAdapter(providerId: string): AgentProviderAdapter {
  const integration = repoIntegrations.find((item) => item.id === providerId) ?? repoIntegrations[0];
  const blueprint = providerBlueprints.find((item) => item.id === providerId) ?? providerBlueprints[0];

  return {
    integration,
    blueprint,
    summary: `${integration.name}: ${integration.role}`,
    installCommand: `npm install ${integration.npmPackages.join(' ')}`,
    runtimeHints: [
      blueprint.orchestrationStyle,
      blueprint.linguisticStrategy,
      blueprint.traceStrategy,
    ],
  };
}

export function getAllInstallPackages() {
  return Array.from(new Set(repoIntegrations.flatMap((item) => item.npmPackages)));
}