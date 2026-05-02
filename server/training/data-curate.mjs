function normalizeText(value) {
  return String(value ?? '').trim();
}

function scoreRecord(record) {
  const assistantTurns = Array.isArray(record.messages)
    ? record.messages.filter((entry) => entry.role === 'assistant').length
    : 0;
  const contentLength = Array.isArray(record.messages)
    ? record.messages.reduce(
        (sum, entry) => sum + normalizeText(entry.content).length,
        0
      )
    : 0;
  const sourceReliability = Number(record.sourceReliability ?? 0);
  const toxicityPenalty = Number(record.toxicityScore ?? 0) * 0.8;

  return Number(
    Math.max(
      0,
      Math.min(
        1,
        sourceReliability * 0.55 +
          Math.min(contentLength / 800, 0.25) +
          Math.min(assistantTurns * 0.08, 0.2) -
          toxicityPenalty
      )
    ).toFixed(3)
  );
}

export function curateTrainingRecords(records = [], options = {}) {
  const minScore = Number(options.minScore ?? 0.45);
  const minSourceReliability = Number(options.minSourceReliability ?? 0.35);
  const kept = [];
  const rejected = [];

  for (const record of records) {
    const curationScore = scoreRecord(record);
    const hasAssistantTurn = Array.isArray(record.messages)
      ? record.messages.some(
          (entry) => entry.role === 'assistant' && normalizeText(entry.content)
        )
      : false;
    const rejectedReason = !record.privacyRedacted
      ? 'privacy-not-redacted'
      : Number(record.sourceReliability ?? 0) < minSourceReliability
        ? 'source-reliability-too-low'
        : Number(record.toxicityScore ?? 0) > 0.35
          ? 'toxicity-too-high'
          : !hasAssistantTurn
            ? 'missing-assistant-turn'
            : curationScore < minScore
              ? 'curation-score-too-low'
              : null;

    const next = {
      ...record,
      curationScore,
    };

    if (rejectedReason) {
      rejected.push({
        ...next,
        rejectedReason,
      });
      continue;
    }

    kept.push(next);
  }

  return {
    kept,
    rejected,
    summary: {
      total: records.length,
      kept: kept.length,
      rejected: rejected.length,
      averageCurationScore:
        kept.length > 0
          ? Number(
              (
                kept.reduce((sum, entry) => sum + entry.curationScore, 0) /
                kept.length
              ).toFixed(3)
            )
          : 0,
    },
  };
}
