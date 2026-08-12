import type { Listing, ProviderId } from '../types.js';

export interface MarketplaceRow {
  href: string;
  text: string;
}

interface ListingRowsOptions {
  provider: ProviderId;
  hostname: string;
  fallbackTitle: string;
  max?: number;
}

export function safeMarketplaceUrl(value: string, hostname: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== hostname) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function parseEuroPrice(text: string): number | undefined {
  const match = text.match(/(\d[\d\s\u00a0\u202f.,]*)\s*€/u);
  const token = match?.[1]?.trim();
  if (!token) return undefined;

  const compact = token.replace(/[\s\u00a0\u202f]/gu, '');
  let normalized: string;

  if (compact.includes(',')) {
    const parts = compact.split(',');
    if (parts.length !== 2 || !parts[0] || !/^\d{1,2}$/u.test(parts[1] ?? '')) return undefined;
    normalized = `${parts[0].replaceAll('.', '')}.${parts[1]}`;
  } else {
    const dotParts = compact.split('.');
    if (dotParts.length === 2 && /^\d{1,2}$/u.test(dotParts[1] ?? '')) {
      normalized = compact;
    } else {
      normalized = compact.replaceAll('.', '');
    }
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

export function listingTitle(text: string, fallback: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);

  const title = lines.find((line) => !/^\d[\d\s\u00a0\u202f.,]*\s*€$/u.test(line));
  return (title || fallback).slice(0, 120);
}

export function listingRows(rows: MarketplaceRow[], options: ListingRowsOptions): Listing[] {
  const listings: Listing[] = [];
  const seen = new Set<string>();
  const max = options.max ?? 24;

  for (const row of rows) {
    const url = safeMarketplaceUrl(row.href, options.hostname);
    const price = parseEuroPrice(row.text);
    if (!url || price === undefined || seen.has(url)) continue;

    seen.add(url);
    listings.push({
      id: `${options.provider}-${url}`,
      provider: options.provider,
      title: listingTitle(row.text, options.fallbackTitle),
      price,
      currency: 'EUR',
      url,
    });
    if (listings.length >= max) break;
  }

  return listings;
}
