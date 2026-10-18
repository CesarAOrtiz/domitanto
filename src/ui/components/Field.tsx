import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../theme';
import { fonts, radius, space, touch } from '../tokens';
import { AppText } from './AppText';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  accent?: string;
  error?: string | null;
}

export function Field({ label, accent, error, ...input }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={colors.inkMuted}
        style={[
          styles.input,
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : (accent ?? colors.hairline),
          },
        ]}
      />
      {error ? (
        <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, flex: 1, minWidth: 140 },
  input: {
    minHeight: touch.min + 4,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
  },
});
