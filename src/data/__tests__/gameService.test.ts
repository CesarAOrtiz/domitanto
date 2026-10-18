/**
 * @jest-environment node
 */
import { ActiveGameExistsError, GameService } from '../../application/gameService';
import { quickGameSetup, type BonusRule, type GameCommand } from '../../domain';
import { openTestDatabase, testDeps, type TestDriver } from '../../test/nodeSqlite';
import { migrate, MIGRATIONS, MigrationError, currentSchemaVersion } from '../migrations';
import { loadGame } from '../gameRepository';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Regla de la casa solo para pruebas: la app no ofrece ninguna por ahora. */
const TEST_BONUSES: readonly BonusRule[] = [{ code: 'capicua', label: 'Capicúa', value: 25, repeatable: false }];

async function setup(driver: TestDriver = openTestDatabase()) {
  await migrate(driver);
  const deps = testDeps();
  const service = new GameService(driver, deps.clock, deps.ids);
  return { driver, service };
}

let commandSeq = 0;
const cmd = () => `cmd-${++commandSeq}`;
const hand = (sideId: string, basePoints: number, commandId = cmd(), bonusCodes: string[] = []): GameCommand => ({
  type: 'add_entry',
  commandId,
  kind: 'hand',
  sideId,
  basePoints,
  bonusCodes,
});

async function exampleGame(service: GameService) {
  const gameId = await service.createGame(quickGameSetup(), cmd());
  const { state } = await service.getGame(gameId);
  const [A, B] = state.sides.map((s) => s.id) as [string, string];
  for (const [side, pts] of [
    [A, 45],
    [B, 36],
    [A, 28],
    [B, 60],
    [A, 55],
  ] as const) {
    await service.execute(gameId, hand(side, pts));
  }
  return { gameId, A, B };
}

async function countRows(driver: TestDriver, table: string): Promise<number> {
  const row = await driver.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return row?.n ?? 0;
}

async function victories(driver: TestDriver, sideId: string): Promise<number> {
  const row = await driver.first<{ n: number }>(
    "SELECT COUNT(*) AS n FROM games WHERE status = 'finished' AND winner_side_id = ?",
    [sideId],
  );
  return row?.n ?? 0;
}

describe('migraciones', () => {
  test('crean el esquema y son idempotentes', async () => {
    const driver = openTestDatabase();
    expect(await migrate(driver)).toBe(MIGRATIONS.length);
    expect(await migrate(driver)).toBe(MIGRATIONS.length);
    const fk = await driver.first<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(fk?.foreign_keys).toBe(1);
  });

  test('actualizan una base anterior conservando sus datos', async () => {
    const driver = openTestDatabase();
    await migrate(driver);
    await driver.run("INSERT INTO app_settings (key, value) VALUES ('tema', 'oscuro')");
    const next = [
      ...MIGRATIONS,
      { version: 2, name: 'prueba', sql: 'ALTER TABLE app_settings ADD COLUMN updated_at INTEGER;' },
    ];
    expect(await migrate(driver, next)).toBe(2);
    const row = await driver.first<{ value: string }>("SELECT value FROM app_settings WHERE key = 'tema'");
    expect(row?.value).toBe('oscuro');
  });

  test('un fallo revierte esa migración y no borra la base', async () => {
    const driver = openTestDatabase();
    await migrate(driver);
    await driver.run("INSERT INTO app_settings (key, value) VALUES ('k', 'v')");
    const broken = [
      ...MIGRATIONS,
      { version: 2, name: 'rota', sql: 'CREATE TABLE nueva (id TEXT); INSERT INTO tabla_inexistente VALUES (1);' },
    ];
    await expect(migrate(driver, broken)).rejects.toBeInstanceOf(MigrationError);
    expect(await currentSchemaVersion(driver)).toBe(1);
    const table = await driver.first("SELECT name FROM sqlite_master WHERE name = 'nueva'");
    expect(table).toBeNull();
    expect(await countRows(driver, 'app_settings')).toBe(1);
  });

  test('rechaza una base de una versión futura', async () => {
    const driver = openTestDatabase();
    await migrate(driver);
    await driver.run("INSERT INTO schema_version (version, name, applied_at) VALUES (99, 'futuro', 0)");
    await expect(migrate(driver)).rejects.toThrow(/más nueva/);
  });
});

