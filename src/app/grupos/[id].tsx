import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import type { GroupOverview } from '../../application/peopleService';
import { useServices } from '../../application/services';
import { storageMessage } from '../../features/game/format';
import { pairLabel, plural } from '../../features/people/format';
import { AppText } from '../../ui/components/AppText';
import { Button } from '../../ui/components/Button';
import { Header } from '../../ui/components/Header';
import { IconButton } from '../../ui/components/IconButton';
import { RecordRow } from '../../ui/components/RecordRow';
import { Screen } from '../../ui/components/Screen';
import { useTheme } from '../../ui/theme';
import { space } from '../../ui/tokens';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { people } = useServices();
  const [overview, setOverview] = useState<GroupOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      people.groupOverview(id).then(setOverview, (e: unknown) => setError(storageMessage(e)));
    }, [people, id]),
  );

  if (!overview) {
    return (
      <Screen>
        <Header title="Grupo" />
        {error ? <AppText color={colors.danger}>{error}</AppText> : null}
      </Screen>
    );
  }

  const { group, members, decisive, players, pairs } = overview;
  const recordOf = (playerId: string) => players.find((r) => r.playerId === playerId) ?? null;

  const remove = () =>
    Alert.alert(`¿Borrar «${group.name}»?`, 'Solo se borra la lista. Las partidas y los jugadores se quedan.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar grupo',
        style: 'destructive',
        onPress: async () => {
          try {
            await people.deleteGroup(group.id);
            router.back();
          } catch (e) {
            setError(storageMessage(e));
          }
        },
      },
    ]);

  return (
    <Screen
      footer={
        <Button
          size="lg"
          label="Jugar con este grupo"
          hint="Sus jugadores aparecen listos para sentarlos"
          onPress={() => router.push({ pathname: '/nueva', params: { grupo: group.id } })}
          testID="play-with-group"
        />
      }
    >
      <Header
        title={group.name}
        actions={
          <IconButton
            icon="edit-2"
            label="Editar grupo"
            onPress={() => router.push({ pathname: '/grupos/editar', params: { id: group.id } })}
          />
        }
      />

      <AppText muted>
        {decisive === 0
          ? 'Aún no hay partidas terminadas entre ustedes. Las cifras aparecen al jugar.'
          : `${plural(decisive, 'partida terminada', 'partidas terminadas')} donde todos eran del grupo.`}
      </AppText>

      <View style={styles.section}>
        <AppText variant="overline" muted accessibilityRole="header">
          Jugadores
        </AppText>
        {members.length === 0 ? (
          <AppText muted>Este grupo no tiene jugadores. Toca el lápiz para añadirlos.</AppText>
        ) : null}
        {members.map((p) => (
          <RecordRow
            key={p.id}
            title={p.displayName}
            record={recordOf(p.id)}
            onPress={() => router.push({ pathname: '/jugadores/[id]', params: { id: p.id } })}
          />
        ))}
      </View>

      {pairs.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="overline" muted accessibilityRole="header">
            Parejas
          </AppText>
          <AppText variant="caption" muted>
            Cada pareja exacta lleva su cuenta. Si alguien cambia de compañero, es otra pareja.
          </AppText>
          {pairs.map((p) => (
            <RecordRow key={p.compositionKey} title={pairLabel(p)} record={p} />
          ))}
        </View>
      ) : null}

      <Button tone="danger" label="Borrar grupo" onPress={remove} />
      {error ? <AppText color={colors.danger}>{error}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
});
