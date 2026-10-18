import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, View } from 'react-native';

import type { GameSnapshot } from '../../application/gameService';
import { useServices } from '../../application/services';
import { sideLetter } from '../../domain';
import { durationLabel, modeLabel, storageMessage } from '../../features/game/format';
import { AppText } from '../../ui/components/AppText';
import { Button } from '../../ui/components/Button';
import { DominoMark } from '../../ui/components/DominoMark';
import { membersLabel } from '../../ui/components/ScorePanel';
import { Screen } from '../../ui/components/Screen';
import { Surface } from '../../ui/components/Surface';
import { TeamBadge } from '../../ui/components/TeamBadge';
import { useTheme } from '../../ui/theme';
import { radius, space } from '../../ui/tokens';

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, reduceMotion } = useTheme();
  const { games, newCommandId } = useServices();
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rematchCommand = useRef<string | null>(null);
  const [pop] = useState(() => new Animated.Value(reduceMotion ? 1 : 0.85));

  useEffect(() => {
    games.getGame(id).then(setSnapshot, (e: unknown) => setError(storageMessage(e)));
  }, [games, id]);

  useEffect(() => {
    if (!snapshot || reduceMotion) return;
    // Celebración breve: no bloquea ninguna acción.
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [snapshot, reduceMotion, pop]);

  if (!snapshot) {
    return <Screen>{error ? <AppText color={colors.danger}>{error}</AppText> : null}</Screen>;
  }

  const { state, outcome } = snapshot;
  const sides = [...state.sides].sort((a, b) => a.position - b.position);
  const winner = sides.find((s) => s.id === outcome.winnerSideId);
  const duration = durationLabel(state.startedAt, state.endedAt);

  const rematch = async () => {
    rematchCommand.current ??= newCommandId();
    setBusy(true);
    try {
      const next = await games.rematch(state.id, rematchCommand.current);
      rematchCommand.current = null;
      router.replace(`/partida/${next}`);
    } catch (e) {
      setError(storageMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert('¿Borrar la partida?', 'Se borran el resultado y todas sus manos. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await games.deleteGame(state.id);
            router.replace('/');
          } catch (e) {
            setError(storageMessage(e));
          }
        },
      },
    ]);
  };

  const facts = [
    `${outcome.handsPlayed} ${outcome.handsPlayed === 1 ? 'mano' : 'manos'}`,
    `meta ${state.rules.target}`,
    modeLabel(state).toLowerCase(),
    duration,
  ].filter(Boolean);

  return (
    <Screen
      footer={
        <>
          <Button
            testID="rematch"
            size="lg"
            label="Revancha"
            hint="Mismos equipos y reglas"
            onPress={rematch}
            loading={busy}
          />
          <View style={styles.row}>
            <Button
              style={styles.flex}
              tone="secondary"
              label="Cambiar parejas"
              onPress={() => router.replace({ pathname: '/nueva', params: { from: state.id } })}
              disabled={busy}
            />
            <Button
              style={styles.flex}
              tone="secondary"
              label="Inicio"
              onPress={() => router.replace('/')}
              disabled={busy}
            />
          </View>
        </>
      }
    >
      {winner ? (
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Surface fill={colors.team[winner.position]} testID="winner">
            <View style={styles.winnerTop}>
              <TeamBadge position={winner.position} inverted size={32} />
              <View style={[styles.ribbon, { backgroundColor: colors.surface, borderColor: colors.gold }]}>
                <Feather name="award" size={14} color={colors.gold} />
                <AppText variant="label" color={colors.ink}>
                  Ganador
                </AppText>
              </View>
            </View>
            <AppText variant="title" color={colors.onTeam} accessibilityRole="header">
              Ganó {winner.displayName}
            </AppText>
            {membersLabel(winner) ? <AppText color={colors.onTeam}>{membersLabel(winner)}</AppText> : null}
            <AppText variant="score" color={colors.onTeam} style={styles.bigScore}>
              {outcome.totals[winner.id] ?? 0}
            </AppText>
            <AppText variant="caption" color={colors.onTeam}>
              {(outcome.totals[winner.id] ?? 0) > state.rules.target
                ? `Pasó la meta por ${(outcome.totals[winner.id] ?? 0) - state.rules.target}`
                : 'Meta exacta'}
            </AppText>
          </Surface>
        </Animated.View>
      ) : (
        <AppText variant="title" accessibilityRole="header">
          {state.status === 'abandoned' ? 'Partida abandonada' : 'Sin ganador'}
        </AppText>
      )}

      <View style={styles.table}>
        {sides.map((s) => (
          <View
            key={s.id}
            style={[styles.line, { borderColor: colors.hairline, backgroundColor: colors.surface }]}
            accessible
            accessibilityLabel={`Equipo ${sideLetter(s.position)}, ${s.displayName}: ${outcome.totals[s.id] ?? 0} puntos`}
          >
            <TeamBadge position={s.position} size={26} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {s.displayName}
              </AppText>
              {membersLabel(s) ? (
                <AppText variant="caption" muted numberOfLines={2}>
                  {membersLabel(s)}
                </AppText>
              ) : null}
            </View>
            <AppText variant="heading" tabular color={colors.teamText[s.position]}>
              {outcome.totals[s.id] ?? 0}
            </AppText>
          </View>
        ))}
      </View>

      <View style={styles.facts}>
        <DominoMark top={6} bottom={6} size={12} horizontal />
        <AppText variant="caption" muted style={styles.flex}>
          {facts.join(' · ')}
        </AppText>
      </View>

      <Button tone="ghost" label="Ver el apunte completo" onPress={() => router.replace(`/partida/${state.id}`)} />
      <Button testID="delete-game" tone="danger" label="Borrar partida" onPress={remove} disabled={busy} />
      {error ? <AppText color={colors.danger}>{error}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.sm },
  winnerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 4,
  },
  bigScore: { fontSize: 88, lineHeight: 92, marginTop: space.md },
  table: { gap: space.sm },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.md,
  },
  facts: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
