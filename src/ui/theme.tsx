import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { dark, light, type Palette } from './tokens';

interface Theme {
  colors: Palette;
  reduceMotion: boolean;
}

const ThemeContext = createContext<Theme>({ colors: light, reduceMotion: false });

export type Appearance = 'system' | 'light' | 'dark';

export function ThemeProvider({ children, appearance = 'system' }: { children: ReactNode; appearance?: Appearance }) {
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
    <ThemeContext.Provider value={{ colors: scheme === 'dark' ? dark : light, reduceMotion }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
