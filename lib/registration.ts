import { webBaseUrl } from '@/lib/hosts';
import { supabase, supabaseUrl } from '@/lib/supabase';

const endpoint = `${supabaseUrl}/functions/v1/submit-registration`;

/** Calls the public submit-registration Edge Function; the link token is the only credential. */
export async function callRegistration<T>(body: object): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY! },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? 'Something went wrong. Please try again.');
  return payload;
}

export const registrationUrl = (token: string, reference?: string) =>
  `${webBaseUrl()}/register/${token}${reference ? `?ref=${reference}` : ''}`;

export const scheduleUrl = (token: string) => `${webBaseUrl()}/schedule/${token}`;

/** Creates the event's registration link if it has none. A link that exists is left alone: regenerating would replace its token and break links already shared. */
export async function ensureRegistrationLink(eventId: string) {
  const { data, error } = await supabase.from('registration_links').select('id').eq('event_id', eventId);
  if (error || data.length) return { error };
  return supabase.rpc('regenerate_registration_link', { p_event_id: eventId });
}
