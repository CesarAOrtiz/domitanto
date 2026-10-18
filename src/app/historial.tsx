import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useServices } from '../application/services';
import { filterHistory, NO_FILTER, type GameResult, type HistoryFilter, type HistoryStatus } from '../domain';
import type { Group, Player } from '../data/peopleRepository';
import { durationLabel, storageMessage, whenLabel } from '../features/game/format';
import { plural } from '../features/people/format';
import { AppText } from '../ui/components/AppText';
import { Button } from '../ui/components/Button';
import { Chip } from '../ui/components/Chip';
import { DominoMark } from '../ui/components/DominoMark';
import { Header } from '../ui/components/Header';
import { Screen } from '../ui/components/Screen';
import { Segmented } from '../ui/components/Segmented';
import { TeamBadge } from '../ui/components/TeamBadge';
import { useTheme } from '../ui/theme';
import { radius, space } from '../ui/tokens';

const PAGE = 30;

export default function HistoryScreen() {
  const { jugador } = useLocalSearchParams<{ jugador?: string }>();
  const { colors } = useTheme();
  const { people } = useServices();
  const [results, setResults] = useState<GameResult[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<HistoryStatus>('all');
  const [playerId, setPlayerId] = useState<string | null>(jugador ?? null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  useFocusEffect(
    useCallback(() => {
      Promise.all([people.allResults(), people.players(), people.groups()])
        .then(([r, p, g]) => {
          setResults(r);
          setPlayers(p);
          setGroups(g);
          setError(null);
        })
        .catch((e: unknown) => setError(storageMessage(e)))
        .finally(() => setLoaded(true));
    }, [people]),
  );

  const group = groups.find((g) => g.id === groupId) ?? null;
  const filtered = useMemo(() => {
    const filter: HistoryFilter = { status, playerId, groupMemberIds: group?.memberIds ?? null };
    return filterHistory(results, filter);
  }, [results, status, playerId, group]);
  const total = filterHistory(results, NO_FILTER).length;
  // Solo se ofrecen jugadores con alguna partida cerrada, para que ningún filtro quede vacío de entrada.
  const playedIds = useMemo(
    () => new Set(results.flatMap((r) => r.sides.flatMap((s) => s.members.map((m) => m.playerId)))),
    [results],
  );
  const selectable = players.filter((p) => playedIds.has(p.id));
  const filtering = status !== 'all' || playerId !== null || groupId !== null;

  const select = (apply: () => void) => {
    apply();
    setShown(PAGE);
  };
  const clear = () =>
    select(() => {
      setStatus('all');
      setPlayerId(null);
      setGroupId(null);
    });

  return (
    <Screen>
      <Header title="Historial" />

      {error ? (
        <AppText color={colors.danger} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}

      {loaded && total === 0 ? (
        <AppText muted>Aún no hay partidas terminadas ni abandonadas. Aparecerán aquí al jugar.</AppText>
      ) : null}

      {total > 0 ? (
        <>
          <Segmented
            label="Estado"
            value={status}
            onChange={(v) => select(() => setStatus(v))}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'finished', label: 'Terminadas' },
              { value: 'abandoned', label: 'Abandonadas' },
            ]}
          />

          {groups.length > 0 ? (
            <FilterRow title="Grupo">
              <Chip label="Todos" selected={groupId === null} onPress={() => select(() => setGroupId(null))} />
              {groups.map((g) => (
                <Chip
                  key={g.id}
                  label={g.name}
                  selected={groupId === g.id}
                  onPress={() => select(() => setGroupId(groupId === g.id ? null : g.id))}
                  accessibilityHint="Solo partidas donde todos los jugadores eran del grupo"
                />
              ))}
            </FilterRow>
          ) : null}

          {selectable.length > 0 ? (
            <FilterRow title="Jugador">
              <Chip label="Todos" selected={playerId === null} onPress={() => select(() => setPlayerId(null))} />
              {selectable.map((p) => (
                <Chip
                  key={p.id}
                  label={p.displayName}
                  selected={playerId === p.id}
                  onPress={() => select(() => setPlayerId(playerId === p.id ? null : p.id))}
                />
              ))}
            </FilterRow>
          ) : null}

          <View style={styles.countRow}>
            <AppText variant="overline" muted accessibilityRole="header" style={styles.flex} testID="history-count">
              {filtering
                ? `${plural(filtered.length, 'partida', 'partidas')} de ${total}`
                : plural(total, 'partida', 'partidas')}
            </AppText>
            {filtering ? <Button tone="ghost" label="Quitar filtros" onPress={clear} /> : null}
          </View>

          {filtered.length === 0 ? <AppText muted>Ninguna partida con estos filtros.</AppText> : null}

          <View style={styles.list}>
            {filtered.slice(0, shown).map((r) => (
              <HistoryRow key={r.gameId} result={r} />
            ))}
          </View>

          {filtered.length > shown ? (
            <Button
              tone="secondary"
              label="Mostrar más"
              hint={`Quedan ${filtered.length - shown}`}
              onPress={() => setShown(shown + PAGE)}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function FilterRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.filter}>
      <AppText variant="overline" muted accessibilityRole="header">
        {title}
      </AppText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function HistoryRow({ result }: { result: GameResult }) {
  const { colors } = useTheme();
  const winner = result.sides.find((s) => s.id === result.winnerSideId);
  const abandoned = result.status === 'abandoned';
  const duration = durationLabel(result.startedAt, result.endedAt);
  const sides = [...result.sides]
    .sort((a, b) => a.position - b.position)
    .map((s) => s.members.map((m) => m.displayName).join(' y ') || s.displayName)
    .join(' · ');
  return (
    <Pressable
      testID={`history-${result.gameId}`}
      accessibilityRole="button"
      accessibilityHint="Abre el resultado de la partida"
      onPress={() => router.push(`/resultado/${result.gameId}`)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.hairline : colors.surface, borderColor: colors.hairline },
      ]}
    >
      {winner ? <TeamBadge position={winner.position} size={26} /> : <DominoMark top={0} bottom={0} size={10} />}
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {abandoned ? 'Abandonada' : winner ? `Ganó ${winner.displayName}` : 'Sin resultado'}
        </AppText>
        <AppText variant="caption" muted numberOfLines={2}>
          {sides}
        </AppText>
        <AppText variant="caption" muted>
          {whenLabel(result.startedAt)}
          {duration ? ` · ${duration}` : ''}
          {result.mode === 'pairs' ? ' · Parejas' : ' · Individual'}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filter: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.md,
  },
});
