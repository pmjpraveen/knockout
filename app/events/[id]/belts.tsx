import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useEventBelts } from '@/hooks/useEventBelts';
import { useSubmit } from '@/hooks/useSubmit';
import { standardBelts } from '@/lib/athlete';
import { humanize } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

const maxBelts = 20;

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
      <Card>
        <View style={{ gap: theme.spacing[12] }}>
          {belts.map((belt, index) => (
            <View key={belt} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[8] }}>
              <Text weight="medium" style={{ flex: 1 }}>{index + 1}. {humanize(belt)}</Text>
              <Button title="Up" variant="secondary" disabled={index === 0} onPress={() => move(index, -1)} />
              <Button title="Down" variant="secondary" disabled={index === belts.length - 1} onPress={() => move(index, 1)} />
              <Button title="Remove" variant="secondary" disabled={belts.length === 1} onPress={() => setBelts((list) => list.filter((b) => b !== belt))} />
            </View>
          ))}
        </View>
      </Card>
      <TextField label="Add a belt" value={name} onChangeText={setName} placeholder="e.g. green stripe" maxLength={30} />
      <Button title="Add belt" variant="secondary" disabled={!name.trim() || belts.length >= maxBelts} onPress={add} />
      <Button title="Use standard belts" variant="secondary" onPress={() => setBelts(standardBelts)} />
      {error && <Text color="danger">{error}</Text>}
      <Button title="Save belts" disabled={busy || belts.length === 0} onPress={save} />
    </Screen>
  );
}
