import {
  createProjectTrainingRegistry,
  parseCliArgs,
  printJson,
} from './training-cli-utils.mjs';

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const registry = await createProjectTrainingRegistry();
  const result = await registry.prepareDataset({
    personalityId: args.personality ?? args.personalityId ?? 'default',
    operatorNote: args.note ?? null,
    sourceType: args.sourceType ?? 'manual',
    tags: args.tags
      ? String(args.tags)
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [],
  });
  printJson(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
