import { deepLearningModel } from '../data/agentModel';

function DeepLearningPanel() {
  return (
    <section className="panel deep-learning-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Deep Self-Learning</p>
          <h2>Модель глубинного самообучения</h2>
        </div>
        <span className="panel-meta">Perceive → encode → critique → update → distill</span>
      </div>

      <article className="linguistic-hero-card">
        <strong>{deepLearningModel.name}</strong>
        <p>{deepLearningModel.objective}</p>
        <small>{deepLearningModel.doctrine}</small>
      </article>

      <div className="task-grid deep-stage-grid">
        {deepLearningModel.stages.map((stage) => (
          <article key={stage.id} className="task-card">
            <h3>{stage.name}</h3>
            <p className="task-topology">{stage.owner}</p>
            <p className="task-supporting-copy">{stage.goal}</p>
            <dl className="task-details">
              <div>
                <dt>Input</dt>
                <dd>{stage.input}</dd>
              </div>
              <div>
                <dt>Output</dt>
                <dd>{stage.output}</dd>
              </div>
              <div>
                <dt>Guard</dt>
                <dd>{stage.guard}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="task-grid deep-loop-grid">
        {deepLearningModel.loops.map((loop) => (
          <article key={loop.id} className="task-card">
            <h3>{loop.name}</h3>
            <p className="task-topology">{loop.rhythm}</p>
            <p className="task-supporting-copy">Триггер: {loop.trigger}</p>
            <p className="task-supporting-copy">Результат: {loop.result}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default DeepLearningPanel;