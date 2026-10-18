import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
import { radius, space, touch } from '../tokens';
import { AppText } from './AppText';

interface Props {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Feather>['name'];
  accessibilityHint?: string;
  testID?: string;
}

/** Pastilla tocable para elegir personas; 48 de alto para el pulgar. */
export function Chip({ label, onPress, selected, disabled, icon, accessibilityHint, testID }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : pressed ? colors.surfaceAlt : colors.surface,
          borderColor: selected ? colors.primary : colors.stroke,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      {icon ? <Feather name={icon} size={16} color={selected ? colors.onPrimary : colors.ink} /> : null}
      <AppText variant="label" color={selected ? colors.onPrimary : colors.ink} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    maxWidth: 240,
  },
});
