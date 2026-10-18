/**
 * @jest-environment node
 */
import { adsAllowed, resolveAccess, type StoreVerdict } from '../../application/access';
import { createAccessStore } from '../../application/accessStore';
import type { PurchaseOutcome, StoreAdapter } from '../../platform/commerce';
import { openTestDatabase } from '../../test/nodeSqlite';
import { migrate } from '../migrations';

jest.mock('../../platform/commerce', () => ({}));

function fakeStore(
  initial: StoreVerdict | Error,
  purchase?: { outcome: PurchaseOutcome; verdict: StoreVerdict | null },
) {
  let verdict = initial;
  const store: StoreAdapter = {
    unavailableReason: null,
    verdict: () => (verdict instanceof Error ? Promise.reject(verdict) : Promise.resolve(verdict)),
    offer: () => Promise.resolve({ priceString: 'US$7.99' }),
    purchase: () => Promise.resolve(purchase ?? { outcome: 'cancelled', verdict: null }),
    restore: () => (verdict instanceof Error ? Promise.reject(verdict) : Promise.resolve(verdict)),
    onChange: () => undefined,
  };
  return { store, set: (v: StoreVerdict | Error) => (verdict = v) };
}

async function db() {
  const driver = openTestDatabase();
  await migrate(driver);
  return driver;
}
const clock = { now: () => 1_760_000_000_000 };

describe('acceso a Plus', () => {
  test('sin tienda ni caché el acceso es desconocido y no hay anuncios', () => {
    expect(resolveAccess(null, null)).toBe('unknown');
    expect(adsAllowed('unknown')).toBe(false);
    expect(adsAllowed('plus')).toBe(false);
    expect(adsAllowed('free')).toBe(true);
  });

  test('un Plus validado sigue activo al reiniciar sin red', async () => {
    const driver = await db();
    const online = createAccessStore(driver, fakeStore('active').store, clock);
    await online.init();
    expect(online.get().access).toBe('plus');

    const offline = createAccessStore(driver, fakeStore(new Error('sin red')).store, clock);
    await offline.init();
    expect(offline.get().access).toBe('plus');
  });

  test('compra cancelada o pendiente no activa Plus; validada sí', async () => {
    const driver = await db();
    const cancelled = createAccessStore(driver, fakeStore('inactive').store, clock);
    await cancelled.init();
    expect(await cancelled.purchase()).toBe('cancelled');
    expect(cancelled.get().access).toBe('free');

    const pending = createAccessStore(
      driver,
      fakeStore('inactive', { outcome: 'pending', verdict: null }).store,
      clock,
    );
    await pending.init();
    expect(await pending.purchase()).toBe('pending');
    expect(pending.get().access).toBe('free');

    const ok = createAccessStore(
      driver,
      fakeStore('inactive', { outcome: 'validated', verdict: 'active' }).store,
      clock,
    );
    await ok.init();
    expect(await ok.purchase()).toBe('validated');
    expect(ok.get().access).toBe('plus');
  });

  test('una devolución conocida revoca Plus sin borrar partidas', async () => {
    const driver = await db();
    await driver.run("INSERT INTO app_settings (key, value) VALUES ('x', 'y')");
    const fake = fakeStore('active');
    const store = createAccessStore(driver, fake.store, clock);
    await store.init();
    fake.set('refunded');
    expect(await store.restore()).toBe('nothing');
    expect(store.get().access).toBe('revoked');
    expect(await driver.first("SELECT value FROM app_settings WHERE key = 'x'")).toEqual({ value: 'y' });
  });

  test('una preferencia con plus=true no concede nada', async () => {
    const driver = await db();
    await driver.run(`INSERT INTO app_settings (key, value) VALUES ('preferences', '{"plus":true}')`);
    const store = createAccessStore(driver, { ...fakeStore('inactive').store, unavailableReason: 'no' }, clock);
    await store.init();
    expect(store.get().access).toBe('unknown');
  });
});
