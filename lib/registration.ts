import { webBaseUrl } from '@/lib/hosts';
import { supabaseUrl } from '@/lib/supabase';

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
