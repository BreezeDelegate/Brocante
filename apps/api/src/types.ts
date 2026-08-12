export type ProviderId = 'vinted' | 'leboncoin' | 'ebay';

export interface Listing {
  id: string;
  provider: ProviderId;
  title: string;
  price: number;
  currency: 'EUR';
  url: string;
  image?: string;
}

export interface Provider {
  id: ProviderId;
  search(query: string): Promise<Listing[]>;
}
