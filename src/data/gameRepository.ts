import type {
  AppliedBonus,
  CommandChange,
  EntryKind,
  EntryRevision,
  GameMode,
  GameState,
  GameStatus,
  OperationRecord,
  OperationType,
  RevisionReason,
  RulesSnapshot,
  ScoreEntry,
  Side,
} from '../domain';
import type { SqlExecutor } from './driver';

interface GameRow {
  id: string;
  session_id: string | null;
  mode: GameMode;
  target: number;
  status: GameStatus;
  rules_snapshot: string;
  started_at: number;
  ended_at: number | null;
  revision: number;
}

interface SideRow {
  id: string;
  position: number;
  display_name_snapshot: string;
  composition_key: string | null;
}

interface ParticipantRow {
  id: string;
  game_side_id: string;
  player_id: string | null;
  display_name_snapshot: string;
  seat: number | null;
}

interface EntryRow {
  id: string;
  sequence: number;
  kind: EntryKind;
  created_at: number;
}

interface RevisionRow {
  id: string;
  entry_id: string;
  revision: number;
  side_id: string | null;
  base_points: number;
  bonuses: string;
  reason: RevisionReason;
  voided: number;
  created_at: number;
  command_id: string;
}

interface OperationRow {
  command_id: string;
  type: OperationType;
  entry_id: string;
  revision: number;
  undone_by: string | null;
  undoes: string | null;
  committed_at: number;
}

export interface GameSummary {
  id: string;
  status: GameStatus;
  mode: GameMode;
  target: number;
  startedAt: number;
  endedAt: number | null;
}

export async function loadGame(db: SqlExecutor, gameId: string): Promise<GameState | null> {
  const game = await db.first<GameRow>('SELECT * FROM games WHERE id = ?', [gameId]);
  if (!game) return null;

  const [sideRows, participantRows, entryRows, revisionRows, operationRows] = await Promise.all([
    db.all<SideRow>(
      'SELECT id, position, display_name_snapshot, composition_key FROM game_sides WHERE game_id = ? ORDER BY position',
      [gameId],
    ),
    db.all<ParticipantRow>(
      'SELECT id, game_side_id, player_id, display_name_snapshot, seat FROM game_participants WHERE game_id = ? ORDER BY seat',
      [gameId],
    ),
    db.all<EntryRow>('SELECT id, sequence, kind, created_at FROM score_entries WHERE game_id = ? ORDER BY sequence', [
      gameId,
    ]),
    db.all<RevisionRow>(
      `SELECT r.* FROM score_entry_revisions r JOIN score_entries e ON e.id = r.entry_id
       WHERE e.game_id = ? ORDER BY r.entry_id, r.revision`,
      [gameId],
    ),
    db.all<OperationRow>(
      `SELECT command_id, type, entry_id, revision, undone_by, undoes, committed_at FROM operations
       WHERE game_id = ? AND entry_id IS NOT NULL ORDER BY rowid`,
      [gameId],
    ),
  ]);

  const sides: Side[] = sideRows.map((s) => ({
    id: s.id,
    position: s.position,
    displayName: s.display_name_snapshot,
    compositionKey: s.composition_key,
    participants: participantRows
      .filter((p) => p.game_side_id === s.id)
      .map((p) => ({ id: p.id, playerId: p.player_id, displayName: p.display_name_snapshot, seat: p.seat })),
  }));

  const revisionsByEntry = new Map<string, EntryRevision[]>();
  for (const r of revisionRows) {
    const list = revisionsByEntry.get(r.entry_id) ?? [];
    list.push({
      id: r.id,
      revision: r.revision,
      sideId: r.side_id,
      basePoints: r.base_points,
      bonuses: JSON.parse(r.bonuses) as AppliedBonus[],
      reason: r.reason,
      voided: r.voided === 1,
      commandId: r.command_id,
      createdAt: r.created_at,
    });
    revisionsByEntry.set(r.entry_id, list);
  }

  const entries: ScoreEntry[] = entryRows.map((e) => ({
    id: e.id,
    sequence: e.sequence,
    kind: e.kind,
    createdAt: e.created_at,
    revisions: revisionsByEntry.get(e.id) ?? [],
  }));

  const operations: OperationRecord[] = operationRows.map((o) => ({
    commandId: o.command_id,
    type: o.type,
    entryId: o.entry_id,
    revision: o.revision,
    undoneBy: o.undone_by,
    undoes: o.undoes,
    committedAt: o.committed_at,
  }));

  return {
    id: game.id,
    sessionId: game.session_id,
    mode: game.mode,
    rules: JSON.parse(game.rules_snapshot) as RulesSnapshot,
    status: game.status,
    sides,
    entries,
    operations,
    startedAt: game.started_at,
    endedAt: game.ended_at,
    revision: game.revision,
  };
}

