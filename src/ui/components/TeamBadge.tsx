import { StyleSheet, View } from 'react-native';

import { sideLetter } from '../../domain';
import { useTheme } from '../theme';
import { radius } from '../tokens';
import { AppText } from './AppText';

interface Props {
  position: number;
  /** Variante sobre fondo de color de equipo. */
  inverted?: boolean;
  size?: number;
}

/**
 * Letra fija de posición (A, B, C, D). El color nunca identifica solo al equipo:
 * siempre va con letra y nombre.
 */
export function TeamBadge({ position, inverted, size = 28 }: Props) {
  const { colors } = useTheme();
  const team = colors.team[position] ?? colors.ink;
  return (
    <View
      accessible={false}
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: radius.sm,
          backgroundColor: inverted ? colors.onTeam : team,
          borderColor: inverted ? colors.onTeam : colors.stroke,
        },
      ]}
    >
      <AppText
        variant="label"
        color={inverted ? team : colors.onTeam}
        style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}
      >
        {sideLetter(position)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
