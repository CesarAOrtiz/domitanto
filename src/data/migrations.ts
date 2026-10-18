import type { SqlDriver } from './driver';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/**
 * Migraciones secuenciales. Nunca editar una ya publicada: añadir una nueva.
 * Las tablas comerciales (derechos, anuncios) llegarán en su propia migración.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'esquema_inicial',
    sql: `
CREATE TABLE players (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  archived_at INTEGER
);
CREATE TABLE groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  PRIMARY KEY (group_id, player_id)
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  group_id TEXT REFERENCES groups(id),
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);
CREATE TABLE games (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT REFERENCES sessions(id),
  mode TEXT NOT NULL CHECK (mode IN ('pairs', 'individual')),
  target INTEGER NOT NULL CHECK (target BETWEEN 1 AND 9999),
  status TEXT NOT NULL CHECK (status IN ('active', 'finished', 'abandoned')),
  rules_snapshot TEXT NOT NULL,
  winner_side_id TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  revision INTEGER NOT NULL DEFAULT 0
);
-- Una sola partida activa por instalación, garantizado por la base.
CREATE UNIQUE INDEX games_one_active ON games(status) WHERE status = 'active';
CREATE INDEX games_started ON games(started_at);
CREATE TABLE game_sides (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  display_name_snapshot TEXT NOT NULL,
  composition_key TEXT,
  UNIQUE (game_id, position)
);
CREATE TABLE game_participants (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_side_id TEXT NOT NULL REFERENCES game_sides(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(id),
  display_name_snapshot TEXT NOT NULL,
  seat INTEGER,
  UNIQUE (game_id, player_id)
);
CREATE TABLE score_entries (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('hand', 'bonus', 'scoreless_hand')),
  current_revision INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (game_id, sequence)
);
CREATE TABLE score_entry_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES score_entries(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  side_id TEXT REFERENCES game_sides(id),
  base_points INTEGER NOT NULL CHECK (base_points BETWEEN 0 AND 9999),
  bonuses TEXT NOT NULL,
  reason TEXT NOT NULL,
  voided INTEGER NOT NULL CHECK (voided IN (0, 1)),
  created_at INTEGER NOT NULL,
  command_id TEXT NOT NULL,
  UNIQUE (entry_id, revision)
);
CREATE TABLE operations (
  command_id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  entry_id TEXT REFERENCES score_entries(id) ON DELETE CASCADE,
  revision INTEGER,
  payload TEXT NOT NULL,
  result TEXT,
  undone_by TEXT,
  undoes TEXT,
  committed_at INTEGER NOT NULL
);
CREATE INDEX operations_game ON operations(game_id, committed_at);
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`,
  },
  {
    version: 2,
    name: 'indices_jugadores_y_sesiones',
    sql: `
CREATE INDEX game_participants_player ON game_participants(player_id);
CREATE INDEX games_session ON games(session_id);
CREATE INDEX group_members_player ON group_members(player_id);
CREATE INDEX sessions_started ON sessions(started_at);
`,
  },
];

export class MigrationError extends Error {
  constructor(
    readonly version: number,
    cause: unknown,
  ) {
    super(`Falló la migración ${version}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'MigrationError';
  }
}

export async function currentSchemaVersion(db: SqlDriver): Promise<number> {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at INTEGER NOT NULL);',
  );
  const row = await db.first<{ v: number | null }>('SELECT MAX(version) AS v FROM schema_version');
  return row?.v ?? 0;
}

/**
 * Aplica las migraciones pendientes, cada una en su transacción. Si una falla se revierte
 * esa migración, se conserva la base tal como estaba y se lanza el error: nunca se borra
 * la base del usuario como respuesta automática.
 */
export async function migrate(
  db: SqlDriver,
  migrations: Migration[] = MIGRATIONS,
  now: () => number = Date.now,
): Promise<number> {
  let version = await currentSchemaVersion(db);
  const latest = migrations.reduce((max, m) => Math.max(max, m.version), 0);
  if (version > latest) {
    throw new MigrationError(version, new Error('La base pertenece a una versión más nueva de la app.'));
  }
  const pending = migrations.filter((m) => m.version > version).sort((a, b) => a.version - b.version);
  for (const migration of pending) {
    if (migration.version !== version + 1) {
      throw new MigrationError(migration.version, new Error('Las migraciones no son consecutivas.'));
    }
    try {
      await db.transaction(async (tx) => {
        await tx.exec(migration.sql);
        await tx.run('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)', [
          migration.version,
          migration.name,
          now(),
        ]);
      });
    } catch (error) {
      throw new MigrationError(migration.version, error);
    }
    version = migration.version;
  }
  return version;
}
