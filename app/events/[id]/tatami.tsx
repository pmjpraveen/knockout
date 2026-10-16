import { useLocalSearchParams, useRouter } from 'expo-router';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import Swords from 'lucide-react-native/icons/swords';
import { ReactNode } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SkeletonScreen } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { QueueItemBody } from '@/components/TatamiQueueCard';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useLiveReload } from '@/hooks/useLiveReload';
import { useMyRoles } from '@/hooks/useMyRoles';
import { useSubmit } from '@/hooks/useSubmit';
import { currentDay, matchLabel } from '@/lib/schedule';
import { formatDate } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

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

  const half = (button: ReactNode) => <View style={{ flex: 1 }}>{button}</View>;
  const paused = tatami.status === 'paused';

  return (
    <Screen
      footer={
        canOverride ? (
          <Button
            size="large"
            title={paused ? 'Resume tatami' : 'Pause tatami'}
            variant="warning"
            disabled={busy}
            onPress={() => act(() => supabase.from('tatamis').update({ status: paused ? 'active' : 'paused' }).eq('id', tatami.id))}
          />
        ) : undefined
      }
    >
      <View style={{ gap: theme.spacing[8] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[12] }}>
          <Text variant="heading" style={{ flexShrink: 1 }}>{tatami.name}</Text>
          {paused && <StatusPill status="paused" />}
        </View>
        <Text color="slateGray">{day ? `Queue for ${formatDate(day)} · ` : ''}{queue.length} {queue.length === 1 ? 'match' : 'matches'}</Text>
      </View>
      {error && <Text color="danger">{error}</Text>}
      {queue.length === 0 && <EmptyState Icon={Swords} title="Nothing queued" text="Matches appear here once a bracket is drawn and assigned to this tatami." />}
      {queue.map((row, index) => {
        const movable = row.match_status === 'scheduled' && row.athlete_a && row.athlete_b;
        return (
          <Card key={row.match_id}>
            <QueueItemBody
              index={index}
              item={{
                key: row.match_id,
                a: row.athlete_a,
                b: row.athlete_b,
                time: row.estimated_call_time,
                category: row.category_label,
                detail: matchLabel(row.bracket_side, row.round),
                conflict: row.conflict,
                action: canOverride && (
                  <View style={{ gap: theme.spacing[12], marginTop: theme.spacing[8] }}>
                    {movable && (
                      <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
                        {half(<Button title="Earlier" variant="secondary" icon={<ArrowUp size={18} color={theme.colors.inkBlack} strokeWidth={1.75} />} disabled={busy || row.queue_position === 1} onPress={() => act(() => supabase.rpc('move_in_queue', { p_match_id: row.match_id, p_direction: -1 }))} />)}
                        {half(<Button title="Later" variant="secondary" icon={<ArrowDown size={18} color={theme.colors.inkBlack} strokeWidth={1.75} />} disabled={busy} onPress={() => act(() => supabase.rpc('move_in_queue', { p_match_id: row.match_id, p_direction: 1 }))} />)}
                      </View>
                    )}
                    <Button title="Audit & override" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/match-audit', params: { id, matchId: row.match_id } })} />
                  </View>
                ),
              }}
            />
          </Card>
        );
      })}
    </Screen>
  );
}
