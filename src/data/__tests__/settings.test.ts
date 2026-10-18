/**
 * @jest-environment node
 */
import { openTestDatabase } from '../../test/nodeSqlite';
import { migrate } from '../migrations';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../settingsRepository';

async function db() {
  const driver = openTestDatabase();
  await migrate(driver);
  return driver;
}

describe('ajustes', () => {
  test('instalación nueva usa los predeterminados', async () => {
    expect(await loadSettings(await db())).toEqual(DEFAULT_SETTINGS);
  });

  test('guardar y reabrir conserva los cambios', async () => {
    const driver = await db();
    await saveSettings(driver, { ...DEFAULT_SETTINGS, shortcuts: [5, 30, 100], haptics: false });
    expect(await loadSettings(driver)).toMatchObject({ shortcuts: [5, 30, 100], haptics: false });
  });

  test('un valor dañado vuelve al predeterminado solo en ese campo', async () => {
    const driver = await db();
    await driver.run("INSERT INTO app_settings (key, value) VALUES ('preferences', ?)", [
      JSON.stringify({ shortcuts: [0, -1, 'x'], haptics: false, appearance: 'neón', plus: true }),
    ]);
    const s = await loadSettings(driver);
    expect(s.shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts);
    expect(s.haptics).toBe(false);
    expect(s.appearance).toBe('system');
    expect(s).not.toHaveProperty('plus');
  });

  test('JSON ilegible no rompe el arranque', async () => {
    const driver = await db();
    await driver.run("INSERT INTO app_settings (key, value) VALUES ('preferences', '{roto')");
    expect(await loadSettings(driver)).toEqual(DEFAULT_SETTINGS);
  });

  test('no se guardan atajos fuera de rango', async () => {
    await expect(saveSettings(await db(), { ...DEFAULT_SETTINGS, shortcuts: [0, 25, 50] })).rejects.toThrow();
  });
});
