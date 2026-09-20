import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';

/** Whether the signed-in account may create events (organizer accounts only). */
export function useAccountType() {
  const userId = useSession()?.user.id;
  const { rows, loading } = useFocusQuery(
    () => supabase.from('profiles').select('account_type').eq('user_id', userId!),
    [userId],
    `profile:${userId}`,
    !!userId,
  );
  return { isOrganizerAccount: rows[0]?.account_type === 'organizer', loading };
}
