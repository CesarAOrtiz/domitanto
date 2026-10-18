import type { GameResult, ResultSide } from '../domain';
import type { SqlExecutor } from './driver';

export interface SessionRow {
  id: string;
  groupId: string | null;
  startedAt: number;
  endedAt: number | null;
  /** Último movimiento: fin o inicio más reciente de sus partidas. */
  lastActivityAt: number;
  gameCount: number;
}

interface RawSession {
  id: string;
  group_id: string | null;
  started_at: number;
  ended_at: number | null;
  last_activity_at: number | null;
  game_count: number;
}

const SESSION_SELECT = `
  SELECT s.id, s.group_id, s.started_at, s.ended_at,
         MAX(COALESCE(g.ended_at, g.started_at)) AS last_activity_at,
         COUNT(g.id) AS game_count
  FROM sessions s LEFT JOIN games g ON g.session_id = s.id`;

function toSession(row: RawSession): SessionRow {
  return {
    id: row.id,
    groupId: row.group_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    lastActivityAt: row.last_activity_at ?? row.started_at,
    gameCount: row.game_count,
  };
}

export async function latestSession(db: SqlExecutor): Promise<SessionRow | null> {
  const row = await db.first<RawSession>(
    `${SESSION_SELECT} GROUP BY s.id ORDER BY s.started_at DESC, s.rowid DESC LIMIT 1`,
  );
  return row ? toSession(row) : null;
}

export async function getSession(db: SqlExecutor, id: string): Promise<SessionRow | null> {
  const row = await db.first<RawSession>(`${SESSION_SELECT} WHERE s.id = ? GROUP BY s.id`, [id]);
  return row ? toSession(row) : null;
}

export async function insertSession(
  db: SqlExecutor,
  id: string,
  groupId: string | null,
  startedAt: number,
): Promise<void> {
  await db.run('INSERT INTO sessions (id, group_id, started_at, ended_at) VALUES (?, ?, ?, NULL)', [
    id,
    groupId,
    startedAt,
  ]);
}

export async function closeSession(db: SqlExecutor, id: string, endedAt: number): Promise<void> {
  await db.run('UPDATE sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL', [endedAt, id]);
}

export async function setSessionGroup(db: SqlExecutor, id: string, groupId: string): Promise<void> {
  await db.run('UPDATE sessions SET group_id = ? WHERE id = ?', [groupId, id]);
}

export interface ResultFilter {
  sessionId?: string;
  playerId?: string;
}

/**
 * Resultados de partidas sin sus manos: lados, integrantes y ganador vigente.
 * `winner_side_id` lo mantiene cada comando junto con el estado de la partida.
 */
export async function listResults(db: SqlExecutor, filter: ResultFilter = {}): Promise<GameResult[]> {
  const where: string[] = [];
  const params: string[] = [];
  if (filter.sessionId) {
    where.push('g.session_id = ?');
    params.push(filter.sessionId);
  }
  if (filter.playerId) {
    where.push('g.id IN (SELECT game_id FROM game_participants WHERE player_id = ?)');
    params.push(filter.playerId);
  }
  const games = await db.all<{
    id: string;
    session_id: string | null;
    mode: GameResult['mode'];
    status: GameResult['status'];
    started_at: number;
    ended_at: number | null;
    winner_side_id: string | null;
  }>(
    `SELECT g.id, g.session_id, g.mode, g.status, g.started_at, g.ended_at, g.winner_side_id FROM games g
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY g.started_at, g.rowid`,
    params,
  );
  if (games.length === 0) return [];

  const ids = games.map((g) => g.id);
  const marks = ids.map(() => '?').join(', ');
  const [sides, members] = await Promise.all([
    db.all<{
      id: string;
      game_id: string;
      position: number;
      display_name_snapshot: string;
      composition_key: string | null;
    }>(
      `SELECT id, game_id, position, display_name_snapshot, composition_key FROM game_sides
       WHERE game_id IN (${marks}) ORDER BY position`,
      ids,
    ),
    db.all<{ game_side_id: string; player_id: string | null; display_name_snapshot: string }>(
      `SELECT game_side_id, player_id, display_name_snapshot FROM game_participants
       WHERE game_id IN (${marks}) ORDER BY seat`,
      ids,
    ),
  ]);

  return games.map((g) => ({
    gameId: g.id,
    sessionId: g.session_id,
    mode: g.mode,
    status: g.status,
    startedAt: g.started_at,
    endedAt: g.ended_at,
    winnerSideId: g.winner_side_id,
    sides: sides
      .filter((s) => s.game_id === g.id)
      .map(
        (s): ResultSide => ({
          id: s.id,
          position: s.position,
          displayName: s.display_name_snapshot,
          compositionKey: s.composition_key,
          members: members
            .filter((m) => m.game_side_id === s.id)
            .map((m) => ({ playerId: m.player_id, displayName: m.display_name_snapshot })),
        }),
      ),
  }));
}
