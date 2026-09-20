import { useFocusQuery } from '@/hooks/useFocusQuery';
import { standardBelts } from '@/lib/athlete';
import { supabase } from '@/lib/supabase';

/** The event's own belt list, lowest first. It is the standard ladder until the event has loaded. */
export function useEventBelts(eventId: string) {
  const { rows } = useFocusQuery(() => supabase.from('events').select('belts').eq('id', eventId), [eventId]);
  return rows[0]?.belts ?? standardBelts;
}
