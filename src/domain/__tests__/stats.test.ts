import { pairRecords, playerRecord, summarizeSession, winRate, type GameResult } from '../stats';

let n = 0;
function game(
  sides: (string | null)[][],
  winner: number | null,
  status: GameResult['status'] = 'finished',
): GameResult {
  const t = ++n * 1000;
  const id = `g${n}`;
  return {
    gameId: id,
    sessionId: 's1',
    mode: sides[0]!.length === 2 ? 'pairs' : 'individual',
    status,
    startedAt: t,
    endedAt: status === 'active' ? null : t + 500,
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

describe('estadísticas', () => {
  test('cero partidas no es 0 %', () => {
    expect(winRate({ played: 0, won: 0 })).toBeNull();
    expect(winRate({ played: 3, won: 0 })).toBe(0);
  });

  test('abandonadas y activas no cuentan; la racha sigue el orden de fin', () => {
    const results = [
      game([['a', 'b'], ['c', 'd']], 1),
      game([['a', 'b'], ['c', 'd']], 0),
      game([['a', 'b'], ['c', 'd']], null, 'abandoned'),
      game([['a', 'b'], ['c', 'd']], 0),
      game([['a', 'b'], ['c', 'd']], null, 'active'),
    ];
    expect(playerRecord(results, 'a')).toMatchObject({ played: 3, won: 2, streak: { kind: 'win', length: 2 } });
    expect(playerRecord(results, 'c')).toMatchObject({ played: 3, won: 1, streak: { kind: 'loss', length: 2 } });
  });

  test('los invitados no tienen récord y su pareja no es una pareja exacta', () => {
    const results = [game([['a', null], ['c', 'd']], 0)];
    expect(playerRecord(results, 'a')).toMatchObject({ played: 1, won: 1 });
    expect(pairRecords(results).map((p) => p.compositionKey)).toEqual(['c|d']);
  });

  test('la misma pareja en otro orden de asientos es la misma pareja', () => {
    const results = [game([['a', 'b'], ['c', 'd']], 0), game([['b', 'a'], ['d', 'c']], 0)];
    expect(pairRecords(results).find((p) => p.compositionKey === 'a|b')).toMatchObject({ played: 2, won: 2 });
  });

  test('la sesión marca cuándo cambian las parejas', () => {
    const summary = summarizeSession([
      game([['a', 'b'], ['c', 'd']], 0),
      game([['b', 'a'], ['c', 'd']], 0),
      game([['a', 'c'], ['b', 'd']], 1),
    ]);
    expect(summary.games.map((g) => g.pairsChanged)).toEqual([false, false, true]);
    expect(summary.decisive).toBe(3);
  });
});
