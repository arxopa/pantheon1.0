import { invariants } from '../data/agentModel';
import type { AgentRuntimeState } from '../types/agent';

type TracePanelProps = {
  runtime: AgentRuntimeState;
};

function TracePanel({ runtime }: TracePanelProps) {
  return (
    <aside className="panel trace-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Trace Layer</p>
          <h2>Приоритетные сигналы</h2>
        </div>
        <span className="panel-meta">Sentinel first</span>
      </div>

      <div className="runtime-stats">
        <article className="runtime-stat">
          <span>Status</span>
          <strong>{runtime.status}</strong>
        </article>
        <article className="runtime-stat">
          <span>Trace Priority</span>
          <strong>{runtime.tracePriority}</strong>
        </article>
        <article className="runtime-stat">
          <span>Checkpoint</span>
          <strong>{runtime.lastCheckpoint}</strong>
        </article>
      </div>

      <pre className="trace-log">
        {runtime.traceEntries.map((line) => (
          <span key={line.id} className={`trace-${line.level}`}>
            {line.message}
          </span>
        ))}
      </pre>

      <div className="invariant-list">
        {invariants.map((item) => (
          <article key={item} className="invariant-card">
            <p>{item}</p>
          </article>
        ))}
      </div>
    </aside>
  );
}

export default TracePanel;