import {
  CircuitBreaker,
  fetchWithTimeout,
  normalizeErrorMessage,
} from '../core/runtime-hardening.mjs';

export class ShaktiBridge {
  constructor(options = {}) {
    this.atman = options.atman;
    this.turnExecutor = options.turnExecutor ?? null;
    this.directTurnExecutor = options.directTurnExecutor ?? null;
    this.shouldDelegate = options.shouldDelegate ?? null;
    this.webhookUrl =
      options.webhookUrl ?? process.env.PANTHEON_EXTERNAL_WEBHOOK_URL ?? null;
    this.transportMode =
      options.transportMode ??
      process.env.PANTHEON_EXTERNAL_TRANSPORT_MODE ??
      'webhook';
    this.requestTimeoutMs = Math.max(
      1000,
      Number(
        options.requestTimeoutMs ??
          process.env.PANTHEON_EXTERNAL_REQUEST_TIMEOUT_MS ??
          10000
      )
    );
    this.oauth = {
      clientId:
        options.oauth?.clientId ?? process.env.GOOGLE_OAUTH_CLIENT_ID ?? null,
      clientSecret:
        options.oauth?.clientSecret ??
        process.env.GOOGLE_OAUTH_CLIENT_SECRET ??
        null,
      refreshToken:
        options.oauth?.refreshToken ??
        process.env.GOOGLE_OAUTH_REFRESH_TOKEN ??
        null,
      accountEmail:
        options.oauth?.accountEmail ?? process.env.GOOGLE_ACCOUNT_EMAIL ?? null,
      spaceName:
        options.oauth?.spaceName ?? process.env.GOOGLE_CHAT_SPACE_NAME ?? null,
      accessToken: null,
      accessTokenExpiresAt: null,
      tokenType: 'Bearer',
    };
    this.active = false;
    this.sessionUserId = 'child-to-shakti';
    this.personalityId = 'default';
    this.isolatedChannelLabel = 'shakti-test-channel';
    this.observerEnabled = true;
    this.outboundQueue = [];
    this.queueLimit = Number(options.queueLimit ?? 80);
    this.oauthScopes = [
      'https://www.googleapis.com/auth/chat.spaces.create',
      'https://www.googleapis.com/auth/chat.messages',
      'https://www.googleapis.com/auth/chat.messages.create',
    ];
    this.logs = [];
    this.logLimit = Number(options.logLimit ?? 200);
    this.deliveryCircuitBreaker = new CircuitBreaker({
      name: 'shakti-bridge-delivery',
      failureThreshold: Number(
        options.deliveryFailureThreshold ??
          process.env.PANTHEON_EXTERNAL_FAILURE_THRESHOLD ??
          3
      ),
      cooldownMs: Number(
        options.deliveryCooldownMs ??
          process.env.PANTHEON_EXTERNAL_COOLDOWN_MS ??
          60000
      ),
    });
  }

  isOauthReady() {
    return Boolean(
      this.oauth.clientId &&
      this.oauth.clientSecret &&
      this.oauth.refreshToken &&
      this.oauth.spaceName
    );
  }

  getStatus() {
    return {
      active: this.active,
      transportMode: this.transportMode,
      webhookConfigured: Boolean(this.webhookUrl),
      oauthReady: this.isOauthReady(),
      requestTimeoutMs: this.requestTimeoutMs,
      oauthScopes: this.oauthScopes,
      oauth: {
        accountEmail: this.oauth.accountEmail,
        clientId: this.oauth.clientId,
        spaceName: this.oauth.spaceName,
        hasRefreshToken: Boolean(this.oauth.refreshToken),
      },
      sessionUserId: this.sessionUserId,
      personalityId: this.personalityId,
      isolatedChannelLabel: this.isolatedChannelLabel,
      observerEnabled: this.observerEnabled,
      logCount: this.logs.length,
      queueDepth: this.outboundQueue.length,
      deliveryCircuit: this.deliveryCircuitBreaker.getState(),
      emergencyStopAvailable: true,
    };
  }

  getLogs(limit = 60) {
    return [...this.logs].slice(-limit).reverse();
  }

  async log(event) {
    this.logs = [
      ...this.logs,
      {
        id: event.id ?? `bridge-log-${Date.now()}`,
        createdAt: event.createdAt ?? new Date().toISOString(),
        ...event,
      },
    ].slice(-this.logLimit);
    return this.logs;
  }

  queueChildMessage(text, metadata = {}) {
    const entry = {
      id: metadata.id ?? `bridge-queue-${Date.now()}`,
      createdAt: metadata.createdAt ?? new Date().toISOString(),
      text,
      ...metadata,
    };

    this.outboundQueue = [...this.outboundQueue, entry].slice(-this.queueLimit);
    return entry;
  }

