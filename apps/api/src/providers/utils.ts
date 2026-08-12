export function safeMarketplaceUrl(value: string, hostname: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== hostname) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
