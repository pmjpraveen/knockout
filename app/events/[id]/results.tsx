import { useLocalSearchParams, useRouter } from 'expo-router';
import Crown from 'lucide-react-native/icons/crown';
import Trophy from 'lucide-react-native/icons/trophy';
import { Pressable, View } from 'react-native';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { useEventResults } from '@/hooks/useEventResults';
import type { Finisher } from '@/lib/medals';
import { pressFeedback } from '@/lib/press';
import { theme } from '@/theme/tokens';

const place = (finishers: Finisher[], n: number) => finishers.filter((finisher) => finisher.place === n);

/** The finished categories and who won each: the champion first, then 2nd and 3rd in smaller type. Opens a category's full results. */
export default function Results() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { rows, loading, error } = useEventResults(id);

  return (
    <Screen>
      {error && <Text color="danger">{error}</Text>}
      {loading && <SkeletonList count={3} />}
      {!loading && rows.length === 0 && <EmptyState Icon={Trophy} title="No results yet" text="A category appears here once its last match has been played." />}
      {rows.length > 0 && <Text color="slateGray">{rows.length} {rows.length === 1 ? 'category' : 'categories'} completed</Text>}
      {rows.map((row) => {
        const champion = place(row.finishers, 1)[0];
        const others = [2, 3].flatMap((n) => place(row.finishers, n).map((finisher) => ({ ...finisher, n })));
        return (
          <Card key={row.categoryId}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${row.label}, champion ${champion?.athlete ?? 'unknown'}. Open results`}
              onPress={() => router.push({ pathname: '/events/[id]/bracket', params: { id, categoryId: row.categoryId } })}
              style={({ pressed }) => [{ gap: theme.spacing[12] }, pressFeedback(pressed)]}
            >
              <Text variant="label" color="slateGray" style={{ textTransform: 'uppercase' }}>{row.label}</Text>
              {champion && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[12] }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2B33D', alignItems: 'center', justifyContent: 'center' }}>
                    <Crown size={20} color="#6B4A05" strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1, gap: theme.spacing[4] }}>
                    <Text variant="bodyLg" numberOfLines={1}>{champion.athlete}</Text>
                    {champion.club ? <Text variant="body" color="slateGray" numberOfLines={1}>{champion.club}</Text> : null}
                  </View>
                </View>
              )}
              {others.length > 0 && (
                <View style={{ gap: theme.spacing[4], paddingTop: theme.spacing[12], borderTopWidth: 1, borderTopColor: theme.colors.mist }}>
                  {others.map((finisher) => (
                    <Text key={`${finisher.n}-${finisher.athlete}`} variant="body" color="slateGray" numberOfLines={1}>
                      {finisher.n === 2 ? '2nd' : '3rd'} · {finisher.athlete}{finisher.club ? ` · ${finisher.club}` : ''}
                    </Text>
                  ))}
                </View>
              )}
            </Pressable>
          </Card>
        );
      })}
    </Screen>
  );
}
