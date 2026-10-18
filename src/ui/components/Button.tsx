import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { lift, radius, space, touch } from '../tokens';
import { AppText } from './AppText';

type Tone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'team';

interface Props {
  label: string;
  onPress: () => void;
  tone?: Tone;
  /** Color de relleno para `tone="team"`. */
  fill?: string;
  /** Texto pequeño bajo la etiqueta, p. ej. «Parejas · meta 200». */
  hint?: string;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  size?: 'md' | 'lg';
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Botón "pegatina": trazo firme y sombra sólida desplazada. Al pulsar, el botón baja
 * sobre su sombra, una respuesta física sin animaciones decorativas.
 */
export function Button({
  label,
  onPress,
  tone = 'primary',
  fill,
  hint,
  icon,
  disabled,
  loading,
  size = 'md',
  accessibilityHint,
  testID,
  style,
}: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const palette: Record<Tone, { bg: string; fg: string; border: string; raised: boolean; shadow?: string }> = {
    primary: {
      bg: colors.primary,
      fg: colors.onPrimary,
      border: colors.primary,
      raised: true,
      shadow: colors.primaryShadow,
    },
    secondary: { bg: colors.surface, fg: colors.ink, border: colors.stroke, raised: true },
    ghost: { bg: 'transparent', fg: colors.ink, border: 'transparent', raised: false },
    danger: { bg: colors.surface, fg: colors.danger, border: colors.danger, raised: false },
    team: { bg: fill ?? colors.primary, fg: colors.onTeam, border: colors.stroke, raised: true },
  };
  const p = palette[tone];
  const minHeight = size === 'lg' ? 64 : touch.min;

  return (
    <View style={[styles.wrap, style]}>
      {p.raised && !inactive && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.shadow,
            { backgroundColor: p.shadow ?? colors.shadow, borderRadius: radius.md },
          ]}
        />
      )}
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={hint ? `${label}. ${hint}` : label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        style={({ pressed }) => [
          styles.button,
          {
            minHeight,
            backgroundColor: inactive && tone !== 'ghost' ? colors.surfaceAlt : p.bg,
            borderColor: inactive ? colors.hairline : p.border,
            borderRadius: radius.md,
            transform: [{ translateX: pressed && p.raised ? lift : 0 }, { translateY: pressed && p.raised ? lift : 0 }],
          },
        ]}
      >
        {loading ? <ActivityIndicator color={colors.inkMuted} /> : icon}
        <View style={styles.text}>
          <AppText
            variant={size === 'lg' ? 'heading' : 'bodyStrong'}
            color={inactive ? colors.inkMuted : p.fg}
            align="center"
          >
            {label}
          </AppText>
          {hint ? (
            <AppText variant="caption" color={inactive ? colors.inkMuted : p.fg} align="center">
              {hint}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginRight: lift, marginBottom: lift },
  shadow: { transform: [{ translateX: lift }, { translateY: lift }] },
  button: {
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  text: { flexShrink: 1, alignItems: 'center' },
});