describe('servicio de partida sobre SQLite real', () => {
  test('1. cinco manos sobreviven a cerrar y reabrir la base', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lamesa-'));
    const path = join(dir, 'lamesa.db');
    const first = await setup(openTestDatabase(path));
    const { gameId } = await exampleGame(first.service);
    const before = await first.service.getGame(gameId);
    first.driver.close();

    const reopened = await setup(openTestDatabase(path));
    const after = await reopened.service.getGame(gameId);
    expect(after.state).toEqual(before.state);
    expect(Object.values(after.outcome.totals)).toEqual([128, 96]);
    expect(await reopened.service.activeGameId()).toBe(gameId);
    reopened.driver.close();
  });

  test('3–5. corrección, deshacer, cierre y reapertura con una sola victoria', async () => {
    const { driver, service } = await setup();
    const { gameId, A, B } = await exampleGame(service);
    await service.execute(gameId, hand(B, 47));
    let { state } = await service.getGame(gameId);
    const b47 = state.entries.find((e) => e.sequence === 6)!.id;

    let r = await service.execute(gameId, {
      type: 'edit_entry',
      commandId: cmd(),
      entryId: b47,
      basePoints: 37,
      bonusCodes: [],
    });
    expect([r.outcome.totals[A], r.outcome.totals[B]]).toEqual([128, 133]);
    r = await service.execute(gameId, { type: 'undo', commandId: cmd() });
    expect([r.outcome.totals[A], r.outcome.totals[B]]).toEqual([128, 143]);

    r = await service.execute(gameId, hand(A, 84));
    expect([r.outcome.totals[A], r.outcome.totals[B]]).toEqual([212, 143]);
    expect(await victories(driver, A)).toBe(1);
    expect(await service.activeGameId()).toBeNull();

    ({ state } = await service.getGame(gameId));
    const a84 = state.entries.find((e) => e.sequence === 7)!.id;
    r = await service.execute(gameId, {
      type: 'edit_entry',
      commandId: cmd(),
      entryId: a84,
      basePoints: 14,
      bonusCodes: [],
    });
    expect([r.outcome.totals[A], r.outcome.totals[B]]).toEqual([142, 143]);
    expect(r.state.status).toBe('active');
    expect(await victories(driver, A)).toBe(0);
    expect(await service.activeGameId()).toBe(gameId);
  });

  test('6. bonificación persistida con su valor en la revisión', async () => {
    const { driver, service } = await setup();
    const gameId = await service.createGame({ ...quickGameSetup(), bonuses: [...TEST_BONUSES] }, cmd());
    const { state } = await service.getGame(gameId);
    const A = state.sides[0]!.id;
    const r = await service.execute(gameId, hand(A, 47, cmd(), ['capicua']));
    expect(r.outcome.totals[A]).toBe(72);
    const row = await driver.first<{ bonuses: string }>('SELECT bonuses FROM score_entry_revisions');
    expect(JSON.parse(row!.bonuses)).toEqual([{ code: 'capicua', label: 'Capicúa', value: 25 }]);
  });

  test('7. el mismo commandId dos veces produce un solo apunte; dos comandos de 25, dos', async () => {
    const { driver, service } = await setup();
    const gameId = await service.createGame(quickGameSetup(), cmd());
    const A = (await service.getGame(gameId)).state.sides[0]!.id;
    const same = hand(A, 25, 'doble-toque');
    const [one, two] = await Promise.all([service.execute(gameId, same), service.execute(gameId, same)]);
    expect([one.replayed, two.replayed].sort()).toEqual([false, true]);
    expect(await countRows(driver, 'score_entries')).toBe(1);

    await service.execute(gameId, hand(A, 25));
    expect(await countRows(driver, 'score_entries')).toBe(2);
    expect((await service.getGame(gameId)).outcome.totals[A]).toBe(50);
  });

  test('8. un error de disco no confirma nada y el reintento no duplica', async () => {
    const { driver, service } = await setup();
    const gameId = await service.createGame(quickGameSetup(), cmd());
    const A = (await service.getGame(gameId)).state.sides[0]!.id;
    const draft = hand(A, 47, 'borrador-47');

    driver.failOn('INSERT INTO operations');
    await expect(service.execute(gameId, draft)).rejects.toThrow(/disk I\/O/);
    driver.failOn(null);
    expect(await countRows(driver, 'score_entries')).toBe(0);
    expect(await countRows(driver, 'score_entry_revisions')).toBe(0);

    await service.execute(gameId, draft);
    // Respuesta perdida tras el commit: reintentar devuelve el resultado previo.
    const retry = await service.execute(gameId, draft);
    expect(retry.replayed).toBe(true);
    expect(await countRows(driver, 'score_entries')).toBe(1);
    expect(retry.outcome.totals[A]).toBe(47);
  });

  test('9. reasignar recalcula totales, desenlace y victoria guardada', async () => {
    const { driver, service } = await setup();
    const gameId = await service.createGame({ ...quickGameSetup(), target: 100 }, cmd());
    const [A, B] = (await service.getGame(gameId)).state.sides.map((s) => s.id) as [string, string];
    await service.execute(gameId, hand(A, 60));
    const r1 = await service.execute(gameId, hand(A, 50));
    expect(r1.outcome.winnerSideId).toBe(A);
    const firstEntry = r1.state.entries[0]!.id;
    const r2 = await service.execute(gameId, {
      type: 'reassign_entry',
      commandId: cmd(),
      entryId: firstEntry,
      sideId: B,
    });
    expect([r2.outcome.totals[A], r2.outcome.totals[B]]).toEqual([50, 60]);
    expect(r2.state.status).toBe('active');
    expect(await victories(driver, A)).toBe(0);
  });

  test('una sola partida activa: crear otra exige resolver la actual', async () => {
    const { service } = await setup();
    const first = await service.createGame(quickGameSetup(), cmd());
    await expect(service.createGame(quickGameSetup(), cmd())).rejects.toBeInstanceOf(ActiveGameExistsError);
    await service.abandon(first, cmd());
    const second = await service.createGame(quickGameSetup(), cmd());
    expect(second).not.toBe(first);
    expect((await service.getGame(first)).state.status).toBe('abandoned');
  });

  test('crear partida con el mismo commandId (doble toque) devuelve la misma', async () => {
    const { driver, service } = await setup();
    const [a, b] = await Promise.all([
      service.createGame(quickGameSetup(), 'rapida-1'),
      service.createGame(quickGameSetup(), 'rapida-1'),
    ]);
    expect(a).toBe(b);
    expect(await countRows(driver, 'games')).toBe(1);
  });

  test('H. no se reabre una partida si ya hay otra activa', async () => {
    const { service } = await setup();
    const gameId = await service.createGame({ ...quickGameSetup(), target: 50 }, cmd());
    const A = (await service.getGame(gameId)).state.sides[0]!.id;
    const closed = await service.execute(gameId, hand(A, 60));
    await service.createGame(quickGameSetup(), cmd());
    await expect(
      service.execute(gameId, {
        type: 'edit_entry',
        commandId: cmd(),
        entryId: closed.state.entries[0]!.id,
        basePoints: 10,
        bonusCodes: [],
      }),
    ).rejects.toBeInstanceOf(ActiveGameExistsError);
    expect((await service.getGame(gameId)).state.status).toBe('finished');
  });

  test('15. revancha crea una partida nueva y conserva la anterior', async () => {
    const { driver, service } = await setup();
    const gameId = await service.createGame(
      {
        mode: 'pairs',
        target: 100,
        bonuses: [...TEST_BONUSES],
        sides: [
          { displayName: 'Los del patio', participants: [{ displayName: 'César' }, { displayName: 'Luis' }] },
          { displayName: 'La visita', participants: [{ displayName: 'Ana' }, { displayName: 'José' }] },
        ],
      },
      cmd(),
    );
    const A = (await service.getGame(gameId)).state.sides[0]!.id;
    await service.execute(gameId, hand(A, 120));
    const nextId = await service.rematch(gameId, cmd());
    const next = await service.getGame(nextId);
    const prev = await service.getGame(gameId);
    expect(next.state.sides.map((s) => s.displayName)).toEqual(['Los del patio', 'La visita']);
    expect(next.state.sides[1]!.participants.map((p) => p.displayName)).toEqual(['Ana', 'José']);
    expect(next.state.rules).toEqual(prev.state.rules);
    expect(next.state.entries).toHaveLength(0);
    expect(prev.outcome.totals[A]).toBe(120);
    expect(await countRows(driver, 'games')).toBe(2);
  });

  test('abandonada no cuenta como victoria ni derrota', async () => {
    const { driver, service } = await setup();
    const gameId = await service.createGame(quickGameSetup(), cmd());
    const A = (await service.getGame(gameId)).state.sides[0]!.id;
    await service.execute(gameId, hand(A, 150));
    await service.abandon(gameId, cmd());
    const row = await driver.first<{ status: string; winner_side_id: string | null }>(
      'SELECT status, winner_side_id FROM games WHERE id = ?',
      [gameId],
    );
    expect(row).toEqual({ status: 'abandoned', winner_side_id: null });
    await expect(service.execute(gameId, hand(A, 10))).rejects.toThrow(/abandonada/);
  });

  test('loadGame devuelve null para una partida inexistente', async () => {
    const { driver } = await setup();
    expect(await loadGame(driver, 'no-existe')).toBeNull();
  });
});
