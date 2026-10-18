import type { SqlDriver } from '../data/driver';
import { loadCachedAccess, saveCachedAccess } from '../data/commerceRepository';
import type { PurchaseOutcome, StoreAdapter, StoreOffer } from '../platform/commerce';
import { resolveAccess, verdictToAccess, type Access, type StoreVerdict } from './access';
import type { Clock } from './gameService';

export interface AccessState {
  access: Access;
  /** Precio devuelto por la tienda; nulo mientras carga o si no hay producto. */
  offer: StoreOffer | null;
  /** Motivo por el que no se puede comprar aquí (Expo Go, sin configurar). */
  storeUnavailable: string | null;
}

export interface AccessStore {
  get(): AccessState;
  subscribe(listener: () => void): () => void;
  /** Lee la caché y reconcilia con la tienda si responde. Nunca lanza. */
  init(): Promise<void>;
  loadOffer(): Promise<StoreOffer | null>;
  purchase(): Promise<PurchaseOutcome>;
  restore(): Promise<'restored' | 'nothing'>;
}

export function createAccessStore(db: SqlDriver, store: StoreAdapter, clock: Clock): AccessStore {
  let state: AccessState = { access: 'unknown', offer: null, storeUnavailable: store.unavailableReason };
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<AccessState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };

  /** Guarda primero el veredicto validado y luego lo publica. */
  const apply = async (verdict: StoreVerdict) => {
    await saveCachedAccess(db, { access: verdictToAccess(verdict), checkedAt: clock.now() });
    publish({ access: resolveAccess(null, verdict) });
  };

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async init() {
      const cached = await loadCachedAccess(db).catch(() => null);
      publish({ access: resolveAccess(cached, null) });
      if (store.unavailableReason) return;
      store.onChange((verdict) => void apply(verdict).catch(() => undefined));
      try {
        await apply(await store.verdict());
      } catch {
        // Sin red o tienda caída: se queda lo guardado; se reconcilia en el próximo arranque.
      }
    },
    async loadOffer() {
      const offer = await store.offer();
      publish({ offer });
      return offer;
    },
    async purchase() {
      const { outcome, verdict } = await store.purchase();
      if (verdict) await apply(verdict);
      return outcome;
    },
    async restore() {
      const verdict = await store.restore();
      await apply(verdict);
      return verdict === 'active' ? 'restored' : 'nothing';
    },
  };
}
