import type { Listing, Preferences, ProviderError, ProviderId } from './types';

export interface SearchResponse {
  listings: Listing[];
  errors: ProviderError[];
}

interface IdentifyResponse {
  label?: string;
}

function endpoint(apiBase: string, path: string): string {
  return `${apiBase.replace(/\/$/, '')}${path}`;
}

async function requestJson<T>(
  preferences: Pick<Preferences, 'apiBase' | 'apiToken'>,
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (preferences.apiToken.trim()) {
      headers.authorization = `Bearer ${preferences.apiToken.trim()}`;
    }

    const response = await fetch(endpoint(preferences.apiBase, path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 400) throw new Error('Requête refusée par le serveur');
    if (response.status === 401) throw new Error('Clé API incorrecte');
    if (response.status === 403) throw new Error('Origine non autorisée par le serveur');
    if (response.status === 413) throw new Error('Photo trop volumineuse pour le serveur');
    if (response.status === 429) throw new Error('Trop de requêtes, réessaie plus tard');
    if (!response.ok) throw new Error(`Service indisponible (${response.status})`);
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Le serveur met trop de temps à répondre', { cause: error });
    }
    if (error instanceof TypeError) {
      throw new Error('Impossible de joindre le serveur', { cause: error });
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function search(
  preferences: Pick<Preferences, 'apiBase' | 'apiToken'>,
  label: string,
  providers: ProviderId[],
): Promise<SearchResponse> {
  return requestJson<SearchResponse>(preferences, '/search', { query: label, providers }, 120_000);
}

export async function identify(
  preferences: Pick<Preferences, 'apiBase' | 'apiToken'>,
  imageDataUrl: string,
): Promise<string> {
  try {
    const data = await requestJson<IdentifyResponse>(
      preferences,
      '/identify',
      { image: imageDataUrl },
      55_000,
    );
    return data.label ?? '';
  } catch {
    return '';
  }
}

export function activeProviders(preferences: Preferences): ProviderId[] {
  return preferences.providerOrder.filter((provider) => preferences.enabled[provider]);
}
