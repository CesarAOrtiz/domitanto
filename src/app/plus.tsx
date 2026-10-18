import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAccess, useServices } from '../application/services';
import { AppText } from '../ui/components/AppText';
import { Button } from '../ui/components/Button';
import { IconButton } from '../ui/components/IconButton';
import { Screen } from '../ui/components/Screen';
import { Surface } from '../ui/components/Surface';
import { useTheme } from '../ui/theme';
import { space } from '../ui/tokens';

const BENEFITS = [
  { icon: 'slash', text: 'Sin publicidad en ninguna pantalla.' },
  { icon: 'droplet', text: 'Tres temas de color: Malecón, Cacao y Flamboyán.' },
  { icon: 'image', text: 'Dos plantillas extra para compartir resultados: Pizarra y Carnaval.' },
  { icon: 'bar-chart-2', text: 'Comparar a una persona o pareja entre dos meses, trimestres o años.' },
] as const;

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'message'; text: string; tone: 'ok' | 'info' | 'error' };

/**
 * Oferta de Plus: pago único, cerrable y sin urgencia. El éxito solo se muestra cuando
 * la tienda valida el derecho.
 */
export default function PlusScreen() {
  const { colors } = useTheme();
  const { access: store } = useServices();
  const { access, offer, storeUnavailable } = useAccess();
  const [offerState, setOfferState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    if (storeUnavailable) return;
    store.loadOffer().then(
      (o) => setOfferState(o ? 'ready' : 'missing'),
      () => setOfferState('missing'),
    );
  }, [store, storeUnavailable]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const buy = async () => {
    setStatus({ kind: 'busy' });
    try {
      const outcome = await store.purchase();
      const messages = {
        validated: { text: '¡Listo! Plus está activo en este teléfono.', tone: 'ok' },
        cancelled: { text: 'Compra cancelada. No se cobró nada.', tone: 'info' },
        pending: { text: 'La compra está pendiente. Plus se activará cuando la tienda la confirme.', tone: 'info' },
        not_granted: { text: 'La tienda no confirmó la compra. No se activó Plus.', tone: 'error' },
      } as const;
      setStatus({ kind: 'message', ...messages[outcome] });
    } catch {
      setStatus({
        kind: 'message',
        text: 'No se pudo completar la compra. Comprar necesita conexión a internet; puedes seguir jugando.',
        tone: 'error',
      });
    }
  };

  const restore = async () => {
    setStatus({ kind: 'busy' });
    try {
      const result = await store.restore();
      setStatus(
        result === 'restored'
          ? { kind: 'message', text: 'Compra restaurada. Plus está activo.', tone: 'ok' }
          : { kind: 'message', text: 'No encontramos una compra de Plus en esta cuenta de la tienda.', tone: 'info' },
      );
    } catch {
      setStatus({
        kind: 'message',
        text: 'No se pudo restaurar. Restaurar necesita conexión a internet.',
        tone: 'error',
      });
    }
  };

  const priceState = storeUnavailable ? 'missing' : offerState;
  const busy = status.kind === 'busy';
  const isPlus = access === 'plus';

  return (
    <Screen
      footer={
        isPlus ? (
          <Button size="lg" label="Volver" onPress={close} />
        ) : (
          <>
            <Button
              size="lg"
              testID="buy-plus"
              label="Comprar Plus"
              hint={priceState === 'ready' && offer ? `${offer.priceString} · pago único` : undefined}
              onPress={buy}
              loading={busy}
              disabled={priceState !== 'ready'}
            />
            <View style={styles.row}>
              <Button
                style={styles.flex}
                tone="secondary"
                label="Restaurar compras"
                onPress={restore}
                disabled={busy || !!storeUnavailable}
              />
              <Button style={styles.flex} tone="secondary" label="Seguir gratis" onPress={close} disabled={busy} />
            </View>
          </>
        )
      }
    >
      <View style={styles.top}>
        <AppText variant="title" accessibilityRole="header" style={styles.flex}>
          La Mesa Plus
        </AppText>
        <IconButton icon="x" label="Cerrar" onPress={close} />
      </View>

      {isPlus ? (
        <Surface fill={colors.teamSoft[2]} raised={false}>
          <AppText variant="bodyStrong">Plus está activo en este teléfono</AppText>
          <AppText variant="caption" muted>
            Gracias por apoyar La Mesa. Elige tu tema en Ajustes y tu plantilla al compartir.
          </AppText>
        </Surface>
      ) : (
        <AppText muted>Un solo pago, sin suscripción. Apuntar partidas sigue siendo gratis e ilimitado.</AppText>
      )}

      <View style={styles.list}>
        {BENEFITS.map((b) => (
          <View key={b.text} style={styles.benefit}>
            <View style={[styles.icon, { backgroundColor: colors.primary }]}>
              <Feather name={b.icon} size={16} color={colors.onPrimary} />
            </View>
            <AppText style={styles.flex}>{b.text}</AppText>
          </View>
        ))}
      </View>

      {!isPlus && priceState === 'loading' ? (
        <AppText variant="caption" muted>
          Consultando el precio en la tienda…
        </AppText>
      ) : null}
      {!isPlus && priceState === 'missing' ? (
        <AppText variant="caption" muted>
          {storeUnavailable ?? 'El producto no está disponible ahora. Revisa tu conexión e inténtalo más tarde.'}
        </AppText>
      ) : null}

      {status.kind === 'message' ? (
        <AppText
          accessibilityLiveRegion="polite"
          color={status.tone === 'error' ? colors.danger : status.tone === 'ok' ? colors.teamText[2] : colors.ink}
        >
          {status.text}
        </AppText>
      ) : null}

      <AppText variant="caption" muted>
        La compra queda en tu cuenta de la tienda (Google Play o App Store) y se restaura en esa misma cuenta. No pasa
        de Android a iPhone. Restaurar la compra no recupera partidas. Las estadísticas básicas siguen gratis.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  list: { gap: space.md },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
