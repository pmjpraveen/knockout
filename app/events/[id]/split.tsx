import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { supabase } from '@/lib/supabase';
import { pressFeedback } from '@/lib/press';

export default function Split() {
  const { categoryId } = useLocalSearchParams<{ id: string; categoryId: string }>();
  const router = useRouter();
  const [moving, setMoving] = useState<string[]>([]);
  const [label, setLabel] = useState('');
  const { run, busy, error } = useSubmit();
  const { rows: categories } = useFocusQuery(() => supabase.from('categories').select('label').eq('id', categoryId));
  const { rows: registrations, loading } = useFocusQuery(() =>
    supabase.from('registrations').select('id, seed, athletes(full_name)').eq('category_id', categoryId),
  );

  const source = categories[0]?.label ?? '';
  const toggle = (registrationId: string) =>
    setMoving((current) => (current.includes(registrationId) ? current.filter((r) => r !== registrationId) : [...current, registrationId]));

  const split = () =>
    run(async () => {
      const result = await supabase.rpc('split_category', {
        p_category: categoryId,
        p_registration_ids: moving,
        p_label: label.trim() || `${source} B`,
      });
      if (!result.error) router.back();
      return result;
    });

  return (
    <Screen>
      <Text color="slateGray">Tap the athletes to move into a new copy of “{source}”. You can edit its criteria afterwards.</Text>
      {loading && <SkeletonList count={2} />}
      {!loading && registrations.length === 0 && <Text color="slateGray">No athletes are registered in this category.</Text>}
      {registrations.map((r) => (
        <Pressable key={r.id} style={({ pressed }) => pressFeedback(pressed)} onPress={() => toggle(r.id)}>
          <Card>
            <Text>{r.athletes?.full_name}</Text>
            <Text variant="body" color="slateGray">
              {[r.seed !== null && `Seed ${r.seed}`, moving.includes(r.id) && 'Moving to new category'].filter(Boolean).join(' · ')}
            </Text>
          </Card>
        </Pressable>
      ))}
      <TextField label="New category label" value={label} onChangeText={setLabel} placeholder={`${source} B`} autoCapitalize="sentences" />
      {error && <Text color="danger">{error}</Text>}
      <Button title="Split" disabled={busy || moving.length === 0} onPress={split} />
    </Screen>
  );
}
