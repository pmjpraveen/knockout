import { useLocalSearchParams } from 'expo-router';
import { CategoryForm } from '@/components/CategoryForm';
import { Screen } from '@/components/Screen';
import { SkeletonScreen } from '@/components/Skeleton';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { supabase } from '@/lib/supabase';

export default function EditCategory() {
  const { id, categoryId } = useLocalSearchParams<{ id: string; categoryId: string }>();
  const { rows } = useFocusQuery(() => supabase.from('categories').select('*').eq('id', categoryId));

  return rows[0] ? <Screen><CategoryForm eventId={id} category={rows[0]} /></Screen> : <SkeletonScreen />;
}
