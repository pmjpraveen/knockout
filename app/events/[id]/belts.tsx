import type { LucideIcon } from 'lucide-react-native';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import X from 'lucide-react-native/icons/x';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ActionRow } from '@/components/ActionRow';
import { Button } from '@/components/Button';
import { ListGroup } from '@/components/ListGroup';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useEventBelts } from '@/hooks/useEventBelts';
import { useSubmit } from '@/hooks/useSubmit';
import { standardBelts } from '@/lib/athlete';
import { humanize } from '@/lib/events';
import { pressFeedback } from '@/lib/press';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

const maxBelts = 20;

function IconAction({ label, Icon, disabled, onPress }: { label: string; Icon: LucideIcon; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{ width: theme.touchTarget.minimum, height: theme.touchTarget.minimum, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }, pressFeedback(pressed)]}
    >
      <Icon size={20} color={theme.colors.charcoal} strokeWidth={1.75} />
    </Pressable>
  );
}

export default function Belts() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const saved = useEventBelts(id);
  const [belts, setBelts] = useState<string[]>(saved);
  const [name, setName] = useState('');
  const { run, busy, error } = useSubmit();

  useEffect(() => setBelts(saved), [saved]);

  const move = (index: number, by: number) =>
    setBelts((list) => {
      const next = [...list];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });

  const add = () => {
    const belt = name.trim().toLowerCase();
    if (!belt || belts.includes(belt)) return;
    setBelts((list) => [...list, belt]);
    setName('');
  };

  const save = async () => {
    if (await run(() => supabase.rpc('set_event_belts', { p_event_id: id, p_belts: belts }))) router.back();
  };

  return (
    <Screen>
      <Text color="slateGray">Clubs pick from these belts when they register. List them lowest first. The belt range of each category follows this order.</Text>
      <ListGroup>
        {belts.map((belt, index) => (
          <View key={belt} style={{ minHeight: theme.touchTarget.minimum, flexDirection: 'row', alignItems: 'center', gap: theme.spacing[4], paddingLeft: theme.spacing[16], paddingRight: theme.spacing[8] }}>
            <Text style={{ flex: 1 }}>{index + 1}. {humanize(belt)}</Text>
            <IconAction label={`Move ${belt} up`} Icon={ArrowUp} disabled={index === 0} onPress={() => move(index, -1)} />
            <IconAction label={`Move ${belt} down`} Icon={ArrowDown} disabled={index === belts.length - 1} onPress={() => move(index, 1)} />
            <IconAction label={`Remove ${belt}`} Icon={X} disabled={belts.length === 1} onPress={() => setBelts((list) => list.filter((b) => b !== belt))} />
          </View>
        ))}
      </ListGroup>
      <TextField label="Add a belt" value={name} onChangeText={setName} placeholder="e.g. green stripe" maxLength={30} />
      <ActionRow>
        <Button title="Add belt" variant="secondary" disabled={!name.trim() || belts.length >= maxBelts} onPress={add} />
        <Button title="Use standard belts" variant="secondary" onPress={() => setBelts(standardBelts)} />
      </ActionRow>
      {error && <Text color="danger">{error}</Text>}
      <Button title="Save belts" disabled={busy || belts.length === 0} onPress={save} />
    </Screen>
  );
}
