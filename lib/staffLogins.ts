import { supabase, supabaseUrl } from '@/lib/supabase';

const endpoint = `${supabaseUrl}/functions/v1/create-staff-account`;

type NewLogin = { event_id: string; email: string; password: string; role: string; tatami_id?: string };

/** Asks the create-staff-account Edge Function (organizers only) for a tournament director or scorekeeper login. */
export async function createStaffLogin(login: NewLogin): Promise<{ error: { message: string } | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(login),
    });
    const payload = await response.json();
    return { error: response.ok ? null : { message: payload.error ?? 'Something went wrong. Please try again.' } };
  } catch {
    return { error: { message: 'Could not reach the server. Check your connection and try again.' } };
  }
}
