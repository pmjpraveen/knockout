import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { SyncBanner } from '@/components/ScoreboardParts';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useMyRoles } from '@/hooks/useMyRoles';
import { LocalMatch, loadMatch } from '@/lib/offline';
import { matchLabel } from '@/lib/schedule';
import { supabase } from '@/lib/supabase';

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

  return (
    <Screen animate={false}>
      <SyncBanner />
      {stale && <Text color="warning">Offline: showing the queue as last synced.</Text>}
      {error && <Text color="danger">{error}</Text>}
      {canOverride && (
        <ChoiceChips label="Tatami" options={tatamis.map((t) => t.id)} value={tatamiId} labels={Object.fromEntries(tatamis.map((t) => [t.id, t.name]))} onChange={setChosen} />
      )}
      {!tatamiId && <Text color="slateGray">You are not assigned to a tatami. Ask the organizer.</Text>}
      {loading && tatamiId && <SkeletonList count={2} />}
      {!loading && queue.length === 0 && tatamiId && <Text color="slateGray">Nothing ready to score.</Text>}
      {queue.map((row, index) => (
        <Card key={row.match_id}>
          <Text variant="label" weight="medium" color="slateGray" style={{ textTransform: 'uppercase' }}>
            {row.match_status === 'in_progress' || local[row.match_id]?.started ? 'In progress' : index === 0 ? 'Next' : 'Later'}
          </Text>
          <Text variant="bodyLg" weight="medium">{row.athlete_a} vs {row.athlete_b}</Text>
          <Text variant="body" color="slateGray">{row.category_label} · {matchLabel(row.bracket_side, row.round)}</Text>
          {local[row.match_id]?.conflict && <Text variant="body" color="danger">Conflict: {local[row.match_id].conflict}</Text>}
          {index < 2 && row.category_label !== runningCategory && !local[row.match_id]?.started && row.match_status !== 'in_progress' ? (
            <Text variant="body" color="slateGray">Finish {runningCategory} on this tatami first.</Text>
          ) : (
            index < 2 && (
              <Button
                title={local[row.match_id]?.started || row.match_status === 'in_progress' ? 'Continue scoring' : 'Score this match'}
                onPress={() => router.push({ pathname: '/events/[id]/match', params: { id, tatamiId, matchId: row.match_id } })}
              />
            )
          )}
        </Card>
      ))}
      <Button title="Refresh queue" variant="secondary" onPress={reload} />
    </Screen>
  );
}
