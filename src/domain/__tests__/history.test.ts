import { comparePeriods, filterHistory, NO_FILTER, periodProblem, type GameResult, type Period } from '../index';

let n = 0;
function game(
  sides: (string | null)[][],
  winner: number | null,
  at: number,
  status: GameResult['status'] = 'finished',
): GameResult {
  const id = `g${++n}`;
  return {
    gameId: id,
    sessionId: null,
    mode: sides[0]!.length === 2 ? 'pairs' : 'individual',
    status,
    startedAt: at,
    endedAt: status === 'active' ? null : at + 10,
    winnerSideId: winner === null ? null : `${id}-${winner}`,
    sides: sides.map((members, position) => ({
      id: `${id}-${position}`,
      position,
      displayName: `Lado ${position}`,
      compositionKey: members.every(Boolean) ? [...(members as string[])].sort().join('|') : null,
      members: members.map((playerId) => ({ playerId, displayName: playerId ?? 'Invitado' })),
    })),
  };
}

const AB_CD = [
  ['a', 'b'],
  ['c', 'd'],
];

describe('historial con filtros', () => {
  const results = [
    game(AB_CD, 0, 100),
    game(AB_CD, null, 200, 'abandoned'),
    game(
      [
        ['a', null],
        ['c', 'd'],
      ],
      1,
      300,
    ),
    game(AB_CD, null, 400, 'active'),
  ];

  test('sin filtros: cerradas, de la más reciente a la más antigua; la activa no aparece', () => {
    expect(filterHistory(results, NO_FILTER).map((r) => r.startedAt)).toEqual([300, 200, 100]);
  });

  test('por estado', () => {
    expect(filterHistory(results, { ...NO_FILTER, status: 'abandoned' }).map((r) => r.startedAt)).toEqual([200]);
    expect(filterHistory(results, { ...NO_FILTER, status: 'finished' }).map((r) => r.startedAt)).toEqual([300, 100]);
  });

  test('por jugador', () => {
    expect(filterHistory(results, { ...NO_FILTER, playerId: 'b' }).map((r) => r.startedAt)).toEqual([200, 100]);
  });

  test('por grupo: solo partidas donde todos eran del grupo (un invitado la saca)', () => {
    const filter = { ...NO_FILTER, groupMemberIds: ['a', 'b', 'c', 'd'] };
    expect(filterHistory(results, filter).map((r) => r.startedAt)).toEqual([200, 100]);
    expect(filterHistory(results, { ...filter, playerId: 'z' })).toEqual([]);
  });
});

describe('comparar periodos', () => {
  const a: Period = { from: 0, to: 1000 };
  const b: Period = { from: 1000, to: 2000 };
  const results = [
    game(AB_CD, 0, 100),
    game(AB_CD, 1, 200),
    game(AB_CD, null, 300, 'abandoned'),
    game(AB_CD, 0, 1500),
    game(
      [
        ['a', 'c'],
        ['b', 'd'],
      ],
      0,
      1600,
    ),
  ];

  test('persona: misma definición que las estadísticas; abandonadas no cuentan', () => {
    expect(comparePeriods(results, { kind: 'player', playerId: 'a' }, a, b)).toEqual({
      a: { played: 2, won: 1 },
      b: { played: 2, won: 2 },
    });
  });

  test('pareja exacta: con otro compañero es otra pareja', () => {
    expect(comparePeriods(results, { kind: 'pair', compositionKey: 'a|b' }, a, b)).toEqual({
      a: { played: 2, won: 1 },
      b: { played: 1, won: 1 },
    });
  });

  test('periodo sin partidas queda en cero partidas, no en 0 %', () => {
    const empty = comparePeriods(results, { kind: 'player', playerId: 'a' }, { from: 5000, to: 6000 }, b);
    expect(empty.a).toEqual({ played: 0, won: 0 });
  });

  test('periodos que se cruzan o al revés no se comparan; contiguos sí', () => {
    expect(periodProblem(a, b)).toBeNull();
    expect(periodProblem(a, { from: 999, to: 2000 })).toMatch(/se cruzan/);
    expect(periodProblem({ from: 10, to: 5 }, b)).toMatch(/terminar después/);
  });
});
