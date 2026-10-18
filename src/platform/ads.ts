import type { ComponentType } from 'react';

import { bannerUnitId, nativeCommerce } from './commerce';

type AdsModule = typeof import('react-native-google-mobile-ads');

export interface AdsState {
  /** SDK iniciado y consentimiento resuelto. */
  ready: boolean;
  /** El formulario de privacidad permite pedir anuncios en esta región. */
  canRequestAds: boolean;
  /** La región exige ofrecer «Opciones de privacidad» en ajustes. */
  privacyOptionsRequired: boolean;
}

let mod: AdsModule | null = null;
let state: AdsState = { ready: false, canRequestAds: false, privacyOptionsRequired: false };
let starting: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(patch: Partial<AdsState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function load(): AdsModule | null {
  if (!nativeCommerce) return null;
  if (mod) return mod;
  try {
    // Carga diferida: en Expo Go el módulo nativo no existe y no debe romper el arranque.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    mod = null;
  }
  return mod;
}

export const adsStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/**
 * Pide consentimiento (UMP) y arranca el SDK. Solo se llama con acceso gratuito ya
 * confirmado. Si algo falla, no hay anuncios y el juego sigue igual.
 */
export function startAds(): Promise<void> {
  starting ??= (async () => {
    const ads = load();
    if (!ads) return;
    try {
      const consent = await ads.AdsConsent.gatherConsent();
      const privacyOptionsRequired =
        consent.privacyOptionsRequirementStatus === ads.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
      if (!consent.canRequestAds) {
        publish({ ready: true, canRequestAds: false, privacyOptionsRequired });
        return;
      }
      await ads.default().initialize();
      publish({ ready: true, canRequestAds: true, privacyOptionsRequired });
    } catch {
      publish({ ready: true, canRequestAds: false });
    }
  })();
  return starting;
}

export async function showPrivacyOptions(): Promise<void> {
  const ads = load();
  if (!ads) return;
  const consent = await ads.AdsConsent.showPrivacyOptionsForm();
  publish({ canRequestAds: consent.canRequestAds });
  if (consent.canRequestAds) await ads.default().initialize();
}

export interface BannerParts {
  Banner: ComponentType<{
    unitId: string;
    size: string;
    onAdLoaded?: () => void;
    onAdFailedToLoad?: (error: Error) => void;
  }>;
  unitId: string;
  size: string;
}

/** Componente de banner listo para usar, o nulo si no hay módulo o bloque configurado. */
export function bannerParts(): BannerParts | null {
  const ads = load();
  if (!ads) return null;
  const unitId = bannerUnitId(ads.TestIds.ADAPTIVE_BANNER);
  if (!unitId) return null;
  return {
    Banner: ads.BannerAd as unknown as BannerParts['Banner'],
    unitId,
    size: ads.BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
  };
}
