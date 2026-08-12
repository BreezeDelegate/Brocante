import { isIP } from 'node:net';

const blockedNames = new Set([
  'localhost',
  'host.docker.internal',
  'gateway.docker.internal',
  'metadata.google.internal',
]);
const blockedSuffixes = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
  '.invalid',
  '.test',
  '.example',
];

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '');
}

function ipv4Parts(hostname: string): [number, number, number, number] | undefined {
  if (isIP(hostname) !== 4) return undefined;
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4) return undefined;
  return octets as [number, number, number, number];
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = ipv4Parts(hostname);
  if (!octets) return true;

  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function ipv6Hextets(hostname: string): number[] | undefined {
  if (isIP(hostname) !== 6) return undefined;

  let value = hostname.toLowerCase();
  const zoneIndex = value.indexOf('%');
  if (zoneIndex >= 0) value = value.slice(0, zoneIndex);

  const lastColon = value.lastIndexOf(':');
  const ipv4Tail = lastColon >= 0 ? value.slice(lastColon + 1) : '';
  if (isIP(ipv4Tail) === 4) {
    const parts = ipv4Parts(ipv4Tail);
    if (!parts) return undefined;
    const [a, b, c, d] = parts;
    value =
      `${value.slice(0, lastColon)}:${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const halves = value.split('::');
  if (halves.length > 2) return undefined;

  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = halves.length === 2 ? 8 - left.length - right.length : 0;
  if ((halves.length === 1 && left.length !== 8) || missing < 0) return undefined;

  const tokens = [...left, ...Array.from({ length: missing }, () => '0'), ...right];
  if (tokens.length !== 8 || tokens.some((token) => !/^[0-9a-f]{1,4}$/.test(token))) {
    return undefined;
  }

  return tokens.map((token) => Number.parseInt(token, 16));
}

function isPrivateIpv6(hostname: string): boolean {
  const parts = ipv6Hextets(hostname);
  if (!parts) return true;

  const [first = 0] = parts;
  const allZero = parts.every((part) => part === 0);
  const loopback = parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1;
  const uniqueLocal = (first & 0xfe00) === 0xfc00;
  const linkLocal = (first & 0xffc0) === 0xfe80;
  const multicast = (first & 0xff00) === 0xff00;
  const ipv4Mapped = parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff;

  if (ipv4Mapped) {
    const high = parts[6] ?? 0;
    const low = parts[7] ?? 0;
    return isPrivateIpv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }

  return allZero || loopback || uniqueLocal || linkLocal || multicast;
}

export function isBlockedBrowserUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return true;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return true;

  const hostname = normalizeHostname(url.hostname);
  if (!hostname || blockedNames.has(hostname)) return true;
  if (blockedSuffixes.some((suffix) => hostname.endsWith(suffix))) return true;

  const ipVersion = isIP(hostname);
  if (ipVersion === 4) return isPrivateIpv4(hostname);
  if (ipVersion === 6) return isPrivateIpv6(hostname);

  // Single-label names normally resolve through local search domains and are not needed by marketplaces.
  return !hostname.includes('.');
}

export function isAllowedMainNavigation(value: string, allowedHosts: readonly string[]): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const hostname = normalizeHostname(url.hostname);
    return allowedHosts.some((host) => normalizeHostname(host) === hostname);
  } catch {
    return false;
  }
}
