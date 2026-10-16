import { useLocalSearchParams, useRouter } from 'expo-router';
import MapPinOff from 'lucide-react-native/icons/map-pin-off';
import Swords from 'lucide-react-native/icons/swords';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { SyncBanner } from '@/components/ScoreboardParts';
import { QueueItemBody } from '@/components/TatamiQueueCard';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useMyRoles } from '@/hooks/useMyRoles';
import { LocalMatch, loadMatch } from '@/lib/offline';
import { matchLabel } from '@/lib/schedule';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

export default function Scoreboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { memberships, canOverride } = useMyRoles(id);
  const [chosen, setChosen] = useState('');
  const [local, setLocal] = useState<Record<string, LocalMatch>>({});

  const { rows: tatamis } = useFocusQuery(() => supabase.from('tatamis').select('*').eq('event_id', id).order('name'), [], `tatamis:${id}`);
  const own = memberships.find((m) => m.role === 'scorekeeper')?.tatami_id ?? '';
  const tatamiId = canOverride ? chosen || tatamis[0]?.id || '' : own;

  const { rows, stale, error, loading, reload } = useFocusQuery(
    () => supabase.rpc('tatami_scoreboard', { p_tatami_id: tatamiId || '00000000-0000-0000-0000-000000000000' }),
    [tatamiId],
    `scoreboard:${tatamiId}`,
  );

  // Matches finalized on this device disappear from the queue at once, even before they sync.
  useEffect(() => {
    Promise.all(rows.map(async (row) => [row.match_id, await loadMatch(row.match_id)] as const)).then((pairs) => setLocal(Object.fromEntries(pairs)));
  }, [rows]);
  const queue = rows.filter((row) => !local[row.match_id]?.finalized);
  // A tatami works through one category at a time (enforced by the server too): the queue is already
  // ordered so the running category's matches come first, so its own first row names it.
  const runningCategory = queue[0]?.category_label;

  const tatamiName = tatamis.find((t) => t.id === tatamiId)?.name;
  const startedHere = (row: (typeof queue)[number]) => !!local[row.match_id]?.started || row.match_status === 'in_progress';

  return (
    <Screen animate={false}>
      <SyncBanner />
      {stale && <Text color="warning">Offline: showing the queue as last synced.</Text>}
      {error && <Text color="danger">{error}</Text>}
      {canOverride && (
        <ChoiceChips label="Tatami" hideLabel options={tatamis.map((t) => t.id)} value={tatamiId} labels={Object.fromEntries(tatamis.map((t) => [t.id, t.name]))} onChange={setChosen} />
      )}
      {!tatamiId && <EmptyState Icon={MapPinOff} title="No tatami assigned" text="You are not assigned to a tatami yet. Ask the organizer to assign you." />}
      {tatamiName && (
        <View style={{ gap: theme.spacing[4] }}>
          <Text variant="heading">{tatamiName}</Text>
          {!loading && <Text color="slateGray">{queue.length} {queue.length === 1 ? 'match' : 'matches'} in the queue</Text>}
        </View>
      )}
      {loading && tatamiId && <SkeletonList count={2} />}
      {!loading && queue.length === 0 && tatamiId && <EmptyState Icon={Swords} title="Nothing to score yet" text="Matches appear here once brackets are drawn and the next fight on this tatami is ready." />}
      {queue.map((row, index) => {
        const blocked = index < 2 && row.category_label !== runningCategory && !startedHere(row);
        const open = () => router.push({ pathname: '/events/[id]/match', params: { id, tatamiId, matchId: row.match_id } });
        return (
          <Card key={row.match_id}>
            <QueueItemBody
              index={index}
              item={{
                key: row.match_id,
                a: row.athlete_a,
                b: row.athlete_b,
                time: null,
                category: row.category_label,
                detail: matchLabel(row.bracket_side, row.round),
                label: startedHere(row) ? 'In progress' : index === 0 ? 'Next' : 'Later',
                action: (
                  <View style={{ gap: theme.spacing[12], marginTop: theme.spacing[8] }}>
                    {local[row.match_id]?.conflict && (
                      <View style={{ padding: theme.spacing[12], borderRadius: theme.radii.button, backgroundColor: theme.colors.dangerTint }}>
                        <Text variant="body" color="danger">Conflict: {local[row.match_id].conflict}</Text>
                      </View>
                    )}
                    {blocked && <Text variant="body" color="slateGray">Finish {runningCategory} on this tatami first.</Text>}
                    {index < 2 && !blocked && (
                      <Button size={index === 0 ? 'large' : 'normal'} variant={index === 0 ? 'primary' : 'secondary'} title={startedHere(row) ? 'Continue scoring' : 'Score this match'} onPress={open} />
                    )}
                  </View>
                ),
              }}
            />
          </Card>
        );
      })}
      <Button title="Refresh queue" variant="secondary" onPress={reload} />
    </Screen>
  );
}
