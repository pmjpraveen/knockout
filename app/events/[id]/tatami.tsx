import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SkeletonScreen } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { TatamiQueueCard } from '@/components/TatamiQueueCard';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useLiveReload } from '@/hooks/useLiveReload';
import { useMyRoles } from '@/hooks/useMyRoles';
import { useSubmit } from '@/hooks/useSubmit';
import { currentDay, matchLabel } from '@/lib/schedule';
import { formatDate } from '@/lib/events';
import { supabase } from '@/lib/supabase';

export default function TatamiQueue() {
  const { id, tatamiId, day: requestedDay } = useLocalSearchParams<{ id: string; tatamiId: string; day?: string }>();
  const router = useRouter();
  const { canOverride } = useMyRoles(id);
  const { run, busy, error } = useSubmit();
  const { rows: tatamis, reload: reloadTatami } = useFocusQuery(() => supabase.from('tatamis').select('*').eq('id', tatamiId));
  const { rows: schedule, reload: reloadSchedule } = useFocusQuery(() => supabase.rpc('event_schedule', { p_event_id: id }), [], `schedule:${id}`);
  useLiveReload(() => { reloadTatami(); reloadSchedule(); }, ['matches', 'tatamis']);

  const tatami = tatamis[0];
  const ofTatami = schedule.filter((row) => row.tatami_id === tatamiId);
  const day = requestedDay ?? currentDay([], ofTatami.map((row) => row.event_day));
  const queue = ofTatami.filter((row) => !day || row.event_day === day);

  const act = (action: () => PromiseLike<{ error: { message: string } | null }>) => run(async () => {
    const result = await action();
    await Promise.all([reloadTatami(), reloadSchedule()]);
    return result;
  });

  if (!tatami) return <SkeletonScreen />;

  return (
    <Screen>
      {error && <Text color="danger">{error}</Text>}
      {day && <Text color="slateGray">Queue for {formatDate(day)}</Text>}
      <TatamiQueueCard
        name={tatami.name}
        paused={tatami.status === 'paused'}
        items={queue.map((row) => ({
          key: row.match_id,
          a: row.athlete_a,
          b: row.athlete_b,
          time: row.estimated_call_time,
          category: row.category_label,
          detail: matchLabel(row.bracket_side, row.round),
          conflict: row.conflict,
          action: canOverride && (
            <>
              <Button title="Audit & override" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/match-audit', params: { id, matchId: row.match_id } })} />
              {row.match_status === 'scheduled' && row.athlete_a && row.athlete_b && (<>
              <Button title="Delay one place" variant="secondary" disabled={busy} onPress={() => act(() => supabase.rpc('move_in_queue', { p_match_id: row.match_id, p_direction: 1 }))} />
              <Button title="Move earlier" variant="secondary" disabled={busy || row.queue_position === 1} onPress={() => act(() => supabase.rpc('move_in_queue', { p_match_id: row.match_id, p_direction: -1 }))} />
              </>)}
            </>
          ),
        }))}
        footer={
          canOverride && (
            <Button
              title={tatami.status === 'paused' ? 'Resume tatami' : 'Pause tatami'}
              variant="warning"
              disabled={busy}
              onPress={() => act(() => supabase.from('tatamis').update({ status: tatami.status === 'paused' ? 'active' : 'paused' }).eq('id', tatami.id))}
            />
          )
        }
      />
    </Screen>
  );
}
