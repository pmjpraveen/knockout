import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { loopback, withHost } from '@/lib/withHost';

/**
 * The machine this app is being served from: the page's host on web, the dev server's LAN address in
 * Expo Go. A phone can't reach "localhost", so loopback URLs from .env are pointed at this host.
 */
const servingHost = Platform.OS === 'web' ? globalThis.location?.hostname : Constants.expoConfig?.hostUri?.split(':')[0];

export const reachable = (url: string) => withHost(url, servingHost);

/** Where clubs and the public reach the web app: EXPO_PUBLIC_WEB_URL once deployed, else the dev server. */
export function webBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_WEB_URL;
  if (configured && !loopback.test(new URL(configured).hostname)) return configured;
  if (Platform.OS === 'web') return globalThis.location.origin;
  return `http://${Constants.expoConfig?.hostUri ?? 'localhost:8081'}`;
}
