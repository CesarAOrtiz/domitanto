/**
 * @jest-environment node
 */
import { GameService, SESSION_GAP_MS } from '../../application/gameService';
import { PeopleService } from '../../application/peopleService';
import { winRate, type GameSetup } from '../../domain';
import { openTestDatabase } from '../../test/nodeSqlite';
import { migrate } from '../migrations';

async function setup() {
  const driver = openTestDatabase();
  await migrate(driver);
  let t = 1_760_000_000_000;
  let n = 0;
  const clock = { now: () => (t += 1000) };
  const ids = { newId: () => `id-${String(++n).padStart(4, '0')}` };
  const advance = (ms: number) => {
    t += ms;
  };
  return {
    driver,
    games: new GameService(driver, clock, ids),
    people: new PeopleService(driver, clock, ids),
    advance,
  };
}

let seq = 0;
const cmd = () => `cmd-${++seq}`;

function pairs(a: [string, string], b: [string, string]): GameSetup {
  return {
    mode: 'pairs',
    target: 100,
    bonuses: [],
    sides: [a, b].map((ids) => ({ participants: ids.map((playerId) => ({ playerId })) })),
  };
}

/** Juega una partida a meta 100 y hace ganar al lado indicado. */
async function play(games: GameService, setupOrId: GameSetup, winner: 0 | 1, groupId?: string) {
  const id = await games.createGame(setupOrId, cmd(), { groupId });
  const { state } = await games.getGame(id);
  const side = state.sides.find((s) => s.position === winner)!;
  await games.execute(id, { type: 'add_entry', commandId: cmd(), kind: 'hand', sideId: side.id, basePoints: 100, bonusCodes: [] });
  return id;
}

describe('jugadores', () => {
  test('los nombres marcados se guardan como jugadores al crear la partida', async () => {
    const { games, people } = await setup();
    const id = await games.createGame(
      {
        mode: 'pairs',
        target: 200,
        bonuses: [],
        sides: [
          { participants: [{ displayName: ' Ana ', register: true }, { displayName: 'Invitado' }] },
          { participants: [{}, { displayName: 'José', register: true }] },
        ],
      },
      cmd(),
    );
    const list = await people.players();
    expect(list.map((p) => p.displayName).sort()).toEqual(['Ana', 'José']);
    const { state } = await games.getGame(id);
    const ana = list.find((p) => p.displayName === 'Ana')!;
    expect(state.sides[0]!.participants[0]!.playerId).toBe(ana.id);
    expect(state.sides[0]!.participants[1]!.playerId).toBeNull();
  });

  test('reintentar la creación no duplica jugadores', async () => {
    const { games, people } = await setup();
    const setupData: GameSetup = {
      mode: 'individual',
      target: 100,
      bonuses: [],
      sides: [{ participants: [{ displayName: 'Luis', register: true }] }, { participants: [{}] }],
    };
    const command = cmd();
    const first = await games.createGame(setupData, command);
    expect(await games.createGame(setupData, command)).toBe(first);
    expect(await people.players()).toHaveLength(1);
  });

  test('dos personas con el mismo nombre son jugadores distintos y renombrar no cambia el historial', async () => {
    const { games, people } = await setup();
    const [a, b, c, d] = [
      await people.createPlayer('José'),
      await people.createPlayer('José'),
      await people.createPlayer('Ana'),
      await people.createPlayer('Luis'),
    ];
    const id = await play(games, pairs([a!.id, c!.id], [b!.id, d!.id]), 0);
    await people.renamePlayer(a!.id, 'José Miguel');
    const { state } = await games.getGame(id);
    expect(state.sides[0]!.participants[0]!.displayName).toBe('José');
    const profileA = await people.playerProfile(a!.id);
    const profileB = await people.playerProfile(b!.id);
    expect(profileA?.player.displayName).toBe('José Miguel');
    expect(profileA?.record).toMatchObject({ played: 1, won: 1 });
    expect(profileB?.record).toMatchObject({ played: 1, won: 0 });
  });

  test('una corrección que quita la victoria se refleja en las estadísticas', async () => {
    const { games, people } = await setup();
    const ps = await Promise.all(['A', 'B', 'C', 'D'].map((n) => people.createPlayer(n)));
    const id = await play(games, pairs([ps[0]!.id, ps[1]!.id], [ps[2]!.id, ps[3]!.id]), 0);
    const { state } = await games.getGame(id);
    const entry = state.entries[0]!;
    await games.execute(id, { type: 'edit_entry', commandId: cmd(), entryId: entry.id, basePoints: 40, bonusCodes: [] });
    const profile = await people.playerProfile(ps[0]!.id);
    expect(profile?.record).toBeNull();
  });
});

