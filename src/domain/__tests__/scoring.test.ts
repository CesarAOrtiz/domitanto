import {
  applyCommand,
  buildGame,
  computeOutcome,
  DomainError,
  HOUSE_BONUSES,
  previewCommand,
  quickGameSetup,
  type GameCommand,
  type GameSetup,
  type GameState,
} from '..';

function harness(setup: GameSetup = quickGameSetup()) {
  let n = 0;
  let t = 1000;
  let c = 0;
  const ctx = () => ({ now: (t += 1), newId: () => `id${++n}` });
  let state = buildGame(setup, ctx());
  const [A, B] = state.sides.map((s) => s.id) as [string, string];
  const run = (command: GameCommand) => {
    const result = applyCommand(state, command, ctx());
    state = result.state;
    return result;
  };
  const add = (sideId: string, basePoints: number, bonusCodes: string[] = []) =>
    run({ type: 'add_entry', commandId: `c${++c}`, kind: 'hand', sideId, basePoints, bonusCodes });
  const totals = () => {
    const o = computeOutcome(state);
    return state.sides.map((s) => o.totals[s.id]);
  };
  return {
    A,
    B,
    run,
    add,
    totals,
    get state(): GameState {
      return state;
    },
    ctx,
    nextCommandId: () => `c${++c}`,
  };
}

function entryIdAt(state: GameState, sequence: number): string {
  const entry = state.entries.find((e) => e.sequence === sequence);
  if (!entry) throw new Error('sin apunte');
  return entry.id;
}

function exampleGame() {
  const h = harness();
  h.add(h.A, 45);
  h.add(h.B, 36);
  h.add(h.A, 28);
  h.add(h.B, 60);
  h.add(h.A, 55);
  return h;
}

