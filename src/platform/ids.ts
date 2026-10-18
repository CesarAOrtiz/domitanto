import { randomUUID } from 'expo-crypto';

import type { IdSource } from '../application/gameService';

/** IDs estables generados localmente (UUID v4). */
export const uuidSource: IdSource = { newId: () => randomUUID() };

export const systemClock = { now: () => Date.now() };
