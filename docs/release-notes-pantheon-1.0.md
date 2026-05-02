# Pantheon 1.0 Release Notes

Pantheon 1.0 is the first public baseline of the clustered runtime, operator control plane, Atman personality system, and guarded self-learning loop.

## Highlights

- Ultra mode routes one request through multiple specialists and returns a synthesized answer with contradiction handling and ethics validation.
- Admin UI now exposes an operator smoke flow for `!ultra` and `!normal`, plus recent Ultra sessions with selected experts and refusal reasons.
- Atman runtime includes multimodal stubs, social simulation, expert templates, and personality-specific progression.
- Deep self-learning uses ledger-backed state, validator pressure, and fallback evidence handling to avoid brittle failures when external findings are unavailable.

## Runtime Surface

- Vite + React control plane for architecture, runtime, learning, integrations, and operator diagnostics.
- Node.js agent runtime with HTTP APIs for Atman chat, Ultra sessions, media, learning state, validation, and integrations.
- Telegram and external bridge hooks for messaging-oriented deployments.

## Quality Gate

Validated before publication with:

- `npm run beta:admin`
- `npm run beta:test`
- `npm run beta:scenarios`
- `npm run check`

## Notes

- Repository URL: `https://github.com/arxopa/pantheon1.0`
- This release keeps generated runtime state out of the main change flow so operator/testing artifacts do not pollute the published source tree.
