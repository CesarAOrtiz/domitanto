import { openDatabaseAsync } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { CONNECTION_PRAGMAS } from '../data/driver';
import { createExpoDriver } from '../data/expoDriver';
import { migrate } from '../data/migrations';
import { systemClock, uuidSource } from '../platform/ids';
import { GameService } from './gameService';

export interface Services {
  games: GameService;
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
  return {
    games: new GameService(driver, systemClock, uuidSource),
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
