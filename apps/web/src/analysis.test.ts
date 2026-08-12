import { describe, expect, it } from 'vitest';

import {
  allProvidersFailed,
  interruptedScan,
  providerErrorLabel,
  shouldPauseBatch,
  shouldProcessInBatch,
} from './analysis';
import type { Scan } from './types';

const scan = (status: Scan['status'], errorKind?: Scan['errorKind']): Scan => ({
  id: 'scan-1',
  image: 'data:image/jpeg;base64,abc',
  label: 'objet test',
  status,
  createdAt: 1,
  listings: [],
  errorKind,
});

describe('analysis recovery', () => {
  it('turns an interrupted processing scan into a retryable transient error', () => {
    const recovered = interruptedScan(scan('processing'));
    expect(recovered.status).toBe('error');
    expect(recovered.errorKind).toBe('transient');
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

  it('keeps transient, configuration and legacy errors in explicit batch retries', () => {
    expect(shouldProcessInBatch(scan('draft'))).toBe(true);
    expect(shouldProcessInBatch(scan('error', 'transient'))).toBe(true);
    expect(shouldProcessInBatch(scan('error', 'configuration'))).toBe(true);
    expect(shouldProcessInBatch(scan('error'))).toBe(true);
  });

  it('does not auto-process an item error or a completed scan', () => {
    expect(shouldProcessInBatch(scan('error', 'item'))).toBe(false);
    expect(shouldProcessInBatch(scan('done'))).toBe(false);
  });

  it('pauses a batch only for failures that can affect following items', () => {
    expect(shouldPauseBatch('transient')).toBe(true);
    expect(shouldPauseBatch('configuration')).toBe(true);
    expect(shouldPauseBatch('item')).toBe(false);
  });
});
