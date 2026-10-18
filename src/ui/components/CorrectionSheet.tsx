import Feather from '@expo/vector-icons/Feather';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  isDomainError,
  previewCommand,
  sideById,
  sideLetter,
  type CommandPreview,
  type EntryRevision,
  type EntryView,
  type GameCommand,
  type GameState,
  type Outcome,
} from '../../domain';
import { useTheme } from '../theme';
import { radius, space, touch } from '../tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { NumericKeypad } from './NumericKeypad';
import { Chip } from './ScoreEntrySheet';
import { Segmented } from './Segmented';

type Mode = 'edit' | 'side' | 'void';

/** Comando de corrección sin su commandId, que se asigna al confirmar. */
type CorrectionBody = GameCommand extends infer C ? (C extends unknown ? Omit<C, 'commandId'> : never) : never;

interface Props {
  view: EntryView | null;
  state: GameState;
  makeCommandId: () => string;
  /** Debe resolver solo tras el commit. Si lanza, se conserva la propuesta. */
  onSubmit: (command: GameCommand) => Promise<void>;
  onClose: () => void;
}

const REASONS: Record<EntryRevision['reason'], string> = {
  created: 'Anotada',
  edited: 'Cantidad corregida',
  reassigned: 'Equipo cambiado',
  voided: 'Anulada',
  undo: 'Deshecho',
};

function scoreline(state: GameState, outcome: Outcome): string {
  return [...state.sides]
    .sort((a, b) => a.position - b.position)
    .map((s) => outcome.totals[s.id] ?? 0)
    .join('–');
}

function describe(state: GameState, r: Pick<EntryRevision, 'sideId' | 'basePoints' | 'bonuses'>): string {
  const total = r.basePoints + r.bonuses.reduce((s, b) => s + b.value, 0);
  const side = sideById(state.sides, r.sideId);
  return side ? `+${total} a ${side.displayName}` : 'sin puntos';
}

/** Corrección de una mano con previsualización de sus consecuencias antes de guardar. */
export function CorrectionSheet(props: Props) {
  const { colors, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={props.view !== null}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={props.onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={props.onClose} accessibilityLabel="Cerrar sin corregir" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.stroke, paddingBottom: insets.bottom + space.lg },
          ]}
          accessibilityViewIsModal
        >
          {props.view ? <Body {...props} view={props.view} /> : null}
        </View>
      </View>
    </Modal>
  );
}

