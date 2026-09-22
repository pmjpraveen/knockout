import { GeistMono_500Medium, GeistMono_700Bold } from '@expo-google-fonts/geist-mono';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Splash } from '@/components/Splash';
import { useSession } from '@/hooks/useSession';
import { startSyncLoop } from '@/lib/offline';
import { stackScreenOptions } from '@/lib/navigation';
import { theme } from '@/theme/tokens';

// Keep the native launch screen up until the JS splash has drawn its first frame, so there is no white flash.
SplashScreen.preventAutoHideAsync();

// The launch animation is for the iOS and Android apps. Clubs and the public open these web links cold and
// should not wait on it.
const publicRoutes = ['/register', '/schedule', '/terms', '/privacy'];

const fonts = {
  [theme.fonts.sans.light]: require('@/assets/fonts/Switzer-Light.otf'),
  [theme.fonts.sans.regular]: require('@/assets/fonts/Switzer-Regular.otf'),
  [theme.fonts.sans.medium]: require('@/assets/fonts/Switzer-Medium.otf'),
  [theme.fonts.display]: require('@/assets/fonts/FacultyGlyphic-Regular.ttf'),
  [theme.fonts.mono]: GeistMono_700Bold,
  [theme.fonts.monoMedium]: GeistMono_500Medium,
};

export default function RootLayout() {
  const session = useSession();
  const [fontsLoaded, fontError] = useFonts(fonts);
  const pathname = usePathname();
  const [splashDone, setSplashDone] = useState(false);
  const showSplash = Platform.OS !== 'web' && !splashDone && !publicRoutes.some((route) => pathname.startsWith(route));
  const signedIn = !!session;
  useEffect(() => (signedIn ? startSyncLoop() : undefined), [signedIn]);
  const ready = session !== undefined && (fontsLoaded || fontError);
  useEffect(() => {
    if (ready && !showSplash) SplashScreen.hideAsync();
  }, [ready, showSplash]);
  if (!ready) return null;

  return (
    <>
      <StatusBar style={showSplash ? 'light' : 'dark'} />
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" options={{ title: 'Events' }} />
          <Stack.Screen name="events" options={{ headerShown: false }} />
          <Stack.Screen name="delete-account" options={{ title: 'Account deletion' }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ title: 'Terms and conditions' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy policy' }} />
        <Stack.Screen name="register/[token]" options={{ title: 'Register', headerBackVisible: false }} />
        <Stack.Screen name="schedule/[token]" options={{ title: 'Schedule', headerBackVisible: false }} />
      </Stack>
      {showSplash && <Splash onReady={() => SplashScreen.hideAsync()} onDone={() => setSplashDone(true)} />}
    </>
  );
}
