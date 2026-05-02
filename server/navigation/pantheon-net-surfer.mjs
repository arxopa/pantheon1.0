import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ControlCorePolicyGate } from '../core/control-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultProfilesRoot = path.join(__dirname, '..', 'dialog', 'data', 'netsurfer-profiles');
const safeDefaultAllowlist = [
  'wikipedia.org',
  'en.wikipedia.org',
  'ru.wikipedia.org',
  'simple.wikipedia.org',
  'arxiv.org',
  'github.com',
  'stackoverflow.com',
  'stackexchange.com',
  'britannica.com',
  'duckduckgo.com',
  'html.duckduckgo.com',
  'lite.duckduckgo.com',
];

const defaultSearchProviders = [
  {
    kind: 'duckduckgo-html',
    buildUrl: (query) => `https://html.duckduckgo.com/html/?q=${query}`,
  },
  {
    kind: 'duckduckgo-lite',
    buildUrl: (query) => `https://lite.duckduckgo.com/lite/?q=${query}`,
  },
  {
    kind: 'wikipedia-ru',
    buildUrl: (query) => `https://ru.wikipedia.org/w/index.php?search=${query}`,
  },
  {
    kind: 'wikipedia-en',
    buildUrl: (query) => `https://en.wikipedia.org/w/index.php?search=${query}`,
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * Math.max(1, max - min + 1));
}

function normalizeHostList(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toText(value) {
  return String(value ?? '').trim();
}

function normalizePageText(value) {
  return toText(value).replace(/\s+/g, ' ');
}

function tokenizeSearchText(value) {
  return normalizePageText(value)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1);
}

export class PantheonNetSurfer {
  constructor(options = {}) {
    this.policyGate = options.policyGate ?? new ControlCorePolicyGate();
    this.allowlist = normalizeHostList(options.allowlist ?? process.env.PANTHEON_NETSURFER_ALLOWLIST ?? process.env.PANTHEON_NAVIGATION_ALLOWLIST ?? '');
    this.headless = options.headless ?? String(process.env.PANTHEON_NETSURFER_HEADLESS ?? 'true') !== 'false';
    this.timeoutMs = Number(options.timeoutMs ?? process.env.PANTHEON_NETSURFER_TIMEOUT_MS ?? 12000);
    this.minDelayMs = Number(options.minDelayMs ?? process.env.PANTHEON_NETSURFER_MIN_DELAY_MS ?? 180);
    this.maxDelayMs = Number(options.maxDelayMs ?? process.env.PANTHEON_NETSURFER_MAX_DELAY_MS ?? 900);
    this.sessionMaxMs = Number(options.sessionMaxMs ?? process.env.PANTHEON_NETSURFER_SESSION_MAX_MS ?? 300000);
    this.maxTabs = Number(options.maxTabs ?? process.env.PANTHEON_NETSURFER_MAX_TABS ?? 3);
    this.searchEngineUrl = options.searchEngineUrl ?? process.env.PANTHEON_NETSURFER_SEARCH_URL ?? 'https://html.duckduckgo.com/html/?q=';
    this.searchProviders = options.searchProviders ?? defaultSearchProviders;
    this.profilesRoot = options.profilesRoot ?? process.env.PANTHEON_NETSURFER_PROFILES_ROOT ?? defaultProfilesRoot;
    this.playwrightModule = null;
    this.installationError = null;
    this.sessions = new Map();
    this.logs = [];
    this.logLimit = Number(options.logLimit ?? 200);
  }

  async log(event) {
    this.logs = [
      ...this.logs,
      {
        id: event.id ?? `netsurfer-log-${Date.now()}`,
        createdAt: event.createdAt ?? new Date().toISOString(),
        ...event,
      },
    ].slice(-this.logLimit);
  }

  getLogs(limit = 60) {
    return [...this.logs].slice(-limit).reverse();
  }

  resolveAllowlist() {
    return this.allowlist.length > 0 ? this.allowlist : safeDefaultAllowlist;
  }

  getSessionKey(input = {}) {
    return toText(input.personalityId) || 'default';
  }

  getProfileDir(personalityId) {
    return path.join(this.profilesRoot, personalityId.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'default');
  }

  isInstalled() {
    return Boolean(this.playwrightModule);
  }

