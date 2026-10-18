import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { EntryView, Outcome, Side } from '../../domain';
import { sideLetter } from '../../domain';
import { useTheme } from '../theme';
import { radius, space, touch } from '../tokens';
import { AppText } from './AppText';

interface Props {
  sides: Side[];
  outcome: Outcome;
}

function stateLabel(view: EntryView): string | null {
  if (view.state === 'voided') return 'Anulada';
  if (view.state === 'out_of_result') return 'Fuera de resultado';
  if (view.corrected) return 'Corregida';
  return null;
}

/**
 * Tabla compacta de manos con una columna por equipo, como el apunte en papel.
 * Alterna entre puntos de cada mano y acumulado.
 */
export function HandTable({ sides, outcome }: Props) {
  const { colors } = useTheme();
  const [cumulative, setCumulative] = useState(false);
  const ordered = [...sides].sort((a, b) => a.position - b.position);

  if (outcome.entries.length === 0) {
    return (
      <View style={[styles.empty, { borderColor: colors.hairline }]}>
        <AppText variant="bodyStrong" align="center">
          La mesa está lista
        </AppText>
        <AppText variant="caption" muted align="center">
          Toca «Anotar» en el equipo que ganó la mano.
        </AppText>
      </View>
    );
  }

  const rows = [...outcome.entries].reverse();

  return (
    <View style={[styles.table, { borderColor: colors.stroke, backgroundColor: colors.surface }]}>
      <View style={[styles.row, styles.head, { borderColor: colors.hairline }]}>
        <AppText variant="overline" muted style={styles.indexCol}>
          Mano
        </AppText>
        {ordered.map((s) => (
          <AppText
            key={s.id}
            variant="overline"
            color={colors.teamText[s.position]}
            style={styles.cell}
            align="right"
            numberOfLines={1}
          >
            {sideLetter(s.position)}
          </AppText>
        ))}
      </View>

      {rows.map((view) => {
        const inactive = view.state !== 'counted';
        const note = stateLabel(view);
        const handLabel = `#${view.entry.sequence}${view.entry.kind === 'scoreless_hand' ? ' sin puntos' : ''}`;
        const side = ordered.find((s) => s.id === view.current.sideId);
        const a11y =
          view.entry.kind === 'scoreless_hand'
            ? `Mano ${view.entry.sequence}: sin puntos`
            : `Mano ${view.entry.sequence}: ${view.total} a ${side?.displayName ?? ''}`;
        return (
          <View
            key={view.entry.id}
            style={[styles.row, { borderColor: colors.hairline }]}
            accessible
            accessibilityLabel={note ? `${a11y}. ${note}` : a11y}
          >
            <View style={styles.indexCol}>
              <AppText variant="caption" muted tabular>
                {handLabel}
              </AppText>
              {note ? (
                <AppText variant="caption" color={view.state === 'counted' ? colors.inkMuted : colors.danger}>
                  {note}
                </AppText>
              ) : null}
            </View>
            {ordered.map((s) => {
              const mine = view.current.sideId === s.id;
              const value = cumulative ? view.runningTotals?.[s.id] : mine ? view.total : undefined;
              return (
                <AppText
                  key={s.id}
                  variant="bodyStrong"
                  tabular
                  align="right"
                  style={[styles.cell, inactive && styles.struck]}
                  color={mine ? colors.teamText[s.position] : colors.inkMuted}
                >
                  {value === undefined ? '·' : cumulative ? String(value) : `+${value}`}
                </AppText>
              );
            })}
          </View>
        );
      })}

      <Pressable
        onPress={() => setCumulative((v) => !v)}
        accessibilityRole="switch"
        accessibilityState={{ checked: cumulative }}
        accessibilityLabel="Ver acumulado"
        style={({ pressed }) => [styles.toggle, { backgroundColor: pressed ? colors.surfaceAlt : colors.surface }]}
      >
        <AppText variant="label" color={colors.ink}>
          {cumulative ? 'Ver puntos por mano' : 'Ver acumulado'}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  table: { borderWidth: 2, borderRadius: radius.lg, overflow: 'hidden' },
  head: { paddingVertical: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderBottomWidth: 1,
    gap: space.md,
  },
  indexCol: { flex: 1.2 },
  cell: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
  toggle: { minHeight: touch.min, alignItems: 'center', justifyContent: 'center' },
  empty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.xs,
  },
});
