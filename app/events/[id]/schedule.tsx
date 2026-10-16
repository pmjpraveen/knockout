import { useLocalSearchParams, useRouter } from 'expo-router';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import ListOrdered from 'lucide-react-native/icons/list-ordered';
import Timer from 'lucide-react-native/icons/timer';
import { ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ChoiceChips } from '@/components/ChoiceChips';
import { CardGrid } from '@/components/CardGrid';
import { EmptyState } from '@/components/EmptyState';
import { FormSection } from '@/components/FormSection';
import { IconAction } from '@/components/IconAction';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { ViewToggle } from '@/components/ViewToggle';
import { TatamiQueueCard } from '@/components/TatamiQueueCard';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useLiveReload } from '@/hooks/useLiveReload';
import { useEventDays } from '@/hooks/useEventDays';
import { useMyRoles } from '@/hooks/useMyRoles';
import { useSubmit } from '@/hooks/useSubmit';
import { currentDay, dayLabels, matchLabel } from '@/lib/schedule';
import { pressFeedback } from '@/lib/press';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

const drawn = ['bracket_generated', 'in_progress'];

const tabs = [
  { value: 'queues', label: 'Queues', Icon: LayoutGrid },
  { value: 'order', label: 'Running order', Icon: ListOrdered },
] as const;

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
  const [tab, setTab] = useState<(typeof tabs)[number]['value']>('queues');
  const [ring, setRing] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const day = picked ?? currentDay(days, schedule.map((row) => row.event_day));
  const daySchedule = schedule.filter((row) => !day || row.event_day === day);
  const dayCategories = categories.filter((category) => !day || category.event_day === day);
  const running = !daySchedule.some((row) => row.estimated_call_time === null);

  const tatamiLabels = { none: 'Unassigned', ...Object.fromEntries(tatamis.map((t) => [t.id, t.name])) };
  const clashes = daySchedule.filter((row) => row.conflict);

  const notice = (text: string, tone: 'warning' | 'neutral' = 'neutral') => (
    <View style={{ padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: tone === 'warning' ? theme.colors.warningTint : theme.colors.cloud }}>
      <Text color={tone === 'warning' ? 'warning' : 'slateGray'}>{text}</Text>
    </View>
  );
  const half = (button: ReactNode) => <View style={{ flex: 1 }}>{button}</View>;

  const showOrder = canOverride && tab === 'order';
  const ringOptions = ['all', ...tatamis.map((t) => t.id)];
  const ringLabels = { all: 'All rings', ...Object.fromEntries(tatamis.map((t) => [t.id, t.name])) };
  const shownTatamis = ring === 'all' ? tatamis : tatamis.filter((t) => t.id === ring);
  const perCard = ring === 'all' ? 2 : 5;
  const editing = dayCategories.find((category) => category.id === editingId);
  const ringOf = (category: { tatami_id: string | null }) => tatamis.find((t) => t.id === category.tatami_id)?.name ?? 'Unassigned';

  return (
    <Screen wide>
      {canOverride && (
        <ListGroup>
          <ListRow Icon={Timer} title="Tatamis, timing and public link" subtitle="Rings, match durations and the schedule link" onPress={() => router.push({ pathname: '/events/[id]/tatamis', params: { id } })} />
        </ListGroup>
      )}
      {days.length > 1 && day && <ChoiceChips label="Day" hideLabel options={days} value={day} labels={dayLabels(days)} onChange={setPicked} />}
      {canOverride && (
        <View style={{ alignSelf: 'flex-start' }}>
          <ViewToggle label="Schedule view" options={tabs} value={tab} onChange={setTab} />
        </View>
      )}
      {!running && !showOrder && notice('This day has not started. Its queues show the running order; call times appear once it does.')}
      {stale && notice('Offline: showing the schedule as last synced. Times are estimates from that moment.', 'warning')}
      {loadingTatamis && <SkeletonList count={2} />}
      {!loadingTatamis && tatamis.length === 0 && (
        <EmptyState Icon={LayoutGrid} title="No tatamis yet" text="Add the rings first. Each tatami gets its own queue of matches.">
          {canOverride && <Button size="large" title="Add tatamis" onPress={() => router.push({ pathname: '/events/[id]/tatamis', params: { id } })} />}
        </EmptyState>
      )}
      {error && <Text color="danger">{error}</Text>}

      {!showOrder && tatamis.length > 1 && <ChoiceChips label="Ring" hideLabel options={ringOptions} value={ring} labels={ringLabels} onChange={setRing} />}

      {!showOrder && clashes.length > 0 && (
        <View style={{ gap: theme.spacing[16], padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: theme.colors.warningTint }}>
          <View style={{ gap: theme.spacing[4] }}>
            <Text variant="bodyLg" color="warning">Double-booked athletes</Text>
            <Text variant="body" color="slateGray">These matches would call an athlete to two rings at once. Delay one of them.</Text>
          </View>
          {clashes.map((row) => (
            <View key={row.match_id} style={{ gap: theme.spacing[12], padding: theme.spacing[12], borderRadius: theme.radii.button, backgroundColor: theme.colors.paperWhite }}>
              <View style={{ gap: theme.spacing[4] }}>
                <Text>{row.athlete_a ?? 'TBD'} vs {row.athlete_b ?? 'TBD'}</Text>
                <Text variant="body" color="slateGray">{row.tatami_name} · #{row.queue_position} · {row.category_label}</Text>
              </View>
              {canOverride && <Button title="Delay one place" variant="warning" disabled={busy} onPress={() => act(() => supabase.rpc('move_in_queue', { p_match_id: row.match_id, p_direction: 1 }))} />}
            </View>
          ))}
        </View>
      )}

      {!showOrder && (
        <CardGrid>
          {shownTatamis.map((tatami) => {
            const queue = daySchedule.filter((row) => row.tatami_id === tatami.id);
            return (
              <TatamiQueueCard
                key={tatami.id}
                name={tatami.name}
                paused={tatami.status === 'paused'}
                items={queue.slice(0, perCard).map((row) => ({
                  key: row.match_id,
                  a: row.athlete_a,
                  b: row.athlete_b,
                  time: row.estimated_call_time,
                  category: row.category_label,
                  detail: matchLabel(row.bracket_side, row.round),
                  conflict: row.conflict,
                }))}
                footer={
                  <View style={{ gap: theme.spacing[12] }}>
                    {queue.length > perCard && <Text variant="body" color="slateGray">{queue.length - perCard} more in the queue</Text>}
                    <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
                      {half(<Button title="Full queue" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/tatami', params: { id, tatamiId: tatami.id, ...(day && { day }) } })} />)}
                      {canOverride && half(
                        <Button
                          title={tatami.status === 'paused' ? 'Resume' : 'Pause'}
                          variant="warning"
                          disabled={busy}
                          onPress={() => act(() => supabase.from('tatamis').update({ status: tatami.status === 'paused' ? 'active' : 'paused' }).eq('id', tatami.id))}
                        />,
                      )}
                    </View>
                  </View>
                }
              />
            );
          })}
        </CardGrid>
      )}

      {showOrder && dayCategories.length === 0 && (
        <EmptyState Icon={ListOrdered} title="No categories to run" text="Categories appear here once their brackets are drawn." />
      )}
      {showOrder && dayCategories.length > 0 && (
        <FormSection title={`Running order · ${dayCategories.length}`} hint="Move a category earlier or later, or tap it to change its ring and day.">
          <ListGroup>
            {dayCategories.map((category, index) => (
              <View key={category.id} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: theme.spacing[16], paddingRight: theme.spacing[8] }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${category.label}, ${ringOf(category)}. Change ring or day`}
                  onPress={() => setEditingId(category.id)}
                  style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing[12], paddingVertical: theme.spacing[12] }, pressFeedback(pressed)]}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.cloud, alignItems: 'center', justifyContent: 'center' }}>
                    <Text variant="label">{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: theme.spacing[4] }}>
                    <Text numberOfLines={1}>{category.label}</Text>
                    <Text variant="body" color={category.tatami_id ? 'slateGray' : 'warning'} numberOfLines={1}>{ringOf(category)}</Text>
                  </View>
                </Pressable>
                <IconAction label={`Run ${category.label} earlier`} Icon={ArrowUp} disabled={busy || index === 0} onPress={() => act(() => supabase.rpc('move_category_sequence', { p_category_id: category.id, p_direction: -1 }))} />
                <IconAction label={`Run ${category.label} later`} Icon={ArrowDown} disabled={busy || index === dayCategories.length - 1} onPress={() => act(() => supabase.rpc('move_category_sequence', { p_category_id: category.id, p_direction: 1 }))} />
              </View>
            ))}
          </ListGroup>
        </FormSection>
      )}

      <BottomSheet visible={!!editing} title={editing?.label ?? ''} onClose={() => setEditingId(null)}>
        {editing && (
          <View style={{ gap: theme.spacing[16] }}>
            {days.length > 1 && (
              <ChoiceChips label="Day" options={days} value={editing.event_day ?? days[0]} labels={dayLabels(days)} onChange={(next) => act(() => supabase.rpc('set_category_day', { p_category_id: editing.id, p_day: next }))} />
            )}
            <ChoiceChips
              label="Runs on"
              options={['none', ...tatamis.map((t) => t.id)]}
              value={editing.tatami_id ?? 'none'}
              labels={tatamiLabels}
              onChange={(tatamiId) => act(() => supabase.rpc('assign_category_to_tatami', { p_category_id: editing.id, p_tatami_id: tatamiId === 'none' ? undefined : tatamiId }))}
            />
            {error && <Text color="danger">{error}</Text>}
            <Button title="Split across tatamis" variant="secondary" onPress={() => { setEditingId(null); router.push({ pathname: '/events/[id]/bracket-split', params: { id, categoryId: editing.id } }); }} />
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}
