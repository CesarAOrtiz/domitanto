import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ActiveGameExistsError } from '../application/gameService';
import { useServices } from '../application/services';
import { HOUSE_BONUSES, sideLetter, TARGET_PRESETS } from '../domain';
import { storageMessage } from '../features/game/format';
import { defaultForm, formFromGame, validateForm, type SetupForm } from '../features/game/setupForm';
import { AppText } from '../ui/components/AppText';
import { Button } from '../ui/components/Button';
import { Field } from '../ui/components/Field';
import { IconButton } from '../ui/components/IconButton';
import { Screen } from '../ui/components/Screen';
import { Segmented } from '../ui/components/Segmented';
import { Surface } from '../ui/components/Surface';
import { TeamBadge } from '../ui/components/TeamBadge';
import { useTheme } from '../ui/theme';
import { radius, space, touch } from '../ui/tokens';

export default function NewGame() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { colors } = useTheme();
  const { games, newCommandId } = useServices();
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
  }, [games, from]);

  const update = (patch: Partial<SetupForm>) => {
    command.current = null;
    setForm((f) => ({ ...f, ...patch }));
  };
  const setPlayer = (side: number, seat: number, name: string) => {
    const playerNames = form.playerNames.map((row) => [...row]);
    playerNames[side]![seat] = name;
    update({ playerNames });
  };

  const { setup, errors } = validateForm(form);
  const enabledRules = HOUSE_BONUSES.filter((b) => form.bonuses[b.code]?.enabled);

  const start = async () => {
    setShowErrors(true);
    if (!setup) return;
    command.current ??= newCommandId();
    setBusy(true);
    setError(null);
    try {
      const id = await games.createGame(setup, command.current);
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
        <AppText variant="title" accessibilityRole="header" style={styles.flex}>
          Nueva partida
        </AppText>
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
                    <Field
                      key={seat}
                      label={`Jugador ${seat + 1}`}
                      placeholder={`Jugador ${sideLetter(i)}${seat + 1}`}
                      value={form.playerNames[i]?.[seat]}
                      maxLength={40}
                      onChangeText={(t) => setPlayer(i, seat, t)}
                    />
                  ))}
                </View>
              </>
            ) : (
              <Field
                label="Nombre"
                placeholder={`Jugador ${i + 1}`}
                value={form.playerNames[i]?.[0]}
                maxLength={40}
                onChangeText={(t) => setPlayer(i, 0, t)}
              />
            )}
          </View>
        ))}
      </Section>

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
  rules: { borderWidth: 2, borderRadius: radius.lg, overflow: 'hidden' },
  rulesHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, minHeight: touch.min },
  rule: { borderTopWidth: 1, padding: space.lg, gap: space.md },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
