import Feather from '@expo/vector-icons/Feather';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GameSnapshot } from '../../application/gameService';
import { useServices, useSettings } from '../../application/services';
import { lastEffectiveEntry, sideById, sideLetter } from '../../domain';
import { storageMessage } from '../../features/game/format';
import { AppText } from '../../ui/components/AppText';
import { useTheme } from '../../ui/theme';
import { radius, scoreFontSize, space, touch } from '../../ui/tokens';

const KEEP_AWAKE_TAG = 'la-mesa-modo-mesa';

/** Pantalla encendida solo mientras el modo mesa está visible y la app en primer plano. */
function useTableKeepAwake(enabled: boolean) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      const on = () => activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
      const off = () => deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
      if (AppState.currentState === 'active') void on();
      const sub = AppState.addEventListener('change', (s) => void (s === 'active' ? on() : off()));
      return () => {
        sub.remove();
        void off();
      };
    }, [enabled]),
  );
}

/**
 * Modo mesa: solo lectura, números dominantes y, opcionalmente, una copia girada 180°
 * para quien está enfrente. Se sale con un botón explícito.
 */
export default function TableMode() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { games } = useServices();
  const [settings, updateSettings] = useSettings();
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useTableKeepAwake(settings.tableKeepAwake);

  useEffect(() => {
    games.getGame(id).then(setSnapshot, (e: unknown) => setError(storageMessage(e)));
  }, [games, id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/partida/${id}`));

  if (!snapshot) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.lg }]}>
        {error ? <AppText color={colors.danger}>{error}</AppText> : null}
      </View>
    );
  }

  const landscape = width > height;
  const mirror = settings.tableMirror;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top + space.sm,
          paddingBottom: insets.bottom + space.sm,
          paddingLeft: insets.left + space.md,
          paddingRight: insets.right + space.md,
        },
      ]}
    >
      {mirror ? (
        <View
          style={[styles.half, styles.flipped]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Board snapshot={snapshot} landscape={landscape} compact />
        </View>
      ) : null}

      <View style={styles.half}>
        <Board snapshot={snapshot} landscape={landscape} compact={mirror} />
      </View>

      <View style={[styles.controls, { borderColor: colors.hairline }]}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Volver al apunte"
          testID="exit-table"
          style={({ pressed }) => [
            styles.exit,
            { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={20} color={colors.onPrimary} />
          <AppText variant="bodyStrong" color={colors.onPrimary}>
            Volver al apunte
          </AppText>
        </Pressable>
        <Toggle label="Copia girada" value={mirror} onChange={(v) => void updateSettings({ tableMirror: v })} />
        <Toggle
          label="Pantalla encendida"
          value={settings.tableKeepAwake}
          onChange={(v) => void updateSettings({ tableKeepAwake: v })}
        />
      </View>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.toggle}>
      <AppText variant="label">{label}</AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.team[0], false: colors.hairline }}
      />
    </View>
  );
}

function Board({ snapshot, landscape, compact }: { snapshot: GameSnapshot; landscape: boolean; compact?: boolean }) {
  const { colors } = useTheme();
  const { state, outcome } = snapshot;
  const sides = [...state.sides].sort((a, b) => a.position - b.position);
  const last = lastEffectiveEntry(outcome);
  const lastSide = last ? sideById(state.sides, last.current.sideId) : undefined;
  const many = sides.length > 2;
  const scoreSize = compact ? (many ? 56 : 84) : many ? 72 : landscape ? 140 : 112;

  return (
    <View style={styles.board}>
      <View style={styles.scores}>
        {sides.map((s) => {
          const total = outcome.totals[s.id] ?? 0;
          const size = scoreFontSize(scoreSize, total);
          return (
            <View
              key={s.id}
              style={[styles.score, { backgroundColor: colors.team[s.position], borderColor: colors.stroke }]}
              accessible
              accessibilityLabel={`${s.displayName}: ${total} puntos`}
            >
              <AppText variant="bodyStrong" color={colors.onTeam} numberOfLines={1}>
                {sideLetter(s.position)} · {s.displayName}
              </AppText>
              <AppText
                variant="score"
                color={colors.onTeam}
                style={{ fontSize: size, lineHeight: Math.round(size * 1.05) }}
                adjustsFontSizeToFit
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
              >
                {total}
              </AppText>
            </View>
          );
        })}
      </View>
      <AppText variant="caption" muted align="center" numberOfLines={2}>
        Meta {state.rules.target}
        {last
          ? ` · última: ${last.entry.kind === 'scoreless_hand' ? 'mano sin puntos' : `+${last.total} a ${lastSide?.displayName ?? ''}`}${last.state === 'out_of_result' ? ' (fuera de resultado)' : ''}`
          : ''}
        {state.status === 'finished' ? ' · partida terminada' : ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: space.sm },
  half: { flex: 1 },
  flipped: { transform: [{ rotate: '180deg' }] },
  board: { flex: 1, gap: space.sm, justifyContent: 'center' },
  scores: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  score: {
    flex: 1,
    minWidth: 140,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: space.md,
    justifyContent: 'space-between',
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.md,
    borderTopWidth: 1,
    paddingTop: space.sm,
  },
  exit: {
    minHeight: touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.min },
});
