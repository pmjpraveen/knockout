import { useLocalSearchParams, useRouter } from 'expo-router';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import Plus from 'lucide-react-native/icons/plus';
import UserRound from 'lucide-react-native/icons/user-round';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FormSection } from '@/components/FormSection';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { BottomSheet } from '@/components/BottomSheet';
import { ChoiceChips } from '@/components/ChoiceChips';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { humanize } from '@/lib/events';
import { createStaffLogin } from '@/lib/staffLogins';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

const staffRoles = ['tournament_director', 'scorekeeper'] as const;

export default function Staff() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<(typeof staffRoles)[number]>('tournament_director');
  const [tatamiId, setTatamiId] = useState('');
  const [sheet, setSheet] = useState<string | null>(null);
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
      closeSheet();
      reloadStaff();
    }
  };

  const remove = async (memberId: string) => {
    if (await run(() => supabase.from('event_members').delete().eq('id', memberId))) {
      setSheet(null);
      reloadStaff();
    }
  };

  const closeSheet = () => {
    setSheet(null);
    setEmail('');
    setPassword('');
  };

  const selected = staff.find((member) => member.id === sheet);

  return (
    <Screen footer={<Button size="large" title="Create a login" icon={<Plus size={18} color={theme.colors.paperWhite} strokeWidth={1.75} />} onPress={() => setSheet('new')} />}>
      {tatamis.length === 0 && (
        <EmptyState Icon={LayoutGrid} title="Add the rings first" text="Scorekeepers are assigned to a tatami, so add the tatamis before creating their logins.">
          <Button title="Add tatamis" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/tatamis', params: { id } })} />
        </EmptyState>
      )}

      <FormSection title={`Staff · ${staff.length}`} hint="They sign in with the email and password you create. Share the password with them yourself.">
        <ListGroup>
          {staff.map((member) => (
            <ListRow
              key={member.id}
              Icon={UserRound}
              title={member.email}
              subtitle={`${humanize(member.role)}${member.tatami_id ? ` · ${tatamiLabels[member.tatami_id] ?? ''}` : ''}`}
              onPress={() => setSheet(member.id)}
            />
          ))}
        </ListGroup>
      </FormSection>

      <BottomSheet visible={sheet === 'new'} title="Create a login" onClose={closeSheet}>
        <View style={{ gap: theme.spacing[16] }}>
          <TextField label="Staff email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="off" />
          <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="off" placeholder="At least 8 characters" />
          <ChoiceChips label="Role" options={staffRoles} value={role} onChange={setRole} />
          {role === 'scorekeeper' && (
            <ChoiceChips label="Tatami" options={tatamis.map((t) => t.id)} value={tatamiId} onChange={setTatamiId} labels={tatamiLabels} />
          )}
          {error && <Text color="danger">{error}</Text>}
          <Button size="large" title="Create login" disabled={busy || !email.trim() || !password || (role === 'scorekeeper' && !tatamiId)} onPress={createLogin} />
        </View>
      </BottomSheet>

      <BottomSheet visible={!!selected} title={selected?.email ?? ''} onClose={closeSheet}>
        <View style={{ gap: theme.spacing[16] }}>
          <Text color="slateGray">{selected ? humanize(selected.role) : ''}{selected?.tatami_id ? ` · ${tatamiLabels[selected.tatami_id] ?? ''}` : ''}</Text>
          {error && <Text color="danger">{error}</Text>}
          {selected && selected.role !== 'organizer' ? (
            <Button title="Remove from staff" variant="danger" confirmTitle="Tap again to remove" disabled={busy} onPress={() => remove(selected.id)} />
          ) : (
            <Text color="slateGray">The organizer can&apos;t be removed.</Text>
          )}
        </View>
      </BottomSheet>
    </Screen>
  );
}
