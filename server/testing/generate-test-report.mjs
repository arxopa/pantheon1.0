import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeJsonReport, writeReportFile } from './beta-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportsRoot = path.join(__dirname, 'data', 'beta-reports');

function renderRow(columns) {
  return `<tr>${columns.map((value) => `<td>${String(value)}</td>`).join('')}</tr>`;
}

async function main() {
  const files = (await readdir(reportsRoot).catch(() => []))
    .filter((fileName) => fileName.endsWith('.json'))
    .sort();

  const entries = [];

  for (const fileName of files) {
    const raw = await readFile(path.join(reportsRoot, fileName), 'utf8');
    entries.push({
      fileName,
      payload: JSON.parse(raw),
    });
  }

  const summary = entries.map(({ fileName, payload }) => ({
    fileName,
    kind: payload.kind,
    createdAt: payload.createdAt,
    total:
      payload.summary?.total ??
      payload.summary?.totalCycles ??
      payload.summary?.totalRequests ??
      payload.results?.length ??
      0,
    passed: payload.summary?.passed ?? null,
    failed: payload.summary?.failed ?? null,
    passRate: payload.summary?.passRate ?? null,
    averageDurationMs:
      payload.summary?.averageDurationMs ??
      payload.summary?.averageOperationDurationMs ??
      payload.metrics?.averageCaseDurationMs ??
      null,
  }));

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Pantheon Beta Report</title>
  <style>
    body { font-family: Georgia, serif; margin: 32px; background: #f7f3ea; color: #1f2430; }
    h1, h2 { margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0 28px; background: #fffdf8; }
    th, td { border: 1px solid #d6c8ad; padding: 10px 12px; text-align: left; vertical-align: top; }
    th { background: #efe4cf; }
    code { background: #efe8da; padding: 2px 4px; }
  </style>
</head>
<body>
  <h1>Pantheon Beta Report</h1>
  <p>Сводка по JSON-отчетам из <code>server/testing/data/beta-reports</code>.</p>
  <table>
    <thead>
      <tr>
        <th>Файл</th>
        <th>Тип</th>
        <th>Создан</th>
        <th>Всего</th>
        <th>Passed</th>
        <th>Failed</th>
        <th>Pass rate</th>
        <th>Avg ms</th>
      </tr>
    </thead>
    <tbody>
      ${summary
        .map((entry) =>
          renderRow([
            entry.fileName,
            entry.kind,
            entry.createdAt,
            entry.total,
            entry.passed ?? 'n/a',
            entry.failed ?? 'n/a',
            entry.passRate ?? 'n/a',
            entry.averageDurationMs ?? 'n/a',
          ])
        )
        .join('')}
    </tbody>
  </table>
  <h2>Последние отчеты</h2>
  ${entries
    .slice(-3)
    .map(
      ({ fileName, payload }) => `
    <h3>${fileName}</h3>
    <pre>${JSON.stringify(payload.summary ?? payload.metrics ?? payload.results?.slice(0, 3) ?? {}, null, 2)}</pre>
  `
    )
    .join('')}
</body>
</html>
`;

  const jsonFile = await writeJsonReport('beta-report-index.json', {
    generatedAt: new Date().toISOString(),
    summary,
  });
  const htmlFile = await writeReportFile('beta-report.html', html);

  console.log(
    JSON.stringify({ jsonFile, htmlFile, reportCount: summary.length }, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
