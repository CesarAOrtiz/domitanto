import { StyleSheet, View } from 'react-native';

interface Props {
  value: number;
  target: number;
  color: string;
  empty: string;
  segments?: number;
}

/**
 * Avance hacia la meta como una fila de puntos de ficha. Decorativo: el número y el
 * texto «faltan N» son la información accesible.
 */
export function PipTrack({ value, target, color, empty, segments = 10 }: Props) {
  const filled = Math.min(segments, Math.floor((Math.max(0, value) / target) * segments));
  return (
    <View style={styles.row} accessible={false} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: segments }, (_, i) => (
        <View key={i} style={[styles.pip, { backgroundColor: i < filled ? color : empty }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, flexWrap: 'nowrap' },
  pip: { flex: 1, height: 8, borderRadius: 4, maxWidth: 18 },
});
