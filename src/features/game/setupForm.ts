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
    });
  } else {
    sides.forEach((s, i) => {
      form.sideNames[i] = isPlaceholderName(s.displayName) ? '' : s.displayName;
      form.playerNames[i] = s.participants.map((p) => (isPlaceholderName(p.displayName) ? '' : p.displayName));
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

export function validateForm(form: SetupForm): { setup: GameSetup | null; errors: FormErrors } {
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

  const sides =
    form.mode === 'pairs'
      ? [0, 1].map((i) => ({
          displayName: form.sideNames[i],
          participants: [0, 1].map((seat) => ({ displayName: form.playerNames[i]?.[seat] })),
        }))
      : Array.from({ length: form.individualCount }, (_, i) => ({
          participants: [{ displayName: form.playerNames[i]?.[0] }],
        }));

  return { setup: { mode: form.mode, target: target!, sides, bonuses }, errors };
}
