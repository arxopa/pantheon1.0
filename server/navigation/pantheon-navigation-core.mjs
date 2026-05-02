function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripMarkup(input) {
  return String(input ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripMarkup(match[1]) : 'Untitled page';
}

function extractLinks(html, baseUrl) {
  const links = [];
  const pattern = /<a[^>]+href="([^"]+)"/gi;
  let match;

  while ((match = pattern.exec(String(html ?? ''))) && links.length < 12) {
    try {
      const url = new URL(match[1], baseUrl).toString();
      links.push(url);
    } catch {
      continue;
    }
  }

  return links;
}

function parseRobotsTxt(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const disallow = [];
  let applies = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const [directive, ...rest] = line.split(':');

    if (!directive || rest.length === 0) {
      continue;
    }

    const value = rest.join(':').trim();
    const normalizedDirective = directive.trim().toLowerCase();

    if (normalizedDirective === 'user-agent') {
      applies = value === '*' || value.toLowerCase().includes('pantheon');
      continue;
    }

    if (applies && normalizedDirective === 'disallow' && value) {
      disallow.push(value);
    }
  }

  return disallow;
}

export class PantheonNavigationCore {
  constructor(options = {}) {
    this.userAgent = options.userAgent ?? 'PantheonNavigator/1.0 (+Pantheon Child of Gods)';
    this.maxSteps = Number(options.maxSteps ?? process.env.PANTHEON_NAVIGATION_MAX_STEPS ?? 3);
    this.minDelayMs = Number(options.minDelayMs ?? process.env.PANTHEON_NAVIGATION_MIN_DELAY_MS ?? 250);
    this.maxDelayMs = Number(options.maxDelayMs ?? process.env.PANTHEON_NAVIGATION_MAX_DELAY_MS ?? 900);
    this.timeoutMs = Number(options.timeoutMs ?? process.env.PANTHEON_NAVIGATION_TIMEOUT_MS ?? 8000);
    this.allowlist = String(options.allowlist ?? process.env.PANTHEON_NAVIGATION_ALLOWLIST ?? '')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean);
    this.robotsCache = new Map();
  }

  randomDelay() {
    return Math.floor(this.minDelayMs + Math.random() * Math.max(1, this.maxDelayMs - this.minDelayMs));
  }

  async fetchWithTimeout(url) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timerId);
    }
  }

  isAllowedHost(url) {
    if (this.allowlist.length === 0) {
      return true;
    }

    return this.allowlist.includes(url.hostname);
  }

  async getRobotsRules(url) {
    const origin = url.origin;

    if (this.robotsCache.has(origin)) {
      return this.robotsCache.get(origin);
    }

    try {
      const response = await this.fetchWithTimeout(`${origin}/robots.txt`);
      const body = response.ok ? await response.text() : '';
      const rules = parseRobotsTxt(body);
      this.robotsCache.set(origin, rules);
      return rules;
    } catch {
      this.robotsCache.set(origin, []);
      return [];
    }
  }

  async isAllowedByRobots(url) {
    const rules = await this.getRobotsRules(url);
    return !rules.some((path) => url.pathname.startsWith(path));
  }

  async visitUrl(targetUrl, index) {
    const url = new URL(targetUrl);
    const delayMs = this.randomDelay();
    await sleep(delayMs);

    if (!this.isAllowedHost(url)) {
      return {
        id: `nav-step-${Date.now()}-${index}`,
        url: url.toString(),
        title: 'Blocked by allowlist',
        status: 'blocked',
        delayMs,
        snippet: 'Хост не входит в разрешенный allowlist Pantheon Navigation Core.',
        discoveredLinks: [],
      };
    }

    const allowedByRobots = await this.isAllowedByRobots(url);

    if (!allowedByRobots) {
      return {
        id: `nav-step-${Date.now()}-${index}`,
        url: url.toString(),
        title: 'Blocked by robots.txt',
        status: 'blocked',
        delayMs,
        snippet: 'robots.txt запретил посещение этого URL для Pantheon Navigator.',
        discoveredLinks: [],
      };
    }

    try {
      const response = await this.fetchWithTimeout(url.toString());

      if (!response.ok) {
        return {
          id: `nav-step-${Date.now()}-${index}`,
          url: url.toString(),
          title: `HTTP ${response.status}`,
          status: 'error',
          delayMs,
          snippet: `Сайт вернул статус ${response.status}.`,
          discoveredLinks: [],
        };
      }

      const body = await response.text();
      const title = extractTitle(body);
      const snippet = stripMarkup(body).slice(0, 280) || 'Страница не вернула читаемого текста.';
      const discoveredLinks = extractLinks(body, url.toString()).slice(0, 5);

      return {
        id: `nav-step-${Date.now()}-${index}`,
        url: url.toString(),
        title,
        status: 'visited',
        delayMs,
        snippet,
        discoveredLinks,
      };
    } catch (error) {
      return {
        id: `nav-step-${Date.now()}-${index}`,
        url: url.toString(),
        title: 'Navigation error',
        status: 'error',
        delayMs,
        snippet: error instanceof Error ? error.message : 'Unknown navigation error',
        discoveredLinks: [],
      };
    }
  }

  async journey({ taskId, goal, urls = [] }) {
    const queue = [...urls];
    const visited = new Set();
    const steps = [];

    while (queue.length > 0 && steps.length < this.maxSteps) {
      const nextUrl = queue.shift();

      if (!nextUrl || visited.has(nextUrl)) {
        continue;
      }

      visited.add(nextUrl);
      const step = await this.visitUrl(nextUrl, steps.length);
      steps.push(step);

      if (step.status === 'visited') {
        for (const candidate of step.discoveredLinks) {
          if (!visited.has(candidate) && queue.length + steps.length < this.maxSteps + 2) {
            queue.push(candidate);
          }
        }
      }
    }

    const visitedCount = steps.filter((step) => step.status === 'visited').length;
    const blockedCount = steps.filter((step) => step.status === 'blocked').length;

    return {
      id: `navigation-${Date.now()}`,
      createdAt: new Date().toISOString(),
      taskId,
      goal,
      sessionId: `nav-session-${Date.now()}`,
      status: visitedCount > 0 ? 'completed' : blockedCount > 0 ? 'blocked' : 'error',
      summary: visitedCount > 0
        ? `Pantheon Navigation Core посетил ${visitedCount} страницу(ы) в human-paced режиме.`
        : 'Pantheon Navigation Core не смог безопасно завершить маршрут.',
      visitedCount,
      blockedCount,
      steps,
    };
  }
}