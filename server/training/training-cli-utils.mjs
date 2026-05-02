import { Atman } from '../dialog/atman.mjs';
import { AtmanPersonalityManager } from '../dialog/atman-personality-manager.mjs';

import { TrainingRegistry } from './training-registry.mjs';

function normalizeFlagName(name) {
  return String(name ?? '')
    .replace(/^--/, '')
    .trim();
}

export function parseCliArgs(argv = []) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith('--')) {
      continue;
    }

    const key = normalizeFlagName(part);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

export async function createProjectTrainingRegistry() {
  const atman = new Atman();
  await atman.init();
  const personalityManager = new AtmanPersonalityManager({
    baseAtman: atman,
  });
  await personalityManager.init();
  const registry = new TrainingRegistry({
    personalityManager,
  });
  await registry.init();
  return registry;
}

export function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

export function parseOptionalBoolean(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`Cannot parse boolean value: ${value}`);
}

export function parseOptionalJson(value, label = 'JSON payload') {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  try {
    return JSON.parse(String(value));
  } catch (error) {
    throw new Error(
      `${label} must be valid JSON: ${
        error instanceof Error ? error.message : 'unknown parse error'
      }`
    );
  }
}
