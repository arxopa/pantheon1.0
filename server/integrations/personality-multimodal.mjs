import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultCacheRoot = path.join(__dirname, '..', 'dialog', 'data', 'multimodal-cache');

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value ?? 0)));
}

function sanitizeName(value, fallback = 'artifact') {
  const normalized = String(value ?? fallback).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
  return normalized || fallback;
}

function encodeBase64(value) {
  return Buffer.isBuffer(value) ? value.toString('base64') : Buffer.from(String(value ?? ''), 'utf8').toString('base64');
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value ?? null);
}

function hashPayload(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex').slice(0, 16);
}

function summarizeBinaryInput(input = {}) {
  const dataBase64 = String(input.dataBase64 ?? '').trim();
  const mimeType = String(input.mimeType ?? '').trim() || 'application/octet-stream';
  const fileName = String(input.fileName ?? '').trim() || null;
  const approxBytes = dataBase64 ? Math.round((dataBase64.length * 3) / 4) : 0;
  return {
    dataBase64,
    mimeType,
    fileName,
    approxBytes,
    hasUpload: Boolean(dataBase64),
  };
}

function buildWavBuffer({ frequency = 440, durationMs = 900, sampleRate = 22050, amplitude = 0.25 }) {
  const sampleCount = Math.max(1, Math.floor(sampleRate * durationMs / 1000));
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const envelope = Math.min(1, index / (sampleRate * 0.03), (sampleCount - index) / (sampleRate * 0.04));
    const sample = Math.sin(2 * Math.PI * frequency * time) * amplitude * envelope;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }

  return buffer;
}

