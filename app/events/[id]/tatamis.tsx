import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormSection, SectionDivider } from '@/components/FormSection';
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
import { theme } from '@/theme/tokens';

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
      <FormSection title="Tatamis" hint="One per ring. Categories are assigned to a tatami and scored there.">
        {tatamis.map((tatami) => {
          const name = names[tatami.id] ?? tatami.name;
          return (
            <Card key={tatami.id}>
              <View style={{ gap: theme.spacing[12] }}>
                <TextField label="Label" value={name} onChangeText={(value) => setNames((n) => ({ ...n, [tatami.id]: value }))} autoCapitalize="words" />
                <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Rename"
                      variant="secondary"
                      disabled={busy || !name.trim() || name === tatami.name}
                      onPress={() => act(() => supabase.from('tatamis').update({ name: name.trim() }).eq('id', tatami.id))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Delete"
                      variant="danger"
                      confirmTitle="Tap again: its categories become unassigned"
                      disabled={busy}
                      onPress={() => act(() => supabase.from('tatamis').delete().eq('id', tatami.id))}
                    />
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
        <TextField label="New tatami" value={newName} onChangeText={setNewName} placeholder="Tatami 1, Ring A…" autoCapitalize="words" />
        <Button
          title="Add tatami"
          disabled={busy || !newName.trim()}
          onPress={async () => { if (await act(() => supabase.from('tatamis').insert({ event_id: id, name: newName.trim() }))) setNewName(''); }}
        />
      </FormSection>

      {isOrganizer && <SectionDivider />}
      {isOrganizer && (
        <FormSection title="Match duration" hint="Drives the estimated call times.">
          {disciplines.map(([key, label]) => (
            <TextField key={key} label={label} value={minutes[key] ?? ''} onChangeText={(value) => setMinutes((m) => ({ ...m, [key]: value }))} keyboardType="numeric" />
          ))}
          <Button
            title="Save durations"
            variant="secondary"
            disabled={busy || invalidMinutes}
            onPress={() => act(() => supabase.from('events').update({ kumite_minutes: Number(minutes.kumite_minutes), kata_minutes: Number(minutes.kata_minutes), team_minutes: Number(minutes.team_minutes) }).eq('id', id))}
          />
        </FormSection>
      )}

      {isOrganizer && <SectionDivider />}
      {isOrganizer && (
        <FormSection
          title="Public schedule"
          hint="Anyone with this link sees upcoming matches, rings and estimated call times, without an account. Athlete names are shown; dates of birth, weights and clubs are not."
        >
          {publicScheduleUrl && <LinkCard url={publicScheduleUrl} />}
          <View style={{ gap: theme.spacing[12] }}>
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
          </View>
        </FormSection>
      )}
      {error && <Text color="danger">{error}</Text>}
    </Screen>
  );
}
