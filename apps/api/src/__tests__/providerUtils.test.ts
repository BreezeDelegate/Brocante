import { describe, expect, it } from 'vitest';

import {
  listingRows,
  listingTitle,
  parseEuroPrice,
  safeMarketplaceUrl,
} from '../providers/utils.js';

describe('provider utilities', () => {
  it('accepts exact HTTPS marketplace hosts and rejects lookalikes', () => {
    expect(safeMarketplaceUrl('https://www.vinted.fr/items/123', 'www.vinted.fr')).toBe(
      'https://www.vinted.fr/items/123',
    );
    expect(
      safeMarketplaceUrl('https://www.vinted.fr.evil.test/items/123', 'www.vinted.fr'),
    ).toBeUndefined();
    expect(safeMarketplaceUrl('http://www.vinted.fr/items/123', 'www.vinted.fr')).toBeUndefined();
  });

  it.each([
    ['12 €', 12],
    ['12,50 €', 12.5],
    ['12.50 €', 12.5],
    ['1 200 €', 1200],
    ['1\u00a0200 €', 1200],
    ['1\u202f200,50 €', 1200.5],
    ['1.200,50 €', 1200.5],
  ])('parses French marketplace price %s', (text, expected) => {
    expect(parseEuroPrice(text)).toBe(expected);
  });

  it('rejects absent, zero and malformed euro prices', () => {
    expect(parseEuroPrice('Prix sur demande')).toBeUndefined();
    expect(parseEuroPrice('0 €')).toBeUndefined();
    expect(parseEuroPrice('12,345 €')).toBeUndefined();
  });

  it('keeps a meaningful title when price text is on its own line', () => {
    expect(listingTitle('1 200 €\nConsole rétro\nTrès bon état', 'Annonce')).toBe('Console rétro');
    expect(listingTitle('Console rétro\n1 200 €', 'Annonce')).toBe('Console rétro');
  });

  it('validates, deduplicates and caps raw marketplace rows', () => {
    const rows = [
      { href: 'https://www.vinted.fr/items/1', text: 'Console A\n10 €' },
      { href: 'https://www.vinted.fr/items/1', text: 'Duplicate\n10 €' },
      { href: 'https://evil.test/items/2', text: 'Unsafe\n8 €' },
      { href: 'https://www.vinted.fr/items/3', text: 'Console B\n12,50 €' },
    ];

    expect(
      listingRows(rows, {
        provider: 'vinted',
        hostname: 'www.vinted.fr',
        fallbackTitle: 'Annonce Vinted',
        max: 2,
      }),
    ).toEqual([
      {
        id: 'vinted-https://www.vinted.fr/items/1',
        provider: 'vinted',
        title: 'Console A',
        price: 10,
        currency: 'EUR',
        url: 'https://www.vinted.fr/items/1',
      },
      {
        id: 'vinted-https://www.vinted.fr/items/3',
        provider: 'vinted',
        title: 'Console B',
        price: 12.5,
        currency: 'EUR',
        url: 'https://www.vinted.fr/items/3',
      },
    ]);
  });
});