describe('sesiones automáticas', () => {
  test('partidas seguidas comparten sesión; tras una pausa larga empieza otra', async () => {
    const { games, people, advance } = await setup();
    const ps = await Promise.all(['A', 'B', 'C', 'D'].map((n) => people.createPlayer(n)));
    const [a, b, c, d] = ps.map((p) => p.id) as [string, string, string, string];
    const g1 = await play(games, pairs([a, b], [c, d]), 0);
    const g2 = await play(games, pairs([a, c], [b, d]), 1);
    const s1 = (await games.getGame(g1)).state.sessionId;
    expect(s1).not.toBeNull();
    expect((await games.getGame(g2)).state.sessionId).toBe(s1);

    const overview = await people.sessionOverview(s1!);
    expect(overview?.summary.games.map((g) => g.pairsChanged)).toEqual([false, true]);
    expect(overview?.summary.pairs).toHaveLength(4);
    expect(overview?.summary.players.find((p) => p.playerId === b)).toMatchObject({ played: 2, won: 2 });
    expect((await people.currentSession())?.id).toBe(s1);

    advance(SESSION_GAP_MS + 1);
    expect(await people.currentSession()).toBeNull();
    const g3 = await play(games, pairs([a, b], [c, d]), 0);
    const s3 = (await games.getGame(g3)).state.sessionId;
    expect(s3).not.toBe(s1);
    expect((await people.sessionOverview(s1!))?.session.endedAt).not.toBeNull();
  });

  test('la revancha sigue en la misma sesión', async () => {
    const { games, people } = await setup();
    const ps = await Promise.all(['A', 'B', 'C', 'D'].map((n) => people.createPlayer(n)));
    const g1 = await play(games, pairs([ps[0]!.id, ps[1]!.id], [ps[2]!.id, ps[3]!.id]), 0);
    const g2 = await games.rematch(g1, cmd());
    expect((await games.getGame(g2)).state.sessionId).toBe((await games.getGame(g1)).state.sessionId);
  });

  test('jugar con otro grupo abre una sesión nueva', async () => {
    const { games, people } = await setup();
    const ps = await Promise.all(['A', 'B', 'C', 'D'].map((n) => people.createPlayer(n)));
    const ids = ps.map((p) => p.id) as [string, string, string, string];
    const g1 = await people.saveGroup({ name: 'Los viernes', memberIds: ids });
    const g2 = await people.saveGroup({ name: 'Familia', memberIds: ids });
    const a = await play(games, pairs([ids[0], ids[1]], [ids[2], ids[3]]), 0, g1);
    const b = await play(games, pairs([ids[0], ids[1]], [ids[2], ids[3]]), 0, g2);
    const sa = (await games.getGame(a)).state.sessionId!;
    const sb = (await games.getGame(b)).state.sessionId!;
    expect(sa).not.toBe(sb);
    expect((await people.sessionOverview(sa))?.group?.name).toBe('Los viernes');
  });
});

describe('grupos', () => {
  test('las estadísticas del grupo solo cuentan partidas entre sus integrantes', async () => {
    const { games, people } = await setup();
    const ps = await Promise.all(['César', 'Luis', 'Ana', 'José', 'Otro'].map((n) => people.createPlayer(n)));
    const [c, l, a, j, o] = ps.map((p) => p.id) as [string, string, string, string, string];
    const groupId = await people.saveGroup({ name: 'Los viernes', memberIds: [c, l, a, j, c] });
    await play(games, pairs([c, l], [a, j]), 0);
    await play(games, pairs([c, l], [a, j]), 1);
    await play(games, pairs([c, l], [a, j]), 0);
    await play(games, pairs([c, o], [a, j]), 0);

    const overview = await people.groupOverview(groupId);
    expect(overview?.members.map((m) => m.displayName)).toEqual(['César', 'Luis', 'Ana', 'José']);
    expect(overview?.decisive).toBe(3);
    const pair = overview?.pairs.find((p) => p.playerIds.includes(c) && p.playerIds.includes(l));
    expect(pair).toMatchObject({ played: 3, won: 2 });
    expect(winRate(pair!)).toBe(67);
  });

  test('borrar un grupo conserva partidas y jugadores', async () => {
    const { games, people } = await setup();
    const ps = await Promise.all(['A', 'B', 'C', 'D'].map((n) => people.createPlayer(n)));
    const ids = ps.map((p) => p.id) as [string, string, string, string];
    const groupId = await people.saveGroup({ name: 'G', memberIds: ids });
    const gameId = await play(games, pairs([ids[0], ids[1]], [ids[2], ids[3]]), 0, groupId);
    await people.deleteGroup(groupId);
    expect(await people.groups()).toHaveLength(0);
    expect(await people.players()).toHaveLength(4);
    expect((await games.getGame(gameId)).state.status).toBe('finished');
  });

  test('un nombre vacío se rechaza', async () => {
    const { people } = await setup();
    await expect(people.saveGroup({ name: '   ', memberIds: [] })).rejects.toThrow(/nombre/);
    await expect(people.createPlayer('')).rejects.toThrow(/nombre/);
  });
});
