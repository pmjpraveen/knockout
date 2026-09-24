import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';
import { pressFeedback } from '@/lib/press';

export default function Restructure() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const { run, busy, error } = useSubmit();
  const { rows: categories, loading, reload } = useFocusQuery(() =>
    supabase.from('categories').select('*').eq('event_id', id).eq('status', 'closed').order('created_at'),
  );

  const toggle = (categoryId: string) =>
    setSelected((current) => (current.includes(categoryId) ? current.filter((c) => c !== categoryId) : [...current, categoryId]));

  const merge = async () => {
    if (await run(() => supabase.rpc('merge_categories', { p_target: selected[0], p_sources: selected.slice(1) }))) {
      setSelected([]);
      reload();
    }
  };

  const target = categories.find((c) => c.id === selected[0]);

  return (
    <Screen>
      <Text color="slateGray">
        Tap two or more categories to merge them into the first one you tapped. Registrations and seeds carry over.
      </Text>
      {categories.map((category) => {
        const position = selected.indexOf(category.id);
        return (
          <View key={category.id} style={{ gap: theme.spacing[8] }}>
            <Pressable style={({ pressed }) => pressFeedback(pressed)} onPress={() => toggle(category.id)}>
              <Card>
                <Text variant="bodyLg">{category.label}</Text>
                {position >= 0 && <Text variant="body" color="charcoal">{position === 0 ? 'Merge target' : 'Merges into target'}</Text>}
              </Card>
            </Pressable>
            <Button
              title="Split this category"
              variant="secondary"
              onPress={() => router.push({ pathname: '/events/[id]/split', params: { id, categoryId: category.id } })}
            />
          </View>
        );
      })}
      {loading && <SkeletonList count={2} />}
      {!loading && categories.length === 0 && <Text color="slateGray">No closed categories to restructure.</Text>}
      {error && <Text color="danger">{error}</Text>}
      <Button
        title={target ? `Merge into ${target.label}` : 'Merge'}
        confirmTitle="Tap again: this deletes the merged-in categories"
        disabled={busy || selected.length < 2}
        onPress={merge}
      />
    </Screen>
  );
}
