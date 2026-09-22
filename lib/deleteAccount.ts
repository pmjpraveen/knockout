import { supabase, supabaseUrl } from '@/lib/supabase';

const endpoint = `${supabaseUrl}/functions/v1/delete-account`;

/** Asks the delete-account Edge Function to delete the signed-in user's own account, then clears the session on this device. */
export async function deleteAccount(): Promise<{ error: { message: string } | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    const payload = await response.json();
    if (!response.ok) return { error: { message: payload.error ?? 'Something went wrong. Please try again.' } };
    await supabase.auth.signOut({ scope: 'local' });
    return { error: null };
  } catch {
    return { error: { message: 'Could not reach the server. Check your connection and try again.' } };
  }
}
