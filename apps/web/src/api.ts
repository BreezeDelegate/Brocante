import { apiEndpoint, nativeApiBaseError } from './platform';
import type { Listing, Preferences, ProviderError, ProviderId, ScanErrorKind } from './types';

export interface SearchResponse {
  listings: Listing[];
  errors: ProviderError[];
}

interface IdentifyResponse {
  label?: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly kind: ScanErrorKind,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiRequestError';
  }
}

function responseError(status: number): ApiRequestError {
  if (status === 400) {
    return new ApiRequestError('Requête refusée par le serveur', 'item');
  }
  if (status === 401) {
    return new ApiRequestError('Clé API incorrecte', 'configuration');
  }
  if (status === 403) {
    return new ApiRequestError('Origine non autorisée par le serveur', 'configuration');
  }
  if (status === 413) {
    return new ApiRequestError('Photo trop volumineuse pour le serveur', 'item');
  }
  if (status === 429) {
    return new ApiRequestError('Trop de requêtes, réessaie plus tard', 'transient');
  }
  if (status >= 500) {
    return new ApiRequestError(`Service indisponible (${status})`, 'transient');
  }
  return new ApiRequestError(`Configuration API invalide (${status})`, 'configuration');
}

async function responseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new ApiRequestError('Réponse serveur invalide', 'transient', {
      cause: error,
    });
  }
}

async function requestJson<T>(
  preferences: Pick<Preferences, 'apiBase' | 'apiToken'>,
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const configurationError = nativeApiBaseError(preferences.apiBase);
  if (configurationError) {
    throw new ApiRequestError(configurationError, 'configuration');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (preferences.apiToken.trim()) {
      headers.authorization = `Bearer ${preferences.apiToken.trim()}`;
    }

    const response = await fetch(apiEndpoint(preferences.apiBase, path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) throw responseError(response.status);
    return responseJson<T>(response);
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError('Le serveur met trop de temps à répondre', 'transient', {
        cause: error,
      });
    }
    if (error instanceof TypeError) {
      throw new ApiRequestError('Impossible de joindre le serveur', 'transient', {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function apiErrorKind(error: unknown): ScanErrorKind {
  return error instanceof ApiRequestError ? error.kind : 'transient';
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
  const data = await requestJson<IdentifyResponse>(
    preferences,
    '/identify',
    { image: imageDataUrl },
    55_000,
  );
  return data.label ?? '';
}

export function activeProviders(preferences: Preferences): ProviderId[] {
  return preferences.providerOrder.filter((provider) => preferences.enabled[provider]);
}
