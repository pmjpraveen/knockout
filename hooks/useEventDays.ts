import { useFocusQuery } from '@/hooks/useFocusQuery';
import { eventDays } from '@/lib/schedule';
import { supabase } from '@/lib/supabase';

/** The days the event runs on, earliest first; `others` adds days that categories are already on. */
export function useEventDays(eventId: string, others: (string | null)[] = []) {
  const { rows } = useFocusQuery(() => supabase.from('events').select('start_date, end_date').eq('id', eventId), [eventId]);
  return eventDays(rows[0]?.start_date ?? null, rows[0]?.end_date ?? null, others);
}
