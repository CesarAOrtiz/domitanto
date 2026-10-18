import { z } from 'zod';

import type { CachedAccess } from '../application/access';
import type { SqlExecutor } from './driver';

const KEY = 'plus_access';

const cachedSchema = z.object({
  access: z.enum(['plus', 'free', 'revoked']),
  checkedAt: z.number().int(),
});

/** Último veredicto validado por la tienda, para conservar Plus sin conexión. */
export async function loadCachedAccess(db: SqlExecutor): Promise<CachedAccess | null> {
  const row = await db.first<{ value: string }>('SELECT value FROM commerce_state WHERE key = ?', [KEY]);
  if (!row) return null;
  try {
    const parsed = cachedSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveCachedAccess(db: SqlExecutor, value: CachedAccess): Promise<void> {
  await db.run(
    `INSERT INTO commerce_state (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [KEY, JSON.stringify(cachedSchema.parse(value)), value.checkedAt],
  );
}
