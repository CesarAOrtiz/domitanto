import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useServices } from '../../application/services';
import type { Player } from '../../data/peopleRepository';
import { storageMessage } from '../../features/game/format';
import { AppText } from '../../ui/components/AppText';
import { Button } from '../../ui/components/Button';
import { Chip } from '../../ui/components/Chip';
import { Field } from '../../ui/components/Field';
import { Header } from '../../ui/components/Header';
import { Screen } from '../../ui/components/Screen';
import { useTheme } from '../../ui/theme';
import { space } from '../../ui/tokens';

/** Crear o editar un grupo: nombre y quiénes lo forman. */
export default function EditGroupScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const { people } = useServices();
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    people.players().then(
      (p) => setPlayers(p.filter((x) => x.archivedAt === null)),
      () => undefined,
    );
    if (id) {
      people.group(id).then(
        (g) => {
          if (!g) return;
          setName(g.name);
          setMembers(g.memberIds);
        },
        () => undefined,
      );
    }
  }, [people, id]);

  const toggle = (playerId: string) =>
    setMembers((m) => (m.includes(playerId) ? m.filter((x) => x !== playerId) : [...m, playerId]));

  const addPlayer = async () => {
    try {
      const player = await people.createPlayer(newName);
      setPlayers((p) => [player, ...p]);
      setMembers((m) => [...m, player.id]);
      setNewName('');
    } catch (e) {
      setError(storageMessage(e));
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const groupId = await people.saveGroup({ id, name, memberIds: members });
      router.replace({ pathname: '/grupos/[id]', params: { id: groupId } });
    } catch (e) {
      setError(storageMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          size="lg"
          label={id ? 'Guardar cambios' : 'Crear grupo'}
          hint={`${members.length} ${members.length === 1 ? 'jugador' : 'jugadores'}`}
          onPress={save}
          loading={busy}
          disabled={!name.trim()}
          testID="save-group"
        />
      }
    >
      <Header title={id ? 'Editar grupo' : 'Nuevo grupo'} />

      <Field label="Nombre del grupo" placeholder="Los viernes" value={name} maxLength={40} onChangeText={setName} />

      <View style={styles.section}>
        <AppText variant="overline" muted accessibilityRole="header">
          Quiénes juegan
        </AppText>
        <AppText variant="caption" muted>
          Toca para añadir o quitar. Puedes cambiarlo cuando quieras; no se borra ninguna partida.
        </AppText>
        {players.length === 0 ? (
          <AppText muted>No hay jugadores guardados todavía. Añade el primero abajo.</AppText>
        ) : (
          <View style={styles.chips}>
            {players.map((p) => (
              <Chip
                key={p.id}
                label={p.displayName}
                selected={members.includes(p.id)}
                icon={members.includes(p.id) ? 'check' : 'plus'}
                onPress={() => toggle(p.id)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Field
          label="Añadir a alguien nuevo"
          placeholder="Nombre o apodo"
          value={newName}
          maxLength={40}
          onChangeText={setNewName}
          onSubmitEditing={addPlayer}
        />
        <Button tone="secondary" label="Añadir al grupo" onPress={addPlayer} disabled={!newName.trim()} />
      </View>

      {error ? <AppText color={colors.danger}>{error}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
