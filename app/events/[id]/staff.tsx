import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { humanize } from '@/lib/events';
import { createStaffLogin } from '@/lib/staffLogins';
import { supabase } from '@/lib/supabase';

const staffRoles = ['tournament_director', 'scorekeeper'] as const;

export default function Staff() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<(typeof staffRoles)[number]>('tournament_director');
  const [tatamiId, setTatamiId] = useState('');
  const { run, busy, error } = useSubmit();

  const { rows: tatamis } = useFocusQuery(() =>
    supabase.from('tatamis').select('*').eq('event_id', id).order('created_at'),
  );
  const { rows: staff, reload: reloadStaff } = useFocusQuery(() => supabase.rpc('list_event_staff', { p_event_id: id }));

  const tatamiLabels = Object.fromEntries(tatamis.map((t) => [t.id, t.name]));

  const createLogin = async () => {
    const created = await run(() =>
      createStaffLogin({ event_id: id, email, password, role, tatami_id: role === 'scorekeeper' ? tatamiId : undefined }),
    );
    if (created) {
      setEmail('');
      setPassword('');
      reloadStaff();
    }
  };

  const remove = async (memberId: string) => {
    if (await run(() => supabase.from('event_members').delete().eq('id', memberId))) reloadStaff();
  };

  return (
    <Screen>
      {tatamis.length === 0 && (
        <>
          <Text color="slateGray">Scorekeepers are assigned to a tatami, so add the rings first.</Text>
          <Button title="Add tatamis" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/tatamis', params: { id } })} />
        </>
      )}

      <Text variant="subheading" weight="medium">Staff</Text>
      {staff.map((member) => (
        <Card key={member.id}>
          <Text weight="medium">{member.email}</Text>
          <Text variant="body" color="slateGray">
            {humanize(member.role)}{member.tatami_id ? ` · ${tatamiLabels[member.tatami_id] ?? ''}` : ''}
          </Text>
          {member.role !== 'organizer' && (
            <Button title="Remove" variant="danger" confirmTitle="Tap again to remove" disabled={busy} onPress={() => remove(member.id)} />
          )}
        </Card>
      ))}
      <Text variant="subheading" weight="medium">Create a login</Text>
      <Text color="slateGray">They sign in with this email and password. Share the password with them yourself. You can create logins until the event is completed.</Text>
      <TextField label="Staff email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="off" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="off" placeholder="At least 8 characters" />
      <ChoiceChips label="Role" options={staffRoles} value={role} onChange={setRole} />
      {role === 'scorekeeper' && (
        <ChoiceChips label="Tatami" options={tatamis.map((t) => t.id)} value={tatamiId} onChange={setTatamiId} labels={tatamiLabels} />
      )}
      {error && <Text color="danger">{error}</Text>}
      <Button title="Create login" disabled={busy || !email.trim() || !password || (role === 'scorekeeper' && !tatamiId)} onPress={createLogin} />
    </Screen>
  );
}
