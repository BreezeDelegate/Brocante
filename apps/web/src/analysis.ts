import type { ProviderError, ProviderId, Scan } from './types';

const providerNames: Record<ProviderId, string> = {
  vinted: 'Vinted',
  leboncoin: 'Leboncoin',
  ebay: 'eBay',
};

const errorLabels: Record<ProviderError['error'], string> = {
  busy: 'file saturée',
  timeout: 'délai dépassé',
  unavailable: 'indisponible',
};

export function providerErrorLabel(error: ProviderError): string {
  return `${providerNames[error.provider]} : ${errorLabels[error.error]}`;
}

export function interruptedScan(scan: Scan): Scan {
  if (scan.status !== 'processing') return scan;
  return {
    ...scan,
    status: 'error',
    error: 'Analyse interrompue. Relance-la pour reprendre.',
  };
}

export function allProvidersFailed(errors: ProviderError[], providers: ProviderId[]): boolean {
  if (providers.length === 0) return false;
  const failed = new Set(errors.map((error) => error.provider));
  return providers.every((provider) => failed.has(provider));
}
