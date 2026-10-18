import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ServicesProvider, useAccess, useBoot, useSettings } from '../application/services';
import { AppText } from '../ui/components/AppText';
import { Button } from '../ui/components/Button';
import { DominoMark } from '../ui/components/DominoMark';
import { ThemeProvider, useTheme } from '../ui/theme';
import { space } from '../ui/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

type Boot = ReturnType<typeof useBoot>[0];

/** Pantalla mientras carga o si la base no se pudo abrir. */
function BootScreen({ boot, retry }: { boot: Boot; retry: () => void }) {
  const { colors } = useTheme();
  if (boot.status !== 'error') return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <View style={[styles.fatal, { backgroundColor: colors.bg }]}>
      <DominoMark top={0} bottom={0} size={28} />
      <AppText variant="heading">No se pudo abrir el apunte</AppText>
      <AppText muted>
        La base de datos de este teléfono no se pudo preparar. No se borró nada: tus partidas siguen guardadas.
      </AppText>
      <AppText variant="caption" muted selectable>
        {boot.message}
      </AppText>
      <Button label="Reintentar" onPress={retry} />
    </View>
  );
}

function Navigator() {
  const { colors } = useTheme();
  return (
    <>
      <StatusBar style={colors.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="nueva" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ajustes" />
        <Stack.Screen name="partida/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="mesa/[id]" options={{ animation: 'fade' }} />
        <Stack.Screen name="resultado/[id]" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}

/** El tema depende del ajuste de apariencia guardado en el teléfono. */
function ThemedApp() {
  const [settings] = useSettings();
  const { access } = useAccess();
  return (
    <ThemeProvider appearance={settings.appearance} theme={access === 'plus' ? settings.theme : 'clasico'}>
      <Navigator />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [boot, retry] = useBoot();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsReady && boot.status !== 'loading') SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsReady, boot.status]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {fontsReady && boot.status === 'ready' ? (
          <ServicesProvider services={boot.services}>
            <ThemedApp />
          </ServicesProvider>
        ) : (
          <ThemeProvider>
            <BootScreen boot={fontsReady ? boot : { status: 'loading' }} retry={retry} />
          </ThemeProvider>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fatal: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.md },
});
