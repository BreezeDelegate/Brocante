import { describe, expect, it } from 'vitest';

import { EbayClient } from '../providers/ebay.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('EbayClient', () => {
  it('uses an application token and returns only safe EUR fixed-price comparables', async () => {
    const calls: Array<{ input: string; init: RequestInit | undefined }> = [];
    const responses = [
      jsonResponse({ access_token: 'application-token', expires_in: 7200 }),
      jsonResponse({
        itemSummaries: [
          {
            itemId: 'v1|123|0',
            title: 'Objet eBay',
            price: { value: '19.50', currency: 'EUR' },
            itemWebUrl: 'https://www.ebay.fr/itm/123',
          },
          {
            itemId: 'unsafe',
            title: 'Unsafe',
            price: { value: '1', currency: 'EUR' },
            itemWebUrl: 'https://evil.example/itm/1',
          },
          {
            itemId: 'usd',
            title: 'Wrong currency',
            price: { value: '4', currency: 'USD' },
            itemWebUrl: 'https://www.ebay.fr/itm/4',
          },
        ],
      }),
    ];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input: String(input), init });
      const response = responses.shift();
      if (!response) throw new Error('unexpected fetch');
      return response;
    };
    const client = new EbayClient({
      clientId: 'client',
      clientSecret: 'secret',
      timeoutMs: 1_000,
      fetchImpl,
      now: () => 1_000,
    });

    await expect(client.search('console rétro')).resolves.toEqual([
      {
        id: 'ebay-v1|123|0',
        provider: 'ebay',
        title: 'Objet eBay',
        price: 19.5,
        currency: 'EUR',
        url: 'https://www.ebay.fr/itm/123',
      },
    ]);

    expect(calls).toHaveLength(2);
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe(
      'Basic Y2xpZW50OnNlY3JldA==',
    );
    const searchUrl = new URL(calls[1]!.input);
    expect(searchUrl.origin + searchUrl.pathname).toBe(
      'https://api.ebay.com/buy/browse/v1/item_summary/search',
    );
    expect(searchUrl.searchParams.get('q')).toBe('console rétro');
    expect(searchUrl.searchParams.get('limit')).toBe('50');
    expect(searchUrl.searchParams.get('filter')).toBe(
      'buyingOptions:{FIXED_PRICE},deliveryCountry:FR',
    );
    expect(new Headers(calls[1]?.init?.headers).get('authorization')).toBe(
      'Bearer application-token',
    );
    expect(new Headers(calls[1]?.init?.headers).get('x-ebay-c-marketplace-id')).toBe('EBAY_FR');
  });

  it('reuses a valid application token', async () => {
    let tokenRequests = 0;
    let searchRequests = 0;
    const fetchImpl: typeof fetch = async (input) => {
      if (String(input).includes('/identity/v1/oauth2/token')) {
        tokenRequests += 1;
        return jsonResponse({ access_token: 'cached-token', expires_in: 7200 });
      }
      searchRequests += 1;
      return jsonResponse({ itemSummaries: [] });
    };
    const client = new EbayClient({
      clientId: 'client',
      clientSecret: 'secret',
      timeoutMs: 1_000,
      fetchImpl,
      now: () => 1_000,
    });

    await client.search('objet un');
    await client.search('objet deux');

    expect(tokenRequests).toBe(1);
    expect(searchRequests).toBe(2);
  });

  it('refreshes the token once after an unauthorized Browse response', async () => {
    const responses = [
      jsonResponse({ access_token: 'old-token', expires_in: 7200 }),
      jsonResponse({ error: 'invalid token' }, 401),
      jsonResponse({ access_token: 'new-token', expires_in: 7200 }),
      jsonResponse({ itemSummaries: [] }),
    ];
    const fetchImpl: typeof fetch = async () => {
      const response = responses.shift();
      if (!response) throw new Error('unexpected fetch');
      return response;
    };
    const client = new EbayClient({
      clientId: 'client',
      clientSecret: 'secret',
      timeoutMs: 1_000,
      fetchImpl,
      now: () => 1_000,
    });

    await expect(client.search('objet')).resolves.toEqual([]);
    expect(responses).toHaveLength(0);
  });

  it('fails closed when credentials are missing', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return jsonResponse({});
    };
    const client = new EbayClient({
      clientId: '',
      clientSecret: '',
      timeoutMs: 1_000,
      fetchImpl,
    });

    await expect(client.search('objet')).rejects.toThrow('eBay is not configured');
    expect(calls).toBe(0);
  });

  it('normalizes network timeouts for the provider error boundary', async () => {
    const fetchImpl: typeof fetch = async () => {
      const error = new Error('request aborted');
      error.name = 'TimeoutError';
      throw error;
    };
    const client = new EbayClient({
      clientId: 'client',
      clientSecret: 'secret',
      timeoutMs: 1_000,
      fetchImpl,
    });

    await expect(client.search('objet')).rejects.toThrow('ebay timed out');
  });
});
