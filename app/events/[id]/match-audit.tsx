import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Screen } from '@/components/Screen';
import { SkeletonScreen } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { humanize } from '@/lib/events';
import { supabase } from '@/lib/supabase';

type Audit = {
  match: {
    status: string; started_at: string | null; finalized_at: string | null; result_method: string | null; result_note: string | null;
    scoring_device_id: string | null; winner: string | null; finalized_by: string | null; athlete_a: string | null; athlete_b: string | null;
  };
  events: {
    sequence: number; type: string; value: number | null; detail: Record<string, unknown> | null; athlete: string | null;
    actor: string | null; device_id: string; client_timestamp: string; voids: number | null;
  }[];
};

export default function MatchAudit() {
  const { matchId } = useLocalSearchParams<{ id: string; matchId: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [note, setNote] = useState('');
  const [winner, setWinner] = useState<'a' | 'b' | ''>('');
  const { run, busy, error } = useSubmit();

  const load = () => supabase.rpc('match_audit', { p_match_id: matchId }).then(({ data }) => setAudit(data as unknown as Audit | null));
  useEffect(() => { load(); }, [matchId]);

  const act = (action: () => PromiseLike<{ error: { message: string } | null }>) => run(async () => {
    const result = await action();
    await load();
    return result;
  });

  if (!audit) return <SkeletonScreen />;
  const { match } = audit;
  const open = match.status === 'scheduled' || match.status === 'in_progress';
  const names = { a: match.athlete_a ?? '', b: match.athlete_b ?? '' };

  return (
    <Screen>
      <Text variant="heading">{match.athlete_a} vs {match.athlete_b}</Text>
      <Text color="slateGray">
        {humanize(match.status)}
        {match.winner ? ` · ${match.winner} won by ${humanize(match.result_method ?? '').toLowerCase()}` : ''}
        {match.finalized_by ? ` · finalized by ${match.finalized_by}` : ''}
      </Text>
      {match.result_note && <Text>Note: {match.result_note}</Text>}
      {match.scoring_device_id && <Text variant="body" color="slateGray">Scoreboard device {match.scoring_device_id.slice(0, 8)}</Text>}

      <Text variant="subheading">Logged events</Text>
      {audit.events.length === 0 && <Text color="slateGray">Nothing logged yet.</Text>}
      {audit.events.map((event) => (
        <Card key={event.sequence}>
          <Text>
            #{event.sequence} {humanize(event.type)}
            {event.athlete ? ` · ${event.athlete}` : ''}
            {event.value !== null ? ` · ${event.value}` : ''}
          </Text>
          <Text variant="body" color="slateGray">
            {event.actor} · {new Date(event.client_timestamp).toLocaleTimeString()}
            {event.detail ? ` · ${JSON.stringify(event.detail)}` : ''}
            {event.voids ? ` · cancels #${event.voids}` : ''}
          </Text>
        </Card>
      ))}

      {open && (
        <>
          <Text variant="subheading">Override</Text>
          <Text color="slateGray">Finish this match by hand, or free it from a scoreboard device that has died. A note is required and logged.</Text>
          <TextField label="Note" value={note} onChangeText={setNote} autoCapitalize="sentences" placeholder="e.g. Tablet died, result confirmed by referee" />
          {match.athlete_a && match.athlete_b && (
            <ChoiceChips label="Winner" options={['a', 'b']} value={winner} labels={names} onChange={setWinner} />
          )}
          {error && <Text color="danger">{error}</Text>}
          <Button
            title="Set result"
            variant="danger"
            confirmTitle="Tap again: this ends the match"
            disabled={busy || !note.trim() || !winner}
            onPress={async () => {
              const { data } = await supabase.from('matches').select('athlete_a_id, athlete_b_id').eq('id', matchId).single();
              if (data) await act(() => supabase.rpc('override_match_result', { p_match_id: matchId, p_winner_id: (winner === 'a' ? data.athlete_a_id : data.athlete_b_id)!, p_note: note }));
            }}
          />
          {match.status === 'in_progress' && (
            <Button title="Release scoreboard device" variant="warning" disabled={busy || !note.trim()} onPress={() => act(() => supabase.rpc('release_match_claim', { p_match_id: matchId, p_note: note }))} />
          )}
        </>
      )}
    </Screen>
  );
}
