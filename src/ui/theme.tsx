import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { dark, light, themedPalette, type Palette, type ThemeId } from './tokens';

interface Theme {
  colors: Palette;
  reduceMotion: boolean;
}

const ThemeContext = createContext<Theme>({ colors: light, reduceMotion: false });

export type Appearance = 'system' | 'light' | 'dark';

export function ThemeProvider({
  children,
  appearance = 'system',
  theme = 'clasico',
}: {
  children: ReactNode;
  appearance?: Appearance;
  theme?: ThemeId;
}) {
  const system = useColorScheme();
  const scheme = appearance === 'system' ? system : appearance;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => mounted && setReduceMotion(value))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ colors: themedPalette(scheme === 'dark' ? dark : light, theme), reduceMotion }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
