export type SqlValue = string | number | null;

/** Conexión mínima que usan repositorios y migraciones. */
export interface SqlExecutor {
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  exec(sql: string): Promise<void>;
}

export interface SqlDriver extends SqlExecutor {
  /**
   * Ejecuta `task` dentro de una transacción exclusiva. Si la tarea lanza, se revierte
   * todo y el error se propaga. Solo resuelve después del COMMIT.
   */
  transaction<T>(task: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

/** Pragmas aplicados al abrir la base. */
export const CONNECTION_PRAGMAS = 'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;';
