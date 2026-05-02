import { useState } from 'react';

import { executeAgentTurn } from '../lib/agentClient';
import { submitAgentFeedback } from '../lib/learningDiagnostics';
import type {
  AgentChatMessage,
  AgentExecutionMode,
  AgentExecutionResponse,
  AtmanReport,
  LinguisticProfile,
  LearningReport,
  NavigationRun,
  NetSurferRun,
  ResearchRun,
  TaskProfile,
  ValidationRun,
} from '../types/agent';

type AgentConsoleProps = {
  providerId: string;
  providerLabel: string;
  activeTask: TaskProfile;
};

const initialMessages: AgentChatMessage[] = [
  {
    id: 'system-1',
    role: 'system',
    content:
      'Пантеон готов. Введите задачу, и Ребенок богов выберет кластер, безопасный путь исполнения, web-scout и контур верификации.',
  },
];

function AgentConsole({ providerId, providerLabel, activeTask }: AgentConsoleProps) {
  const [messages, setMessages] = useState<AgentChatMessage[]>(initialMessages);
  const [traceLines, setTraceLines] = useState<string[]>([]);
  const [mode, setMode] = useState<AgentExecutionMode>('auto');
  const [draft, setDraft] = useState('Собери безопасный план интеграции нового вычислительного кластера для аналитической задачи.');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRuntime, setLastRuntime] = useState<string>('not started');
  const [learningReport, setLearningReport] = useState<LearningReport | null>(null);
  const [linguisticProfile, setLinguisticProfile] = useState<LinguisticProfile | null>(null);
  const [researchReport, setResearchReport] = useState<ResearchRun | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationRun | null>(null);
  const [navigationReport, setNavigationReport] = useState<NavigationRun | null>(null);
  const [netsurferReport, setNetSurferReport] = useState<NetSurferRun | null>(null);
  const [atmanReport, setAtmanReport] = useState<AtmanReport | null>(null);
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [feedbackReason, setFeedbackReason] = useState('');

  const handleSend = async () => {
    const message = draft.trim();

    if (!message || pending) {
      return;
    }

    const userMessage: AgentChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
    };

    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setDraft('');
    setPending(true);
    setError(null);

    try {
      const response: AgentExecutionResponse = await executeAgentTurn({
        message,
        taskId: activeTask.id,
        providerId,
        mode,
        history: nextHistory,
      });

      setMessages((current) => [...current, response.reply]);
      setTraceLines(response.trace);
      setLearningReport(response.learningReport ?? null);
      setLinguisticProfile(response.linguisticProfile ?? null);
      setResearchReport(response.researchReport ?? null);
      setValidationReport(response.validationReport ?? null);
      setNavigationReport(response.navigationReport ?? null);
      setNetSurferReport(response.netsurferReport ?? null);
      setAtmanReport(response.atmanReport ?? null);
      setFeedbackStatus(null);
      setLastRuntime(`${response.providerLabel} / ${response.runtimeSource}`);
    } catch (requestError) {
      const nextError = requestError instanceof Error ? requestError.message : 'Unknown runtime error';
      setError(nextError);
    } finally {
      setPending(false);
    }
  };

  const handleFeedback = async (sentiment: 'positive' | 'negative') => {
    const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
    const latestAssistantIndex = latestAssistantMessage
      ? messages.findIndex((message) => message.id === latestAssistantMessage.id)
      : -1;
    const relatedUserMessage = latestAssistantIndex > 0
      ? [...messages.slice(0, latestAssistantIndex)].reverse().find((message) => message.role === 'user') ?? null
      : null;

    if (!latestAssistantMessage || feedbackPending) {
      return;
    }

    setFeedbackPending(true);
    setFeedbackStatus(null);

    try {
      const result = await submitAgentFeedback({
        messageId: latestAssistantMessage.id,
        taskId: activeTask.id,
        providerId,
        sentiment,
        reason:
          feedbackReason.trim() ||
          (sentiment === 'positive' ? 'user-approved-response' : 'user-marked-response-as-incorrect'),
        userMessage: relatedUserMessage?.content,
        assistantMessage: latestAssistantMessage.content,
        autoCreateTest: sentiment === 'positive',
        testThreshold: 0.35,
      });
      setFeedbackReason('');
      if (result.autoApply) {
        setFeedbackStatus(
          `Обратная связь сохранена. Auto-apply: applied ${result.autoApply.appliedCount}, rejected ${result.autoApply.rejectedCount}, pending ${result.autoApply.pendingAfter}.`,
        );
      } else if (result.generatedTestCase) {
        setFeedbackStatus(`Положительная обратная связь сохранена и создан regression test ${result.generatedTestCase.id}.`);
      } else {
        setFeedbackStatus(sentiment === 'positive' ? 'Положительная обратная связь сохранена.' : 'Отрицательная обратная связь сохранена.');
      }
    } catch (feedbackError) {
      setFeedbackStatus(feedbackError instanceof Error ? feedbackError.message : 'Не удалось сохранить обратную связь.');
    } finally {
      setFeedbackPending(false);
    }
  };

  return (
    <section className="panel console-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Agent Console</p>
          <h2>Живой диалог с агентом</h2>
        </div>
        <span className="panel-meta">{providerLabel}</span>
      </div>

      <div className="console-toolbar">
        <div className="task-selector" role="tablist" aria-label="Execution mode">
          {(['auto', 'server', 'local'] as AgentExecutionMode[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`selector-pill${mode === item ? ' selector-pill-active' : ''}`}
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="runtime-stats">
          <article className="runtime-stat">
            <span>Task</span>
            <strong>{activeTask.task}</strong>
          </article>
          <article className="runtime-stat">
            <span>Last Runtime</span>
            <strong>{lastRuntime}</strong>
          </article>
        </div>
      </div>

      <div className="console-grid">
        <div className="console-thread">
          {messages.map((message) => (
            <article key={message.id} className={`message-bubble message-${message.role}`}>
              <span className="message-role">{message.role}</span>
              <p>{message.content}</p>
            </article>
          ))}
        </div>

        <div className="console-trace">
          <strong>Runtime trace</strong>
          <pre className="trace-log console-trace-log">
            {traceLines.length > 0 ? (
              traceLines.map((line) => <span key={line}>{line}</span>)
            ) : (
              <span>[trace] awaiting first execution</span>
            )}
          </pre>

          {learningReport ? (
            <div className="learning-report-card">
              <strong>Learning report</strong>
              <p>{learningReport.summary}</p>
              <div className="learning-report-grid">
                <article className="runtime-stat">
                  <span>Loop</span>
                  <strong>{learningReport.loop}</strong>
                </article>
                <article className="runtime-stat">
                  <span>Patch Target</span>
                  <strong>{learningReport.candidatePatch.target}</strong>
                </article>
                <article className="runtime-stat">
                  <span>Shiva Gate</span>
                  <strong>{learningReport.policy.approved ? 'approved' : 'manual review'}</strong>
                </article>
                <article className="runtime-stat">
                  <span>Memory Shards</span>
                  <strong>{learningReport.memoryShards.length}</strong>
                </article>
              </div>
              <p className="learning-report-copy">{learningReport.policy.reason}</p>
              <p className="learning-report-copy">
                Error journal: {learningReport.errorJournal.length} entries. Rollback checkpoint:{' '}
                {learningReport.policy.rollbackCheckpoint}
              </p>

              {linguisticProfile ? (
                <div className="learning-report-card nested-report-card">
                  <strong>Linguistic agent</strong>
                  <div className="learning-report-grid">
                    <article className="runtime-stat">
                      <span>Intent</span>
                      <strong>{linguisticProfile.intent}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>Tone</span>
                      <strong>{linguisticProfile.tone}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>Mode</span>
                      <strong>{linguisticProfile.responseMode}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>Clarify</span>
                      <strong>{linguisticProfile.needsClarification ? 'yes' : 'no'}</strong>
                    </article>
                  </div>
                  <p className="learning-report-copy">{linguisticProfile.resonanceHint}</p>
                </div>
              ) : null}

              {researchReport ? (
                <div className="learning-report-card nested-report-card">
                  <strong>Pantheon Web Scout</strong>
                  <div className="learning-report-grid">
                    <article className="runtime-stat">
                      <span>Status</span>
                      <strong>{researchReport.status}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>Sources</span>
                      <strong>{researchReport.sourceCount}</strong>
                    </article>
                  </div>
                  <p className="learning-report-copy">{researchReport.summary}</p>
                </div>
              ) : null}

              {navigationReport ? (
                <div className="learning-report-card nested-report-card">
                  <strong>Pantheon Navigation Core</strong>
                  <div className="learning-report-grid">
                    <article className="runtime-stat">
                      <span>Status</span>
                      <strong>{navigationReport.status}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>Visited</span>
                      <strong>{navigationReport.visitedCount}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>Blocked</span>
                      <strong>{navigationReport.blockedCount}</strong>
                    </article>
                  </div>
                  <p className="learning-report-copy">{navigationReport.summary}</p>
                </div>
              ) : null}

              {netsurferReport ? (
                <div className="learning-report-card nested-report-card">
                  <strong>Pantheon NetSurfer</strong>
                  <div className="learning-report-grid">
                    <article className="runtime-stat">
                      <span>Action</span>
                      <strong>{netsurferReport.action}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>Status</span>
                      <strong>{netsurferReport.status}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>Installed</span>
                      <strong>{netsurferReport.installed ? 'yes' : 'no'}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>Page</span>
                      <strong>{netsurferReport.pageTitle ?? 'n/a'}</strong>
                    </article>
                  </div>
                  <p className="learning-report-copy">{netsurferReport.summary}</p>
                  {netsurferReport.url ? <p className="learning-report-copy">URL: {netsurferReport.url}</p> : null}
                  {netsurferReport.error ? <p className="learning-report-copy">Error: {netsurferReport.error}</p> : null}
                </div>
              ) : null}

              {atmanReport ? (
                <div className="learning-report-card nested-report-card">
                  <strong>Atman</strong>
                  <div className="learning-report-grid">
                    <article className="runtime-stat">
                      <span>Model</span>
                      <strong>{atmanReport.modelType}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>User</span>
                      <strong>{atmanReport.userId}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>History</span>
                      <strong>{atmanReport.historyLength}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>Warmth</span>
                      <strong>{atmanReport.weights.warmth}</strong>
                    </article>
                  </div>
                  <p className="learning-report-copy">Atman хранит диалоговую память в ключе {atmanReport.memoryKey} и постепенно меняет стиль через gradients.</p>
                </div>
              ) : null}

              {validationReport ? (
                <div className="learning-report-card nested-report-card">
                  <strong>Pantheon Validator</strong>
                  <div className="learning-report-grid">
                    <article className="runtime-stat">
                      <span>Verdict</span>
                      <strong>{validationReport.verdict}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>Score</span>
                      <strong>{validationReport.score}</strong>
                    </article>
                    <article className="runtime-stat">
                      <span>Fact Matches</span>
                      <strong>{validationReport.factMatchCount}</strong>
                    </article>
                  </div>
                  <p className="learning-report-copy">{validationReport.summary}</p>
                  {validationReport.failureReasons.length > 0 ? (
                    <div className="learning-list">
                      {validationReport.failureReasons.map((reason) => (
                        <div key={reason} className="learning-list-item">
                          <span>failure</span>
                          <p>{reason}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="console-input-wrap">
        <textarea
          className="console-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Опишите задачу для агентной системы"
          rows={4}
        />
        <div className="action-bar">
          <button type="button" className="action-button" onClick={handleSend} disabled={pending}>
            {pending ? 'Выполнение...' : 'Отправить в агент'}
          </button>
          <button
            type="button"
            className="action-button action-button-secondary"
            onClick={() => handleFeedback('positive')}
            disabled={feedbackPending}
          >
            + Верно
          </button>
          <button
            type="button"
            className="action-button action-button-warning"
            onClick={() => handleFeedback('negative')}
            disabled={feedbackPending}
          >
            - Неверно
          </button>
        </div>
        <input
          className="feedback-reason-input"
          value={feedbackReason}
          onChange={(event) => setFeedbackReason(event.target.value)}
          placeholder="Причина оценки: что было верно или что именно пошло не так"
        />
        {feedbackStatus ? <p className="learning-report-copy">{feedbackStatus}</p> : null}
        {error ? <p className="console-error">{error}</p> : null}
      </div>
    </section>
  );
}

export default AgentConsole;