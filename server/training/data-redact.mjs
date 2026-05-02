function redactText(value) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[redacted-phone]')
    .replace(
      /(sk-[a-z0-9]{8,}|ghp_[a-z0-9]{8,}|AIza[0-9A-Za-z\-_]{20,})/gi,
      '[redacted-secret]'
    );
}

export function redactTrainingRecords(records = []) {
  return records.map((record) => ({
    ...record,
    privacyRedacted: true,
    messages: Array.isArray(record.messages)
      ? record.messages.map((message) => ({
          ...message,
          content: redactText(message.content),
        }))
      : [],
    metadata: {
      ...record.metadata,
      sourceUrl: record.metadata?.sourceUrl ?? null,
    },
  }));
}
