import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSettings } from '../../application/services';
import { useTheme } from '../theme';
import { radius, space } from '../tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { IconButton } from './IconButton';

/**
 * Guía breve de una función. Aparece la primera vez y, una vez cerrada, se puede volver
 * a abrir con el botón «?». Lo cerrado se recuerda en los ajustes del teléfono.
 */
export function useGuide(id: string): { open: boolean; dismiss: () => void; show: () => void } {
  const [settings, update] = useSettings();
  const open = !settings.guidesSeen.includes(id);
  return {
    open,
    dismiss: () => void update({ guidesSeen: [...settings.guidesSeen, id].slice(-50) }).catch(() => undefined),
    show: () => void update({ guidesSeen: settings.guidesSeen.filter((g) => g !== id) }).catch(() => undefined),
  };
}

interface CardProps {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  children: ReactNode;
  onDismiss: () => void;
}

export function GuideCard({ icon, title, children, onDismiss }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.teamSoft[0], borderColor: colors.team[0] }]}
      accessibilityRole="summary"
      testID="guide"
    >
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.team[0] }]}>
          <Feather name={icon} size={18} color={colors.onTeam} />
        </View>
        <AppText variant="bodyStrong" style={styles.flex}>
          {title}
        </AppText>
      </View>
      <View style={styles.body}>{children}</View>
      <Button tone="secondary" label="Entendido" onPress={onDismiss} testID="guide-dismiss" />
    </View>
  );
}

/** Una línea de la guía con su viñeta. */
export function GuidePoint({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.point}>
      <View style={[styles.bullet, { backgroundColor: colors.team[0] }]} />
      <AppText variant="caption" style={styles.flex}>
        {children}
      </AppText>
    </View>
  );
}

export function GuideButton({ onPress }: { onPress: () => void }) {
  return <IconButton icon="help-circle" label="¿Qué es esto?" onPress={onPress} testID="guide-open" />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 2, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { gap: space.sm },
  point: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
});
