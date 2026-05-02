# Copilot Task: Multimodal Pantheon Personalities

## Goal

Продолжить развитие Atman/Pantheon так, чтобы каждая personality стала не только текстовым собеседником, но и мультимодальным агентом со своим голосом, стилем восприятия, социальной динамикой, а в будущем и с более автономным интернет-серфингом и Monte Carlo self-learning.

Задача должна решаться внутри текущей архитектуры проекта на Node.js ESM + Vite/React, без переноса логики в отдельный Python-контур.

## Current Code Anchors

Основные файлы, которые уже участвуют в решении:

- `server/agent-runtime.mjs`
- `server/dialog/atman.mjs`
- `server/dialog/atman-personality-manager.mjs`
- `server/integrations/personality-multimodal.mjs`
- `server/integrations/shakti-bridge.mjs`
- `server/navigation/pantheon-web-scout.mjs`
- `server/navigation/pantheon-navigation-core.mjs`
- `server/navigation/pantheon-net-surfer.mjs`
- `static/admin.html`

## Already Implemented Baseline

- personalities already have persistent trait/state profiles: OCEAN, dynamicState, interests, habits, voice, social, reflection, characterSummary, speakingStyle;
- multimodal profile fields already exist in personality registry under `multimodal` and `profileDescription`;
- `server/integrations/personality-multimodal.mjs` already exposes TTS/STT/image/video methods with remote-provider support and local fallbacks;
- runtime endpoints already exist for social map, social simulation, TTS, STT, image generation/recognition, and video generation/recognition;
- admin already exposes operator-facing controls for these endpoints.

## Required Work

### 1. Strengthen TTS per Personality

Improve `server/integrations/personality-multimodal.mjs` so TTS is more deeply conditioned on personality profile.

Expected behavior:

- use `voice`, `speakingStyle`, `traits`, `dynamicState`, and `multimodal` settings together;
- support provider-specific payload shaping when `PANTHEON_TTS_API_URL` is configured;
- keep local fallback generation working when no provider is configured;
- return artifacts with enough metadata for admin preview, logging, and future Telegram/Google Chat voice delivery.

Concrete tasks:

- enrich TTS request metadata with cadence, emotional temperature, and persona label;
- add explicit `voicePreset`, `prosody`, `pace`, and `emotionBlend` normalization;
- persist last generated speech artifacts in per-personality storage for replay/debugging;
- expose any useful metadata in `/api/atman/media/logs`.

### 2. Strengthen STT / Speech Recognition

Improve speech recognition flow so it is usable both in stub mode and later with real audio uploads.

Expected behavior:

- support text fallback via `mockTranscript`;
- accept richer input metadata for language, speaker label, and optional file name;
- when a real provider is configured via `PANTHEON_STT_API_URL`, pass the payload through and normalize the provider result;
- use personality context to interpret ambiguous phrases more naturally.

Concrete tasks:

- add normalized output fields like `transcript`, `confidence`, `language`, `speakerTone`, `personalityInterpretation`;
- persist the transcription result to multimodal logs;
- optionally route recognized speech into the standard Atman dialogue path as a follow-up operator action.

### 3. Personality Descriptions as First-Class Output

Personality descriptions should not remain passive metadata only.

Expected behavior:

- every personality should expose a compact description, a richer profile description, and a multimodal self-presentation;
- admin, Telegram bridge, and future external surfaces should be able to request a personality card or self-description on demand;
- descriptions should evolve slightly after self-learning and social exchanges.

Concrete tasks:

- add a runtime endpoint such as `GET /api/atman/profile?personalityId=...` or equivalent;
- derive a structured response with fields like `summary`, `temperament`, `voiceSignature`, `visualStyle`, `socialSignature`, `currentMood`;
- ensure `runAtmanMonteCarloSelfLearning()` and social exchange flows can refresh description fields when traits or interests change.

### 4. Photo / Image Generation

Image generation should become a personality-driven visual expression layer instead of a plain prompt passthrough.

Expected behavior:

- prompts should be enriched from personality traits, interests, reflection themes, and current emotional state;
- generated artifacts should be persisted and inspectable;
- stub mode must keep producing deterministic local image cards.

Concrete tasks:

