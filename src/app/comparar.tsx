import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAccess, useServices } from '../application/services';
import {
  comparePeriods,
  pairRecords,
  periodProblem,
  playerRecords,
  winRate,
  type GameResult,
  type Subject,
  type WinRecord,
} from '../domain';
import { storageMessage } from '../features/game/format';
import { pairLabel, plural } from '../features/people/format';
import { calendarPeriod, localTimeZone, type PeriodUnit } from '../features/stats/periods';
import { AppText } from '../ui/components/AppText';
import { Button } from '../ui/components/Button';
import { Chip } from '../ui/components/Chip';
import { Header } from '../ui/components/Header';
import { IconButton } from '../ui/components/IconButton';
import { Screen } from '../ui/components/Screen';
import { Segmented } from '../ui/components/Segmented';
import { Surface } from '../ui/components/Surface';
import { useTheme } from '../ui/theme';
import { radius, space, touch } from '../ui/tokens';

function subjectKey(subject: Subject): string {
  return subject.kind === 'player' ? `p:${subject.playerId}` : `c:${subject.compositionKey}`;
}

export default function CompareScreen() {
  const { jugador } = useLocalSearchParams<{ jugador?: string }>();
  const { colors } = useTheme();
  const { people } = useServices();
  const { access } = useAccess();
  const [results, setResults] = useState<GameResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Subject | null>(jugador ? { kind: 'player', playerId: jugador } : null);
  const [unit, setUnit] = useState<PeriodUnit>('month');
  const [offsets, setOffsets] = useState<[number, number]>([-1, 0]);

  const isPlus = access === 'plus';

  useFocusEffect(
    useCallback(() => {
      if (!isPlus) return;
      people.allResults().then(
        (r) => {
          setResults(r);
          setError(null);
        },
        (e: unknown) => setError(storageMessage(e)),
      );
    }, [people, isPlus]),
  );

  const players = useMemo(() => playerRecords(results), [results]);
  const pairs = useMemo(() => pairRecords(results), [results]);
  const fallback: Subject | null = players[0] ? { kind: 'player', playerId: players[0].playerId } : null;
  const subject = picked ?? fallback;

  if (!isPlus) {
    return (
      <Screen>
        <Header title="Comparar periodos" />
        <Surface raised={false}>
          <AppText variant="bodyStrong">Incluido en Plus</AppText>
          <AppText muted style={styles.gap}>
            Compara a una persona o a una pareja entre dos meses, trimestres o años: partidas terminadas, victorias y
            porcentaje, con sus cifras a la vista.
          </AppText>
          <Button style={styles.gapTop} label="Ver Plus" onPress={() => router.push('/plus')} testID="compare-plus" />
        </Surface>
        <AppText variant="caption" muted>
          Las estadísticas de cada jugador, pareja y grupo siguen gratis en Jugadores y Grupos.
        </AppText>
      </Screen>
    );
  }

  const a = calendarPeriod(unit, offsets[0]);
  const b = calendarPeriod(unit, offsets[1]);
  const problem = periodProblem(a, b);
  const comparison = subject && !problem ? comparePeriods(results, subject, a, b) : null;

  const shift = (which: 0 | 1, delta: number) => {
    const next: [number, number] = [...offsets];
    next[which] = Math.min(0, next[which] + delta);
    setOffsets(next);
  };

  return (
    <Screen>
      <Header title="Comparar periodos" />

      {error ? (
        <AppText color={colors.danger} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}

      {players.length === 0 ? (
        <AppText muted>
          Para comparar hace falta al menos una partida terminada con jugadores guardados. Los invitados sin perfil no
          tienen cifras propias.
        </AppText>
      ) : (
        <>
          <View style={styles.block}>
            <AppText variant="overline" muted accessibilityRole="header">
              Quién
            </AppText>
            <View style={styles.chips}>
              {players.map((p) => {
                const s: Subject = { kind: 'player', playerId: p.playerId };
                return (
                  <Chip
                    key={subjectKey(s)}
                    label={p.displayName}
                    selected={!!subject && subjectKey(subject) === subjectKey(s)}
                    onPress={() => setPicked(s)}
                  />
                );
              })}
              {pairs.map((p) => {
                const s: Subject = { kind: 'pair', compositionKey: p.compositionKey };
                return (
                  <Chip
                    key={subjectKey(s)}
                    icon="users"
                    label={pairLabel(p)}
                    selected={!!subject && subjectKey(subject) === subjectKey(s)}
                    onPress={() => setPicked(s)}
                    accessibilityHint="Pareja exacta: solo las partidas que jugaron juntos"
                  />
                );
              })}
            </View>
          </View>

          <Segmented
            label="Periodo"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'month', label: 'Mes' },
              { value: 'quarter', label: 'Trimestre' },
              { value: 'year', label: 'Año' },
            ]}
          />

          <View style={styles.block}>
            <Stepper
              title="Periodo 1"
              label={a.label}
              canForward={offsets[0] < 0}
              onBack={() => shift(0, -1)}
              onForward={() => shift(0, 1)}
            />
            <Stepper
              title="Periodo 2"
              label={b.label}
              canForward={offsets[1] < 0}
              onBack={() => shift(1, -1)}
              onForward={() => shift(1, 1)}
            />
          </View>

          {problem ? (
            <AppText color={colors.danger} accessibilityRole="alert">
              {problem}
            </AppText>
          ) : null}

          {comparison ? (
            <>
              <View style={styles.columns}>
                <PeriodCard label={a.label} record={comparison.a} />
                <PeriodCard label={b.label} record={comparison.b} />
              </View>
              <AppText muted testID="compare-summary">
                {differenceLine(comparison.a, comparison.b, a.label, b.label)}
              </AppText>
            </>
          ) : null}

          <AppText variant="caption" muted>
            Cuentan las partidas terminadas con ganador, según el día en que terminaron (zona horaria: {localTimeZone()}
            ). Ganar es estar en el lado ganador. La comparación muestra cifras, no explica por qué cambiaron.
          </AppText>
        </>
      )}
    </Screen>
  );
}

