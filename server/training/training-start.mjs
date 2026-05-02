import {
  createProjectTrainingRegistry,
  parseCliArgs,
  printJson,
} from './training-cli-utils.mjs';

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const registry = await createProjectTrainingRegistry();
  const result = await registry.startJob({
    jobId: args.jobId ?? null,
    personalityId: args.personality ?? args.personalityId ?? 'default',
    operatorNote: args.note ?? null,
  });
  printJson(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
