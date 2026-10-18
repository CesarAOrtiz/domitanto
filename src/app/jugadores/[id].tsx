import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PlayerProfile } from '../../application/peopleService';
import { useServices } from '../../application/services';
import { winRate, type GameResult } from '../../domain';
import { storageMessage, whenLabel } from '../../features/game/format';
import { plural, streakLabel } from '../../features/people/format';
import { AppText } from '../../ui/components/AppText';
import { Button } from '../../ui/components/Button';
import { Field } from '../../ui/components/Field';
import { Header } from '../../ui/components/Header';
import { RecordRow } from '../../ui/components/RecordRow';
import { Screen } from '../../ui/components/Screen';
import { Surface } from '../../ui/components/Surface';
import { useTheme } from '../../ui/theme';
import { space } from '../../ui/tokens';

/** «con Luis, contra Ana y José» desde el punto de vista de la persona. */
function matchup(result: GameResult, playerId: string): string {
  const own = result.sides.find((s) => s.members.some((m) => m.playerId === playerId));
  const partners = own?.members.filter((m) => m.playerId !== playerId).map((m) => m.displayName) ?? [];
  const rivals = result.sides.filter((s) => s !== own).map((s) => s.members.map((m) => m.displayName).join(' y '));
  return [partners.length ? `con ${partners.join(' y ')}` : null, `contra ${rivals.join(', ')}`]
    .filter(Boolean)
    .join(', ');
}

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { people } = useServices();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProfile(await people.playerProfile(id));
    } catch (e) {
      setError(storageMessage(e));
    }
  }, [people, id]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!profile) {
    return (
      <Screen>
        <Header title="Jugador" />
        {error ? <AppText color={colors.danger}>{error}</AppText> : null}
      </Screen>
    );
  }

  const { player, record, partners, recent } = profile;
  const rate = record ? winRate(record) : null;
  const streak = streakLabel(record?.streak ?? null);

  const save = async () => {
    try {
      await people.renamePlayer(player.id, name);
      setEditing(false);
      await refresh();
    } catch (e) {
      setError(storageMessage(e));
    }
  };

  const toggleArchive = async () => {
    try {
      await people.setArchived(player.id, player.archivedAt === null);
      await refresh();
    } catch (e) {
      setError(storageMessage(e));
    }
  };

  return (
    <Screen>
      <Header title={player.displayName} />

      <Surface>
        {record ? (
          <>
            <AppText variant="overline" muted>
              Victorias
            </AppText>
            <AppText variant="score" tabular>
              {rate} %
            </AppText>
            <AppText variant="bodyStrong">
              Ganó {record.won} de {plural(record.played, 'partida terminada', 'partidas terminadas')}
            </AppText>
            {streak ? <AppText muted>{streak}</AppText> : null}
            <AppText variant="caption" muted style={styles.note}>
              Ganar es estar en el lado ganador. No mide quién sumó más puntos. Abandonadas no cuentan.
            </AppText>
          </>
        ) : (
          <AppText muted>Todavía no tiene partidas terminadas. Sus cifras aparecerán aquí al jugar.</AppText>
        )}
      </Surface>

      {partners.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="overline" muted accessibilityRole="header">
            Con quién juega
          </AppText>
          {partners.map((p) => (
            <RecordRow
              key={p.compositionKey}
              title={`Con ${p.names.filter((_, i) => p.playerIds[i] !== player.id).join(' y ')}`}
              record={p}
            />
          ))}
        </View>
      ) : null}

      {recent.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="overline" muted accessibilityRole="header">
            Últimas partidas
          </AppText>
          {recent.map(({ result, won }) => (
            <RecordRow
              key={result.gameId}
              title={won ? 'Ganó' : 'Perdió'}
              subtitle={`${whenLabel(result.endedAt ?? result.startedAt)} · ${matchup(result, player.id)}`}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="overline" muted accessibilityRole="header">
          Perfil
        </AppText>
        {editing ? (
          <>
            <Field
              label="Nombre o apodo"
              value={name}
              maxLength={40}
              autoFocus
              onChangeText={setName}
              onSubmitEditing={save}
            />
            <AppText variant="caption" muted>
              Las partidas pasadas conservan el nombre con que se jugaron.
            </AppText>
            <View style={styles.row}>
              <Button style={styles.flex} label="Guardar" onPress={save} disabled={!name.trim()} />
              <Button style={styles.flex} tone="ghost" label="Cancelar" onPress={() => setEditing(false)} />
            </View>
          </>
        ) : (
          <Button
            tone="secondary"
            label="Cambiar nombre"
            onPress={() => {
              setName(player.displayName);
              setEditing(true);
            }}
          />
        )}
        <Button
          tone="ghost"
          label={player.archivedAt === null ? 'Archivar' : 'Volver a mostrar'}
          hint={player.archivedAt === null ? 'Deja de aparecer al armar partidas. Su historial se queda.' : undefined}
          onPress={toggleArchive}
        />
      </View>

      {error ? <AppText color={colors.danger}>{error}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  note: { marginTop: space.sm },
});
