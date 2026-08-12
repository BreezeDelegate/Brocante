import { config } from '../config.js';
import { createSearchPage } from '../services/browser.js';
import { SerialGate } from '../services/rateLimiter.js';
import type { Listing, Provider } from '../types.js';
import { safeMarketplaceUrl } from './utils.js';

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
          elements.slice(0, 32).map((element) => {
            const anchor = element as HTMLAnchorElement;
            const text = (anchor.innerText || anchor.textContent || '').trim();
            const priceMatch = text.match(/(\d+[,.]?\d*)\s*€/);
            return {
              href: anchor.href,
              title: (text.split('\n')[0] || 'Annonce Vinted').slice(0, 120),
              price: priceMatch?.[1] ? Number(priceMatch[1].replace(',', '.')) : Number.NaN,
            };
          }),
        );

        const listings: Listing[] = [];
        for (const [index, row] of rows.entries()) {
          const itemUrl = safeMarketplaceUrl(row.href, 'www.vinted.fr');
          if (!itemUrl || !Number.isFinite(row.price) || row.price <= 0) continue;

          listings.push({
            id: `vinted-${index}-${itemUrl}`,
            provider: 'vinted',
            title: row.title,
            price: row.price,
            currency: 'EUR',
            url: itemUrl,
          });
          if (listings.length >= 24) break;
        }

        return listings;
      } finally {
        await context.close();
      }
    });
  },
};
