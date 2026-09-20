import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AthleteFields } from '@/components/AthleteFields';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useSubmit } from '@/hooks/useSubmit';
import { AthleteDraft, athleteProblem, emptyAthlete, toAthleteInput, toDraft } from '@/lib/athlete';
import { supabase } from '@/lib/supabase';

export default function OrganizerAthlete() {
  const { entryId, athleteId } = useLocalSearchParams<{ id: string; entryId: string; athleteId?: string }>();
  const router = useRouter();
  const [athlete, setAthlete] = useState<AthleteDraft>(emptyAthlete);
  const [reason, setReason] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const { run, busy, error } = useSubmit();

  useEffect(() => {
    if (!athleteId) return;
    supabase.from('athletes').select('*').eq('id', athleteId).single().then(({ data }) => data && setAthlete(toDraft(data)));
  }, [athleteId]);

  const save = () => {
    const problem = athleteProblem(athlete) ?? (reason.trim() ? null : 'A reason is required for organizer changes.');
    setInvalid(problem);
    if (problem) return;
    const { full_name, date_of_birth, gender, weight, belt_rank } = toAthleteInput(athlete);
    const fields = { p_full_name: full_name, p_date_of_birth: date_of_birth, p_gender: gender, p_weight: weight, p_belt_rank: belt_rank, p_reason: reason };
    return run(async () => {
      const result = athleteId
        ? await supabase.rpc('organizer_edit_athlete', { p_athlete_id: athleteId, ...fields })
        : await supabase.rpc('organizer_add_athlete', { p_club_entry_id: entryId, ...fields });
      if (!result.error) router.back();
      return result;
    });
  };

  return (
    <Screen>
      <AthleteFields value={athlete} onChange={setAthlete} />
      <TextField label="Reason for change" value={reason} onChangeText={setReason} autoCapitalize="sentences" placeholder="e.g. Weigh-in correction" />
      {(invalid ?? error) && <Text color="danger">{invalid ?? error}</Text>}
      <Button title={athleteId ? 'Save change' : 'Add participant'} disabled={busy} onPress={save} />
    </Screen>
  );
}