  async prewarm() {
    try {
      await this.ensurePlaywright();
    } catch (error) {
      this.installationError =
        error instanceof Error ? error.message : 'Unknown Playwright init error';
      return false;
    }

    return true;
  }

  async ensurePlaywright() {
    if (this.playwrightModule) {
      return this.playwrightModule;
    }

    try {
      this.playwrightModule = await import('playwright');
      this.installationError = null;
      return this.playwrightModule;
    } catch (error) {
      this.installationError =
        error instanceof Error ? error.message : 'Unknown Playwright import error';
      throw new Error('Playwright is not installed. Run npm install and then npx playwright install chromium.');
    }
  }

  async humanDelay(min = this.minDelayMs, max = this.maxDelayMs) {
    await sleep(randomBetween(min, max));
  }

  ensureAllowedUrl(rawUrl) {
    const url = new URL(rawUrl);
    const allowlist = this.resolveAllowlist();

    if (allowlist.length > 0 && !allowlist.includes(url.hostname)) {
      throw new Error(`NetSurfer blocked host ${url.hostname}. Update PANTHEON_NETSURFER_ALLOWLIST to allow it.`);
    }

    return url;
  }

  validateAction(action, details = {}) {
    const candidatePatch = {
      target: 'pantheon-net-surfer',
      strategy: `browser-action:${action}`,
      confidence: 0.74,
      expectedGain: `Execute browser automation action ${action} with audit trail.`,
      requiresManualReview: false,
    };
    const decision = this.policyGate.evaluate({
      taskId: details.taskId ?? 'netsurfer',
      candidatePatch,
      errorJournal: [],
    });

    if (!decision.approved) {
      throw new Error(`NetSurfer blocked by Control Core: ${decision.reason}`);
    }

    return decision;
  }

