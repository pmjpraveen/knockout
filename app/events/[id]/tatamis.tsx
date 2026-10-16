import { useLocalSearchParams } from 'expo-router';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import Plus from 'lucide-react-native/icons/plus';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FormSection, SectionDivider } from '@/components/FormSection';
import { LinkCard } from '@/components/LinkCard';
import { ListGroup, ListRow } from '@/components/ListGroup';
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
  ['kumite_minutes', 'Kumite'],
  ['kata_minutes', 'Kata'],
  ['team_minutes', 'Team'],
] as const;

type Sheet = { kind: 'add' } | { kind: 'edit'; id: string; name: string } | null;

export default function Tatamis() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isOrganizer } = useMyRoles(id);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [name, setName] = useState('');
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

  const openAdd = () => {
    setName('');
    setSheet({ kind: 'add' });
  };
  const openEdit = (tatami: { id: string; name: string }) => {
    setName(tatami.name);
    setSheet({ kind: 'edit', id: tatami.id, name: tatami.name });
  };
  const closeSheet = () => setSheet(null);
  const done = async (action: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (await act(action)) closeSheet();
  };

  const invalidMinutes = disciplines.some(([key]) => !(toNumber(minutes[key] ?? '')! > 0));
  const publicScheduleUrl = event?.schedule_token ? scheduleUrl(event.schedule_token) : null;
  const editing = sheet?.kind === 'edit' ? sheet : null;

  return (
    <Screen footer={<Button size="large" title="Add tatami" icon={<Plus size={18} color={theme.colors.paperWhite} strokeWidth={1.75} />} onPress={openAdd} />}>
      <FormSection title={`Tatamis · ${tatamis.length}`} hint="One per ring. Categories are assigned to a tatami and scored there.">
        {tatamis.length === 0 ? (
          <EmptyState Icon={LayoutGrid} title="No tatamis yet" text="Add a tatami for each ring you will run matches on." />
        ) : (
          <ListGroup>
            {tatamis.map((tatami) => (
              <ListRow key={tatami.id} Icon={LayoutGrid} title={tatami.name} subtitle={tatami.status === 'paused' ? 'Paused' : 'Active'} onPress={() => openEdit(tatami)} />
            ))}
          </ListGroup>
        )}
      </FormSection>

      {isOrganizer && <SectionDivider />}
      {isOrganizer && (
        <FormSection title="Match duration" hint="Minutes per match. This is the default for every category; it drives the estimated call times, and a category can set its own match time.">
          <View style={{ flexDirection: 'row', gap: theme.spacing[12] }}>
            {disciplines.map(([key, label]) => (
              <View key={key} style={{ flex: 1 }}>
                <TextField label={label} value={minutes[key] ?? ''} onChangeText={(value) => setMinutes((m) => ({ ...m, [key]: value }))} keyboardType="numeric" />
              </View>
            ))}
          </View>
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
      {error && !sheet && <Text color="danger">{error}</Text>}

      <BottomSheet visible={!!sheet} title={editing ? 'Rename tatami' : 'Add tatami'} onClose={closeSheet}>
        <View style={{ gap: theme.spacing[16] }}>
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Tatami 1, Ring A…" autoCapitalize="words" />
          {error && <Text color="danger">{error}</Text>}
          {editing ? (
            <>
              <Button size="large" title="Save name" disabled={busy || !name.trim() || name.trim() === editing.name} onPress={() => done(() => supabase.from('tatamis').update({ name: name.trim() }).eq('id', editing.id))} />
              <Button
                title="Delete tatami"
                variant="danger"
                confirmTitle="Tap again: its categories become unassigned"
                disabled={busy}
                onPress={() => done(() => supabase.from('tatamis').delete().eq('id', editing.id))}
              />
            </>
          ) : (
            <Button size="large" title="Add tatami" disabled={busy || !name.trim()} onPress={() => done(() => supabase.from('tatamis').insert({ event_id: id, name: name.trim() }))} />
          )}
        </View>
      </BottomSheet>
    </Screen>
  );
}
