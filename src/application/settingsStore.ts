import type { SqlDriver } from '../data/driver';
import { saveSettings, type AppSettings } from '../data/settingsRepository';

export interface SettingsStore {
  get(): AppSettings;
  subscribe(listener: () => void): () => void;
  /** Guarda primero; solo publica el cambio tras confirmar la escritura. */
  update(patch: Partial<AppSettings>): Promise<AppSettings>;
}

export function createSettingsStore(db: SqlDriver, initial: AppSettings): SettingsStore {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async update(patch) {
      current = await saveSettings(db, { ...current, ...patch });
      listeners.forEach((l) => l());
      return current;
    },
  };
}
