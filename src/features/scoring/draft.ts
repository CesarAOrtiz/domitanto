import { MAX_POINTS, type BonusRule } from '../../domain';

/** Borrador del apunte en curso. Vive en la interfaz hasta que el commit se confirma. */
export interface EntryDraft {
  sideId: string | null;
  digits: string;
  bonusCodes: string[];
}

export type DraftAction =
  | { type: 'digit'; digit: string }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'shortcut'; value: number }
  | { type: 'side'; sideId: string }
  | { type: 'toggle_bonus'; code: string }
  | { type: 'reset'; sideId: string | null };

const MAX_DIGITS = String(MAX_POINTS).length;

export function emptyDraft(sideId: string | null = null): EntryDraft {
  return { sideId, digits: '', bonusCodes: [] };
}

export function draftReducer(draft: EntryDraft, action: DraftAction): EntryDraft {
  switch (action.type) {
    case 'digit': {
      if (!/^\d$/.test(action.digit)) return draft;
      const next = draft.digits === '0' ? action.digit : draft.digits + action.digit;
      if (next.length > MAX_DIGITS || Number(next) > MAX_POINTS) return draft;
      return { ...draft, digits: next };
    }
    case 'backspace':
      return { ...draft, digits: draft.digits.slice(0, -1) };
    case 'clear':
      return { ...draft, digits: '' };
    case 'shortcut':
      // Los atajos rellenan la cantidad; nunca guardan por sorpresa.
      return { ...draft, digits: String(Math.min(MAX_POINTS, Math.max(0, Math.trunc(action.value)))) };
    case 'side':
      return { ...draft, sideId: action.sideId };
    case 'toggle_bonus':
      return draft.bonusCodes.includes(action.code)
        ? { ...draft, bonusCodes: draft.bonusCodes.filter((c) => c !== action.code) }
        : { ...draft, bonusCodes: [...draft.bonusCodes, action.code] };
    case 'reset':
      return emptyDraft(action.sideId);
  }
}

export interface DraftSummary {
  basePoints: number | null;
  total: number;
  /** «Fichas 47 + capicúa 25 = 72», o null si no hay bonificaciones. */
  breakdown: string | null;
  valid: boolean;
  problem: string | null;
}

export function summarizeDraft(draft: EntryDraft, rules: BonusRule[]): DraftSummary {
  const basePoints = draft.digits === '' ? null : Number(draft.digits);
  const bonuses = draft.bonusCodes.map((code) => rules.find((r) => r.code === code)).filter((r): r is BonusRule => !!r);
  const bonusTotal = bonuses.reduce((s, b) => s + b.value, 0);
  const total = (basePoints ?? 0) + bonusTotal;
  const breakdown =
    bonuses.length > 0
      ? `Fichas ${basePoints ?? 0} + ${bonuses.map((b) => `${b.label.toLowerCase()} ${b.value}`).join(' + ')} = ${total}`
      : null;

  let problem: string | null = null;
  if (!draft.sideId) problem = 'Elige el equipo';
  else if (basePoints === null && bonuses.length === 0) problem = 'Escribe los puntos';
  else if (total === 0) problem = 'Un cero no se anota: usa «Mano sin puntos»';
  return { basePoints, total, breakdown, valid: problem === null, problem };
}

export function confirmLabel(total: number, sideName: string): string {
  return `Anotar ${total} a ${sideName}`;
}
