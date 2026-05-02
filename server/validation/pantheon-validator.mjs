function normalizeText(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 2);
}

function overlapRatio(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(leftTokens.size, rightTokens.size);
}

function needsExternalEvidence(message) {
  return /проверь|источник|источники|факт|дата|когда|где|курс|погода|ссылка|ссылки|web|search|internet|интернет/i.test(
    String(message ?? ''),
  );
}

function extractNumbers(value) {
  return String(value ?? '').match(/\d+(?:[.,]\d+)?/g) ?? [];
}

function hasNegation(value) {
  return /\b(не|нет|никто|никогда|without|no|not)\b/i.test(String(value ?? ''));
}

function tokenSet(value) {
  return new Set(tokenize(value));
}

function clampPressure(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function extractVerifiableClaims(value) {
  const text = String(value ?? '');
  const claims = [];

  const claimPatterns = [
    { id: 'weather', pattern: /температур[аы]\s+[-+]?\d+(?:[.,]\d+)?|weather\s+is\s+[-+]?\d+/i },
    { id: 'exchange', pattern: /курс\s+[\p{L}\p{N}_-]+\s+[-+]?\d+(?:[.,]\d+)?|exchange\s+rate\s+[-+]?\d+/iu },
    { id: 'date', pattern: /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|сегодня\s+\d{1,2}[./]\d{1,2}[./]\d{2,4}/i },
    { id: 'time', pattern: /\b\d{1,2}:\d{2}\b|сейчас\s+\d{1,2}:\d{2}/i },
  ];

  for (const { id, pattern } of claimPatterns) {
    const match = text.match(pattern);

    if (match) {
      claims.push({ id, value: match[0] });
    }
  }

  return claims;
}

export class PantheonValidator {
  constructor(options = {}) {
    this.learningLedger = options.learningLedger ?? null;
    this.minFactScore = Number(options.minFactScore ?? process.env.PANTHEON_FACT_MIN_SCORE ?? 0.65);
  }

  async validate({ taskId, message, reply, history = [], researchReport = null }) {
    const checks = [];
    const replyText = String(reply ?? '');
    const queryText = String(message ?? '');
    const assistantHistory = history.filter((entry) => entry.role === 'assistant').slice(-2);
    const relatedFacts = this.learningLedger
      ? this.learningLedger.recallFactsByKeywords(tokenize(`${queryText} ${replyText}`), {
          limit: 10,
          minScore: this.minFactScore,
        })
      : [];
    const contradictionDetected = assistantHistory.some((entry) => overlapRatio(entry.content, replyText) > 0.68 && entry.content !== replyText);
    const contradictoryFact = relatedFacts.find((fact) => this._contradicts(replyText, fact.value));
    const verifiableClaims = extractVerifiableClaims(replyText);
    const evidenceRequired = needsExternalEvidence(queryText) || verifiableClaims.length > 0;
    const evidenceAvailable = Boolean(researchReport?.findings?.length);
    const trustedFactAvailable = relatedFacts.some((fact) => fact.score >= this.minFactScore);
    const groundingPass = replyText.length >= 120 || evidenceAvailable || trustedFactAvailable;
    const utilityPass = !/не знаю|не могу проверить|нет данных|не удалось проверить/i.test(replyText) || evidenceAvailable || trustedFactAvailable;
    const consistencyPass = !contradictionDetected && !contradictoryFact;
    const contradictionPressure = clampPressure(contradictoryFact ? 1 : contradictionDetected ? 0.78 : 0.04);
    const factualPressure = clampPressure(
      evidenceRequired
        ? evidenceAvailable || trustedFactAvailable
          ? verifiableClaims.length > 0 ? 0.18 : 0.1
          : verifiableClaims.length > 0 ? 0.92 : 0.72
        : 0.08,
    );
    const utilityPressure = clampPressure(groundingPass ? 0.14 : utilityPass ? 0.46 : 0.78);
    const uncertaintyPressure = clampPressure(
      evidenceAvailable || trustedFactAvailable
        ? contradictionPressure > 0.5 ? 0.45 : 0.16
        : evidenceRequired
          ? 0.88
          : 0.24,
    );
    const pressureProfile = {
      contradictionPressure,
      factualPressure,
      utilityPressure,
      uncertaintyPressure,
      overallPressure: clampPressure(
        contradictionPressure * 0.34
          + factualPressure * 0.31
          + utilityPressure * 0.17
          + uncertaintyPressure * 0.18,
      ),
    };
    const uncertaintyPosture = evidenceAvailable || trustedFactAvailable
      ? pressureProfile.overallPressure >= 0.55 ? 'cautious' : 'confident'
      : evidenceRequired ? 'insufficient-evidence' : 'cautious';

    checks.push({
      id: 'consistency',
      label: 'Internal consistency',
      passed: consistencyPass,
      severity: consistencyPass ? 'info' : 'critical',
      evidence: contradictoryFact
        ? `Ответ конфликтует с сохраненным фактом "${contradictoryFact.key}" (score ${contradictoryFact.score}).`
        : contradictionDetected
          ? 'Последний ответ меняет траекторию без новой опоры в истории.'
          : 'Явного внутреннего противоречия в ближайшей истории и fact-memory не найдено.',
    });

    checks.push({
      id: 'evidence',
      label: 'Factual grounding',
      passed: !evidenceRequired || evidenceAvailable || trustedFactAvailable,
      severity: evidenceRequired && !evidenceAvailable && !trustedFactAvailable ? 'critical' : 'info',
      evidence: evidenceAvailable
        ? `Pantheon Web Scout предоставил ${researchReport.findings.length} источника(ов).`
        : trustedFactAvailable
          ? `Fact-memory предоставила ${relatedFacts.length} релевантных факта(ов) с достаточным score.`
          : verifiableClaims.length > 0
            ? `Ответ содержит верифицируемые claims (${verifiableClaims.map((claim) => claim.value).join(', ')}), но подтверждение не найдено.`
        : evidenceRequired
          ? 'Для этого сообщения требуются внешние источники или доверенные факты, но подтверждение не найдено.'
          : 'Внешняя проверка не обязательна для этого сообщения.',
    });

    checks.push({
      id: 'utility',
      label: 'Utility posture',
      passed: groundingPass,
      severity: groundingPass ? 'info' : 'warn',
      evidence: groundingPass
        ? 'Ответ сохраняет рабочую траекторию и не обрывает действие без основания.'
        : utilityPass
          ? 'Ответ содержит минимальную полезность, но ему не хватает достаточной детализации.'
          : 'Ответ уходит в пассивное отрицание вместо следующего операционного шага.',
    });

    const passedCount = checks.filter((check) => check.passed).length;
    const score = Number((passedCount / checks.length).toFixed(2));
    const verdict = score >= 0.8 ? 'pass' : score >= 0.5 ? 'warn' : 'fail';
    const failureReasons = checks.filter((check) => !check.passed).map((check) => `${check.id}: ${check.evidence}`);

    return {
      id: `validation-${Date.now()}`,
      createdAt: new Date().toISOString(),
      taskId,
      message: queryText,
      passed: verdict === 'pass',
      verdict,
      score,
      researchStatus: researchReport?.status ?? 'skipped',
      factMatchCount: relatedFacts.length,
      factsUsed: relatedFacts.slice(0, 5).map((fact) => ({
        id: fact.id,
        key: fact.key,
        score: fact.score,
        source: fact.source,
        claimType: fact.claimType ?? 'fact',
        provenance: fact.provenance ?? 'manual',
      })),
      failureReasons,
      summary:
        verdict === 'pass'
          ? 'Pantheon Validator подтверждает рабочую связность ответа.'
          : verdict === 'warn'
            ? 'Pantheon Validator нашел слабые места и рекомендует усилить truth-metrics.'
            : 'Pantheon Validator считает ответ недостаточно верифицированным и удерживает прямую выдачу.',
      uncertaintyPosture,
      pressureProfile,
      checks,
    };
  }

  _contradicts(response, factValue) {
    const overlap = overlapRatio(response, factValue);

    if (overlap < 0.34) {
      return false;
    }

    const leftNumbers = extractNumbers(response);
    const rightNumbers = extractNumbers(factValue);
    const numericConflict = leftNumbers.length > 0 && rightNumbers.length > 0 && leftNumbers.join('|') !== rightNumbers.join('|');
    const negationConflict = hasNegation(response) !== hasNegation(factValue) && overlap >= 0.5;
    const leftTokens = tokenSet(response);
    const rightTokens = tokenSet(factValue);
    const leftOnly = [...leftTokens].filter((token) => !rightTokens.has(token));
    const rightOnly = [...rightTokens].filter((token) => !leftTokens.has(token));
    const entityConflict = overlap >= 0.6 && leftOnly.length > 0 && rightOnly.length > 0;

    return numericConflict || negationConflict || entityConflict;
  }
}