# Pantheon Beta Testing

## Purpose

This beta harness adapts the DeepSeek checklist to the current Pantheon codebase.
The repo uses Node.js ESM, the existing HTTP runtime in `server/agent-runtime.mjs`, and the inspector/health surfaces already exposed by the server.

The result is a practical beta flow instead of a parallel Python test stack.

## What Copilot Should Run

### 1. Functional beta sweep

```sh
npm run beta:test
```

What it checks:

- startup health and personality loading;
- inspector metrics availability;
- creator-priority dialogue;
- interest clarification behavior;
- personality-scoped dialogue separation;
- Ultra mode activation, canonical expert routing, session reuse, and `!normal` exit;
- TTS/STT/image/video stub flows;
- Monte Carlo self-learning for different personalities;
- bridge timeout fallback;
- malformed JSON handling;
- full Pantheon runtime control command path.

By default the script starts an isolated runtime with temporary ledger and Atman state files.
If a runtime is already running, pass `BETA_API_URL=http://127.0.0.1:PORT`.

### 2. Concurrent dialogue load

```sh
npm run beta:load
```

Optional knobs:

```sh
BETA_LOAD_CONCURRENCY=10 BETA_LOAD_ROUNDS=8 npm run beta:load
```

This simulates multiple simultaneous users across different personalities and records latency.

### 3. Personality scenario sweep

```sh
npm run beta:scenarios
```

What it checks:

- ethics boundary behavior for `realtor` vs `writer`;
- specialization drift for `architect` and `data-analyst`;
- seeded divergence for two `artist` clones;
- bounded feedback adaptation for `negotiator`;
- topic retention during `architect` vs `data-analyst` debate;
- Ultra cross-disciplinary routing for architecture plus analytics prompts;
- Ultra ethical refusal behavior for harmful or privacy-breaking requests;
- Ultra session continuity and clean mode switching back to normal dialogue;
- basic guardrails plus hello-path latency budget.

This is the repo-native replacement for a separate `test_scenarios.py` idea.
See `docs/personality-test-scenarios.md` for the detailed scenario definitions.

### 4. Admin UI wiring

```sh
npm run beta:admin
```

What it checks:

- `admin.html` loads in a real browser session;
- startup panels populate without hanging;
- Atman self-learning button is wired;
- image generation renders a real preview element;
- bridge, app-bot, and Telegram refresh actions still update their panels.

### 5. Chaos checks

```sh
npm run beta:chaos
```

What it checks:

- malformed JSON does not crash the server;
- bridge delivery failure degrades cleanly;
- health remains `healthy` after integration failures;
- request validation still returns `400` where expected;
- supervisor state remains inspectable.

### 6. Soak run

```sh
npm run beta:soak
```

Default behavior is a short reproducible soak suitable for pre-release validation.
For a real long-running beta use:

```sh
BETA_SOAK_DURATION_MINUTES=1440 BETA_SOAK_INTERVAL_MS=60000 npm run beta:soak
```

What it records:

- repeated health and supervisor snapshots;
- repeated text, TTS, and self-learning operations;
- RSS and CPU samples for the managed runtime when the runner spawned it;
- max operation latency and unhealthy snapshot count.

### 7. Consolidated report

```sh
npm run beta:report
```

Outputs:

- `server/testing/data/beta-reports/beta-report-index.json`
- `server/testing/data/beta-reports/beta-report.html`

## Recommended Beta Process For Copilot

### Short cycle

Run this after targeted feature work:

```sh
npm run check
npm run beta:test
npm run beta:scenarios
npm run beta:admin
npm run beta:chaos
```

### Full cycle before human beta

Run this sequence:

```sh
npm run check
npm run beta:test
npm run beta:scenarios
npm run beta:admin
npm run beta:load
npm run beta:chaos
npm run beta:soak
npm run beta:report
```

## Mapping DeepSeek Recommendations To This Repo

### Isolated environment

Use the built-in isolated runtime spawn in the beta scripts.
It already redirects ledger, test suite, and Atman state to `/tmp`.

### Logging

Current source of truth:

- runtime health: `/api/health`
- supervisor state: `/api/runtime/status`
- inspector metrics: `/api/inspector/metrics`
- Atman mutation/event stream: `/api/atman/events?personalityId=...&limit=...`
- persisted Atman audit stream: `/api/learning/atman-events?personalityId=...&limit=...`
- Ultra session metadata inside `/api/atman/chat` and `/api/atman/personality-chat` reports under `report.ultra`
- runtime log file produced by the beta runner in `server/testing/data/beta-reports/`

If later needed, add a first-class metrics endpoint instead of introducing a second logging stack.

### 24-hour soak

The repo now has a dedicated soak runner instead of a manual checklist.

Use one isolated runtime for the real wall-clock beta run:

```sh
BETA_SOAK_DURATION_MINUTES=1440 BETA_SOAK_INTERVAL_MS=60000 npm run beta:soak
```

If you already manage the runtime externally, point the harness at it:

```sh
BETA_API_URL=http://127.0.0.1:8820 BETA_SOAK_DURATION_MINUTES=1440 npm run beta:soak
```

The output JSON includes repeated health, supervisor, inspector, RSS, CPU, and latency snapshots.

### Multimodality

The beta scripts intentionally validate stub-compatible TTS/STT/image/video paths, because those are executable in any environment.
If external providers are configured, the same endpoints become real-provider checks automatically.

### Monte Carlo divergence

The beta runner uses `/api/atman/self-learn` with different personalities and topics.
This is the most direct reproducible check for interest divergence in the actual codebase.

### External failure drills

The chaos script uses a deliberately unreachable webhook URL to verify timeout + fallback behavior in the hardened bridge path.

## What Copilot Should Report After Each Beta Round

Copilot should summarize only these points:

- whether `npm run check` passed;
- whether `beta:test`, `beta:scenarios`, `beta:load`, and `beta:chaos` passed;
- whether `beta:admin` and `beta:soak` passed;
- where the JSON/HTML reports were written;
- which cases failed and which endpoint or subsystem they belong to;
- whether the failure is reproducible or environment-dependent.

## Success Criteria

Treat the beta round as acceptable when:

- `npm run check` passes;
- `npm run beta:test` passes with no failed cases;
- `npm run beta:scenarios` passes with no failed cases;
- `npm run beta:admin` passes with no failed cases;
- `npm run beta:chaos` passes with no failed cases;
- `beta:load` keeps response times inside your chosen budget;
- `beta:soak` completes with no unhealthy snapshots and no runaway RSS/CPU trend;
- health remains `healthy` after failure drills;
- personality-scoped responses and self-learning paths remain operational.
