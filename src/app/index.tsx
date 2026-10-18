import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ActiveGameExistsError, type GameSnapshot } from '../application/gameService';
import { useServices } from '../application/services';
import { quickGameSetup } from '../domain';
import { durationLabel, scoreline, storageMessage, whenLabel } from '../features/game/format';
import { hapticTap } from '../platform/haptics';
import { AppText } from '../ui/components/AppText';
import { Button } from '../ui/components/Button';
import { DominoMark } from '../ui/components/DominoMark';
import { IconButton } from '../ui/components/IconButton';
import { Screen } from '../ui/components/Screen';
import { Surface } from '../ui/components/Surface';
import { TeamBadge } from '../ui/components/TeamBadge';
import { useTheme } from '../ui/theme';
import { radius, space } from '../ui/tokens';

export default function Home() {
  const { colors } = useTheme();
  const { games, newCommandId } = useServices();
  const [active, setActive] = useState<GameSnapshot | null>(null);
  const [recent, setRecent] = useState<GameSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quickCommand = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const activeId = await games.activeGameId();
      setActive(activeId ? await games.getGame(activeId) : null);
      setRecent(await games.recentClosed(3));
      setError(null);
    } catch (e) {
      setError(storageMessage(e));
    } finally {
      setLoaded(true);
    }
  }, [games]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const startQuick = async () => {
    hapticTap();
    quickCommand.current ??= newCommandId();
    setBusy(true);
    try {
      const id = await games.createGame(quickGameSetup(), quickCommand.current);
      quickCommand.current = null;
      router.push(`/partida/${id}`);
    } catch (e) {
      if (e instanceof ActiveGameExistsError) await refresh();
      else setError(storageMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const abandon = (snapshot: GameSnapshot) => {
    Alert.alert(
      '¿Abandonar la partida?',
      `Queda en el historial como abandonada (${scoreline(snapshot.state, snapshot.outcome)}). No cuenta como victoria ni derrota.`,
      [
        { text: 'Seguir jugando', style: 'cancel' },
        {
          text: 'Abandonar',
          style: 'destructive',
          onPress: async () => {
            try {
              await games.abandon(snapshot.state.id, newCommandId());
              await refresh();
            } catch (e) {
              setError(storageMessage(e));
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={styles.brand}>
        <View>
          <DominoMark top={6} bottom={6} size={16} horizontal />
        </View>
        <View style={styles.flex}>
          <AppText variant="heading" accessibilityRole="header">
            La Mesa
          </AppText>
          <AppText variant="overline" muted>
            Apunte de dominó
          </AppText>
        </View>
        <IconButton icon="settings" label="Ajustes" onPress={() => router.push('/ajustes')} testID="open-settings" />
      </View>

      {error ? (
        <View
          style={[styles.error, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
          accessibilityRole="alert"
        >
          <AppText variant="caption" color={colors.danger}>
            {error}
          </AppText>
        </View>
      ) : null}

      {!loaded ? null : active ? (
        <ActiveGameCard
          snapshot={active}
          onContinue={() => router.push(`/partida/${active.state.id}`)}
          onAbandon={() => abandon(active)}
        />
      ) : (
        <Surface>
          <View style={styles.heroTop}>
            <AppText variant="title" style={styles.flex}>
              Fichas{'\n'}a la mesa.
            </AppText>
            <View style={styles.heroArt}>
              <View style={{ transform: [{ rotate: '-14deg' }] }}>
                <DominoMark top={5} bottom={3} size={26} />
              </View>
              <View style={{ transform: [{ rotate: '9deg' }], marginTop: 16, marginLeft: -6 }}>
                <DominoMark top={3} bottom={6} size={26} fill={colors.teamSoft[0]} />
              </View>
            </View>
          </View>
          <AppText muted style={styles.heroCopy}>
            Apunta cada mano en segundos.
          </AppText>
          <View style={styles.heroActions}>
            <Button
              testID="quick-game"
              size="lg"
              label="Partida rápida"
              hint="Parejas · meta 200"
              onPress={startQuick}
              loading={busy}
            />
            <Button
              tone="secondary"
              label="Personalizar"
              hint="Modo, meta, nombres y reglas"
              onPress={() => router.push('/nueva')}
              disabled={busy}
            />
          </View>
        </Surface>
      )}

      {recent.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="overline" muted accessibilityRole="header">
            Recientes
          </AppText>
          {recent.map((g) => (
            <RecentRow key={g.state.id} snapshot={g} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function ActiveGameCard({
  snapshot,
  onContinue,
  onAbandon,
}: {
  snapshot: GameSnapshot;
  onContinue: () => void;
  onAbandon: () => void;
}) {
  const { colors } = useTheme();
  const { state, outcome } = snapshot;
  const sides = [...state.sides].sort((a, b) => a.position - b.position);
  return (
    <Surface testID="active-game">
      <AppText variant="overline" muted>
        Partida en curso · {outcome.handsPlayed} {outcome.handsPlayed === 1 ? 'mano' : 'manos'} · meta{' '}
        {state.rules.target}
      </AppText>
      <View style={styles.mini}>
        {sides.map((s) => (
          <View key={s.id} style={[styles.miniSide, { backgroundColor: colors.teamSoft[s.position] }]}>
            <View style={styles.miniHead}>
              <TeamBadge position={s.position} size={22} />
              <AppText variant="label" numberOfLines={1} style={styles.flex}>
                {s.displayName}
              </AppText>
            </View>
            <AppText variant="scoreSmall" color={colors.teamText[s.position]} maxFontSizeMultiplier={1.3}>
              {outcome.totals[s.id] ?? 0}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Button
          testID="continue-game"
          size="lg"
          label={`Continuar ${scoreline(state, outcome)}`}
          onPress={onContinue}
        />
        <Button tone="danger" label="Abandonar" onPress={onAbandon} />
        <AppText variant="caption" muted>
          Para empezar otra partida, termina o abandona esta.
        </AppText>
      </View>
    </Surface>
  );
}

function RecentRow({ snapshot }: { snapshot: GameSnapshot }) {
  const { colors } = useTheme();
  const { state, outcome } = snapshot;
  const winner = state.sides.find((s) => s.id === outcome.winnerSideId);
  const abandoned = state.status === 'abandoned';
  const duration = durationLabel(state.startedAt, state.endedAt);
  return (
    <Pressable
      testID={`recent-${state.id}`}
      accessibilityRole="button"
      accessibilityHint="Abre el resultado de la partida"
      onPress={() => router.push(`/resultado/${state.id}`)}
      style={({ pressed }) => [
        styles.recent,
        { backgroundColor: pressed ? colors.hairline : colors.surface, borderColor: colors.hairline },
      ]}
    >
      {winner ? <TeamBadge position={winner.position} size={26} /> : <DominoMark top={0} bottom={0} size={10} />}
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {abandoned ? 'Abandonada' : winner ? `Ganó ${winner.displayName}` : 'Sin resultado'}
        </AppText>
        <AppText variant="caption" muted>
          {whenLabel(state.startedAt)}
          {duration ? ` · ${duration}` : ''}
        </AppText>
      </View>
      <AppText variant="heading" tabular>
        {scoreline(state, outcome)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  heroArt: { flexDirection: 'row', paddingRight: space.xs },
  heroCopy: { marginTop: space.sm, marginBottom: space.lg, maxWidth: 320 },
  heroActions: { gap: space.md },
  section: { gap: space.sm },
  mini: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.md },
  miniSide: { flex: 1, minWidth: 130, borderRadius: radius.md, padding: space.md, gap: space.xs },
  miniHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { gap: space.sm },
  recent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.md,
  },
  error: { borderWidth: 1.5, borderRadius: radius.md, padding: space.md },
});
