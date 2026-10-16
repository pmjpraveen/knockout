import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { CategoryForm } from '@/components/CategoryForm';
import { SkeletonScreen } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { initialCategoryStatus } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

export default function NewCategory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { rows } = useFocusQuery(() => supabase.from('events').select('status').eq('id', id));
  const status = rows[0]?.status as keyof typeof initialCategoryStatus | undefined;

  if (!status) return <SkeletonScreen />;

  const draft = status === 'draft';
  const importCard = (
    <View style={{ gap: theme.spacing[12], padding: theme.spacing[16], borderRadius: theme.radii.card, backgroundColor: theme.colors.cloud }}>
      <View style={{ gap: theme.spacing[4] }}>
        <Text variant="bodyLg" weight="medium">Adding several categories?</Text>
        <Text color="slateGray">
          {draft ? 'Fill in one row per category in an Excel (.xlsx) or CSV sheet and import them all at once.' : 'Importing from an Excel (.xlsx) or CSV sheet is only available while the event is a draft.'}
        </Text>
      </View>
      <Button title="Import from a sheet" variant="secondary" disabled={!draft} onPress={() => router.push({ pathname: '/events/[id]/import-categories', params: { id } })} />
    </View>
  );

  return <CategoryForm eventId={id} initialStatus={initialCategoryStatus[status]} header={importCard} />;
}
