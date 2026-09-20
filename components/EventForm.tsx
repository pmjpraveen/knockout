import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { CoverImageField } from '@/components/CoverImageField';
import { DateField } from '@/components/DateField';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { Cover, saveCover } from '@/lib/coverImage';
import { dateOf, eventFields, EventRow, validateEventDates } from '@/lib/events';
import { supabase } from '@/lib/supabase';

export function EventForm({ event }: { event: EventRow }) {
  const router = useRouter();
  const [name, setName] = useState(event.name);
  const [venue, setVenue] = useState(event.venue ?? '');
  const [hostClub, setHostClub] = useState(event.host_club ?? '');
  const [startDate, setStartDate] = useState(event.start_date ?? '');
  const [endDate, setEndDate] = useState(event.end_date ?? '');
  const [opens, setOpens] = useState(dateOf(event.registration_opens_at));
  const [closes, setCloses] = useState(dateOf(event.registration_closes_at));
  const [invalid, setInvalid] = useState<string | null>(null);
  const { run, busy, error } = useSubmit();

  const { rows: covers } = useFocusQuery(() => supabase.from('event_covers').select('image').eq('event_id', event.id));
  const [pickedCover, setPickedCover] = useState<Cover | null | undefined>(undefined);
  const cover = pickedCover === undefined ? (covers[0] ?? null) : pickedCover;

  const save = () => {
    const problem = validateEventDates({ startDate, endDate, opens, closes });
    setInvalid(problem);
    if (problem) return;
    return run(async () => {
      const result = await supabase.from('events').update(eventFields({ name, venue, hostClub, startDate, endDate, opens, closes })).eq('id', event.id);
      if (result.error) return result;
      const coverResult = pickedCover === undefined ? result : await saveCover(event.id, pickedCover);
      if (!coverResult.error) router.back();
      return coverResult;
    });
  };

  return (
    <>
      <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <TextField label="Venue" value={venue} onChangeText={setVenue} autoCapitalize="words" />
      <TextField label="Host club" value={hostClub} onChangeText={setHostClub} autoCapitalize="words" />
      <DateField label="Start date" value={startDate} onChange={setStartDate} />
      <DateField label="End date" value={endDate} onChange={setEndDate} />
      <DateField label="Registration opens" value={opens} onChange={setOpens} clearable />
      <DateField label="Registration closes" value={closes} onChange={setCloses} clearable />
      <CoverImageField value={cover} onChange={setPickedCover} />
      {(invalid ?? error) && <Text color="danger">{invalid ?? error}</Text>}
      <Button title="Save changes" disabled={busy || !name.trim()} onPress={save} />
    </>
  );
}