export async function insertGame(db: SqlExecutor, game: GameState): Promise<void> {
  await db.run(
    `INSERT INTO games (id, session_id, mode, target, status, rules_snapshot, winner_side_id, started_at, ended_at, revision)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    [
      game.id,
      game.sessionId,
      game.mode,
      game.rules.target,
      game.status,
      JSON.stringify(game.rules),
      game.startedAt,
      game.endedAt,
      game.revision,
    ],
  );
  for (const side of game.sides) {
    await db.run(
      'INSERT INTO game_sides (id, game_id, position, display_name_snapshot, composition_key) VALUES (?, ?, ?, ?, ?)',
      [side.id, game.id, side.position, side.displayName, side.compositionKey],
    );
    for (const p of side.participants) {
      await db.run(
        `INSERT INTO game_participants (id, game_id, game_side_id, player_id, display_name_snapshot, seat)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [p.id, game.id, side.id, p.playerId, p.displayName, p.seat],
      );
    }
  }
}

async function insertRevision(db: SqlExecutor, entryId: string, r: EntryRevision): Promise<void> {
  await db.run(
    `INSERT INTO score_entry_revisions
     (id, entry_id, revision, side_id, base_points, bonuses, reason, voided, created_at, command_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.id,
      entryId,
      r.revision,
      r.sideId,
      r.basePoints,
      JSON.stringify(r.bonuses),
      r.reason,
      r.voided ? 1 : 0,
      r.createdAt,
      r.commandId,
    ],
  );
}

/** Persiste las filas de un comando. Debe llamarse dentro de una transacción. */
export async function persistChange(
  db: SqlExecutor,
  gameId: string,
  change: CommandChange,
  payload: unknown,
): Promise<void> {
  if (change.newEntry) {
    const e = change.newEntry;
    await db.run(
      'INSERT INTO score_entries (id, game_id, sequence, kind, current_revision, created_at) VALUES (?, ?, ?, ?, 1, ?)',
      [e.id, gameId, e.sequence, e.kind, e.createdAt],
    );
    for (const r of e.revisions) await insertRevision(db, e.id, r);
  }
  if (change.newRevision) {
    const { entryId, revision } = change.newRevision;
    await insertRevision(db, entryId, revision);
    await db.run('UPDATE score_entries SET current_revision = ? WHERE id = ?', [revision.revision, entryId]);
  }
  const op = change.operation;
  await db.run(
    `INSERT INTO operations (command_id, game_id, type, entry_id, revision, payload, result, undone_by, undoes, committed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      op.commandId,
      gameId,
      op.type,
      op.entryId,
      op.revision,
      JSON.stringify(payload),
      gameId,
      op.undoes,
      op.committedAt,
    ],
  );
  if (change.markUndone) {
    await db.run('UPDATE operations SET undone_by = ? WHERE command_id = ?', [op.commandId, change.markUndone]);
  }
}

export async function updateGameHeader(
  db: SqlExecutor,
  game: Pick<GameState, 'id' | 'status' | 'endedAt' | 'revision'>,
  winnerSideId: string | null,
): Promise<void> {
  await db.run('UPDATE games SET status = ?, ended_at = ?, revision = ?, winner_side_id = ? WHERE id = ?', [
    game.status,
    game.endedAt,
    game.revision,
    winnerSideId,
    game.id,
  ]);
}

export async function findActiveGameId(db: SqlExecutor): Promise<string | null> {
  const row = await db.first<{ id: string }>("SELECT id FROM games WHERE status = 'active' LIMIT 1");
  return row?.id ?? null;
}

export async function findOperation(
  db: SqlExecutor,
  commandId: string,
): Promise<{ type: string; game_id: string | null; result: string | null } | null> {
  return db.first('SELECT type, game_id, result FROM operations WHERE command_id = ?', [commandId]);
}

export async function insertGameOperation(
  db: SqlExecutor,
  commandId: string,
  gameId: string,
  type: 'create_game' | 'abandon_game',
  payload: unknown,
  now: number,
): Promise<void> {
  await db.run(
    `INSERT INTO operations (command_id, game_id, type, entry_id, revision, payload, result, undone_by, undoes, committed_at)
     VALUES (?, ?, ?, NULL, NULL, ?, ?, NULL, NULL, ?)`,
    [commandId, gameId, type, JSON.stringify(payload), gameId, now],
  );
}

export async function listGames(db: SqlExecutor, limit = 20): Promise<GameSummary[]> {
  const rows = await db.all<GameRow>('SELECT * FROM games ORDER BY started_at DESC, rowid DESC LIMIT ?', [limit]);
  return rows.map((g) => ({
    id: g.id,
    status: g.status,
    mode: g.mode,
    target: g.target,
    startedAt: g.started_at,
    endedAt: g.ended_at,
  }));
}
