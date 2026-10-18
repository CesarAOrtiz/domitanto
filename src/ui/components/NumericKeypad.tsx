import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, space, touch } from '../tokens';
import { AppText } from './AppText';

interface Props {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  disabled?: boolean;
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['clear', '0', 'back'],
] as const;

/** Teclado propio de enteros: sin decimales ni signo. Teclas de al menos 60 unidades. */
export function NumericKeypad({ onDigit, onBackspace, onClear, disabled }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {ROWS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((key) => {
            const isDigit = key !== 'clear' && key !== 'back';
            const label = key === 'clear' ? 'Limpiar cantidad' : key === 'back' ? 'Borrar último dígito' : key;
            return (
              <Pressable
                key={key}
                disabled={disabled}
                testID={`key-${key}`}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => (key === 'clear' ? onClear() : key === 'back' ? onBackspace() : onDigit(key))}
                style={({ pressed }) => [
                  styles.key,
                  {
                    backgroundColor: pressed ? colors.keypadPressed : isDigit ? colors.keypad : colors.surfaceAlt,
                    borderColor: colors.hairline,
                  },
                ]}
              >
                {key === 'back' ? (
                  <Feather name="delete" size={24} color={colors.ink} />
                ) : key === 'clear' ? (
                  <AppText variant="bodyStrong">C</AppText>
                ) : (
                  <AppText variant="heading" tabular style={styles.digit}>
                    {key}
                  </AppText>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  key: {
    flex: 1,
    minHeight: touch.key,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 26, lineHeight: 30 },
});
