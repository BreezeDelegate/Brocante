import type { Estimate, Listing } from './types';

export function estimate(listings: Listing[]): Estimate | undefined {
  const prices = listings
    .map((listing) => listing.price)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) return undefined;

  const quantile = (position: number): number => {
    const index = Math.min(
      prices.length - 1,
      Math.max(0, Math.floor((prices.length - 1) * position)),
    );
    return prices[index] ?? prices[0] ?? 0;
  };

  const median = quantile(0.5);
  const q1 = quantile(0.25);
  const q3 = quantile(0.75);
  const iqr = q3 - q1;
  const clean = prices.filter(
    (price) => price >= Math.max(0, q1 - 1.5 * iqr) && price <= q3 + 1.5 * iqr,
  );
  const floorIndex = Math.min(clean.length - 1, Math.floor((clean.length - 1) * 0.2));
  const floor = clean[floorIndex] ?? prices[0] ?? 0;

  return {
    floor: Number(floor.toFixed(2)),
    median: Number(median.toFixed(2)),
    count: prices.length,
    confidence: Math.min(100, Math.round(35 + prices.length * 6)),
  };
}
