import type { GameState, Outcome } from '../../domain';

/** «128–96», en el orden fijo de posiciones. */
export function scoreline(state: GameState, outcome: Outcome): string {
  return [...state.sides]
    .sort((a, b) => a.position - b.position)
    .map((s) => outcome.totals[s.id] ?? 0)
    .join('–');
}

export function durationLabel(startedAt: number, endedAt: number | null): string | null {
  if (endedAt === null) return null;
  const minutes = Math.max(1, Math.round((endedAt - startedAt) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function whenLabel(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const today = new Date(now);
  const time = date.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === today.toDateString()) return `Hoy, ${time}`;
  const yesterday = new Date(now - 86_400_000);
  if (date.toDateString() === yesterday.toDateString()) return `Ayer, ${time}`;
  return date.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });
}

export function modeLabel(state: GameState): string {
  return state.mode === 'pairs' ? 'Parejas' : `Individual · ${state.sides.length}`;
}

/** Mensaje legible para errores de guardado que no son reglas del dominio. */
export function storageMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'DomainError') return error.message;
  if (error instanceof Error && error.name === 'ActiveGameExistsError') return error.message;
  return 'El teléfono no pudo escribir en su almacenamiento. Inténtalo de nuevo.';
}
