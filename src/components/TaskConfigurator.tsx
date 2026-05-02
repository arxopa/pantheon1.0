import { taskProfiles } from '../data/agentModel';
import type { TaskProfile } from '../types/agent';

type TaskConfiguratorProps = {
  activeTask: TaskProfile;
  onSelectTask: (taskId: string) => void;
};

function TaskConfigurator({ activeTask, onSelectTask }: TaskConfiguratorProps) {
  return (
    <section className="panel tasks-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Adaptive Topology</p>
          <h2>Подстройка под тип задачи</h2>
        </div>
        <span className="panel-meta">Cluster registry</span>
      </div>

      <div className="task-selector" role="tablist" aria-label="Task profiles">
        {taskProfiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            className={`selector-pill${profile.id === activeTask.id ? ' selector-pill-active' : ''}`}
            onClick={() => onSelectTask(profile.id)}
          >
            {profile.task}
          </button>
        ))}
      </div>

      <div className="task-grid">
        <article className="task-card task-card-featured">
          <h3>{activeTask.task}</h3>
          <p className="task-topology">{activeTask.topology}</p>
          <p className="task-objective">{activeTask.objective}</p>
          <dl className="task-details">
            <div>
              <dt>Control Core</dt>
              <dd>{activeTask.controllerDecision}</dd>
            </div>
            <div>
              <dt>Compute Core</dt>
              <dd>{activeTask.computeDecision}</dd>
            </div>
            <div>
              <dt>Trace Sentinel</dt>
              <dd>{activeTask.traceFocus}</dd>
            </div>
          </dl>
        </article>

        <article className="task-card">
          <h3>Активные кластеры</h3>
          <div className="interface-row">
            {activeTask.clusterSet.map((cluster) => (
              <span key={cluster} className="chip">
                {cluster}
              </span>
            ))}
          </div>
          <p className="task-supporting-copy">
            Compute Core собирает именно этот набор модулей перед тестом и подает его в
            защищенный маршрут согласования.
          </p>
        </article>

        <article className="task-card">
          <h3>Политика запуска</h3>
          <p className="task-supporting-copy">
            Control Core выдает разрешение только на те кластеры, которые проходят через
            sandbox, телеметрию Trace Sentinel и журнал rollback checkpoint.
          </p>
        </article>
      </div>
    </section>
  );
}

export default TaskConfigurator;