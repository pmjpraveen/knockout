import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in through Supabase. On web the page redirects to Google and comes back signed in. On iOS and
 * Android an in-app browser handles the round trip and the returned code is exchanged for a session.
 */
export async function signInWithGoogle(): Promise<{ error: { message: string } | null }> {
  const web = Platform.OS === 'web';
  const redirectTo = web ? globalThis.location.origin : Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: !web } });
  if (error || web) return { error };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { error: null }; // the person closed the browser
  const code = new URL(result.url).searchParams.get('code');
  if (!code) return { error: { message: 'Google did not complete the sign-in. Please try again.' } };
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (!exchanged.error) return { error: null };
  const { data: current } = await supabase.auth.getSession();
  return { error: current.session ? null : exchanged.error }; // app/auth-callback.tsx may have used the code first
}
