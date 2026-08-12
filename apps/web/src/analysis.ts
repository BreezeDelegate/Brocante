import type { ProviderError, ProviderId, Scan, ScanErrorKind } from './types';

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
    errorKind: 'transient',
    error: 'Analyse interrompue. Relance-la pour reprendre.',
  };
}

export function allProvidersFailed(errors: ProviderError[], providers: ProviderId[]): boolean {
  if (providers.length === 0) return false;
  const failed = new Set(errors.map((error) => error.provider));
  return providers.every((provider) => failed.has(provider));
}

export function shouldProcessInBatch(scan: Scan): boolean {
  if (scan.status === 'draft') return true;
  if (scan.status !== 'error') return false;
  return scan.errorKind !== 'item';
}

export function shouldPauseBatch(errorKind: ScanErrorKind): boolean {
  return errorKind !== 'item';
}
