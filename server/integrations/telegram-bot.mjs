import { fetchWithTimeout } from '../core/runtime-hardening.mjs';

function splitTelegramText(text, maxLength = 3900) {
  const value = String(text ?? '').trim();

  if (!value) {
    return [''];
  }

  const chunks = [];
  let remaining = value;

  while (remaining.length > maxLength) {
    const candidate = remaining.slice(0, maxLength);
    const splitIndex = Math.max(
      candidate.lastIndexOf('\n'),
      candidate.lastIndexOf(' ')
    );
    const nextIndex = splitIndex > maxLength * 0.6 ? splitIndex : maxLength;
    chunks.push(remaining.slice(0, nextIndex).trim());
    remaining = remaining.slice(nextIndex).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

function normalizeChatIds(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildTelegramUserId(chatId) {
  return `telegram:${chatId}`;
}

function truncateTelegramCaption(text, maxLength = 900) {
  const value = String(text ?? '').trim();
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export class TelegramBotIntegration {
  constructor(options = {}) {
    this.bridge = options.bridge;
    this.token = options.token ?? process.env.TELEGRAM_BOT_TOKEN ?? null;
    this.allowedChatIds = normalizeChatIds(
      options.allowedChatIds ?? process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? ''
    );
    this.defaultPersonalityId =
      options.defaultPersonalityId ??
      process.env.TELEGRAM_DEFAULT_PERSONALITY_ID ??
      'default';
    this.active = false;
    this.botInfo = null;
    this.updateOffset = Number(options.updateOffset ?? 0);
    this.pollTimeoutSeconds = Math.max(
      1,
      Math.min(
        50,
        Number(
          options.pollTimeoutSeconds ??
            process.env.TELEGRAM_POLL_TIMEOUT_SECONDS ??
            20
        )
      )
    );
    this.requestTimeoutMs = Math.max(
      1000,
      Number(
        options.requestTimeoutMs ??
          process.env.TELEGRAM_REQUEST_TIMEOUT_MS ??
          15000
      )
    );
    this.lastError = null;
    this.logs = [];
    this.logLimit = Number(options.logLimit ?? 200);
    this.sessionSerial = 0;
    this.pollingPromise = null;
  }

  getStatus() {
    return {
      active: this.active,
      tokenConfigured: Boolean(this.token),
      botReady: Boolean(this.botInfo),
      botUsername: this.botInfo?.username ?? null,
      allowedChatIds: this.allowedChatIds,
      defaultPersonalityId: this.defaultPersonalityId,
      updateOffset: this.updateOffset,
      pollTimeoutSeconds: this.pollTimeoutSeconds,
      requestTimeoutMs: this.requestTimeoutMs,
      lastError: this.lastError,
      logCount: this.logs.length,
    };
  }

  getLogs(limit = 60) {
    return [...this.logs].slice(-limit).reverse();
  }

  async log(event) {
    this.logs = [
      ...this.logs,
      {
        id: event.id ?? `telegram-log-${Date.now()}`,
        createdAt: event.createdAt ?? new Date().toISOString(),
        ...event,
      },
    ].slice(-this.logLimit);
    return this.logs;
  }

  configure(input = {}) {
    if (typeof input.token === 'string') {
      this.token = input.token.trim() || null;
    }

    if (input.allowedChatIds !== undefined) {
      this.allowedChatIds = normalizeChatIds(input.allowedChatIds);
    }

    if (
      typeof input.defaultPersonalityId === 'string' &&
      input.defaultPersonalityId.trim()
    ) {
      this.defaultPersonalityId = input.defaultPersonalityId.trim();
    }

    if (input.pollTimeoutSeconds !== undefined) {
      this.pollTimeoutSeconds = Math.max(
        1,
        Math.min(50, Number(input.pollTimeoutSeconds) || 20)
      );
    }

    if (input.requestTimeoutMs !== undefined) {
      this.requestTimeoutMs = Math.max(
        1000,
        Number(input.requestTimeoutMs) || this.requestTimeoutMs
      );
    }

    return this.getStatus();
  }

  buildApiUrl(method) {
    if (!this.token) {
      throw new Error('Telegram bot token is not configured.');
    }

    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  async callApi(method, payload = {}) {
    const response = await fetchWithTimeout(
      this.buildApiUrl(method),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      this.requestTimeoutMs
    );
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      const details =
        result.description ||
        response.statusText ||
        'Telegram API request failed';
      throw new Error(`${method} failed: ${details}`);
    }

    return result.result;
  }

  async callApiForm(method, fields = {}) {
    const form = new FormData();

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        form.append(key, value);
      }
    });

    const response = await fetchWithTimeout(
      this.buildApiUrl(method),
      {
        method: 'POST',
        body: form,
      },
      this.requestTimeoutMs
    );
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      const details =
        result.description ||
        response.statusText ||
        'Telegram API form request failed';
      throw new Error(`${method} failed: ${details}`);
    }

    return result.result;
  }

  isChatAllowed(chatId) {
    if (this.allowedChatIds.length === 0) {
      return true;
    }

    return this.allowedChatIds.includes(String(chatId));
  }

  async sendMessage(chatId, text) {
    const chunks = splitTelegramText(text);
    const deliveries = [];

    for (const chunk of chunks) {
      deliveries.push(
        await this.callApi('sendMessage', {
          chat_id: chatId,
          text: chunk || ' ',
        })
      );
    }

    return deliveries;
  }

  async sendArtifact(chatId, artifact, options = {}) {
    const mimeType = String(artifact?.mimeType ?? 'application/octet-stream');
    const fileName = String(
      artifact?.fileName ?? `${artifact?.kind ?? 'artifact'}.bin`
    );
    const buffer = Buffer.from(String(artifact?.dataBase64 ?? ''), 'base64');
    const caption = truncateTelegramCaption(
      options.caption ??
        artifact?.description ??
        artifact?.previewText ??
        `${artifact?.kind ?? 'artifact'} from Pantheon`
    );
    const blob = new Blob([buffer], { type: mimeType });

    if (mimeType.startsWith('image/')) {
      return this.callApiForm('sendPhoto', {
        chat_id: String(chatId),
        caption,
        photo: blob,
      });
    }

    return this.callApiForm('sendDocument', {
      chat_id: String(chatId),
      caption,
      document: blob,
      filename: fileName,
    });
  }

  async start(options = {}) {
    this.configure(options);

    if (!this.token) {
      throw new Error('Telegram bot token is required to start polling.');
    }

    this.botInfo = await this.callApi('getMe');
    this.active = true;
    this.lastError = null;
    this.sessionSerial += 1;
    const currentSession = this.sessionSerial;

    await this.log({
      kind: 'start',
      summary: 'Telegram bot polling started.',
      botUsername: this.botInfo?.username ?? null,
    });

    if (!this.pollingPromise) {
      this.pollingPromise = this.pollLoop(currentSession).finally(() => {
        this.pollingPromise = null;
      });
    }

    return this.getStatus();
  }

  async stop(reason = 'manual-stop') {
    this.active = false;
    this.sessionSerial += 1;
    await this.log({
      kind: 'stop',
      summary: `Telegram bot polling stopped: ${reason}`,
    });
    return {
      ...this.getStatus(),
      reason,
    };
  }

  async ensureBridgeSession(chatId, personalityId, options = {}) {
    const bridgeUserId = buildTelegramUserId(chatId);
    const targetPersonalityId =
      String(personalityId ?? this.defaultPersonalityId).trim() || 'default';
    const sameSession =
      this.bridge.active &&
      this.bridge.sessionUserId === bridgeUserId &&
      this.bridge.personalityId === targetPersonalityId;

    if (sameSession) {
      return null;
    }

    return this.bridge.startSession({
      transportMode: 'telegram',
      sessionUserId: bridgeUserId,
      personalityId: targetPersonalityId,
      isolatedChannelLabel: `telegram-chat:${chatId}`,
      initialMessage: options.initialMessage ?? null,
      suppressInitialMessage: options.suppressInitialMessage ?? false,
    });
  }

  async handleCommand(message, chatId, text) {
    if (text === '/start') {
      const started = await this.ensureBridgeSession(
        chatId,
        this.defaultPersonalityId,
        {
          initialMessage:
            'Привет. Это канал связи с Пантеоном. Напиши сообщение, и я передам его Атману и инструментам Пантеона.',
        }
      );

      if (started?.initialMessage) {
        await this.sendMessage(chatId, started.initialMessage);
      }

      return true;
    }

    if (text === '/stop') {
      await this.bridge.stopSession('telegram-stop-command');
      await this.sendMessage(
        chatId,
        'Telegram-сессия с Пантеоном остановлена.'
      );
      return true;
    }

    if (text === '/status') {
      await this.sendMessage(
        chatId,
        JSON.stringify(
          {
            telegram: this.getStatus(),
            bridge: this.bridge.getStatus(),
          },
          null,
          2
        )
      );
      return true;
    }

    if (text.startsWith('/personality ')) {
      const personalityId =
        text.slice('/personality '.length).trim() || this.defaultPersonalityId;
      await this.ensureBridgeSession(chatId, personalityId, {
        suppressInitialMessage: true,
      });
      await this.sendMessage(
        chatId,
        `Активная personality переключена на ${personalityId}.`
      );
      return true;
    }

    if (text === '/help') {
      await this.sendMessage(
        chatId,
        [
          '/start - открыть сессию с Пантеоном',
          '/stop - остановить текущую bridge-сессию',
          '/status - показать состояние Telegram и bridge',
          '/personality <id> - выбрать personality Atman',
          '/help - показать список команд',
        ].join('\n')
      );
      return true;
    }

    return false;
  }

  async handleIncomingMessage(message) {
    const text = String(message?.text ?? '').trim();
    const chatId = String(message?.chat?.id ?? '').trim();

    if (!chatId || !text) {
      return;
    }

    if (!this.isChatAllowed(chatId)) {
      await this.log({
        kind: 'blocked-chat',
        summary: 'Blocked Telegram chat attempted to reach the bot.',
        chatId,
      });
      await this.sendMessage(
        chatId,
        'Этот чат не разрешен для работы с Пантеоном.'
      );
      return;
    }

    await this.log({
      kind: 'incoming',
      summary: 'Telegram message received.',
      chatId,
      text,
    });

    if (await this.handleCommand(message, chatId, text)) {
      return;
    }

    await this.ensureBridgeSession(
      chatId,
      this.bridge.personalityId || this.defaultPersonalityId,
      {
        suppressInitialMessage: true,
      }
    );
    const bridgeResult = await this.bridge.receiveExternalMessage({
      text,
      userId: buildTelegramUserId(chatId),
      source: 'telegram',
      personalityId: this.bridge.personalityId || this.defaultPersonalityId,
      providerId: 'telegram-bot',
    });
    await this.sendMessage(chatId, bridgeResult.reply);
  }

  async pollLoop(sessionId) {
    while (this.active && sessionId === this.sessionSerial) {
      try {
        const updates = await this.callApi('getUpdates', {
          offset: this.updateOffset,
          timeout: this.pollTimeoutSeconds,
          allowed_updates: ['message'],
        });

        for (const update of updates) {
          this.updateOffset = Math.max(
            this.updateOffset,
            Number(update.update_id ?? 0) + 1
          );

          if (update.message) {
            await this.handleIncomingMessage(update.message);
          }
        }
      } catch (error) {
        this.lastError =
          error instanceof Error
            ? error.message
            : 'Unknown Telegram polling error';
        await this.log({
          kind: 'error',
          summary: 'Telegram polling error.',
          error: this.lastError,
        });
      }
    }
  }
}
