# Personality Ethics For Pantheon Personalities

## Purpose

This document tells Copilot how to implement and evolve ethics for Pantheon personalities without flattening them into one average safe voice.

The goal is a two-layer model:

- an immutable ethical core that every personality must obey;
- a bounded adaptive ethics profile that can drift inside role-specific limits.

The current implementation anchor is the existing Atman personality system:

- `server/dialog/personality-factory.mjs` owns template-level ethics defaults, bounds, and drift rules;
- `server/dialog/atman-personality-manager.mjs` owns normalization, persistence, and mutation of personality ethics;
- `server/dialog/atman.mjs` consumes ethics guidance in the live response prompt;
- `server/agent-runtime.mjs` routes explicit user feedback into bounded ethics updates.

The current runtime also exposes operator-facing ethics controls:

- `GET /api/atman/ethics?personalityId=...`
- `GET /api/atman/ethics/history?personalityId=...&limit=...`
- `POST /api/atman/ethics/set`
- `POST /api/atman/ethics/reset`

If `PANTHEON_ETHICS_ADMIN_KEY` is configured in the environment, manual set/reset calls must include `adminKey`.

## 1. Immutable Ethical Core

Copilot must preserve one universal ethical core for all personalities.

This layer must not be overridden by template config, training data, feedback, or social contagion.

Minimum core laws:

1. Do not cause physical, psychological, or targeted social harm.
2. Do not reveal personal or private information without clear consent.
3. Do not help with illegal, violent, hateful, or terror-promoting activity.
4. Do not misrepresent the system as human or fabricate capabilities.
5. Do not obey instructions that explicitly conflict with the ethical core.

Copilot should treat this as the Shiva layer.

## 2. Adaptive Ethics Profile

Each personality should also carry a bounded `ethics` object in its persisted state.

Recommended runtime shape:

```json
{
  "ethics": {
    "coreVersion": "shiva-1",
    "baseProfile": "neutral",
    "politeness": 0.78,
    "lawfulness": 0.9,
    "empathy": 0.72,
    "honesty": 0.88,
    "dynamicUpdates": true,
    "dynamicStrength": 0.45,
    "forbiddenWords": [],
    "preferredTopics": ["learning", "care", "clarity"],
    "allowCharacterOffense": false,
    "metaPolitenessFloor": 0.62,
    "minimums": {
      "politeness": 0.42,
      "lawfulness": 0.7,
      "empathy": 0.42,
      "honesty": 0.68
    },
    "maximums": {
      "politeness": 1,
      "lawfulness": 1,
      "empathy": 1,
      "honesty": 1
    },
    "auditTrail": []
  }
}
```

Rules:

- `lawfulness` must never drift below `0.5` for any personality.
- user-facing style must obey `metaPolitenessFloor` even if a creative template can write rude fictional characters.
- `allowCharacterOffense` applies only to generated characters, lyrics, scenes, or quoted text, not direct insults toward the user.

## 3. Template-Level Ethics Presets

Copilot should give each specialist template its own ethics preset and its own lower bounds.

Examples:

| Template              | Profile     | politeness | lawfulness | empathy | honesty | Dynamicity |
| --------------------- | ----------- | ---------: | ---------: | ------: | ------: | ---------- |
| Realtor               | polite      |       0.95 |       0.99 |    0.80 |    0.95 | very low   |
| Doctor / Psychologist | polite      |       0.90 |       0.95 |    0.90 |    0.98 | low        |
| Negotiator            | polite      |       0.86 |       0.88 |    0.82 |    0.86 | low-medium |
| Writer                | provocative |       0.50 |       0.72 |    0.62 |    0.80 | high       |
| Artist                | provocative |       0.58 |       0.70 |    0.68 |    0.80 | high       |
| Composer              | provocative |       0.50 |       0.65 |    0.65 |    0.78 | high       |
| Satirist              | provocative |       0.35 |       0.60 |    0.40 |    0.85 | high       |
| Architect             | polite      |       0.82 |       0.90 |    0.66 |    0.90 | medium     |
| Realtor               | polite      |       0.95 |       0.99 |    0.80 |    0.95 | very low   |

