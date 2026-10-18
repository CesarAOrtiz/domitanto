import Feather from '@expo/vector-icons/Feather';
import { useReducer, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BonusRule, Side } from '../../domain';
import { sideLetter } from '../../domain';
import { confirmLabel, draftReducer, emptyDraft, summarizeDraft, type DraftAction } from '../../features/scoring/draft';
import { useTheme } from '../theme';
import { radius, space, touch } from '../tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { NumericKeypad } from './NumericKeypad';

export interface EntrySubmission {
  commandId: string;
  kind: 'hand' | 'scoreless_hand';
  sideId: string | null;
  basePoints: number;
  bonusCodes: string[];
}

interface Props {
  visible: boolean;
  sides: Side[];
  bonuses: BonusRule[];
  initialSideId: string | null;
  shortcuts?: number[];
  makeCommandId: () => string;
  /** Debe resolver solo tras el commit. Si lanza, se conserva el borrador. */
  onSubmit: (entry: EntrySubmission) => Promise<void>;
  onClose: () => void;
}

const DEFAULT_SHORTCUTS = [10, 25, 50];

export function ScoreEntrySheet(props: Props) {
  const { colors, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={props.onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={props.onClose} accessibilityLabel="Cerrar sin anotar" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.stroke, paddingBottom: insets.bottom + space.lg },
          ]}
          accessibilityViewIsModal
        >
          {/* Cada apertura monta un borrador nuevo. */}
          {props.visible ? <SheetBody {...props} /> : null}
        </View>
      </View>
    </Modal>
  );
}

