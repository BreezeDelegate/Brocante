import { describe, expect, it } from 'vitest';

import { allProvidersFailed, interruptedScan, providerErrorLabel } from './analysis';
import type { Scan } from './types';

const scan = (status: Scan['status']): Scan => ({
  id: 'scan-1',
  image: 'data:image/jpeg;base64,abc',
  label: 'objet test',
  status,
  createdAt: 1,
  listings: [],
});

describe('analysis recovery', () => {
  it('turns an interrupted processing scan into a retryable error', () => {
    const recovered = interruptedScan(scan('processing'));
    expect(recovered.status).toBe('error');
    expect(recovered.error).toContain('interrompue');
  });

  it('does not rewrite completed scans', () => {
    const completed = scan('done');
    expect(interruptedScan(completed)).toBe(completed);
  });

  it('detects when every requested provider failed', () => {
    expect(
      allProvidersFailed(
        [
          { provider: 'vinted', error: 'timeout' },
          { provider: 'leboncoin', error: 'busy' },
        ],
        ['vinted', 'leboncoin'],
      ),
    ).toBe(true);
    expect(
      allProvidersFailed([{ provider: 'vinted', error: 'timeout' }], ['vinted', 'leboncoin']),
    ).toBe(false);
  });

  it('formats provider failures without exposing internals', () => {
    expect(providerErrorLabel({ provider: 'vinted', error: 'unavailable' })).toBe(
      'Vinted : indisponible',
    );
  });
});
