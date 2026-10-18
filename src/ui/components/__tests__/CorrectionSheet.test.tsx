import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  applyCommand,
  buildGame,
  computeOutcome,
  quickGameSetup,
  type GameCommand,
  type GameState,
} from '../../../domain';
import { CorrectionSheet } from '../CorrectionSheet';

function exampleGame(): GameState {
  let n = 0;
  const ctx = { now: 1, newId: () => `id${++n}` };
  let state = buildGame(
    {
      ...quickGameSetup(),
      sides: [
        { displayName: 'Los del patio', participants: [{}, {}] },
        { displayName: 'La visita', participants: [{}, {}] },
      ],
    },
    ctx,
  );
  const [A, B] = state.sides.map((s) => s.id) as [string, string];
  const hands: [string, number][] = [
    [A, 45],
    [B, 36],
    [A, 28],
    [B, 60],
    [A, 55],
    [B, 47],
  ];
  hands.forEach(([sideId, basePoints], i) => {
    state = applyCommand(
      state,
      { type: 'add_entry', commandId: `c${i}`, kind: 'hand', sideId, basePoints, bonusCodes: [] },
      ctx,
    ).state;
  });
  return state;
}

async function renderSheet(state: GameState, sequence: number, onSubmit: (c: GameCommand) => Promise<void>) {
  const view = computeOutcome(state).entries.find((v) => v.entry.sequence === sequence)!;
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 800 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <CorrectionSheet
        view={view}
        state={state}
        makeCommandId={() => 'cmd-x'}
        onSubmit={onSubmit}
        onClose={() => undefined}
      />
    </SafeAreaProvider>,
  );
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));

describe('CorrectionSheet', () => {
  test('corregir 47 a 37 previsualiza 128–133 antes de guardar', async () => {
    const onSubmit = jest.fn(async () => undefined);
    const state = exampleGame();
    await renderSheet(state, 6, onSubmit);
    await press('key-clear');
    await press('key-3');
    await press('key-7');
    expect(screen.getByTestId('preview-after')).toHaveTextContent('128–133');
    expect(onSubmit).not.toHaveBeenCalled();
    await press('confirm-correction');
    expect(onSubmit).toHaveBeenCalledWith({
      type: 'edit_entry',
      commandId: 'cmd-x',
      entryId: state.entries[5]!.id,
      basePoints: 37,
      bonusCodes: [],
    });
  });

  test('una corrección que adelanta el final avisa del cierre y de las manos que quedan fuera', async () => {
    await renderSheet(
      exampleGame(),
      1,
      jest.fn(async () => undefined),
    );
    await press('key-clear');
    for (const d of '117') await press(`key-${d}`);
    expect(screen.getByText(/La partida termina: gana Los del patio/)).toBeTruthy();
    expect(screen.getByText(/Quedan fuera de resultado: mano 6/)).toBeTruthy();
  });

  test('sin cambios no se puede guardar', async () => {
    const onSubmit = jest.fn(async () => undefined);
    await renderSheet(exampleGame(), 6, onSubmit);
    expect(screen.getByText('La corrección no cambia nada.')).toBeTruthy();
    await press('confirm-correction');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('cambiar de equipo envía la reasignación', async () => {
    const onSubmit = jest.fn(async () => undefined);
    const state = exampleGame();
    await renderSheet(state, 6, onSubmit);
    await fireEvent.press(screen.getByText('Equipo'));
    await press('reassign-A');
    expect(screen.getByTestId('preview-after')).toHaveTextContent('175–96');
    await press('confirm-correction');
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reassign_entry', sideId: state.sides[0]!.id }),
    );
  });
});
