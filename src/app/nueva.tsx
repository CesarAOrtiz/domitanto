import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ActiveGameExistsError } from '../application/gameService';
import { useServices, useSettings } from '../application/services';
import type { Group, Player } from '../data/peopleRepository';
import { HOUSE_BONUSES, sideLetter, TARGET_PRESETS } from '../domain';
import { storageMessage } from '../features/game/format';
import {
  defaultForm,
  formFromGame,
  normalizeName,
  seats,
  validateForm,
  type SetupForm,
} from '../features/game/setupForm';
import { AppText } from '../ui/components/AppText';
import { Button } from '../ui/components/Button';
import { Chip } from '../ui/components/Chip';
import { Field } from '../ui/components/Field';
import { IconButton } from '../ui/components/IconButton';
import { Screen } from '../ui/components/Screen';
import { Segmented } from '../ui/components/Segmented';
import { Surface } from '../ui/components/Surface';
import { TeamBadge } from '../ui/components/TeamBadge';
import { useTheme } from '../ui/theme';
import { radius, space, touch } from '../ui/tokens';

export default function NewGame() {
  const { from, grupo } = useLocalSearchParams<{ from?: string; grupo?: string }>();
  const { colors } = useTheme();
  const { games, people, newCommandId } = useServices();
  const [settings, updateSettings] = useSettings();
  const [players, setPlayers] = useState<Player[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [form, setForm] = useState<SetupForm>(defaultForm);
  const [customTarget, setCustomTarget] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const command = useRef<string | null>(null);

  useEffect(() => {
    games.activeGameId().then(setActiveId, () => undefined);
    people.players().then(
      (p) => setPlayers(p.filter((x) => x.archivedAt === null)),
      () => undefined,
    );
    if (grupo) people.group(grupo).then(setGroup, () => undefined);
    if (from) {
      games.getGame(from).then(
        ({ state }) => {
          const prefilled = formFromGame(state);
          setForm(prefilled);
          setCustomTarget(!TARGET_PRESETS.includes(Number(prefilled.target) as (typeof TARGET_PRESETS)[number]));
        },
        () => undefined,
      );
    }
  }, [games, people, from, grupo]);

  const update = (patch: Partial<SetupForm>) => {
    command.current = null;
    setForm((f) => ({ ...f, ...patch }));
  };
  /** Escribir en un puesto lo desvincula del jugador guardado que tuviera. */
  const setPlayer = (side: number, seat: number, name: string, playerId: string | null = null) => {
    const playerNames = form.playerNames.map((row) => [...row]);
    const playerIds = form.playerIds.map((row) => [...row]);
    playerNames[side]![seat] = name;
    playerIds[side]![seat] = playerId;
    update({ playerNames, playerIds });
  };

  const openSeats = seats(form);
  const seatedIds = new Set(openSeats.map(([side, seat]) => form.playerIds[side]?.[seat]).filter(Boolean));
  const savedNames = new Set(players.map((p) => normalizeName(p.displayName)));

  /** Tocar un jugador lo sienta en el primer puesto libre; tocarlo otra vez lo levanta. */
  const togglePlayer = (player: Player) => {
    const taken = openSeats.find(([side, seat]) => form.playerIds[side]?.[seat] === player.id);
    if (taken) return setPlayer(taken[0], taken[1], '');
    const free = openSeats.find(
      ([side, seat]) => !form.playerIds[side]?.[seat] && !form.playerNames[side]?.[seat]?.trim(),
    );
    if (free) setPlayer(free[0], free[1], player.displayName, player.id);
  };
  const hasFreeSeat = openSeats.some(
    ([side, seat]) => !form.playerIds[side]?.[seat] && !form.playerNames[side]?.[seat]?.trim(),
  );

  /** Jugador guardado con el mismo nombre que lo escrito en un puesto sin vincular. */
  const matchFor = (side: number, seat: number): Player | undefined => {
    const typed = form.playerNames[side]?.[seat] ?? '';
    if (form.playerIds[side]?.[seat] || !typed.trim()) return undefined;
    return players.find((p) => !seatedIds.has(p.id) && normalizeName(p.displayName) === normalizeName(typed));
  };

  const groupMembers = group ? players.filter((p) => group.memberIds.includes(p.id)) : [];
  const suggestions = group ? groupMembers : showAllPlayers ? players : players.slice(0, 8);

  const { setup, errors } = validateForm(form, { savedNames, saveNewNames: settings.saveNewNames });
  const enabledRules = HOUSE_BONUSES.filter((b) => form.bonuses[b.code]?.enabled);

  const start = async () => {
    setShowErrors(true);
    if (!setup) return;
    command.current ??= newCommandId();
    setBusy(true);
    setError(null);
    try {
      const id = await games.createGame(setup, command.current, { groupId: group?.id ?? null });
      command.current = null;
      router.replace(`/partida/${id}`);
    } catch (e) {
      if (e instanceof ActiveGameExistsError) setActiveId(e.activeGameId);
      else setError(storageMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const abandonActive = () => {
    if (!activeId) return;
    Alert.alert(
      '¿Abandonar la partida en curso?',
      'Queda en el historial como abandonada. No cuenta como victoria ni derrota.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Abandonar',
          style: 'destructive',
          onPress: async () => {
            try {
              await games.abandon(activeId, newCommandId());
              setActiveId(null);
            } catch (e) {
              setError(storageMessage(e));
            }
          },
        },
      ],
    );
  };

  const sideCount = form.mode === 'pairs' ? 2 : form.individualCount;
  const summary = `${form.mode === 'pairs' ? 'Parejas' : `Individual · ${form.individualCount}`} · meta ${form.target || '—'}`;

  return (
    <Screen
      footer={
        <Button
          testID="start-game"
          size="lg"
          label="Empezar partida"
          hint={summary}
          onPress={start}
          loading={busy}
          disabled={!!activeId}
        />
      }
    >
      <View style={styles.top}>
        <IconButton
          icon="x"
          label="Cerrar"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <View style={styles.flex}>
          <AppText variant="title" accessibilityRole="header">
            Nueva partida
          </AppText>
          {group ? (
            <AppText variant="caption" muted>
              Con {group.name}
            </AppText>
          ) : null}
        </View>
      </View>

      {activeId ? (
        <Surface fill={colors.dangerSoft} raised={false}>
          <AppText variant="bodyStrong">Ya hay una partida en curso</AppText>
          <AppText variant="caption" muted style={styles.gapBelow}>
            Solo puede haber una activa. Continúala o abandónala antes de empezar otra.
          </AppText>
          <View style={styles.actions}>
            <Button label="Continuar la partida" onPress={() => router.replace(`/partida/${activeId}`)} />
            <Button tone="danger" label="Abandonarla" onPress={abandonActive} />
          </View>
        </Surface>
      ) : null}

      <Section title="Modo">
        <Segmented
          label="Modo de juego"
          value={form.mode}
          onChange={(mode) => update({ mode })}
          options={[
            { value: 'pairs', label: 'Parejas', hint: '2 contra 2' },
            { value: 'individual', label: 'Individual', hint: '2 a 4' },
          ]}
        />
        {form.mode === 'individual' ? (
          <Segmented
            label="Participantes"
            value={form.individualCount}
            onChange={(individualCount) => update({ individualCount })}
            options={[2, 3, 4].map((n) => ({ value: n as 2 | 3 | 4, label: `${n} jugadores` }))}
          />
        ) : null}
      </Section>

      <Section title="Meta">
        <Segmented
          label="Meta de puntos"
          value={customTarget ? 'otra' : form.target}
          onChange={(v) => {
            if (v === 'otra') {
              setCustomTarget(true);
            } else {
              setCustomTarget(false);
              update({ target: v });
            }
          }}
          options={[
            ...TARGET_PRESETS.map((t) => ({ value: String(t), label: String(t) })),
            { value: 'otra', label: 'Otra' },
          ]}
        />
        {customTarget ? (
          <Field
            label="Meta personalizada"
            keyboardType="number-pad"
            value={form.target}
            maxLength={4}
            onChangeText={(target) => update({ target: target.replace(/\D/g, '') })}
            error={showErrors || form.target.length > 0 ? errors.target : null}
          />
        ) : null}
        <AppText variant="caption" muted>
          Gana quien primero alcance o pase la meta. Se guarda el total real, por ejemplo 212.
        </AppText>
      </Section>

      <Section title="Nombres" note="Opcionales. Puedes empezar sin escribir nada.">
        {suggestions.length > 0 ? (
          <View style={styles.saved}>
            <AppText variant="caption" muted>
              {group ? `Jugadores de ${group.name}.` : 'Jugadores guardados.'} Toca un nombre para sentarlo en el primer
              puesto libre; tócalo otra vez para quitarlo.
            </AppText>
            <View style={styles.chips}>
              {suggestions.map((p) => {
                const seated = seatedIds.has(p.id);
                return (
                  <Chip
                    key={p.id}
                    label={p.displayName}
                    selected={seated}
                    icon={seated ? 'check' : undefined}
                    disabled={!seated && !hasFreeSeat}
                    onPress={() => togglePlayer(p)}
                    accessibilityHint={seated ? 'Quitar de la partida' : 'Sentar en el primer puesto libre'}
                  />
                );
              })}
              {!group && players.length > 8 ? (
                <Chip
                  label={showAllPlayers ? 'Ver menos' : `Ver todos (${players.length})`}
                  onPress={() => setShowAllPlayers((v) => !v)}
                />
              ) : null}
            </View>
          </View>
        ) : null}
        {Array.from({ length: sideCount }, (_, i) => (
          <View key={i} style={[styles.sideBox, { borderColor: colors.hairline, backgroundColor: colors.teamSoft[i] }]}>
            <View style={styles.sideHead}>
              <TeamBadge position={i} />
              <AppText variant="bodyStrong" color={colors.teamText[i]}>
                {form.mode === 'pairs' ? `Equipo ${sideLetter(i)}` : `Jugador ${i + 1}`}
              </AppText>
            </View>
            {form.mode === 'pairs' ? (
              <>
                <Field
                  label="Nombre del equipo"
                  placeholder={`Equipo ${sideLetter(i)}`}
                  value={form.sideNames[i]}
                  maxLength={40}
                  onChangeText={(t) => {
                    const sideNames = [...form.sideNames];
                    sideNames[i] = t;
                    update({ sideNames });
                  }}
                />
                <View style={styles.pair}>
                  {[0, 1].map((seat) => (
                    <View key={seat} style={styles.seat}>
                      <Field
                        label={`Jugador ${seat + 1}`}
                        placeholder={`Jugador ${sideLetter(i)}${seat + 1}`}
                        value={form.playerNames[i]?.[seat]}
                        maxLength={40}
                        accent={form.playerIds[i]?.[seat] ? colors.team[i] : undefined}
                        onChangeText={(t) => setPlayer(i, seat, t)}
                      />
                      <SeatNote
                        linked={!!form.playerIds[i]?.[seat]}
                        match={matchFor(i, seat)}
                        onUse={(p) => setPlayer(i, seat, p.displayName, p.id)}
                      />
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.seat}>
                <Field
                  label="Nombre"
                  placeholder={`Jugador ${i + 1}`}
                  value={form.playerNames[i]?.[0]}
                  maxLength={40}
                  accent={form.playerIds[i]?.[0] ? colors.team[i] : undefined}
                  onChangeText={(t) => setPlayer(i, 0, t)}
                />
                <SeatNote
                  linked={!!form.playerIds[i]?.[0]}
                  match={matchFor(i, 0)}
                  onUse={(p) => setPlayer(i, 0, p.displayName, p.id)}
                />
              </View>
            )}
          </View>
        ))}
      </Section>

      <View style={styles.saveRow}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Guardar nombres nuevos</AppText>
          <AppText variant="caption" muted>
            Así la app lleva las victorias de cada persona. Los puestos vacíos son invitados y no cuentan.
          </AppText>
        </View>
        <Switch
          value={settings.saveNewNames}
          accessibilityLabel="Guardar nombres nuevos como jugadores"
          onValueChange={(saveNewNames) => void updateSettings({ saveNewNames }).catch(() => undefined)}
          trackColor={{ true: colors.team[0], false: colors.hairline }}
        />
      </View>

      {HOUSE_BONUSES.length > 0 ? (
        <View style={[styles.rules, { borderColor: colors.stroke, backgroundColor: colors.surface }]}>
          <Pressable
            onPress={() => setRulesOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityState={{ expanded: rulesOpen }}
            style={styles.rulesHead}
          >
            <View style={styles.flex}>
              <AppText variant="bodyStrong">Reglas de la casa</AppText>
              <AppText variant="caption" muted>
                {enabledRules.length === 0
                  ? 'Ninguna activa · todo se suma a mano'
                  : enabledRules.map((b) => `${b.label} ${form.bonuses[b.code]?.value}`).join(' · ')}
              </AppText>
            </View>
            <Feather name={rulesOpen ? 'chevron-up' : 'chevron-down'} size={22} color={colors.ink} />
          </Pressable>
          {rulesOpen
            ? HOUSE_BONUSES.map((b) => {
                const rule = form.bonuses[b.code]!;
                return (
                  <View key={b.code} style={[styles.rule, { borderColor: colors.hairline }]}>
                    <View style={styles.ruleRow}>
                      <View style={styles.flex}>
                        <AppText variant="bodyStrong">{b.label}</AppText>
                        <AppText variant="caption" muted>
                          Aparece como opción al anotar. Nunca se suma sola.
                        </AppText>
                      </View>
                      <Switch
                        value={rule.enabled}
                        accessibilityLabel={`Activar ${b.label}`}
                        onValueChange={(enabled) =>
                          update({ bonuses: { ...form.bonuses, [b.code]: { ...rule, enabled } } })
                        }
                        trackColor={{ true: colors.team[0], false: colors.hairline }}
                      />
                    </View>
                    {rule.enabled ? (
                      <Field
                        label={`Valor de ${b.label.toLowerCase()}`}
                        keyboardType="number-pad"
                        maxLength={4}
                        value={rule.value}
                        onChangeText={(value) =>
                          update({
                            bonuses: { ...form.bonuses, [b.code]: { ...rule, value: value.replace(/\D/g, '') } },
                          })
                        }
                        error={errors.bonuses?.[b.code]}
                      />
                    ) : null}
                  </View>
                );
              })
            : null}
        </View>
      ) : null}

      {error ? <AppText color={colors.danger}>{error}</AppText> : null}
    </Screen>
  );
}

/** Debajo de un puesto: si está vinculado o si su nombre coincide con un jugador guardado. */
function SeatNote({ linked, match, onUse }: { linked: boolean; match?: Player; onUse: (p: Player) => void }) {
  if (linked) {
    return (
      <AppText variant="caption" muted>
        Jugador guardado
      </AppText>
    );
  }
  if (!match) return null;
  return (
    <Chip
      label={`Usar a ${match.displayName} guardado`}
      icon="user-check"
      onPress={() => onUse(match)}
      accessibilityHint="Cuenta esta partida en sus estadísticas"
    />
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View>
        <AppText variant="overline" muted accessibilityRole="header">
          {title}
        </AppText>
        {note ? (
          <AppText variant="caption" muted>
            {note}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  section: { gap: space.sm },
  gapBelow: { marginBottom: space.md },
  actions: { gap: space.sm },
  sideBox: { borderWidth: 1.5, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  sideHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  seat: { flex: 1, minWidth: 140, gap: space.xs },
  saved: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rules: { borderWidth: 2, borderRadius: radius.lg, overflow: 'hidden' },
  rulesHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, minHeight: touch.min },
  rule: { borderTopWidth: 1, padding: space.lg, gap: space.md },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