function Body({ view, state, makeCommandId, onSubmit, onClose }: Props & { view: EntryView }) {
  const { colors } = useTheme();
  const { entry, current } = view;
  const scoreless = entry.kind === 'scoreless_hand';
  const modes: { value: Mode; label: string }[] = [
    ...(!scoreless ? [{ value: 'edit' as const, label: 'Cantidad' }] : []),
    ...(!scoreless && state.sides.length > 1 ? [{ value: 'side' as const, label: 'Equipo' }] : []),
    { value: 'void', label: 'Anular' },
  ];
  const [mode, setModeRaw] = useState<Mode>(modes[0]!.value);
  const [digits, setDigitsRaw] = useState(String(current.basePoints));
  const [bonusCodes, setBonusCodesRaw] = useState(current.bonuses.map((b) => b.code));
  const [sideId, setSideIdRaw] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commandId = useRef<string | null>(null);

  // Cualquier cambio en la propuesta es una operación distinta: nuevo commandId.
  const changed =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      commandId.current = null;
      setError(null);
      set(v);
    };
  const setMode = changed(setModeRaw);
  const setDigits = changed(setDigitsRaw);
  const setBonusCodes = changed(setBonusCodesRaw);
  const setSideId = changed(setSideIdRaw);

  const command: CorrectionBody | null =
    mode === 'edit'
      ? digits === ''
        ? null
        : { type: 'edit_entry', entryId: entry.id, basePoints: Number(digits), bonusCodes }
      : mode === 'side'
        ? sideId
          ? { type: 'reassign_entry', entryId: entry.id, sideId }
          : null
        : { type: 'void_entry', entryId: entry.id };

  const { preview, problem } = ((): { preview: CommandPreview | null; problem: string | null } => {
    if (current.voided) return { preview: null, problem: null };
    if (!command)
      return { preview: null, problem: mode === 'side' ? 'Elige el equipo correcto' : 'Escribe los puntos' };
    try {
      const full = { ...command, commandId: 'vista-previa' } as GameCommand;
      return {
        preview: previewCommand(state, full, { now: state.startedAt, newId: () => 'vista-previa' }),
        problem: null,
      };
    } catch (e) {
      return { preview: null, problem: isDomainError(e) ? e.message : 'No se puede aplicar esta corrección.' };
    }
  })();

  const confirm = async () => {
    if (!command || !preview || saving) return;
    commandId.current ??= makeCommandId();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...command, commandId: commandId.current } as GameCommand);
      commandId.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const confirmLabel =
    mode === 'void' ? `Anular la mano ${entry.sequence}` : mode === 'side' ? 'Cambiar de equipo' : 'Guardar corrección';

  return (
    <ScrollView contentContainerStyle={styles.content} bounces={false} keyboardShouldPersistTaps="handled">
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <AppText variant="heading" accessibilityRole="header">
            Corregir mano {entry.sequence}
          </AppText>
          <AppText variant="caption" muted>
            Ahora: {current.voided ? 'anulada' : describe(state, current)}
          </AppText>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" style={styles.close}>
          <Feather name="x" size={24} color={colors.ink} />
        </Pressable>
      </View>

      {current.voided ? (
        <AppText muted>
          Esta mano está anulada y no cuenta. Si fue la última operación, puedes recuperarla con «Deshacer».
        </AppText>
      ) : (
        <>
          <Segmented label="Tipo de corrección" options={modes} value={mode} onChange={setMode} />

          {mode === 'edit' ? (
            <>
              <View style={styles.amount} accessible accessibilityLiveRegion="polite">
                <AppText variant="overline" muted>
                  Fichas
                </AppText>
                <AppText variant="amount" testID="correction-amount" maxFontSizeMultiplier={1.4}>
                  {digits || '0'}
                </AppText>
              </View>
              {state.rules.bonuses.length > 0 ? (
                <View style={styles.chips}>
                  {state.rules.bonuses.map((b) => (
                    <Chip
                      key={b.code}
                      label={`${b.label} +${b.value}`}
                      selected={bonusCodes.includes(b.code)}
                      onPress={() =>
                        setBonusCodes(
                          bonusCodes.includes(b.code)
                            ? bonusCodes.filter((c) => c !== b.code)
                            : [...bonusCodes, b.code],
                        )
                      }
                    />
                  ))}
                </View>
              ) : null}
              <NumericKeypad
                disabled={saving}
                onDigit={(d) => {
                  const next = digits === '0' ? d : digits + d;
                  if (next.length <= 4) setDigits(next);
                }}
                onBackspace={() => setDigits(digits.slice(0, -1))}
                onClear={() => setDigits('')}
              />
            </>
          ) : null}

          {mode === 'side' ? (
            <View style={styles.sides} accessibilityRole="radiogroup" accessibilityLabel="Equipo correcto">
              {state.sides
                .filter((s) => s.id !== current.sideId)
                .map((s) => {
                  const selected = s.id === sideId;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSideId(s.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      testID={`reassign-${sideLetter(s.position)}`}
                      style={[
                        styles.sideOption,
                        {
                          backgroundColor: selected ? colors.team[s.position] : colors.teamSoft[s.position],
                          borderColor: selected ? colors.stroke : 'transparent',
                        },
                      ]}
                    >
                      <AppText variant="bodyStrong" color={selected ? colors.onTeam : colors.ink}>
                        {sideLetter(s.position)} · {s.displayName}
                      </AppText>
                    </Pressable>
                  );
                })}
            </View>
          ) : null}

          {mode === 'void' ? (
            <AppText muted>
              La mano deja de contar, pero queda en el registro marcada como anulada. Puedes deshacerlo.
            </AppText>
          ) : null}

          <PreviewCard state={state} preview={preview} problem={problem} />

          {error ? (
            <View
              style={[styles.error, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
              accessibilityRole="alert"
            >
              <AppText variant="caption" color={colors.danger}>
                No se guardó. {error} Tu corrección sigue aquí.
              </AppText>
            </View>
          ) : null}

          <Button
            testID="confirm-correction"
            size="lg"
            tone={mode === 'void' ? 'danger' : 'primary'}
            label={error ? `Reintentar: ${confirmLabel}` : confirmLabel}
            disabled={!preview}
            loading={saving}
            onPress={confirm}
          />
        </>
      )}

      <History state={state} view={view} />
    </ScrollView>
  );
}

function PreviewCard({
  state,
  preview,
  problem,
}: {
  state: GameState;
  preview: CommandPreview | null;
  problem: string | null;
}) {
  const { colors } = useTheme();
  if (!preview) {
    return problem ? (
      <AppText variant="caption" muted accessibilityLiveRegion="polite">
        {problem}
      </AppText>
    ) : null;
  }
  const { before, after } = preview;
  const winner = sideById(state.sides, after.winnerSideId);
  const notes: { text: string; strong?: boolean }[] = [];
  if (preview.statusChanged && after.status === 'finished') {
    notes.push({ text: `La partida termina: gana ${winner?.displayName ?? ''}.`, strong: true });
  } else if (preview.statusChanged && after.status === 'active') {
    notes.push({ text: 'La partida se reabre y se puede seguir anotando.', strong: true });
  } else if (preview.winnerChanged && winner) {
    notes.push({ text: `Cambia el ganador: ahora gana ${winner.displayName}.`, strong: true });
  }
  if (preview.newlyExcluded.length > 0) {
    notes.push({
      text: `Quedan fuera de resultado: ${preview.newlyExcluded.map((n) => `mano ${n}`).join(', ')}. No se borran.`,
    });
  }
  if (preview.reactivated.length > 0) {
    notes.push({ text: `Vuelven a contar: ${preview.reactivated.map((n) => `mano ${n}`).join(', ')}.` });
  }

  return (
    <View
      style={[styles.preview, { borderColor: colors.stroke, backgroundColor: colors.surfaceAlt }]}
      accessible
      accessibilityLiveRegion="polite"
      testID="correction-preview"
    >
      <AppText variant="overline" muted>
        Vista previa
      </AppText>
      <View style={styles.previewRow}>
        <AppText variant="heading" tabular muted>
          {scoreline(state, before)}
        </AppText>
        <Feather name="arrow-right" size={20} color={colors.ink} />
        <AppText variant="heading" tabular testID="preview-after">
          {scoreline(state, after)}
        </AppText>
      </View>
      {notes.map((n) => (
        <AppText key={n.text} variant={n.strong ? 'bodyStrong' : 'caption'} color={n.strong ? colors.ink : undefined}>
          {n.text}
        </AppText>
      ))}
    </View>
  );
}

function History({ state, view }: { state: GameState; view: EntryView }) {
  const { colors } = useTheme();
  if (view.entry.revisions.length < 2) return null;
  return (
    <View style={styles.history}>
      <AppText variant="overline" muted accessibilityRole="header">
        Registro de cambios
      </AppText>
      {[...view.entry.revisions].reverse().map((r) => (
        <View key={r.id} style={[styles.historyRow, { borderColor: colors.hairline }]}>
          <AppText variant="caption" muted tabular style={styles.version}>
            v{r.revision}
          </AppText>
          <View style={styles.flex}>
            <AppText variant="label">{REASONS[r.reason]}</AppText>
            <AppText variant="caption" muted>
              {r.voided ? `Sin contar (${describe(state, r)})` : describe(state, r)} ·{' '}
              {new Date(r.createdAt).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  close: { width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' },
  amount: { alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  sides: { gap: space.sm },
  sideOption: {
    minHeight: touch.min + 4,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
  preview: { borderWidth: 2, borderRadius: radius.md, padding: space.md, gap: space.xs },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  error: { borderWidth: 1.5, borderRadius: radius.md, padding: space.md },
  history: { gap: space.xs, marginTop: space.sm },
  historyRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm, borderTopWidth: 1 },
  version: { width: 28 },
});
