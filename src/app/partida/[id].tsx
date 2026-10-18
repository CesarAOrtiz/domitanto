import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { GameSnapshot } from '../../application/gameService';
import { useServices } from '../../application/services';
import { findUndoTarget, lastEffectiveEntry, sideById, type GameCommand } from '../../domain';
import { modeLabel, storageMessage } from '../../features/game/format';
import { hapticError, hapticSuccess } from '../../platform/haptics';
import { AppText } from '../../ui/components/AppText';
import { Button } from '../../ui/components/Button';
import { HandTable } from '../../ui/components/HandTable';
import { IconButton } from '../../ui/components/IconButton';
import { ScoreEntrySheet, type EntrySubmission } from '../../ui/components/ScoreEntrySheet';
import { ScorePanel } from '../../ui/components/ScorePanel';
import { Screen } from '../../ui/components/Screen';
import { useTheme } from '../../ui/theme';
import { radius, space } from '../../ui/tokens';

type SaveState = 'idle' | 'saved' | 'error';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { games, newCommandId } = useServices();
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheetSide, setSheetSide] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [save, setSave] = useState<{ state: SaveState; message?: string }>({ state: 'idle' });
  const [undoing, setUndoing] = useState(false);
  const undoCommand = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      games
        .getGame(id)
        .then((s) => alive && setSnapshot(s))
        .catch((e: unknown) => alive && setLoadError(storageMessage(e)));
      return () => {
        alive = false;
      };
    }, [games, id]),
  );

  const run = async (command: GameCommand) => {
    const result = await games.execute(id, command);
    setSnapshot(result);
    setSave({ state: 'saved' });
    hapticSuccess();
    if (result.outcome.status === 'finished') {
      setSheetOpen(false);
      router.replace(`/resultado/${id}`);
    }
    return result;
  };

  const submit = async (entry: EntrySubmission) => {
    try {
      await run({ type: 'add_entry', ...entry });
      setSheetOpen(false);
    } catch (e) {
      hapticError();
      throw new Error(storageMessage(e));
    }
  };

  const undo = async () => {
    undoCommand.current ??= newCommandId();
    setUndoing(true);
    try {
      await run({ type: 'undo', commandId: undoCommand.current });
      undoCommand.current = null;
    } catch (e) {
      hapticError();
      setSave({ state: 'error', message: storageMessage(e) });
    } finally {
      setUndoing(false);
    }
  };

  if (!snapshot) {
    return (
      <Screen>
        <IconButton icon="chevron-left" label="Inicio" showLabel onPress={() => router.replace('/')} />
        {loadError ? <AppText color={colors.danger}>{loadError}</AppText> : null}
      </Screen>
    );
  }

  const { state, outcome } = snapshot;
  const sides = [...state.sides].sort((a, b) => a.position - b.position);
  const playable = state.status === 'active';
  const compact = sides.length > 2;
  const last = lastEffectiveEntry(outcome);
  const lastSide = last ? sideById(state.sides, last.current.sideId) : undefined;
  const undoTarget = findUndoTarget(state);
  const undoEntry = undoTarget ? outcome.entries.find((v) => v.entry.id === undoTarget.entryId) : undefined;

  return (
    <Screen
      footer={
        playable ? (
          <View style={styles.footerRow}>
            <View style={styles.saveStatus} accessibilityLiveRegion="polite">
              {save.state === 'error' ? (
                <>
                  <Feather name="alert-triangle" size={16} color={colors.danger} />
                  <AppText variant="caption" color={colors.danger} style={styles.flex}>
                    No se guardó. {save.message}
                  </AppText>
                </>
              ) : (
                <>
                  <Feather name="smartphone" size={16} color={colors.inkMuted} />
                  <AppText variant="caption" muted style={styles.flex}>
                    {save.state === 'saved' ? 'Guardado en este teléfono' : 'Se guarda en este teléfono'}
                  </AppText>
                </>
              )}
            </View>
            {undoTarget && undoEntry ? (
              <Button
                testID="undo"
                tone="secondary"
                label="Deshacer"
                icon={<Feather name="rotate-ccw" size={18} color={colors.ink} />}
                onPress={undo}
                loading={undoing}
                accessibilityHint={`Deshace la última operación sobre la mano ${undoEntry.entry.sequence}`}
              />
            ) : null}
          </View>
        ) : undefined
      }
    >
      <View style={styles.topBar}>
        <IconButton icon="chevron-left" label="Inicio" onPress={() => router.replace('/')} testID="go-home" />
        <View style={styles.meta}>
          <AppText variant="overline" muted>
            {modeLabel(state)}
          </AppText>
          <AppText variant="bodyStrong" tabular>
            Meta {state.rules.target} · {outcome.handsPlayed} {outcome.handsPlayed === 1 ? 'mano' : 'manos'}
          </AppText>
        </View>
      </View>

      {!playable ? (
        <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.stroke }]}>
          <AppText variant="bodyStrong" style={styles.flex}>
            {state.status === 'abandoned' ? 'Partida abandonada' : 'Partida terminada'}
          </AppText>
          {state.status === 'finished' ? (
            <Button tone="secondary" label="Ver resultado" onPress={() => router.replace(`/resultado/${id}`)} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.panels}>
        {sides.map((side) => (
          <View key={side.id} style={compact ? styles.panelHalf : styles.panelFlex}>
            <ScorePanel
              side={side}
              total={outcome.totals[side.id] ?? 0}
              target={state.rules.target}
              compact={compact}
              winner={outcome.winnerSideId === side.id}
              onScore={
                playable
                  ? () => {
                      setSheetSide(side.id);
                      setSheetOpen(true);
                    }
                  : undefined
              }
            />
          </View>
        ))}
      </View>

      {last ? (
        <View
          style={[styles.last, { borderColor: colors.hairline, backgroundColor: colors.surface }]}
          testID="last-entry"
        >
          <AppText variant="overline" muted>
            Última anotación
          </AppText>
          <AppText variant="bodyStrong">
            {last.entry.kind === 'scoreless_hand'
              ? `Mano ${last.entry.sequence} sin puntos`
              : `+${last.total} a ${lastSide?.displayName ?? ''} · mano ${last.entry.sequence}`}
          </AppText>
        </View>
      ) : null}

      <HandTable sides={state.sides} outcome={outcome} />

      <ScoreEntrySheet
        visible={sheetOpen}
        sides={sides}
        bonuses={state.rules.bonuses}
        initialSideId={sheetSide}
        makeCommandId={newCommandId}
        onSubmit={submit}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  meta: { flex: 1 },
  panels: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  panelFlex: { flex: 1, minWidth: 150 },
  panelHalf: { flexBasis: '46%', flexGrow: 1 },
  last: { borderWidth: 1.5, borderRadius: radius.md, padding: space.md, gap: 2 },
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: space.md,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  saveStatus: { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
