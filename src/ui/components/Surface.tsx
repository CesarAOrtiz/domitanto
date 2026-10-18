import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { lift, radius, space } from '../tokens';

interface Props {
  children: ReactNode;
  /** Color de fondo; por defecto, la superficie del tema. */
  fill?: string;
  raised?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Tarjeta con trazo firme y, opcionalmente, sombra sólida desplazada. */
export function Surface({ children, fill, raised = true, padded = true, style, testID }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[raised && styles.wrap, style]} testID={testID}>
      {raised && (
        <View
          style={[StyleSheet.absoluteFill, styles.shadow, { backgroundColor: colors.shadow, borderRadius: radius.lg }]}
        />
      )}
      <View
        style={[
          styles.card,
          padded && styles.padded,
          { backgroundColor: fill ?? colors.surface, borderColor: colors.stroke, borderRadius: radius.lg },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginRight: lift, marginBottom: lift },
  shadow: { transform: [{ translateX: lift }, { translateY: lift }] },
  card: { borderWidth: 2, overflow: 'hidden' },
  padded: { padding: space.lg },
});
