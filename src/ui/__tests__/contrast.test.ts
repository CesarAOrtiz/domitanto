import { contrastRatio } from '../contrast';
import { dark, light, type Palette } from '../tokens';

const AA = 4.5;

describe.each([
  ['claro', light],
  ['oscuro', dark],
] as [string, Palette][])('contrastes del tema %s', (_name, p) => {
  test.each([
    ['tinta / fondo', p.ink, p.bg],
    ['tinta / superficie', p.ink, p.surface],
    ['tinta secundaria / fondo', p.inkMuted, p.bg],
    ['tinta secundaria / superficie', p.inkMuted, p.surface],
    ['botón principal', p.onPrimary, p.primary],
    ['peligro / superficie', p.danger, p.surface],
    ['tinta / teclado', p.ink, p.keypad],
  ])('%s ≥ 4.5', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });

  test('texto sobre cada color de equipo y su tinte', () => {
    p.team.forEach((team, i) => {
      expect(contrastRatio(p.onTeam, team)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(p.ink, p.teamSoft[i]!)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(p.teamText[i]!, p.surface)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(p.teamText[i]!, p.teamSoft[i]!)).toBeGreaterThanOrEqual(AA);
    });
  });
});

test('valores base de la especificación', () => {
  expect(contrastRatio('#FFFFFF', '#2457D6')).toBeGreaterThan(5);
  expect(contrastRatio('#FFFFFF', '#A8412D')).toBeGreaterThan(5);
});
