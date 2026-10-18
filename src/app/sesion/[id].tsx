import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SessionOverview } from '../../application/peopleService';
import { useServices } from '../../application/services';
import type { GameResult } from '../../domain';
import { durationLabel, storageMessage, whenLabel } from '../../features/game/format';
import { pairLabel, plural } from '../../features/people/format';
import { AppText } from '../../ui/components/AppText';
import { GuideButton, GuideCard, GuidePoint, useGuide } from '../../ui/components/Guide';
import { Header } from '../../ui/components/Header';
import { RecordRow } from '../../ui/components/RecordRow';
import { Screen } from '../../ui/components/Screen';
import { useTheme } from '../../ui/theme';
import { space } from '../../ui/tokens';

function gameTitle(result: GameResult): string {
  if (result.status === 'active') return 'En curso';
  if (result.status === 'abandoned') return 'Abandonada';
  const winner = result.sides.find((s) => s.id === result.winnerSideId);
  return winner ? `Ganó ${winner.displayName}` : 'Sin resultado';
}

function sidesLabel(result: GameResult): string {
  return result.sides
    .map((s) => (s.members.length > 1 ? s.members.map((m) => m.displayName).join(' y ') : s.displayName))
    .join(' vs ');
}

/** Resumen de la noche: partidas en orden, parejas exactas y jugadores. */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { people } = useServices();
  const guide = useGuide('sesion');
  const [overview, setOverview] = useState<SessionOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      people.sessionOverview(id).then(setOverview, (e: unknown) => setError(storageMessage(e)));
    }, [people, id]),
  );

  if (!overview) {
    return (
      <Screen>
        <Header title="Sesión" />
        {error ? <AppText color={colors.danger}>{error}</AppText> : null}
      </Screen>
    );
  }

  const { session, group, summary } = overview;
  const duration = durationLabel(session.startedAt, session.lastActivityAt);

  return (
    <Screen>
      <Header
        title={group ? group.name : 'Sesión de juego'}
        actions={guide.open ? null : <GuideButton onPress={guide.show} />}
      />

      {guide.open ? (
        <GuideCard icon="moon" title="¿Qué es una sesión?" onDismiss={guide.dismiss}>
          <GuidePoint>Es una noche de juego: todas las partidas que se juegan seguidas.</GuidePoint>
          <GuidePoint>
            La app las junta sola. Si pasan más de 3 horas sin jugar, la siguiente empieza otra sesión.
          </GuidePoint>
          <GuidePoint>
            Si cambian las parejas, cada pareja lleva su propia cuenta y nadie hereda victorias ajenas.
          </GuidePoint>
        </GuideCard>
      ) : null}

      <AppText muted>
        {whenLabel(session.startedAt)}
        {duration ? ` · ${duration}` : ''} · {plural(summary.games.length, 'partida', 'partidas')}
      </AppText>

      {summary.pairs.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="overline" muted accessibilityRole="header">
            Parejas de la noche
          </AppText>
          {summary.pairs.map((p) => (
            <RecordRow key={p.compositionKey} title={pairLabel(p)} record={p} />
          ))}
        </View>
      ) : null}

      {summary.players.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="overline" muted accessibilityRole="header">
            Jugadores
          </AppText>
          {summary.players.map((p) => (
            <RecordRow
              key={p.playerId}
              title={p.displayName}
              record={p}
              onPress={() => router.push({ pathname: '/jugadores/[id]', params: { id: p.playerId } })}
            />
          ))}
        </View>
      ) : summary.decisive > 0 ? (
        <AppText variant="caption" muted>
          Para ver victorias por persona, escribe los nombres al armar la partida: se guardan solos.
        </AppText>
      ) : null}

      <View style={styles.section}>
        <AppText variant="overline" muted accessibilityRole="header">
          Partidas
        </AppText>
        {summary.games.map(({ result, number, pairsChanged }) => (
          <RecordRow
            key={result.gameId}
            title={`Partida ${number} · ${gameTitle(result)}`}
            subtitle={`${pairsChanged ? 'Parejas diferentes · ' : ''}${sidesLabel(result)}`}
            onPress={() =>
              result.status === 'active'
                ? router.push({ pathname: '/partida/[id]', params: { id: result.gameId } })
                : router.push({ pathname: '/resultado/[id]', params: { id: result.gameId } })
            }
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
});