function differenceLine(a: WinRecord, b: WinRecord, aLabel: string, bLabel: string): string {
  const rateA = winRate(a);
  const rateB = winRate(b);
  if (rateA === null && rateB === null) return 'Sin partidas en ninguno de los dos periodos.';
  if (rateA === null) return `Sin partidas en ${aLabel}; no hay con qué comparar.`;
  if (rateB === null) return `Sin partidas en ${bLabel}; no hay con qué comparar.`;
  const diff = rateB - rateA;
  if (diff === 0)
    return `Mismo porcentaje en los dos periodos (${plural(a.played, 'partida', 'partidas')} y ${b.played}).`;
  const points = plural(Math.abs(diff), 'punto', 'puntos');
  return `En ${bLabel}, ${points} ${diff > 0 ? 'más' : 'menos'} que en ${aLabel} (muestras de ${a.played} y ${b.played}).`;
}

function Stepper({
  title,
  label,
  canForward,
  onBack,
  onForward,
}: {
  title: string;
  label: string;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stepper, { borderColor: colors.hairline, backgroundColor: colors.surface }]}>
      <IconButton icon="chevron-left" label={`${title}: anterior`} onPress={onBack} />
      <View style={styles.stepperText}>
        <AppText variant="caption" muted>
          {title}
        </AppText>
        <AppText variant="bodyStrong" accessibilityLiveRegion="polite">
          {label}
        </AppText>
      </View>
      {canForward ? (
        <IconButton icon="chevron-right" label={`${title}: siguiente`} onPress={onForward} />
      ) : (
        <View style={styles.stepperSpacer} />
      )}
    </View>
  );
}

function PeriodCard({ label, record }: { label: string; record: WinRecord }) {
  const rate = winRate(record);
  return (
    <Surface raised={false} style={styles.flex}>
      <AppText variant="overline" muted numberOfLines={2}>
        {label}
      </AppText>
      <AppText variant="title" tabular style={styles.gap}>
        {rate === null ? '—' : `${rate} %`}
      </AppText>
      <AppText variant="caption" muted>
        {record.played === 0 ? 'Sin partidas' : `Ganó ${record.won} de ${record.played}`}
      </AppText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  columns: { flexDirection: 'row', gap: space.sm },
  gap: { marginTop: space.xs },
  gapTop: { marginTop: space.md },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.xs,
  },
  stepperText: { flex: 1, alignItems: 'center' },
  stepperSpacer: { width: touch.min },
});
