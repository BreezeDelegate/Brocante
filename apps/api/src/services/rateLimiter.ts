export class QueueFullError extends Error {
  constructor() {
    super('provider queue is full');
    this.name = 'QueueFullError';
  }
}

export class SerialGate {
  private lastRun = 0;
  private chain = Promise.resolve();
  private queued = 0;

  constructor(
    private readonly gapMs: number,
    private readonly maxQueue = 20,
  ) {
    if (!Number.isFinite(gapMs) || gapMs < 0) {
      throw new Error('gapMs must be a non-negative finite number');
    }
    if (!Number.isInteger(maxQueue) || maxQueue < 1) {
      throw new Error('maxQueue must be a positive integer');
    }
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    if (this.queued >= this.maxQueue) return Promise.reject(new QueueFullError());
    this.queued += 1;

    const run = this.chain.then(async () => {
      const waitMs = Math.max(0, this.gapMs - (Date.now() - this.lastRun));
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));

      try {
        return await task();
      } finally {
        this.lastRun = Date.now();
        this.queued -= 1;
      }
    });

    this.chain = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }
}
