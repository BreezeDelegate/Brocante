import { config } from '../config.js';
import type { Listing, Provider, ProviderId } from '../types.js';
import { TtlCache } from './cache.js';
import { QueueFullError } from './rateLimiter.js';
import { withTimeout } from './timeout.js';

interface ProviderError {
  provider: ProviderId;
  error: 'busy' | 'timeout' | 'unavailable';
}

function publicError(error: unknown): ProviderError['error'] {
  if (error instanceof QueueFullError) return 'busy';
  if (error instanceof Error && error.message.endsWith('timed out')) return 'timeout';
  return 'unavailable';
}

export class SearchService {
  private readonly cache = new TtlCache<Listing[]>(config.CACHE_TTL_MS, config.CACHE_MAX_ENTRIES);

  constructor(private readonly providers: Record<ProviderId, Provider>) {}

  async search(
    query: string,
    providerIds: ProviderId[],
  ): Promise<{
    listings: Listing[];
    errors: ProviderError[];
  }> {
    const listings: Listing[] = [];
    const errors: ProviderError[] = [];

    for (const providerId of providerIds) {
      const key = `${providerId}:${query.toLocaleLowerCase('fr-FR')}`;
      const cached = this.cache.get(key);
      if (cached) {
        listings.push(...cached);
        continue;
      }

      try {
        const result = await withTimeout(
          this.providers[providerId].search(query),
          config.PROVIDER_TIMEOUT_MS,
          providerId,
        );
        this.cache.set(key, result);
        listings.push(...result);
      } catch (error) {
        errors.push({ provider: providerId, error: publicError(error) });
      }
    }

    return { listings, errors };
  }
}
