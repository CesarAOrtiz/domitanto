// Driver de pruebas sobre el SQLite real integrado en Node (node:sqlite).
// Solo para pruebas de integración en Node; la app usa expo-sqlite.
import type { SqlDriver, SqlExecutor, SqlValue } from '../data/driver';
import { CONNECTION_PRAGMAS } from '../data/driver';

interface StatementSync {
  run(...params: SqlValue[]): { changes: number | bigint };
  all(...params: SqlValue[]): unknown[];
  get(...params: SqlValue[]): unknown;
}
interface DatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
  close(): void;
}

const sqlite = process.getBuiltinModule('node:sqlite') as {
  DatabaseSync: new (path: string) => DatabaseSync;
};

export interface TestDriver extends SqlDriver {
  raw: DatabaseSync;
  /** Hace fallar la siguiente sentencia cuyo SQL contenga el fragmento. */
  failOn(fragment: string | null): void;
  close(): void;
}

export function openTestDatabase(path = ':memory:'): TestDriver {
  const raw = new sqlite.DatabaseSync(path);
  raw.exec(CONNECTION_PRAGMAS);
  let failFragment: string | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const check = (sql: string) => {
    if (failFragment && sql.includes(failFragment)) throw new Error('disk I/O error (simulado)');
  };
  const executor: SqlExecutor = {
    async run(sql, params = []) {
      check(sql);
      const r = raw.prepare(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      check(sql);
      return raw
        .prepare(sql)
        .all(...params)
        .map((row) => ({ ...(row as object) })) as T[];
    },
    async first<T>(sql: string, params: SqlValue[] = []) {
      check(sql);
      const row = raw.prepare(sql).get(...params);
      return (row ? { ...(row as object) } : null) as T | null;
    },
    async exec(sql) {
      check(sql);
      raw.exec(sql);
    },
  };

  return {
    ...executor,
    raw,
    failOn(fragment) {
      failFragment = fragment;
    },
    close: () => raw.close(),
    transaction<T>(task: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      const run = async () => {
        raw.exec('BEGIN IMMEDIATE');
        try {
          const result = await task(executor);
          raw.exec('COMMIT');
          return result;
        } catch (error) {
          raw.exec('ROLLBACK');
          throw error;
        }
      };
      const next = queue.then(run, run);
      queue = next.catch(() => undefined);
      return next;
    },
  };
}

/** Reloj e IDs deterministas para pruebas. */
export function testDeps(start = 1_760_000_000_000) {
  let t = start;
  let n = 0;
  return {
    clock: { now: () => (t += 1000) },
    ids: { newId: () => `id-${String(++n).padStart(4, '0')}` },
  };
}
