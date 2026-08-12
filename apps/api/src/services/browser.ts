import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

import { isAllowedMainNavigation, isBlockedBrowserUrl } from './browserPolicy.js';

let browserPromise: Promise<Browser> | undefined;

async function launchBrowser(): Promise<Browser> {
  const launch = chromium.launch({ headless: true, chromiumSandbox: true });
  browserPromise = launch;

  try {
    const browser = await launch;
    browser.on('disconnected', () => {
      if (browserPromise === launch) browserPromise = undefined;
    });
    return browser;
  } catch (error) {
    if (browserPromise === launch) browserPromise = undefined;
    throw error;
  }
}

async function getBrowser(): Promise<Browser> {
  const browser = await (browserPromise ?? launchBrowser());
  if (browser.isConnected()) return browser;
  browserPromise = undefined;
  return launchBrowser();
}

export async function createSearchPage(
  allowedNavigationHosts: readonly string[],
  locale = 'fr-FR',
): Promise<{ context: BrowserContext; page: Page }> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    locale,
    acceptDownloads: false,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();

    if (isBlockedBrowserUrl(url)) {
      await route.abort('blockedbyclient');
      return;
    }

    if (
      request.isNavigationRequest() &&
      request.frame() === page.mainFrame() &&
      !isAllowedMainNavigation(url, allowedNavigationHosts)
    ) {
      await route.abort('blockedbyclient');
      return;
    }

    const type = request.resourceType();
    if (type === 'font' || type === 'media' || type === 'image') {
      await route.abort('blockedbyclient');
      return;
    }

    await route.continue();
  });

  return { context, page };
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;

  const active = browserPromise;
  browserPromise = undefined;
  try {
    const browser = await active;
    if (browser.isConnected()) await browser.close();
  } catch {
    // Nothing to close after a failed launch.
  }
}