function createSvgCard({ title, subtitle, body, accent = '#7cc6ff', background = '#102034' }) {
  const lines = [String(subtitle ?? ''), ...String(body ?? '').split('\n')].filter(Boolean).slice(0, 8);
  const escaped = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const lineMarkup = lines.map((line, index) => `<text x="36" y="${118 + index * 34}" fill="#e8f2ff" font-size="20">${escaped(line)}</text>`).join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576" viewBox="0 0 1024 576">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${background}" />
          <stop offset="100%" stop-color="#1f3859" />
        </linearGradient>
      </defs>
      <rect width="1024" height="576" fill="url(#bg)" rx="32" />
      <circle cx="878" cy="114" r="86" fill="${accent}" opacity="0.18" />
      <circle cx="820" cy="178" r="34" fill="${accent}" opacity="0.34" />
      <text x="36" y="72" fill="#ffffff" font-size="42" font-weight="700">${escaped(title)}</text>
      ${lineMarkup}
    </svg>
  `.trim();
}

async function maybeCallJsonApi(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`${url} failed: ${response.status} ${details}`);
  }

  return response;
}

export class PersonalityMultimodal {
  constructor(options = {}) {
    this.personalityManager = options.personalityManager;
    this.cacheRoot = options.cacheRoot ?? process.env.PANTHEON_MULTIMODAL_CACHE_ROOT ?? defaultCacheRoot;
    this.ttsApiUrl = options.ttsApiUrl ?? process.env.PANTHEON_TTS_API_URL ?? null;
    this.sttApiUrl = options.sttApiUrl ?? process.env.PANTHEON_STT_API_URL ?? null;
    this.imageApiUrl = options.imageApiUrl ?? process.env.PANTHEON_IMAGE_API_URL ?? null;
    this.videoApiUrl = options.videoApiUrl ?? process.env.PANTHEON_VIDEO_API_URL ?? null;
    this.logs = [];
    this.logLimit = Number(options.logLimit ?? 200);
    this.cacheIndex = new Map();
    this.tasks = new Map();
  }

  async init() {
    await mkdir(this.cacheRoot, { recursive: true });
  }

  async log(event) {
    this.logs = [
      ...this.logs,
      {
        id: event.id ?? `multimodal-log-${Date.now()}`,
        createdAt: event.createdAt ?? new Date().toISOString(),
        ...event,
      },
    ].slice(-this.logLimit);
    return this.logs;
  }

  getLogs(limit = 60) {
    return [...this.logs].slice(-limit).reverse();
  }

  getStatus() {
    return {
      ttsConfigured: Boolean(this.ttsApiUrl),
      sttConfigured: Boolean(this.sttApiUrl),
      imageConfigured: Boolean(this.imageApiUrl),
      videoConfigured: Boolean(this.videoApiUrl),
      cacheRoot: this.cacheRoot,
      logCount: this.logs.length,
      cacheEntries: this.cacheIndex.size,
      activeTasks: [...this.tasks.values()].filter((task) => task.status === 'queued' || task.status === 'running').length,
    };
  }

  getTasks(limit = 40) {
    return [...this.tasks.values()].slice(-limit).reverse();
  }

  cancelTask(taskId) {
    const task = this.tasks.get(String(taskId ?? '').trim());

    if (!task) {
      return null;
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return task;
    }

    const updatedTask = {
      ...task,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    };
    this.tasks.set(updatedTask.id, updatedTask);
    return updatedTask;
  }

  startTask(kind, personalityId, input = {}) {
    const task = {
      id: `${kind}-task-${Date.now()}`,
      kind,
      personalityId,
      status: 'running',
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      inputSummary: {
        text: String(input.text ?? '').slice(0, 120) || null,
        prompt: String(input.prompt ?? '').slice(0, 120) || null,
      },
    };
    this.tasks.set(task.id, task);
    return task;
  }

  finishTask(taskId, details = {}) {
    const task = this.tasks.get(taskId);

    if (!task) {
      return null;
    }

    const updatedTask = {
      ...task,
      ...details,
      status: details.status ?? 'completed',
      completedAt: new Date().toISOString(),
    };
    this.tasks.set(taskId, updatedTask);
    return updatedTask;
  }

  getCacheKey(kind, personalityId, payload = {}) {
    return `${kind}:${sanitizeName(personalityId)}:${hashPayload(payload)}`;
  }

  async getCachedArtifact(kind, personalityId, payload = {}) {
    const cacheKey = this.getCacheKey(kind, personalityId, payload);
    const cached = this.cacheIndex.get(cacheKey);

    if (!cached?.filePath) {
      return null;
    }

    const body = await readFile(cached.filePath);
    return {
      ...cached,
      dataBase64: encodeBase64(body),
      cacheHit: true,
    };
  }

  rememberArtifact(kind, personalityId, payload = {}, artifact) {
    const cacheKey = this.getCacheKey(kind, personalityId, payload);
    this.cacheIndex.set(cacheKey, {
      ...artifact,
      dataBase64: null,
      cachedAt: new Date().toISOString(),
    });
    return artifact;
  }

  async persistArtifact(personalityId, fileName, data) {
    const personalityDir = path.join(this.cacheRoot, sanitizeName(personalityId));
    await mkdir(personalityDir, { recursive: true });
    const filePath = path.join(personalityDir, fileName);
    await writeFile(filePath, data);
    return filePath;
  }

  buildArtifact(personalityId, kind, mimeType, body, metadata = {}) {
    const fileName = metadata.fileName ?? `${sanitizeName(kind)}-${Date.now()}.${metadata.extension ?? 'bin'}`;
    return {
      id: `${kind}-${Date.now()}`,
      personalityId,
      kind,
      provider: metadata.provider ?? 'stub',
      mode: metadata.mode ?? 'stub',
      mimeType,
      dataBase64: encodeBase64(body),
      fileName,
      previewText: metadata.previewText ?? null,
      prompt: metadata.prompt ?? null,
      description: metadata.description ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  async synthesizeSpeech(input = {}) {
    const personality = this.personalityManager.getPersonality(input.personalityId ?? 'default');
    const text = String(input.text ?? '').trim();

    if (!text) {
      throw new Error('Text is required for speech synthesis.');
    }

    const cachePayload = {
      text,
      voice: personality.multimodal?.ttsVoice,
      voicePitch: personality.multimodal?.voicePitch,
      voiceRate: personality.multimodal?.voiceRate,
      emotion: personality.dynamicState?.lastEmotion,
    };
    const cached = await this.getCachedArtifact('tts', personality.id, cachePayload);

    if (cached) {
      await this.log({ kind: 'tts-cache', personalityId: personality.id, summary: `Cached TTS reused for ${personality.id}.` });
      return cached;
    }

    const task = this.startTask('tts', personality.id, { text });

    try {
      if (this.ttsApiUrl) {
        const response = await maybeCallJsonApi(this.ttsApiUrl, {
          text,
          personalityId: personality.id,
          voice: personality.multimodal?.ttsVoice,
          voicePitch: personality.multimodal?.voicePitch,
          voiceRate: personality.multimodal?.voiceRate,
        });
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const artifact = this.buildArtifact(personality.id, 'tts', response.headers.get('content-type') ?? 'audio/mpeg', buffer, {
          extension: 'audio',
          provider: 'remote-tts',
          mode: 'remote',
          previewText: text.slice(0, 120),
          fileName: `tts-${hashPayload(cachePayload)}.audio`,
        });
        artifact.filePath = await this.persistArtifact(personality.id, artifact.fileName, buffer);
        this.rememberArtifact('tts', personality.id, cachePayload, artifact);
        await this.log({ kind: 'tts', personalityId: personality.id, summary: `Remote TTS generated for ${personality.id}.` });
        this.finishTask(task.id, { status: 'completed', artifactId: artifact.id });
        return artifact;
      }

      const frequency = 250 + Math.round((personality.multimodal?.voicePitch ?? 1) * 180) + Math.round((personality.traits?.extraversion ?? 0.5) * 80);
      const durationMs = Math.min(2400, Math.max(700, text.length * 26));
      const wav = buildWavBuffer({
        frequency,
        durationMs,
        amplitude: 0.22 + clamp(personality.dynamicState?.energy ?? 0.6) * 0.12,
      });
      const artifact = this.buildArtifact(personality.id, 'tts', 'audio/wav', wav, {
        extension: 'wav',
        provider: 'stub-voice-wave',
        mode: 'stub',
        previewText: `${personality.displayName}: ${text.slice(0, 160)}`,
        description: `Stub voice for ${personality.displayName} using ${personality.multimodal?.ttsVoice ?? 'default voice'}`,
        fileName: `tts-${hashPayload(cachePayload)}.wav`,
      });
      artifact.filePath = await this.persistArtifact(personality.id, artifact.fileName, wav);
      this.rememberArtifact('tts', personality.id, cachePayload, artifact);
      await this.log({ kind: 'tts', personalityId: personality.id, summary: `Stub TTS generated for ${personality.id}.` });
      this.finishTask(task.id, { status: 'completed', artifactId: artifact.id });
      return artifact;
    } catch (error) {
      this.finishTask(task.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown TTS error',
      });
      throw error;
    }
  }

  async transcribeSpeech(input = {}) {
    const personality = this.personalityManager.getPersonality(input.personalityId ?? 'default');
    const audioBase64 = String(input.audioBase64 ?? '').trim();
    const mockTranscript = String(input.mockTranscript ?? '').trim();

    if (this.sttApiUrl && audioBase64) {
      const response = await maybeCallJsonApi(this.sttApiUrl, {
        audioBase64,
        mimeType: input.mimeType ?? 'audio/wav',
        locale: personality.multimodal?.sttLocale,
        personalityId: personality.id,
      });
      const payload = await response.json();
      await this.log({ kind: 'stt', personalityId: personality.id, summary: `Remote STT completed for ${personality.id}.` });
      return {
        personalityId: personality.id,
        transcript: payload.transcript ?? '',
        provider: 'remote-stt',
        mode: 'remote',
      };
    }

    const transcript = mockTranscript || (audioBase64
      ? `Распознана заглушка речи для ${personality.displayName}. Длина аудио: ${Math.round(audioBase64.length / 4)} байт.`
      : `Заглушка распознавания для ${personality.displayName}: передай audioBase64 или mockTranscript.`);
    await this.log({ kind: 'stt', personalityId: personality.id, summary: `Stub STT completed for ${personality.id}.` });
    return {
      personalityId: personality.id,
      transcript,
      provider: 'stub-stt',
      mode: 'stub',
    };
  }

  async generateImage(input = {}) {
    const personality = this.personalityManager.getPersonality(input.personalityId ?? 'default');
    const prompt = String(input.prompt ?? '').trim() || personality.multimodal?.avatarPrompt || personality.displayName;

    const cachePayload = {
      prompt,
      style: personality.multimodal?.imageStyle,
      emotion: personality.dynamicState?.lastEmotion,
      profileDescription: personality.profileDescription,
    };
    const cached = await this.getCachedArtifact('image', personality.id, cachePayload);

    if (cached) {
      await this.log({ kind: 'image-cache', personalityId: personality.id, summary: `Cached image reused for ${personality.id}.` });
      return cached;
    }

    const task = this.startTask('image', personality.id, { prompt });

    try {
      if (this.imageApiUrl) {
        const response = await maybeCallJsonApi(this.imageApiUrl, {
          prompt,
          personalityId: personality.id,
          style: personality.multimodal?.imageStyle,
        });
        const payload = await response.json();
        const raw = Buffer.from(String(payload.imageBase64 ?? ''), 'base64');
        const artifact = this.buildArtifact(personality.id, 'image', payload.mimeType ?? 'image/png', raw, {
          extension: 'png',
          provider: 'remote-image',
          mode: 'remote',
          previewText: prompt,
          prompt,
          fileName: `image-${hashPayload(cachePayload)}.png`,
        });
        artifact.filePath = await this.persistArtifact(personality.id, artifact.fileName, raw);
        this.rememberArtifact('image', personality.id, cachePayload, artifact);
        await this.log({ kind: 'image-generate', personalityId: personality.id, summary: `Remote image generated for ${personality.id}.` });
        this.finishTask(task.id, { status: 'completed', artifactId: artifact.id });
        return artifact;
      }

      const svg = createSvgCard({
        title: personality.displayName,
        subtitle: personality.multimodal?.imageStyle ?? 'visual personality card',
        body: `${prompt}\n${personality.profileDescription ?? ''}`,
        accent: personality.dynamicState?.lastEmotion === 'guarded' ? '#ffb37c' : '#7cc6ff',
        background: personality.dynamicState?.lastEmotion === 'bright' ? '#123652' : '#102034',
      });
      const artifact = this.buildArtifact(personality.id, 'image', 'image/svg+xml', svg, {
        extension: 'svg',
        provider: 'stub-svg',
        mode: 'stub',
        previewText: prompt,
        prompt,
        description: `Visual stub for ${personality.displayName} in ${personality.multimodal?.imageStyle}.`,
        fileName: `image-${hashPayload(cachePayload)}.svg`,
      });
      artifact.filePath = await this.persistArtifact(personality.id, artifact.fileName, svg);
      this.rememberArtifact('image', personality.id, cachePayload, artifact);
      await this.log({ kind: 'image-generate', personalityId: personality.id, summary: `Stub image generated for ${personality.id}.` });
      this.finishTask(task.id, { status: 'completed', artifactId: artifact.id });
      return artifact;
    } catch (error) {
      this.finishTask(task.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown image generation error',
      });
      throw error;
    }
  }

  async describeImage(input = {}) {
    const personality = this.personalityManager.getPersonality(input.personalityId ?? 'default');
    const prompt = String(input.prompt ?? '').trim();
    const binary = summarizeBinaryInput(input);

    if (this.imageApiUrl && binary.hasUpload) {
      const response = await maybeCallJsonApi(this.imageApiUrl, {
        mode: 'describe',
        personalityId: personality.id,
        prompt,
        dataBase64: binary.dataBase64,
        mimeType: binary.mimeType,
        fileName: binary.fileName,
        style: personality.multimodal?.imageStyle,
      });
      const payload = await response.json();
      const description = String(payload.description ?? '').trim() || `${personality.displayName} processed uploaded image.`;
      await this.log({ kind: 'image-describe', personalityId: personality.id, summary: `Remote image description generated for ${personality.id}.` });
      return {
        personalityId: personality.id,
        provider: 'remote-image-describer',
        mode: 'remote',
        description,
        source: {
          mimeType: binary.mimeType,
          fileName: binary.fileName,
          approxBytes: binary.approxBytes,
        },
      };
    }

    const description = [
      `${personality.displayName} видит образ в стиле ${personality.multimodal?.imageStyle ?? 'unknown-style'}.`,
      binary.hasUpload ? `Загружен файл ${binary.fileName ?? 'without-name'} (${binary.mimeType}, около ${binary.approxBytes} байт).` : 'Файл изображения не передан.',
      prompt ? `Похоже, что в центре сцены: ${prompt}.` : 'Промпт не передан, поэтому описание строится по профилю личности.',
      `Эмоциональный фон: ${personality.dynamicState?.lastEmotion ?? 'neutral'}.`,
    ].join(' ');
    await this.log({ kind: 'image-describe', personalityId: personality.id, summary: `Image description generated for ${personality.id}.` });
    return {
      personalityId: personality.id,
      provider: this.imageApiUrl ? 'remote-image-describer' : 'stub-image-describer',
      mode: this.imageApiUrl ? 'remote' : 'stub',
      description,
      source: binary.hasUpload ? {
        mimeType: binary.mimeType,
        fileName: binary.fileName,
        approxBytes: binary.approxBytes,
      } : null,
    };
  }

  async generateVideo(input = {}) {
    const personality = this.personalityManager.getPersonality(input.personalityId ?? 'default');
    const prompt = String(input.prompt ?? '').trim() || `${personality.displayName} shares a short emotional scene`;
    const durationSeconds = Math.max(2, Math.min(12, Number(input.durationSeconds ?? 4)));

    const cachePayload = {
      prompt,
      durationSeconds,
      style: personality.multimodal?.videoStyle,
      emotion: personality.dynamicState?.lastEmotion,
    };
    const cached = await this.getCachedArtifact('video', personality.id, cachePayload);

    if (cached) {
      await this.log({ kind: 'video-cache', personalityId: personality.id, summary: `Cached video reused for ${personality.id}.` });
      return cached;
    }

    const task = this.startTask('video', personality.id, { prompt });

    try {
      if (this.videoApiUrl) {
        const response = await maybeCallJsonApi(this.videoApiUrl, {
          prompt,
          personalityId: personality.id,
          style: personality.multimodal?.videoStyle,
          durationSeconds,
        });
        const payload = await response.json();
        const raw = Buffer.from(String(payload.videoBase64 ?? ''), 'base64');
        const artifact = this.buildArtifact(personality.id, 'video', payload.mimeType ?? 'video/mp4', raw, {
          extension: 'mp4',
          provider: 'remote-video',
          mode: 'remote',
          previewText: prompt,
          prompt,
          fileName: `video-${hashPayload(cachePayload)}.mp4`,
        });
        artifact.filePath = await this.persistArtifact(personality.id, artifact.fileName, raw);
        this.rememberArtifact('video', personality.id, cachePayload, artifact);
        await this.log({ kind: 'video-generate', personalityId: personality.id, summary: `Remote video generated for ${personality.id}.` });
        this.finishTask(task.id, { status: 'completed', artifactId: artifact.id });
        return artifact;
      }

      const storyboard = {
        title: `${personality.displayName} storyboard`,
        durationSeconds,
        style: personality.multimodal?.videoStyle,
        frames: Array.from({ length: Math.min(6, durationSeconds + 1) }, (_, index) => ({
          t: index,
          caption: `${personality.displayName} frame ${index + 1}: ${prompt}`,
          emotion: personality.dynamicState?.lastEmotion,
        })),
      };
      const raw = Buffer.from(JSON.stringify(storyboard, null, 2), 'utf8');
      const artifact = this.buildArtifact(personality.id, 'video', 'application/json', raw, {
        extension: 'json',
        provider: 'stub-storyboard',
        mode: 'stub',
        previewText: prompt,
        prompt,
        description: `Storyboard stub for ${personality.displayName} in ${personality.multimodal?.videoStyle}.`,
        fileName: `video-${hashPayload(cachePayload)}.json`,
      });
      artifact.filePath = await this.persistArtifact(personality.id, artifact.fileName, raw);
      this.rememberArtifact('video', personality.id, cachePayload, artifact);
      await this.log({ kind: 'video-generate', personalityId: personality.id, summary: `Stub video storyboard generated for ${personality.id}.` });
      this.finishTask(task.id, { status: 'completed', artifactId: artifact.id });
      return artifact;
    } catch (error) {
      this.finishTask(task.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown video generation error',
      });
      throw error;
    }
  }

  async describeVideo(input = {}) {
    const personality = this.personalityManager.getPersonality(input.personalityId ?? 'default');
    const prompt = String(input.prompt ?? '').trim();
    const binary = summarizeBinaryInput(input);

    if (this.videoApiUrl && binary.hasUpload) {
      const response = await maybeCallJsonApi(this.videoApiUrl, {
        mode: 'describe',
        personalityId: personality.id,
        prompt,
        dataBase64: binary.dataBase64,
        mimeType: binary.mimeType,
        fileName: binary.fileName,
        style: personality.multimodal?.videoStyle,
      });
      const payload = await response.json();
      const description = String(payload.description ?? '').trim() || `${personality.displayName} processed uploaded video.`;
      await this.log({ kind: 'video-describe', personalityId: personality.id, summary: `Remote video description generated for ${personality.id}.` });
      return {
        personalityId: personality.id,
        provider: 'remote-video-describer',
        mode: 'remote',
        description,
        source: {
          mimeType: binary.mimeType,
          fileName: binary.fileName,
          approxBytes: binary.approxBytes,
        },
      };
    }

    const description = [
      `${personality.displayName} воспринимает видео как короткую сцену в стиле ${personality.multimodal?.videoStyle ?? 'storyboard'}.`,
      binary.hasUpload ? `Загружен файл ${binary.fileName ?? 'without-name'} (${binary.mimeType}, около ${binary.approxBytes} байт).` : 'Видео-файл не передан.',
      prompt ? `Содержание похоже на: ${prompt}.` : 'Описание строится по визуальному стилю и текущему настроению личности.',
      `Психологический оттенок: ${personality.profileDescription ?? personality.characterSummary}.`,
    ].join(' ');
    await this.log({ kind: 'video-describe', personalityId: personality.id, summary: `Video description generated for ${personality.id}.` });
    return {
      personalityId: personality.id,
      provider: this.videoApiUrl ? 'remote-video-describer' : 'stub-video-describer',
      mode: this.videoApiUrl ? 'remote' : 'stub',
      description,
      source: binary.hasUpload ? {
        mimeType: binary.mimeType,
        fileName: binary.fileName,
        approxBytes: binary.approxBytes,
      } : null,
    };
  }
}