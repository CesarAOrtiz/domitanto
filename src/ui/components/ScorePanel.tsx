import { Pressable, StyleSheet, View } from 'react-native';

import type { Side } from '../../domain';
import { isPlaceholderName, sideLetter } from '../../domain';
import { useTheme } from '../theme';
import { lift, radius, scoreFontSize, space, touch, type as typeScale } from '../tokens';
import { AppText } from './AppText';
import { PipTrack } from './PipTrack';
import { TeamBadge } from './TeamBadge';

interface Props {
  side: Side;
  total: number;
  target: number;
  compact?: boolean;
  winner?: boolean;
  /** Si falta, el panel es de solo lectura (partida terminada). */
  onScore?: () => void;
}

export function membersLabel(side: Side): string {
  const names = side.participants.map((p) => p.displayName);
  // En una partida rápida los nombres son provisionales: no aportan nada al marcador.
  if (names.length <= 1 || names.every(isPlaceholderName)) return '';
  return names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1];
}

/** Bloque de puntuación de un equipo. Su posición es fija: nunca se reordena. */
export function ScorePanel({ side, total, target, compact, winner, onScore }: Props) {
  const { colors } = useTheme();
  const team = colors.team[side.position] ?? colors.ink;
  const members = membersLabel(side);
  const remaining = Math.max(0, target - total);
  const letter = sideLetter(side.position);
  const size = scoreFontSize((compact ? typeScale.scoreSmall : typeScale.score).fontSize, total);

  return (
    <View style={styles.wrap}>
      <View style={[StyleSheet.absoluteFill, styles.shadow, { backgroundColor: colors.shadow }]} />
      <View
        style={[styles.panel, !onScore && styles.panelAlone, { backgroundColor: team, borderColor: colors.stroke }]}
        accessible
        accessibilityLabel={`Equipo ${letter}, ${side.displayName}${members ? `, ${members}` : ''}: ${total} puntos. ${
          remaining > 0 ? `Faltan ${remaining}.` : 'Meta alcanzada.'
        }`}
      >
        <View style={styles.header}>
          <TeamBadge position={side.position} inverted size={compact ? 24 : 28} />
          <View style={styles.names}>
            <AppText variant="bodyStrong" color={colors.onTeam} numberOfLines={2}>
              {side.displayName}
            </AppText>
            {members ? (
              <AppText variant="caption" color={colors.onTeam} numberOfLines={2}>
                {members}
              </AppText>
            ) : null}
          </View>
        </View>

        <AppText
          variant={compact ? 'scoreSmall' : 'score'}
          color={colors.onTeam}
          style={{ fontSize: size, lineHeight: Math.round(size * 1.06) }}
          maxFontSizeMultiplier={1.4}
          adjustsFontSizeToFit
          numberOfLines={1}
          testID={`score-${letter}`}
        >
          {total}
        </AppText>

        <PipTrack value={total} target={target} color={colors.onTeam} empty="rgba(255,255,255,0.28)" />
        <AppText variant="caption" color={colors.onTeam} style={styles.remaining}>
          {winner ? 'Ganó la partida' : remaining > 0 ? `Faltan ${remaining}` : 'Meta alcanzada'}
        </AppText>
      </View>

      {onScore ? (
        <Pressable
          onPress={onScore}
          accessibilityRole="button"
          accessibilityLabel={`Anotar a ${side.displayName}`}
          testID={`anotar-${letter}`}
          style={({ pressed }) => [
            styles.scoreButton,
            {
              backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
              borderColor: colors.stroke,
            },
          ]}
        >
          <AppText variant="bodyStrong" color={colors.teamText[side.position]} align="center">
            + Anotar
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 140, marginRight: lift, marginBottom: lift },
  shadow: { borderRadius: radius.lg, transform: [{ translateX: lift }, { translateY: lift }] },
  panel: {
    borderWidth: 2,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: space.md,
    gap: space.sm,
    flexGrow: 1,
  },
  panelAlone: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  header: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  names: { flex: 1 },
  remaining: { marginTop: -2 },
  scoreButton: {
    minHeight: touch.min + 4,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
});
