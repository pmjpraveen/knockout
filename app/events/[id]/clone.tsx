import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { labelTaken } from '@/lib/categoryRules';
import { criteriaColumns, formatDateRange, initialCategoryStatus } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { pressFeedback } from '@/lib/press';

export default function CloneCategories() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { rows: events, loading } = useFocusQuery(() => supabase.from('events').select('*').order('created_at', { ascending: false }));
  const { run, busy, error } = useSubmit();

  const current = events.find((e) => e.id === id);
  const status = initialCategoryStatus[current?.status as keyof typeof initialCategoryStatus];

  const copyFrom = (sourceId: string) =>
    run(async () => {
      const [source, existing] = await Promise.all([
        supabase.from('categories').select(criteriaColumns).eq('event_id', sourceId),
        supabase.from('categories').select('label').eq('event_id', id),
      ]);
      if (source.error) return source;
      if (existing.error) return existing;
      const fresh = source.data.filter((c) => !labelTaken(c.label, existing.data));
      if (fresh.length === 0) return { error: { message: source.data.length ? 'This event already has all of those categories.' : 'That event has no categories to copy.' } };
      const copied = await supabase.from('categories').insert(fresh.map((c) => ({ ...c, event_id: id, status })));
      if (!copied.error) router.back();
      return copied;
    });

  return (
    <Screen>
      <Text color="slateGray">Pick an event to copy its categories from. Athletes are not copied, and categories this event already has are skipped.</Text>
      {error && <Text color="danger">{error}</Text>}
      {loading && <SkeletonList />}
      {events
        .filter((e) => e.id !== id)
        .map((event) => (
          <Pressable key={event.id} style={({ pressed }) => pressFeedback(pressed)} disabled={busy} onPress={() => copyFrom(event.id)}>
            <Card>
              <Text variant="bodyLg">{event.name}</Text>
              <Text variant="body" color="slateGray">{formatDateRange(event.start_date, event.end_date)}</Text>
            </Card>
          </Pressable>
        ))}
    </Screen>
  );
}
