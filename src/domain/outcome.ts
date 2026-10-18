import type { EntryRevision, GameState, ScoreEntry, Side } from './types';

export type EntryState = 'counted' | 'voided' | 'out_of_result';

export interface EntryView {
  entry: ScoreEntry;
  current: EntryRevision;
  total: number;
  state: EntryState;
  /** Acumulado de cada lado justo después de este apunte; null si no cuenta. */
  runningTotals: Record<string, number> | null;
  corrected: boolean;
}

export interface Outcome {
  totals: Record<string, number>;
  status: 'active' | 'finished';
  winnerSideId: string | null;
  /** Secuencia del apunte que cerró la partida. */
  closingSequence: number | null;
  handsPlayed: number;
  entries: EntryView[];
}

export function currentRevision(entry: ScoreEntry): EntryRevision {
  const last = entry.revisions[entry.revisions.length - 1];
  if (!last) throw new Error(`Apunte ${entry.id} sin revisiones`);
  return last;
}

export function revisionTotal(revision: Pick<EntryRevision, 'basePoints' | 'bonuses'>): number {
  return revision.basePoints + revision.bonuses.reduce((sum, b) => sum + b.value, 0);
}

/**
 * Calcula el desenlace a partir de las revisiones vigentes no anuladas, en orden de
 * `sequence`. Gana el primer lado que alcanza o supera la meta; lo posterior al cierre
 * queda "fuera de resultado" pero nunca se elimina. Los totales no se recortan a la meta.
 */
export function computeOutcome(state: Pick<GameState, 'sides' | 'entries' | 'rules'>): Outcome {
  const target = state.rules.target;
  const totals: Record<string, number> = {};
  for (const side of state.sides) totals[side.id] = 0;

  const ordered = [...state.entries].sort((a, b) => a.sequence - b.sequence);
  let closingSequence: number | null = null;
  let winnerSideId: string | null = null;
  let handsPlayed = 0;

  const entries: EntryView[] = ordered.map((entry) => {
    const current = currentRevision(entry);
    const total = revisionTotal(current);
    const corrected = entry.revisions.length > 1;

    if (current.voided) {
      return { entry, current, total, state: 'voided', runningTotals: null, corrected };
    }
    if (closingSequence !== null) {
      return { entry, current, total, state: 'out_of_result', runningTotals: null, corrected };
    }

    const sideTotal = current.sideId === null ? undefined : totals[current.sideId];
    if (current.sideId !== null && sideTotal !== undefined) {
      totals[current.sideId] = sideTotal + total;
    }
    if (entry.kind !== 'bonus') handsPlayed += 1;

    if (current.sideId !== null && (totals[current.sideId] ?? 0) >= target) {
      closingSequence = entry.sequence;
      winnerSideId = current.sideId;
    }
    return { entry, current, total, state: 'counted', runningTotals: { ...totals }, corrected };
  });

  return {
    totals,
    status: closingSequence === null ? 'active' : 'finished',
    winnerSideId,
    closingSequence,
    handsPlayed,
    entries,
  };
}

export function sideById(sides: Side[], id: string | null): Side | undefined {
  return id === null ? undefined : sides.find((s) => s.id === id);
}

/** Último apunte vigente (no anulado), para mostrar "Última: 47 a La visita". */
export function lastEffectiveEntry(outcome: Outcome): EntryView | undefined {
  for (let i = outcome.entries.length - 1; i >= 0; i -= 1) {
    const view = outcome.entries[i];
    if (view && view.state !== 'voided') return view;
  }
  return undefined;
}
