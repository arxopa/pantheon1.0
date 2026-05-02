import { readFile } from 'node:fs/promises';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeRole(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized === 'system' ||
    normalized === 'assistant' ||
    normalized === 'user'
  ) {
    return normalized;
  }
  return 'user';
}

function normalizeMessages(messages, personality) {
  if (Array.isArray(messages) && messages.length > 0) {
    return messages
      .map((entry) => ({
        role: normalizeRole(entry?.role),
        content: normalizeText(entry?.content),
      }))
      .filter((entry) => entry.content);
  }

  return [
    {
      role: 'system',
      content: `Personality contract for ${personality.displayName ?? personality.id}.`,
    },
    {
      role: 'assistant',
      content: `${personality.displayName ?? personality.id} prepares a safe curated training slice.`,
    },
  ];
}

function createSeedExample(payload, personality) {
  return {
    id: `seed-${personality.id}-${Date.now()}`,
    personalityId: personality.id,
    sourceType: 'manual',
    sourceReliability: 0.85,
    createdAt: new Date().toISOString(),
    language: normalizeText(payload.language) || 'ru',
    tags: Array.isArray(payload.tags)
      ? payload.tags.map((entry) => normalizeText(entry)).filter(Boolean)
      : ['seed'],
    toxicityScore: 0,
    privacyRedacted: true,
    messages: normalizeMessages(payload.messages, personality),
    metadata: {
      sourceUrl: null,
      feedbackScore: null,
      resonanceHint: normalizeText(payload.operatorNote) || null,
      multimodal: false,
    },
  };
}

function normalizeRecord(record, payload, personality, index) {
  const messages = normalizeMessages(record?.messages, personality);
  if (messages.length === 0) {
    return null;
  }

  return {
    id:
      normalizeText(record?.id) ||
      `record-${personality.id}-${Date.now()}-${index}`,
    personalityId: personality.id,
    sourceType:
      normalizeText(record?.sourceType) ||
      normalizeText(payload.sourceType) ||
      'manual',
    sourceReliability: Number(
      record?.sourceReliability ?? payload.sourceReliability ?? 0.7
    ),
    createdAt: record?.createdAt ?? new Date().toISOString(),
    language: normalizeText(record?.language ?? payload.language) || 'ru',
    tags: Array.isArray(record?.tags)
      ? record.tags.map((entry) => normalizeText(entry)).filter(Boolean)
      : Array.isArray(payload.tags)
        ? payload.tags.map((entry) => normalizeText(entry)).filter(Boolean)
        : [],
    toxicityScore: Number(record?.toxicityScore ?? 0),
    privacyRedacted: record?.privacyRedacted === true,
    messages,
    metadata: {
      sourceUrl:
        normalizeText(record?.metadata?.sourceUrl ?? payload.sourceUrl) || null,
      feedbackScore: record?.metadata?.feedbackScore ?? null,
      resonanceHint:
        normalizeText(record?.metadata?.resonanceHint) ||
        normalizeText(payload.operatorNote) ||
        null,
      multimodal: Boolean(record?.metadata?.multimodal),
    },
  };
}

export async function ingestTrainingPayload(payload = {}, options = {}) {
  const personality = options.personality ?? {
    id: normalizeText(payload.personalityId) || 'default',
    displayName: 'Default',
  };
  let sourceRecords = [];

  if (normalizeText(payload.sourceFile)) {
    const raw = await readFile(normalizeText(payload.sourceFile), 'utf8');
    sourceRecords = JSON.parse(raw);
  } else if (Array.isArray(payload.examples)) {
    sourceRecords = payload.examples;
  } else if (Array.isArray(payload.records)) {
    sourceRecords = payload.records;
  }

  const records = sourceRecords
    .map((entry, index) => normalizeRecord(entry, payload, personality, index))
    .filter(Boolean);

  if (records.length > 0) {
    return records;
  }

  return [createSeedExample(payload, personality)];
}
