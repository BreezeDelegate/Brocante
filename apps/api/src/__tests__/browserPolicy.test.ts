import { describe, expect, it } from 'vitest';

import { isAllowedMainNavigation, isBlockedBrowserUrl } from '../services/browserPolicy.js';

describe('browser network policy', () => {
  it.each([
    'http://127.0.0.1:8787/',
    'http://10.0.0.1/',
    'http://100.64.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://172.16.0.1/',
    'http://192.168.1.20/',
    'http://192.0.2.1/',
    'http://198.51.100.1/',
    'http://203.0.113.1/',
    'http://host.docker.internal:11434/',
    'http://ollama.internal/',
    'http://service/',
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://[fe80::1]/',
  ])('blocks private, local or non-routable target %s', (url) => {
    expect(isBlockedBrowserUrl(url)).toBe(true);
  });

  it('allows ordinary public HTTPS resources', () => {
    expect(isBlockedBrowserUrl('https://www.vinted.fr/catalog')).toBe(false);
    expect(isBlockedBrowserUrl('https://cdn.example.com/app.js')).toBe(false);
  });

  it('allows main navigation only to exact HTTPS marketplace hosts', () => {
    const allowed = ['www.vinted.fr', 'vinted.fr'];
    expect(isAllowedMainNavigation('https://www.vinted.fr/catalog', allowed)).toBe(true);
    expect(isAllowedMainNavigation('https://vinted.fr/catalog', allowed)).toBe(true);
    expect(isAllowedMainNavigation('http://www.vinted.fr/catalog', allowed)).toBe(false);
    expect(isAllowedMainNavigation('https://www.vinted.fr.evil.test/', allowed)).toBe(false);
  });
});
