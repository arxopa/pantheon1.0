import { protocolSteps } from '../data/agentModel';
import type { RuntimePhase } from '../types/agent';

type ProtocolPanelProps = {
  phase: RuntimePhase;
};

function ProtocolPanel({ phase }: ProtocolPanelProps) {
  return (
    <section className="panel protocol-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Mutation Protocol</p>
          <h2>Контролируемая реструктуризация</h2>
        </div>
        <span className="panel-meta">Request → freeze → test → commit</span>
      </div>

      <div className="protocol-list">
        {protocolSteps.map((step, index) => {
          const phaseIndex = ['idle', 'request', 'freeze', 'test', 'commit', 'rollback'].indexOf(phase);
          const isActive = index > 0 ? index <= phaseIndex - 1 : phase === 'request';

          return (
            <article
              key={step.step}
              className={`protocol-step${isActive ? ' protocol-step-active' : ''}`}
            >
              <span className="turn-badge">{step.step}</span>
              <strong>{step.owner}</strong>
              <p>{step.action}</p>
              <small>{step.guard}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default ProtocolPanel;