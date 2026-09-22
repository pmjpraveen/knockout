import { View } from 'react-native';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/tokens';

const places: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

/** A category's 1st, 2nd and 3rd place (two athletes share 3rd when the bracket has bronze bouts). Nothing until a place is decided. */
export function Podium({ categoryId }: { categoryId: string }) {
  const { rows } = useFocusQuery(() => supabase.rpc('category_podium', { p_category_id: categoryId }), [categoryId], `podium:${categoryId}`);
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: theme.spacing[8] }}>
      <Text variant="subheading" weight="medium">Podium</Text>
      {rows.map((row) => (
        <Card key={`${row.place}-${row.athlete_id}`}>
          <Text weight="medium">{places[row.place]} · {row.athlete_name}</Text>
          <Text variant="body" color="slateGray">{row.club_name}</Text>
        </Card>
      ))}
    </View>
  );
}
