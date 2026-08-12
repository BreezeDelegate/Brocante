import { describe, expect, it } from 'vitest';

import { QueueFullError, SerialGate } from '../services/rateLimiter.js';

describe('SerialGate', () => {
  it('serializes jobs', async () => {
    const gate = new SerialGate(1);
    const order: number[] = [];

    await Promise.all([
      gate.run(async () => {
        order.push(1);
      }),
      gate.run(async () => {
        order.push(2);
      }),
    ]);

    expect(order).toEqual([1, 2]);
  });

  it('rejects invalid configuration', () => {
    expect(() => new SerialGate(-1)).toThrow();
    expect(() => new SerialGate(1, 0)).toThrow();
  });

  it('bounds the waiting queue', async () => {
    const gate = new SerialGate(1, 1);
    let release: (() => void) | undefined;
    const first = gate.run(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    await expect(gate.run(async () => undefined)).rejects.toBeInstanceOf(QueueFullError);
    release?.();
    await first;
  });
});
