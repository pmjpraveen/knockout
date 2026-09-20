import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { formatDateTime, humanize } from '@/lib/events';
import { supabase } from '@/lib/supabase';

const explanations: Record<string, string> = {
  match_not_found: 'The bracket was redrawn while a device was offline, so this match no longer exists.',
  match_finalized: 'The match already has a result (another device or an override).',
  device_mismatch: 'A different scoreboard device holds this match.',
  not_authorized: 'The scorekeeper is not assigned to this match’s tatami.',
  not_ready: 'The match was not ready to be scored.',
  not_started: 'Scores arrived for a match that was never started.',
};

export default function Conflicts() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const { run, busy, error } = useSubmit();
  const { rows, loading, reload } = useFocusQuery(() =>
    supabase.from('scoring_conflicts').select('*').eq('event_id', id).is('resolved_at', null).order('created_at', { ascending: false }),
  );

  const resolve = async (conflictId: string) => {
    if (await run(() => supabase.rpc('resolve_scoring_conflict', { p_conflict_id: conflictId, p_note: note }))) {
      setOpen(null);
      setNote('');
      reload();
    }
  };

  return (
    <Screen>
      <Text color="slateGray">
        Operations a scoreboard device sent that the server could not apply. Nothing is applied automatically: review the match, set the result if needed, then resolve.
      </Text>
      {loading && <SkeletonList count={2} />}
      {!loading && rows.length === 0 && <Text color="slateGray">No unresolved conflicts.</Text>}
      {error && <Text color="danger">{error}</Text>}
      {rows.map((conflict) => (
        <Card key={conflict.id}>
          <Text weight="medium" color="warning">{humanize(conflict.reason)}</Text>
          <Text>{explanations[conflict.reason] ?? 'The server rejected this operation.'}</Text>
          <Text variant="body" color="slateGray">
            {formatDateTime(conflict.created_at)} · device {conflict.device_id.slice(0, 8)} · {(conflict.op as { kind?: string }).kind}
          </Text>
          {conflict.match_id && conflict.reason !== 'match_not_found' && (
            <Button title="Open match audit" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/match-audit', params: { id, matchId: conflict.match_id! } })} />
          )}
          {open === conflict.id ? (
            <>
              <TextField label="How was this resolved?" value={note} onChangeText={setNote} autoCapitalize="sentences" />
              <Button title="Mark resolved" disabled={busy || !note.trim()} onPress={() => resolve(conflict.id)} />
            </>
          ) : (
            <Button title="Resolve…" variant="secondary" onPress={() => setOpen(conflict.id)} />
          )}
        </Card>
      ))}
    </Screen>
  );
}