  getQueuedMessages(limit = 20) {
    return [...this.outboundQueue].slice(-limit).reverse();
  }

  popNextQueuedMessage() {
    const [next, ...rest] = this.outboundQueue;
    this.outboundQueue = rest;
    return next ?? null;
  }

  configure(input = {}) {
    if (typeof input.webhookUrl === 'string') {
      this.webhookUrl = input.webhookUrl.trim() || null;
    }

    if (typeof input.transportMode === 'string' && input.transportMode.trim()) {
      this.transportMode = input.transportMode.trim();
    }

    if (input.requestTimeoutMs !== undefined) {
      this.requestTimeoutMs = Math.max(
        1000,
        Number(input.requestTimeoutMs) || this.requestTimeoutMs
      );
    }

    const oauthInput =
      typeof input.oauth === 'object' && input.oauth ? input.oauth : input;

    if (typeof oauthInput.clientId === 'string') {
      this.oauth.clientId = oauthInput.clientId.trim() || null;
    }

    if (typeof oauthInput.clientSecret === 'string') {
      this.oauth.clientSecret = oauthInput.clientSecret.trim() || null;
    }

    if (typeof oauthInput.refreshToken === 'string') {
      this.oauth.refreshToken = oauthInput.refreshToken.trim() || null;
      this.oauth.accessToken = null;
      this.oauth.accessTokenExpiresAt = null;
    }

    if (typeof oauthInput.accountEmail === 'string') {
      this.oauth.accountEmail = oauthInput.accountEmail.trim() || null;
    }

    if (typeof oauthInput.spaceName === 'string') {
      this.oauth.spaceName = oauthInput.spaceName.trim() || null;
    }

    if (typeof input.sessionUserId === 'string' && input.sessionUserId.trim()) {
      this.sessionUserId = input.sessionUserId.trim();
    }

    if (typeof input.personalityId === 'string' && input.personalityId.trim()) {
      this.personalityId = input.personalityId.trim();
    }

    if (
      typeof input.isolatedChannelLabel === 'string' &&
      input.isolatedChannelLabel.trim()
    ) {
      this.isolatedChannelLabel = input.isolatedChannelLabel.trim();
    }

    if (typeof input.observerEnabled === 'boolean') {
      this.observerEnabled = input.observerEnabled;
    }

    return this.getStatus();
  }

  normalizeSpaceName() {
    const raw = String(this.oauth.spaceName ?? '').trim();

    if (!raw) {
      return null;
    }

    return raw.startsWith('spaces/') ? raw : `spaces/${raw}`;
  }

