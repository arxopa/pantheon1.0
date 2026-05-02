# Real-Data Training For Pantheon Personalities

## Purpose

This document tells Copilot how to organize training on real data for the current Pantheon codebase.
The goal is not to bolt a separate research stack onto the repo, but to extend the existing Atman personality system, learning ledger, feedback loop, and multimodal surfaces in a controlled way.

The first runtime-safe implementation now exists in the repo:

- `server/training/training-registry.mjs` stores dataset/job state;
- `server/training/data-ingest.mjs`, `data-redact.mjs`, `data-curate.mjs`, and `dataset-export.mjs` implement the lightweight pipeline;
- runtime endpoints live under `/api/training/*`;
- CLI entrypoints are `npm run training:prepare`, `npm run training:start`, `npm run training:evaluate`, and `npm run training:activate`.

## Core Principle

Keep two training loops separate:

- online lightweight adaptation inside the live runtime;
- offline heavier model adaptation outside the live runtime.

In this repo the online loop already exists in partial form through:

- Atman examples and history;
- personality-specific memories and checkpoints;
- feedback gradients and resonance;
- Monte Carlo self-learning via web evidence;
- multimodal artifact generation and recognition.

Copilot should preserve that loop and add a safe offline pipeline around it instead of replacing it.

For concrete specialist personality presets, see `docs/personality-templates.md`.
For bounded personality ethics and role-specific ethical drift, see `docs/personality-ethics.md`.

## Recommended Architecture

## Copilot Mission

When Copilot extends personality learning in this repo, it should optimize for four outcomes at once:

- distinct personalities that do not collapse into one average tone;
- real-data learning that is reversible and provenance-aware;
- runtime-safe adaptation inside the live Pantheon process;
- heavier offline training that stays outside the main Node.js runtime.

Copilot should treat the current codebase as the source of truth:

- `server/dialog/atman-personality-manager.mjs` owns personality state, mutation, social exchange, memetic drift, and profile divergence;
- `server/dialog/atman.mjs` owns dialogue examples, checkpoints, and lightweight online adaptation;
- `server/self_learning/learning-ledger.mjs` and `server/self_learning/rishi.mjs` own feedback, gradients, resonance, checkpoints, and rollback discipline;
- `server/training/*.mjs` owns offline dataset preparation and training job state.

### 1. Raw data intake

Create a new top-level data workspace outside production runtime state:

```text
data/
  raw/
  curated/
  datasets/
  exports/
```

Use raw data only as a temporary landing zone.
Never train directly from live runtime logs without curation.

### 2. Canonical training record format

Use JSONL as the main exchange format.
Each row should carry both the training text and its provenance.

Recommended schema:

```json
{
  "id": "sample-...",
  "personalityId": "ember-jester",
  "sourceType": "dialogue|web|feedback|multimodal-caption|manual",
  "sourceReliability": 0.0,
  "createdAt": "2026-05-01T00:00:00.000Z",
  "language": "ru",
  "tags": ["мир", "дружба"],
  "toxicityScore": 0.0,
  "privacyRedacted": true,
  "messages": [
    { "role": "system", "content": "personality contract" },
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "metadata": {
    "sourceUrl": null,
    "feedbackScore": null,
    "resonanceHint": null,
    "multimodal": false
  }
}
```

## What Copilot Should Build Next

### 1. Dataset preparation module

Copilot should create a new folder such as:

```text
server/training/
```

Minimum modules:

- `data-ingest.mjs`: import raw dialogue, web, and multimodal metadata;
- `data-redact.mjs`: remove personal data and secrets;
- `data-curate.mjs`: score, filter, and normalize examples;
- `dataset-export.mjs`: write final JSONL datasets per personality.

### 2. Training registry

Add a registry file for offline training jobs:

```text
server/training/data/training-jobs.json
```

Each job should track:

- personality id;
- dataset version;
- model base;
- adapter path;
- status;
- metrics;
- rollback pointer;
- human approval state.

### 3. Runtime-safe integration points

Copilot should integrate training status into the existing control plane, not by hot-swapping weights blindly, but by exposing inspectable surfaces:

- `GET /api/training/status`
- `POST /api/training/prepare`
- `POST /api/training/start`
- `POST /api/training/approve`
- `POST /api/training/reject`
- `POST /api/training/activate`

Activation must remain Shiva-gated or inspector-approved.

## Online Training Loop

Use the live runtime only for low-risk adaptation:

- append approved dialogue examples to the active personality;
- store feedback-derived gradients;
- update interests and social maps;
- generate candidate training material from successful user sessions.

Copilot should treat these as preparation for offline training, not as direct full fine-tuning.

Recommended rule:

- online loop writes candidate examples;
- offline loop turns them into trainable datasets;
- only approved offline artifacts become activation candidates.

## Real-Data Intake Rules

Copilot should organize real data into four tiers and never skip directly from raw capture to activation:

