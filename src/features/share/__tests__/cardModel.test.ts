import { buildGame, computeOutcome, applyCommand, type GameState } from '../../../domain';
import { buildCardModel, logicalSize } from '../cardModel';

let n = 0;
const ctx = () => ({ now: 1_760_000_000_000, newId: () => `id-${++n}` });

function finished(): GameState {
  let state = buildGame(
    {
      mode: 'pairs',
      target: 100,
      bonuses: [],
      sides: [
        { displayName: 'Los del patio', participants: [{ displayName: 'César' }, { displayName: 'Luis' }] },
        { displayName: 'La visita', participants: [{ displayName: 'Ana' }, { displayName: 'José' }] },
      ],
    },
    ctx(),
  );
  const winner = state.sides[0]!.id;
  state = applyCommand(
    state,
    { type: 'add_entry', commandId: 'c1', kind: 'hand', sideId: winner, basePoints: 112, bonusCodes: [] },
    ctx(),
  ).state;
  return state;
}

describe('tarjeta de resultado', () => {
  test('usa los mismos totales y ganador que la partida', () => {
    const state = finished();
    const model = buildCardModel(state, computeOutcome(state), { hideNames: false });
    expect(model.winnerName).toBe('Los del patio');
    expect(model.sides.map((s) => s.total)).toEqual([112, 0]);
    expect(model.sides[0]!.members).toBe('César y Luis');
  });

  test('ocultar nombres deja solo las letras de equipo', () => {
    const state = finished();
    const model = buildCardModel(state, computeOutcome(state), { hideNames: true });
    const text = JSON.stringify(model);
    for (const name of ['César', 'Luis', 'Ana', 'José', 'patio', 'visita']) expect(text).not.toContain(name);
    expect(model.winnerName).toBe('Equipo A');
  });

  test('los formatos mantienen la proporción de 1080×1350 y 1080×1920', () => {
    expect(logicalSize('post')).toEqual({ width: 360, height: 450 });
    expect(logicalSize('story')).toEqual({ width: 360, height: 640 });
  });
});
