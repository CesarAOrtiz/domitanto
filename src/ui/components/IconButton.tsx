import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
import { radius, touch } from '../tokens';
import { AppText } from './AppText';

interface Props {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  /** Muestra la etiqueta junto al icono cuando la acción no es evidente. */
  showLabel?: boolean;
  onPress: () => void;
  testID?: string;
}

export function IconButton({ icon, label, showLabel, onPress, testID }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? colors.surfaceAlt : 'transparent', borderColor: colors.hairline },
        showLabel && styles.withLabel,
      ]}
    >
      <Feather name={icon} size={22} color={colors.ink} />
      {showLabel ? <AppText variant="label">{label}</AppText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: touch.min,
    minHeight: touch.min,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  withLabel: { paddingHorizontal: 12 },
});
