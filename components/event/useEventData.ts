import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useMyRoles } from '@/hooks/useMyRoles';
import { supabase } from '@/lib/supabase';

/** Everything the event screen's tabs read, loaded once so switching tabs is instant. */
export function useEventData(id: string) {
  const roles = useMyRoles(id);
  const event = useFocusQuery(() => supabase.from('events').select('*').eq('id', id));
  const categories = useFocusQuery(() => supabase.from('categories').select('*').eq('event_id', id).order('created_at'));
  const entries = useFocusQuery(() => supabase.from('club_entries').select('id, approval_status').eq('event_id', id));
  const athletes = useFocusQuery(() =>
    supabase.from('athletes').select('id, club_entries!inner(event_id, approval_status)').eq('club_entries.event_id', id).eq('club_entries.approval_status', 'approved'),
  );
  const registrations = useFocusQuery(() =>
    supabase
      .from('registrations')
      .select('id, category_id, athletes(full_name, weight, belt_rank, club_entries(club_name)), categories!inner(event_id)')
      .eq('categories.event_id', id),
  );
  const cover = useFocusQuery(() => supabase.from('event_covers').select('image').eq('event_id', id));
  const conflicts = useFocusQuery(() => supabase.from('scoring_conflicts').select('id').eq('event_id', id).is('resolved_at', null));

  const status = event.rows[0]?.status ?? '';
  return {
    ...roles,
    event: event.rows[0],
    reloadEvent: event.reload,
    categories: categories.rows,
    loadingCategories: categories.loading,
    categoriesError: categories.error,
    reloadCategories: categories.reload,
    registrations: registrations.rows,
    cover: cover.rows[0]?.image,
    unresolvedConflicts: conflicts.rows.length,
    counts: {
      categories: categories.rows.length,
      participants: athletes.rows.length,
      clubs: entries.rows.filter((entry) => entry.approval_status === 'approved').length,
      pending: entries.rows.filter((entry) => entry.approval_status === 'submitted').length,
    },
    live: ['registration_closed', 'in_progress'].includes(status),
  };
}

export type EventData = ReturnType<typeof useEventData> & { event: NonNullable<ReturnType<typeof useEventData>['event']> };
