import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { BracketMatch, BracketTree } from '@/components/BracketTree';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Screen } from '@/components/Screen';
import { SkeletonScreen } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useMyRoles } from '@/hooks/useMyRoles';
import { useSubmit } from '@/hooks/useSubmit';
import { humanize } from '@/lib/events';
import { supabase } from '@/lib/supabase';

const noBracket = '00000000-0000-0000-0000-000000000000';
const athleteColumns = 'a:athletes!matches_athlete_a_id_fkey(full_name), b:athletes!matches_athlete_b_id_fkey(full_name)';

export default function Bracket() {
  const { id, categoryId } = useLocalSearchParams<{ id: string; categoryId: string }>();
  const { canOverride } = useMyRoles(id);
  const [withdrawn, setWithdrawn] = useState('');
  const [note, setNote] = useState('');
  const { run, busy, error } = useSubmit();

  const { rows: categories } = useFocusQuery(() => supabase.from('categories').select('label').eq('id', categoryId));
  const { rows: brackets, loading: loadingBracket } = useFocusQuery(() => supabase.from('brackets').select('*').eq('category_id', categoryId), [], `bracket:${categoryId}`);
  const bracket = brackets[0];
  const { rows: matches, stale, reload } = useFocusQuery(
    () => supabase.from('matches').select(`*, ${athleteColumns}`).eq('bracket_id', bracket?.id ?? noBracket),
    [bracket?.id],
    `matches:${bracket?.id}`,
  );
  const { rows: standings } = useFocusQuery(() => supabase.rpc('pool_standings', { p_bracket_id: bracket?.id ?? noBracket }), [bracket?.id]);

  const names = new Map<string, string>();
  matches.forEach((m) => {
    if (m.athlete_a_id && m.a) names.set(m.athlete_a_id, m.a.full_name);
    if (m.athlete_b_id && m.b) names.set(m.athlete_b_id, m.b.full_name);
  });
  const started = matches.some((m) => m.status === 'in_progress' || m.status === 'completed');

  const withdraw = async () => {
    if (await run(() => supabase.rpc('withdraw_athlete', { p_bracket_id: bracket!.id, p_athlete_id: withdrawn, p_note: note }))) {
      setNote('');
      setWithdrawn('');
      reload();
    }
  };

  if (!bracket) return loadingBracket ? <SkeletonScreen /> : <Screen><Text color="slateGray">No bracket yet.</Text></Screen>;

  return (
    <Screen wide>
      <Text variant="heading" weight="medium">{categories[0]?.label}</Text>
      <Text color="slateGray">{humanize(bracket.format)} · {matches.length} matches</Text>
      {stale && <Text color="warning">Offline: showing the bracket as last synced.</Text>}
      <BracketTree matches={matches as BracketMatch[]} />

      {bracket.format === 'round_robin' && standings.length > 0 && (
        <>
          <Text variant="subheading" weight="medium">Standings</Text>
          {standings.map((s) => (
            <Card key={`${s.pool}-${s.athlete_id}`}>
              <Text weight="medium">Pool {s.pool} · #{s.rank} {names.get(s.athlete_id)}</Text>
              <Text variant="body" color="slateGray">{s.wins} wins · {s.losses} losses</Text>
            </Card>
          ))}
        </>
      )}

      {canOverride && started && (
        <>
          <Text variant="subheading" weight="medium">Withdrawal override</Text>
          <Text color="slateGray">Unplayed matches for the athlete become walkovers. The note is logged.</Text>
          <ChoiceChips label="Athlete" options={[...names.keys()]} value={withdrawn} onChange={setWithdrawn} labels={Object.fromEntries(names)} />
          <TextField label="Note" value={note} onChangeText={setNote} autoCapitalize="sentences" placeholder="e.g. Injured in warm-up" />
          {error && <Text color="danger">{error}</Text>}
          <Button title="Record withdrawal" variant="danger" confirmTitle="Tap again to confirm" disabled={busy || !withdrawn || !note.trim()} onPress={withdraw} />
        </>
      )}
    </Screen>
  );
}
