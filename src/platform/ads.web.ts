// En la web no hay anuncios: misma interfaz que ads.ts, sin cargar el SDK nativo.
import type { AdsState, BannerParts } from './ads';

const state: AdsState = { ready: false, canRequestAds: false, privacyOptionsRequired: false };

export const adsStore = {
  get: () => state,
  subscribe: (_listener: () => void) => () => undefined,
};

export const startAds = (): Promise<void> => Promise.resolve();
export const showPrivacyOptions = (): Promise<void> => Promise.resolve();
export const bannerParts = (): BannerParts | null => null;
