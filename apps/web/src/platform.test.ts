import { describe, expect, it } from 'vitest';

import { apiEndpoint, defaultApiBase, nativeApiBaseError } from './platform';

describe('platform API policy', () => {
  it('keeps the existing PWA defaults', () => {
    expect(defaultApiBase(false, 'localhost')).toBe('http://localhost:8787');
    expect(defaultApiBase(false, 'brocante.example')).toBe('/api');
  });

  it('does not guess an API endpoint inside a native WebView', () => {
    expect(defaultApiBase(true, 'localhost')).toBe('');
  });

  it.each([
    ['', 'Configure l’adresse HTTPS'],
    ['not-a-url', 'URL HTTPS valide'],
    ['http://api.example', 'utiliser HTTPS'],
    ['https://user:pass@api.example', 'identifiants'],
    ['https://api.example?token=test', 'paramètres'],
    ['https://api.example/#fragment', 'fragment'],
  ])('rejects unsafe native API base %s', (apiBase, message) => {
    expect(nativeApiBaseError(apiBase, true)).toContain(message);
  });

  it('accepts an explicit HTTPS API base on native clients', () => {
    expect(nativeApiBaseError('https://api.example/brocante', true)).toBeUndefined();
  });

  it('does not apply the native-only restriction to the PWA', () => {
    expect(nativeApiBaseError('/api', false)).toBeUndefined();
  });

  it('normalizes a trailing slash when building API endpoints', () => {
    expect(apiEndpoint(' https://api.example/brocante/ ', '/search')).toBe(
      'https://api.example/brocante/search',
    );
  });
});
