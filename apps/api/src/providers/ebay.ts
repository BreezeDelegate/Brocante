import { Buffer } from 'node:buffer';

import { config } from '../config.js';
import { SerialGate } from '../services/rateLimiter.js';
import type { Listing, Provider } from '../types.js';
import { safeMarketplaceUrl } from './utils.js';

const OAUTH_SCOPE = 'https://api.ebay.com/oauth/api_scope';
const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const SEARCH_FILTER = 'buyingOptions:{FIXED_PRICE},deliveryCountry:FR';
const TOKEN_REFRESH_SAFETY_MS = 60_000;
const MAX_RESULTS = 24;

interface EbayClientOptions {
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function isRequestTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function eurPrice(value: unknown): number | undefined {
  const price = record(value);
  const raw = price?.value;
  if (price?.currency !== 'EUR') return undefined;
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return amount;
}

function listingFromSummary(summary: unknown): Listing | undefined {
  const item = record(summary);
  const itemId = item?.itemId;
  const title = item?.title;
  const amount = eurPrice(item?.price);
  const itemWebUrl = item?.itemWebUrl;
  const url =
    typeof itemWebUrl === 'string' ? safeMarketplaceUrl(itemWebUrl, 'www.ebay.fr') : undefined;

  if (
    typeof itemId !== 'string' ||
    !itemId ||
    typeof title !== 'string' ||
    !title.trim() ||
    amount === undefined ||
    !url
  ) {
    return undefined;
  }

  return {
    id: `ebay-${itemId}`,
    provider: 'ebay',
    title: title.trim().slice(0, 120),
    price: amount,
    currency: 'EUR',
    url,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error('eBay returned invalid JSON');
  }
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetchImpl(input, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isRequestTimeout(error)) {
      throw new Error('ebay timed out', { cause: error });
    }
    throw new Error('eBay request failed', { cause: error });
  }
}

export class EbayClient {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private token: CachedToken | undefined;

  constructor(private readonly options: EbayClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
  }

  private ensureConfigured(): void {
    if (!this.options.clientId || !this.options.clientSecret) {
      throw new Error('eBay is not configured');
    }
  }

  private async requestToken(): Promise<CachedToken> {
    this.ensureConfigured();

    const credentials = Buffer.from(
      `${this.options.clientId}:${this.options.clientSecret}`,
      'utf8',
    ).toString('base64');
    const response = await fetchWithTimeout(
      this.fetchImpl,
      TOKEN_URL,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Basic ${credentials}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: OAUTH_SCOPE,
        }),
      },
      this.options.timeoutMs,
    );

    if (!response.ok) throw new Error('eBay token unavailable');

    const payload = record(await readJson(response));
    const accessToken = payload?.access_token;
    const expiresIn = Number(payload?.expires_in);
    if (
      typeof accessToken !== 'string' ||
      !accessToken ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0
    ) {
      throw new Error('eBay token response invalid');
    }

    const lifetimeMs = expiresIn * 1_000 - TOKEN_REFRESH_SAFETY_MS;
    const ttlMs = Math.max(1_000, lifetimeMs);
    return { value: accessToken, expiresAt: this.now() + ttlMs };
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) {
      return this.token.value;
    }
    this.token = await this.requestToken();
    return this.token.value;
  }

  private async requestSearch(query: string, token: string): Promise<Response> {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '50');
    url.searchParams.set('filter', SEARCH_FILTER);

    return fetchWithTimeout(
      this.fetchImpl,
      url,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          'x-ebay-c-marketplace-id': 'EBAY_FR',
        },
      },
      this.options.timeoutMs,
    );
  }

  private async listingsFrom(response: Response): Promise<Listing[]> {
    if (!response.ok) throw new Error('eBay search unavailable');

    const payload = record(await readJson(response));
    const summaries = payload?.itemSummaries;
    if (!Array.isArray(summaries)) return [];

    const listings: Listing[] = [];
    for (const summary of summaries) {
      const listing = listingFromSummary(summary);
      if (!listing) continue;
      listings.push(listing);
      if (listings.length >= MAX_RESULTS) break;
    }
    return listings;
  }

  async search(query: string): Promise<Listing[]> {
    let token = await this.accessToken();
    let response = await this.requestSearch(query, token);

    if (response.status === 401) {
      this.token = undefined;
      token = await this.accessToken();
      response = await this.requestSearch(query, token);
    }

    return this.listingsFrom(response);
  }
}

const gate = new SerialGate(config.EBAY_GAP_MS, config.PROVIDER_MAX_QUEUE);
const client = new EbayClient({
  clientId: config.EBAY_CLIENT_ID,
  clientSecret: config.EBAY_CLIENT_SECRET,
  timeoutMs: Math.min(10_000, config.PROVIDER_TIMEOUT_MS),
});

export const ebay: Provider = {
  id: 'ebay',
  search(query) {
    return gate.run(() => client.search(query));
  },
};
