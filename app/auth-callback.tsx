import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import NotFound from './+not-found';
import { supabase } from '@/lib/supabase';

/**
 * Google sign-in returns to karate-event-app://auth-callback?code=…. Android hands that link to the router as well
 * as to the in-app browser session, and either may be the one that survives, so the code is exchanged here too.
 * A code works once, so whichever runs second fails harmlessly: lib/oauth.ts checks for the session first.
 */
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  useEffect(() => {
    if (code) void supabase.auth.exchangeCodeForSession(code);
  }, [code]);
  return <NotFound />;
}
