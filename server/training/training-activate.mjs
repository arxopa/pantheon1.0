import {
  createProjectTrainingRegistry,
  parseCliArgs,
  printJson,
} from './training-cli-utils.mjs';

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const registry = await createProjectTrainingRegistry();
  if (!args.jobId) {
    throw new Error('--jobId is required for training:activate');
  }

  const authority = args.authority ?? 'Control Core / Shiva manual channel';

  if (args.approve !== 'false') {
    await registry.approveJob({
      jobId: args.jobId,
      approvedBy: authority,
      reason: args.reason ?? 'CLI approval before activation.',
    });
  }

  const result = await registry.activateJob({
    jobId: args.jobId,
    activatedBy: authority,
  });
  printJson(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
