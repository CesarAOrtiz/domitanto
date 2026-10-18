import { DomainError } from './errors';
import {
  DEFAULT_TARGET,
  MAX_TARGET,
  MIN_TARGET,
  type BonusRule,
  type GameMode,
  type GameState,
  type Participant,
  type RulesSnapshot,
  type Side,
} from './types';

export interface ParticipantInput {
  playerId?: string | null;
  displayName?: string;
}

export interface SideInput {
  displayName?: string;
  participants: ParticipantInput[];
}

export interface GameSetup {
  mode: GameMode;
  target: number;
  sides: SideInput[];
  bonuses: BonusRule[];
  sessionId?: string | null;
}

/** Bonificaciones de la casa conocidas. Todas desactivadas por defecto. */
export const HOUSE_BONUSES: readonly BonusRule[] = [
  { code: 'capicua', label: 'Capicúa', value: 25, repeatable: false },
];

const SIDE_LETTERS = ['A', 'B', 'C', 'D'];
const PAIR_NAMES = ['Equipo A', 'Equipo B'];

export function sideLetter(position: number): string {
  return SIDE_LETTERS[position] ?? String(position + 1);
}

/** Nombre provisional generado por la app (p. ej. «Jugador A1»), no escrito por nadie. */
export function isPlaceholderName(name: string): boolean {
  return /^Jugador [A-D]?\d$/.test(name) || /^Equipo [A-D]$/.test(name);
}

export function validateTarget(target: number): void {
  if (!Number.isInteger(target) || target < MIN_TARGET || target > MAX_TARGET) {
    throw new DomainError('invalid_target', `La meta debe ser un entero entre ${MIN_TARGET} y ${MAX_TARGET}.`);
  }
}

/** Clave canónica de una composición: IDs ordenados, independiente de alias y asientos. */
export function compositionKey(participants: Pick<Participant, 'playerId'>[]): string | null {
  const ids = participants.map((p) => p.playerId);
  if (ids.length === 0 || ids.some((id) => !id)) return null;
  return [...(ids as string[])].sort().join('|');
}

/** Partida rápida: equipos A/B provisionales, meta 200, sin bonificaciones. */
export function quickGameSetup(): GameSetup {
  return {
    mode: 'pairs',
    target: DEFAULT_TARGET,
    sides: [{ participants: [{}, {}] }, { participants: [{}, {}] }],
    bonuses: [],
  };
}

function clean(name: string | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
}

export function buildGame(setup: GameSetup, ctx: { now: number; newId: () => string }): GameState {
  validateTarget(setup.target);
  if (setup.mode === 'pairs') {
    if (setup.sides.length !== 2 || setup.sides.some((s) => s.participants.length !== 2)) {
      throw new DomainError('invalid_setup', 'Una partida por parejas necesita dos equipos de dos.');
    }
  } else if (setup.sides.length < 2 || setup.sides.length > 4 || setup.sides.some((s) => s.participants.length !== 1)) {
    throw new DomainError('invalid_setup', 'Una partida individual necesita de 2 a 4 participantes.');
  }

  const playerIds = setup.sides.flatMap((s) => s.participants.map((p) => p.playerId).filter(Boolean));
  if (new Set(playerIds).size !== playerIds.length) {
    throw new DomainError('duplicate_player', 'La misma persona no puede estar dos veces en la partida.');
  }

  const seen = new Set<string>();
  for (const bonus of setup.bonuses) {
    if (seen.has(bonus.code)) throw new DomainError('invalid_setup', 'Bonificación repetida.');
    if (!Number.isInteger(bonus.value) || bonus.value < 1 || bonus.value > 9999) {
      throw new DomainError('invalid_setup', `El valor de «${bonus.label}» debe ser un entero entre 1 y 9999.`);
    }
    seen.add(bonus.code);
  }

  let seat = 0;
  const sides: Side[] = setup.sides.map((input, position) => {
    const participants: Participant[] = input.participants.map((p, i) => {
      const fallback = setup.mode === 'pairs' ? `Jugador ${sideLetter(position)}${i + 1}` : `Jugador ${position + 1}`;
      return {
        id: ctx.newId(),
        playerId: p.playerId ?? null,
        displayName: clean(p.displayName) || fallback,
        seat: seat++,
      };
    });
    const fallbackName =
      setup.mode === 'pairs'
        ? (PAIR_NAMES[position] ?? `Equipo ${sideLetter(position)}`)
        : participants[0]!.displayName;
    return {
      id: ctx.newId(),
      position,
      displayName: clean(input.displayName) || fallbackName,
      compositionKey: compositionKey(participants),
      participants,
    };
  });

  const rules: RulesSnapshot = {
    version: 1,
    target: setup.target,
    bonuses: setup.bonuses.map((b) => ({ ...b })),
  };

  return {
    id: ctx.newId(),
    sessionId: setup.sessionId ?? null,
    mode: setup.mode,
    rules,
    status: 'active',
    sides,
    entries: [],
    operations: [],
    startedAt: ctx.now,
    endedAt: null,
    revision: 0,
  };
}

/** Revancha: mismos integrantes y reglas, partida nueva. */
export function rematchSetup(game: GameState): GameSetup {
  return {
    mode: game.mode,
    target: game.rules.target,
    bonuses: game.rules.bonuses.map((b) => ({ ...b })),
    sessionId: game.sessionId,
    sides: [...game.sides]
      .sort((a, b) => a.position - b.position)
      .map((side) => ({
        displayName: side.displayName,
        participants: side.participants.map((p) => ({ playerId: p.playerId, displayName: p.displayName })),
      })),
  };
}
