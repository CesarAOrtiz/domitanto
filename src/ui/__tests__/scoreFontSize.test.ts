import { scoreFontSize } from '../tokens';

describe('scoreFontSize', () => {
  it('mantiene el tamaño base hasta dos cifras', () => {
    expect(scoreFontSize(68, 0)).toBe(68);
    expect(scoreFontSize(68, 99)).toBe(68);
  });

  it('reduce el tamaño con tres y cuatro cifras para que el marcador no se corte', () => {
    expect(scoreFontSize(68, 200)).toBeLessThan(68);
    expect(scoreFontSize(68, 1500)).toBeLessThan(scoreFontSize(68, 200));
  });
});
