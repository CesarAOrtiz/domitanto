import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useServices } from '../../application/services';
import type { Group, Player } from '../../data/peopleRepository';
import { storageMessage } from '../../features/game/format';
import { plural } from '../../features/people/format';
import { AppText } from '../../ui/components/AppText';
import { Button } from '../../ui/components/Button';
import { GuideButton, GuideCard, GuidePoint, useGuide } from '../../ui/components/Guide';
import { Header } from '../../ui/components/Header';
import { RecordRow } from '../../ui/components/RecordRow';
import { Screen } from '../../ui/components/Screen';
import { useTheme } from '../../ui/theme';
import { space } from '../../ui/tokens';

export default function GroupsScreen() {
  const { colors } = useTheme();
  const { people } = useServices();
  const guide = useGuide('grupos');
  const [groups, setGroups] = useState<Group[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([people.groups(), people.players()])
        .then(([g, p]) => {
          setGroups(g);
          setPlayers(p);
          setError(null);
        })
        .catch((e: unknown) => setError(storageMessage(e)))
        .finally(() => setLoaded(true));
    }, [people]),
  );

  const names = (group: Group) =>
    group.memberIds
      .map((id) => players.find((p) => p.id === id)?.displayName)
      .filter(Boolean)
      .join(', ');

  return (
    <Screen
      footer={<Button size="lg" label="Nuevo grupo" onPress={() => router.push('/grupos/editar')} testID="new-group" />}
    >
      <Header title="Grupos" actions={guide.open ? null : <GuideButton onPress={guide.show} />} />

      {guide.open ? (
        <GuideCard icon="users" title="¿Qué es un grupo?" onDismiss={guide.dismiss}>
          <GuidePoint>Es la gente con la que juegas siempre, por ejemplo «Los viernes» o «La familia».</GuidePoint>
          <GuidePoint>
            Con «Jugar con este grupo», la partida te ofrece solo a esas personas para sentarlas con un toque.
          </GuidePoint>
          <GuidePoint>En el grupo ves quién gana más y qué pareja funciona mejor entre ustedes.</GuidePoint>
          <GuidePoint>Es una lista de este teléfono: nadie recibe invitaciones ni necesita la app.</GuidePoint>
        </GuideCard>
      ) : null}

      {error ? <AppText color={colors.danger}>{error}</AppText> : null}

      {loaded && groups.length === 0 ? (
        <AppText muted>Aún no tienes grupos. Son opcionales: puedes jugar sin ellos.</AppText>
      ) : null}

      <View style={styles.list}>
        {groups.map((g) => (
          <RecordRow
            key={g.id}
            title={g.name}
            subtitle={
              g.memberIds.length
                ? `${plural(g.memberIds.length, 'jugador', 'jugadores')} · ${names(g)}`
                : 'Sin jugadores'
            }
            onPress={() => router.push({ pathname: '/grupos/[id]', params: { id: g.id } })}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
});
