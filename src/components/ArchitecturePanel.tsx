import { systemBlocks } from '../data/agentModel';

function ArchitecturePanel() {
  return (
    <section className="panel architecture-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Core Model</p>
          <h2>Базовые управляющие блоки</h2>
        </div>
        <span className="panel-meta">Immutable control envelope</span>
      </div>

      <div className="block-grid">
        {systemBlocks.map((block) => (
          <article key={block.id} className="system-card">
            <div className="card-topline">
              <span className="turn-badge">{block.id}</span>
              <div>
                <strong>{block.name}</strong>
                {block.deity ? <p className="deity-tag">{block.deity}</p> : null}
              </div>
            </div>
            <p>{block.role}</p>
            <dl className="system-metrics">
              {block.symbolism ? (
                <div>
                  <dt>Symbolism</dt>
                  <dd>{block.symbolism}</dd>
                </div>
              ) : null}
              <div>
                <dt>Authority</dt>
                <dd>{block.authority}</dd>
              </div>
              <div>
                <dt>Mutation Policy</dt>
                <dd>{block.mutationPolicy}</dd>
              </div>
            </dl>
            <div className="interface-row">
              {block.folder ? <span className="chip">{block.folder}</span> : null}
              {block.interfaces.map((item) => (
                <span key={item} className="chip">
                  {item}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ArchitecturePanel;