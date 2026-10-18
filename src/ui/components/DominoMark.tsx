import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';

/** Posiciones de puntos (en una cuadrícula 3×3) para valores 0–6 de una ficha. */
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
};

function Half({ value, size, color }: { value: number; size: number; color: string }) {
  const pip = Math.max(3, Math.round(size * 0.18));
  const pad = size * 0.16;
  const step = (size - pad * 2 - pip) / 2;
  return (
    <View style={{ width: size, height: size }}>
      {(PIPS[value] ?? []).map(([row, col]) => (
        <View
          key={`${row}-${col}`}
          style={{
            position: 'absolute',
            width: pip,
            height: pip,
            borderRadius: pip / 2,
            backgroundColor: color,
            top: pad + row * step,
            left: pad + col * step,
          }}
        />
      ))}
    </View>
  );
}

interface Props {
  top?: number;
  bottom?: number;
  /** Lado de cada mitad, en unidades lógicas. */
  size?: number;
  fill?: string;
  pipColor?: string;
  horizontal?: boolean;
}

/** Ficha de dominó dibujada con vistas: la marca de La Mesa. Decorativa para lectores. */
export function DominoMark({ top = 6, bottom = 6, size = 22, fill, pipColor, horizontal }: Props) {
  const { colors } = useTheme();
  const ink = pipColor ?? colors.ink;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          flexDirection: horizontal ? 'row' : 'column',
          backgroundColor: fill ?? colors.surface,
          borderColor: colors.stroke,
          borderRadius: size * 0.32,
        },
      ]}
    >
      <Half value={top} size={size} color={ink} />
      <View
        style={
          horizontal
            ? { width: 2, height: size * 0.7, alignSelf: 'center', backgroundColor: colors.stroke }
            : { height: 2, width: size * 0.7, alignSelf: 'center', backgroundColor: colors.stroke }
        }
      />
      <Half value={bottom} size={size} color={ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderWidth: 2, alignSelf: 'flex-start' },
});