  async start(input = {}) {
    const playwright = await this.ensurePlaywright();
    const sessionKey = this.getSessionKey(input);
    const existing = this.sessions.get(sessionKey);

    if (existing) {
      const ageMs = Date.now() - existing.startedAt;

      if (ageMs <= this.sessionMaxMs && existing.pages.length > 0) {
        return existing.pages[0];
      }

      await this.stop({ personalityId: sessionKey });
    }

    const profileDir = this.getProfileDir(sessionKey);
    await mkdir(profileDir, { recursive: true });
    const context = await playwright.chromium.launchPersistentContext(profileDir, {
      headless: this.headless,
      args: ['--disable-blink-features=AutomationControlled'],
      viewport: {
        width: randomBetween(1366, 1600),
        height: randomBetween(768, 980),
      },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    let pages = context.pages();

    if (pages.length === 0) {
      pages = [await context.newPage()];
    }

    const page = pages[0];
    page.setDefaultNavigationTimeout(this.timeoutMs);
    page.setDefaultTimeout(this.timeoutMs);
    this.sessions.set(sessionKey, {
      context,
      pages,
      startedAt: Date.now(),
      personalityId: sessionKey,
      profileDir,
    });
    await this.log({ kind: 'session-start', personalityId: sessionKey, summary: `NetSurfer session started for ${sessionKey}.` });
    return page;
  }

  async stop(input = {}) {
    const sessionKey = this.getSessionKey(input);
    const session = this.sessions.get(sessionKey);

    if (session?.context) {
      await session.context.close();
    }

    this.sessions.delete(sessionKey);
    await this.log({ kind: 'session-stop', personalityId: sessionKey, summary: `NetSurfer session stopped for ${sessionKey}.` });
  }

  getStatus() {
    const sessionEntries = [...this.sessions.values()];
    return {
      installed: this.isInstalled(),
      active: sessionEntries.length > 0,
      headless: this.headless,
      timeoutMs: this.timeoutMs,
      sessionMaxMs: this.sessionMaxMs,
      maxTabs: this.maxTabs,
      profilesRoot: this.profilesRoot,
      allowlist: this.resolveAllowlist(),
      installationError: this.installationError,
      activePersonalities: sessionEntries.map((entry) => entry.personalityId),
      currentUrl: sessionEntries[0]?.pages?.[0]?.url?.() ?? null,
      pageTitle: null,
    };
  }

  async snapshot(input = {}) {
    const session = this.sessions.get(this.getSessionKey(input));
    const page = session?.pages?.[0] ?? null;

    if (!page) {
      return {
        ...this.getStatus(),
        pageTitle: null,
        textPreview: null,
        contentSummary: null,
      };
    }

    const pageTitle = await page.title().catch(() => 'Untitled page');
    const textPreview = await page
      .locator('body')
      .innerText()
      .then((text) => normalizePageText(text).slice(0, 400))
      .catch(() => null);
    const contentSummary = await page
      .evaluate(() => {
        const selectors = ['main p', 'article p', '#mw-content-text p', '[role="main"] p', 'p'];
        const seen = new Set();
        const paragraphs = [];

        for (const selector of selectors) {
          const nodes = document.querySelectorAll(selector);

          for (const node of nodes) {
            const text = String(node.textContent ?? '').replace(/\s+/g, ' ').trim();

            if (
              text.length < 80 ||
              seen.has(text) ||
              /главное меню|пожертвовать|создать уч[её]тную запись|войти|перейти к содержанию/i.test(text)
            ) {
              continue;
            }

            seen.add(text);
            paragraphs.push(text);

            if (paragraphs.length >= 3) {
              return paragraphs.join(' ').slice(0, 700);
            }
          }
        }

        return paragraphs.join(' ').slice(0, 700);
      })
      .then((text) => normalizePageText(text).slice(0, 700) || null)
      .catch(() => null);

    return {
      ...this.getStatus(),
      personalityId: session?.personalityId ?? this.getSessionKey(input),
      tabCount: session?.pages?.length ?? 0,
      pageTitle,
      textPreview,
      contentSummary,
    };
  }

  async navigate(input) {
    const personalityId = this.getSessionKey(input);

    try {
      const target = this.ensureAllowedUrl(input.url);
      this.validateAction('navigate', input);
      const page = await this.start(input);
      await this.humanDelay();
      await page.goto(target.toString(), { waitUntil: 'domcontentloaded' });
      await this.humanDelay(350, 1200);
      await this.log({ kind: 'navigate', personalityId, url: target.toString(), summary: `Visited ${target.hostname}.` });
      return this.snapshot(input);
    } catch (error) {
      await this.log({ kind: 'blocked', personalityId, url: input.url ?? null, summary: error instanceof Error ? error.message : 'Unknown navigate block/error' });
      throw error;
    }
  }

  async click(input) {
    const personalityId = this.getSessionKey(input);
    this.validateAction('click', input);
    const page = await this.start(input);
    await page.waitForSelector(input.selector, { timeout: this.timeoutMs });
    await this.humanDelay(120, 480);
    await page.click(input.selector);
    await this.humanDelay(250, 900);
    await this.log({ kind: 'click', personalityId, selector: input.selector, summary: `Clicked ${input.selector}.` });
    return this.snapshot(input);
  }

  async typeText(input) {
    const personalityId = this.getSessionKey(input);
    this.validateAction('type', input);
    const page = await this.start(input);
    await page.waitForSelector(input.selector, { timeout: this.timeoutMs });
    await page.click(input.selector);
    await page.fill(input.selector, '');

    for (const character of toText(input.text)) {
      await page.type(input.selector, character, { delay: randomBetween(30, 120) });
    }

    await this.humanDelay(120, 520);
    await this.log({ kind: 'type', personalityId, selector: input.selector, summary: `Typed into ${input.selector}.` });
    return this.snapshot(input);
  }

  async scroll(input = {}) {
    const personalityId = this.getSessionKey(input);
    this.validateAction('scroll', input);
    const page = await this.start(input);
    const pixels = Number(input.pixels ?? randomBetween(240, 900));
    await page.evaluate((value) => window.scrollBy(0, value), pixels);
    await this.humanDelay(150, 600);
    await this.log({ kind: 'scroll', personalityId, summary: `Scrolled ${pixels}px.` });
    return this.snapshot(input);
  }

  getActivePage(input = {}) {
    return this.sessions.get(this.getSessionKey(input))?.pages?.[0] ?? null;
  }

  async search(input) {
    const query = encodeURIComponent(toText(input.query));
    let lastError = null;

    for (const provider of this.searchProviders) {
      const targetUrl = provider.buildUrl(query);

      try {
        let snapshot = await this.navigate({
          ...input,
          url: targetUrl,
        });

        const page = this.getActivePage(input);
        const searchResultUrl = page
          ? await this.extractPreferredSearchResultUrl(page, input.query)
          : null;

        if (searchResultUrl) {
          snapshot = await this.navigate({
            ...input,
            url: searchResultUrl,
          });
          await this.log({
            kind: 'search-result-follow',
            personalityId: this.getSessionKey(input),
            url: searchResultUrl,
            summary: `Search followed best result from ${provider.kind}.`,
          });
        }

        if (this.isSearchResultUsable(snapshot)) {
          await this.log({
            kind: 'search-provider',
            personalityId: this.getSessionKey(input),
            url: targetUrl,
            summary: `Search completed via ${provider.kind}.`,
          });
          return snapshot;
        }

        lastError = new Error(`Search provider ${provider.kind} returned an anti-bot or low-signal page.`);
        await this.log({
          kind: 'search-provider-fallback',
          personalityId: this.getSessionKey(input),
          url: targetUrl,
          summary: lastError.message,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown search provider error');
        await this.log({
          kind: 'search-provider-error',
          personalityId: this.getSessionKey(input),
          url: targetUrl,
          summary: lastError.message,
        });
      }
    }

    throw lastError ?? new Error('No NetSurfer search providers succeeded.');
  }

  async extractPreferredSearchResultUrl(page, queryText) {
    const pageUrl = page.url();
    const rawCandidates = await page
      .evaluate(() => {
        const selectors = [
          '#links .result__a',
          '.result__title a',
          '.result-link',
          '.mw-search-result-heading a',
          'main a[href]',
          'article a[href]',
        ];
        const seen = new Set();
        const candidates = [];

        for (const selector of selectors) {
          const anchors = document.querySelectorAll(selector);

          for (const anchor of anchors) {
            const href = String(anchor.getAttribute('href') ?? '').trim();
            const title = String(anchor.textContent ?? '').replace(/\s+/g, ' ').trim();

            if (!href || !title) {
              continue;
            }

            const key = `${href}::${title}`;

            if (seen.has(key)) {
              continue;
            }

            seen.add(key);
            candidates.push({ href, title });

            if (candidates.length >= 20) {
              return candidates;
            }
          }
        }

        return candidates;
      })
      .catch(() => []);

    const scoredCandidates = rawCandidates
      .map((candidate) => {
        try {
          const resolvedUrl = new URL(candidate.href, pageUrl).toString();
          this.ensureAllowedUrl(resolvedUrl);
          return {
            url: resolvedUrl,
            title: candidate.title,
            score: this.scoreSearchCandidate({
              url: resolvedUrl,
              title: candidate.title,
              queryText,
            }),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score);

    return scoredCandidates[0]?.url ?? null;
  }

  scoreSearchCandidate({ url, title, queryText }) {
    const titleTokens = new Set(tokenizeSearchText(title));
    const queryTokens = tokenizeSearchText(queryText);
    let score = 0;

    for (const token of queryTokens) {
      if (titleTokens.has(token)) {
        score += 3;
      }

      if (url.toLowerCase().includes(token)) {
        score += 2;
      }
    }

    if (/\/wiki\//i.test(url)) {
      score += 6;
    }

    if (/w\/index\.php\?search=/i.test(url)) {
      score -= 6;
    }

    if (/результаты|search/i.test(title)) {
      score -= 4;
    }

    return score;
  }

  isSearchResultUsable(snapshot = {}) {
    const title = toText(snapshot.pageTitle).toLowerCase();
    const textPreview = toText(snapshot.contentSummary ?? snapshot.textPreview).toLowerCase();
    const combined = `${title}\n${textPreview}`;

    if (!combined) {
      return false;
    }

    const antiBotPatterns = [
      /please email us/i,
      /support email/i,
      /anonymized error code/i,
      /verify you are human/i,
      /captcha/i,
      /unusual traffic/i,
      /robot/i,
    ];

    if (antiBotPatterns.some((pattern) => pattern.test(combined))) {
      return false;
    }

    if (
      /результаты|search/i.test(title) ||
      /создать страницу|results? for/i.test(combined)
    ) {
      return false;
    }

    return combined.length >= 80;
  }
}