describe('puntuación (pruebas de aceptación de la especificación)', () => {
  test('2. A +45, B +36, A +28, B +60, A +55 da 128–96', () => {
    const h = exampleGame();
    expect(h.totals()).toEqual([128, 96]);
    expect(computeOutcome(h.state).handsPlayed).toBe(5);
  });

  test('3. B +47, corregir a 37 y deshacer la corrección', () => {
    const h = exampleGame();
    h.add(h.B, 47);
    expect(h.totals()).toEqual([128, 143]);
    h.run({
      type: 'edit_entry',
      commandId: h.nextCommandId(),
      entryId: entryIdAt(h.state, 6),
      basePoints: 37,
      bonusCodes: [],
    });
    expect(h.totals()).toEqual([128, 133]);
    h.run({ type: 'undo', commandId: h.nextCommandId() });
    expect(h.totals()).toEqual([128, 143]);
    // El rastro se conserva: creada, editada y compensada.
    const entry = h.state.entries.find((e) => e.sequence === 6)!;
    expect(entry.revisions.map((r) => r.reason)).toEqual(['created', 'edited', 'undo']);
  });

  test('4 y 5. A +84 cierra 212–143 sin recortar; corregir a 14 reabre 142–143', () => {
    const h = exampleGame();
    h.add(h.B, 47);
    const close = h.add(h.A, 84);
    expect(h.totals()).toEqual([212, 143]);
    expect(close.outcome.status).toBe('finished');
    expect(close.outcome.winnerSideId).toBe(h.A);
    expect(h.state.status).toBe('finished');

    const reopened = h.run({
      type: 'edit_entry',
      commandId: h.nextCommandId(),
      entryId: entryIdAt(h.state, 7),
      basePoints: 14,
      bonusCodes: [],
    });
    expect(h.totals()).toEqual([142, 143]);
    expect(reopened.outcome.status).toBe('active');
    expect(reopened.outcome.winnerSideId).toBeNull();
    expect(h.state.endedAt).toBeNull();
  });

  test('alcanzar la meta exacta termina la partida y bloquea nuevos apuntes', () => {
    const h = harness();
    h.add(h.A, 150);
    h.add(h.A, 50);
    expect(h.totals()).toEqual([200, 0]);
    expect(h.state.status).toBe('finished');
    expect(() => h.add(h.B, 10)).toThrow(DomainError);
  });

  test('6. bonificación: 47 + capicúa 25 = 72, congelada en la partida', () => {
    const rules = HOUSE_BONUSES.map((b) => ({ ...b }));
    const h = harness({ ...quickGameSetup(), bonuses: rules });
    const r = h.add(h.A, 47, ['capicua']);
    expect(r.outcome.totals[h.A]).toBe(72);
    // Cambiar la regla global después no altera la copia de la partida.
    rules[0]!.value = 50;
    expect(h.state.rules.bonuses[0]!.value).toBe(25);
    expect(computeOutcome(h.state).totals[h.A]).toBe(72);
  });

  test('bonificación desactivada o repetida se rechaza', () => {
    const h = harness();
    expect(() => h.add(h.A, 47, ['capicua'])).toThrow(/no está activa/);
    const h2 = harness({ ...quickGameSetup(), bonuses: [...HOUSE_BONUSES] });
    expect(() => h2.add(h2.A, 47, ['capicua', 'capicua'])).toThrow(/dos veces/);
  });

  test('apunte de bonificación independiente no cuenta como mano', () => {
    const h = harness({ ...quickGameSetup(), bonuses: [...HOUSE_BONUSES] });
    h.add(h.A, 30);
    const r = h.run({
      type: 'add_entry',
      commandId: 'b1',
      kind: 'bonus',
      sideId: h.A,
      basePoints: 0,
      bonusCodes: ['capicua'],
    });
    expect(r.outcome.totals[h.A]).toBe(55);
    expect(r.outcome.handsPlayed).toBe(1);
  });

  test('7. dos comandos distintos de 25 puntos producen dos apuntes', () => {
    const h = harness();
    h.add(h.A, 25);
    h.add(h.A, 25);
    expect(h.totals()).toEqual([50, 0]);
    expect(h.state.entries).toHaveLength(2);
  });

  test('9. reasignar una mano de A a B recalcula ambos totales', () => {
    const h = exampleGame();
    const r = h.run({
      type: 'reassign_entry',
      commandId: h.nextCommandId(),
      entryId: entryIdAt(h.state, 1),
      sideId: h.B,
    });
    expect(h.totals()).toEqual([83, 141]);
    expect(r.outcome.status).toBe('active');
  });

  test('10. corrección que adelanta el final: previsualiza, cancelar no cambia nada, aceptar conserva trazas', () => {
    const h = exampleGame(); // 128–96
    h.add(h.B, 47); // 128–143
    const before = h.state;
    const command: GameCommand = {
      type: 'edit_entry',
      commandId: h.nextCommandId(),
      entryId: entryIdAt(h.state, 1),
      basePoints: 117, // A: 117 + 28 + 55 = 200 en la mano 5
      bonusCodes: [],
    };
    const preview = previewCommand(h.state, command, h.ctx());
    expect(preview.after.status).toBe('finished');
    expect(preview.after.closingSequence).toBe(5);
    expect(preview.newlyExcluded).toEqual([6]);
    expect(preview.winnerChanged).toBe(true);
    // Previsualizar (o cancelar) no muta el estado.
    expect(h.state).toBe(before);
    expect(h.totals()).toEqual([128, 143]);

    h.run(command);
    const outcome = computeOutcome(h.state);
    expect(outcome.status).toBe('finished');
    expect(outcome.winnerSideId).toBe(h.A);
    expect(h.totals()).toEqual([200, 96]);
    // Nada se elimina: la mano 6 sigue en el registro, fuera de resultado.
    expect(h.state.entries).toHaveLength(6);
    expect(outcome.entries.map((e) => e.state)).toEqual([
      'counted',
      'counted',
      'counted',
      'counted',
      'counted',
      'out_of_result',
    ]);
    expect(outcome.entries[0]!.corrected).toBe(true);
  });

  test('una corrección posterior puede reactivar apuntes fuera de resultado', () => {
    const h = harness();
    h.add(h.A, 100);
    h.add(h.B, 50);
    h.add(h.A, 100); // cierra 200–50
    // Llevar el cierre antes: primera mano a 200 deja fuera la 2 y la 3.
    h.run({ type: 'edit_entry', commandId: 'e1', entryId: entryIdAt(h.state, 1), basePoints: 200, bonusCodes: [] });
    expect(computeOutcome(h.state).entries.map((e) => e.state)).toEqual(['counted', 'out_of_result', 'out_of_result']);
    const preview = previewCommand(
      h.state,
      { type: 'edit_entry', commandId: 'e2', entryId: entryIdAt(h.state, 1), basePoints: 100, bonusCodes: [] },
      h.ctx(),
    );
    expect(preview.reactivated).toEqual([2, 3]);
  });

  test('deshacer funciona como pila y anular conserva el registro', () => {
    const h = harness();
    h.add(h.A, 10);
    h.add(h.B, 20);
    h.run({ type: 'void_entry', commandId: 'v1', entryId: entryIdAt(h.state, 1) });
    expect(h.totals()).toEqual([0, 20]);
    h.run({ type: 'undo', commandId: 'u1' }); // deshace la anulación
    expect(h.totals()).toEqual([10, 20]);
    h.run({ type: 'undo', commandId: 'u2' }); // deshace B +20
    expect(h.totals()).toEqual([10, 0]);
    h.run({ type: 'undo', commandId: 'u3' }); // deshace A +10
    expect(h.totals()).toEqual([0, 0]);
    expect(() => h.run({ type: 'undo', commandId: 'u4' })).toThrow(/nada que deshacer/);
    expect(h.state.entries).toHaveLength(2);
  });

  test('13. mano sin puntos y cantidades inválidas', () => {
    const h = harness();
    const r = h.run({
      type: 'add_entry',
      commandId: 's1',
      kind: 'scoreless_hand',
      sideId: null,
      basePoints: 0,
      bonusCodes: [],
    });
    expect(r.outcome.handsPlayed).toBe(1);
    expect(h.totals()).toEqual([0, 0]);
    expect(() => h.add(h.A, 0)).toThrow(/Mano sin puntos/);
    expect(() => h.add(h.A, -5)).toThrow(DomainError);
    expect(() => h.add(h.A, 2.5)).toThrow(DomainError);
    expect(() => h.add(h.A, 10000)).toThrow(DomainError);
    expect(() =>
      h.run({ type: 'add_entry', commandId: 'x', kind: 'hand', sideId: null, basePoints: 10, bonusCodes: [] }),
    ).toThrow(/Elige/);
  });

  test.each([2, 3, 4])('13. individual de %i participantes', (count) => {
    const setup: GameSetup = {
      mode: 'individual',
      target: 100,
      bonuses: [],
      sides: Array.from({ length: count }, (_, i) => ({ participants: [{ displayName: `P${i + 1}` }] })),
    };
    const h = harness(setup);
    const ids = h.state.sides.map((s) => s.id);
    ids.forEach((id, i) => h.add(id, 10 * (i + 1)));
    const last = ids[count - 1]!;
    const r = h.add(last, 95);
    expect(r.outcome.winnerSideId).toBe(last);
    expect(r.outcome.totals[last]).toBe(10 * count + 95);
  });
});

