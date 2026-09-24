import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionRow } from '@/components/ActionRow';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { CardGrid } from '@/components/CardGrid';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { TatamiQueueCard } from '@/components/TatamiQueueCard';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useLiveReload } from '@/hooks/useLiveReload';
import { useEventDays } from '@/hooks/useEventDays';
import { useMyRoles } from '@/hooks/useMyRoles';
import { useSubmit } from '@/hooks/useSubmit';
import { useState } from 'react';
import { currentDay, dayLabels, matchLabel } from '@/lib/schedule';
import { supabase } from '@/lib/supabase';

const drawn = ['bracket_generated', 'in_progress'];

export default function Schedule() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { canOverride } = useMyRoles(id);
  const { run, busy, error } = useSubmit();

  const { rows: tatamis, loading: loadingTatamis, reload: reloadTatamis } = useFocusQuery(() => supabase.from('tatamis').select('*').eq('event_id', id).order('name'), [], `tatamis:${id}`);
  const { rows: schedule, stale, reload: reloadSchedule } = useFocusQuery(() => supabase.rpc('event_schedule', { p_event_id: id }), [], `schedule:${id}`);
  const { rows: categories, reload: reloadCategories } = useFocusQuery(() =>
    supabase.from('categories').select('*').eq('event_id', id).in('status', drawn).order('sequence', { nullsFirst: false }).order('created_at'),
  );
  const reload = () => Promise.all([reloadTatamis(), reloadSchedule(), reloadCategories()]);
  useLiveReload(() => { reload(); }, ['matches', 'tatamis']);

  const act = (action: () => PromiseLike<{ error: { message: string } | null }>) => run(async () => {
    const result = await action();
    await reload();
    return result;
  });

  const days = useEventDays(id, categories.map((category) => category.event_day));
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked ?? currentDay(days, schedule.map((row) => row.event_day));
  const daySchedule = schedule.filter((row) => !day || row.event_day === day);
  const dayCategories = categories.filter((category) => !day || category.event_day === day);
  const running = !daySchedule.some((row) => row.estimated_call_time === null);

  const tatamiLabels = { none: 'Unassigned', ...Object.fromEntries(tatamis.map((t) => [t.id, t.name])) };
  const clashes = daySchedule.filter((row) => row.conflict);

  return (
    <Screen wide>
      {canOverride && (
        <Button title="Tatamis, timing & public link" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/tatamis', params: { id } })} />
      )}
      {days.length > 1 && day && <ChoiceChips label="Day" options={days} value={day} labels={dayLabels(days)} onChange={setPicked} />}
      {!running && <Text color="slateGray">This day has not started. Its queues show the running order; call times appear once it does.</Text>}
      {stale && <Text color="warning">Offline: showing the schedule as last synced. Times are estimates from that moment.</Text>}
      {loadingTatamis && <SkeletonList count={2} />}
      {!loadingTatamis && tatamis.length === 0 && <Text color="slateGray">No tatamis yet. Add the rings first.</Text>}
      {error && <Text color="danger">{error}</Text>}

      {clashes.length > 0 && (
        <Card>
          <Text color="warning">Double-booked athletes</Text>
          <Text variant="body" color="slateGray">
            These matches would call an athlete to two rings at once. Delay one of them.
          </Text>
          {clashes.map((row) => (
            <Card key={row.match_id}>
              <Text>{row.athlete_a ?? 'TBD'} vs {row.athlete_b ?? 'TBD'}</Text>
              <Text variant="body" color="slateGray">{row.tatami_name} · #{row.queue_position} · {row.category_label}</Text>
              {canOverride && <Button title="Delay one place" variant="warning" disabled={busy} onPress={() => act(() => supabase.rpc('move_in_queue', { p_match_id: row.match_id, p_direction: 1 }))} />}
            </Card>
          ))}
        </Card>
      )}

      <CardGrid>
      {tatamis.map((tatami) => {
        const queue = daySchedule.filter((row) => row.tatami_id === tatami.id);
        return (
          <TatamiQueueCard
            key={tatami.id}
            name={tatami.name}
            paused={tatami.status === 'paused'}
            items={queue.slice(0, 3).map((row) => ({
              key: row.match_id,
              a: row.athlete_a,
              b: row.athlete_b,
              time: row.estimated_call_time,
              category: row.category_label,
              detail: matchLabel(row.bracket_side, row.round),
              conflict: row.conflict,
            }))}
            footer={
              <>
                {queue.length > 3 && <Text variant="body" color="slateGray">{queue.length - 3} more in the queue</Text>}
                <Button title="Full queue" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/tatami', params: { id, tatamiId: tatami.id, ...(day && { day }) } })} />
                {canOverride && (
                  <Button
                    title={tatami.status === 'paused' ? 'Resume tatami' : 'Pause tatami'}
                    variant="warning"
                    disabled={busy}
                    onPress={() => act(() => supabase.from('tatamis').update({ status: tatami.status === 'paused' ? 'active' : 'paused' }).eq('id', tatami.id))}
                  />
                )}
              </>
            }
          />
        );
      })}
      </CardGrid>

      {canOverride && dayCategories.length > 0 && (
        <>
          <Text variant="subheading">Categories and running order</Text>
          {dayCategories.map((category, index) => (
            <Card key={category.id}>
              <Text variant="bodyLg">{index + 1}. {category.label}</Text>
              {days.length > 1 && (
                <ChoiceChips label="Day" options={days} value={category.event_day ?? days[0]} labels={dayLabels(days)} onChange={(next) => act(() => supabase.rpc('set_category_day', { p_category_id: category.id, p_day: next }))} />
              )}
              <ChoiceChips
                label="Runs on"
                options={['none', ...tatamis.map((t) => t.id)]}
                value={category.tatami_id ?? 'none'}
                labels={tatamiLabels}
                onChange={(tatamiId) =>
                  act(() => supabase.rpc('assign_category_to_tatami', { p_category_id: category.id, p_tatami_id: tatamiId === 'none' ? undefined : tatamiId }))
                }
              />
              <ActionRow>
                <Button title="Run earlier" variant="secondary" disabled={busy || index === 0} onPress={() => act(() => supabase.rpc('move_category_sequence', { p_category_id: category.id, p_direction: -1 }))} />
                <Button title="Run later" variant="secondary" disabled={busy || index === dayCategories.length - 1} onPress={() => act(() => supabase.rpc('move_category_sequence', { p_category_id: category.id, p_direction: 1 }))} />
                <Button title="Split across tatamis" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/bracket-split', params: { id, categoryId: category.id } })} />
              </ActionRow>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
