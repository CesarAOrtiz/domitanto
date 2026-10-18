import { isDecisive, type GameResult, type WinRecord } from './stats';

export type HistoryStatus = 'all' | 'finished' | 'abandoned';

export interface HistoryFilter {
  status: HistoryStatus;
  /** Solo partidas donde jugó esta persona. */
  playerId: string | null;
  /** Solo partidas donde todos los jugadores eran de este grupo. */
  groupMemberIds: string[] | null;
}

export const NO_FILTER: HistoryFilter = { status: 'all', playerId: null, groupMemberIds: null };

/** Misma definición que las cifras del grupo: todos identificados y todos del grupo. */
export function playedWithin(result: GameResult, memberIds: ReadonlySet<string>): boolean {
  return result.sides.every((s) => s.members.every((m) => m.playerId !== null && memberIds.has(m.playerId)));
}

export function playedBy(result: GameResult, playerId: string): boolean {
  return result.sides.some((s) => s.members.some((m) => m.playerId === playerId));
}

/** Partidas cerradas (terminadas o abandonadas) que cumplen el filtro, de la más reciente a la más antigua. */
export function filterHistory(results: GameResult[], filter: HistoryFilter): GameResult[] {
  const members = filter.groupMemberIds ? new Set(filter.groupMemberIds) : null;
  return results
    .filter((r) => r.status !== 'active')
    .filter((r) => filter.status === 'all' || r.status === filter.status)
    .filter((r) => !filter.playerId || playedBy(r, filter.playerId))
    .filter((r) => !members || playedWithin(r, members))
    .sort((a, b) => b.startedAt - a.startedAt);
}

/** Intervalo semiabierto [from, to) en milisegundos. */
export interface Period {
  from: number;
  to: number;
}

/** Una persona identificada o una pareja exacta (clave de composición). */
export type Subject = { kind: 'player'; playerId: string } | { kind: 'pair'; compositionKey: string };

export function periodsOverlap(a: Period, b: Period): boolean {
  return a.from < b.to && b.from < a.to;
}

/** Motivo por el que dos periodos no se pueden comparar, o nulo si sí se puede. */
export function periodProblem(a: Period, b: Period): string | null {
  if (a.to <= a.from || b.to <= b.from) return 'Cada periodo debe terminar después de empezar.';
  if (periodsOverlap(a, b)) return 'Los periodos se cruzan. Elige dos que no compartan días.';
  return null;
}

/** Una partida cae en el periodo en que terminó. */
function inPeriod(result: GameResult, period: Period): boolean {
  const at = result.endedAt ?? result.startedAt;
  return at >= period.from && at < period.to;
}

function sideOfSubject(result: GameResult, subject: Subject) {
  return result.sides.find((s) =>
    subject.kind === 'pair'
      ? s.compositionKey === subject.compositionKey
      : s.members.some((m) => m.playerId === subject.playerId),
  );
}

/**
 * Récord de una persona o pareja exacta dentro de un periodo, con la misma definición que
 * el resto de estadísticas: solo partidas terminadas con ganador; victoria = estar en el lado ganador.
 */
export function periodRecord(results: GameResult[], subject: Subject, period: Period): WinRecord {
  let played = 0;
  let won = 0;
  for (const result of results) {
    if (!isDecisive(result) || !inPeriod(result, period)) continue;
    const side = sideOfSubject(result, subject);
    if (!side) continue;
    played++;
    if (side.id === result.winnerSideId) won++;
  }
  return { played, won };
}

export interface PeriodComparison {
  a: WinRecord;
  b: WinRecord;
}

export function comparePeriods(results: GameResult[], subject: Subject, a: Period, b: Period): PeriodComparison {
  return { a: periodRecord(results, subject, a), b: periodRecord(results, subject, b) };
}
