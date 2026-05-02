import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function toJsonl(records = []) {
  return `${records.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
}

export async function exportTrainingDataset(records = [], options = {}) {
  const baseDir = options.baseDir;
  const personalityId = options.personalityId;
  const datasetVersion = options.datasetVersion;

  if (!baseDir || !personalityId || !datasetVersion) {
    throw new Error(
      'baseDir, personalityId, and datasetVersion are required to export a training dataset.'
    );
  }

  const personalityDir = path.join(baseDir, personalityId);
  await mkdir(personalityDir, { recursive: true });
  const filePath = path.join(personalityDir, `${datasetVersion}.jsonl`);
  await writeFile(filePath, toJsonl(records), 'utf8');
  return filePath;
}
