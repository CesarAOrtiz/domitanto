import { winRate, type PairRecord, type Streak, type WinRecord } from '../../domain';

/** «Ganó 6 de 10 · 60 %». Sin partidas no hay porcentaje. */
export function recordLabel(record: WinRecord | null | undefined): string {
  if (!record || record.played === 0) return 'Sin partidas terminadas';
  return `Ganó ${record.won} de ${record.played} · ${winRate(record)} %`;
}

export function streakLabel(streak: Streak | null): string | null {
  if (!streak || streak.length < 2) return null;
  return streak.kind === 'win'
    ? `Racha: ${streak.length} ganadas seguidas`
    : `Racha: ${streak.length} perdidas seguidas`;
}

export function pairLabel(pair: PairRecord): string {
  return pair.names.join(' y ');
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
