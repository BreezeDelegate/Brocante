import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { chromium, devices, webkit } from 'playwright';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = 'http://127.0.0.1:4173';
const SVG_IMAGE = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="gray"/></svg>',
);
const INTERRUPTED_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" fill="gray"/%3E%3C/svg%3E';

async function eventually(check, message, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  if (lastError) throw lastError;
  throw new Error(message);
}

async function waitForServer() {
  await eventually(async () => {
    try {
      const response = await fetch(BASE_URL);
      return response.ok;
    } catch {
      return false;
    }
  }, 'Vite preview did not start', 20_000);
}

function startServer() {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const server = spawn(command, ['run', 'preview'], {
    cwd: WEB_ROOT,
    env: { ...process.env, CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`));
  server.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`));
  return server;
}

async function seedInterruptedScan(page) {
  await page.evaluate(async ({ image }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('brocante', 1);
      request.addEventListener('upgradeneeded', () => {
        if (!request.result.objectStoreNames.contains('scans')) {
          request.result.createObjectStore('scans', { keyPath: 'id' });
        }
      });
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error));
    });

    await new Promise((resolve, reject) => {
      const transaction = database.transaction('scans', 'readwrite');
      transaction.objectStore('scans').put({
        id: 'interrupted-scan',
        image,
        label: 'objet repris',
        status: 'processing',
        createdAt: Date.now(),
        listings: [],
      });
      transaction.addEventListener('complete', () => resolve());
      transaction.addEventListener('error', () => reject(transaction.error));
    });
    database.close();
  }, { image: INTERRUPTED_IMAGE });
}

function marketplaceResult(query) {
  const price = query === 'objet faible' ? 1 : 12;
  return {
    listings: [
      {
        id: `listing-${query}`,
        provider: 'vinted',
        title: query,
        price,
        currency: 'EUR',
        url: 'https://www.vinted.fr/items/123',
      },
    ],
    errors: [],
  };
}

async function installApiMock(page) {
  await page.route('**/api/search', async (route) => {
    const body = route.request().postDataJSON();
    const query = typeof body?.query === 'string' ? body.query : 'objet fort';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(marketplaceResult(query)),
    });
  });
  await page.route('**/api/identify', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ label: '' }),
    }),
  );
}

async function testBatchAndFilter(page) {
  await installApiMock(page);
  await page.goto(BASE_URL);
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'objet-a.svg', mimeType: 'image/svg+xml', buffer: SVG_IMAGE },
    { name: 'objet-b.svg', mimeType: 'image/svg+xml', buffer: SVG_IMAGE },
  ]);

  const cards = page.locator('.card');
  await eventually(async () => (await cards.count()) === 2, 'Two imported objects were not rendered');
  await cards.nth(0).locator('input').fill('objet faible');
  await cards.nth(1).locator('input').fill('objet fort');

  await page.locator('.hero').getByRole('button', { name: 'Analyser', exact: true }).click();
  await eventually(
    async () => (await page.locator('.toolbar').textContent())?.includes('1/2 objets') ?? false,
    'Minimum-value filter did not hide the low-value result',
    20_000,
  );
  assert.equal(await page.locator('.card').count(), 1);
  assert.match((await page.locator('.card').textContent()) ?? '', /12 €/);

  await page.locator('.chip').click();
  await eventually(async () => (await page.locator('.card').count()) === 2, 'Filter toggle did not restore both objects');
}

async function testInterruptedRecovery(page) {
  await installApiMock(page);
  await page.goto(BASE_URL);
  await seedInterruptedScan(page);
  await page.reload();

  const interrupted = page.getByText('Analyse interrompue. Relance-la pour reprendre.', {
    exact: true,
  });
  await interrupted.waitFor({ state: 'visible', timeout: 10_000 });

  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await eventually(
    async () => ((await page.locator('.card').textContent()) ?? '').includes('12 €'),
    'Recovered scan did not complete after retry',
    20_000,
  );

  await page.reload();
  await eventually(
    async () => ((await page.locator('.card').textContent()) ?? '').includes('12 €'),
    'Completed recovery was not persisted across reload',
  );
  assert.equal(await page.getByText('Analyse interrompue. Relance-la pour reprendre.').count(), 0);
}

function mobileContextOptions(deviceName) {
  const descriptor = devices[deviceName];
  return {
    userAgent: descriptor.userAgent,
    viewport: descriptor.viewport,
    screen: descriptor.screen,
    deviceScaleFactor: descriptor.deviceScaleFactor,
    isMobile: descriptor.isMobile,
    hasTouch: descriptor.hasTouch,
  };
}

async function runProfile(name, browserType, deviceName) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    ...mobileContextOptions(deviceName),
    locale: 'fr-FR',
    serviceWorkers: 'block',
  });

  try {
    console.log(`\n[e2e] ${name}: batch + filter`);
    const batchPage = await context.newPage();
    await testBatchAndFilter(batchPage);
    await batchPage.close();

    await context.clearCookies();
    const recoveryPage = await context.newPage();
    await recoveryPage.goto(BASE_URL);
    await recoveryPage.evaluate(async () => {
      localStorage.clear();
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase('brocante');
        request.addEventListener('success', () => resolve());
        request.addEventListener('blocked', () => resolve());
        request.addEventListener('error', () => reject(request.error));
      });
    });
    await recoveryPage.reload();

    console.log(`[e2e] ${name}: interrupted recovery`);
    await testInterruptedRecovery(recoveryPage);
    await recoveryPage.close();
    console.log(`[e2e] ${name}: OK`);
  } finally {
    await context.close();
    await browser.close();
  }
}

const server = startServer();
try {
  await waitForServer();
  await runProfile('Mobile Chromium / Pixel 5', chromium, 'Pixel 5');
  await runProfile('Mobile WebKit / iPhone 12', webkit, 'iPhone 12');
  console.log('\n[e2e] all mobile profiles passed');
} finally {
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    delay(3_000),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}
