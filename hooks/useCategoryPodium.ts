import { useFocusQuery } from '@/hooks/useFocusQuery';
import { supabase } from '@/lib/supabase';

/** A category's 1st, 2nd and 3rd place (two athletes share 3rd when the bracket has bronze bouts). Empty until a place is decided. */
export function useCategoryPodium(categoryId: string) {
  const { rows } = useFocusQuery(() => supabase.rpc('category_podium', { p_category_id: categoryId }), [categoryId], `podium:${categoryId}`);
  return rows;
}
