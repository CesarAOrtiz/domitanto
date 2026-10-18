import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { buildGame, quickGameSetup } from '../../../domain';
import { ScoreEntrySheet, type EntrySubmission } from '../ScoreEntrySheet';

let n = 0;
const game = buildGame(
  {
    ...quickGameSetup(),
    sides: [
      { displayName: 'Los del patio', participants: [{}, {}] },
      { displayName: 'La visita', participants: [{}, {}] },
    ],
  },
  { now: 1, newId: () => `id${++n}` },
);
const [A, B] = game.sides;

async function renderSheet(onSubmit: (e: EntrySubmission) => Promise<void>, initialSideId: string | null = A!.id) {
  let c = 0;
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 800 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ScoreEntrySheet
        visible
        sides={game.sides}
        bonuses={[]}
        initialSideId={initialSideId}
        makeCommandId={() => `cmd-${++c}`}
        onSubmit={onSubmit}
        onClose={() => undefined}
      />
    </SafeAreaProvider>,
  );
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));

describe('ScoreEntrySheet', () => {
  test('cambiar de equipo actualiza la confirmación con el destinatario', async () => {
    const onSubmit = jest.fn(async () => undefined);
    await renderSheet(onSubmit);
    await press('key-4');
    await press('key-7');
    expect(screen.getByText('Anotar 47 a Los del patio')).toBeTruthy();
    await press('side-B');
    expect(screen.getByText('Anotar 47 a La visita')).toBeTruthy();
    await press('confirm-entry');
    expect(onSubmit).toHaveBeenCalledWith({
      commandId: 'cmd-1',
      kind: 'hand',
      sideId: B!.id,
      basePoints: 47,
      bonusCodes: [],
    });
  });

  test('campo vacío no permite confirmar', async () => {
    const onSubmit = jest.fn(async () => undefined);
    await renderSheet(onSubmit);
    expect(screen.getByText('Escribe los puntos')).toBeTruthy();
    await press('confirm-entry');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('un error conserva el borrador y el reintento reutiliza el commandId', async () => {
    const onSubmit = jest
      .fn<Promise<void>, [EntrySubmission]>()
      .mockRejectedValueOnce(new Error('El teléfono no pudo escribir.'))
      .mockResolvedValueOnce(undefined);
    await renderSheet(onSubmit);
    await press('key-2');
    await press('key-5');
    await press('confirm-entry');
    expect(screen.getByText(/No se guardó/)).toBeTruthy();
    expect(screen.getByTestId('amount')).toHaveTextContent('25');
    expect(screen.getByText('Reintentar: Anotar 25 a Los del patio')).toBeTruthy();
    await press('confirm-entry');
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit.mock.calls[0]![0].commandId).toBe(onSubmit.mock.calls[1]![0].commandId);
  });

  test('mano sin puntos exige una confirmación explícita', async () => {
    const onSubmit = jest.fn(async () => undefined);
    await renderSheet(onSubmit);
    await press('scoreless');
    expect(onSubmit).not.toHaveBeenCalled();
    await press('confirm-scoreless');
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'scoreless_hand', sideId: null, basePoints: 0 }),
    );
  });
});
