import { config } from '../config.js';
import { createSearchPage } from '../services/browser.js';
import { SerialGate } from '../services/rateLimiter.js';
import type { Provider } from '../types.js';
import { listingRows, type MarketplaceRow } from './utils.js';

const gate = new SerialGate(config.LEBONCOIN_GAP_MS, config.PROVIDER_MAX_QUEUE);

export const leboncoin: Provider = {
  id: 'leboncoin',
  async search(query) {
    return gate.run(async () => {
      const { context, page } = await createSearchPage(['www.leboncoin.fr', 'leboncoin.fr']);

      try {
        const url = `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(query)}&sort=price&order=asc`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
        await page.waitForTimeout(1_200);

        const rows = await page.locator('a[href*="/ad/"]').evaluateAll((elements) =>
          elements.slice(0, 40).map((element) => {
            const anchor = element as HTMLAnchorElement;
            return {
              href: anchor.href,
              text: (anchor.innerText || anchor.textContent || '').trim(),
            };
          }),
        );

        return listingRows(rows as MarketplaceRow[], {
          provider: 'leboncoin',
          hostname: 'www.leboncoin.fr',
          fallbackTitle: 'Annonce Leboncoin',
        });
      } finally {
        await context.close();
      }
    });
  },
};
