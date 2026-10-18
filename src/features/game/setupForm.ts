import {
  DEFAULT_TARGET,
  HOUSE_BONUSES,
  isPlaceholderName,
  MAX_TARGET,
  MIN_TARGET,
  type GameMode,
  type GameSetup,
  type GameState,
} from '../../domain';

/** Estado editable del formulario de configuración. Los nombres son opcionales. */
export interface SetupForm {
  mode: GameMode;
  individualCount: 2 | 3 | 4;
  target: string;
  sideNames: string[];
  /** Pareja: [lado][asiento]. Individual: [participante][0]. */
  playerNames: string[][];
  /** Jugador guardado sentado en cada puesto (misma forma que `playerNames`). */
  playerIds: (string | null)[][];
  bonuses: Record<string, { enabled: boolean; value: string }>;
}

export function defaultForm(): SetupForm {
  return {
    mode: 'pairs',
    individualCount: 4,
    target: String(DEFAULT_TARGET),
    sideNames: ['', '', '', ''],
    playerNames: [
      ['', ''],
      ['', ''],
      ['', ''],
      ['', ''],
    ],
    playerIds: [
      [null, null],
      [null, null],
      [null, null],
      [null, null],
    ],
    bonuses: Object.fromEntries(HOUSE_BONUSES.map((b) => [b.code, { enabled: false, value: String(b.value) }])),
  };
}

/** Rellena el formulario a partir de una partida previa (para «Cambiar parejas»). */
export function formFromGame(game: GameState): SetupForm {
  const form = defaultForm();
  const sides = [...game.sides].sort((a, b) => a.position - b.position);
  form.mode = game.mode;
  form.target = String(game.rules.target);
  if (game.mode === 'individual') {
    form.individualCount = Math.min(4, Math.max(2, sides.length)) as 2 | 3 | 4;
    sides.forEach((s, i) => {
      const name = s.participants[0]?.displayName ?? '';
      form.playerNames[i] = [isPlaceholderName(name) ? '' : name, ''];
      form.playerIds[i] = [s.participants[0]?.playerId ?? null, null];
    });
  } else {
    sides.forEach((s, i) => {
      form.sideNames[i] = isPlaceholderName(s.displayName) ? '' : s.displayName;
      form.playerNames[i] = s.participants.map((p) => (isPlaceholderName(p.displayName) ? '' : p.displayName));
      form.playerIds[i] = s.participants.map((p) => p.playerId);
    });
  }
  for (const b of game.rules.bonuses) form.bonuses[b.code] = { enabled: true, value: String(b.value) };
  return form;
}

export interface FormErrors {
  target?: string;
  bonuses?: Record<string, string>;
}

function parseInteger(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

/** Puestos del formulario en orden de asiento: [lado, asiento]. */
export function seats(form: SetupForm): [number, number][] {
  return form.mode === 'pairs'
    ? [0, 1].flatMap((side) => [0, 1].map((seat): [number, number] => [side, seat]))
    : Array.from({ length: form.individualCount }, (_, side): [number, number] => [side, 0]);
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

export interface NameContext {
  /** Nombres (normalizados) de jugadores ya guardados. */
  savedNames: ReadonlySet<string>;
  /** Guardar como jugador nuevo un nombre escrito que no coincide con ninguno guardado. */
  saveNewNames: boolean;
}

/**
 * Un nombre escrito que coincide con un jugador guardado no se vincula solo: dos
 * personas pueden llamarse igual. Queda como invitado salvo que se toque la sugerencia.
 */
export function validateForm(
  form: SetupForm,
  names: NameContext = { savedNames: new Set(), saveNewNames: false },
): { setup: GameSetup | null; errors: FormErrors } {
  const errors: FormErrors = {};
  const target = parseInteger(form.target);
  if (target === null || target < MIN_TARGET || target > MAX_TARGET) {
    errors.target = `Escribe una meta entera entre ${MIN_TARGET} y ${MAX_TARGET}.`;
  }
  const bonuses = HOUSE_BONUSES.filter((b) => form.bonuses[b.code]?.enabled).map((b) => {
    const value = parseInteger(form.bonuses[b.code]!.value);
    if (value === null || value < 1 || value > 9999) {
      errors.bonuses = { ...errors.bonuses, [b.code]: 'Valor entre 1 y 9999.' };
    }
    return { ...b, value: value ?? b.value };
  });
  if (errors.target || errors.bonuses) return { setup: null, errors };

  const participant = (side: number, seat: number) => {
    const displayName = form.playerNames[side]?.[seat] ?? '';
    const playerId = form.playerIds[side]?.[seat] ?? null;
    if (playerId) return { playerId, displayName };
    const register = names.saveNewNames && !!displayName.trim() && !names.savedNames.has(normalizeName(displayName));
    return { displayName, register };
  };
  const sides =
    form.mode === 'pairs'
      ? [0, 1].map((i) => ({
          displayName: form.sideNames[i],
          participants: [0, 1].map((seat) => participant(i, seat)),
        }))
      : Array.from({ length: form.individualCount }, (_, i) => ({
          participants: [participant(i, 0)],
        }));

  return { setup: { mode: form.mode, target: target!, sides, bonuses }, errors };
}
