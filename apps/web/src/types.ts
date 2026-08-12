export type ProviderId = 'vinted' | 'leboncoin' | 'ebay';
export type ScanStatus = 'draft' | 'processing' | 'done' | 'error';

export interface Listing {
  id: string;
  provider: ProviderId;
  title: string;
  price: number;
  currency: string;
  url: string;
  image?: string | undefined;
}

export interface Estimate {
  floor: number;
  median: number;
  count: number;
  confidence: number;
}

export interface Scan {
  id: string;
  image: string;
  label: string;
  status: ScanStatus;
  createdAt: number;
  listings: Listing[];
  estimate?: Estimate | undefined;
  error?: string | undefined;
}

export interface Preferences {
  providerOrder: ProviderId[];
  enabled: Record<ProviderId, boolean>;
  minimumValue: number;
  apiBase: string;
  apiToken: string;
}
