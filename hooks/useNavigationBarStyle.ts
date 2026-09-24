import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

// Guards against devices that received this JS via an OTA update but are still running an older native binary
// built before expo-navigation-bar was linked — calling into the missing native module would otherwise throw.
const setStyle = (style: 'light' | 'dark') => {
  try {
    NavigationBar.setButtonStyleAsync(style)?.catch(() => {});
  } catch {
    // Native module not linked in this binary yet; nothing to do until the next native build.
  }
};

/**
 * Sets Android's edge-to-edge gesture bar icon color for as long as the screen is mounted, restoring the app's
 * light-theme default ('dark' icons) on unmount. No-op on iOS/web — the home indicator there is drawn and
 * contrasted by the OS itself, with no app-level styling.
 */
export function useNavigationBarStyle(style: 'light' | 'dark' = 'dark') {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    setStyle(style);
    return () => setStyle('dark');
  }, [style]);
}
