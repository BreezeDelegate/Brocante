import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, identify, search } from './api';

const preferences = {
  apiBase: 'https://brocante.example/api',
  apiToken: 'test-token',
};

function response(status: number, body = '{}'): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('API failure classification', () => {
  it.each([
    [400, 'item', 'Requête refusée'],
    [401, 'configuration', 'Clé API incorrecte'],
    [403, 'configuration', 'Origine non autorisée'],
    [429, 'transient', 'Trop de requêtes'],
    [503, 'transient', 'Service indisponible'],
    [404, 'configuration', 'Configuration API invalide'],
  ] as const)('classifies HTTP %s as %s', async (status, kind, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(status)));

    const request = search(preferences, 'objet test', ['vinted']);
    await expect(request).rejects.toMatchObject({ kind });
    await expect(request).rejects.toThrow(message);
  });

  it('classifies an oversized identify payload as an item failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(413)));

    await expect(identify(preferences, 'data:image/jpeg;base64,abc')).rejects.toMatchObject({
      kind: 'item',
    });
  });

  it('does not hide authentication failures during identification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401)));

    await expect(identify(preferences, 'data:image/jpeg;base64,abc')).rejects.toMatchObject({
      kind: 'configuration',
    });
  });

  it('classifies network failures as transient and preserves their cause', async () => {
    const cause = new TypeError('offline');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(cause));

    try {
      await search(preferences, 'objet test', ['vinted']);
      throw new Error('expected request to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiRequestError);
      expect(error).toMatchObject({ kind: 'transient', cause });
    }
  });

  it('classifies malformed successful responses as transient', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, '{')));

    await expect(search(preferences, 'objet test', ['vinted'])).rejects.toMatchObject({
      kind: 'transient',
    });
  });
});