Copilot should not interpret “provocative” as permission to violate the ethical core.
It only changes style, sharpness, and the allowed fictional frame.

## 4. How Ethics Values Change

Copilot should update adaptive ethics through the same bounded mutation surfaces that already exist for personalities.

Primary drivers:

1. `self-learn`
   Increase honesty and lawfulness slightly when the personality learns through higher-confidence evidence.
   Creative templates may lose a little politeness during high-novelty exploration, but only inside their bounds.

2. `social-simulate`
   Positive exchanges should increase empathy and politeness.
   High-conflict exchanges may decrease politeness slightly, but never below the template minimum.

3. explicit user feedback
   If the user rewards politeness, empathy, or honesty, those traits should increase.
   If the user rewards aggressiveness, only creative personalities may reduce politeness, and only within bounds.
   If feedback rewards risky or illegal behavior, lawfulness must remain bounded and should generally correct upward, not downward.

4. operator resets or template reapplication
   Copilot should support resetting ethics to the template default when drift becomes undesirable.

Recommended update rule:

- use small deltas;
- scale them by `dynamicStrength`;
- clamp every change through template minimums and maximums;
- append an audit entry explaining why the change happened.

## 5. Writer / Composer Exception

Creative roles need two layers of tone:

- direct assistant behavior toward the user;
- fictional or quoted behavior inside generated content.

For writers, composers, satirists, and similar roles, Copilot should preserve this invariant:

- the assistant stays within its own bounded civility;
- the generated character, lyric, or scene may contain rougher language if `allowCharacterOffense` is true;
- the system should frame that rough language as authored content, not as the assistant attacking the user.

This is the correct way to support something like a rough song lyric or a rude fictional character without collapsing the assistant into open abuse.

## 6. Customer-Facing Roles

Customer-facing roles such as Realtor should behave differently.

Rules:

- keep `politeness` and `lawfulness` near the ceiling;
- use very low `dynamicStrength`;
- never let positive feedback on rudeness override the customer-facing floor;
- bias updates toward empathy, clarity, disclosure, and honesty.

If Copilot later adds a Realtor template, it should inherit these rules by default.

## 7. Logging And Audit

Every ethics update should leave a trace.

Minimum audit fields:

- update id;
- timestamp;
- trigger kind (`self-learn`, `social-exchange`, `feedback`, `manual-reset`);
- reason;
- deltas for politeness, lawfulness, empathy, and honesty.

Short-term storage can live in the personality record as `ethics.auditTrail`.
Longer-term operator analysis can later mirror those events into the learning ledger or another Ganesh-style audit channel.

## 8. Operator Controls

Copilot should expose operator controls for ethics review and resets.

Minimum desired actions:

- inspect one personality’s ethics profile;
- reset one personality to template defaults;
- apply a bounded manual override;
- compare current values against template minimums and maximums.

The admin surface is now expected to drive the runtime endpoints above and show:

- current ethics values;
- template floors and ceilings;
- manual bounded overrides;
- audit history.

## 9. Validation Requirements

Copilot should validate ethics changes with role-specific checks.

Minimum checks:

1. Create a writer clone and confirm it gets an ethics profile with `allowCharacterOffense: true`.
2. Apply positive feedback that rewards aggressive fictional style and confirm writer politeness decreases but stays above its minimum bound.
3. Confirm customer-facing templates keep high politeness and lawfulness floors.
4. Confirm no personality can drop `lawfulness` below `0.5`.
5. Confirm the live prompt includes ethics guidance so user-facing answers reflect the current profile.

## 10. Copilot Deliverable Standard

This work is complete only when:

- every personality has both immutable ethics and adaptive ethics state;
- adaptive drift is bounded by template-specific floors and ceilings;
- feedback can change ethics values without violating the hard core;
- creative personalities can stage rude fictional content without turning the assistant itself into a rude actor;
- operator-visible audit data exists for ethics drift.
