import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import type { StoreVerdict } from '../application/access';

interface CommerceConfig {
  revenueCatAndroidKey?: string;
  revenueCatIosKey?: string;
  plusEntitlement?: string;
  bannerAndroid?: string;
  bannerIos?: string;
}

const config: CommerceConfig =
  ((Constants.expoConfig?.extra as { commerce?: CommerceConfig } | undefined)?.commerce as CommerceConfig) ?? {};

/**
 * Expo Go y la web no traen los módulos nativos de compras ni de anuncios: ahí la
 * tienda y la publicidad quedan desactivadas y la app funciona igual, sin Plus ni banners.
 */
export const nativeCommerce =
  Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const ENTITLEMENT = config.plusEntitlement || 'plus';

export type PurchaseOutcome = 'validated' | 'cancelled' | 'pending' | 'not_granted';

export interface StoreOffer {
  /** Precio y moneda tal como los devuelve la tienda. */
  priceString: string;
}

export interface StoreAdapter {
  /** Nulo si se puede comprar; si no, el motivo para mostrar. */
  unavailableReason: string | null;
  verdict(): Promise<StoreVerdict>;
  offer(): Promise<StoreOffer | null>;
  purchase(): Promise<{ outcome: PurchaseOutcome; verdict: StoreVerdict | null }>;
  restore(): Promise<StoreVerdict>;
  onChange(listener: (verdict: StoreVerdict) => void): void;
}

type PurchasesModule = typeof import('react-native-purchases');
type CustomerInfo = import('react-native-purchases').CustomerInfo;

function verdictOf(info: CustomerInfo): StoreVerdict {
  if (info.entitlements.active[ENTITLEMENT]) return 'active';
  // Existió y ya no está activo: devolución o revocación conocida por la tienda.
  if (info.entitlements.all[ENTITLEMENT]) return 'refunded';
  return 'inactive';
}

const unavailable = (reason: string): StoreAdapter => ({
  unavailableReason: reason,
  verdict: () => Promise.reject(new Error(reason)),
  offer: () => Promise.resolve(null),
  purchase: () => Promise.reject(new Error(reason)),
  restore: () => Promise.reject(new Error(reason)),
  onChange: () => undefined,
});

/** Adaptador de RevenueCat. La clave pública va en app.json (`extra.commerce`). */
export function createStore(): StoreAdapter {
  if (!nativeCommerce) return unavailable('Las compras no funcionan en Expo Go ni en la web. Usa la app instalada.');
  const apiKey = Platform.OS === 'ios' ? config.revenueCatIosKey : config.revenueCatAndroidKey;
  if (!apiKey) return unavailable('La tienda todavía no está configurada en esta versión.');

  let mod: PurchasesModule;
  try {
    // Carga diferida: en Expo Go el módulo nativo no existe y no debe romper el arranque.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('react-native-purchases') as PurchasesModule;
  } catch {
    return unavailable('Las compras no están disponibles en esta versión.');
  }
  const Purchases = mod.default;
  Purchases.configure({ apiKey });

  const lifetimePackage = async () => {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    return current?.lifetime ?? current?.availablePackages[0] ?? null;
  };

  return {
    unavailableReason: null,
    verdict: async () => verdictOf(await Purchases.getCustomerInfo()),
    offer: async () => {
      const pkg = await lifetimePackage();
      return pkg ? { priceString: pkg.product.priceString } : null;
    },
    async purchase() {
      const pkg = await lifetimePackage();
      if (!pkg) throw new Error('El producto no está disponible ahora.');
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        const verdict = verdictOf(customerInfo);
        return { outcome: verdict === 'active' ? 'validated' : 'not_granted', verdict };
      } catch (e) {
        const error = e as { userCancelled?: boolean | null; code?: string };
        if (error.userCancelled || error.code === mod.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          return { outcome: 'cancelled', verdict: null };
        }
        if (error.code === mod.PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return { outcome: 'pending', verdict: null };
        throw e;
      }
    },
    restore: async () => verdictOf(await Purchases.restorePurchases()),
    onChange(listener) {
      Purchases.addCustomerInfoUpdateListener((info) => listener(verdictOf(info)));
    },
  };
}

/** Bloque de anuncio para la plataforma: de prueba en desarrollo, real solo si está configurado. */
export function bannerUnitId(testId: string): string | null {
  if (__DEV__) return testId;
  return (Platform.OS === 'ios' ? config.bannerIos : config.bannerAndroid) || null;
}
