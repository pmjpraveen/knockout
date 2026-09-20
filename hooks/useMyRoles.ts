import { useSession } from '@/hooks/useSession';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { supabase } from '@/lib/supabase';

/** The signed-in user's memberships on one event (RLS lets every member read the roster). */
export function useMyRoles(eventId: string) {
  const userId = useSession()?.user.id;
  const { rows } = useFocusQuery(
    () => supabase.from('event_members').select('role, tatami_id, tatamis(name)').eq('event_id', eventId).eq('user_id', userId!),
    [userId],
    undefined,
    !!userId,
  );

  return {
    memberships: rows,
    isOrganizer: rows.some((m) => m.role === 'organizer'),
    canOverride: rows.some((m) => m.role !== 'scorekeeper'),
  };
}