describe('configuración de partida', () => {
  test('partida rápida: equipos A/B provisionales y meta 200', () => {
    const h = harness();
    expect(h.state.rules.target).toBe(200);
    expect(h.state.sides.map((s) => s.displayName)).toEqual(['Equipo A', 'Equipo B']);
    expect(h.state.rules.bonuses).toEqual([]);
  });

  test('meta fuera de 1–9999 o no entera se rechaza', () => {
    for (const target of [0, 10000, 150.5]) {
      expect(() => buildGame({ ...quickGameSetup(), target }, { now: 1, newId: () => 'x' })).toThrow(DomainError);
    }
  });

  test('12. la misma identidad no puede estar dos veces; mismo nombre sí', () => {
    let n = 0;
    const ctx = { now: 1, newId: () => `i${++n}` };
    expect(() =>
      buildGame(
        {
          ...quickGameSetup(),
          sides: [
            { participants: [{ playerId: 'p1' }, { playerId: 'p2' }] },
            { participants: [{ playerId: 'p1' }, { playerId: 'p3' }] },
          ],
        },
        ctx,
      ),
    ).toThrow(/dos veces/);
    const game = buildGame(
      {
        ...quickGameSetup(),
        sides: [
          {
            participants: [
              { playerId: 'p1', displayName: 'José' },
              { playerId: 'p2', displayName: 'José' },
            ],
          },
          { participants: [{ playerId: 'p3' }, { playerId: 'p4' }] },
        ],
      },
      ctx,
    );
    expect(game.sides[0]!.participants.map((p) => p.displayName)).toEqual(['José', 'José']);
  });

  test('la clave de pareja no depende del orden de asientos', () => {
    let n = 0;
    const ctx = { now: 1, newId: () => `i${++n}` };
    const a = buildGame(
      {
        ...quickGameSetup(),
        sides: [{ participants: [{ playerId: 'p2' }, { playerId: 'p1' }] }, { participants: [{}, {}] }],
      },
      ctx,
    );
    const b = buildGame(
      {
        ...quickGameSetup(),
        sides: [{ participants: [{ playerId: 'p1' }, { playerId: 'p2' }] }, { participants: [{}, {}] }],
      },
      ctx,
    );
    expect(a.sides[0]!.compositionKey).toBe('p1|p2');
    expect(a.sides[0]!.compositionKey).toBe(b.sides[0]!.compositionKey);
    // Invitados sin identidad no forman composición estadística.
    expect(a.sides[1]!.compositionKey).toBeNull();
  });
});
