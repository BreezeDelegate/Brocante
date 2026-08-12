import type { Preferences, ProviderId, Scan } from './types';

const PREFERENCES_KEY = 'brocante.preferences.v2';
const DB_NAME = 'brocante';
const DB_VERSION = 1;
const SCAN_STORE = 'scans';
const MAX_STORED_SCANS = 250;
const providerIds: ProviderId[] = ['vinted', 'leboncoin', 'ebay'];

export const defaults: Preferences = {
  providerOrder: ['vinted', 'leboncoin', 'ebay'],
  enabled: { vinted: true, leboncoin: true, ebay: false },
  minimumValue: 2,
  apiBase: location.hostname === 'localhost' ? 'http://localhost:8787' : '/api',
  apiToken: '',
};

function validProviderOrder(value: unknown): ProviderId[] {
  if (!Array.isArray(value)) return defaults.providerOrder;
  const order = value.filter((item): item is ProviderId =>
    providerIds.includes(item as ProviderId),
  );
  return order.length === providerIds.length && new Set(order).size === providerIds.length
    ? order
    : defaults.providerOrder;
}

export function loadPreferences(): Preferences {
  try {
    const stored = JSON.parse(
      localStorage.getItem(PREFERENCES_KEY) ?? '{}',
    ) as Partial<Preferences>;
    return {
      ...defaults,
      ...stored,
      providerOrder: validProviderOrder(stored.providerOrder),
      enabled: { ...defaults.enabled, ...stored.enabled },
      minimumValue:
        typeof stored.minimumValue === 'number' && Number.isFinite(stored.minimumValue)
          ? Math.max(0, Math.min(10_000, stored.minimumValue))
          : defaults.minimumValue,
      apiBase: typeof stored.apiBase === 'string' ? stored.apiBase.slice(0, 300) : defaults.apiBase,
      apiToken: typeof stored.apiToken === 'string' ? stored.apiToken.slice(0, 500) : '',
    };
  } catch {
    return defaults;
  }
}

export function savePreferences(preferences: Preferences): void {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB indisponible')),
    );
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SCAN_STORE)) {
        database.createObjectStore(SCAN_STORE, { keyPath: 'id' });
      }
    });
    request.addEventListener('success', () => resolve(request.result));
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction(SCAN_STORE, mode);
      const request = work(tx.objectStore(SCAN_STORE));
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () =>
        reject(request.error ?? new Error('IndexedDB error')),
      );
      tx.addEventListener('error', () =>
        reject(tx.error ?? new Error('IndexedDB transaction error')),
      );
    });
  } finally {
    database.close();
  }
}

export async function loadScans(): Promise<Scan[]> {
  try {
    const scans = await transaction<Scan[]>('readonly', (store) => store.getAll());
    return scans.sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_STORED_SCANS);
  } catch {
    return [];
  }
}

export async function putScan(scan: Scan): Promise<void> {
  await transaction<IDBValidKey>('readwrite', (store) => store.put(scan));
}

export async function deleteScan(id: string): Promise<void> {
  await transaction<undefined>('readwrite', (store) => store.delete(id));
}

export async function clearScans(): Promise<void> {
  await transaction<undefined>('readwrite', (store) => store.clear());
}
