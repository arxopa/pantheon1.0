import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const docsRoot = path.join(repoRoot, 'docs');
const forDeepSeekPath = path.join(docsRoot, 'fordeepseek.md');
const lastChangesPath = path.join(docsRoot, 'lastchanges.md');

function parseArgs(argv) {
  const options = {
    dryRun: false,
    source: null,
    title: null,
    date: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (value === '--source') {
      options.source = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (value === '--title') {
      options.title = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (value === '--date') {
      options.date = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
  }

  return options;
}

function getUsage() {
  return [
    'Usage: npm run report:deepseek -- --source <file> [--title <title>] [--date <YYYY-MM-DD>] [--dry-run]',
    '',
    'Behavior:',
    '1. Reads docs/lastchanges.md as the previous snapshot.',
    '2. Appends that snapshot to docs/fordeepseek.md as the next history entry.',
    '3. Replaces docs/lastchanges.md with the markdown file passed in --source.',
  ].join('\n');
}

function normalizeMarkdown(value) {
  return value.replace(/\r\n/g, '\n').trim();
}

function stripTopHeading(markdown) {
  return markdown.replace(/^# .*\n+/, '').trim();
}

function shiftHeadings(markdown, levelShift) {
  return markdown.replace(/^(#{1,6})(\s+)/gm, (_, hashes, spacing) => {
    const nextLevel = Math.min(hashes.length + levelShift, 6);
    return `${'#'.repeat(nextLevel)}${spacing}`;
  });
}

function getNextHistoryEntryNumber(markdown) {
  const matches = [...markdown.matchAll(/^## History Entry (\d+):/gm)];

  if (matches.length === 0) {
    return 1;
  }

  return Number(matches.at(-1)[1]) + 1;
}

function buildArchiveEntry(forDeepSeek, previousLastChanges, title, date) {
  const entryNumber = getNextHistoryEntryNumber(forDeepSeek);
  const archiveDate = date ?? new Date().toISOString().slice(0, 10);
  const archiveTitle = title ?? `Archived Last Changes Snapshot ${archiveDate}`;
  const archivedBody = shiftHeadings(stripTopHeading(previousLastChanges), 1);

  return [
    '',
    `## History Entry ${entryNumber}: ${archiveTitle}`,
    '',
    '### Source',
    '',
    `Archived automatically from \`docs/lastchanges.md\` on ${archiveDate}.`,
    '',
    archivedBody,
    '',
  ].join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.source) {
    console.error(getUsage());
    process.exitCode = 1;
    return;
  }

  const [forDeepSeekRaw, currentLastChangesRaw, nextLastChangesRaw] =
    await Promise.all([
      readFile(forDeepSeekPath, 'utf8'),
      readFile(lastChangesPath, 'utf8'),
      readFile(path.resolve(repoRoot, options.source), 'utf8'),
    ]);

  const forDeepSeek = normalizeMarkdown(forDeepSeekRaw);
  const currentLastChanges = normalizeMarkdown(currentLastChangesRaw);
  const nextLastChanges = normalizeMarkdown(nextLastChangesRaw);

  if (!nextLastChanges.startsWith('# ')) {
    throw new Error(
      'The --source file must be markdown with a top-level heading.'
    );
  }

  if (currentLastChanges === nextLastChanges) {
    console.log(
      'No rollover needed: docs/lastchanges.md already matches the provided source file.'
    );
    return;
  }

  const archiveEntry = buildArchiveEntry(
    forDeepSeek,
    currentLastChanges,
    options.title,
    options.date
  );
  const nextForDeepSeek = `${forDeepSeek}\n${archiveEntry}`;
  const nextLastChangesWithTrailingNewline = `${nextLastChanges}\n`;
  const nextForDeepSeekWithTrailingNewline = `${nextForDeepSeek.trim()}\n`;

  if (options.dryRun) {
    console.log('Dry run successful.');
    console.log(
      `Next history entry: ${getNextHistoryEntryNumber(forDeepSeek)}`
    );
    console.log(
      `Archive title: ${options.title ?? `Archived Last Changes Snapshot ${options.date ?? new Date().toISOString().slice(0, 10)}`}`
    );
    return;
  }

  await Promise.all([
    writeFile(forDeepSeekPath, nextForDeepSeekWithTrailingNewline, 'utf8'),
    writeFile(lastChangesPath, nextLastChangesWithTrailingNewline, 'utf8'),
  ]);

  console.log(
    `Archived previous docs/lastchanges.md into docs/fordeepseek.md as history entry ${getNextHistoryEntryNumber(forDeepSeek)}.`
  );
  console.log('Replaced docs/lastchanges.md with the provided source file.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
