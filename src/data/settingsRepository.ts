import { z } from 'zod';

import { MAX_POINTS } from '../domain';
import type { SqlExecutor } from './driver';

const points = z.number().int().min(1).max(MAX_POINTS);

/** Ajustes locales del teléfono. Nunca contienen derechos de compra. */
export const settingsSchema = z.object({
  shortcuts: z.tuple([points, points, points]),
  haptics: z.boolean(),
  appearance: z.enum(['system', 'light', 'dark']),
  tableKeepAwake: z.boolean(),
  tableMirror: z.boolean(),
  /** Guías breves ya cerradas por el usuario (p. ej. «grupos»). */
  guidesSeen: z.array(z.string().max(40)).max(50),
  /** Guardar como jugadores los nombres nuevos que se escriben al armar una partida. */
  saveNewNames: z.boolean(),
  /** Tema elegido. Los de Plus solo se aplican con Plus activo; sin él se usa «Clásico». */
  theme: z.enum(['clasico', 'malecon', 'cacao', 'flamboyan']),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  shortcuts: [10, 25, 50],
  haptics: true,
  appearance: 'system',
  tableKeepAwake: true,
  tableMirror: false,
  guidesSeen: [],
  saveNewNames: true,
  theme: 'clasico',
};

const KEY = 'preferences';

/** Lee los ajustes; un valor dañado o de otra versión vuelve campo a campo al predeterminado. */
export async function loadSettings(db: SqlExecutor): Promise<AppSettings> {
  const row = await db.first<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [KEY]);
  if (!row) return DEFAULT_SETTINGS;
  let raw: unknown;
  try {
    raw = JSON.parse(row.value);
  } catch {
    return DEFAULT_SETTINGS;
  }
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === 'object') {
    for (const [key, field] of Object.entries(settingsSchema.shape)) {
      const parsed = field.safeParse((raw as Record<string, unknown>)[key]);
      if (parsed.success) result[key] = parsed.data;
    }
  }
  return settingsSchema.parse(result);
}

export async function saveSettings(db: SqlExecutor, settings: AppSettings): Promise<AppSettings> {
  const valid = settingsSchema.parse(settings);
  await db.run(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [KEY, JSON.stringify(valid)],
  );
  return valid;
}
