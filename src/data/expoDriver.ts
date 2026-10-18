import type { SQLiteDatabase } from 'expo-sqlite';

import type { SqlDriver, SqlExecutor } from './driver';

function executor(db: SQLiteDatabase): SqlExecutor {
  return {
    async run(sql, params = []) {
      const result = await db.runAsync(sql, params);
      return { changes: result.changes };
    },
    all: (sql, params = []) => db.getAllAsync(sql, params),
    first: (sql, params = []) => db.getFirstAsync(sql, params),
    exec: (sql) => db.execAsync(sql),
  };
}

/** Adaptador de expo-sqlite. Usa una conexión exclusiva por transacción. */
export function createExpoDriver(db: SQLiteDatabase): SqlDriver {
  return {
    ...executor(db),
    async transaction(task) {
      let result: Awaited<ReturnType<typeof task>> | undefined;
      let done = false;
      await db.withExclusiveTransactionAsync(async (txn) => {
        result = await task(executor(txn));
        done = true;
      });
      if (!done) throw new Error('La transacción no terminó.');
      return result as Awaited<ReturnType<typeof task>>;
    },
  };
}
