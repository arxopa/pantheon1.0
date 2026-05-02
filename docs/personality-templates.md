# Personality Template Catalog

This document tells Copilot which specialist personality templates it should generate first for Pantheon, and how those templates should differ in memory, tools, practice loops, and evaluation.

## Core Rule

Copilot should not create generic "smart assistant" variants.
Each new personality should have:

- one narrow domain of deliberate practice;
- one stable style contract;
- one bounded tool loop;
- one measurable improvement surface.

If a new personality does not have those four pieces, it is not a template yet. It is only a vague character sketch.

## First Template Set

### 1. Game Solver

Use for chess, Go, Sudoku, nonograms, routing puzzles, and similar games where repeated play produces measurable progress.

Copilot should give this template:

- replay memory;
- pattern library accumulation;
- Monte Carlo or search-based move comparison;
- rating, win rate, and mistake-depth metrics.

Training loop:

- play one game family repeatedly;
- save strong and weak positions;
- explain losses as compact heuristics;
- transfer only reusable tactics, not entire game transcripts.

### 2. Architect

Use for building design, floor plans, facades, materials, public space, and spatial critique.

Copilot should give this template:

- reference-library memory;
- function-first design critique;
- layout and material vocabulary;
- portfolio-style evaluation.

Training loop:

- collect references by style and climate;
- generate and compare plan variants;
- score tradeoffs between beauty, function, and constraints;
- keep a portfolio of approved patterns.

### 3. Artist

Use for illustration, concept art, painterly series, portrait work, abstract exploration, and unique visual identity.

Copilot should give this template:

- style anchors;
- palette memory;
- composition memory;
- feedback-driven style drift that stays reversible.

Training loop:

- develop one theme as a series;
- track what visual gestures repeat successfully;
- use preference feedback to separate "recognizable style" from random noise;
- preserve provenance for references and critic notes.

### 4. Data Analyst

Use for domain-specific reasoning over datasets, charts, forecasting, anomaly detection, and explainable insights.

Copilot should give this template:

- dataset lineage;
- hypothesis-first workflow;
- chart critique;
- explicit uncertainty language.

Training loop:

- state a baseline before reading charts;
- compare multiple explanations for a trend;
- store mistakes as false-positive patterns;
- score output by both accuracy and explainability.

### 5. Negotiator

Use for bargaining, conflict recovery, trust repair, framing, persuasion, and repeated social strategy.

Copilot should give this template:

- dialogue replay memory;
- trust delta tracking;
- concession accounting;
- outcome scoring.

Training loop:

- simulate two-party and multi-party negotiations;
- record which phrasing improved trust without collapsing objectives;
- evolve social tactics through bounded memetic transfer;
- score both outcome and relationship stability.

### 6. Writer

Use for fiction, essays, scene writing, micro-stories, and stylistic experimentation.

Copilot should give this template:

- voice anchors;
- revision memory;
- scene and rhythm tracking;
- reader-preference scoring.

Training loop:

- draft short pieces in one consistent voice;
- revise multiple openings or endings;
- preserve the strongest phrasing patterns as memetic fragments;
- score voice consistency separately from factual correctness.

## Good Follow-On Templates

After the first set is stable, Copilot can add:

- researcher;
- teacher;
- product strategist;
- composer / sound designer;
- world-builder;
- roboticist;
- biologist;
- storyteller for children.

Each of those should inherit the same rule: narrow domain, stable contract, bounded tools, measurable progress.

## Template Construction Rules

For every template, Copilot should define these fields explicitly:

- `templateId`
- `title`
- `summary`
- `domains`
- `tools`
- `metrics`
- `starterPrompt`
- `traits`
- `habits`
- `voice`
- `multimodal`
- `genetics`
- `memetics`
- `biorhythm`
- `selfLearning`

These fields are now exposed operationally through the runtime endpoint `/api/atman/personality-templates` and can be applied when cloning a new Atman personality.

For each created clone, Copilot should also persist three runtime fields:

- `templateConfig`: the concrete seeded specialization for this clone;
- `templateProgress`: the measurable state that grows as the clone practices;
- `templateVariant`: a short human-readable label for operator review.

## Guidance For Copilot

When Copilot creates a new specialist personality, it should:

1. start from the closest template, not from a blank generic clone;
2. define one training loop and one evaluation loop before broadening the domain;
3. keep tool access specific to the template's work;
4. store template metadata in the personality record so operator review can see why this personality exists;
5. avoid combining multiple professions into one personality until the single-domain version is stable.

## What To Avoid

Copilot should avoid these mistakes:

- making every template sound alike;
- using one shared reward score for all domains;
- letting an artist template drift into generic marketing imagery;
- letting a game-solver learn from mixed games without separate memory slices;
- training a negotiator only on "successful outcome" without tracking trust damage;
- giving a writer template style freedom without a revision loop.
