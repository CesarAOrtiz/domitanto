import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { adsAllowed } from '../../application/access';
import { useAccess } from '../../application/services';
import { adsStore, bannerParts } from '../../platform/ads';
import { useTheme } from '../theme';
import { space } from '../tokens';
import { AppText } from './AppText';

/**
 * Banner al final de Inicio. Solo con acceso gratuito confirmado, consentimiento
 * resuelto y un bloque configurado. Nunca va sobre el marcador, el teclado ni el modo
 * mesa. Si no carga, desaparece sin dejar hueco; no se reintenta para sumar impresiones.
 */
export function AdSlot() {
  const { colors } = useTheme();
  const { access } = useAccess();
  const ads = useSyncExternalStore(adsStore.subscribe, adsStore.get);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!adsAllowed(access) || !ads.ready || !ads.canRequestAds || failed) return null;
  const parts = bannerParts();
  if (!parts) return null;
  const { Banner, unitId, size } = parts;
  return (
    <View style={[styles.wrap, { borderColor: colors.hairline }]} accessibilityLabel="Publicidad">
      {loaded ? (
        <AppText variant="caption" muted>
          Publicidad
        </AppText>
      ) : null}
      <Banner unitId={unitId} size={size} onAdLoaded={() => setLoaded(true)} onAdFailedToLoad={() => setFailed(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs, borderTopWidth: 1, paddingTop: space.md, marginTop: space.lg },
});
