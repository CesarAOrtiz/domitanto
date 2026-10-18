import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { space } from '../tokens';

interface Props {
  children: ReactNode;
  /** Contenido fijo al pie, al alcance del pulgar. */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Pantalla con áreas seguras, desplazamiento y pie opcional. */
export function Screen({ children, footer, contentStyle }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.md, paddingBottom: footer ? space.lg : insets.bottom + space.xl },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.bg, borderColor: colors.hairline, paddingBottom: insets.bottom + space.md },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: space.lg, gap: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    gap: space.sm,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
});
