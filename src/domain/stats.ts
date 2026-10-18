import type { GameMode, GameStatus } from './types';

/**
 * Resultado de una partida reducido a lo que necesitan las estadísticas: quién jugó en
 * cada lado y quién ganó. Se reconstruye siempre desde la base; no hay totales guardados.
 */
export interface GameResult {
  gameId: string;
  sessionId: string | null;
  mode: GameMode;
  status: GameStatus;
  startedAt: number;
  endedAt: number | null;
  winnerSideId: string | null;
  sides: ResultSide[];
}

export interface ResultSide {
  id: string;
  position: number;
  displayName: string;
  compositionKey: string | null;
  members: { playerId: string | null; displayName: string }[];
}

/** Partidas con resultado decisivo frente a victorias. El porcentaje se deriva de aquí. */
export interface WinRecord {
  played: number;
  won: number;
}

export interface Streak {
  kind: 'win' | 'loss';
  length: number;
}

export interface PlayerRecord extends WinRecord {
  playerId: string;
  displayName: string;
  /** Racha vigente sobre las partidas decisivas más recientes; nula sin partidas. */
  streak: Streak | null;
}

export interface PairRecord extends WinRecord {
  /** IDs ordenados de los dos integrantes: identifica la pareja exacta. */
  compositionKey: string;
  playerIds: string[];
  /** Alias más reciente de cada integrante, en el orden de `playerIds`. */
  names: string[];
}

/** Una partida cuenta si terminó por meta con un ganador. Activas y abandonadas no. */
export function isDecisive(result: GameResult): boolean {
  return result.status === 'finished' && result.winnerSideId !== null;
}

/** Porcentaje entero de victorias, o nulo si no hay partidas: cero partidas no es 0 %. */
export function winRate(record: WinRecord): number | null {
  return record.played === 0 ? null : Math.round((record.won / record.played) * 100);
}

function chronological(results: GameResult[]): GameResult[] {
  return results
    .filter(isDecisive)
    .sort((a, b) => (a.endedAt ?? a.startedAt) - (b.endedAt ?? b.startedAt) || a.startedAt - b.startedAt);
}

function sideOf(result: GameResult, playerId: string): ResultSide | undefined {
  return result.sides.find((s) => s.members.some((m) => m.playerId === playerId));
}

/** Racha vigente: cuántas decisivas seguidas, desde la última, con el mismo desenlace. */
function currentStreak(outcomes: boolean[]): Streak | null {
  const last = outcomes.at(-1);
  if (last === undefined) return null;
  let length = 0;
  for (let i = outcomes.length - 1; i >= 0 && outcomes[i] === last; i--) length++;
  return { kind: last ? 'win' : 'loss', length };
}

/**
 * Récord de cada persona con identidad estable. Victoria significa haber integrado el
 * lado ganador; no mide su aporte individual. Los invitados sin identidad no cuentan.
 */
export function playerRecords(results: GameResult[]): PlayerRecord[] {
  const byPlayer = new Map<string, { name: string; outcomes: boolean[] }>();
  for (const result of chronological(results)) {
    for (const side of result.sides) {
      for (const m of side.members) {
        if (!m.playerId) continue;
        const entry = byPlayer.get(m.playerId) ?? { name: m.displayName, outcomes: [] };
        entry.name = m.displayName;
        entry.outcomes.push(side.id === result.winnerSideId);
        byPlayer.set(m.playerId, entry);
      }
    }
  }
  return [...byPlayer.entries()]
    .map(([playerId, { name, outcomes }]) => ({
      playerId,
      displayName: name,
      played: outcomes.length,
      won: outcomes.filter(Boolean).length,
      streak: currentStreak(outcomes),
    }))
    .sort((a, b) => b.played - a.played || b.won - a.won || a.displayName.localeCompare(b.displayName));
}

export function playerRecord(results: GameResult[], playerId: string): PlayerRecord | null {
  return playerRecords(results).find((r) => r.playerId === playerId) ?? null;
}

/**
 * Récord por pareja exacta (dos integrantes identificados). Una pareja con otra persona
 * es otra pareja, aunque el equipo tuviera el mismo nombre.
 */
export function pairRecords(results: GameResult[]): PairRecord[] {
  const byKey = new Map<string, PairRecord>();
  for (const result of chronological(results)) {
    for (const side of result.sides) {
      if (!side.compositionKey || side.members.length !== 2) continue;
      const playerIds = side.compositionKey.split('|');
      const names = playerIds.map((id) => side.members.find((m) => m.playerId === id)?.displayName ?? '');
      const record = byKey.get(side.compositionKey) ?? {
        compositionKey: side.compositionKey,
        playerIds,
        names,
        played: 0,
        won: 0,
      };
      record.names = names;
      record.played++;
      if (side.id === result.winnerSideId) record.won++;
      byKey.set(side.compositionKey, record);
    }
  }
  return [...byKey.values()].sort((a, b) => b.played - a.played || b.won - a.won);
}

/** Parejas en las que estuvo una persona, con su récord juntos. */
export function partnersOf(results: GameResult[], playerId: string): PairRecord[] {
  return pairRecords(results).filter((p) => p.playerIds.includes(playerId));
}

/** Partidas decisivas de una persona en orden cronológico, para su ficha. */
export function gamesOf(results: GameResult[], playerId: string): { result: GameResult; won: boolean }[] {
  return chronological(results)
    .filter((r) => sideOf(r, playerId))
    .map((result) => ({ result, won: sideOf(result, playerId)!.id === result.winnerSideId }));
}

export interface SessionGame {
  result: GameResult;
  /** 1, 2, 3... en orden de inicio dentro de la sesión. */
  number: number;
  /** Verdadero si las composiciones no son las de la partida anterior. */
  pairsChanged: boolean;
}

export interface SessionSummary {
  games: SessionGame[];
  decisive: number;
  pairs: PairRecord[];
  players: PlayerRecord[];
}

function compositionSignature(result: GameResult): string {
  return result.sides
    .map((s) => s.compositionKey ?? s.members.map((m) => m.displayName).sort().join('|'))
    .sort()
    .join(' / ');
}

/**
 * Resumen de una juntadera: partidas en orden, victorias por pareja exacta y por persona.
 * Si cambian las parejas, cada composición lleva su propia cuenta.
 */
export function summarizeSession(results: GameResult[]): SessionSummary {
  const ordered = [...results].sort((a, b) => a.startedAt - b.startedAt);
  const games = ordered.map((result, i) => ({
    result,
    number: i + 1,
    pairsChanged: i > 0 && compositionSignature(result) !== compositionSignature(ordered[i - 1]!),
  }));
  return {
    games,
    decisive: ordered.filter(isDecisive).length,
    pairs: pairRecords(ordered),
    players: playerRecords(ordered),
  };
}
