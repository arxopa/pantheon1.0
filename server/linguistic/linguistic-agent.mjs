export class LinguisticAgent {
  analyze({ message, history = [], taskId }) {
    const normalized = String(message ?? '').toLowerCase();
    const domains = [];
    const asksHow = normalized.includes('как ');
    const asksWhy = normalized.includes('почему');
    const asksToCheck = normalized.includes('провер') || normalized.includes('вериф');
    const asksToCreate = normalized.includes('создай') || normalized.includes('построй') || normalized.includes('добавь');
    const mentionsRepair = normalized.includes('ошиб') || normalized.includes('rollback') || normalized.includes('сбой') || normalized.includes('исправ');
    const mentionsReflection = normalized.includes('дух') || normalized.includes('резонанс') || normalized.includes('смысл');

    if (mentionsRepair) {
      domains.push('repair');
    }

    if (asksToCreate) {
      domains.push('creation');
    }

    if (asksWhy || asksHow || asksToCheck) {
      domains.push('analysis');
    }

    if (mentionsReflection) {
      domains.push('reflection');
    }

    let intent = domains[0] ?? (normalized.includes('?') ? 'question' : 'unknown');

    if (asksToCreate) {
      intent = 'creation';
    } else if (asksToCheck || asksHow || asksWhy) {
      intent = mentionsReflection && !mentionsRepair && !asksToCheck ? 'reflection' : 'analysis';
    } else if (mentionsReflection && !mentionsRepair) {
      intent = 'reflection';
    } else if (mentionsRepair) {
      intent = 'repair';
    }

    const tone = normalized.includes('срочно')
      ? 'urgent'
      : normalized.includes('ошиб') || normalized.includes('неправ')
        ? 'critical'
        : normalized.includes('резонанс') || normalized.includes('почему')
          ? 'reflective'
          : normalized.includes('сделай') || normalized.includes('добавь')
            ? 'directive'
            : 'neutral';
    const needsClarification = normalized.length < 12 || (history.length === 0 && normalized === 'сделай');
    const responseMode = needsClarification ? 'clarify' : tone === 'critical' ? 'warn' : 'answer';

    return {
      intent,
      tone,
      responseMode,
      needsClarification,
      domains: domains.length > 0 ? domains : [taskId ?? 'general'],
      resonanceHint: needsClarification
        ? 'Нужно уточнение, иначе резонанс с задачей будет слабым.'
        : 'Данных достаточно для контролируемого ответа и проверки через policy gate.',
    };
  }
}