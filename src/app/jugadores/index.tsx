import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useServices } from '../../application/services';
import type { PlayerRecord } from '../../domain';
import type { Player } from '../../data/peopleRepository';
import { storageMessage, whenLabel } from '../../features/game/format';
import { AppText } from '../../ui/components/AppText';
import { Button } from '../../ui/components/Button';
import { Field } from '../../ui/components/Field';
import { GuideButton, GuideCard, GuidePoint, useGuide } from '../../ui/components/Guide';
import { Header } from '../../ui/components/Header';
import { RecordRow } from '../../ui/components/RecordRow';
import { Screen } from '../../ui/components/Screen';
import { useTheme } from '../../ui/theme';
import { space } from '../../ui/tokens';

export default function PlayersScreen() {
  const { colors } = useTheme();
  const { people } = useServices();
  const guide = useGuide('jugadores');
  const [players, setPlayers] = useState<Player[]>([]);
  const [records, setRecords] = useState<Map<string, PlayerRecord>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPlayers(await people.players());
      setRecords(await people.playerRecords());
      setError(null);
    } catch (e) {
      setError(storageMessage(e));
    } finally {
      setLoaded(true);
    }
  }, [people]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const add = async () => {
    try {
      await people.createPlayer(name);
      setName('');
      setAdding(false);
      await refresh();
    } catch (e) {
      setError(storageMessage(e));
    }
  };

  const active = players.filter((p) => p.archivedAt === null);
  const archived = players.filter((p) => p.archivedAt !== null);

  return (
    <Screen>
      <Header title="Jugadores" actions={guide.open ? null : <GuideButton onPress={guide.show} />} />

      {guide.open ? (
        <GuideCard icon="user" title="¿Para qué sirven los jugadores?" onDismiss={guide.dismiss}>
          <GuidePoint>Cada persona se guarda una vez y la app sigue sus victorias aunque cambie de pareja.</GuidePoint>
          <GuidePoint>
            No tienes que hacer nada extra: los nombres que escribes al armar una partida se guardan solos.
          </GuidePoint>
          <GuidePoint>Si dejas un puesto vacío, ese jugador cuenta como invitado y no suma estadísticas.</GuidePoint>
        </GuideCard>
      ) : null}

      {error ? <AppText color={colors.danger}>{error}</AppText> : null}

      {loaded && active.length === 0 ? (
        <AppText muted>
          Todavía no hay jugadores guardados. Escribe nombres al armar una partida o añádelos aquí.
        </AppText>
      ) : null}

      <View style={styles.list}>
        {active.map((p) => (
          <RecordRow
            key={p.id}
            title={p.displayName}
            subtitle={p.lastPlayedAt ? `Última partida: ${whenLabel(p.lastPlayedAt)}` : 'Sin partidas todavía'}
            record={records.get(p.id)}
            onPress={() => router.push({ pathname: '/jugadores/[id]', params: { id: p.id } })}
          />
        ))}
      </View>

      {adding ? (
        <View style={styles.add}>
          <Field
            label="Nombre o apodo"
            value={name}
            maxLength={40}
            autoFocus
            onChangeText={setName}
            onSubmitEditing={add}
          />
          <View style={styles.row}>
            <Button style={styles.flex} label="Guardar" onPress={add} disabled={!name.trim()} />
            <Button style={styles.flex} tone="ghost" label="Cancelar" onPress={() => setAdding(false)} />
          </View>
        </View>
      ) : (
        <Button tone="secondary" label="Añadir jugador" onPress={() => setAdding(true)} testID="add-player" />
      )}

      {archived.length > 0 ? (
        <View style={styles.list}>
          <Button
            tone="ghost"
            label={showArchived ? 'Ocultar archivados' : `Ver archivados (${archived.length})`}
            onPress={() => setShowArchived((v) => !v)}
          />
          {showArchived
            ? archived.map((p) => (
                <RecordRow
                  key={p.id}
                  title={p.displayName}
                  subtitle="Archivado"
                  record={records.get(p.id)}
                  onPress={() => router.push({ pathname: '/jugadores/[id]', params: { id: p.id } })}
                />
              ))
            : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: space.sm },
  add: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
});
