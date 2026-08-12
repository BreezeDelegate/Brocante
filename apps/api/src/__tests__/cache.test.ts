import { describe, expect, it } from 'vitest';

import { TtlCache } from '../services/cache.js';

describe('TtlCache', () => {
  it('stores values and evicts the oldest entry', () => {
    const cache = new TtlCache<number>(60_000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('can be disabled with a zero ttl', () => {
    const cache = new TtlCache<number>(0, 2);
    cache.set('a', 1);
    expect(cache.get('a')).toBeUndefined();
  });
});
