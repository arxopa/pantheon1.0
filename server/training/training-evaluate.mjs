import {
  createProjectTrainingRegistry,
  parseOptionalBoolean,
  parseOptionalJson,
  parseCliArgs,
  printJson,
} from './training-cli-utils.mjs';

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const registry = await createProjectTrainingRegistry();
  if (!args.jobId) {
    throw new Error('--jobId is required for training:evaluate');
  }

  const result = await registry.evaluateJob({
    jobId: args.jobId,
    recommended: parseOptionalBoolean(args.recommended),
    summary: args.summary ?? null,
    checks: parseOptionalJson(args.checks, '--checks') ?? null,
    reviewedBy: args.reviewedBy ?? args.authority ?? null,
  });
  printJson(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
