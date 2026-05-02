function stripMarkup(input) {
  return String(input ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractUrls(text) {
  return Array.from(String(text ?? '').matchAll(/https?:\/\/[^\s)"]+/g), (match) => match[0]);
}

function decodeDuckDuckGoUrl(url) {
  try {
    const parsed = new URL(url, 'https://duckduckgo.com');
    const redirected = parsed.searchParams.get('uddg');
    return redirected ? decodeURIComponent(redirected) : parsed.toString();
  } catch {
    return url;
  }
}

function extractSearchAnchors(html, maxFindings) {
  const findings = [];
  const anchorPattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) && findings.length < maxFindings) {
    findings.push({
      url: decodeDuckDuckGoUrl(match[1]),
      title: stripMarkup(match[2]),
    });
  }

  return findings;
}

export class PantheonWebScout {
  constructor(options = {}) {
    this.enabled = options.enabled ?? process.env.PANTHEON_WEB_SCOUT_ENABLED !== 'false';
    this.maxFindings = Number(options.maxFindings ?? process.env.PANTHEON_WEB_SCOUT_MAX_FINDINGS ?? 3);
    this.timeoutMs = Number(options.timeoutMs ?? process.env.PANTHEON_WEB_SCOUT_TIMEOUT_MS ?? 7000);
    this.userAgent = options.userAgent ?? 'PantheonWebScout/1.0';
  }

  async fetchWithTimeout(url) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timerId);
    }
  }

  async fetchPageFinding(url, sourceKind, index) {
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }

    const body = await response.text();
    const bodyText = stripMarkup(body).slice(0, 320);

    return {
      id: `pantheon-source-${Date.now()}-${index}`,
      title: url,
      url,
      snippet: bodyText || 'Source returned empty text body.',
      sourceKind,
      confidence: sourceKind === 'search-result' ? 0.64 : 0.82,
    };
  }

  async survey({ query, taskId, history = [], urls = [] }) {
    const createdAt = new Date().toISOString();
    const combinedText = [query, ...history.map((entry) => entry.content)].join(' ');
    const explicitUrls = urls.length > 0 ? urls : extractUrls(combinedText);
    const findings = [];
    const errors = [];

    if (!this.enabled) {
      return {
        id: `research-${Date.now()}`,
        createdAt,
        taskId,
        query,
        status: 'offline',
        summary: 'Pantheon Web Scout отключен конфигурацией окружения.',
        sourceCount: 0,
        findings,
        errors: ['PANTHEON_WEB_SCOUT_ENABLED=false'],
      };
    }

    if (explicitUrls.length > 0) {
      for (const [index, url] of explicitUrls.slice(0, this.maxFindings).entries()) {
        try {
          const sourceKind = url.includes('localhost') ? 'local-endpoint' : 'direct-url';
          findings.push(await this.fetchPageFinding(url, sourceKind, index));
        } catch (error) {
          errors.push(error instanceof Error ? error.message : `Unable to fetch ${url}`);
        }
      }
    } else {
      try {
        const searchResponse = await this.fetchWithTimeout(
          `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        );

        if (!searchResponse.ok) {
          throw new Error(`DuckDuckGo returned ${searchResponse.status}`);
        }

        const searchHtml = await searchResponse.text();
        const anchors = extractSearchAnchors(searchHtml, this.maxFindings);

        for (const [index, anchor] of anchors.entries()) {
          try {
            const finding = await this.fetchPageFinding(anchor.url, 'search-result', index);
            findings.push({
              ...finding,
              title: anchor.title || finding.title,
            });
          } catch (error) {
            errors.push(error instanceof Error ? error.message : `Unable to fetch ${anchor.url}`);
          }
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Pantheon Web Scout search failed');
      }
    }

    const status = findings.length > 0 ? 'completed' : errors.length > 0 ? 'offline' : 'limited';

    return {
      id: `research-${Date.now()}`,
      createdAt,
      taskId,
      query,
      status,
      summary: findings.length > 0
        ? `Pantheon Web Scout собрал ${findings.length} внешних источника(ов) для задачи ${taskId}.`
        : 'Pantheon Web Scout не нашел достаточно внешних источников и требует ручной верификации.',
      sourceCount: findings.length,
      findings,
      errors,
    };
  }
}