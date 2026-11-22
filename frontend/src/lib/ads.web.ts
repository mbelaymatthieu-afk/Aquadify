export type AdsState = { mod: any; personalized: boolean };

export function prepareAds(): Promise<AdsState | null> {
  return Promise.resolve(null);
}
