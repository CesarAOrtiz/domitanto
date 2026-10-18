// Tokens semánticos de La Mesa. Contrastes verificados en src/ui/__tests__/contrast.test.ts.

export interface Palette {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkMuted: string;
  /** Borde de "pegatina": trazo firme alrededor de tarjetas y botones. */
  stroke: string;
  hairline: string;
  /** Sombra sólida desplazada (sin difuminado). */
  shadow: string;
  primary: string;
  /** Sombra sólida del botón principal: el toque de color de la marca. */
  primaryShadow: string;
  onPrimary: string;
  team: string[];
  onTeam: string;
  /** Tinte suave del equipo para filas y fondos con texto en tinta. */
  teamSoft: string[];
  /** Color del equipo usado como texto sobre el fondo. */
  teamText: string[];
  danger: string;
  dangerSoft: string;
  success: string;
  /** Oro: solo un detalle pequeño del resultado. */
  gold: string;
  keypad: string;
  keypadPressed: string;
}

export const light: Palette = {
  scheme: 'light',
  bg: '#F6F4EF',
  surface: '#FFFFFF',
  surfaceAlt: '#EDE9E0',
  ink: '#17212B',
  inkMuted: '#5A6470',
  stroke: '#17212B',
  hairline: '#DDD7CB',
  shadow: '#17212B',
  primary: '#17212B',
  primaryShadow: '#2457D6',
  onPrimary: '#F6F4EF',
  team: ['#2457D6', '#A8412D', '#1F7A5A', '#7A4BB8'],
  onTeam: '#FFFFFF',
  teamSoft: ['#E4EBFB', '#F7E5E0', '#DFF1E9', '#EEE6F8'],
  teamText: ['#2457D6', '#A8412D', '#1A6B4E', '#6A3FA6'],
  danger: '#B3261E',
  dangerSoft: '#FBE4E2',
  success: '#1E7A4C',
  gold: '#B8860B',
  keypad: '#FFFFFF',
  keypadPressed: '#EDE9E0',
};

export const dark: Palette = {
  scheme: 'dark',
  bg: '#101820',
  surface: '#1A2530',
  surfaceAlt: '#22303D',
  ink: '#F3F1EC',
  inkMuted: '#A7B2BD',
  stroke: '#3A4A59',
  hairline: '#2A3846',
  shadow: '#05090D',
  primary: '#F3F1EC',
  primaryShadow: '#2457D6',
  onPrimary: '#101820',
  team: ['#2457D6', '#A8412D', '#1F7A5A', '#7A4BB8'],
  onTeam: '#FFFFFF',
  teamSoft: ['#1C2E52', '#3F2620', '#173B30', '#2F2545'],
  teamText: ['#8EAEF7', '#EE9A86', '#6FCFA8', '#C3A6EE'],
  danger: '#FF8A80',
  dangerSoft: '#3D1F1E',
  success: '#6FCF97',
  gold: '#E2B84A',
  keypad: '#22303D',
  keypadPressed: '#2D3E4E',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
/** Desplazamiento de la sombra sólida. */
export const lift = 4;
export const touch = { min: 48, key: 60 } as const;

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const type = {
  score: { fontFamily: fonts.display, fontSize: 68, lineHeight: 72 },
  scoreSmall: { fontFamily: fonts.display, fontSize: 48, lineHeight: 52 },
  amount: { fontFamily: fonts.display, fontSize: 64, lineHeight: 68 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  heading: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 17, lineHeight: 24 },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19 },
  overline: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 17, letterSpacing: 1.4 },
} as const;

export type TypeVariant = keyof typeof type;

/**
 * Tamaño de un marcador según sus cifras. No dependemos de `adjustsFontSizeToFit`
 * (no existe en web y en Android falla con fuentes personalizadas).
 */
export function scoreFontSize(base: number, value: number): number {
  const digits = String(Math.abs(Math.trunc(value))).length;
  const factor = digits <= 2 ? 1 : digits === 3 ? 0.72 : 0.55;
  return Math.round(base * factor);
}

/** Temas de color. «Clásico» es gratis; los demás son extras de Plus. */
export type ThemeId = 'clasico' | 'malecon' | 'cacao' | 'flamboyan';

type ThemeOverride = Pick<
  Palette,
  'bg' | 'surface' | 'surfaceAlt' | 'hairline' | 'keypad' | 'keypadPressed' | 'primaryShadow'
>;

export const THEMES: { id: ThemeId; label: string; description: string; plus: boolean; swatch: string }[] = [
  { id: 'clasico', label: 'Clásico', description: 'Marfil y cobalto', plus: false, swatch: '#2457D6' },
  { id: 'malecon', label: 'Malecón', description: 'Mar y brisa', plus: true, swatch: '#0F7C78' },
  { id: 'cacao', label: 'Cacao', description: 'Tierra tostada', plus: true, swatch: '#9A5B2E' },
  { id: 'flamboyan', label: 'Flamboyán', description: 'Rojo de verano', plus: true, swatch: '#C2352B' },
];

const OVERRIDES: Record<Exclude<ThemeId, 'clasico'>, { light: ThemeOverride; dark: ThemeOverride }> = {
  malecon: {
    light: {
      bg: '#EEF5F3',
      surface: '#FFFFFF',
      surfaceAlt: '#DDEBE8',
      hairline: '#CFE0DC',
      keypad: '#DDEBE8',
      keypadPressed: '#C8DDD9',
      primaryShadow: '#0F7C78',
    },
    dark: {
      bg: '#0C1B1D',
      surface: '#14292C',
      surfaceAlt: '#1B3538',
      hairline: '#24413F',
      keypad: '#1B3538',
      keypadPressed: '#244447',
      primaryShadow: '#14A39D',
    },
  },
  cacao: {
    light: {
      bg: '#F7F0E7',
      surface: '#FFFFFF',
      surfaceAlt: '#EDE1D2',
      hairline: '#E2D3C1',
      keypad: '#EDE1D2',
      keypadPressed: '#E0CFBA',
      primaryShadow: '#9A5B2E',
    },
    dark: {
      bg: '#19130F',
      surface: '#241B15',
      surfaceAlt: '#2E231B',
      hairline: '#3A2D23',
      keypad: '#2E231B',
      keypadPressed: '#3A2D23',
      primaryShadow: '#C27A43',
    },
  },
  flamboyan: {
    light: {
      bg: '#FBF0EE',
      surface: '#FFFFFF',
      surfaceAlt: '#F3DFDB',
      hairline: '#EBD0CA',
      keypad: '#F3DFDB',
      keypadPressed: '#EACAC3',
      primaryShadow: '#C2352B',
    },
    dark: {
      bg: '#1B1113',
      surface: '#28191C',
      surfaceAlt: '#332125',
      hairline: '#402A2E',
      keypad: '#332125',
      keypadPressed: '#402A2E',
      primaryShadow: '#E0574B',
    },
  },
};

export function themedPalette(base: Palette, theme: ThemeId): Palette {
  if (theme === 'clasico') return base;
  return { ...base, ...OVERRIDES[theme][base.scheme] };
}
