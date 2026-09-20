import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SheetImport } from '@/components/SheetImport';
import { SkeletonScreen } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { useEventBelts } from '@/hooks/useEventBelts';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import type { Json } from '@/lib/database.types';
import { CategoryImport, parseCategoryRows } from '@/lib/categoryImport';
import { supabase } from '@/lib/supabase';

export default function ImportCategories() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { rows } = useFocusQuery(() => supabase.from('events').select('id, status').eq('id', id));
  const belts = useEventBelts(id);
  const event = rows[0];
  if (!event) return <SkeletonScreen />;

  const send = async (items: CategoryImport[]) => {
    const { data, error } = await supabase.rpc('import_categories', { p_event_id: id, p_categories: items as unknown as Json });
    const result = data as { inserted: number; skipped: number } | null;
    const skipped = result?.skipped ? `, and ${result.skipped} skipped because a category with that label already exists` : '';
    return { error, summary: result ? `${result.inserted} ${result.inserted === 1 ? 'category' : 'categories'} imported${skipped}.` : undefined };
  };

  return (
    <Screen>
      {event.status === 'draft' ? (
        <SheetImport
          kind="categories"
          belts={belts}
          intro="Fill in one row per category, then upload it to create them all at once. Categories can only be imported while the event is a draft."
          noun={['category', 'categories']}
          parse={(sheetRows) => parseCategoryRows(sheetRows, belts)}
          describe={(category) => category.label}
          send={send}
          onDone={() => router.back()}
        />
      ) : (
        <Text color="slateGray">Categories can only be imported while the event is a draft.</Text>
      )}
    </Screen>
  );
}