- enrich prompt construction inside `generateImage()` with personality-aware modifiers;
- store image artifacts with provenance and prompt metadata;
- surface the latest generated image in admin for the selected personality;
- prepare the artifact model so future providers can return URLs, base64, or binary buffers uniformly.

### 5. Photo / Image Recognition

Image recognition should become part of personality cognition.

Expected behavior:

- recognition should produce both a generic visual description and a personality-aware interpretation;
- result should optionally feed into Atman memory or interests;
- the system should be able to compare recognized motifs against the personality's interests and current mood.

Concrete tasks:

- normalize response fields like `caption`, `objects`, `mood`, `interpretation`, `interestMatches`;
- if confidence is high enough, allow storing the recognized observation as a lightweight fact or reflection signal;
- add operator visibility in admin/logs.

### 6. Video Generation

Video generation should be compatible with the current artifact system even before a real external provider is attached.

Expected behavior:

- keep JSON storyboard fallback for local mode;
- allow future providers to return rendered video or job handles;
- make video output reflect personality pacing, tone, motifs, and narrative style.

Concrete tasks:

- enrich storyboard generation using `voice`, `habits`, `reflection`, `multimodal`, and `profileDescription`;
- add frame-scene metadata that can later be rendered by a real provider;
- include generation timestamps and provenance in saved artifacts.

### 7. Video Recognition

Video recognition should summarize scenes and extract personality-relevant meaning.

Expected behavior:

- return scene summary, actions, affect, and a personality-aware reading of the clip;
- optionally feed strong signals into interests, facts, or reflection state;
- support stub mode even without real uploaded video.

Concrete tasks:

- normalize output into `sceneSummary`, `events`, `affect`, `interpretation`, `interestMatches`;
- log recognition results to the same multimodal history used by TTS/STT/image flows.

### 8. Continue Monte Carlo Self-Learning Path

Monte Carlo self-learning should keep influencing personality evolution, not stay isolated to text/research only.

Expected behavior:

- self-learning should be able to modify interest vectors, reflection, social contagion, and multimodal tendencies;
- high-confidence discoveries should be able to bias future image/video prompt styles and voice signatures;
- self-learning output should remain explainable to the operator.

Concrete tasks:

- extend `runAtmanMonteCarloSelfLearning()` and/or `AtmanPersonalityManager.evolvePersonalityFromLearning()` so multimodal tendencies can drift over time;
- connect research findings to `profileDescription`, `multimodal.visualThemes`, `multimodal.audioThemes`, or equivalent normalized fields;
- keep changes bounded and rollback-friendly.

### 9. Continue Internet-Surfing Development Path

Net-surfer and research modules should become explicit perception channels for the personalities.

Expected behavior:

- web findings should be mappable into interests, visual themes, and social contagion;
- personalities should be able to accumulate media-oriented inspiration from research;
- provenance must remain inspectable.

Concrete tasks:

- attach provenance from Web Scout / Navigation / NetSurfer to personality evolution records;
- add an optional pathway where a researched topic can immediately seed a visual or audio generation request;
- expose source-backed inspiration logs in admin.

## UI / Operator Work

Improve `static/admin.html` further if needed so the operator can:

- see current multimodal profile fields for the selected personality;
- preview the last audio/image/video-related artifact;
- inspect social graph changes after self-learning or social simulation;
- manually trigger personality description refresh.

## Validation Requirements

Use the existing project validation style.

Minimum checks:

1. `npm run build`
2. isolated runtime startup on a free port such as `8807`
3. live probes for:
   - `/api/atman/social-map`
   - `/api/atman/social-simulate`
   - `/api/atman/media/status`
   - `/api/atman/media/tts`
   - `/api/atman/media/stt`
   - `/api/atman/media/image/generate`
   - `/api/atman/media/video/generate`
4. confirm that at least one self-learning run changes personality-related output and returns social contagion metadata

## Constraints

- do not replace the current Node.js ESM runtime with another stack;
- do not add heavy dependencies unless strictly necessary;
- keep endpoints executable in local stub mode even when external providers are absent;
- preserve existing Atman, Telegram, ShaktiBridge, and Pantheon research flows;
- prefer small patches and local validations over broad rewrites.

## Deliverable Standard

The work is complete only when:

- runtime endpoints behave consistently in both stub and provider-backed mode;
- operator UI can drive the new capabilities;
- README reflects the new surface area;
- changes remain compatible with current personality persistence and self-learning architecture.
