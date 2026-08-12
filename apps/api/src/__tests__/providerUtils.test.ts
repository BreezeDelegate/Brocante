import { describe, expect, it } from 'vitest';

import { safeMarketplaceUrl } from '../providers/utils.js';

describe('safeMarketplaceUrl', () => {
  it('accepts the exact HTTPS marketplace host', () => {
    expect(safeMarketplaceUrl('https://www.vinted.fr/items/123', 'www.vinted.fr')).toBe(
      'https://www.vinted.fr/items/123',
    );
  });

  it('rejects lookalike hosts and non-HTTPS URLs', () => {
    expect(
      safeMarketplaceUrl('https://www.vinted.fr.evil.test/items/123', 'www.vinted.fr'),
    ).toBeUndefined();
    expect(safeMarketplaceUrl('http://www.vinted.fr/items/123', 'www.vinted.fr')).toBeUndefined();
  });
});
