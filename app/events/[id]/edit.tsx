import { useLocalSearchParams } from 'expo-router';
import { EventForm } from '@/components/EventForm';
import { Screen } from '@/components/Screen';
import { SkeletonScreen } from '@/components/Skeleton';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { supabase } from '@/lib/supabase';

export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rows } = useFocusQuery(() => supabase.from('events').select('*').eq('id', id));

  return rows[0] ? <Screen><EventForm event={rows[0]} /></Screen> : <SkeletonScreen />;
}
