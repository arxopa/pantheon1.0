import { linguisticBlock } from '../data/agentModel';

function LinguisticPanel() {
  return (
    <section className="panel linguistic-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Linguistic Core</p>
          <h2>Лингвистический блок нейросети</h2>
        </div>
        <span className="panel-meta">Intent → route → memory → answer</span>
      </div>

      <article className="linguistic-hero-card">
        <strong>{linguisticBlock.name}</strong>
        <p>{linguisticBlock.mission}</p>
        <small>{linguisticBlock.policy}</small>
      </article>

      <div className="block-grid linguistic-node-grid">
        {linguisticBlock.nodes.map((node) => (
          <article key={node.id} className="system-card">
            <div className="card-topline">
              <span className="turn-badge">{node.id}</span>
              <strong>{node.name}</strong>
            </div>
            <p>{node.purpose}</p>
            <dl className="system-metrics">
              <div>
                <dt>Inputs</dt>
                <dd>{node.inputs.join(', ')}</dd>
              </div>
              <div>
                <dt>Outputs</dt>
                <dd>{node.outputs.join(', ')}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="task-grid linguistic-capability-grid">
        {linguisticBlock.capabilities.map((capability) => (
          <article key={capability.label} className="task-card">
            <h3>{capability.label}</h3>
            <p className="task-supporting-copy">{capability.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default LinguisticPanel;