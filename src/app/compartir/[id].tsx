import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, View, type LayoutChangeEvent } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { GameSnapshot } from '../../application/gameService';
import type { SessionOverview } from '../../application/peopleService';
import { useAccess, useServices } from '../../application/services';
import { storageMessage } from '../../features/game/format';
import {
  buildCardModel,
  CARD_SIZES,
  logicalSize,
  type CardFormat,
  type CardTemplate,
} from '../../features/share/cardModel';
import { ResultCard } from '../../features/share/ResultCard';
import { AppText } from '../../ui/components/AppText';
import { Button } from '../../ui/components/Button';
import { Chip } from '../../ui/components/Chip';
import { Header } from '../../ui/components/Header';
import { Screen } from '../../ui/components/Screen';
import { Segmented } from '../../ui/components/Segmented';
import { useTheme } from '../../ui/theme';
import { radius, space } from '../../ui/tokens';

const FRAME = 2;

const TEMPLATES: { id: CardTemplate; label: string; plus: boolean }[] = [
  { id: 'clasica', label: 'Clásica', plus: false },
  { id: 'pizarra', label: 'Pizarra', plus: true },
  { id: 'carnaval', label: 'Carnaval', plus: true },
];

/** Vista previa y envío de la tarjeta de resultado por el menú del teléfono. */
export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { games, people } = useServices();
  const { access } = useAccess();
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [session, setSession] = useState<SessionOverview | null>(null);
  const [format, setFormat] = useState<CardFormat>('post');
  const [template, setTemplate] = useState<CardTemplate>('clasica');
  const [hideNames, setHideNames] = useState(false);
  const [width, setWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const card = useRef<View>(null);

  useEffect(() => {
    games.getGame(id).then(
      (s) => {
        setSnapshot(s);
        if (s.state.sessionId) people.sessionOverview(s.state.sessionId).then(setSession, () => undefined);
      },
      (e: unknown) => setMessage(storageMessage(e)),
    );
  }, [games, people, id]);

  // Si Plus deja de estar activo, se vuelve a la plantilla gratuita.
  const activeTemplate = access === 'plus' ? template : 'clasica';

  if (!snapshot) {
    return (
      <Screen>
        <Header title="Compartir" />
        {message ? <AppText color={colors.danger}>{message}</AppText> : null}
      </Screen>
    );
  }

  const { state, outcome } = snapshot;
  const winnerSide = state.sides.find((s) => s.id === outcome.winnerSideId);
  const sessionGame = session?.summary.games.find((g) => g.result.gameId === state.id);
  const model = buildCardModel(state, outcome, {
    hideNames,
    session: session
      ? {
          number: sessionGame?.number ?? 1,
          games: session.summary.games.length,
          winnerPair: winnerSide?.compositionKey
            ? session.summary.pairs.find((p) => p.compositionKey === winnerSide.compositionKey)
            : null,
        }
      : null,
  });

  const size = logicalSize(format);
  const maxHeight = format === 'story' ? 520 : 9999;
  const scale = width ? Math.min(1, (width - FRAME * 2) / size.width, maxHeight / size.height) : 0;

  const share = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setMessage('Este dispositivo no permite compartir archivos desde la app.');
        return;
      }
      const { width: w, height: h } = CARD_SIZES[format];
      const uri = await captureRef(card, { format: 'png', width: w, height: h, result: 'tmpfile' });
      // Si la persona cierra el menú sin enviar, no se cuenta como enviado: no guardamos nada.
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Compartir resultado' });
    } catch {
      setMessage('No se pudo preparar la imagen. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const pickTemplate = (t: (typeof TEMPLATES)[number]) => {
    if (t.plus && access !== 'plus') return router.push('/plus');
    setTemplate(t.id);
  };

  return (
    <Screen
      footer={
        <Button
          size="lg"
          testID="share-image"
          label="Compartir imagen"
          hint={`${CARD_SIZES[format].label} · ${CARD_SIZES[format].width}×${CARD_SIZES[format].height}`}
          onPress={share}
          loading={busy}
        />
      }
    >
      <Header title="Compartir resultado" />

      <View style={styles.preview} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {scale > 0 ? (
          <View
            style={[
              styles.frame,
              {
                width: size.width * scale + FRAME * 2,
                height: size.height * scale + FRAME * 2,
                borderColor: colors.stroke,
              },
            ]}
          >
            <View
              style={{
                width: size.width,
                height: size.height,
                transform: [
                  { translateX: (size.width * (scale - 1)) / 2 },
                  { translateY: (size.height * (scale - 1)) / 2 },
                  { scale },
                ],
              }}
            >
              <View ref={card} collapsable={false} accessible accessibilityLabel="Vista previa de la tarjeta">
                <ResultCard model={model} format={format} template={activeTemplate} />
              </View>
            </View>
          </View>
        ) : null}
      </View>

      <Segmented
        label="Formato"
        value={format}
        onChange={setFormat}
        options={[
          { value: 'post', label: 'Publicación', hint: '4:5' },
          { value: 'story', label: 'Historia', hint: '9:16' },
        ]}
      />

      <View style={styles.section}>
        <AppText variant="overline" muted accessibilityRole="header">
          Plantilla
        </AppText>
        <View style={styles.chips}>
          {TEMPLATES.map((t) => (
            <Chip
              key={t.id}
              label={t.plus && access !== 'plus' ? `${t.label} · Plus` : t.label}
              icon={t.plus && access !== 'plus' ? 'lock' : activeTemplate === t.id ? 'check' : undefined}
              selected={activeTemplate === t.id}
              onPress={() => pickTemplate(t)}
            />
          ))}
        </View>
      </View>

      <View style={[styles.toggle, { borderColor: colors.hairline, backgroundColor: colors.surface }]}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Ocultar nombres</AppText>
          <AppText variant="caption" muted>
            Solo se ven las letras de cada equipo.
          </AppText>
        </View>
        <Switch
          value={hideNames}
          onValueChange={setHideNames}
          accessibilityLabel="Ocultar nombres"
          trackColor={{ true: colors.team[0], false: colors.hairline }}
        />
      </View>

      <AppText variant="caption" muted>
        Se abre el menú de compartir del teléfono. Tú eliges a quién mandarla; la app no envía nada sola.
      </AppText>
      {message ? <AppText color={colors.danger}>{message}</AppText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  preview: { alignItems: 'center' },
  frame: { borderWidth: FRAME, borderRadius: radius.md, overflow: 'hidden' },
  section: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: space.md,
  },
});
