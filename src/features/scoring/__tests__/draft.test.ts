import type { BonusRule } from '../../../domain';
import { confirmLabel, draftReducer, emptyDraft, summarizeDraft, type DraftAction } from '../draft';

/** Regla de la casa solo para pruebas: la app no ofrece ninguna por ahora. */
const TEST_BONUSES: readonly BonusRule[] = [{ code: 'capicua', label: 'Capicúa', value: 25, repeatable: false }];

const apply = (actions: DraftAction[], start = emptyDraft('A')) => actions.reduce(draftReducer, start);

describe('borrador de apunte', () => {
  test('flujo 47: tocar 4, 7 y confirmar nombra al destinatario', () => {
    const d = apply([
      { type: 'digit', digit: '4' },
      { type: 'digit', digit: '7' },
    ]);
    const s = summarizeDraft(d, []);
    expect(s).toMatchObject({ total: 47, valid: true, breakdown: null });
    expect(confirmLabel(s.total, 'La visita')).toBe('Anotar 47 a La visita');
  });

  test('campo vacío y cero no son válidos', () => {
    expect(summarizeDraft(emptyDraft('A'), []).valid).toBe(false);
    expect(summarizeDraft(apply([{ type: 'digit', digit: '0' }]), []).problem).toMatch(/Mano sin puntos/);
  });

  test('sin equipo no se puede confirmar', () => {
    expect(summarizeDraft(apply([{ type: 'digit', digit: '5' }], emptyDraft(null)), []).problem).toBe(
      'Elige el equipo',
    );
  });

  test('límite técnico de 9999 y sin ceros a la izquierda', () => {
    const d = apply(['9', '9', '9', '9', '9'].map((digit) => ({ type: 'digit', digit }) as DraftAction));
    expect(d.digits).toBe('9999');
    expect(
      apply([
        { type: 'digit', digit: '0' },
        { type: 'digit', digit: '7' },
      ]).digits,
    ).toBe('7');
    expect(apply([{ type: 'digit', digit: '.' }]).digits).toBe('');
  });

  test('el atajo rellena la cantidad sin guardar y se puede corregir', () => {
    const d = apply([{ type: 'shortcut', value: 25 }, { type: 'backspace' }]);
    expect(d.digits).toBe('2');
  });

  test('resumen con bonificación: Fichas 47 + capicúa 25 = 72', () => {
    const d = apply([
      { type: 'digit', digit: '4' },
      { type: 'digit', digit: '7' },
      { type: 'toggle_bonus', code: 'capicua' },
    ]);
    const s = summarizeDraft(d, [...TEST_BONUSES]);
    expect(s.breakdown).toBe('Fichas 47 + capicúa 25 = 72');
    expect(s.total).toBe(72);
  });
});
