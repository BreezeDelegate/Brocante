import { Capacitor } from '@capacitor/core';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function defaultApiBase(
  native = isNativeApp(),
  hostname = globalThis.location?.hostname ?? '',
): string {
  if (native) return '';
  return hostname === 'localhost' ? 'http://localhost:8787' : '/api';
}

export function nativeApiBaseError(apiBase: string, native = isNativeApp()): string | undefined {
  if (!native) return undefined;

  const value = apiBase.trim();
  if (!value) return 'Configure l’adresse HTTPS de l’API dans Réglages.';

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'L’adresse API doit être une URL HTTPS valide.';
  }

  if (url.protocol !== 'https:') {
    return 'L’adresse API doit utiliser HTTPS sur Android/iOS.';
  }
  if (url.username || url.password || url.search || url.hash) {
    return 'L’adresse API ne doit pas contenir d’identifiants, de paramètres ou de fragment.';
  }

  return undefined;
}

export function apiEndpoint(apiBase: string, path: string): string {
  return `${apiBase.trim().replace(/\/$/, '')}${path}`;
}
