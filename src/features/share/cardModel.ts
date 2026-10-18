import { sideLetter, type GameState, type Outcome, type PairRecord } from '../../domain';
import { isPlaceholderName } from '../../domain';

export type CardFormat = 'post' | 'story';
export type CardTemplate = 'clasica' | 'pizarra' | 'carnaval';

/** Tamaño final de la imagen y tamaño lógico con que se dibuja (se escala ×3). */
export const CARD_SIZES: Record<CardFormat, { width: number; height: number; label: string }> = {
  post: { width: 1080, height: 1350, label: 'Publicación' },
  story: { width: 1080, height: 1920, label: 'Historia' },
};
export const CARD_LOGICAL_WIDTH = 360;

export function logicalSize(format: CardFormat): { width: number; height: number } {
  const { width, height } = CARD_SIZES[format];
  return { width: CARD_LOGICAL_WIDTH, height: Math.round((height / width) * CARD_LOGICAL_WIDTH) };
}

export interface CardSide {
  position: number;
  letter: string;
  name: string;
  members: string | null;
  total: number;
  winner: boolean;
}

export interface CardModel {
  sides: CardSide[];
  winnerName: string | null;
  target: number;
  hands: number;
  date: string;
  /** «Partida 3 de la sesión · 2 de 3 para Luis y José», si hay sesión con varias partidas. */
  sessionLine: string | null;
}

function joinNames(names: string[]): string | null {
  if (names.length < 2 || names.every(isPlaceholderName)) return null;
  return names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1];
}

/**
 * Datos de la tarjeta, tomados del mismo estado y desenlace que muestra la app. Con
 * `hideNames` solo quedan letras de posición: nadie aparece por su nombre.
 */
export function buildCardModel(
  state: GameState,
  outcome: Outcome,
  options: {
    hideNames: boolean;
    session?: { number: number; games: number; winnerPair?: PairRecord | null } | null;
    now?: number;
  },
): CardModel {
  const { hideNames } = options;
  const sides = [...state.sides]
    .sort((a, b) => a.position - b.position)
    .map((s) => {
      const fallback = state.mode === 'pairs' ? `Equipo ${sideLetter(s.position)}` : `Jugador ${s.position + 1}`;
      return {
        position: s.position,
        letter: sideLetter(s.position),
        name: hideNames ? fallback : s.displayName,
        members: hideNames ? null : joinNames(s.participants.map((p) => p.displayName)),
        total: outcome.totals[s.id] ?? 0,
        winner: s.id === outcome.winnerSideId,
      };
    });
  const winner = sides.find((s) => s.winner) ?? null;
  const date = new Date(state.endedAt ?? state.startedAt).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let sessionLine: string | null = null;
  const session = options.session;
  if (session && session.games > 1) {
    sessionLine = `Partida ${session.number} de la sesión`;
    const pair = session.winnerPair;
    if (pair && pair.played > 1 && !hideNames) {
      sessionLine += ` · ${pair.names.join(' y ')} van ${pair.won} de ${pair.played}`;
    }
  }

  return {
    sides,
    winnerName: winner ? winner.name : null,
    target: state.rules.target,
    hands: outcome.handsPlayed,
    date,
    sessionLine,
  };
}
