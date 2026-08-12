import { describe, expect, it } from 'vitest';

import { estimate } from './estimate';

const listings = (prices: number[]) =>
  prices.map((price, index) => ({
    id: String(index),
    provider: 'vinted' as const,
    title: 'x',
    price,
    currency: 'EUR',
    url: 'https://example.test',
  }));

describe('estimate', () => {
  it('ignores an absurd high outlier for the floor', () => {
    const result = estimate(listings([5, 6, 7, 8, 9, 200]));
    expect(result?.floor).toBeLessThanOrEqual(7);
    expect(result?.median).toBe(7);
  });

  it('ignores invalid prices', () => {
    const result = estimate(listings([0, -2, Number.NaN, 10, 12]));
    expect(result?.count).toBe(2);
    expect(result?.floor).toBe(10);
  });

  it('returns undefined without usable data', () => {
    expect(estimate([])).toBeUndefined();
  });
});
