import { config } from '../config.js';
import { createSearchPage } from '../services/browser.js';
import { SerialGate } from '../services/rateLimiter.js';
import type { Provider } from '../types.js';
import { listingRows, type MarketplaceRow } from './utils.js';

const gate = new SerialGate(config.VINTED_GAP_MS, config.PROVIDER_MAX_QUEUE);

export const vinted: Provider = {
  id: 'vinted',
  async search(query) {
    return gate.run(async () => {
      const { context, page } = await createSearchPage(['www.vinted.fr', 'vinted.fr']);

      try {
        const url = `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(query)}&order=price_low_to_high`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
        await page.waitForTimeout(1_200);

        const rows = await page.locator('a[href*="/items/"]').evaluateAll((elements) =>
          elements.slice(0, 40).map((element) => {
            const anchor = element as HTMLAnchorElement;
            return {
              href: anchor.href,
              text: (anchor.innerText || anchor.textContent || '').trim(),
            };
          }),
        );

        return listingRows(rows as MarketplaceRow[], {
          provider: 'vinted',
          hostname: 'www.vinted.fr',
          fallbackTitle: 'Annonce Vinted',
        });
      } finally {
        await context.close();
      }
    });
  },
};
