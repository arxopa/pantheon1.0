# Contributing

## Local baseline

Use these commands before opening a PR:

```sh
npm run format
npm run typecheck
npm run build
```

For the combined read-only gate, run:

```sh
npm run check
```

## Pre-commit hook

Enable the repository hook path once per clone:

```sh
git config core.hooksPath .githooks
```

The hook blocks commits if formatting, typecheck, or build fail.

## Runtime hardening rules

- New recurring background work must be registered through the runtime supervisor instead of raw `setInterval`.
- External network calls must use explicit timeouts.
- Critical recovery paths must expose status through `/api/health`.
- Rollback-aware changes must preserve `rishi` checkpoints and resonance state.

## Naming and layout

- Put reusable runtime safety helpers under `server/core/`.
- Keep integration-specific resilience inside the owning integration module.
- Prefer explicit `*Status`, `*Report`, `*State` names for inspectable payloads.

## PR expectations

- Describe the failure mode or regression being addressed.
- List validation steps you ran.
- Mention any new environment variables, health endpoints, or rollback paths.