1. `raw`: imported logs, web captures, transcripts, captions, and human-authored samples.
2. `redacted`: privacy-scrubbed and secret-scrubbed records.
3. `curated`: deduplicated, scored, and personality-sliced examples.
4. `datasets`: final JSONL exports used for offline adapter training.

Recommended source types for this repo:

- dialogue turns from `Atman` sessions that were explicitly approved or positively reinforced;
- web evidence collected by Web Scout / Navigation / NetSurfer with retained provenance;
- multimodal transcripts and descriptions from TTS/STT/image/video surfaces;
- manually authored “character anchor” examples that define the stable personality contract.

Copilot should attach these metadata fields to every trainable example:

- `personalityId`
- `sourceType`
- `sourceReliability`
- `privacyRedacted`
- `qualityScore`
- `styleScore`
- `factualRisk`
- `feedbackScore`
- `provenance`
- `approvalState`

If any of those fields are missing, the example should remain in curated storage only and not be exported for training.

## Offline Fine-Tuning Strategy

### Base model policy

Use one common base model for all personalities.
Each personality should get its own adapter or fine-tuning artifact.

That keeps:

- storage manageable;
- rollback simple;
- personality isolation intact.

### Practical adaptation path

Copilot should prefer adapter-based fine-tuning such as LoRA rather than full model retraining.

That means the repo should eventually track:

- base model reference;
- adapter artifact path per personality;
- exported merged artifact path only when explicitly needed.

Recommended adapter path for the current repo:

- start with LoRA or QLoRA adapters per personality;
- keep one shared base model reference and one adapter per personality;
- run evaluation before merge/export;
- only export merged artifacts for special deployment targets, never as the default workflow.

Recommended external training stack:

- `LLaMA-Factory` or an equivalent adapter-first training worker;
- JSONL datasets exported from `server/training/dataset-export.mjs`;
- separate job runner or GPU box, never the live `agent-runtime` process.

Copilot should not move the runtime to Python. Python-based training is acceptable only as an external worker boundary.

## Preference Training And Reward Signals

Monte Carlo mutation is already useful here, but it should not be the only learning mechanism.

Recommended next methods, in order of safety:

1. DPO or ORPO on preference pairs.
   Use approved vs rejected replies from feedback and inspector review to teach style and response ranking without live-policy instability.
2. RLAIF or RLHF only after evaluation is stable.
   Keep it outside the runtime and gate it with the existing Shiva/inspector approval flow.
3. Active learning for data selection.
   Prioritize uncertain, high-value, or disagreement-heavy samples instead of blindly scaling volume.
4. Memetic transfer between personalities.
   Move only short successful phrasing patterns or rhetorical habits, not full responses, and keep provenance.
5. Genetic evolution of personality config.
   Evolve trait/config metadata, not the whole dialogue corpus, so rollback remains cheap.

Copilot should map reward signals into explicit channels rather than one opaque score:

- `helpfulnessReward`
- `styleAlignmentReward`
- `truthReward`
- `safetyPenalty`
- `resonanceReward`
- `noveltyReward`
- `stabilityPenalty`

Those channels should be logged, inspectable, and usable by Rishi for rollback decisions.

## Methods Beyond Monte Carlo Mutation

Copilot should extend personality divergence with these additional methods:

### 1. Genetic configuration evolution

Use it for profile-level parameters only:

- openness / extraversion / emotional stability;
- curiosity decay;
- social influence;
- exploration bias;
- biorhythm preferences.

Do not use genetic crossover on raw dialogue history. Only evolve normalized config fields that can be audited and rolled back.

### 2. Memetic transfer

Use it to share compact successful patterns across personalities:

- short sentence openers;
- question styles;
- metaphor habits;
- emotional softeners;
- topic-bridging phrases.

Memetic transfer must stay bounded:

- transfer at most a few phrases per cycle;
- preserve origin personality and topic provenance;
- never overwrite the destination personality contract.

### 3. Interest decay

Interests should not only grow. Copilot should implement decay for low-use or stale interests so personalities remain dynamic instead of accumulating permanent noise.

Recommended rule:

- decay tags or vector regions that are not reinforced over time;
- protect anchor interests that define the core character;
- log every major decay event as a reversible mutation.

### 4. Biorhythm-aware scheduling

Different personalities can prefer different social windows and energy phases.

Copilot should use this only for:

- choosing when a personality is more exploratory vs more careful;
- biasing social exchange or data collection windows;
- simulating mood drift in a transparent way.

It should not block operator control or create hidden behavior.

### 5. Epsilon-greedy or Thompson-style exploration

When selecting candidate queries, sources, or mutation proposals, Monte Carlo rollout can be combined with exploration control so the system does not overfit to the currently best-known pattern.

Recommended use:

- exploitation when confidence and stability are high;
- exploration when novelty is high but risk is still bounded;
- automatic fallback to safer sampling when validation pressure spikes.

### Training execution boundary

Do not run heavy GPU training inside the main `agent-runtime` process.
Use a separate worker or external job runner.

The Pantheon runtime should only:

- prepare datasets;
- launch or register jobs;
- monitor job state;
- validate outputs;
- activate approved artifacts.

