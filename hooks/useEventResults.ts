import { useFocusQuery } from '@/hooks/useFocusQuery';
import type { Finisher } from '@/lib/medals';
import { supabase } from '@/lib/supabase';

export type CategoryResult = { categoryId: string; label: string; finishers: Finisher[] };

/** The event's finished categories in running order, each with its 1st, 2nd and 3rd place finishers. */
export function useEventResults(eventId: string) {
  return useFocusQuery<CategoryResult>(async () => {
    const { data: categories, error: failure } = await supabase.from('categories').select('id, label').eq('event_id', eventId).eq('status', 'completed').order('sequence', { nullsFirst: false }).order('created_at');
    if (failure) return { data: null, error: failure };
    const podiums = await Promise.all((categories ?? []).map((category) => supabase.rpc('category_podium', { p_category_id: category.id })));
    return {
      data: (categories ?? []).map((category, index) => ({
        categoryId: category.id,
        label: category.label,
        finishers: (podiums[index].data ?? []).map((row) => ({ place: row.place, athlete: row.athlete_name, club: row.club_name })),
      })),
      error: podiums.find((podium) => podium.error)?.error ?? null,
    };
  }, [eventId]);
}
