import { getProviderAdapter } from '../agentProviders';
import { repoIntegrations } from '../data/agentModel';

type IntegrationPanelProps = {
  selectedProviderId: string;
  onSelectProvider: (providerId: string) => void;
};

function IntegrationPanel({ selectedProviderId, onSelectProvider }: IntegrationPanelProps) {
  const adapter = getProviderAdapter(selectedProviderId);

  return (
    <section className="panel integration-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Git Integrations</p>
          <h2>Подключение агентных рантаймов</h2>
        </div>
        <span className="panel-meta">GitHub-backed provider registry</span>
      </div>

      <div className="task-selector" role="tablist" aria-label="Agent runtime providers">
        {repoIntegrations.map((integration) => (
          <button
            key={integration.id}
            type="button"
            className={`selector-pill${integration.id === selectedProviderId ? ' selector-pill-active' : ''}`}
            onClick={() => onSelectProvider(integration.id)}
          >
            {integration.name}
          </button>
        ))}
      </div>

      <div className="task-grid">
        <article className="task-card task-card-featured">
          <h3>{adapter.integration.name}</h3>
          <p className="task-topology">{adapter.integration.repository}</p>
          <p className="task-supporting-copy">{adapter.integration.whyFits}</p>
          <dl className="task-details">
            <div>
              <dt>Role</dt>
              <dd>{adapter.integration.role}</dd>
            </div>
            <div>
              <dt>Runtime Shape</dt>
              <dd>{adapter.blueprint.orchestrationStyle}</dd>
            </div>
            <div>
              <dt>Install</dt>
              <dd>{adapter.installCommand}</dd>
            </div>
          </dl>
        </article>

        <article className="task-card">
          <h3>Capabilities</h3>
          <div className="interface-row">
            {adapter.integration.capabilities.map((item) => (
              <span key={item} className="chip">
                {item}
              </span>
            ))}
          </div>
        </article>

        <article className="task-card">
          <h3>Bootstrap</h3>
          <p className="task-supporting-copy">{adapter.blueprint.linguisticStrategy}</p>
          <div className="interface-row">
            {adapter.blueprint.bootstrapSteps.map((step) => (
              <span key={step} className="chip">
                {step}
              </span>
            ))}
          </div>
        </article>

        <article className="task-card">
          <h3>Env keys</h3>
          <div className="interface-row">
            {adapter.integration.envKeys.map((item) => (
              <span key={item} className="chip">
                {item}
              </span>
            ))}
          </div>
        </article>

        <article className="task-card">
          <h3>Limits</h3>
          <p className="task-supporting-copy">{adapter.integration.limits.join('. ')}</p>
        </article>
      </div>
    </section>
  );
}

export default IntegrationPanel;