import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SheetImport } from '@/components/SheetImport';
import { SkeletonScreen } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { useEventBelts } from '@/hooks/useEventBelts';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { AthleteImport, parseAthleteRows } from '@/lib/athleteImport';
import type { Json } from '@/lib/database.types';
import { formatDate } from '@/lib/events';
import { supabase } from '@/lib/supabase';

export default function ImportAthletes() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { rows } = useFocusQuery(() => supabase.from('events').select('id, status').eq('id', id));
  const belts = useEventBelts(id);
  const event = rows[0];
  if (!event) return <SkeletonScreen />;

  const send = async (items: AthleteImport[]) => {
    const { data, error } = await supabase.rpc('import_athletes', { p_event_id: id, p_athletes: items as unknown as Json });
    const r = data as { clubs: number; athletes: number; skipped: number; unmatched: number } | null;
    if (!r) return { error };
    const parts = [`${r.athletes} ${r.athletes === 1 ? 'participant' : 'participants'} imported from ${r.clubs} ${r.clubs === 1 ? 'club' : 'clubs'}`];
    if (r.skipped) parts.push(`${r.skipped} skipped because they are already registered`);
    if (r.unmatched) parts.push(`${r.unmatched} matched no category yet, so review them under Submissions`);
    return { error, summary: `${parts.join('. ')}.` };
  };

  return (
    <Screen>
      {event.status === 'registration_open' ? (
        <SheetImport
          kind="participants"
          belts={belts}
          intro="Fill in one row per participant, with their club, then upload it. Each club becomes an approved submission, and participants are registered in the categories that match their age, gender, weight and belt."
          noun={['participant', 'participants']}
          parse={(sheetRows) => parseAthleteRows(sheetRows, belts)}
          describe={(a) => `${a.full_name} · ${a.club_name} · ${formatDate(a.date_of_birth)} · ${a.weight} kg · ${a.belt_rank} · ${a.disciplines.length === 2 ? 'kumite + kata' : a.disciplines[0]}`}
          send={send}
          onDone={() => router.back()}
        />
      ) : (
        <Text color="slateGray">Participants can only be imported while registration is open.</Text>
      )}
    </Screen>
  );
}
