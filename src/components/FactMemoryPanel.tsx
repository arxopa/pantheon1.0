import { useState } from 'react';

import { recallFacts, storeFact } from '../lib/learningDiagnostics';
import type { FactRecord } from '../types/agent';

function FactMemoryPanel() {
  const [factKey, setFactKey] = useState('capital-of-france');
  const [factValue, setFactValue] = useState('Столица Франции — Париж.');
  const [factScore, setFactScore] = useState('0.95');
  const [factStatus, setFactStatus] = useState<string | null>(null);
  const [query, setQuery] = useState('париж франции');
  const [facts, setFacts] = useState<FactRecord[]>([]);
  const [pending, setPending] = useState(false);

  const handleStore = async () => {
    if (pending) {
      return;
    }

    setPending(true);
    setFactStatus(null);

    try {
      const fact = await storeFact({
        key: factKey,
        value: factValue,
        score: Number(factScore),
        source: 'ui-manual-fact',
      });
      setFactStatus(`Факт сохранен: ${fact.key} / score ${fact.score}.`);
    } catch (error) {
      setFactStatus(error instanceof Error ? error.message : 'Не удалось сохранить факт.');
    } finally {
      setPending(false);
    }
  };

  const handleRecall = async () => {
    if (pending) {
      return;
    }

    setPending(true);
    setFactStatus(null);

    try {
      const result = await recallFacts({
        keywords: query.split(/\s+/).filter(Boolean),
        limit: 5,
        minScore: 0.6,
      });
      setFacts(result);
      setFactStatus(`Найдено фактов: ${result.length}.`);
    } catch (error) {
      setFactStatus(error instanceof Error ? error.message : 'Не удалось прочитать fact memory.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="panel fact-memory-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Fact Memory</p>
          <h2>Ручное управление фактами</h2>
        </div>
        <span className="panel-meta">Phase 2</span>
      </div>

      <div className="fact-memory-grid">
        <div className="learning-report-card">
          <strong>Store fact</strong>
          <input className="feedback-reason-input" value={factKey} onChange={(event) => setFactKey(event.target.value)} placeholder="fact key" />
          <textarea className="console-input" rows={3} value={factValue} onChange={(event) => setFactValue(event.target.value)} placeholder="fact value" />
          <input className="feedback-reason-input" value={factScore} onChange={(event) => setFactScore(event.target.value)} placeholder="0.0 .. 1.0" />
          <div className="action-bar">
            <button type="button" className="action-button" onClick={handleStore} disabled={pending}>
              {pending ? 'Сохраняем...' : 'Сохранить факт'}
            </button>
          </div>
        </div>

        <div className="learning-report-card">
          <strong>Recall facts</strong>
          <input className="feedback-reason-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="keywords" />
          <div className="action-bar">
            <button type="button" className="action-button action-button-secondary" onClick={handleRecall} disabled={pending}>
              {pending ? 'Ищем...' : 'Искать в памяти'}
            </button>
          </div>
          <div className="learning-list">
            {facts.map((fact) => (
              <div key={fact.id} className="learning-list-item">
                <span>{fact.source}</span>
                <strong>{fact.score}</strong>
                <p>{fact.key}</p>
                <p>{fact.value}</p>
              </div>
            ))}
            {facts.length === 0 ? <p className="learning-report-copy">Запросите recall, чтобы увидеть факты.</p> : null}
          </div>
        </div>
      </div>

      {factStatus ? <p className="learning-report-copy">{factStatus}</p> : null}
    </section>
  );
}

export default FactMemoryPanel;