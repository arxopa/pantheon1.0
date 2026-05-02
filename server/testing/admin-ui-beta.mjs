import { chromium } from 'playwright';

import {
  startManagedRuntime,
  summarizeCases,
  withMeasuredCase,
  writeJsonReport,
} from './beta-utils.mjs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForPreText(page, selector, expected) {
  await page.waitForFunction(
    ({ targetSelector, value }) => {
      const node = document.querySelector(targetSelector);
      return node && node.textContent && node.textContent.includes(value);
    },
    { targetSelector: selector, value: expected }
  );
}

async function main() {
  const runtime = await startManagedRuntime({
    baseUrl: process.env.BETA_API_URL,
    spawnRuntime: !process.env.BETA_API_URL,
    port: process.env.BETA_TEST_PORT ?? 8823,
  });
  const report = {
    kind: 'pantheon-admin-ui-beta-test',
    createdAt: new Date().toISOString(),
    baseUrl: runtime.baseUrl,
    runtime: {
      port: runtime.port,
      tag: runtime.tag,
      logFilePath: runtime.logFilePath,
      pid: runtime.pid ?? null,
    },
    cases: [],
  };
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${runtime.baseUrl}/admin.html`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await withMeasuredCase(report, 'admin-ui', 'page-load', async () => {
      await page.waitForSelector('h1');
      const title = await page.textContent('h1');
      assert(
        /Администрирование системы/i.test(title ?? ''),
        'Admin page title is missing'
      );
      return { title };
    });

    await withMeasuredCase(report, 'admin-ui', 'startup-panels', async () => {
      await waitForPreText(page, '#bridgeStatusOutput', 'requestTimeoutMs');
      await waitForPreText(page, '#telegramStatusOutput', 'requestTimeoutMs');
      await waitForPreText(page, '#atmanStatusOutput', '"personality"');
      return {
        bridgeLoaded: true,
        telegramLoaded: true,
        atmanLoaded: true,
      };
    });

    await withMeasuredCase(
      report,
      'admin-ui',
      'atman-checkpoint-button',
      async () => {
        await page.click('button:has-text("Create checkpoint")');
        await waitForPreText(page, '#atmanCheckpointOutput', 'checkpoint');
        const output = await page.textContent('#atmanCheckpointOutput');
        return {
          output,
        };
      }
    );

    await withMeasuredCase(
      report,
      'admin-ui',
      'media-generate-image',
      async () => {
        await page.fill(
          '#atmanMediaPrompt',
          'сад характеров под звездным небом'
        );
        await page.click('button:has-text("Generate image")');
        await waitForPreText(page, '#atmanMediaOutput', 'mimeType');
        await page.waitForFunction(() => {
          const artifact = window.__lastAtmanArtifact;
          return (
            artifact &&
            typeof artifact.mimeType === 'string' &&
            artifact.mimeType.startsWith('image/')
          );
        });
        const output = await page.textContent('#atmanMediaOutput');
        return {
          output,
        };
      }
    );

    await withMeasuredCase(
      report,
      'admin-ui',
      'refresh-bots-and-status',
      async () => {
        await page.click('button:has-text("Refresh bots")');
        await page.click('button:has-text("Refresh bridge")');
        await page.click('button:has-text("Refresh Telegram")');
        await waitForPreText(page, '#bridgeStatusOutput', 'deliveryCircuit');
        await waitForPreText(
          page,
          '#telegramStatusOutput',
          'pollTimeoutSeconds'
        );
        return {
          bridge: await page.textContent('#bridgeStatusOutput'),
          telegram: await page.textContent('#telegramStatusOutput'),
        };
      }
    );

    report.summary = summarizeCases(report.cases);
    const reportFile = await writeJsonReport(
      `beta-admin-${runtime.tag}.json`,
      report
    );
    console.log(
      JSON.stringify({ summary: report.summary, reportFile }, null, 2)
    );

    if (report.summary.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    await runtime.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
