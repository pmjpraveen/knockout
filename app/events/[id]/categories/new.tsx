import { useLocalSearchParams } from 'expo-router';
import { CategoryForm } from '@/components/CategoryForm';
import { Screen } from '@/components/Screen';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { initialCategoryStatus } from '@/lib/events';
import { supabase } from '@/lib/supabase';

export default function NewCategory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rows } = useFocusQuery(() => supabase.from('events').select('status').eq('id', id));
  const status = rows[0]?.status as keyof typeof initialCategoryStatus | undefined;

  return (
    <Screen>
      {status && <CategoryForm eventId={id} initialStatus={initialCategoryStatus[status]} />}
    </Screen>
  );
}