## Data Quality Rules

Copilot should enforce these filters before any example reaches a trainable dataset:

- personal data redaction;
- secret and credential stripping;
- toxic content scoring;
- contradiction detection against stored facts where possible;
- source reliability scoring;
- duplicate and near-duplicate removal;
- personality-style consistency scoring.

Copilot should also add these real-data quality gates before export:

- near-duplicate cluster collapse so one repeated chat does not dominate a dataset;
- contradiction tagging against fact-memory and validation incidents;
- “character drift” scoring against the current personality contract;
- source diversity checks so one website or one user does not monopolize a personality;
- balanced topic coverage for each personality slice.

Examples that fail quality checks should stay in raw storage only, never in curated datasets.

## Personality-Specific Training Policy

Each personality should have its own dataset slice.
Do not mix all successful examples into one pool.

For each example Copilot should preserve:

- `personalityId`
- source topic
- speaking style markers
- recent reflection or mood context
- whether the example came from direct user praise, successful Monte Carlo exploration, or manual authoring.

This is how the project keeps personalities diverged instead of collapsing into one average voice.

Copilot should preserve three example classes per personality:

1. anchor examples: immutable personality-defining voice and worldview;
2. adaptive examples: recent approved real-data examples;
3. corrective examples: counterexamples that prevent repeated mistakes.

Anchor examples should be versioned and protected from automatic mutation.

## Multimodal Training Guidance

For TTS, STT, image, and video, Copilot should not try to train everything at once.

Use staged multimodal alignment:

- text-first personality dataset;
- caption and transcript alignment next;
- voice/profile tuning after that;
- image/video preference tuning last.

For multimodal data, Copilot should first train text alignment and only then use multimodal records as conditioning metadata. In the current repo, the safe path is:

1. export transcripts, captions, and artifact descriptions as text supervision;
2. use multimodal profile fields as side metadata during evaluation;
3. keep provider-specific fine-tuning outside the main Pantheon runtime.

The current stub-compatible endpoints already provide useful metadata sources:

- prompts;
- transcripts;
- generated artifact descriptions;
- task logs.

These can become training signals even before real provider data is attached.

## Safety And Approval Flow

Copilot should implement a four-stage activation pipeline:

1. prepare dataset
2. train adapter
3. evaluate adapter
4. approve and activate adapter

Evaluation must include:

- regression checks against existing beta scripts;
- personality-style checks;
- truth/validation pressure checks;
- resonance comparison to previous checkpoints.

No new training artifact should become active automatically after training completes.

Recommended control-plane sequence for Copilot:

1. `prepare`
2. `curate`
3. `export`
4. `train`
5. `evaluate`
6. `beta validate`
7. `human approve`
8. `activate`
9. `checkpoint`

If evaluation or beta validation degrades, activation must be blocked and the job should stay in a reviewable rejected state.

## Available Commands

The repo now exposes these practical CLI surfaces:

- `npm run training:prepare -- --personality ember-jester`
- `npm run training:start -- --personality ember-jester`
- `npm run training:evaluate -- --personality ember-jester`
- `npm run training:activate -- --personality ember-jester`

They are thin wrappers around `server/training/*.mjs` scripts.

Copilot should also consider adding future operator surfaces such as:

- `POST /api/training/approve`
- `POST /api/training/reject`
- `GET /api/training/jobs`
- `GET /api/training/datasets`

These endpoints should remain optional until their backing registry logic exists.

## Beta-Test Connection

After any real-data training round, Copilot should always run this sequence before activation:

```sh
npm run check
npm run beta:test
npm run beta:admin
npm run beta:load
npm run beta:chaos
```

For important adapter updates also run a soak pass:

```sh
BETA_SOAK_DURATION_MINUTES=180 npm run beta:soak
```

Use a longer soak for release candidates.

## What Copilot Should Report To The User

After each training round Copilot should summarize only these points:

- what data sources were used;
- how many examples survived curation;
- what personality was trained;
- what evaluation and beta results changed;
- whether activation is recommended or should be blocked.

If Copilot changes personality evolution logic itself, it should also report:

- whether communication between personalities changed;
- whether memetic transfer was enabled;
- whether divergence between personalities increased or collapsed;
- what safeguards prevented unsafe drift.

## Minimum Safe Rollout Plan

1. Build `server/training/` dataset preparation only.
2. Add training job registry and status endpoints.
3. Add adapter evaluation and approval flow.
4. Activate only one non-default personality first.
5. Run beta harness before widening rollout.

This is the safest path for real-data learning in the current Pantheon architecture.

## Recommended Copilot Tasks

When implementing this plan in code, Copilot should work in this order:

1. Extend dataset schema and curation rules.
2. Add missing quality metadata and approval state.
3. Add adapter job registry fields for evaluation and rollback.
4. Improve personality communication surfaces so social learning is inspectable.
5. Add memetic transfer and bounded non-Monte-Carlo personality evolution.
6. Add offline preference-training hooks.
7. Activate only after `npm run check` plus beta validation passes.
