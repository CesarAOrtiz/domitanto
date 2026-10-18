import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { useSettings } from '../application/services';
import { MAX_POINTS } from '../domain';
import { AppText } from '../ui/components/AppText';
import { Field } from '../ui/components/Field';
import { IconButton } from '../ui/components/IconButton';
import { Screen } from '../ui/components/Screen';
import { Segmented } from '../ui/components/Segmented';
import { Surface } from '../ui/components/Surface';
import { useTheme } from '../ui/theme';
import { space, touch } from '../ui/tokens';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const [settings, update] = useSettings();
  const [shortcuts, setShortcuts] = useState(settings.shortcuts.map(String));
  const [error, setError] = useState<string | null>(null);

  const save = async (patch: Parameters<typeof update>[0]) => {
    try {
      await update(patch);
      setError(null);
    } catch {
      setError('No se pudo guardar el ajuste en este teléfono. Inténtalo de nuevo.');
    }
  };

  const saveShortcut = (index: number) => {
    const value = Number(shortcuts[index]);
    if (!Number.isInteger(value) || value < 1 || value > MAX_POINTS) {
      setShortcuts(settings.shortcuts.map(String));
      return;
    }
    const next = [...settings.shortcuts] as typeof settings.shortcuts;
    next[index] = value;
    void save({ shortcuts: next });
  };

  return (
    <Screen>
      <View style={styles.top}>
        <IconButton
          icon="chevron-left"
          label="Volver"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <AppText variant="title" accessibilityRole="header">
          Ajustes
        </AppText>
      </View>

      {error ? (
        <AppText color={colors.danger} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}

      <Section title="Apariencia">
        <Segmented
          label="Tema"
          value={settings.appearance}
          onChange={(appearance) => void save({ appearance })}
          options={[
            { value: 'system', label: 'Sistema' },
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Oscuro' },
          ]}
        />
        <AppText variant="caption" muted>
          El tamaño del texto sigue el ajuste de accesibilidad del teléfono.
        </AppText>
      </Section>

      <Section title="Atajos al anotar">
        <AppText variant="caption" muted>
          Rellenan la cantidad; nunca guardan solos.
        </AppText>
        <View style={styles.row}>
          {shortcuts.map((value, i) => (
            <Field
              key={i}
              containerStyle={styles.shortcut}
              label={`Atajo ${i + 1}`}
              keyboardType="number-pad"
              maxLength={4}
              value={value}
              onChangeText={(t) => setShortcuts(shortcuts.map((v, j) => (j === i ? t.replace(/\D/g, '') : v)))}
              onEndEditing={() => saveShortcut(i)}
            />
          ))}
        </View>
      </Section>

      <Section title="Durante la partida">
        <ToggleRow
          label="Vibración"
          hint="Al guardar una mano o si algo falla."
          value={settings.haptics}
          onChange={(haptics) => void save({ haptics })}
        />
        <ToggleRow
          label="Pantalla encendida en modo mesa"
          hint="Solo mientras el modo mesa está abierto."
          value={settings.tableKeepAwake}
          onChange={(tableKeepAwake) => void save({ tableKeepAwake })}
        />
      </Section>

      <Surface raised={false}>
        <AppText variant="bodyStrong">Tus datos</AppText>
        <AppText variant="caption" muted style={styles.gap}>
          Partidas e historial se guardan solo en este teléfono. No hay cuenta ni copia en la nube: si desinstalas la
          app o pierdes el teléfono, se pierden.
        </AppText>
      </Surface>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="overline" muted accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.toggle, { borderColor: colors.hairline, backgroundColor: colors.surface }]}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.team[0], false: colors.hairline }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shortcut: { minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  section: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch.min + 16,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: space.md,
  },
  gap: { marginTop: space.xs },
});
