import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

/** Encabezado de pantalla secundaria: volver, título y acciones opcionales. */
export function Header({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <View style={styles.top}>
      <IconButton
        icon="arrow-left"
        label="Volver"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <AppText variant="title" accessibilityRole="header" numberOfLines={2} style={styles.flex}>
        {title}
      </AppText>
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
