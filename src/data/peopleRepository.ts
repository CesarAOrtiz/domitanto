import type { SqlExecutor } from './driver';

export interface Player {
  id: string;
  displayName: string;
  createdAt: number;
  archivedAt: number | null;
  /** Inicio de su partida más reciente, si jugó alguna. */
  lastPlayedAt: number | null;
}

export interface Group {
  id: string;
  name: string;
  createdAt: number;
  memberIds: string[];
}

interface PlayerRow {
  id: string;
  display_name: string;
  created_at: number;
  archived_at: number | null;
  last_played_at: number | null;
}

function toPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    displayName: row.display_name,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    lastPlayedAt: row.last_played_at,
  };
}

const PLAYER_SELECT = `
  SELECT p.id, p.display_name, p.created_at, p.archived_at, MAX(g.started_at) AS last_played_at
  FROM players p
  LEFT JOIN game_participants gp ON gp.player_id = p.id
  LEFT JOIN games g ON g.id = gp.game_id`;

/** Jugadores ordenados por uso reciente; los que nunca jugaron, por fecha de alta. */
export async function listPlayers(db: SqlExecutor): Promise<Player[]> {
  const rows = await db.all<PlayerRow>(
    `${PLAYER_SELECT}
     GROUP BY p.id
     ORDER BY last_played_at IS NULL, last_played_at DESC, p.created_at DESC`,
  );
  return rows.map(toPlayer);
}

export async function getPlayer(db: SqlExecutor, id: string): Promise<Player | null> {
  const row = await db.first<PlayerRow>(`${PLAYER_SELECT} WHERE p.id = ? GROUP BY p.id`, [id]);
  return row ? toPlayer(row) : null;
}

export async function insertPlayer(db: SqlExecutor, id: string, displayName: string, now: number): Promise<void> {
  await db.run('INSERT INTO players (id, display_name, created_at, archived_at) VALUES (?, ?, ?, NULL)', [
    id,
    displayName,
    now,
  ]);
}

/** Cambia el alias del perfil. Las partidas pasadas conservan el nombre con que se jugaron. */
export async function renamePlayer(db: SqlExecutor, id: string, displayName: string): Promise<void> {
  await db.run('UPDATE players SET display_name = ? WHERE id = ?', [displayName, id]);
}

export async function setPlayerArchived(db: SqlExecutor, id: string, archivedAt: number | null): Promise<void> {
  await db.run('UPDATE players SET archived_at = ? WHERE id = ?', [archivedAt, id]);
}

export async function listGroups(db: SqlExecutor): Promise<Group[]> {
  const groups = await db.all<{ id: string; name: string; created_at: number }>(
    'SELECT id, name, created_at FROM groups ORDER BY created_at DESC',
  );
  const members = await db.all<{ group_id: string; player_id: string }>(
    'SELECT group_id, player_id FROM group_members ORDER BY rowid',
  );
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    createdAt: g.created_at,
    memberIds: members.filter((m) => m.group_id === g.id).map((m) => m.player_id),
  }));
}

export async function getGroup(db: SqlExecutor, id: string): Promise<Group | null> {
  const row = await db.first<{ id: string; name: string; created_at: number }>(
    'SELECT id, name, created_at FROM groups WHERE id = ?',
    [id],
  );
  if (!row) return null;
  const members = await db.all<{ player_id: string }>(
    'SELECT player_id FROM group_members WHERE group_id = ? ORDER BY rowid',
    [id],
  );
  return { id: row.id, name: row.name, createdAt: row.created_at, memberIds: members.map((m) => m.player_id) };
}

export async function insertGroup(db: SqlExecutor, id: string, name: string, now: number): Promise<void> {
  await db.run('INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)', [id, name, now]);
}

export async function renameGroup(db: SqlExecutor, id: string, name: string): Promise<void> {
  await db.run('UPDATE groups SET name = ? WHERE id = ?', [name, id]);
}

/** Reemplaza la lista de integrantes. Debe llamarse dentro de una transacción. */
export async function setGroupMembers(db: SqlExecutor, groupId: string, playerIds: string[]): Promise<void> {
  await db.run('DELETE FROM group_members WHERE group_id = ?', [groupId]);
  for (const playerId of playerIds) {
    await db.run('INSERT INTO group_members (group_id, player_id) VALUES (?, ?)', [groupId, playerId]);
  }
}

/** Borra el grupo; sus partidas y jugadores se conservan. Debe ir en una transacción. */
export async function deleteGroup(db: SqlExecutor, id: string): Promise<void> {
  await db.run('UPDATE sessions SET group_id = NULL WHERE group_id = ?', [id]);
  await db.run('DELETE FROM groups WHERE id = ?', [id]);
}