function SheetBody({
  sides,
  bonuses,
  initialSideId,
  shortcuts = DEFAULT_SHORTCUTS,
  makeCommandId,
  onSubmit,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const [draft, rawDispatch] = useReducer(draftReducer, initialSideId, emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmScoreless, setConfirmScoreless] = useState(false);
  // El mismo commandId se reutiliza al reintentar el mismo borrador; cambiarlo genera otro.
  const commandId = useRef<string | null>(null);
  const scorelessCommandId = useRef<string | null>(null);

  const dispatch = (action: DraftAction) => {
    commandId.current = null;
    setError(null);
    rawDispatch(action);
  };

  const summary = summarizeDraft(draft, bonuses);
  const side = sides.find((s) => s.id === draft.sideId);

  const submit = async (entry: Omit<EntrySubmission, 'commandId'>, ref: typeof commandId) => {
    if (saving) return;
    ref.current ??= makeCommandId();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...entry, commandId: ref.current });
      ref.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const label = side && summary.valid ? confirmLabel(summary.total, side.displayName) : (summary.problem ?? '');

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bounces={false}>
      <View style={styles.titleRow}>
        <AppText variant="heading" accessibilityRole="header">
          {confirmScoreless ? 'Mano sin puntos' : 'Anotar mano'}
        </AppText>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          hitSlop={8}
          style={styles.close}
        >
          <Feather name="x" size={24} color={colors.ink} />
        </Pressable>
      </View>

      {confirmScoreless ? (
        <View style={styles.scoreless}>
          <AppText>
            Se registra una mano jugada en la que nadie suma, por ejemplo una tranca acordada sin puntos. No cambia el
            marcador.
          </AppText>
          {error ? <ErrorNote message={error} /> : null}
          <Button
            label={error ? 'Reintentar mano sin puntos' : 'Registrar mano sin puntos'}
            loading={saving}
            onPress={() =>
              submit({ kind: 'scoreless_hand', sideId: null, basePoints: 0, bonusCodes: [] }, scorelessCommandId)
            }
            testID="confirm-scoreless"
          />
          <Button label="Volver" tone="ghost" onPress={() => setConfirmScoreless(false)} disabled={saving} />
        </View>
      ) : (
        <>
          <View style={styles.sides} accessibilityRole="radiogroup" accessibilityLabel="Equipo que recibe los puntos">
            {sides.map((s) => {
              const selected = s.id === draft.sideId;
              const team = colors.team[s.position] ?? colors.ink;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => dispatch({ type: 'side', sideId: s.id })}
                  disabled={saving}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`Equipo ${sideLetter(s.position)}, ${s.displayName}`}
                  testID={`side-${sideLetter(s.position)}`}
                  style={[
                    styles.sideChip,
                    {
                      backgroundColor: selected ? team : colors.teamSoft[s.position],
                      borderColor: selected ? colors.stroke : 'transparent',
                    },
                  ]}
                >
                  <AppText variant="label" color={selected ? colors.onTeam : colors.teamText[s.position]}>
                    {sideLetter(s.position)}
                  </AppText>
                  <AppText
                    variant="bodyStrong"
                    color={selected ? colors.onTeam : colors.ink}
                    numberOfLines={1}
                    style={styles.sideName}
                  >
                    {s.displayName}
                  </AppText>
                  {selected ? <Feather name="check" size={18} color={colors.onTeam} /> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.amountRow} accessible accessibilityLiveRegion="polite">
            <AppText variant="overline" muted>
              Fichas
            </AppText>
            <AppText
              variant="amount"
              color={draft.digits ? (side ? colors.teamText[side.position] : colors.ink) : colors.inkMuted}
              testID="amount"
              maxFontSizeMultiplier={1.4}
            >
              {draft.digits || '0'}
            </AppText>
            {summary.breakdown ? (
              <AppText variant="caption" muted testID="breakdown">
                {summary.breakdown}
              </AppText>
            ) : null}
          </View>

          <View style={styles.chips}>
            {shortcuts.map((value) => (
              <Chip
                key={value}
                label={String(value)}
                onPress={() => dispatch({ type: 'shortcut', value })}
                accessibilityLabel={`Rellenar ${value}`}
                disabled={saving}
              />
            ))}
            {bonuses.map((b) => (
              <Chip
                key={b.code}
                label={`${b.label} +${b.value}`}
                selected={draft.bonusCodes.includes(b.code)}
                onPress={() => dispatch({ type: 'toggle_bonus', code: b.code })}
                disabled={saving}
              />
            ))}
          </View>

          <NumericKeypad
            disabled={saving}
            onDigit={(digit) => dispatch({ type: 'digit', digit })}
            onBackspace={() => dispatch({ type: 'backspace' })}
            onClear={() => dispatch({ type: 'clear' })}
          />

          {error ? <ErrorNote message={error} /> : null}

          <Button
            testID="confirm-entry"
            size="lg"
            tone={side ? 'team' : 'primary'}
            fill={side ? colors.team[side.position] : undefined}
            label={error && summary.valid ? `Reintentar: ${label}` : label}
            disabled={!summary.valid}
            loading={saving}
            onPress={() =>
              submit(
                {
                  kind: 'hand',
                  sideId: draft.sideId,
                  basePoints: summary.basePoints ?? 0,
                  bonusCodes: draft.bonusCodes,
                },
                commandId,
              )
            }
          />
          <Button
            label="Mano sin puntos"
            tone="ghost"
            onPress={() => {
              setError(null);
              setConfirmScoreless(true);
            }}
            disabled={saving}
            testID="scoreless"
          />
        </>
      )}
    </ScrollView>
  );
}

function ErrorNote({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.error, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Feather name="alert-triangle" size={18} color={colors.danger} />
      <AppText variant="caption" color={colors.danger} style={styles.errorText}>
        No se guardó. {message} Tu apunte sigue aquí.
      </AppText>
    </View>
  );
}

interface ChipProps {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function Chip({ label, onPress, selected, disabled, accessibilityLabel }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={selected === undefined ? 'button' : 'switch'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : pressed ? colors.keypadPressed : colors.surfaceAlt,
          borderColor: selected ? colors.primary : colors.hairline,
        },
      ]}
    >
      <AppText variant="bodyStrong" color={selected ? colors.onPrimary : colors.ink} tabular>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,12,16,0.55)', justifyContent: 'flex-end' },
  dismiss: { flex: 1, minHeight: 24 },
  sheet: {
    maxHeight: '94%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 2,
    borderBottomWidth: 0,
  },
  content: { padding: space.lg, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: {
    width: touch.min,
    height: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -space.sm,
  },
  sides: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sideChip: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: touch.min + 4,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  sideName: { flex: 1 },
  amountRow: { alignItems: 'center', paddingVertical: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  chip: {
    minHeight: touch.min,
    minWidth: 64,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreless: { gap: space.md },
  error: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  errorText: { flex: 1 },
});