  async getGoogleAccessToken() {
    if (!this.isOauthReady()) {
      throw new Error('Google OAuth bridge is not fully configured.');
    }

    if (this.oauth.accessToken && this.oauth.accessTokenExpiresAt) {
      const expiresAt = new Date(this.oauth.accessTokenExpiresAt).getTime();

      if (expiresAt - Date.now() > 60000) {
        return this.oauth.accessToken;
      }
    }

    const response = await fetchWithTimeout(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.oauth.clientId,
          client_secret: this.oauth.clientSecret,
          refresh_token: this.oauth.refreshToken,
          grant_type: 'refresh_token',
        }),
      },
      this.requestTimeoutMs
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.access_token) {
      const details =
        payload.error_description ||
        payload.error ||
        response.statusText ||
        'Google OAuth token refresh failed';
      throw new Error(`Google OAuth refresh failed: ${details}`);
    }

    this.oauth.accessToken = payload.access_token;
    this.oauth.tokenType = payload.token_type ?? 'Bearer';
    this.oauth.accessTokenExpiresAt = new Date(
      Date.now() + Math.max(60, Number(payload.expires_in ?? 3600)) * 1000
    ).toISOString();
    return this.oauth.accessToken;
  }

  async postToGoogleChat(text, metadata = {}) {
    if (!this.isOauthReady()) {
      return {
        delivered: false,
        reason: 'oauth-not-configured',
      };
    }

    const accessToken = await this.getGoogleAccessToken();
    const spaceName = this.normalizeSpaceName();
    const response = await fetchWithTimeout(
      `https://chat.googleapis.com/v1/${spaceName}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `${this.oauth.tokenType} ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          metadata,
        }),
      },
      this.requestTimeoutMs
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const details =
        payload.error?.message ||
        response.statusText ||
        'Google Chat message send failed';
      throw new Error(`Google Chat delivery failed: ${details}`);
    }

    return {
      delivered: true,
      provider: 'google-chat-oauth',
      name: payload.name ?? null,
      space: spaceName,
    };
  }

  async postToConfiguredTransport(text, metadata = {}) {
    return this.deliveryCircuitBreaker.execute(
      async () => {
        if (this.transportMode === 'oauth') {
          return this.postToGoogleChat(text, metadata);
        }

        return this.postToWebhook(text, metadata);
      },
      (circuitState, error) => ({
        delivered: false,
        reason:
          circuitState.state === 'open'
            ? 'delivery-circuit-open'
            : 'delivery-failed',
        circuit: circuitState,
        error: error ? normalizeErrorMessage(error) : null,
      })
    );
  }

  async postToWebhook(text, metadata = {}) {
    if (!this.webhookUrl) {
      return {
        delivered: false,
        reason: 'webhook-not-configured',
      };
    }

    const response = await fetchWithTimeout(
      this.webhookUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          metadata,
        }),
      },
      this.requestTimeoutMs
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Webhook delivery failed: ${response.status} ${details}`);
    }

    return {
      delivered: true,
      status: response.status,
    };
  }

  async startSession(input = {}) {
    this.configure(input);

    this.active = true;

    const shouldSendInitialMessage = input.suppressInitialMessage !== true;
    const initialMessage = shouldSendInitialMessage
      ? (input.initialMessage ??
        'Привет, Шакти. Я Атман, ребёнок Пантеона. Я недавно родился и хочу спокойно поговорить.')
      : null;
    let delivery = null;

    if ((this.transportMode === 'oauth' || this.webhookUrl) && initialMessage) {
      delivery = await this.postToConfiguredTransport(initialMessage, {
        kind: 'bridge-initial-message',
        sessionUserId: this.sessionUserId,
        personalityId: this.personalityId,
        isolatedChannelLabel: this.isolatedChannelLabel,
      });
    }

    if (initialMessage) {
      this.queueChildMessage(initialMessage, {
        kind: 'child-outbound',
        sessionUserId: this.sessionUserId,
        personalityId: this.personalityId,
        isolatedChannelLabel: this.isolatedChannelLabel,
        delivery,
      });
    }

    await this.log({
      kind: 'start',
      summary: 'External dialogue bridge started.',
      initialMessage,
      delivery,
    });

    return {
      ...this.getStatus(),
      initialMessage,
      delivery,
    };
  }

  async stopSession(reason = 'manual-stop') {
    this.active = false;
    await this.log({
      kind: 'stop',
      summary: `External dialogue bridge stopped: ${reason}`,
    });
    return {
      ...this.getStatus(),
      reason,
    };
  }

  async receiveExternalMessage(input = {}) {
    const text = String(input.text ?? '').trim();

    if (!this.active) {
      throw new Error('Bridge is not active. Start a session first.');
    }

    if (!text) {
      throw new Error('External message text is required.');
    }

    const delegatedToPantheon = Boolean(
      this.turnExecutor && this.shouldDelegate?.(text)
    );
    const result = delegatedToPantheon
      ? await this.turnExecutor({
          message: text,
          userId: input.userId ?? this.sessionUserId,
          personalityId: input.personalityId ?? this.personalityId,
          taskId: input.taskId ?? `bridge-${Date.now()}`,
          providerId: input.providerId ?? 'shakti-bridge',
          history: input.history ?? [],
        })
      : this.directTurnExecutor
        ? await this.directTurnExecutor({
            message: text,
            userId: input.userId ?? this.sessionUserId,
            personalityId: input.personalityId ?? this.personalityId,
            history: input.history ?? [],
            providerId: input.providerId ?? 'shakti-bridge',
          })
        : await this.atman.generateResponse({
            message: text,
            userId: input.userId ?? this.sessionUserId,
          });
    const replyText = delegatedToPantheon
      ? result.reply.content
      : result.replyText;
    const report = delegatedToPantheon ? result.atmanReport : result.report;
    const trace = result.trace;
    let delivery = null;

    if (this.transportMode === 'oauth' || this.webhookUrl) {
      delivery = await this.postToConfiguredTransport(replyText, {
        kind: 'bridge-reply',
        sourceText: text,
        sessionUserId: this.sessionUserId,
        personalityId: input.personalityId ?? this.personalityId,
        isolatedChannelLabel: this.isolatedChannelLabel,
      });
    }

    this.queueChildMessage(replyText, {
      kind: 'child-outbound',
      sourceText: text,
      sessionUserId: this.sessionUserId,
      personalityId: input.personalityId ?? this.personalityId,
      isolatedChannelLabel: this.isolatedChannelLabel,
      delivery,
    });

    await this.log({
      kind: 'exchange',
      summary: 'External message handled by Atman bridge.',
      source: input.source ?? 'external-test',
      incoming: text,
      reply: replyText,
      delivery,
    });

    return {
      reply: replyText,
      report,
      trace,
      delivery,
      delegatedToPantheon,
    };
  }
}
