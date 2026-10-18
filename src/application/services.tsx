import { openDatabaseAsync } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { CONNECTION_PRAGMAS } from '../data/driver';
import { createExpoDriver } from '../data/expoDriver';
import { migrate } from '../data/migrations';
import { loadSettings, type AppSettings } from '../data/settingsRepository';
import { startAds } from '../platform/ads';
import { createStore } from '../platform/commerce';
import { setHapticsEnabled } from '../platform/haptics';
import { systemClock, uuidSource } from '../platform/ids';
import { adsAllowed } from './access';
import { createAccessStore, type AccessState, type AccessStore } from './accessStore';
import { GameService } from './gameService';
import { PeopleService } from './peopleService';
import { createSettingsStore, type SettingsStore } from './settingsStore';

export interface Services {
  games: GameService;
  people: PeopleService;
  access: AccessStore;
  settings: SettingsStore;
  newCommandId: () => string;
}

const ServicesContext = createContext<Services | null>(null);

export type BootState =
  | { status: 'loading' }
  | { status: 'ready'; services: Services }
  | { status: 'error'; message: string };

export const DATABASE_NAME = 'lamesa.db';

/** Abre la base local, aplica migraciones y construye los casos de uso. */
export async function bootServices(): Promise<Services> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await db.execAsync(CONNECTION_PRAGMAS);
  const driver = createExpoDriver(db);
  await migrate(driver);
  const settings = createSettingsStore(driver, await loadSettings(driver));
  setHapticsEnabled(settings.get().haptics);
  settings.subscribe(() => setHapticsEnabled(settings.get().haptics));
  const access = createAccessStore(driver, createStore(), systemClock);
  // El acceso se resuelve antes de pedir anuncios; solo con acceso gratuito confirmado.
  const maybeStartAds = () => {
    if (adsAllowed(access.get().access)) void startAds();
  };
  access.subscribe(maybeStartAds);
  void access.init();
  return {
    access,
    games: new GameService(driver, systemClock, uuidSource),
    people: new PeopleService(driver, systemClock, uuidSource),
    settings,
    newCommandId: () => uuidSource.newId(),
  };
}

export function useBoot(): [BootState, () => void] {
  const [state, setState] = useState<BootState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    bootServices()
      .then((services) => alive && setState({ status: 'ready', services }))
      .catch(
        (e: unknown) => alive && setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
      );
    return () => {
      alive = false;
    };
  }, [attempt]);
  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  };
  return [state, retry];
}

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const value = useContext(ServicesContext);
  if (!value) throw new Error('useServices fuera de ServicesProvider');
  return value;
}

export function useSettings(): [AppSettings, SettingsStore['update']] {
  const { settings } = useServices();
  const value = useSyncExternalStore(settings.subscribe, settings.get);
  return [value, settings.update];
}

export function useAccess(): AccessState {
  const { access } = useServices();
  return useSyncExternalStore(access.subscribe, access.get);
}
