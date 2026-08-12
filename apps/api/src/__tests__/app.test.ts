import type { Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import type { Provider, ProviderId } from '../types.js';

const providers = (): Record<ProviderId, Provider> => ({
  vinted: {
    id: 'vinted',
    async search() {
      return [];
    },
  },
  leboncoin: {
    id: 'leboncoin',
    async search() {
      return [];
    },
  },
  ebay: {
    id: 'ebay',
    async search() {
      return [];
    },
  },
});

let server: Server | undefined;

afterEach(
  () =>
    new Promise<void>((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.close(() => resolve());
      server = undefined;
    }),
);

async function start(
  providerMap: Record<ProviderId, Provider> = providers(),
  apiToken?: string,
): Promise<string> {
  const app = createApp(providerMap, apiToken);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing server address');
  return `http://127.0.0.1:${address.port}`;
}

describe('API', () => {
  it('serves a minimal health endpoint', async () => {
    const base = await start();
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('rejects malformed search requests', async () => {
    const base = await start();
    const response = await fetch(`${base}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'x', providers: ['vinted', 'vinted'] }),
    });
    expect(response.status).toBe(400);
  });

  it('enforces a configured API token but keeps health public', async () => {
    const token = 'test-token-0123456789abcdef';
    const base = await start(providers(), token);

    const denied = await fetch(`${base}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'objet test', providers: ['vinted'] }),
    });
    expect(denied.status).toBe(401);

    const allowed = await fetch(`${base}/search`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: 'objet test', providers: ['vinted'] }),
    });
    expect(allowed.status).toBe(200);

    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
  });

  it('rejects untrusted browser origins', async () => {
    const base = await start();
    const response = await fetch(`${base}/search`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
      },
      body: JSON.stringify({ query: 'objet test', providers: ['vinted'] }),
    });
    expect(response.status).toBe(403);
  });

  it('returns provider results', async () => {
    const providerMap = providers();
    providerMap.vinted = {
      id: 'vinted',
      async search() {
        return [
          {
            id: '1',
            provider: 'vinted',
            title: 'Objet',
            price: 12,
            currency: 'EUR',
            url: 'https://www.vinted.fr/items/1',
          },
        ];
      },
    };

    const base = await start(providerMap);
    const response = await fetch(`${base}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'objet test', providers: ['vinted'] }),
    });
    const body = (await response.json()) as { listings: Array<{ price: number }> };
    expect(response.status).toBe(200);
    expect(body.listings[0]?.price).toBe(12);
  });

  it('keeps successful results when another provider fails', async () => {
    const providerMap = providers();
    providerMap.vinted = {
      id: 'vinted',
      async search() {
        throw new Error('provider changed');
      },
    };
    providerMap.leboncoin = {
      id: 'leboncoin',
      async search() {
        return [
          {
            id: '2',
            provider: 'leboncoin',
            title: 'Objet comparable',
            price: 18,
            currency: 'EUR',
            url: 'https://www.leboncoin.fr/ad/2',
          },
        ];
      },
    };

    const base = await start(providerMap);
    const response = await fetch(`${base}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'objet test', providers: ['vinted', 'leboncoin'] }),
    });
    const body = (await response.json()) as {
      listings: Array<{ provider: string; price: number }>;
      errors: Array<{ provider: string; error: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.listings).toEqual([expect.objectContaining({ provider: 'leboncoin', price: 18 })]);
    expect(body.errors).toEqual([{ provider: 'vinted', error: 'unavailable' }]);
  });
});
