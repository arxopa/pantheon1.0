import type { AgentRuntimeState, TaskProfile } from '../types/agent';

type RuntimeControlPanelProps = {
  activeTask: TaskProfile;
  runtime: AgentRuntimeState;
  onAdvancePhase: () => void;
  onRunCycle: () => void;
  onTriggerFault: () => void;
  onQueueManualReview: () => void;
  onReset: () => void;
};

function RuntimeControlPanel({
  activeTask,
  runtime,
  onAdvancePhase,
  onRunCycle,
  onTriggerFault,
  onQueueManualReview,
  onReset,
}: RuntimeControlPanelProps) {
  return (
    <section className="panel runtime-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Live Simulation</p>
          <h2>Жизненный цикл кластера</h2>
        </div>
        <span className="panel-meta">Controller-supervised runtime</span>
      </div>

      <div className="runtime-layout">
        <div className="runtime-card">
          <strong>Текущая задача</strong>
          <p>{activeTask.task}</p>
          <small>{activeTask.objective}</small>
        </div>

        <div className="runtime-card">
          <strong>Фаза</strong>
          <p>{runtime.phase}</p>
          <small>
            {runtime.computeDelegated
              ? 'Compute Core временно передал управление Control Core.'
              : 'Compute Core работает в штатном режиме.'}
          </small>
        </div>

        <div className="runtime-card">
          <strong>Активные кластеры</strong>
          <div className="interface-row">
            {runtime.activeClusters.map((cluster) => (
              <span key={cluster} className="chip">
                {cluster}
              </span>
            ))}
          </div>
        </div>

        <div className="runtime-card">
          <strong>Ограничения</strong>
          <p>{runtime.controlLock ? 'Контрольный контур зафиксировал рискованные каналы.' : 'Система в устойчивом режиме.'}</p>
          <small>
            {runtime.manualReviewQueued
              ? 'Ручной review Control Core уже поставлен в очередь.'
              : 'Реструктуризация Control Core пока требует отдельного ручного запроса.'}
          </small>
        </div>

        <div className="runtime-card">
          <strong>Провайдер</strong>
          <p>{runtime.selectedProviderId}</p>
          <small>Лингвистический блок маршрутизирует задачу через выбранный агентный runtime.</small>
        </div>
      </div>

      <div className="action-bar">
        <button type="button" className="action-button" onClick={onAdvancePhase}>
          Шаг цикла
        </button>
        <button type="button" className="action-button action-button-secondary" onClick={onRunCycle}>
          Полный прогон
        </button>
        <button type="button" className="action-button action-button-warning" onClick={onTriggerFault}>
          Сымитировать сбой
        </button>
        <button type="button" className="action-button action-button-ghost" onClick={onQueueManualReview}>
          Запросить ручной review
        </button>
        <button type="button" className="action-button action-button-ghost" onClick={onReset}>
          Сбросить
        </button>
      </div>
    </section>
  );
}

export default RuntimeControlPanel;