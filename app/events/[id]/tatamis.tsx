import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LinkCard } from '@/components/LinkCard';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useMyRoles } from '@/hooks/useMyRoles';
import { useSubmit } from '@/hooks/useSubmit';
import { toNumber } from '@/lib/events';
import { scheduleUrl } from '@/lib/registration';
import { supabase } from '@/lib/supabase';

const disciplines = [
  ['kumite_minutes', 'Kumite (minutes per match)'],
  ['kata_minutes', 'Kata (minutes per match)'],
  ['team_minutes', 'Team (minutes per match)'],
] as const;

export default function Tatamis() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isOrganizer } = useMyRoles(id);
  const [newName, setNewName] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const { run, busy, error } = useSubmit();

  const { rows: tatamis, reload } = useFocusQuery(() => supabase.from('tatamis').select('*').eq('event_id', id).order('created_at'));
  const { rows: events, reload: reloadEvent } = useFocusQuery(() => supabase.from('events').select('*').eq('id', id));
  const event = events[0];

  useEffect(() => {
    if (event) setMinutes(Object.fromEntries(disciplines.map(([key]) => [key, String(event[key])])));
  }, [event?.id]);

  const act = (action: () => PromiseLike<{ error: { message: string } | null }>) => run(async () => {
    const result = await action();
    await Promise.all([reload(), reloadEvent()]);
    return result;
  });

  const invalidMinutes = disciplines.some(([key]) => !(toNumber(minutes[key] ?? '')! > 0));
  const publicScheduleUrl = event?.schedule_token ? scheduleUrl(event.schedule_token) : null;

  return (
    <Screen>
      <Text variant="subheading" weight="medium">Tatamis</Text>
      {tatamis.map((tatami) => (
        <Card key={tatami.id}>
          <TextField label="Label" value={names[tatami.id] ?? tatami.name} onChangeText={(value) => setNames((n) => ({ ...n, [tatami.id]: value }))} autoCapitalize="words" />
          <Button
            title="Rename"
            variant="secondary"
            disabled={busy || !(names[tatami.id] ?? tatami.name).trim() || (names[tatami.id] ?? tatami.name) === tatami.name}
            onPress={() => act(() => supabase.from('tatamis').update({ name: names[tatami.id].trim() }).eq('id', tatami.id))}
          />
          <Button
            title="Delete"
            variant="danger"
            confirmTitle="Tap again: its categories become unassigned"
            disabled={busy}
            onPress={() => act(() => supabase.from('tatamis').delete().eq('id', tatami.id))}
          />
        </Card>
      ))}
      <TextField label="New tatami" value={newName} onChangeText={setNewName} placeholder="Tatami 1, Ring A…" autoCapitalize="words" />
      <Button
        title="Add tatami"
        disabled={busy || !newName.trim()}
        onPress={async () => { if (await act(() => supabase.from('tatamis').insert({ event_id: id, name: newName.trim() }))) setNewName(''); }}
      />

      {isOrganizer && (
        <>
          <Text variant="subheading" weight="medium">Match duration</Text>
          <Text color="slateGray">Drives the estimated call times.</Text>
          {disciplines.map(([key, label]) => (
            <TextField key={key} label={label} value={minutes[key] ?? ''} onChangeText={(value) => setMinutes((m) => ({ ...m, [key]: value }))} keyboardType="numeric" />
          ))}
          <Button
            title="Save durations"
            variant="secondary"
            disabled={busy || invalidMinutes}
            onPress={() => act(() => supabase.from('events').update({ kumite_minutes: Number(minutes.kumite_minutes), kata_minutes: Number(minutes.kata_minutes), team_minutes: Number(minutes.team_minutes) }).eq('id', id))}
          />

          <Text variant="subheading" weight="medium">Public schedule</Text>
          <Text color="slateGray">
            Anyone with this link sees upcoming matches, rings and estimated call times, without an account. Athlete names are shown; dates of birth, weights and clubs are not.
          </Text>
          {publicScheduleUrl && <LinkCard url={publicScheduleUrl} />}
          <Button
            title={publicScheduleUrl ? 'Regenerate link' : 'Create public schedule link'}
            variant={publicScheduleUrl ? 'danger' : 'primary'}
            confirmTitle={publicScheduleUrl ? 'Tap again: the old link stops working' : undefined}
            disabled={busy}
            onPress={() => act(() => supabase.rpc('regenerate_schedule_link', { p_event_id: id }))}
          />
          {publicScheduleUrl && (
            <Button title="Turn off public link" variant="secondary" disabled={busy} onPress={() => act(() => supabase.from('events').update({ schedule_token: null }).eq('id', id))} />
          )}
        </>
      )}
      {error && <Text color="danger">{error}</Text>}
    </Screen>
  );
}
