import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';

import { winRate, type WinRecord } from '../../domain';
import { useTheme } from '../theme';
import { radius, space, touch } from '../tokens';
import { AppText } from './AppText';

interface Props {
  title: string;
  subtitle?: string | null;
  record?: WinRecord | null;
  onPress?: () => void;
  testID?: string;
}

/**
 * Fila con un nombre y su récord. El porcentaje siempre va con su denominador
 * («6 de 10»); sin partidas no se muestra porcentaje.
 */
export function RecordRow({ title, subtitle, record, onPress, testID }: Props) {
  const { colors } = useTheme();
  const rate = record ? winRate(record) : null;
  const content = (
    <>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {record && record.played > 0 ? (
        <View style={styles.record}>
          <AppText variant="heading" tabular>
            {rate} %
          </AppText>
          <AppText variant="caption" muted tabular>
            {record.won} de {record.played}
          </AppText>
        </View>
      ) : null}
      {onPress ? <Feather name="chevron-right" size={20} color={colors.inkMuted} /> : null}
    </>
  );
  const style = [styles.row, { backgroundColor: colors.surface, borderColor: colors.hairline }];
  const label = `${title}${subtitle ? `, ${subtitle}` : ''}${
    record && record.played > 0 ? `, ganó ${record.won} de ${record.played}, ${rate} por ciento` : ''
  }`;
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [...style, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={style} accessible accessibilityLabel={label} testID={testID}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: touch.min + 8,
  },
  record: { alignItems: 'flex-end' },
});
