import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, space, touch } from '../tokens';
import { AppText } from './AppText';

interface Option<T> {
  value: T;
  label: string;
  hint?: string;
}

interface Props<T> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Selector de una opción con objetivos de 48+ y estado accesible. */
export function Segmented<T extends string | number>({ label, options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.hint ? `${o.label}, ${o.hint}` : o.label}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: selected ? colors.primary : pressed ? colors.surfaceAlt : colors.surface,
                borderColor: selected ? colors.primary : colors.hairline,
              },
            ]}
          >
            <AppText variant="bodyStrong" color={selected ? colors.onPrimary : colors.ink} tabular align="center">
              {o.label}
            </AppText>
            {o.hint ? (
              <AppText variant="caption" color={selected ? colors.onPrimary : colors.inkMuted} align="center">
                {o.hint}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: {
    flexGrow: 1,
    flexBasis: 64,
    minHeight: touch.min,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
